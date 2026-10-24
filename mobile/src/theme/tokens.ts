/**
 * Design tokens from docs/ui.md (Rules 3–5, 8). Every screen takes its colours,
 * type and sizes from here; don't hard-code them in a screen.
 */

/**
 * Atkinson Hyperlegible (SIL OFL), embedded at build time by the expo-font
 * config plugin in app.json, so it works with no network. On iOS the family is
 * the font's PostScript name, on Android the file name; the files are named so
 * both match. Use one family per weight instead of `fontWeight`, which Android
 * would fake.
 */
export const fonts = {
  regular: 'AtkinsonHyperlegible-Regular',
  bold: 'AtkinsonHyperlegible-Bold',
} as const;

export interface Palette {
  /** Screen background. */
  background: string;
  /** Text and icons on the background. */
  text: string;
  /** Secondary text (the small English line under a Swahili word). */
  textMuted: string;
  /** Borders and progress-bar tracks on the background. */
  outline: string;
  /** Main action (Gusa kusoma, Pakua). */
  primary: string;
  /** Ask (Uliza swali, the mic). */
  ask: string;
  /** Not sure / unreadable lines. */
  warning: string;
  /** Text on any of the three accent colours. Always dark. */
  onAccent: string;
}

/** Default theme. */
export const dark: Palette = {
  background: '#0E0E0E',
  text: '#FFFFFF',
  textMuted: '#C7C7C7',
  outline: '#5A5A5A',
  primary: '#FFD60A',
  ask: '#8EC9FF',
  warning: '#FF9F43',
  onAccent: '#000000',
};

/** Caregiver setup option: near-black on off-white, same accents with dark text. */
export const light: Palette = {
  background: '#F7F5EF',
  text: '#111111',
  textMuted: '#3D3D3D',
  outline: '#8A8A8A',
  primary: '#FFD60A',
  ask: '#8EC9FF',
  warning: '#FF9F43',
  onAccent: '#000000',
};

export const themes = { dark, light } as const;
export type ThemeName = keyof typeof themes;

/**
 * Type sizes in points. Body is at least 20, headings 30–52. These are the
 * floor: Text scales up with the system text size (allowFontScaling stays on).
 */
export const type = {
  hint: 18,
  body: 20,
  bodyLarge: 24,
  button: 26,
  heading: 30,
  headingLarge: 40,
  display: 52,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Rule 5: every touch target at least 88 in both directions, 16 apart. */
export const touch = {
  minSize: 88,
  gap: 16,
} as const;

export const radius = {
  md: 12,
  lg: 20,
} as const;
