const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withDisableCodeSigning(config) {
  // 1. 修改主项目的 Xcode 配置，彻底抹除签名要求
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      const configObj = buildConfigurations[key];
      // 遍历所有 Build Settings
      if (typeof configObj === 'object' && configObj.buildSettings) {
        configObj.buildSettings['CODE_SIGNING_ALLOWED'] = '"NO"';
        configObj.buildSettings['CODE_SIGNING_REQUIRED'] = '"NO"';
        configObj.buildSettings['CODE_SIGNING_IDENTITY'] = '""';
        configObj.buildSettings['EXPANDED_CODE_SIGN_IDENTITY'] = '""';
        configObj.buildSettings['EXPANDED_CODE_SIGN_IDENTITY_NAME'] = '""';
        configObj.buildSettings['DEVELOPMENT_TEAM'] = '""';
      }
    }
    return config;
  });

  // 2. 修改底层 CocoaPods 的配置，抹除所有子依赖的签名要求
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, 'utf8');
      
      const snippet = `
  # --- INJECTED BY EXPO PLUGIN FOR UNSIGNED BUILD ---
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      if target.name == 'RCTSwiftUI'
        # RCTSwiftUI 是纯 Swift 模块。如果禁掉 CODE_SIGNING_ALLOWED，
        # Xcode 就不会为它生成 RCTSwiftUI.modulemap，导致 Wrapper 层报找不到文件。
        # 解法：对它只关闭"要求"签名，但保留"允许"签名，这样 modulemap 正常输出。
        # 同时不开 BUILD_LIBRARY_FOR_DISTRIBUTION，避免触发 SwiftVerifyEmittedModuleInterface。
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
        config.build_settings['CODE_SIGNING_IDENTITY'] = ''
        config.build_settings['DEVELOPMENT_TEAM'] = ''
      else
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
        config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
        config.build_settings['EXPANDED_CODE_SIGN_IDENTITY_NAME'] = ''
        config.build_settings['DEVELOPMENT_TEAM'] = ''
      end
    end
  end
  # --------------------------------------------------
`;
      if (!contents.includes("CODE_SIGNING_ALLOWED")) {
         contents = contents.replace("post_install do |installer|", "post_install do |installer|" + snippet);
         fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
  
  return config;
};
