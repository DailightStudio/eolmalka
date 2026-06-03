import { ImageSourcePropType } from "react-native";

// 카테고리별 PNG 픽토그램. fx-* 계열은 동일 아이콘.
const ICON_MAP: Record<string, ImageSourcePropType> = {
  fx: require("../../assets/icons/icon-fx.png"),
  gas: require("../../assets/icons/icon-gas.png"),
  gold: require("../../assets/icons/icon-gold.png"),
  air: require("../../assets/icons/icon-air.png"),
};

export function iconSourceFor(slug: string): ImageSourcePropType | undefined {
  if (slug.startsWith("fx-")) return ICON_MAP.fx;
  if (slug.startsWith("gas-")) return ICON_MAP.gas;
  if (slug.startsWith("gold-")) return ICON_MAP.gold;
  if (slug.startsWith("air-")) return ICON_MAP.air;
  return undefined;
}
