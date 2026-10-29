import { File } from 'expo-file-system';

import { localFile, photoDir } from '../storage/localStore';

import type { MedicineStorage, SavedMedicine } from './medicines';

const INDEX = 'soma-nami-medicines.json';

/**
 * The saved list as a small JSON file and the photos as files next to it, in
 * the app's document folder. Never leaves the phone; no account, no network.
 */
export const fileMedicineStorage: MedicineStorage = {
  async load() {
    const file = localFile(INDEX);
    if (!file.exists) return null;
    return JSON.parse(await file.text());
  },
  async save(medicines: readonly SavedMedicine[]) {
    const file = localFile(INDEX);
    if (!file.exists) file.create();
    file.write(JSON.stringify({ medicines }));
  },
  async storePhoto(id: string, sourceUri: string) {
    const target = new File(photoDir(), `${id}.jpg`);
    if (target.exists) target.delete();
    new File(sourceUri).copy(target);
    return target.uri;
  },
  async deletePhoto(uri: string) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
};
