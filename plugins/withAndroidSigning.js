const { withAppBuildGradle } = require("expo/config-plugins");

// host(서버 봇)가 .env 의 키스토어 비번/별칭을 컨테이너에 env 로 넘기고,
// Dockerfile ENTRYPOINT 가 credentials/eolmalka.keystore 를 android/app/ 로 복사한다.
// 이 플러그인은 prebuild 단계에서 app/build.gradle 의 release 빌드가
// 디버그 키가 아닌 release 키스토어로 서명되도록 signingConfig 를 주입한다.
//
// env(EOLMALKA_KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD) 가 없으면 no-op →
// 로컬 prebuild / 다른 프로젝트에서 깨지지 않는다(기존 동작 유지).
//
// 키스토어 파일명은 ENTRYPOINT 복사 대상과 동일해야 한다.
const KEYSTORE_FILE = "eolmalka.keystore";

module.exports = function withAndroidSigning(config) {
  const storePassword = process.env.EOLMALKA_KEYSTORE_PASSWORD;
  const keyAlias = process.env.EOLMALKA_KEY_ALIAS;
  const keyPassword = process.env.EOLMALKA_KEY_PASSWORD;

  if (!storePassword || !keyAlias || !keyPassword) {
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }

    let contents = config.modResults.contents;

    // 이미 주입됐으면(같은 plugin 재실행) 중복 삽입 방지
    if (contents.includes("signingConfigs.release")) {
      return config;
    }

    const releaseSigningConfig = [
      "        release {",
      `            storeFile file('${KEYSTORE_FILE}')`,
      `            storePassword '${storePassword}'`,
      `            keyAlias '${keyAlias}'`,
      `            keyPassword '${keyPassword}'`,
      "        }",
    ].join("\n");

    // 1) signingConfigs { ... } 블록 안의 debug { ... } 바로 뒤에 release { ... } 추가.
    //    Expo prebuild 가 생성하는 기본 build.gradle 은 항상 debug signingConfig 를 가진다.
    const debugBlockRe =
      /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\n)/;
    if (!debugBlockRe.test(contents)) {
      // 예상 구조가 아니면 안전하게 no-op (디버그 서명으로 빌드되지만 빌드는 깨지지 않음)
      return config;
    }
    contents = contents.replace(
      debugBlockRe,
      `$1${releaseSigningConfig}\n`
    );

    // 2) buildTypes.release 가 signingConfigs.debug 를 쓰도록 되어있는 것을
    //    signingConfigs.release 로 교체.
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      "$1signingConfig signingConfigs.release"
    );

    config.modResults.contents = contents;
    return config;
  });
};
