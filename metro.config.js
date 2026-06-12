const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const googleMobileAdsStub = path.resolve(__dirname, "src/stubs/google-mobile-ads.web.js").replace(/\\/g, "/");
const reactNativeFirebaseStub = path.resolve(__dirname, "src/stubs/react-native-firebase.web.js").replace(/\\/g, "/");

const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (moduleName === "react-native-google-mobile-ads" || moduleName.startsWith("react-native-google-mobile-ads/")) {
      return { filePath: googleMobileAdsStub, type: "sourceFile" };
    }
    if (moduleName.startsWith("@react-native-firebase/")) {
      return { filePath: reactNativeFirebaseStub, type: "sourceFile" };
    }
  }
  return originalResolver ? originalResolver(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
