import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { Sparkline } from "@/components/Sparkline";
import { getSeries, type Series } from "@/lib/demo-series";
import {
  SIGNAL_STYLE,
  allSlugs,
  computeStats,
  metaFor,
  type CategoryMeta,
  type Signal,
} from "@/lib/signals";
import {
  loadFavs,
  loadSort,
  loadUserCategories,
  saveFavs,
  saveSort,
  type SortMode,
} from "@/lib/storage";

type Card = {
  slug: string;
  meta: CategoryMeta;
  series: Series;
  stats: ReturnType<typeof computeStats>;
};

export default function HomeScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("default");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const userCats = await loadUserCategories();
      const slugs = allSlugs(userCats);
      // 카테고리 1개 실패해도 나머지 계속 (allSettled)
      const results = await Promise.allSettled(
        slugs.map(async (slug): Promise<Card | null> => {
          const meta = metaFor(slug);
          if (!meta) return null;
          const series = await getSeries(slug);
          const stats = computeStats(series);
          return { slug, meta, series, stats };
        }),
      );
      const next: Card[] = [];
      const errs: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) next.push(r.value);
        else if (r.status === "rejected") {
          errs.push(`${slugs[i]}: ${String(r.reason).slice(0, 80)}`);
          console.warn("[load]", slugs[i], r.reason);
        }
      });
      setCards(next);
      setErrors(errs);
    } catch (e) {
      console.warn("[load] outer", e);
      setErrors([String(e).slice(0, 120)]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 마운트 시 fav·sort 로드 + 첫 데이터 fetch
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [f, s] = await Promise.all([loadFavs(), loadSort()]);
      if (cancelled) return;
      setFavs(f);
      setSort(s);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // 모달 닫힘 시 갱신 (마운트 중복 호출은 cachedFetch가 dedup)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const toggleFav = useCallback(
    (slug: string) => {
      setFavs((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        void saveFavs(next);
        return next;
      });
    },
    [],
  );

  const sorted = useMemo(() => {
    const list = cards.map((c, i) => ({ c, i }));
    list.sort((a, b) => {
      const af = favs.has(a.c.slug) ? 1 : 0;
      const bf = favs.has(b.c.slug) ? 1 : 0;
      if (af !== bf) return bf - af;
      if (sort === "signal") {
        const rank = (s: Signal) => (s === "buy" ? 0 : s === "wait" ? 2 : 1);
        return rank(a.c.stats.signal) - rank(b.c.stats.signal);
      }
      if (sort === "change") {
        return Math.abs(b.c.stats.change30d) - Math.abs(a.c.stats.change30d);
      }
      return a.i - b.i;
    });
    return list.map((x) => x.c);
  }, [cards, favs, sort]);

  const anyLive = cards.some((c) => c.series.source === "live");

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={sorted}
      keyExtractor={(c) => c.slug}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#a3e635"
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>얼말까</Text>
            <Text style={[styles.liveBadge, !anyLive && styles.dimmed]}>
              {anyLive ? "● 실데이터" : "○ 더미"}
            </Text>
          </View>
          <Text style={styles.title}>지금 살까,{"\n"}기다릴까?</Text>
          <Text style={styles.subtitle}>
            환율·주유비·항공권·금. 과거+현재+예측을 한 화면에서.
          </Text>
          <View style={styles.chipRow}>
            {(["default", "signal", "change"] as SortMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setSort(m);
                  void saveSort(m);
                }}
                style={[styles.chip, sort === m && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    sort === m && styles.chipTextActive,
                  ]}
                >
                  {m === "default" ? "기본" : m === "signal" ? "신호" : "변동률"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <CardRow card={item} isFav={favs.has(item.slug)} onFav={toggleFav} />
      )}
      ListEmptyComponent={
        loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ color: "#71717a", fontSize: 13 }}>
              시세 불러오는 중…
            </Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#fb7185", fontSize: 13, fontWeight: "700" }}>
              데이터를 불러오지 못했어요
            </Text>
            <Text style={{ color: "#71717a", fontSize: 11 }}>
              아래로 당겨 새로고침
            </Text>
            {errors.slice(0, 3).map((e, i) => (
              <Text
                key={i}
                style={{ color: "#52525b", fontSize: 10, paddingHorizontal: 16 }}
                numberOfLines={2}
              >
                {e}
              </Text>
            ))}
          </View>
        )
      }
      ListFooterComponent={
        <View>
          <Link href="/add" asChild>
            <Pressable style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ 카테고리 추가</Text>
            </Pressable>
          </Link>
          <Text style={styles.footnote}>
            ※ 환율은 Frankfurter(ECB), 휘발유는 오피넷, 나머지는 데모. 통계
            신호는 참고용입니다.
          </Text>
        </View>
      }
    />
  );
}

function CardRow({
  card,
  isFav,
  onFav,
}: {
  card: Card;
  isFav: boolean;
  onFav: (slug: string) => void;
}) {
  const { slug, meta, series, stats } = card;
  const s = SIGNAL_STYLE[stats.signal];
  const positive = stats.change30d > 0;
  return (
    <View style={[styles.card, { borderColor: s.border, backgroundColor: s.bg }]}>
      <Pressable
        hitSlop={8}
        onPress={() => onFav(slug)}
        style={styles.favBtn}
      >
        <Text style={[styles.fav, isFav && styles.favOn]}>
          {isFav ? "★" : "☆"}
        </Text>
      </Pressable>
      <Link href={`/c/${slug}`} asChild>
        <Pressable style={styles.cardInner}>
          <View style={styles.cardTop}>
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.name}>{meta.name}</Text>
                {series.source === "live" && (
                  <Text style={styles.liveTag}>LIVE</Text>
                )}
              </View>
              <Text style={styles.subtitleSmall}>{meta.subtitle}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>
                  {stats.current.toLocaleString()}
                </Text>
                <Text style={styles.unit}>{meta.unit}</Text>
                <Text
                  style={[
                    styles.pct,
                    { color: positive ? "#fb7185" : "#a3e635" },
                  ]}
                >
                  {positive ? "+" : ""}
                  {stats.change30d}% · 30d
                </Text>
              </View>
              <Sparkline
                past={series.past.slice(-90)}
                forecast={series.forecast}
                width={280}
                height={44}
                stroke={s.stroke}
                smooth
              />
              <Text style={[styles.signalText, { color: s.stroke }]}>
                <Text style={styles.signalLabel}>{s.label}</Text>
                <Text style={styles.signalSub}> {stats.signalText}</Text>
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  contentContainer: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 12 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#a3e635",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  liveBadge: { color: "#a3e635", fontSize: 10, fontWeight: "600" },
  dimmed: { color: "#71717a" },
  title: {
    color: "#fafafa",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
    lineHeight: 30,
  },
  subtitle: { color: "#a1a1aa", fontSize: 13, marginTop: 10, lineHeight: 19 },
  chipRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  chipActive: { backgroundColor: "#fafafa", borderColor: "#fafafa" },
  chipText: { color: "#a1a1aa", fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: "#0b0f17" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    position: "relative",
  },
  cardInner: { padding: 14, paddingRight: 36 },
  favBtn: { position: "absolute", right: 10, top: 8, zIndex: 2 },
  fav: { color: "#52525b", fontSize: 20 },
  favOn: { color: "#fbbf24" },
  cardTop: { flexDirection: "row", gap: 10 },
  emoji: { fontSize: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  liveTag: { color: "#a3e635", fontSize: 9, fontWeight: "800" },
  subtitleSmall: { color: "#71717a", fontSize: 11, marginTop: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
    gap: 4,
  },
  price: { color: "#fafafa", fontSize: 20, fontWeight: "800" },
  unit: { color: "#71717a", fontSize: 11 },
  pct: { marginLeft: "auto", fontSize: 12, fontWeight: "700" },
  signalText: { marginTop: 4, fontSize: 12 },
  signalLabel: { fontWeight: "700" },
  signalSub: { color: "#a1a1aa" },
  footnote: {
    color: "#52525b",
    fontSize: 10,
    marginTop: 20,
    lineHeight: 16,
  },
  addBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "rgba(132, 204, 22, 0.05)",
    alignItems: "center",
  },
  addBtnText: { color: "#a3e635", fontSize: 13, fontWeight: "700" },
});
