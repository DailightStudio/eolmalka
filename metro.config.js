const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Web-only stub 해결 (선택사항 — android/ios에는 영향 없음)
if (config.resolver && config.resolver.resolveRequest) {
  const baseResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // android/ios 빌드에서는 web stub 무시
    if (platform !== "web" &&
        (moduleName === "react-native-google-mobile-ads" ||
         moduleName.startsWith("@react-native-firebase/"))) {
      // 실제 모듈 사용
      return baseResolveRequest(context, moduleName, platform);
    }
    return baseResolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
