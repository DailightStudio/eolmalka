import { Platform } from "react-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

// iOS ATT(App Tracking Transparency) 승인 여부.
// Firebase Analytics 등 추적 SDK의 데이터 수집 게이팅에 사용 — 응답 전까지는 보수적으로 false 유지.
let trackingAuthorized = false;

export function isTrackingAuthorized(): boolean {
  return trackingAuthorized;
}

// App Store §5.1.2: 추적 SDK(Firebase Analytics, AdMob)가 데이터를 수집하기 전에
// 반드시 먼저 호출해야 함. iOS에서만 시스템 프롬프트를 띄운다(Android/웹은 해당 없음 → 승인으로 간주).
export async function requestTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    trackingAuthorized = true;
    return trackingAuthorized;
  }
  try {
    const { granted } = await requestTrackingPermissionsAsync();
    trackingAuthorized = granted;
  } catch {
    trackingAuthorized = false;
  }
  return trackingAuthorized;
}
