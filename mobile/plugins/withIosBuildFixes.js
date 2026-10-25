// Expo config plugin: two iOS build fixes for Xcode 27, kept across
// `expo prebuild --clean`.
//
// 1. Pod deployment targets. Xcode 27 builds iOS 15.0 and up only. CocoaPods
//    gives a pod's resource-bundle target the pod's own minimum (SDWebImage
//    says iOS 9.0), and React Native's post_install only raises the pods'
//    main targets, so SDWebImage-SDWebImage failed with "IPHONEOS_DEPLOYMENT_TARGET
//    is set to 9.0". In post_install, every pod target and build configuration
//    set below the app's deployment target (ios.deploymentTarget from
//    expo-build-properties, 17.0) is raised to it.
// 2. Script sandboxing. With ENABLE_USER_SCRIPT_SANDBOXING = YES the "Bundle
//    React Native code and images" phase fails (Sandbox: deny file-write-data
//    .../SomaNami.app/ip.txt). Prebuild doesn't set it, so the value falls to
//    Xcode's default or to the "Update to recommended settings" prompt. It's
//    set to NO explicitly on every app build configuration.
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# soma-nami: raise pod deployment targets';

const RAISE_TARGETS = `
    ${MARKER} (plugins/withIosBuildFixes.js)
    soma_min = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    soma_projects = installer.respond_to?(:generated_projects) ? installer.generated_projects : []
    soma_projects = [installer.pods_project] if soma_projects.empty?
    soma_projects.each do |project|
      project.targets.each do |target|
        target.build_configurations.each do |build_config|
          current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          next unless current.to_s =~ /\\A\\d+(\\.\\d+)*\\z/
          next if Gem::Version.new(current) >= soma_min
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = soma_min.to_s
        end
      end
    end
`;

function raisePodDeploymentTargets(podfile) {
  if (podfile.includes(MARKER)) return podfile;
  const hook = podfile.match(/^\s*post_install do \|installer\|\s*$/m);
  if (!hook) {
    throw new Error('withIosBuildFixes: no `post_install do |installer|` block in ios/Podfile');
  }
  const at = hook.index + hook[0].length;
  return podfile.slice(0, at) + RAISE_TARGETS + podfile.slice(at);
}

/** Sets ENABLE_USER_SCRIPT_SANDBOXING = NO on every build configuration. */
function disableScriptSandboxing(project) {
  const configs = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configs)) {
    const config = configs[key];
    if (typeof config !== 'object' || !config.buildSettings) continue;
    config.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
  }
  return project;
}

function withIosBuildFixes(config) {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      fs.writeFileSync(file, raisePodDeploymentTargets(fs.readFileSync(file, 'utf8')));
      return cfg;
    },
  ]);
  return withXcodeProject(config, (cfg) => {
    disableScriptSandboxing(cfg.modResults);
    return cfg;
  });
}

module.exports = withIosBuildFixes;
module.exports.raisePodDeploymentTargets = raisePodDeploymentTargets;
module.exports.disableScriptSandboxing = disableScriptSandboxing;
