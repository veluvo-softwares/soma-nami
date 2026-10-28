import type { ThemeName } from '../theme/tokens';

export type Language = 'sw' | 'en';
export type VoiceSpeed = 'slow' | 'normal' | 'fast';

/** Caregiver setup (docs/ui.md screen 7). Stored only on the phone. */
export interface Settings {
  /** Language of the app's own words. Label text is never affected. */
  language: Language;
  voiceSpeed: VoiceSpeed;
  theme: ThemeName;
  /** The helper's phone number as typed; see `dialNumber`. Empty when none was set. */
  helperNumber: string;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'sw',
  voiceSpeed: 'normal',
  theme: 'dark',
  helperNumber: '',
};

/** Playback rate for each voice speed (the "Polepole" button is 0.8 of this). */
export const SPEED_RATE: Record<VoiceSpeed, number> = { slow: 0.8, normal: 1, fast: 1.25 };

export const MAX_HELPER_CHARS = 20;

/** Keeps what a phone number can contain; drops everything else (letters, symbols). */
export function sanitizeHelperNumber(input: string): string {
  return input.replace(/[^0-9+\-() ]/g, '').slice(0, MAX_HELPER_CHARS);
}

/**
 * The number to dial, or null if there isn't a usable one: digits with an
 * optional leading +, at least 5 digits. The button to call is hidden on null.
 */
export function dialNumber(helperNumber: string): string | null {
  const trimmed = helperNumber.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 5 ? plus + digits : null;
}

/** Reads saved settings tolerantly: anything missing or unknown falls back to the default. */
export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_SETTINGS;
  return {
    language: r.language === 'sw' || r.language === 'en' ? r.language : D.language,
    voiceSpeed: r.voiceSpeed === 'slow' || r.voiceSpeed === 'normal' || r.voiceSpeed === 'fast' ? r.voiceSpeed : D.voiceSpeed,
    theme: r.theme === 'dark' || r.theme === 'light' ? r.theme : D.theme,
    helperNumber: typeof r.helperNumber === 'string' ? sanitizeHelperNumber(r.helperNumber) : D.helperNumber,
  };
}

export interface SettingsStorage {
  /** The saved JSON, or null if nothing is saved yet. */
  load(): Promise<unknown>;
  save(settings: Settings): Promise<void>;
}

/** For tests, and as the fallback when the phone's storage can't be used. */
export class MemorySettingsStorage implements SettingsStorage {
  saved: Settings[] = [];
  constructor(private value: unknown = null) {}
  async load() {
    return this.value;
  }
  async save(settings: Settings) {
    this.value = settings;
    this.saved.push(settings);
  }
}
