// react-native-google-mobile-ads는 web 미지원.
// Metro가 web 번들에서 이 파일을 우선 사용 → 네이티브 모듈 import 회피.
export function preloadInterstitial(): void {}
export function showInterstitialOnce(): void {}
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(true);
}
export function initAppOpenAd(): void {}
export function showAppOpenAd(): void {}
