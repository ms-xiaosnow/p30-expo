const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withDisableCodeSigning(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, 'utf8');
      
      const snippet = `
  # --- INJECTED BY EXPO PLUGIN FOR UNSIGNED BUILD ---
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
      config.build_settings['EXPANDED_CODE_SIGN_IDENTITY_NAME'] = ''
      config.build_settings['DEVELOPMENT_TEAM'] = ''
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
};
