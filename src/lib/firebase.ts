import { Platform } from "react-native";
import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";
import { isTrackingAuthorized } from "@/lib/tracking";

export async function initFirebase() {
  if (Platform.OS === "web") return; // RNFirebase 웹 미지원 → no-op (웹 프리뷰 크래시 방지)
  if (__DEV__) {
    await analytics().setAnalyticsCollectionEnabled(false);
    await crashlytics().setCrashlyticsCollectionEnabled(false);
    return;
  }
  // iOS는 ATT 승인 시에만 분석 데이터 수집(App Store §5.1.2). Crashlytics는 광고 추적이 아니므로 항상 활성화.
  const analyticsAllowed = Platform.OS !== "ios" || isTrackingAuthorized();
  await analytics().setAnalyticsCollectionEnabled(analyticsAllowed);
  await crashlytics().setCrashlyticsCollectionEnabled(true);
}

export async function logScreen(screenName: string) {
  if (!__DEV__) {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  }
}

export async function logEvent(
  name: string,
  params?: Record<string, string | number>,
) {
  if (!__DEV__) {
    await analytics().logEvent(name, params);
  }
}
