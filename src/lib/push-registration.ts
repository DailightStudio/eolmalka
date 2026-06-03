import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getDeviceId } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// Expo Push API에 토큰 발급 시 필요한 식별자.
// SDK 49+ 는 projectId 권장 (app.json extra.eas.projectId 자동 주입).
const PROJECT_ID: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId;
// experienceId 는 SDK 54 타입엔 없지만 legacy 폴백용으로 런타임 전달 (projectId 없을 때만).
const EXPERIENCE_ID = "@jaylabs/eolmalka";
const PUSH_TOKEN_OPTIONS: Notifications.ExpoPushTokenOptions = PROJECT_ID
  ? { projectId: PROJECT_ID }
  : ({ experienceId: EXPERIENCE_ID } as Notifications.ExpoPushTokenOptions);

// Expo Push Token을 받아 Supabase push_tokens 에 등록.
// 앱 시작 시 호출 — 실패해도 절대 throw 하지 않음 (시작 블록 방지).
export async function registerPushToken(): Promise<void> {
  // 웹/시뮬레이터에서는 푸시 토큰 발급 불가 → 조용히 패스
  if (Platform.OS === "web") return;
  try {
    // 권한 없으면 토큰 발급 안 됨. 권한 요청은 별도 사용자 제스처에서 처리하므로
    // 여기선 이미 허용된 경우에만 토큰을 등록한다.
    const settings = await Notifications.getPermissionsAsync();
    const allowed =
      settings.granted ||
      settings.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!allowed) return;

    const tokenResp =
      await Notifications.getExpoPushTokenAsync(PUSH_TOKEN_OPTIONS);
    const expoPushToken = tokenResp.data;
    if (!expoPushToken) return;

    const deviceId = await getDeviceId();
    await supabase
      .from("push_tokens")
      .upsert(
        { device_id: deviceId, expo_push_token: expoPushToken },
        { onConflict: "device_id" },
      );
  } catch (e) {
    console.warn("[push] registerPushToken failed", e);
  }
}

// 목표가를 Supabase price_alerts 에 동기화.
// targetPrice === null → 기존 알림 비활성(active=false).
// 숫자 → upsert (below 방향). 실패해도 throw 하지 않음.
export async function syncAlertToServer(
  slug: string,
  targetPrice: number | null,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const deviceId = await getDeviceId();
    if (targetPrice === null) {
      await supabase
        .from("price_alerts")
        .update({ active: false })
        .eq("device_id", deviceId)
        .eq("slug", slug);
      return;
    }
    await supabase.from("price_alerts").upsert(
      {
        device_id: deviceId,
        slug,
        target_price: targetPrice,
        direction: "below",
        active: true,
      },
      { onConflict: "device_id,slug" },
    );
  } catch (e) {
    console.warn("[push] syncAlertToServer failed", e);
  }
}
