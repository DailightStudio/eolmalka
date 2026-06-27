import { useState } from "react";
import { Platform, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { USE_TEST_ADS } from "@/lib/ad-config";

const bannerUnitId = USE_TEST_ADS
  ? TestIds.ADAPTIVE_BANNER
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TestIds.ADAPTIVE_BANNER
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TestIds.ADAPTIVE_BANNER;

export function AdBanner() {
  const [failed, setFailed] = useState(false);

  if (Platform.OS === "web" || failed) return null;

  return (
    <View style={{ marginVertical: 8, alignItems: "center" }}>
      <BannerAd
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
