// Expo config plugin: don't collect native debug symbols for Android release
// builds. QVAC's native libraries are large, and merging their debug metadata
// (`:app:mergeReleaseNativeDebugMetadata`) ran Gradle out of heap in CI. A
// tester APK doesn't need the symbols; a Play Store build would revisit this.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// soma-nami: no native debug symbols';

function addNoDebugSymbols(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const buildTypes = gradle.indexOf('buildTypes {');
  const release = buildTypes === -1 ? -1 : gradle.indexOf('release {', buildTypes);
  if (release === -1) {
    throw new Error(
      'withNoNativeDebugSymbols: no buildTypes { release { } } block in android/app/build.gradle',
    );
  }
  const at = release + 'release {'.length;
  const block = `\n            ${MARKER}\n            ndk { debugSymbolLevel 'none' }`;
  return gradle.slice(0, at) + block + gradle.slice(at);
}

function withNoNativeDebugSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addNoDebugSymbols(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withNoNativeDebugSymbols;
module.exports.addNoDebugSymbols = addNoDebugSymbols;
