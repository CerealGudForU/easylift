// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Keep Metro's file watcher out of large generated or reference-only folders.
// The Android build tree (Gradle + CMake output) has tens of thousands of files and
// made Metro crawl for minutes and miss edits on Windows.
const ignored = ['android', 'ios', 'research', 'dist', '.wrangler'].map(
  (dir) => new RegExp(`^${path.join(__dirname, dir).replace(/[\\/]/g, '[\\\\/]').replace(/\./g, '\\.')}[\\\\/].*`),
);

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList].filter(Boolean)),
  ...ignored,
];

module.exports = config;
