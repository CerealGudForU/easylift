// Points Gradle at a newer CMake whose bundled ninja (1.12+) supports Windows
// long paths. The default CMake 3.22.1 ships ninja 1.10, which fails on React
// Native's deeply nested codegen paths ("Filename longer than 260 characters").
// Only applied on Windows; Linux/macOS (incl. GitHub Actions) use the default.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CMAKE_VERSION = '3.31.6';

module.exports = function withAndroidCmake(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      if (process.platform !== 'win32') return cfg;
      const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (!sdk) return cfg;
      const cmakeDir = path.join(sdk, 'cmake', CMAKE_VERSION);
      if (!fs.existsSync(cmakeDir)) {
        console.warn(`[with-android-cmake] ${cmakeDir} not found; run: sdkmanager "cmake;${CMAKE_VERSION}"`);
        return cfg;
      }
      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const lines = fs.existsSync(file)
        ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !/^(cmake|sdk)\.dir=/.test(l))
        : [];
      // sdk.dir too, so Gradle finds the SDK even from shells without ANDROID_HOME.
      lines.push(`sdk.dir=${sdk.replace(/\\/g, '/')}`);
      lines.push(`cmake.dir=${cmakeDir.replace(/\\/g, '/')}`);
      fs.writeFileSync(file, lines.join('\n') + '\n');
      return cfg;
    },
  ]);
};
