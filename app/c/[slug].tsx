import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Sparkline } from "@/components/Sparkline";
import { getSeries, type Series } from "@/lib/demo-series";
import {
  SIGNAL_STYLE,
  computeStats,
  forecastChange,
  metaFor,
} from "@/lib/signals";
import { VERDICT_LABEL } from "@/lib/quartiles";
import { loadTargets, setTarget } from "@/lib/storage";
import {
  requestNotificationPermission,
  scheduleLocalAlert,
} from "@/lib/notifications";
import {
  getNewsSentiment,
  SENTIMENT_STYLE,
  type NewsResult,
} from "@/lib/news-provider";

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [target, setTargetState] = useState<number | null>(null);
  const [draftTarget, setDraftTarget] = useState<string>("");
  const [news, setNews] = useState<NewsResult | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const meta = slug ? metaFor(slug) : undefined;

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const s = await getSeries(slug);
      setSeries(s);
      const targets = await loadTargets();
      const t = targets[slug] ?? null;
      setTargetState(t);
      setDraftTarget(t != null ? String(t) : "");

      // 뉴스는 별도 비동기 — 시세 화면 먼저 뜨게
      setNewsLoading(true);
      try {
        const n = await getNewsSentiment(slug);
        setNews(n);
      } finally {
        setNewsLoading(false);
      }
    })();
  }, [slug]);

  if (!meta || !slug) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>알 수 없는 카테고리</Text>
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>불러오는 중…</Text>
      </View>
    );
  }

  const stats = computeStats(series);
  const fcDelta = forecastChange(series);
  const s = SIGNAL_STYLE[stats.signal];

  const saveTarget = async () => {
    const num = Number(draftTarget.replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert("입력 오류", "양의 숫자를 입력하세요.");
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert(
        "알림 권한 필요",
        "목표가 도달 시 알림을 받으려면 알림 권한을 허용해주세요. 설정 → 얼말까에서 변경 가능합니다.",
      );
      return;
    }
    await setTarget(slug, num);
    setTargetState(num);
    await scheduleLocalAlert({
      title: `${meta.name} 알림 설정됨`,
      body: `${num.toLocaleString()}${meta.unit} 이하일 때 알려드릴게요.`,
      data: { slug },
    });
  };

  const clearTarget = async () => {
    await setTarget(slug, null);
    setTargetState(null);
    setDraftTarget("");
  };

  return (
    <>
      <Stack.Screen options={{ title: meta.name }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{meta.name}</Text>
            <Text style={styles.sub}>{meta.subtitle}</Text>
          </View>
          <Text
            style={[
              styles.sourceTag,
              { color: series.source === "live" ? "#a3e635" : "#71717a" },
            ]}
          >
            {series.source === "live" ? `LIVE · ${series.sourceName}` : "DEMO"}
          </Text>
        </View>

        <View style={styles.priceBlock}>
          <View style={styles.row}>
            <Text style={styles.priceLg}>
              {stats.current.toLocaleString()}
            </Text>
            <Text style={styles.unitLg}>{meta.unit}</Text>
            <Text
              style={[
                styles.pctLg,
                { color: stats.change30d >= 0 ? "#fb7185" : "#a3e635" },
              ]}
            >
              {stats.change30d >= 0 ? "+" : ""}
              {stats.change30d}%
            </Text>
          </View>
          <Text style={styles.muted}>
            {series.source === "live" ? "현재가 (실데이터)" : "현재가 (데모)"}
          </Text>
        </View>

        <View
          style={[
            styles.signalCard,
            { borderColor: s.border, backgroundColor: s.bg },
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.signalLabel, { color: s.stroke }]}>
              {s.label}
            </Text>
            <Text style={styles.muted}>
              예측 30d{" "}
              <Text style={{ color: fcDelta >= 0 ? "#fb7185" : "#a3e635" }}>
                {fcDelta >= 0 ? "+" : ""}
                {fcDelta}%
              </Text>
            </Text>
          </View>
          <Text style={styles.signalBody}>{stats.signalText}</Text>
        </View>

        <Text style={styles.sectionTitle}>1년 추이 + 예측 30일</Text>
        <View style={styles.chartBox}>
          <Sparkline
            past={series.past}
            forecast={series.forecast}
            width={320}
            height={160}
            stroke={s.stroke}
            smooth
          />
        </View>
        <Text style={styles.tinyMuted}>
          실선=과거 · 점선=예측. 현재 시점은 ●.
        </Text>

        <View style={styles.statsRow}>
          <StatBox
            label="1주"
            value={fmtPct(stats.change7d)}
            positive={stats.change7d > 0}
          />
          <StatBox
            label="1개월"
            value={fmtPct(stats.change30d)}
            positive={stats.change30d > 0}
          />
          <StatBox
            label="1년"
            value={fmtPct(stats.change365d)}
            positive={stats.change365d > 0}
          />
        </View>

        <View style={styles.kvCard}>
          <View style={styles.row}>
            <Text style={styles.kvLabel}>통계 위치</Text>
            <Text style={[styles.kvValue, { color: s.stroke }]}>
              {VERDICT_LABEL[stats.verdict]}
            </Text>
          </View>
          <Text style={styles.tinyMuted}>
            1Q {fmt(stats.quartiles.first)} · 중앙{" "}
            {fmt(stats.quartiles.median)} · 3Q {fmt(stats.quartiles.third)} ·
            MA30 {fmt(stats.ma30)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>📰 시장 분위기 (뉴스)</Text>
        <View style={styles.newsCard}>
          {newsLoading && !news ? (
            <Text style={styles.muted}>뉴스 분석 중…</Text>
          ) : news ? (
            <>
              <View style={styles.row}>
                <Text style={styles.newsEmoji}>
                  {SENTIMENT_STYLE[news.sentiment].emoji}
                </Text>
                <Text
                  style={[
                    styles.newsLabel,
                    { color: SENTIMENT_STYLE[news.sentiment].color },
                  ]}
                >
                  {SENTIMENT_STYLE[news.sentiment].label}
                </Text>
                {!news.live && (
                  <Text style={styles.newsFlag}>키 없음</Text>
                )}
              </View>
              <Text style={styles.newsSummary}>{news.summary}</Text>
              {news.headlines.length > 0 && (
                <View style={{ marginTop: 10, gap: 4 }}>
                  {news.headlines.slice(0, 3).map((h, i) => (
                    <Text key={i} style={styles.newsItem} numberOfLines={2}>
                      • {h}
                    </Text>
                  ))}
                </View>
              )}
              <Text style={styles.tinyMuted}>
                출처: Google News · 분석: Gemini 2.5 Flash (1시간 캐싱)
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>뉴스를 가져오지 못했습니다.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>🎯 목표가 알림</Text>
        <View style={styles.targetCard}>
          {target != null ? (
            <View>
              <Text style={styles.targetActive}>
                현재 설정: {target.toLocaleString()}
                {meta.unit} 이하 시 알림
              </Text>
              <Pressable style={styles.btnGhost} onPress={clearTarget}>
                <Text style={styles.btnGhostText}>알림 해제</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.muted}>
              목표가를 입력하면 가격이 그 이하로 떨어졌을 때 폰 알림이 옵니다.
              백그라운드 체크는 약 1시간 주기 (OS가 최종 결정).
            </Text>
          )}
          <View style={styles.targetRow}>
            <TextInput
              value={draftTarget}
              onChangeText={setDraftTarget}
              placeholder={`예: ${Math.round(stats.current * 0.95).toLocaleString()}`}
              placeholderTextColor="#52525b"
              keyboardType="numeric"
              style={styles.input}
            />
            <Pressable style={styles.btnPrimary} onPress={saveTarget}>
              <Text style={styles.btnPrimaryText}>저장</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footnote}>
          ※{" "}
          {series.source === "live"
            ? series.pastIsLive
              ? `데이터 출처: ${series.sourceName} (시계열·현재가 모두 실데이터).`
              : `데이터 출처: ${series.sourceName} (현재가는 실데이터, 1년 시계열은 그 현재가에 비례 스케일한 합성).`
            : "데모 화면 — 실데이터 미연결."}{" "}
          통계 신호는 참고용이며 투자 자문이 아닙니다.
        </Text>
      </ScrollView>
    </>
  );
}

function StatBox({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          { color: positive ? "#fb7185" : "#a3e635" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function fmt(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f17" },
  content: { padding: 16, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  emoji: { fontSize: 28 },
  name: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  sub: { color: "#71717a", fontSize: 11, marginTop: 2 },
  sourceTag: { fontSize: 10, fontWeight: "800" },
  priceBlock: { marginTop: 18 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  priceLg: { color: "#fafafa", fontSize: 30, fontWeight: "800" },
  unitLg: { color: "#71717a", fontSize: 13 },
  pctLg: { marginLeft: "auto", fontSize: 14, fontWeight: "700" },
  muted: { color: "#71717a", fontSize: 12, marginTop: 4 },
  tinyMuted: { color: "#52525b", fontSize: 10, marginTop: 6, lineHeight: 14 },
  signalCard: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  signalLabel: { fontSize: 12, fontWeight: "800" },
  signalBody: { color: "#fafafa", marginTop: 4, fontSize: 14 },
  sectionTitle: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 20,
  },
  chartBox: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "rgba(24, 24, 27, 0.4)",
    padding: 6,
    alignItems: "center",
  },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
    alignItems: "center",
  },
  statLabel: { color: "#71717a", fontSize: 10 },
  statValue: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  kvCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  kvLabel: { color: "#d4d4d8", fontSize: 13, fontWeight: "700" },
  kvValue: { marginLeft: "auto", fontSize: 13, fontWeight: "800" },
  targetCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  targetActive: { color: "#a3e635", fontSize: 13, fontWeight: "700" },
  targetRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 12,
    color: "#fafafa",
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: "#a3e635",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#0b0f17", fontWeight: "800", fontSize: 13 },
  btnGhost: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#52525b",
    paddingVertical: 8,
    alignItems: "center",
  },
  btnGhostText: { color: "#a1a1aa", fontSize: 12, fontWeight: "600" },
  footnote: {
    color: "#52525b",
    fontSize: 10,
    marginTop: 24,
    lineHeight: 16,
  },
  newsCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  newsEmoji: { fontSize: 18 },
  newsLabel: { fontSize: 13, fontWeight: "800", marginLeft: 4 },
  newsFlag: {
    marginLeft: "auto",
    fontSize: 9,
    color: "#71717a",
    fontWeight: "700",
  },
  newsSummary: { color: "#fafafa", fontSize: 14, marginTop: 8, lineHeight: 20 },
  newsItem: { color: "#a1a1aa", fontSize: 11, lineHeight: 16 },
});
