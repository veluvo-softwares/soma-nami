// Expo config plugin: don't collect or merge native debug symbols for Android
// release builds. QVAC's native libraries are large, and merging their debug
// metadata (`:app:mergeReleaseNativeDebugMetadata`) ran Gradle out of heap in
// CI. A tester APK doesn't need the symbols; a Play Store build would revisit
// this.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// soma-nami: no native debug symbols';

// Disables the merge task if AGP registers it at all (it does when a library
// or property asks for symbols), and is a no-op otherwise, unlike `-x`.
const DISABLE_MERGE_TASK = `
${MARKER} (merge task)
tasks.configureEach { task ->
    if (task.name == 'mergeReleaseNativeDebugMetadata') {
        task.enabled = false
    }
}
`;

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
  return gradle.slice(0, at) + block + gradle.slice(at) + DISABLE_MERGE_TASK;
}

function withNoNativeDebugSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addNoDebugSymbols(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withNoNativeDebugSymbols;
module.exports.addNoDebugSymbols = addNoDebugSymbols;
