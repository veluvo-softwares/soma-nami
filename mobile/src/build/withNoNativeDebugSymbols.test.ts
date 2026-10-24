// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addNoDebugSymbols } = require('../../plugins/withNoNativeDebugSymbols');

const GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;

describe('withNoNativeDebugSymbols', () => {
  it('turns off native debug symbols in the release build type only', () => {
    const out: string = addNoDebugSymbols(GRADLE);
    const release = out.slice(out.indexOf('release {'));
    const debug = out.slice(out.indexOf('buildTypes {'), out.indexOf('release {'));
    expect(release).toContain("ndk { debugSymbolLevel 'none' }");
    expect(debug).not.toContain('debugSymbolLevel');
  });

  it('disables the release debug-metadata merge task if it exists', () => {
    const out: string = addNoDebugSymbols(GRADLE);
    expect(out).toMatch(
      /task\.name == 'mergeReleaseNativeDebugMetadata'\)\s*\{\s*task\.enabled = false/,
    );
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = addNoDebugSymbols(GRADLE);
    expect(addNoDebugSymbols(once)).toBe(once);
  });

  it('fails loudly if the Expo template changes shape', () => {
    expect(() => addNoDebugSymbols('android { }')).toThrow(/no buildTypes/);
  });
});
