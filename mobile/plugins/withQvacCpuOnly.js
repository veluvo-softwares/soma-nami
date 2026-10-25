// Expo config plugin: run QVAC (ggml) on the CPU only, on iOS.
//
// Why: QVAC's iOS build (@qvac/fabric-ios 0.22.0, and 0.23.1 too) ships the
// ggml Metal shaders as source and compiles all 21 shader libraries in
// parallel (newLibraryWithSource) the first time ggml sets up the Metal
// device, on every app launch. There is no code path that loads a
// precompiled .metallib. On the iPhone 12 Apple's MTLCompilerService grows to
// ~500 MB against its 100 MB limit and iOS kills it, four times in a row,
// then Metal gives up for the session and everything runs on the CPU anyway
// (C4a, 25-26 Oct). The failed compiles only cost memory and CPU, so this
// tells ggml there are no Metal devices (GGML_METAL_DEVICES=0, read once by
// ggml_backend_metal_reg) before React Native or the QVAC worker start.
//
// Remove this plugin from app.json once QVAC can load a precompiled
// metallib (draft upstream issue: docs/qvac-metal-issue.md).
const { withAppDelegate } = require('expo/config-plugins');

const MARKER = '// soma-nami: QVAC on CPU only';
const LINE = `${MARKER} (plugins/withQvacCpuOnly.js)\n    setenv("GGML_METAL_DEVICES", "0", 1)\n`;

function addCpuOnlyEnv(appDelegate) {
  if (appDelegate.includes(MARKER)) return appDelegate;
  const launch = appDelegate.match(/didFinishLaunchingWithOptions[^{]*\{\n/);
  if (!launch) {
    throw new Error('withQvacCpuOnly: no didFinishLaunchingWithOptions in AppDelegate.swift');
  }
  const at = launch.index + launch[0].length;
  return `${appDelegate.slice(0, at)}    ${LINE}${appDelegate.slice(at)}`;
}

function withQvacCpuOnly(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(`withQvacCpuOnly: expected a Swift AppDelegate, got ${cfg.modResults.language}`);
    }
    cfg.modResults.contents = addCpuOnlyEnv(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withQvacCpuOnly;
module.exports.addCpuOnlyEnv = addCpuOnlyEnv;
