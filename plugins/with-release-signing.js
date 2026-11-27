// Signs release builds with the EasyLift release key when it is provided through
// environment variables (GitHub Actions secrets, or a local shell for a test build):
//   EASYLIFT_KEYSTORE           path to the .jks file
//   EASYLIFT_KEYSTORE_PASSWORD  store password
//   EASYLIFT_KEY_ALIAS          key alias
//   EASYLIFT_KEY_PASSWORD       key password
// Nothing secret is written into the generated project: build.gradle reads the variables
// when Gradle runs. Without EASYLIFT_KEYSTORE, release builds keep the debug key
// (fine for trying a release build locally, never published).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// easylift-release-signing';

const SIGNING = `
        release { ${MARK}
            if (System.getenv('EASYLIFT_KEYSTORE')) {
                storeFile file(System.getenv('EASYLIFT_KEYSTORE'))
                storePassword System.getenv('EASYLIFT_KEYSTORE_PASSWORD')
                keyAlias System.getenv('EASYLIFT_KEY_ALIAS')
                keyPassword System.getenv('EASYLIFT_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    // 1. Add a "release" signing config next to the template's "debug" one.
    const signingStart = src.indexOf('signingConfigs {');
    if (signingStart < 0) throw new Error('[with-release-signing] signingConfigs block not found');
    const insertAt = signingStart + 'signingConfigs {'.length;
    src = src.slice(0, insertAt) + SIGNING + src.slice(insertAt);

    // 2. Point the release build type at it when the key is available.
    const releaseType = src.indexOf('release {', src.indexOf('buildTypes {'));
    const line = src.indexOf('signingConfig signingConfigs.debug', releaseType);
    if (releaseType < 0 || line < 0) throw new Error('[with-release-signing] release buildType not found');
    src =
      src.slice(0, line) +
      "signingConfig System.getenv('EASYLIFT_KEYSTORE') ? signingConfigs.release : signingConfigs.debug" +
      src.slice(line + 'signingConfig signingConfigs.debug'.length);

    cfg.modResults.contents = src;
    return cfg;
  });
};
