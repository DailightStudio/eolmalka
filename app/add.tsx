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

export default function AddCategoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<string[]>([]);

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

  const totalSelected =
    ADDABLE_CURRENCIES.filter((c) => user.includes(c.code)).length +
    ADDABLE_FLIGHTS.filter((f) => user.includes(f.slug)).length;

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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {totalSelected > 0 && (
          <View style={styles.countRow}>
            <Text style={styles.countTag}>{totalSelected}개 선택됨</Text>
          </View>
        )}

        {/* ─── 통화 섹션 ─── */}
        <Text style={styles.sectionHeader}>통화</Text>
        <Text style={styles.sectionNote}>Frankfurter (ECB) 실시간</Text>
        {ADDABLE_CURRENCIES.map((item) => {
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

        {/* ─── 항공권 섹션 ─── */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>항공권</Text>
        <Text style={styles.sectionNote}>Travelpayouts 이달 최저가 중앙값 (인천 출발)</Text>
        {ADDABLE_FLIGHTS.map((item) => {
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17", paddingHorizontal: 16 },
  countRow: {
    alignItems: "flex-end",
    paddingTop: 12,
    marginBottom: 4,
  },
  countTag: {
    color: "#a3e635",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(132,204,22,0.4)",
  },
  sectionHeader: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 2,
  },
  sectionNote: {
    color: "#52525b",
    fontSize: 11,
    marginBottom: 10,
  },
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
