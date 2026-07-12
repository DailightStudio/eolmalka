import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { AdBanner } from "@/components/AdBanner";
import { showInterstitialOnce, showRewardedAd } from "@/lib/ad-manager";
import { Sparkline } from "@/components/Sparkline";
import { backtestForecast, getSeries, type Series } from "@/lib/demo-series";
import { logScreen } from "@/lib/firebase";
import {
  SIGNAL_STYLE,
  applyEventVolatility,
  applySentimentBias,
  computeStats,
  dayOfWeekStats,
  forecastChange,
  forecastSummary,
  metaFor,
} from "@/lib/signals";
import { VERDICT_LABEL } from "@/lib/quartiles";
import { freshnessLabel } from "@/lib/cache";
import { loadSignalMode, loadTargets, setTarget, type SignalMode } from "@/lib/storage";
import {
  requestNotificationPermission,
  scheduleLocalAlert,
} from "@/lib/notifications";
import { registerPushToken, syncAlertToServer } from "@/lib/push-registration";
import {
  getNewsSentiment,
  clearNewsCache,
  SENTIMENT_STYLE,
  type NewsHeadline,
  type NewsResult,
} from "@/lib/news-provider";
import { upcomingEvents, type UpcomingEvent } from "@/lib/macro-events";
import {
  getSidoPrices,
  getSiGunGuPrices,
  type GasProduct,
  type SidoPrice,
  type SiGunGuPrice,
} from "@/lib/gas-provider";
import { iconSourceFor } from "@/lib/icon-sources";
import { appVersionLabel } from "@/lib/app-version";

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [target, setTargetState] = useState<number | null>(null);
  const [draftTarget, setDraftTarget] = useState<string>("");
  const [news, setNews] = useState<NewsResult | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [signalMode, setSignalMode] = useState<SignalMode>("default");
  const [sidoPrices, setSidoPrices] = useState<SidoPrice[]>([]);
  const [openSido, setOpenSido] = useState<string | null>(null);
  const [sigungus, setSigungus] = useState<Record<string, SiGunGuPrice[]>>({});
  const captureBoxRef = useRef<View>(null);

  const meta = slug ? metaFor(slug) : undefined;
  // 주유 카테고리 슬러그 → 오피넷 제품 코드 (gas-* 아니면 undefined)
  const gasProdCode: GasProduct | undefined =
    slug === "gas-petrol"
      ? "B027"
      : slug === "gas-diesel"
        ? "D047"
        : slug === "gas-lpg"
          ? "C004"
          : undefined;

  // 상세 화면 퇴장 시 전면 광고 1회 노출 (앱 시작 직후 즉시 노출 금지 정책 준수)
  useEffect(() => {
    return () => { showInterstitialOnce(); };
  }, []);

  // 상세 화면 진입 추적 (slug별)
  useEffect(() => {
    if (slug) void logScreen(slug);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const [s, mode] = await Promise.all([getSeries(slug), loadSignalMode()]);
      setSeries(s);
      setSignalMode(mode);
      const targets = await loadTargets();
      const t = targets[slug] ?? null;
      setTargetState(t);
      setDraftTarget(t != null ? String(t) : "");

      // 주유 카테고리 — 시도별 평균 (비동기, 차단 X)
      if (gasProdCode) {
        void getSidoPrices(gasProdCode).then(setSidoPrices);
      }

      // 뉴스는 별도 비동기 — 시세 화면 먼저 뜨게
      setNewsLoading(true);
      try {
        const n = await getNewsSentiment(slug);
        setNews(n);
      } finally {
        setNewsLoading(false);
      }
    })();
  }, [slug, gasProdCode]);

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

  // 뉴스 sentiment 받았으면 forecast에 ±bias 반영(confidence로 강도 스케일), 다가오는 이벤트로 신뢰구간 확장
  const events = upcomingEvents(slug, 60, 5);
  const biased = applySentimentBias(series, news?.sentiment, news?.confidence ?? 0.6);
  const adjustedSeries = applyEventVolatility(biased, events);
  const stats = computeStats(adjustedSeries, signalMode);
  const fcDelta = forecastChange(adjustedSeries);
  const fcSummary = forecastSummary(adjustedSeries);
  const dow = dayOfWeekStats(adjustedSeries);
  // 실 시계열에만 의미 있음 (라이브 + 합성 메꿈 아닌 카테고리)
  const backtest = series.pastIsLive
    ? backtestForecast(series.past, slug, 30)
    : null;
  const s = SIGNAL_STYLE[stats.signal];
  const iconSrc = iconSourceFor(slug);
  // 데이터 신선도 — 오프라인 캐시 fallback이면 source가 "synthetic"이지만 fetchedAt이 남아있음.
  const freshness = freshnessLabel(series.fetchedAt, series.source !== "live");

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
    // 이미 설정된 알림이 1개 이상이면 보상형 광고 시청 필요
    const existingTargets = await loadTargets();
    const hasOtherTargets =
      Object.keys(existingTargets).filter((k) => k !== slug).length > 0;
    if (hasOtherTargets) {
      Alert.alert(
        "광고 시청 후 설정",
        "추가 알림은 짧은 광고 시청 후 설정할 수 있습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "광고 보기",
            onPress: async () => {
              const earned = await showRewardedAd();
              if (!earned) {
                Alert.alert("광고를 끝까지 시청해야 합니다.");
                return;
              }
              await setTarget(slug, num);
              setTargetState(num);
              // 서버 푸시(Edge Function)에도 목표가 동기화 — 권한 직후일 수 있어 토큰도 등록
              void registerPushToken();
              void syncAlertToServer(slug, num);
              await scheduleLocalAlert({
                title: `${meta.name} 알림 설정됨`,
                body: `${num.toLocaleString()}${meta.unit} 이하일 때 알려드릴게요.`,
                data: { slug },
                kind: "system",
              });
            },
          },
        ],
      );
      return; // Alert이 비동기로 처리하므로 여기서 return
    }
    await setTarget(slug, num);
    setTargetState(num);
    // 서버 푸시(Edge Function)에도 목표가 동기화 — 권한 직후일 수 있어 토큰도 등록
    void registerPushToken();
    void syncAlertToServer(slug, num);
    await scheduleLocalAlert({
      title: `${meta.name} 알림 설정됨`,
      body: `${num.toLocaleString()}${meta.unit} 이하일 때 알려드릴게요.`,
      data: { slug },
      kind: "system",
    });
  };

  const toggleSido = async (code: string) => {
    if (openSido === code) {
      setOpenSido(null);
      return;
    }
    setOpenSido(code);
    if (!sigungus[code]) {
      const list = await getSiGunGuPrices(code, gasProdCode ?? "B027");
      setSigungus((prev) => ({ ...prev, [code]: list }));
    }
  };

  const refreshNews = async () => {
    await clearNewsCache(slug);
    setNewsLoading(true);
    try {
      const n = await getNewsSentiment(slug);
      setNews(n);
    } finally {
      setNewsLoading(false);
    }
  };

  const clearTarget = async () => {
    await setTarget(slug, null);
    setTargetState(null);
    setDraftTarget("");
    // 서버 알림 비활성화
    void syncAlertToServer(slug, null);
  };

  const shareCard = async () => {
    const trend = stats.change30d > 0 ? `📈 +${stats.change30d}%` : `📉 ${stats.change30d}%`;
    const fcLine = fcSummary?.cheapest && fcSummary.cheapest.savingAbs > 0
      ? `\n💰 예상 최저 ${fcSummary.cheapest.date} (~${fcSummary.cheapest.savingAbs.toLocaleString()}원 절약)`
      : "";
    const deepLink = `eolmalka://c/${slug}`;
    const message =
      `${meta.emoji} ${meta.name}\n` +
      `${stats.current.toLocaleString()}${meta.unit} · ${trend} 30d\n` +
      `${s.label} — ${stats.signalText}` +
      fcLine +
      `\n\n${deepLink}` +
      `\n— 얼말까 (시세 비교·예측)`;
    // 1) 카드 이미지 캡처 → expo-sharing (이미지 + 텍스트). 실패 시 텍스트 폴백.
    try {
      if (captureBoxRef.current) {
        const uri = await captureRef(captureBoxRef, {
          format: "png",
          quality: 0.95,
          result: "tmpfile",
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: meta.name,
            mimeType: "image/png",
            UTI: "public.png",
          });
          return;
        }
      }
    } catch (e) {
      console.warn("[share] capture failed, fallback to text", e);
    }
    // 2) 텍스트 폴백 (RN 내장 Share)
    try {
      await Share.share({ message, title: meta.name });
    } catch (e) {
      console.warn("[share] failed", e);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: meta.name,
          headerRight: () => (
            <Pressable onPress={shareCard} hitSlop={8}>
              <Text style={styles.shareBtn}>공유</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View ref={captureBoxRef} collapsable={false} style={styles.captureBox}>
        <View style={styles.header}>
          {iconSrc ? (
            <Image
              source={iconSrc}
              style={{ width: 32, height: 32, resizeMode: "contain" }}
            />
          ) : (
            <Text style={styles.emoji}>{meta.emoji}</Text>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.name}>{meta.name}</Text>
              {/* LIVE/DEMO 배지 — CLAUDE.md 요구사항 */}
              <Text style={[
                styles.sourceTag,
                { color: series.source === "live" ? "#a3e635" : "#71717a" },
              ]}>
                {series.source === "live" ? "LIVE" : "DEMO"}
              </Text>
            </View>
            <Text style={styles.sub}>{meta.subtitle}</Text>
          </View>
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
          <View style={styles.freshRow}>
            <Text style={styles.muted}>현재가</Text>
            {freshness && (
              <Text
                style={[
                  styles.freshness,
                  { color: freshness.offline ? "#fb923c" : "#52525b" },
                ]}
              >
                {freshness.text}
              </Text>
            )}
          </View>
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
            past={adjustedSeries.past}
            forecast={adjustedSeries.forecast}
            forecastBand={adjustedSeries.forecastBand}
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
        <Text style={styles.captureWatermark}>— 얼말까 · eolmalka</Text>
        </View>

        {events.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🗓️ 다가오는 거시 이벤트 (60일)</Text>
            <View style={styles.evCard}>
              {events.map((e, i) => (
                <View key={`${e.date}-${e.type}-${i}`} style={styles.evRow}>
                  <Text style={styles.evEmoji}>{e.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evTitle} numberOfLines={1}>
                      {e.title}
                      {e.importance === "high" && (
                        <Text style={{ color: "#fb7185" }}>  ⭐</Text>
                      )}
                    </Text>
                    <Text style={styles.evDate}>
                      {e.date} · 발표 후 평균 ±{e.expectedVolatility}% 변동
                    </Text>
                  </View>
                  <Text style={styles.evDday}>
                    D-{e.daysAhead === 0 ? "DAY" : e.daysAhead}
                  </Text>
                </View>
              ))}
              <Text style={styles.tinyMuted}>
                ※ 예상 일정 + 역사적 평균 변동성. 실제는 컨센서스 surprise에
                따라 더 크거나 작을 수 있음.
              </Text>
            </View>
          </>
        )}

        {slug?.startsWith("gas-") && sidoPrices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📍 시도별 평균 (실시간)</Text>
            <View style={styles.sidoCard}>
              {(() => {
                const display = [...sidoPrices.slice(0, 5), ...sidoPrices.slice(-3).reverse()];
                return display.map((s, idx) => {
                  const diff = ((s.price - stats.current) / stats.current) * 100;
                  const color = diff > 0 ? "#fb7185" : "#a3e635";
                  const isOpen = openSido === s.code;
                  const list = sigungus[s.code];
                  const isCheap = idx < 5;
                  return (
                    <View key={s.code}>
                      {idx === 0 && (
                        <Text style={styles.sidoSectionLabel}>저렴한 곳</Text>
                      )}
                      {idx === 5 && (
                        <Text style={[styles.sidoSectionLabel, { marginTop: 6 }]}>
                          비싼 곳
                        </Text>
                      )}
                      <Pressable onPress={() => toggleSido(s.code)} style={styles.sidoRow}>
                        <Text style={styles.sidoName}>
                          {isOpen ? "▾ " : "▸ "}
                          {s.sido}
                        </Text>
                        <Text style={styles.sidoPrice}>
                          {s.price.toLocaleString()}원
                        </Text>
                        <Text style={[styles.sidoDiff, { color }]}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                        </Text>
                      </Pressable>
                      {isOpen && list && list.length > 0 && (
                        <View style={styles.sigunguBox}>
                          {(isCheap ? list.slice(0, 5) : list.slice(-5).reverse()).map((g) => {
                            const gDiff = ((g.price - stats.current) / stats.current) * 100;
                            const gColor = gDiff > 0 ? "#fb7185" : "#a3e635";
                            return (
                              <View key={g.code} style={styles.sigunguRow}>
                                <Text style={styles.sigunguName} numberOfLines={1}>
                                  {g.sigungu}
                                </Text>
                                <Text style={styles.sigunguPrice}>
                                  {g.price.toLocaleString()}
                                </Text>
                                <Text style={[styles.sigunguDiff, { color: gColor }]}>
                                  {gDiff > 0 ? "+" : ""}{gDiff.toFixed(1)}%
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      {isOpen && list && list.length === 0 && (
                        <Text style={styles.sigunguEmpty}>시군구 데이터 없음</Text>
                      )}
                    </View>
                  );
                });
              })()}
              <Text style={styles.tinyMuted}>
                전국 평균 {stats.current.toLocaleString()}원/L 대비. 시도 탭 → 시군구 펼침.
              </Text>
            </View>
          </>
        )}

        {dow && (
          <>
            <Text style={styles.sectionTitle}>📅 요일별 평균 (지난 1년)</Text>
            <View style={styles.dowCard}>
              <View style={styles.dowRow}>
                {dow.stats.map((d) => {
                  const isMin = d.dayIdx === dow.cheapest.dayIdx;
                  const isMax = d.dayIdx === dow.highest.dayIdx;
                  return (
                    <View key={d.dayIdx} style={styles.dowCell}>
                      <Text
                        style={[
                          styles.dowDay,
                          isMin && { color: "#a3e635" },
                          isMax && { color: "#fb7185" },
                        ]}
                      >
                        {d.day}
                      </Text>
                      <Text
                        style={[
                          styles.dowPct,
                          {
                            color:
                              d.diffPct > 0
                                ? "#fb7185"
                                : d.diffPct < 0
                                  ? "#a3e635"
                                  : "#71717a",
                          },
                        ]}
                      >
                        {d.diffPct > 0 ? "+" : ""}
                        {d.diffPct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.tinyMuted}>
                💡 평균적으로{" "}
                <Text style={{ color: "#a3e635", fontWeight: "700" }}>
                  {dow.cheapest.day}요일
                </Text>
                이 가장 저렴 (
                {dow.cheapest.avg.toLocaleString()}
                {meta.unit.replace(/^원/, "")}),{" "}
                <Text style={{ color: "#fb7185", fontWeight: "700" }}>
                  {dow.highest.day}요일
                </Text>
                이 가장 비쌈.
              </Text>
            </View>
          </>
        )}

        {fcSummary && (
          <>
            <Text style={styles.sectionTitle}>🔮 예측 (참고용 통계 모델)</Text>
            <View style={styles.fcCard}>
              <View style={styles.fcGrid}>
                {fcSummary.milestones.map((m) => {
                  const up = m.changePct > 0;
                  return (
                    <View key={m.daysAhead} style={styles.fcCell}>
                      <Text style={styles.fcLabel}>
                        {m.daysAhead === 1 ? "내일" : `${m.daysAhead}일 뒤`}
                      </Text>
                      <Text style={styles.fcVal}>
                        {m.value.toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.fcPct,
                          { color: up ? "#fb7185" : "#a3e635" },
                        ]}
                      >
                        {up ? "+" : ""}
                        {m.changePct}%
                      </Text>
                      <Text style={styles.fcDate}>{m.date.slice(5)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.fcHighlight}>
                {fcSummary.cheapest.daysAhead > 0 &&
                fcSummary.cheapest.savingAbs > 0 ? (
                  <Text style={styles.fcCheapText}>
                    <Text style={{ color: "#a3e635", fontWeight: "800" }}>
                      💰 예상 최저
                    </Text>
                    <Text style={styles.muted}>
                      {"  "}
                      {fcSummary.cheapest.date}{" "}
                      ({fcSummary.cheapest.daysAhead}일 뒤)
                    </Text>
                    {"\n"}
                    <Text style={styles.fcCheapValue}>
                      {fcSummary.cheapest.value.toLocaleString()}
                      {meta.unit.replace(/^원/, "")}{" "}
                    </Text>
                    <Text style={{ color: "#a3e635" }}>
                      ({fcSummary.cheapest.changePct}%, ~
                      {fcSummary.cheapest.savingAbs.toLocaleString()}원 절약)
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.fcCheapText}>
                    <Text style={{ color: "#a3e635", fontWeight: "800" }}>
                      💡 오늘이 30일 내 최저
                    </Text>
                    <Text style={styles.muted}>{"  "}— 지금 사세요</Text>
                  </Text>
                )}
              </View>
              {backtest && (
                <View style={styles.backtestRow}>
                  <Text style={styles.backtestVal}>
                    지난 30일 모델 재현 오차 ~{backtest.mape}%{"\n"}
                    <Text style={styles.backtestLabel}>(참고용 · 시장 급변 미반영)</Text>
                  </Text>
                </View>
              )}
              <Text style={styles.tinyMuted}>
                ※ 7d/30d/90d 가중 추세{news?.sentiment && news.sentiment !== "neutral"
                  ? ` + 뉴스 ${news.sentiment === "bullish" ? "상승" : "하락"} bias`
                  : ""}{events.length > 0 ? " + 이벤트 변동성" : ""}{". 음영=±1σ 신뢰구간 (시간·이벤트로 확장)."}
              </Text>
            </View>
          </>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
          <Text style={[styles.sectionTitle, { marginTop: 0, flex: 1 }]}>📰 시장 분위기 (뉴스)</Text>
          <Pressable onPress={refreshNews} hitSlop={8} disabled={newsLoading}>
            <Text style={{ color: newsLoading ? "#3f3f46" : "#a3e635", fontSize: 11, fontWeight: "700" }}>
              {newsLoading ? "로딩 중…" : "새로고침"}
            </Text>
          </Pressable>
        </View>
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
                {news.live && news.sentiment !== "neutral" && (
                  <Text style={styles.newsConf}>
                    신뢰도 {Math.round((news.confidence ?? 0.6) * 100)}%
                  </Text>
                )}
                {news.stale && (
                  <Text style={styles.newsFlag}>캐시</Text>
                )}
                {!news.live && !news.stale && (
                  <Text style={styles.newsFlag}>키 없음</Text>
                )}
              </View>
              <Text style={styles.newsSummary}>{news.summary}</Text>
              {(news.items?.length ?? news.headlines.length) > 0 && (
                <View style={{ marginTop: 10, gap: 4 }}>
                  {(news.items ??
                    news.headlines.map(
                      (h): NewsHeadline => ({ title: h }),
                    ))
                    .slice(0, 6)
                    .map((it, i) => (
                      <Pressable
                        key={i}
                        onPress={() => {
                          if (it.link) void Linking.openURL(it.link);
                        }}
                        disabled={!it.link}
                        hitSlop={4}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          {/* 국내/해외 뱃지 */}
                          <Text
                            style={{
                              fontSize: 9.5,
                              color: it.locale === "en" ? "#60a5fa" : "#a3e635",
                              backgroundColor: "rgba(255,255,255,0.06)",
                              paddingHorizontal: 4,
                              paddingVertical: 1.5,
                              borderRadius: 3,
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          >
                            {it.locale === "en" ? "해외" : "국내"}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.newsItem} numberOfLines={2}>
                              {it.title}
                              {it.link ? (
                                <Text style={styles.newsItemLink}>  ↗</Text>
                              ) : null}
                            </Text>
                            {it.source ? (
                              <Text
                                style={{
                                  fontSize: 9.5,
                                  color: "#52525b",
                                  marginTop: 1,
                                }}
                              >
                                {it.source}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                </View>
              )}
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

        <AdBanner />

        <Text style={styles.footnote}>
          통계 신호는 참고용이며 투자 자문이 아닙니다.{"\n"}© JayLabs
        </Text>
        <Text style={[styles.footnote, { color: "#3f3f46", marginTop: 2 }]}>{appVersionLabel()}</Text>
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
  shareBtn: { color: "#a3e635", fontSize: 14, fontWeight: "700", paddingHorizontal: 8 },
  captureBox: {
    backgroundColor: "#0b0f17",
    paddingBottom: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  captureWatermark: {
    color: "#52525b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 6,
    textAlign: "right",
  },
  priceBlock: { marginTop: 18 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  priceLg: { color: "#fafafa", fontSize: 30, fontWeight: "800" },
  unitLg: { color: "#71717a", fontSize: 13 },
  pctLg: { marginLeft: "auto", fontSize: 14, fontWeight: "700" },
  muted: { color: "#71717a", fontSize: 12, marginTop: 4 },
  freshRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  freshness: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  tinyMuted: { color: "#6b7280", fontSize: 10, marginTop: 6, lineHeight: 14 },
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
  newsConf: {
    marginLeft: "auto",
    fontSize: 10,
    color: "#a1a1aa",
    fontWeight: "700",
  },
  newsSummary: { color: "#fafafa", fontSize: 14, marginTop: 8, lineHeight: 20 },
  newsItem: { color: "#a1a1aa", fontSize: 11, lineHeight: 16 },
  newsItemLink: { color: "#a3e635", fontSize: 10, fontWeight: "700" },
  fcCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  fcGrid: {
    flexDirection: "row",
    gap: 6,
  },
  fcCell: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(24,24,27,0.6)",
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  fcLabel: { color: "#71717a", fontSize: 10, fontWeight: "600" },
  fcVal: { color: "#fafafa", fontSize: 13, fontWeight: "800", marginTop: 4 },
  fcPct: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  fcDate: { color: "#52525b", fontSize: 9, marginTop: 2 },
  fcHighlight: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  fcCheapText: { fontSize: 12, lineHeight: 18 },
  fcCheapValue: { color: "#fafafa", fontSize: 15, fontWeight: "800" },
  backtestRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  backtestLabel: { color: "#71717a", fontSize: 10, fontWeight: "700" },
  backtestVal: { color: "#a1a1aa", fontSize: 11, fontWeight: "700" },
  dowCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  dowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dowCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  dowDay: { color: "#d4d4d8", fontSize: 12, fontWeight: "700" },
  dowPct: { fontSize: 10, fontWeight: "600", marginTop: 4 },
  sidoCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  sidoSection: { gap: 4 },
  sidoSectionLabel: {
    color: "#71717a",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  sidoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  sidoName: { color: "#fafafa", fontSize: 12, fontWeight: "600", width: 80 },
  sidoPrice: { color: "#a1a1aa", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" },
  sidoDiff: { fontSize: 11, fontWeight: "700", width: 60, textAlign: "right" },
  sigunguBox: {
    marginLeft: 16,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#27272a",
    paddingVertical: 4,
    gap: 2,
  },
  sigunguRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  sigunguName: { color: "#a1a1aa", fontSize: 11, flex: 1 },
  sigunguPrice: { color: "#71717a", fontSize: 11, fontWeight: "600", width: 60, textAlign: "right" },
  sigunguDiff: { fontSize: 10, fontWeight: "600", width: 50, textAlign: "right" },
  sigunguEmpty: { color: "#52525b", fontSize: 10, paddingVertical: 4, paddingLeft: 16 },
  evCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
    gap: 8,
  },
  evRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  evEmoji: { fontSize: 18 },
  evTitle: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  evDate: { color: "#71717a", fontSize: 10, marginTop: 2 },
  evDday: {
    color: "#a3e635",
    fontSize: 12,
    fontWeight: "800",
    minWidth: 50,
    textAlign: "right",
  },
});
