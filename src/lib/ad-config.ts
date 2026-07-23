import { isTrackingAuthorized } from "@/lib/tracking";

// 테스트 광고 강제 스위치 (단일 출처).
// true면 모든 광고가 Google 테스트 광고(항상 노출)로 표시됨.
// 새 AdMob 앱은 no-fill이라 TestFlight/dev 빌드 검증 시 사용.
// EXPO_PUBLIC_USE_TEST_ADS=1 로 프로덕션 빌드에서도 강제 가능.
export const USE_TEST_ADS =
  __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === "1";

// 모든 광고 요청의 개인화 여부 — 단일 출처.
// ATT 를 승인한 사용자에게만 맞춤 광고를 요청한다. 미승인·미응답이면 비개인화.
// isTrackingAuthorized() 는 응답 전까지 false 이므로 기본값이 보수적이다.
// (_layout.tsx 에서 requestTrackingPermission() 이 광고 초기화보다 먼저 await 된다)
export function adRequestOptions(): { requestNonPersonalizedAdsOnly: boolean } {
  return { requestNonPersonalizedAdsOnly: !isTrackingAuthorized() };
}
