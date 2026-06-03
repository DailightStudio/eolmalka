import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initAppOpenAd, preloadInterstitial, showAppOpenAd } from "@/lib/ad-manager";
import { registerBackgroundCheck } from "@/lib/background-check";
import { initFirebase } from "@/lib/firebase";
import { setupNotifications } from "@/lib/notifications";
import { registerPushToken } from "@/lib/push-registration";
import { maybeRequestReview } from "@/lib/review";
import { loadOnboardingDone } from "@/lib/storage";

async function setupAds() {
  if (Platform.OS === "web") return;
  try {
    // GDPR 동의 (EU/EEA 사용자에게만 폼 표시, 그 외 자동 통과)
    const { AdsConsent } = await import("react-native-google-mobile-ads");
    await AdsConsent.requestInfoUpdate();
    await AdsConsent.loadAndShowConsentFormIfRequired();
  } catch {}
  try {
    // AdMob SDK 초기화 — 반드시 광고 요청 전에 호출
    const MobileAds = (await import("react-native-google-mobile-ads")).default;
    await MobileAds().initialize();
  } catch {}
  // 전면 광고 미리 로드 (앱 시작 직후 노출 금지 → 상세 화면 퇴장 시 노출)
  preloadInterstitial();
  initAppOpenAd();
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const done = await loadOnboardingDone();
      if (!done) router.replace("/onboarding");
    })();
    void initFirebase();
    // 알림 채널/권한 셋업 후 서버 푸시 토큰 등록 (이미 허용된 경우에만 등록됨)
    void setupNotifications().finally(() => {
      void registerPushToken();
    });
    void registerBackgroundCheck();
    void setupAds();
    void maybeRequestReview();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") showAppOpenAd();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b0f17" },
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0b0f17" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "얼말까" }} />
        <Stack.Screen name="c/[slug]" options={{ title: "" }} />
        <Stack.Screen
          name="add"
          options={{ presentation: "modal", title: "카테고리 추가" }}
        />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ title: "개인정보처리방침" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
