// eslint-disable-next-line @typescript-eslint/no-require-imports
const { raisePodDeploymentTargets, disableScriptSandboxing } = require('../../plugins/withIosBuildFixes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addCpuOnlyEnv } = require('../../plugins/withQvacCpuOnly');

// The end of the Podfile that `expo prebuild` writes for SDK 54.
const PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'SomaNami' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

// The start of the AppDelegate.swift that `expo prebuild` writes for SDK 54.
const APP_DELEGATE = `@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('withIosBuildFixes: pod deployment targets', () => {
  it('raises pod targets inside the existing post_install hook, before React Native runs', () => {
    const out: string = raisePodDeploymentTargets(PODFILE);
    const hook = out.indexOf('post_install do |installer|');
    const raise = out.indexOf("build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = soma_min.to_s");
    const rn = out.indexOf('react_native_post_install(');
    expect(hook).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(hook);
    expect(raise).toBeLessThan(rn);
    // CocoaPods allows one post_install hook only.
    expect(out.match(/post_install do/g)).toHaveLength(1);
  });

  it('uses the app deployment target from Podfile.properties.json, and only raises targets set below it', () => {
    const out: string = raisePodDeploymentTargets(PODFILE);
    expect(out).toContain("Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')");
    expect(out).toContain('next if Gem::Version.new(current) >= soma_min');
    // Resource-bundle targets (SDWebImage-SDWebImage) live in the Pods project's targets.
    expect(out).toContain('project.targets.each do |target|');
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = raisePodDeploymentTargets(PODFILE);
    expect(raisePodDeploymentTargets(once)).toBe(once);
  });

  it('fails loudly if the Expo template changes shape', () => {
    expect(() => raisePodDeploymentTargets("target 'SomaNami' do\nend\n")).toThrow(/no `post_install/);
  });
});

describe('withIosBuildFixes: script sandboxing', () => {
  it('sets ENABLE_USER_SCRIPT_SANDBOXING = NO on every build configuration, whatever it was', () => {
    const configs: Record<string, unknown> = {
      A: { buildSettings: { PRODUCT_NAME: 'SomaNami' } },
      A_comment: 'Debug',
      B: { buildSettings: { ENABLE_USER_SCRIPT_SANDBOXING: 'YES' } },
      B_comment: 'Release',
    };
    disableScriptSandboxing({ pbxXCBuildConfigurationSection: () => configs });
    expect(configs.A).toEqual({ buildSettings: { PRODUCT_NAME: 'SomaNami', ENABLE_USER_SCRIPT_SANDBOXING: 'NO' } });
    expect(configs.B).toEqual({ buildSettings: { ENABLE_USER_SCRIPT_SANDBOXING: 'NO' } });
    expect(configs.A_comment).toBe('Debug');
  });
});

describe('withQvacCpuOnly', () => {
  it('both iOS plugins are wired into app.json', () => {
    const plugins: unknown[] = require('../../app.json').expo.plugins;
    expect(plugins).toEqual(expect.arrayContaining(['./plugins/withIosBuildFixes', './plugins/withQvacCpuOnly']));
  });

  it('sets GGML_METAL_DEVICES=0 first thing at launch, before React Native starts', () => {
    const out: string = addCpuOnlyEnv(APP_DELEGATE);
    const env = out.indexOf('setenv("GGML_METAL_DEVICES", "0", 1)');
    expect(env).toBeGreaterThan(out.indexOf(') -> Bool {'));
    expect(env).toBeLessThan(out.indexOf('let delegate = ReactNativeDelegate()'));
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = addCpuOnlyEnv(APP_DELEGATE);
    expect(addCpuOnlyEnv(once)).toBe(once);
  });

  it('fails loudly if the AppDelegate changes shape', () => {
    expect(() => addCpuOnlyEnv('class AppDelegate {}')).toThrow(/didFinishLaunchingWithOptions/);
  });
});
