import { createContext, useContext, type ReactNode } from 'react';

import { themes, type Palette, type ThemeName } from './tokens';

export * from './tokens';

const ThemeContext = createContext<Palette>(themes.dark);

/**
 * Supplies the palette to every screen. Dark is the default; caregiver setup
 * (C6) will choose `light` and persist it.
 */
export function ThemeProvider({
  name = 'dark',
  children,
}: {
  name?: ThemeName;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>;
}

export function usePalette(): Palette {
  return useContext(ThemeContext);
}
