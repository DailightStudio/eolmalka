import { Platform, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

// 환경변수에 실제 배너 광고 단위 ID가 있으면 사용, 없으면 구글 테스트 ID.
// react-native-google-mobile-ads는 web 미지원 → web에선 null.
const bannerUnitId =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TestIds.ADAPTIVE_BANNER
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TestIds.ADAPTIVE_BANNER;

export function AdBanner() {
  if (Platform.OS === "web") return null;
  return (
    <View style={{ marginVertical: 8, alignItems: "center" }}>
      <BannerAd
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}
