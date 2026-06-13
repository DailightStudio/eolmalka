const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// metro-cache package exports subpath error workaround
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = config;
