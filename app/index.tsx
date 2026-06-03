import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { Sparkline } from "@/components/Sparkline";
import { iconSourceFor } from "@/lib/icon-sources";
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
  loadSignalMode,
  loadSort,
  loadUserCategories,
  saveFavs,
  saveSignalMode,
  saveSort,
  setTarget,
  type SignalMode,
  type SortMode,
} from "@/lib/storage";
import { upcomingEvents, type UpcomingEvent } from "@/lib/macro-events";
import { t } from "@/lib/i18n";

type Card = {
  slug: string;
  meta: CategoryMeta;
  series: Series;
  stats: ReturnType<typeof computeStats>;
  nextEvent?: UpcomingEvent;
};

export default function HomeScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("default");
  const [signalMode, setSignalMode] = useState<SignalMode>("default");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const [userCats, mode] = await Promise.all([loadUserCategories(), loadSignalMode()]);
      setSignalMode(mode);
      const slugs = allSlugs(userCats);
      // 카테고리 1개 실패해도 나머지 계속 (allSettled)
      const results = await Promise.allSettled(
        slugs.map(async (slug): Promise<Card | null> => {
          const meta = metaFor(slug);
          if (!meta) return null;
          const series = await getSeries(slug);
          const stats = computeStats(series, mode);
          const nextEvent = upcomingEvents(slug, 30, 1)[0];
          return { slug, meta, series, stats, nextEvent };
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
        const removing = next.has(slug);
        if (removing) next.delete(slug);
        else next.add(slug);
        void saveFavs(next);
        // 즐겨찾기 해제 시 목표가도 함께 제거 — 백그라운드 체크는 즐겨찾기만 돌고,
        // 즐겨찾기 빠진 카테고리에 목표가만 남으면 영영 발송 안 됨(데드 데이터).
        if (removing) void setTarget(slug, null);
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
            <Text style={styles.brand}>{t("home.brand")}</Text>
          </View>
          <Text style={styles.title}>{t("home.title")}</Text>
          <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
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
                  {t(`home.sort.${m}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>{t("home.mode.label")}</Text>
            {(["conservative", "default", "aggressive"] as SignalMode[]).map((m) => {
              const label = t(`home.mode.${m}`);
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setSignalMode(m);
                    void saveSignalMode(m);
                    // 재계산
                    setCards((prev) =>
                      prev.map((c) => ({ ...c, stats: computeStats(c.series, m) })),
                    );
                  }}
                  style={[styles.modeChip, signalMode === m && styles.modeChipActive]}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      signalMode === m && styles.modeChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
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
              <Text style={styles.addBtnText}>{t("home.add")}</Text>
            </Pressable>
          </Link>
          <Text style={styles.footnote}>© JayLabs</Text>
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
  const { slug, meta, series, stats, nextEvent } = card;
  const s = SIGNAL_STYLE[stats.signal];
  const positive = stats.change30d > 0;
  const evHigh = nextEvent?.importance === "high";
  const iconSrc = iconSourceFor(slug);
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
            {iconSrc ? (
              <Image source={iconSrc} style={styles.icon} />
            ) : (
              <Text style={styles.emoji}>{meta.emoji}</Text>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.name}>{meta.name}</Text>
                {nextEvent && (
                  <View
                    style={[
                      styles.eventChip,
                      evHigh && styles.eventChipHigh,
                    ]}
                  >
                    <Text
                      style={[
                        styles.eventChipText,
                        evHigh && styles.eventChipTextHigh,
                      ]}
                      numberOfLines={1}
                    >
                      {evHigh ? "⭐ " : ""}
                      {nextEvent.emoji} D-
                      {nextEvent.daysAhead === 0 ? "DAY" : nextEvent.daysAhead}
                    </Text>
                  </View>
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
                past={series.past}
                forecast={series.forecast}
                width={280}
                height={44}
                stroke={s.stroke}
                smooth
                interactive={false}
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
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  modeLabel: { color: "#71717a", fontSize: 10, fontWeight: "700", marginRight: 2 },
  modeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
  },
  modeChipActive: {
    borderColor: "#a3e635",
    backgroundColor: "rgba(132,204,22,0.10)",
  },
  modeChipText: { color: "#71717a", fontSize: 10, fontWeight: "700" },
  modeChipTextActive: { color: "#a3e635" },
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
  icon: { width: 28, height: 28, resizeMode: "contain" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  liveTag: { color: "#a3e635", fontSize: 9, fontWeight: "800" },
  eventChip: {
    marginLeft: "auto",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "rgba(63,63,70,0.4)",
  },
  eventChipHigh: {
    borderColor: "rgba(251, 113, 133, 0.6)",
    backgroundColor: "rgba(251, 113, 133, 0.12)",
  },
  eventChipText: { color: "#a1a1aa", fontSize: 9, fontWeight: "700" },
  eventChipTextHigh: { color: "#fb7185" },
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
    color: "#6b7280",
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
