import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#a3e635",
    });
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
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      sound: "default",
    },
    trigger: null, // 즉시 발송
  });
}
