const { withAppBuildGradle } = require("expo/config-plugins");

// host(서버 봇)가 `git rev-list --count HEAD`로 계산해 컨테이너에 넘긴
// VERSION_CODE 환경변수를 prebuild 단계에서 app/build.gradle 에 주입한다.
// env 가 없거나 형식이 틀리면 no-op (prebuild 기본값 versionCode 1 유지) →
// 로컬 prebuild / 다른 프로젝트에서 깨지지 않는다.
module.exports = function withAndroidVersionCode(config) {
  const raw = process.env.VERSION_CODE;
  if (!raw || !/^\d+$/.test(raw)) {
    return config;
  }
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = config.modResults.contents.replace(
        /versionCode\s+\d+/,
        `versionCode ${raw}`
      );
    }
    return config;
  });
};
