import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { ADDABLE_CURRENCIES } from "@/lib/signals";
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

  const toggle = useCallback(async (code: string) => {
    if (user.includes(code)) {
      const next = await removeUserCategory(code);
      setUser(next);
    } else {
      const next = await addUserCategory(code);
      setUser(next);
    }
  }, [user]);

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
        <Text style={styles.note}>
          관심 있는 통화를 선택하세요. 다시 누르면 해제.
          {"\n"}데이터는 Frankfurter(ECB)에서 실시간 환율.
        </Text>
        <FlatList
          data={ADDABLE_CURRENCIES}
          keyExtractor={(c) => c.code}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const active = user.includes(item.code);
            return (
              <Pressable
                style={[styles.row, active && styles.rowActive]}
                onPress={() => toggle(item.code)}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.korean}</Text>
                  <Text style={styles.sub}>{item.code}/KRW</Text>
                </View>
                <View
                  style={[styles.check, active && styles.checkActive]}
                >
                  {active && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17", padding: 16 },
  note: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
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
