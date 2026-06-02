import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerBackgroundCheck } from "@/lib/background-check";
import { setupNotifications } from "@/lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    void setupNotifications();
    void registerBackgroundCheck();
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
      </Stack>
    </SafeAreaProvider>
  );
}
