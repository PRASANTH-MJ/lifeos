const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a wa-sqlite WASM binary — Metro
// needs to treat .wasm as a resolvable asset for that import to work.
config.resolver.assetExts.push('wasm');

module.exports = config;
