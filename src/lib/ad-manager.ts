import { Platform } from "react-native";
import {
  AdEventType,
  AppOpenAd,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { adRequestOptions, USE_TEST_ADS } from "@/lib/ad-config";

const interstitialUnitId = USE_TEST_ADS
  ? TestIds.INTERSTITIAL
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || TestIds.INTERSTITIAL
    : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || TestIds.INTERSTITIAL;

const rewardedUnitId = USE_TEST_ADS
  ? TestIds.REWARDED
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || TestIds.REWARDED
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || TestIds.REWARDED;

const appOpenUnitId = USE_TEST_ADS
  ? TestIds.APP_OPEN
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_APPOPEN_ANDROID || TestIds.APP_OPEN
    : process.env.EXPO_PUBLIC_ADMOB_APPOPEN_IOS || TestIds.APP_OPEN;

// ── 전면 광고 ──────────────────────────────────────────────────────────────
// 앱 시작 시 preload, 자연스러운 전환점(상세 → 메인 복귀)에서 show.
// AdMob 정책: 앱 시작 직후 즉시 노출 금지.
let interstitialAd: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialShown = false;

export function preloadInterstitial(): void {
  if (Platform.OS === "web") return;

  interstitialAd = InterstitialAd.createForAdRequest(
    interstitialUnitId,
    adRequestOptions()
  );

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialAd = null;
  });

  interstitialAd.load();
}

// 상세 화면에서 복귀 시 호출 — 세션당 1회만 노출.
export function showInterstitialOnce(): void {
  if (interstitialShown || Platform.OS === "web") return;
  if (!interstitialAd || !interstitialLoaded) return;

  interstitialShown = true;
  interstitialAd.show().catch(() => {
    interstitialShown = false;
  });
}

// ── 보상형 광고 ────────────────────────────────────────────────────────────
// 시청 완료 시 true, 닫힘/실패 시 false 반환.
export function showRewardedAd(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(true);

  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(rewardedUnitId, adRequestOptions());

    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => settle(true));
    ad.addAdEventListener(AdEventType.CLOSED, () => settle(false));
    // 광고 미게재(no-fill) 시 기능을 막지 않음 — 광고 가용성에 핵심 기능을 종속시키지 않음
    ad.addAdEventListener(AdEventType.ERROR, () => settle(true));

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      unsubLoaded();
      ad.show().catch(() => settle(false));
    });

    ad.load();
  });
}

// ── 앱오프닝 광고 ──────────────────────────────────────────────────────────
let appOpenAd: AppOpenAd | null = null;
let appOpenLastShownAt = 0;
const APP_OPEN_INTERVAL = 4 * 60 * 60 * 1000; // 4시간

export function initAppOpenAd(): void {
  if (Platform.OS === "web") return;
  loadAppOpenAd();
}

function loadAppOpenAd(): void {
  appOpenAd = AppOpenAd.createForAdRequest(appOpenUnitId, adRequestOptions());
  appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
    appOpenAd = null;
  });
  appOpenAd.load();
}

export function showAppOpenAd(): void {
  if (Platform.OS === "web" || !appOpenAd) return;
  const now = Date.now();
  if (now - appOpenLastShownAt < APP_OPEN_INTERVAL) return;

  appOpenAd
    .show()
    .then(() => {
      appOpenLastShownAt = now;
      loadAppOpenAd();
    })
    .catch(() => {
      loadAppOpenAd();
    });
}
