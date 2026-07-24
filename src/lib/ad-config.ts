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

// 광고 준비 완료 게이트 — 배너·네이티브가 SDK 초기화·ATT 응답 이후에 요청하도록.
// (마운트 즉시 요청하면 SDK 미초기화로 첫 요청 실패 + ATT 응답 前이라 승인자에게도 항상 비개인화됨)
let adsReady = false;
const readyWaiters: Array<() => void> = [];
export function markAdsReady(): void {
  if (adsReady) return;
  adsReady = true;
  readyWaiters.splice(0).forEach((fn) => fn());
}
// 준비되면 즉시, 아니면 timeoutMs 후 폴백 resolve — 광고가 부팅/렌더를 막지 않도록 무한대기 방지.
export function whenAdsReady(timeoutMs = 8000): Promise<void> {
  if (adsReady) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      resolve();
    };
    readyWaiters.push(fire);
    setTimeout(fire, timeoutMs);
  });
}
