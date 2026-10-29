import {
  isDueNow,
  MedicineStore,
  MemoryMedicineStorage,
  nameAsPrinted,
  normaliseTimes,
  parseMedicines,
  timeOfDay,
} from './medicines';
import type { LabelLine } from '../reader/ocrLines';

function line(text: string, minConfidence = 0.95): LabelLine {
  return { text, minConfidence, lowConfidence: minConfidence < 0.5, language: 'en', box: null };
}

// Synthetic labels only.
const LABEL_A = [line('PARACETAMOL'), line('Tablets BP 500 mg'), line('Take 1 tds', 0.3), line('Exp 08/2028')];
const LABEL_B = [line('PARACETAMOL'), line('Tablets BP 1000 mg')];

function at(hour: number, minute = 0): Date {
  return new Date(2026, 9, 29, hour, minute);
}

let n = 0;
function makeStore(storage = new MemoryMedicineStorage()) {
  n = 0;
  return { storage, store: new MedicineStore(storage, () => `id${++n}`) };
}

describe('the "Now" rule', () => {
  it('maps the clock to a part of the day with fixed boundaries', () => {
    expect(timeOfDay(at(4, 59))).toBe('night');
    expect(timeOfDay(at(5))).toBe('morning');
    expect(timeOfDay(at(11, 59))).toBe('morning');
    expect(timeOfDay(at(12))).toBe('midday');
    expect(timeOfDay(at(15, 59))).toBe('midday');
    expect(timeOfDay(at(16))).toBe('evening');
    expect(timeOfDay(at(20, 59))).toBe('evening');
    expect(timeOfDay(at(21))).toBe('night');
    expect(timeOfDay(at(0))).toBe('night');
  });

  it('is due only when a caregiver-set time matches the current time of day', () => {
    expect(isDueNow(['morning', 'night'], at(8))).toBe(true);
    expect(isDueNow(['morning', 'night'], at(23))).toBe(true);
    expect(isDueNow(['morning', 'night'], at(14))).toBe(false);
    expect(isDueNow(['evening'], at(8))).toBe(false);
  });

  it('is never due when no time was set, whatever the label says', () => {
    for (let h = 0; h < 24; h++) expect(isDueNow([], at(h))).toBe(false);
  });
});

describe('nameAsPrinted', () => {
  it('is the first readable line, verbatim', () => {
    expect(nameAsPrinted(LABEL_A)).toBe('PARACETAMOL');
  });

  it('skips a line OCR was unsure of and gives nothing when none is readable', () => {
    expect(nameAsPrinted([line('PARACETAM0L', 0.2), line('Tablets BP 500 mg')])).toBe('Tablets BP 500 mg');
    expect(nameAsPrinted([line('???', 0.1)])).toBe('');
    expect(nameAsPrinted([])).toBe('');
  });
});

describe('MedicineStore', () => {
  it('saves the lines with their confidence, the photo, the name and the date, with no times', async () => {
    const { store, storage } = makeStore();
    await store.load();
    const m = await store.add({ photoUri: 'file:///cache/a.jpg', lines: LABEL_A, now: new Date('2026-10-29T08:00:00Z') });

    expect(m).toMatchObject({ id: 'id1', name: 'PARACETAMOL', savedAt: '2026-10-29T08:00:00.000Z', times: [] });
    expect(m.photoUri).toBe('file:///medicines/id1.jpg');
    expect(storage.photos.get(m.photoUri)).toBe('file:///cache/a.jpg');
    expect(m.lines.map((l) => [l.text, l.minConfidence, l.lowConfidence])).toEqual([
      ['PARACETAMOL', 0.95, false],
      ['Tablets BP 500 mg', 0.95, false],
      ['Take 1 tds', 0.3, true],
      ['Exp 08/2028', 0.95, false],
    ]);
  });

  it('never works out times from the label: "1 tds" leaves the times empty', async () => {
    const { store } = makeStore();
    const m = await store.add({ photoUri: 'file:///a.jpg', lines: [line('PARACETAMOL'), line('Take 1x3 daily')] });
    expect(m.times).toEqual([]);
  });

  it('survives an app restart: a new store on the same storage reads it back, still unsure where it was', async () => {
    const { store, storage } = makeStore();
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    await store.setTimes('id1', ['night', 'morning']);

    const reopened = new MedicineStore(storage);
    await reopened.load();
    const [m] = reopened.list();
    expect(m!.times).toEqual(['morning', 'night']);
    expect(m!.lines[2]).toMatchObject({ text: 'Take 1 tds', lowConfidence: true, minConfidence: 0.3 });
    expect(m!.lines[0]!.lowConfidence).toBe(false);
  });

  it('keeps two similar boxes apart', async () => {
    const { store } = makeStore();
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    await store.add({ photoUri: 'file:///b.jpg', lines: LABEL_B });
    expect(store.list().map((m) => m.id)).toEqual(['id1', 'id2']);
    expect(store.list()[1]!.lines[1]!.text).toBe('Tablets BP 1000 mg');
  });

  it('sets times in day order without repeats, and only for a medicine that exists', async () => {
    const { store, storage } = makeStore();
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_B });
    await store.setTimes('id1', ['night', 'morning', 'night']);
    expect(store.list()[0]!.times).toEqual(['morning', 'night']);
    const writes = storage.saved.length;
    await store.setTimes('nope', ['morning']);
    expect(storage.saved.length).toBe(writes);
    await store.setTimes('id1', []);
    expect(store.list()[0]!.times).toEqual([]);
  });

  it('removes the medicine and its photo', async () => {
    const { store, storage } = makeStore();
    const a = await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    await store.add({ photoUri: 'file:///b.jpg', lines: LABEL_B });
    await store.remove(a.id);
    expect(store.list().map((m) => m.id)).toEqual(['id2']);
    expect(storage.photos.has(a.photoUri)).toBe(false);
    expect(storage.photos.size).toBe(1);
    const reopened = new MedicineStore(storage);
    await reopened.load();
    expect(reopened.list().map((m) => m.id)).toEqual(['id2']);
  });

  it('keeps nothing when the photo cannot be stored', async () => {
    const { store, storage } = makeStore();
    storage.failPhoto = true;
    await expect(store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A })).rejects.toThrow();
    expect(store.list()).toEqual([]);
    expect(storage.saved).toEqual([]);
  });

  it('keeps nothing, and removes the stored photo, when the list cannot be written', async () => {
    const { store, storage } = makeStore();
    storage.failSave = true;
    await expect(store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A })).rejects.toThrow('disk full');
    expect(store.list()).toEqual([]);
    expect(storage.photos.size).toBe(0);

    // The next save works: a failure doesn't wedge the queue.
    storage.failSave = false;
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    expect(store.list()).toHaveLength(1);
  });

  it('does not show a deletion or a time change that was not written', async () => {
    const { store, storage } = makeStore();
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    storage.failSave = true;
    await expect(store.remove('id1')).rejects.toThrow();
    await expect(store.setTimes('id1', ['morning'])).rejects.toThrow();
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]!.times).toEqual([]);
    expect(storage.photos.size).toBe(1);
  });

  it('applies overlapping changes in order', async () => {
    const { store, storage } = makeStore();
    await Promise.all([
      store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A }),
      store.add({ photoUri: 'file:///b.jpg', lines: LABEL_B }),
    ]);
    await Promise.all([store.setTimes('id1', ['morning']), store.setTimes('id1', ['evening']), store.remove('id2')]);
    expect(store.list().map((m) => [m.id, m.times])).toEqual([['id1', ['evening']]]);
    expect(storage.saved.at(-1)!.map((m) => m.id)).toEqual(['id1']);
  });

  it('starts empty when the saved file is unreadable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryMedicineStorage();
    storage.load = async () => {
      throw new SyntaxError('bad json');
    };
    const store = new MedicineStore(storage);
    await store.load();
    expect(store.list()).toEqual([]);
    warn.mockRestore();
  });

  it('tells listeners when the list changes', async () => {
    const { store } = makeStore();
    const seen: number[] = [];
    const off = store.subscribe(() => seen.push(store.list().length));
    await store.add({ photoUri: 'file:///a.jpg', lines: LABEL_A });
    await store.remove('id1');
    off();
    await store.add({ photoUri: 'file:///b.jpg', lines: LABEL_B });
    expect(seen).toEqual([1, 0]);
  });
});

describe('parseMedicines', () => {
  const good = { id: 'x', name: 'N', photoUri: 'file:///x.jpg', savedAt: '2026-10-29T00:00:00.000Z', times: ['night', 'bogus'], lines: [line('A')] };

  it('drops a damaged entry, not the whole list, and ignores unknown times', () => {
    const out = parseMedicines({ medicines: [good, { id: 5 }, null, { ...good, id: 'y', lines: [{ text: 1 }] }] });
    expect(out.map((m) => m.id)).toEqual(['x']);
    expect(out[0]!.times).toEqual(['night']);
  });

  it('treats a saved line with a damaged flag as unsure, never as sure', () => {
    const out = parseMedicines({ medicines: [{ ...good, lines: [{ text: 'Take 4', minConfidence: 0.9, lowConfidence: 'maybe' }] }] });
    expect(out[0]!.lines[0]!.lowConfidence).toBe(true);
  });

  it('reads nothing or junk as an empty list', () => {
    expect(parseMedicines(null)).toEqual([]);
    expect(parseMedicines({ medicines: 'x' })).toEqual([]);
    expect(parseMedicines([1, 2])).toEqual([]);
  });

  it('normaliseTimes orders and de-duplicates', () => {
    expect(normaliseTimes(['night', 'morning', 'morning', 'x'])).toEqual(['morning', 'night']);
  });
});
