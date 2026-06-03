import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const [query, setQuery] = useState("");

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

  // 검색 + 정렬: 추가된 것 위로, 그 다음 검색 매칭
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (c: typeof ADDABLE_CURRENCIES[number]) =>
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.korean.toLowerCase().includes(q);
    const result = ADDABLE_CURRENCIES.filter(matches);
    result.sort((a, b) => {
      const aOn = user.includes(a.code) ? 0 : 1;
      const bOn = user.includes(b.code) ? 0 : 1;
      return aOn - bOn;
    });
    return result;
  }, [query, user]);

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
        <View style={styles.headerRow}>
          <Text style={styles.note}>
            관심 통화 선택 (Frankfurter ECB 실시간)
          </Text>
          {user.length > 0 && (
            <Text style={styles.countTag}>{user.length}개 선택</Text>
          )}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="검색 (예: 유로, EUR)"
          placeholderTextColor="#52525b"
          autoCapitalize="characters"
          style={styles.search}
        />
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.code}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>일치하는 통화가 없습니다.</Text>
          }
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  note: {
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 18,
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
  search: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fafafa",
    fontSize: 14,
    marginBottom: 12,
  },
  empty: {
    color: "#52525b",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 24,
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
