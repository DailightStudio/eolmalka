import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from "react-native-google-mobile-ads";

const unitId =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_NATIVE_ANDROID || TestIds.NATIVE
    : process.env.EXPO_PUBLIC_ADMOB_NATIVE_IOS || TestIds.NATIVE;

export function NativeAdCard() {
  const [ad, setAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let destroyed = false;
    NativeAd.createForAdRequest(unitId)
      .then((loaded) => {
        if (destroyed) {
          loaded.destroy();
          return;
        }
        setAd(loaded);
      })
      .catch(() => {});
    return () => {
      destroyed = true;
      setAd((prev) => {
        prev?.destroy();
        return null;
      });
    };
  }, []);

  if (!ad) return null;

  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.sponsoredBadge}>
        <Text style={styles.sponsoredText}>광고</Text>
      </View>
      <View style={styles.row}>
        {ad.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.textWrap}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={1}>
              {ad.headline}
            </Text>
          </NativeAsset>
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.body} numberOfLines={2}>
              {ad.body}
            </Text>
          </NativeAsset>
        </View>
      </View>
      {ad.mediaContent ? <NativeMediaView style={styles.media} /> : null}
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaText}>{ad.callToAction}</Text>
        </View>
      </NativeAsset>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#131920",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    overflow: "hidden",
  },
  sponsoredBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
  },
  sponsoredText: { color: "#6b7280", fontSize: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 8 },
  textWrap: { flex: 1 },
  headline: { color: "#e6eef8", fontSize: 14, fontWeight: "700", marginBottom: 3 },
  body: { color: "#9ca3af", fontSize: 12, lineHeight: 17 },
  media: { width: "100%", height: 150, borderRadius: 8, marginBottom: 10 },
  ctaBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(163,230,53,0.15)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ctaText: { color: "#a3e635", fontSize: 13, fontWeight: "700" },
});
