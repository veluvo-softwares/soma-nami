// Guards the store-facing config from card C10: the Info.plist strings App
// Review checks, the export-compliance answer, and the EAS profiles that build
// for TestFlight. A missing usage string makes iOS kill the app the first time
// it opens the camera or microphone.
import appJson from '../../app.json';
import easJson from '../../eas.json';
import en from '../../locales/en.json';
import sw from '../../locales/sw.json';

const USAGE_KEYS = ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription'] as const;

describe('iOS Info.plist', () => {
  const plist = appJson.expo.ios.infoPlist as Record<string, unknown>;

  it('declares no non-exempt encryption, so TestFlight skips the export question', () => {
    expect(plist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it.each(USAGE_KEYS)('has a bilingual default %s', (key) => {
    const text = plist[key];
    expect(typeof text).toBe('string');
    // Swahili first, then English, for phones set to any other language.
    expect(text).toMatch(/inatumia/);
    expect(text).toMatch(/uses the/);
  });

  it('points each locale at its own strings', () => {
    expect(appJson.expo.locales).toEqual({ sw: './locales/sw.json', en: './locales/en.json' });
  });

  it.each([
    ['sw', sw.ios, /inatumia/],
    ['en', en.ios, /uses the/],
  ])('%s has both usage strings in its language', (_lang, strings, marker) => {
    for (const key of USAGE_KEYS) {
      expect(strings[key]).toMatch(marker);
    }
  });
});

describe('eas.json', () => {
  it.each(['preview', 'production'] as const)('%s builds store-signed for TestFlight', (name) => {
    const profile = easJson.build[name];
    expect(profile.extends).toBe('base');
    expect(profile.distribution).toBe('store');
    // TestFlight rejects a build number it has already seen.
    expect(profile.autoIncrement).toBe(true);
  });

  it('keeps build numbers on EAS, not in app.json', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
  });

  it('builds with a Node version the QVAC bundler accepts', () => {
    const [major, minor] = easJson.build.base.node.split('.').map(Number);
    const ok = (major === 22 && (minor ?? 0) >= 21) || (major === 24 && (minor ?? 0) >= 9) || (major ?? 0) > 24;
    expect(ok).toBe(true);
  });

  it('holds no credentials', () => {
    const text = JSON.stringify(easJson);
    expect(text).not.toMatch(/ascApiKey|appleId|password|\.p8|\.p12|serviceAccount/i);
  });
});
