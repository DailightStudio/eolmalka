import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initAppOpenAd, showAppOpenAd } from "@/lib/ad-manager";
import { registerBackgroundCheck } from "@/lib/background-check";
import { setupNotifications } from "@/lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    void setupNotifications();
    void registerBackgroundCheck();
    initAppOpenAd();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") showAppOpenAd();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b0f17" },
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0b0f17" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "얼말까" }} />
        <Stack.Screen name="c/[slug]" options={{ title: "" }} />
        <Stack.Screen
          name="add"
          options={{ presentation: "modal", title: "카테고리 추가" }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
