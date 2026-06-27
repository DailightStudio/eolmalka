// 테스트 광고 강제 스위치 (단일 출처).
// true면 모든 광고가 Google 테스트 광고(항상 노출)로 표시됨.
// 새 AdMob 앱은 no-fill이라 TestFlight/dev 빌드 검증 시 사용.
// EXPO_PUBLIC_USE_TEST_ADS=1 로 프로덕션 빌드에서도 강제 가능.
export const USE_TEST_ADS =
  __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === "1";
