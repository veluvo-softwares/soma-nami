import { splitDetails } from '../reader/details';
import type { LabelLine } from '../reader/ocrLines';

/**
 * Dawa zangu (docs/ui.md screen 6, card C9): labels the user chose to keep.
 * Everything here is stored on the phone only.
 *
 * Times of day are set by the caregiver (or, later, the pharmacist in C7).
 * They are never worked out from the label: turning "1x3" into morning,
 * midday, evening would be interpreting a dose (product rule 1).
 */
export const TIMES_OF_DAY = ['morning', 'midday', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const TIME_LABELS: Record<TimeOfDay, { sw: string; en: string }> = {
  morning: { sw: 'Asubuhi', en: 'Morning' },
  midday: { sw: 'Mchana', en: 'Midday' },
  evening: { sw: 'Jioni', en: 'Evening' },
  night: { sw: 'Usiku', en: 'Night' },
};

export interface SavedMedicine {
  id: string;
  /** The first readable line of the label, exactly as printed. Empty when no line was readable. */
  name: string;
  /** The photo the user took, copied into the app's own folder. */
  photoUri: string;
  /** ISO date-time of the save. */
  savedAt: string;
  /** The OCR lines as read, text and confidence untouched, so a replay keeps the unsure marks. */
  lines: LabelLine[];
  /** Set only by the caregiver (or the pharmacist). Empty means none: show none. */
  times: TimeOfDay[];
}

export interface NewMedicine {
  photoUri: string;
  lines: LabelLine[];
  now?: Date;
}

/** The medicine's name as printed: the first line OCR was sure of that is read aloud (not a batch code or address). */
export function nameAsPrinted(lines: readonly LabelLine[]): string {
  const { read } = splitDetails([...lines]);
  for (const i of read) {
    const line = lines[i];
    if (line && !line.lowConfidence && line.text.trim()) return line.text.trim();
  }
  return '';
}

/**
 * Which part of the day a clock time falls in. Fixed boundaries, so the
 * "Now" mark is predictable:
 *   asubuhi 05:00-11:59, mchana 12:00-15:59, jioni 16:00-20:59, usiku 21:00-04:59.
 */
export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'midday';
  if (h >= 16 && h < 21) return 'evening';
  return 'night';
}

/** "Sasa": true only when the caregiver set a time that matches the current part of the day. */
export function isDueNow(times: readonly TimeOfDay[], date: Date): boolean {
  return times.includes(timeOfDay(date));
}

/** Times in day order, whatever order they were set in, with no repeats. */
export function normaliseTimes(times: readonly unknown[]): TimeOfDay[] {
  return TIMES_OF_DAY.filter((t) => times.includes(t));
}

function parseLine(raw: unknown): LabelLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== 'string' || typeof r.minConfidence !== 'number') return null;
  const language = r.language === 'sw' ? 'sw' : 'en';
  return {
    text: r.text,
    minConfidence: r.minConfidence,
    // A saved line stays unsure if it was; a damaged flag errs towards unsure.
    lowConfidence: r.lowConfidence === false ? false : true,
    language,
    box: (r.box as LabelLine['box']) ?? null,
  };
}

/** Reads the saved list tolerantly: a damaged entry is dropped, not the whole list. */
export function parseMedicines(raw: unknown): SavedMedicine[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { medicines?: unknown }).medicines)
    ? ((raw as { medicines: unknown[] }).medicines)
    : [];
  const out: SavedMedicine[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.photoUri !== 'string' || !Array.isArray(r.lines)) continue;
    const lines = r.lines.map(parseLine);
    if (lines.some((l) => l === null)) continue;
    out.push({
      id: r.id,
      name: typeof r.name === 'string' ? r.name : '',
      photoUri: r.photoUri,
      savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
      lines: lines as LabelLine[],
      times: normaliseTimes(Array.isArray(r.times) ? r.times : []),
    });
  }
  return out;
}

/** Where the list and the photos live. The app uses files on the phone; tests use memory. */
export interface MedicineStorage {
  /** The saved JSON, or null when nothing is saved yet. */
  load(): Promise<unknown>;
  save(medicines: readonly SavedMedicine[]): Promise<void>;
  /** Keeps a copy of the photo under the medicine's id; returns where the copy is. */
  storePhoto(id: string, sourceUri: string): Promise<string>;
  /** Removes a stored photo. Best effort. */
  deletePhoto(uri: string): Promise<void>;
}

export class MemoryMedicineStorage implements MedicineStorage {
  saved: SavedMedicine[][] = [];
  photos = new Map<string, string>();
  failPhoto = false;
  failSave = false;
  constructor(private value: unknown = null) {}
  async load() {
    return this.value;
  }
  async save(medicines: readonly SavedMedicine[]) {
    if (this.failSave) throw new Error('disk full');
    this.value = { medicines };
    this.saved.push([...medicines]);
  }
  async storePhoto(id: string, sourceUri: string) {
    if (this.failPhoto) throw new Error('no space');
    const uri = `file:///medicines/${id}.jpg`;
    this.photos.set(uri, sourceUri);
    return uri;
  }
  async deletePhoto(uri: string) {
    this.photos.delete(uri);
  }
}

/**
 * The list of saved medicines. Changes are applied in order, one write at a
 * time, so an older save can never land after a newer one. A change is only
 * kept in memory once the write to storage has succeeded, so the screen never
 * shows a medicine that is not really saved.
 */
export class MedicineStore {
  private items: SavedMedicine[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(private storage: MedicineStorage, private newId: () => string = defaultId) {}

  list(): readonly SavedMedicine[] {
    return this.items;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Loads the saved list. A list that can't be read is treated as empty. */
  load(): Promise<void> {
    return this.enqueue(async () => {
      try {
        this.items = parseMedicines(await this.storage.load());
      } catch (e) {
        console.warn('[soma] medicines load failed, starting empty', e);
        this.items = [];
      }
      this.emit();
    });
  }

  /** Saves a read label. Rejects, and keeps nothing, if the photo or the list can't be written. */
  add(input: NewMedicine): Promise<SavedMedicine> {
    return this.enqueue(async () => {
      const id = this.newId();
      const photoUri = await this.storage.storePhoto(id, input.photoUri);
      const medicine: SavedMedicine = {
        id,
        name: nameAsPrinted(input.lines),
        photoUri,
        savedAt: (input.now ?? new Date()).toISOString(),
        lines: input.lines.map((l) => ({ ...l })),
        times: [],
      };
      try {
        await this.storage.save([...this.items, medicine]);
      } catch (e) {
        await this.storage.deletePhoto(photoUri).catch(() => undefined);
        throw e;
      }
      this.items = [...this.items, medicine];
      this.emit();
      return medicine;
    });
  }

  /** Caregiver only: the times of day for one medicine. */
  setTimes(id: string, times: readonly TimeOfDay[]): Promise<void> {
    return this.enqueue(async () => {
      if (!this.items.some((m) => m.id === id)) return;
      const next = this.items.map((m) => (m.id === id ? { ...m, times: normaliseTimes(times) } : m));
      await this.storage.save(next);
      this.items = next;
      this.emit();
    });
  }

  /** Caregiver only: removes the medicine and its photo. */
  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const gone = this.items.find((m) => m.id === id);
      if (!gone) return;
      const next = this.items.filter((m) => m.id !== id);
      await this.storage.save(next);
      this.items = next;
      this.emit();
      await this.storage.deletePhoto(gone.photoUri).catch((e) => console.warn('[soma] photo delete failed', e));
    });
  }
}

let counter = 0;
function defaultId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
