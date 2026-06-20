const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// @react-native-firebase v24 는 iOS 에서 static framework(useFrameworks:"static")를
// 요구한다. 하지만 SDK 54 / RN 0.81 "prebuilt core" 환경에서는 static framework 만으론
// RNFB/Crashlytics 의 non-modular header import 가 모듈 경계를 넘으며 컴파일이 깨진다
// ('RCTBridgeModule' must be imported from module 'RNFBApp.RNFBAppModule' 등).
// 이 플러그인은 prebuild 단계에서 Podfile 의 post_install 블록에
// CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES 를 모든 pod 타깃에 주입해
// RNFB + RNScreens 등 SDK54 알려진 이슈를 한 번에 커버한다.
// 이미 주입돼 있으면(같은 plugin 재실행) no-op → 멱등.
const FLAG = "CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES";

// react-native-google-mobile-ads(AdMob)는 use_frameworks! :linkage => :static 환경에서
// Podfile 전역 $RNGoogleMobileAdsAsStaticFramework = true 가 있어야 한다.
// RNGoogleMobileAds.podspec 의 기본 static_framework=false 를 이 전역으로만 override 하며,
// 없으면 광고 모듈 링크가 실패해 빌드가 깨진다(공식 docs).
// pod 해석 전에 전역이 정의돼야 하므로 첫 target 블록보다 앞에 주입한다.
// (@react-native-firebase/app 플러그인이 $RNFirebaseAsStaticFramework 는 자동 처리하므로
//  RNFB 전역은 여기서 다루지 않는다.)
const RNGMA_GLOBAL = "$RNGoogleMobileAdsAsStaticFramework = true";

module.exports = function withIosNonModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfile = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfile, "utf-8");

      // 1) CLANG non-modular header 플래그를 post_install 에 주입 (RNFB/RNScreens 등 SDK54 이슈)
      if (!contents.includes(FLAG)) {
        const inject = [
          "",
          "    installer.pods_project.targets.each do |target|",
          "      target.build_configurations.each do |bc|",
          "        bc.build_settings['" + FLAG + "'] = 'YES'",
          "      end",
          "    end",
        ].join("\n");
        contents = contents.replace(
          /post_install do \|installer\|/,
          function (m) {
            return m + inject;
          }
        );
      }

      // 2) AdMob static framework 전역을 첫 target 블록보다 앞에 주입
      if (!contents.includes("$RNGoogleMobileAdsAsStaticFramework")) {
        const targetRe = /^(target ['"])/m;
        if (targetRe.test(contents)) {
          contents = contents.replace(
            targetRe,
            RNGMA_GLOBAL + "\n\n$1"
          );
        } else {
          // target 라인을 못 찾은 경우(Podfile 구조 변경 대비) 파일 맨 앞에 주입.
          // 조용한 매치 실패로 빌드가 깨지지 않도록 하는 fallback.
          contents = RNGMA_GLOBAL + "\n\n" + contents;
        }
      }

      fs.writeFileSync(podfile, contents);
      return config;
    },
  ]);
};
