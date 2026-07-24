import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { adRequestOptions, USE_TEST_ADS, whenAdsReady } from "@/lib/ad-config";

const bannerUnitId = USE_TEST_ADS
  ? TestIds.ADAPTIVE_BANNER
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TestIds.ADAPTIVE_BANNER
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TestIds.ADAPTIVE_BANNER;

export function AdBanner() {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // SDK 초기화·ATT 응답 이후에 요청 (개인화 반영 + 첫 요청 실패율 감소)
    void whenAdsReady().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === "web" || failed || !ready) return null;

  return (
    <View style={{ marginVertical: 8, alignItems: "center" }}>
      <BannerAd
        key={reloadKey}
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={adRequestOptions()}
        onAdFailedToLoad={() => {
          // no-fill/일시 실패: 백오프로 최대 2회 재시도 후에만 숨김
          if (retries.current < 2) {
            retries.current += 1;
            setTimeout(() => setReloadKey((k) => k + 1), 5000 * retries.current);
          } else {
            setFailed(true);
          }
        }}
      />
    </View>
  );
}
