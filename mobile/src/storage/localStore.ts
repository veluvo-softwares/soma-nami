import { Directory, File, Paths } from 'expo-file-system';

import { excludeFromBackup } from '../../modules/backup-exclusion';

/**
 * Everything Soma Nami saves (settings with the helper's number, saved medicine
 * photos, text and list) lives in this one folder. It is marked excluded from
 * iCloud and iTunes backup, so nothing leaves the phone that way. It is in the
 * document folder, not Caches, because iOS may purge Caches and saved medicines
 * must survive.
 */
export const LOCAL_DIR = 'local-only';

const SETTINGS = 'soma-nami-settings.json';
const MEDICINES_INDEX = 'soma-nami-medicines.json';
const PHOTOS = 'medicines';

let migrated = false;

/** The backup-excluded folder; created, flagged and (once per run) migrated on first use. */
export function localDir(): Directory {
  const dir = new Directory(Paths.document, LOCAL_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  // Every time, not just on creation: it is cheap, and covers a folder that a
  // build without the native module created.
  excludeFromBackup(dir.uri);
  if (!migrated) {
    migrated = true;
    migrateLegacy(dir);
  }
  return dir;
}

export function localFile(name: string): File {
  return new File(localDir(), name);
}

/** Folder for saved medicine photos, inside the excluded folder. */
export function photoDir(): Directory {
  const dir = new Directory(localDir(), PHOTOS);
  if (!dir.exists) dir.create();
  return dir;
}

/** Test hook: forget that the one-time migration ran. */
export function resetLocalStoreForTests(): void {
  migrated = false;
}

/**
 * Early dev installs wrote straight into the document folder, which iOS backs
 * up. Move those files into the excluded folder once. A failure is logged, not
 * thrown: the old file stays where it was and nothing is lost.
 */
function migrateLegacy(dir: Directory): void {
  for (const name of [SETTINGS, MEDICINES_INDEX]) {
    try {
      const old = new File(Paths.document, name);
      if (!old.exists) continue;
      const target = new File(dir, name);
      // A file already in the new place is newer; drop the old copy so it stops being backed up.
      if (target.exists) old.delete();
      else old.move(target);
    } catch (e) {
      console.warn('[soma] could not move', name, e);
    }
  }
  try {
    const oldPhotos = new Directory(Paths.document, PHOTOS);
    if (oldPhotos.exists) {
      const newPhotos = new Directory(dir, PHOTOS);
      if (!newPhotos.exists) newPhotos.create();
      for (const item of oldPhotos.list()) {
        if (!(item instanceof File)) continue;
        const target = new File(newPhotos, item.name);
        if (target.exists) item.delete();
        else item.move(target);
      }
      oldPhotos.delete();
    }
  } catch (e) {
    console.warn('[soma] could not move saved photos', e);
  }
  rewritePhotoUris(dir);
}

/** The saved list holds each photo's full URI; point it at the new folder. */
function rewritePhotoUris(dir: Directory): void {
  try {
    const index = new File(dir, MEDICINES_INDEX);
    if (!index.exists) return;
    const newPhotos = new Directory(dir, PHOTOS);
    const legacyBase = new Directory(Paths.document, PHOTOS).uri;
    const raw = index.textSync();
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.medicines)) return;
    let changed = false;
    for (const m of data.medicines) {
      if (m && typeof m.photoUri === 'string' && m.photoUri.startsWith(legacyBase)) {
        m.photoUri = new File(newPhotos, m.photoUri.slice(legacyBase.length)).uri;
        changed = true;
      }
    }
    if (changed) index.write(JSON.stringify(data));
  } catch (e) {
    console.warn('[soma] could not update photo paths', e);
  }
}
