import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { markAdsReady } from "@/lib/ad-config";
import { initAppOpenAd, preloadInterstitial, showAppOpenAd } from "@/lib/ad-manager";
import { registerBackgroundCheck } from "@/lib/background-check";
import { initFirebase } from "@/lib/firebase";
import { loadRemoteMacroEvents } from "@/lib/macro-events";
import { setupNotifications } from "@/lib/notifications";
import { registerPushToken } from "@/lib/push-registration";
import { maybeRequestReview } from "@/lib/review";
import { loadOnboardingDone } from "@/lib/storage";
import { requestTrackingPermission } from "@/lib/tracking";

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
  // 배너·네이티브가 이제 광고를 요청하도록 게이트 해제 (ATT 응답·SDK 초기화 이후 = 승인자 개인화 반영)
  markAdsReady();
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
    void (async () => {
      // ATT 프롬프트는 Firebase Analytics·AdMob 등 추적 SDK 초기화보다 반드시 먼저 떠야 함 (App Store §5.1.2)
      await requestTrackingPermission();
      await initFirebase();
      await setupAds();
    })();
    // 알림 채널/권한 셋업 후 서버 푸시 토큰 등록 (이미 허용된 경우에만 등록됨)
    void setupNotifications().finally(() => {
      void registerPushToken();
    });
    void registerBackgroundCheck();
    // 원격 거시 일정 로드 (시트 CSV) — 실패해도 하드코딩 폴백, 렌더 블로킹 X
    void loadRemoteMacroEvents().catch(() => {});
    void maybeRequestReview();

    // 앱오프닝 광고: 백그라운드→활성 복귀 때만 노출.
    // 권한 얼럿 dismiss(inactive→active)·콜드스타트 첫 active 오발 방지 (AdMob 정책·리젝 리스크).
    let prevState = AppState.currentState;
    const sub = AppState.addEventListener("change", (state) => {
      if (prevState === "background" && state === "active") showAppOpenAd();
      prevState = state;
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
