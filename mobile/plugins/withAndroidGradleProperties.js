// Expo config plugin: Gradle properties for every Android build of the app,
// whether it runs on EAS Build, in CI or on a laptop.
//
// - reactNativeArchitectures=arm64-v8a: QVAC ships Android binaries for arm64
//   only, and Android 12+ arm64 is the only phone the app supports, so the
//   other ABIs would just bloat the APK.
// - org.gradle.jvmargs: R8 and the native merge steps for QVAC's large native
//   libraries ran out of heap with the template's 2 GB. EAS's Android worker
//   has 16 GB.
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  reactNativeArchitectures: 'arm64-v8a',
  'org.gradle.jvmargs': '-Xmx8g -XX:MaxMetaspaceSize=1g',
};

function setGradleProperties(items) {
  const rest = items.filter((item) => !(item.type === 'property' && item.key in PROPERTIES));
  const ours = Object.entries(PROPERTIES).map(([key, value]) => ({ type: 'property', key, value }));
  return [...rest, ...ours];
}

function withAndroidGradleProperties(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = setGradleProperties(cfg.modResults);
    return cfg;
  });
}

module.exports = withAndroidGradleProperties;
module.exports.setGradleProperties = setGradleProperties;
module.exports.PROPERTIES = PROPERTIES;
