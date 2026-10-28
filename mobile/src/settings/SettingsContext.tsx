import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_SETTINGS, parseSettings, type Language, type Settings, type SettingsStorage } from './settings';

interface Value {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

// Outside a provider (screen tests) everything is the default and changes are ignored.
const SettingsContext = createContext<Value>({ settings: DEFAULT_SETTINGS, update: () => undefined });

interface Props {
  storage: SettingsStorage;
  /** Wins over the saved value; for tests and previews. */
  override?: Partial<Settings>;
  children: ReactNode;
}

/**
 * Loads the caregiver's choices once, then saves every change. Nothing is
 * drawn until the load finishes, so the screen never flashes the wrong theme
 * or language. A load that fails falls back to the defaults; a save that
 * fails is logged and the choice still applies until the app closes.
 */
export function SettingsProvider({ storage, override, children }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const latest = useRef<Settings>(DEFAULT_SETTINGS);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const changed = useRef(false);

  useEffect(() => {
    let alive = true;
    storage
      .load()
      .catch((e) => {
        console.warn('[soma] settings load failed, using defaults', e);
        return null;
      })
      .then((raw) => {
        if (!alive) return;
        // A change made before the load finished is newer than what was saved.
        if (!changed.current) latest.current = parseSettings(raw);
        setSettings(latest.current);
      });
    return () => {
      alive = false;
    };
  }, [storage]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      changed.current = true;
      const next = parseSettings({ ...latest.current, ...patch });
      latest.current = next;
      setSettings(next);
      // One write at a time, in order, so an older save can't land last.
      writes.current = writes.current
        .then(() => storage.save(next))
        .catch((e) => console.warn('[soma] settings save failed', e));
    },
    [storage],
  );

  const value = useMemo<Value | null>(
    () => (settings ? { settings: { ...settings, ...override }, update } : null),
    [settings, override, update],
  );
  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Value {
  return useContext(SettingsContext);
}

export function useLanguage(): Language {
  return useContext(SettingsContext).settings.language;
}

/**
 * Picks the main word and the small line under it. Swahili is first by
 * default; in English mode the two swap. Both are always available to the
 * screen reader (label and hint).
 */
export function useBi(): (sw: string, en: string) => { main: string; sub: string } {
  const language = useLanguage();
  return useCallback((sw, en) => (language === 'sw' ? { main: sw, sub: en } : { main: en, sub: sw }), [language]);
}
