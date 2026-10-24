import { themes, touch, type, type Palette } from './tokens';

function channel(hex: string, i: number): number {
  const c = parseInt(hex.slice(i, i + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe.each(Object.entries(themes))('%s theme', (_name, p: Palette) => {
  // Low-vision users: hold every text pairing to WCAG AAA (7:1).
  it('has AAA contrast for text on the background', () => {
    expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.textMuted, p.background)).toBeGreaterThanOrEqual(7);
  });

  it.each(['primary', 'ask', 'warning'] as const)('has AAA contrast for text on %s', (accent) => {
    expect(contrast(p.onAccent, p[accent])).toBeGreaterThanOrEqual(7);
  });
});

describe('ui.md tokens', () => {
  it('uses the colours from the spec for the dark theme', () => {
    expect(themes.dark).toMatchObject({
      background: '#0E0E0E',
      text: '#FFFFFF',
      primary: '#FFD60A',
      ask: '#8EC9FF',
      warning: '#FF9F43',
      onAccent: '#000000',
    });
  });

  it('keeps body text at 20 or more, headings 30–52 and targets at 88', () => {
    expect(type.body).toBeGreaterThanOrEqual(20);
    expect(type.heading).toBeGreaterThanOrEqual(30);
    expect(type.display).toBeLessThanOrEqual(52);
    expect(touch.minSize).toBeGreaterThanOrEqual(88);
  });
});
