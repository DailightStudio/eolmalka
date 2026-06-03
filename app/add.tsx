import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { ADDABLE_CURRENCIES, ADDABLE_FLIGHTS } from "@/lib/signals";
import {
  addUserCategory,
  loadUserCategories,
  removeUserCategory,
} from "@/lib/storage";

type Tab = "currency" | "flight";

export default function AddCategoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("currency");

  useEffect(() => {
    void (async () => setUser(await loadUserCategories()))();
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (user.includes(id)) {
        const next = await removeUserCategory(id);
        setUser(next);
      } else {
        const next = await addUserCategory(id);
        setUser(next);
      }
    },
    [user],
  );

  const currencySelected = ADDABLE_CURRENCIES.filter((c) => user.includes(c.code)).length;
  const flightSelected = ADDABLE_FLIGHTS.filter((f) => user.includes(f.slug)).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: "카테고리 추가",
          presentation: "modal",
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.done}>완료</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        {/* 탭 바 */}
        <View style={styles.tabBar}>
          {([
            { key: "currency", label: "통화", count: currencySelected },
            { key: "flight",   label: "항공권", count: flightSelected },
          ] as { key: Tab; label: string; count: number }[]).map(({ key, label, count }) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {label}
                {count > 0 ? ` ${count}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {tab === "currency" &&
            ADDABLE_CURRENCIES.map((item) => {
              const active = user.includes(item.code);
              return (
                <Pressable
                  key={item.code}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => toggle(item.code)}
                >
                  <Text style={styles.emoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.korean}</Text>
                    <Text style={styles.sub}>{item.code}/KRW</Text>
                  </View>
                  <View style={[styles.check, active && styles.checkActive]}>
                    {active && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}

          {tab === "flight" &&
            ADDABLE_FLIGHTS.map((item) => {
              const active = user.includes(item.slug);
              return (
                <Pressable
                  key={item.slug}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => toggle(item.slug)}
                >
                  <Text style={styles.emoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.korean}</Text>
                    <Text style={styles.sub}>{item.destination} 왕복</Text>
                  </View>
                  <View style={[styles.check, active && styles.checkActive]}>
                    {active && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#a3e635",
  },
  tabText: { color: "#71717a", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#a3e635" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#18181b",
  },
  rowActive: { borderColor: "#a3e635", backgroundColor: "rgba(132,204,22,0.08)" },
  emoji: { fontSize: 22 },
  name: { color: "#fafafa", fontSize: 15, fontWeight: "600" },
  sub: { color: "#71717a", fontSize: 11, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: {
    borderColor: "#a3e635",
    backgroundColor: "#a3e635",
  },
  checkMark: { color: "#0b0f17", fontSize: 14, fontWeight: "800" },
  done: { color: "#a3e635", fontSize: 15, fontWeight: "700", paddingHorizontal: 8 },
});
