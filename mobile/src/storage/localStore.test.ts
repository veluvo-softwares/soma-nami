import { fileMedicineStorage } from '../medicines/fileMedicineStorage';
import { fileSettingsStorage } from '../settings/fileSettingsStorage';
import { localDir, resetLocalStoreForTests } from './localStore';

// A fake file system: paths are strings, files hold text. Synthetic data only.
const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();
const mockExcluded: string[] = [];
let mockFailExclude = false;

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/')
      .replace('file:/', 'file:///');
  class FakeFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop() as string;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(t: string) {
      mockFiles.set(this.uri, t);
    }
    textSync() {
      return mockFiles.get(this.uri) as string;
    }
    async text() {
      return mockFiles.get(this.uri) as string;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    copy(to: FakeFile) {
      mockFiles.set(to.uri, mockFiles.get(this.uri) as string);
    }
    move(to: FakeFile) {
      mockFiles.set(to.uri, mockFiles.get(this.uri) as string);
      mockFiles.delete(this.uri);
      this.uri = to.uri;
    }
  }
  class FakeDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts) + '/';
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    delete() {
      mockDirs.delete(this.uri);
    }
    list() {
      return [...mockFiles.keys()]
        .filter((k) => k.startsWith(this.uri) && !k.slice(this.uri.length).includes('/'))
        .map((k) => new FakeFile(k));
    }
  }
  return { File: FakeFile, Directory: FakeDirectory, Paths: { document: new FakeDirectory('file:///app/Documents') } };
});

jest.mock('../../modules/backup-exclusion', () => ({
  excludeFromBackup: (uri: string) => {
    if (mockFailExclude) throw new Error('refused');
    mockExcluded.push(uri);
  },
}));


const DOCS = 'file:///app/Documents/';
const LOCAL = DOCS + 'local-only/';

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockExcluded.length = 0;
  mockFailExclude = false;
  resetLocalStoreForTests();
  mockDirs.add(DOCS);
});

describe('where things are stored', () => {
  it('flags the local folder as mockExcluded from backup, and keeps it', () => {
    localDir();
    expect(mockDirs.has(LOCAL)).toBe(true);
    expect(mockExcluded).toContain(LOCAL);
  });

  it('writes settings inside the mockExcluded folder, not in Documents', async () => {
    await fileSettingsStorage.save({ helperNumber: '0700000000' } as never);
    expect([...mockFiles.keys()]).toEqual([LOCAL + 'soma-nami-settings.json']);
    expect(await fileSettingsStorage.load()).toEqual({ helperNumber: '0700000000' });
  });

  it('writes the list and photos inside the mockExcluded folder', async () => {
    mockFiles.set('file:///cache/photo.jpg', 'jpg');
    const uri = await fileMedicineStorage.storePhoto('m1', 'file:///cache/photo.jpg');
    await fileMedicineStorage.save([]);
    expect(uri.startsWith(LOCAL + 'medicines/')).toBe(true);
    expect(mockFiles.has(LOCAL + 'soma-nami-medicines.json')).toBe(true);
    expect([...mockFiles.keys()].filter((k) => k.startsWith(DOCS) && !k.startsWith(LOCAL))).toEqual([]);
  });

  it('surfaces an iOS refusal instead of saving into the backup', () => {
    mockFailExclude = true;
    expect(() => localDir()).toThrow('refused');
  });
});

describe('moving old data out of Documents', () => {
  it('moves settings, list and photos once and fixes the photo paths', async () => {
    mockDirs.add(DOCS + 'medicines/');
    mockFiles.set(DOCS + 'soma-nami-settings.json', '{"helperNumber":"0700000000"}');
    mockFiles.set(DOCS + 'medicines/m1.jpg', 'jpg1');
    mockFiles.set(
      DOCS + 'soma-nami-medicines.json',
      JSON.stringify({ medicines: [{ id: 'm1', photoUri: DOCS + 'medicines/m1.jpg', lines: [] }] }),
    );

    expect(await fileSettingsStorage.load()).toEqual({ helperNumber: '0700000000' });
    const list = (await fileMedicineStorage.load()) as { medicines: { photoUri: string }[] };

    expect(list.medicines[0]?.photoUri).toBe(LOCAL + 'medicines/m1.jpg');
    expect(mockFiles.get(LOCAL + 'medicines/m1.jpg')).toBe('jpg1');
    // Nothing left behind in the backed-up folder.
    expect([...mockFiles.keys()].filter((k) => !k.startsWith(LOCAL))).toEqual([]);
    expect(mockDirs.has(DOCS + 'medicines/')).toBe(false);
  });

  it('does nothing when there is no old data', async () => {
    expect(await fileSettingsStorage.load()).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it('keeps the newer file in the new place and deletes the old copy', async () => {
    mockDirs.add(LOCAL);
    mockFiles.set(LOCAL + 'soma-nami-settings.json', '{"new":1}');
    mockFiles.set(DOCS + 'soma-nami-settings.json', '{"old":1}');
    expect(await fileSettingsStorage.load()).toEqual({ new: 1 });
    expect(mockFiles.has(DOCS + 'soma-nami-settings.json')).toBe(false);
  });

  it('runs only once per launch', async () => {
    await fileSettingsStorage.load();
    mockFiles.set(DOCS + 'soma-nami-settings.json', '{"late":1}');
    expect(await fileSettingsStorage.load()).toBeNull();
  });
});
