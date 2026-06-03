import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// 알림 채널 — 목표가/통계/시스템 3종.
// Android: 채널 API로 강도·진동 분리. iOS: sound 키로 차별(기본/없음).
export type AlertKind = "target" | "signal" | "system";

const CHANNELS: Record<AlertKind, {
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
  vibrationPattern: number[];
  sound: string | undefined;
}> = {
  target: {
    id: "target-v1",
    name: "🎯 목표가 도달",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 150, 400],
    sound: "default",
  },
  signal: {
    id: "signal-v1",
    name: "📉 통계 신호",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    sound: "default",
  },
  system: {
    id: "system-v1",
    name: "🔧 시스템",
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 100],
    sound: undefined,
  },
};

// 알림이 포그라운드에 도달했을 때도 헤드업 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "android") {
    // 3개 채널 등록 — 사용자가 OS 설정에서 개별 ON/OFF 가능
    await Promise.all(
      Object.values(CHANNELS).map((c) =>
        Notifications.setNotificationChannelAsync(c.id, {
          name: c.name,
          importance: c.importance,
          vibrationPattern: c.vibrationPattern,
          lightColor: "#a3e635",
          sound: c.sound,
        }),
      ),
    );
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  // 권한 요청은 사용자 제스처(목표가 등록 등) 안에서 별도로 호출
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return status === "granted";
}

export async function scheduleLocalAlert(args: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  kind?: AlertKind; // 기본 'target'
}): Promise<void> {
  const kind = args.kind ?? "target";
  const ch = CHANNELS[kind];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      data: { ...(args.data ?? {}), kind },
      sound: ch.sound,
      ...(Platform.OS === "android" ? { channelId: ch.id } : {}),
    },
    trigger: null, // 즉시 발송
  });
}
