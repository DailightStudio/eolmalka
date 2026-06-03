import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";

export async function initFirebase() {
  if (__DEV__) {
    await analytics().setAnalyticsCollectionEnabled(false);
    await crashlytics().setCrashlyticsCollectionEnabled(false);
    return;
  }
  await analytics().setAnalyticsCollectionEnabled(true);
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
