const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// react-native-fast-tflite ships .tflite model files that must be treated as
// binary assets (not source) so Metro bundles them instead of parsing them.
config.resolver.assetExts.push("tflite");

module.exports = config;
