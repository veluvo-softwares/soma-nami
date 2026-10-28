import { DEFAULT_SETTINGS, dialNumber, parseSettings, sanitizeHelperNumber } from './settings';

describe('parseSettings', () => {
  it('falls back to the defaults for nothing, junk or unknown values', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ language: 'fr', voiceSpeed: 'warp', theme: 'pink', helperNumber: 5 })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid saved choices and cleans the number', () => {
    expect(parseSettings({ language: 'en', voiceSpeed: 'slow', theme: 'light', helperNumber: '+254 700 000 000abc' })).toEqual({
      language: 'en',
      voiceSpeed: 'slow',
      theme: 'light',
      helperNumber: '+254 700 000 000',
    });
  });
});

describe('helper number', () => {
  it('drops letters and caps the length', () => {
    expect(sanitizeHelperNumber('07a1b2')).toBe('0712');
    expect(sanitizeHelperNumber('1'.repeat(40))).toHaveLength(20);
  });

  it('dials digits with an optional leading +, and nothing when too short or empty', () => {
    expect(dialNumber('+254 (700) 000-000')).toBe('+254700000000');
    expect(dialNumber('0700 000 000')).toBe('0700000000');
    expect(dialNumber('')).toBeNull();
    expect(dialNumber('123')).toBeNull();
    expect(dialNumber('   ')).toBeNull();
  });
});
