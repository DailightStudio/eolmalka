import { Platform } from "react-native";
import {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

const interstitialUnitId =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || TestIds.INTERSTITIAL
    : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || TestIds.INTERSTITIAL;

const rewardedUnitId =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || TestIds.REWARDED
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || TestIds.REWARDED;

// 세션당 1회 추적
let interstitialShown = false;

// 전면 광고: 세션당 1회만 노출. 이미 노출됐으면 무시.
export function showInterstitialOnce(): void {
  if (interstitialShown || Platform.OS === "web") return;
  interstitialShown = true;

  const ad = InterstitialAd.createForAdRequest(interstitialUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    unsubLoaded();
    ad.show().catch(() => {});
  });

  const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
    unsubError();
    // 로드 실패 시 다음 세션에서 다시 시도하도록 플래그 복원
    interstitialShown = false;
  });

  ad.load();
}

// 보상형 광고: 시청 완료 시 true, 닫힘/실패 시 false 반환.
export function showRewardedAd(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(true);

  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(rewardedUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => settle(true));
    ad.addAdEventListener(AdEventType.CLOSED, () => settle(false));
    ad.addAdEventListener(AdEventType.ERROR, () => settle(false));

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      unsubLoaded();
      ad.show().catch(() => settle(false));
    });

    ad.load();
  });
}
