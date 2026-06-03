// Google News RSS (무키) → 헤드라인 5개 → OpenRouter Gemini로 감성 분석.
// AsyncStorage 1시간 캐싱.
//
// 보안 트레이드오프: EXPO_PUBLIC_OPENROUTER_KEY가 클라이언트 번들에 박힘 → 디컴파일 노출 가능.
// 데모 단계. 운영 전 server-agent 또는 Supabase Edge Function 프록시로 이관 필요.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { metaFor } from "./signals";
import { scheduleLocalAlert } from "./notifications";
import { isInCooldown, markNotified } from "./storage";

const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
// Supabase Edge Function 프록시 URL — 있으면 클라가 키 노출 없이 프록시 호출.
// 함수 코드: supabase/functions/news-sentiment/index.ts
const PROXY_URL = process.env.EXPO_PUBLIC_NEWS_PROXY_URL;
const MODEL = "google/gemini-2.5-flash";
const CACHE_PREFIX = "eolmalka:news:v1:";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

export type NewsSentiment = "bullish" | "bearish" | "neutral";

export type NewsHeadline = {
  title: string;
  link?: string;
  source?: string;       // 뉴스 매체 이름 (예: "한국경제", "Reuters")
  locale?: "ko" | "en";  // 국내/해외 구분
  description?: string;  // RSS <description> 첫 문장 요약 (감성 분석 정확도 향상용)
};

export type NewsResult = {
  sentiment: NewsSentiment;
  // 0.0~1.0 — bias 강도 스케일. 구버전 캐시에는 없으므로 optional.
  confidence?: number;
  summary: string;       // 한 줄 한국어 요약 (40자 이내)
  headlines: string[];   // 사용한 헤드라인 (출처 표시용) — 구버전 호환 위해 유지
  items?: NewsHeadline[]; // link 포함 (구버전 캐시 호환 위해 optional)
  fetchedAt: number;
  live: boolean;         // 실 LLM 호출이었는지(키 있고 성공) / 더미인지
  stale?: boolean;       // fetch 실패 시 만료 캐시를 반환한 경우
};

// 카테고리별 다국가·다관점 쿼리:
//   ko: 한국 매체 시점 (KRW 입장)
//   en: 본국·국제 매체 시점 (Fed/BOJ/ECB/OPEC 등)
// Gemini가 둘 다 종합해 한국 사용자 관점에서 평가.
type Queries = { ko: string; en?: string };
const QUERIES: Record<string, Queries> = {
  "fx-usd":     { ko: "원달러 환율 한국은행", en: "Fed FOMC dollar interest rate" },
  "fx-jpy":     { ko: "엔화 환율 일본은행",   en: "BOJ yen Japan monetary policy" },
  "fx-eur":     { ko: "유로 환율 ECB",        en: "ECB euro inflation rates" },
  "fx-cny":     { ko: "위안화 환율 중국",     en: "PBOC yuan China economy" },
  "fx-gbp":     { ko: "파운드 환율 영국",     en: "BoE pound UK rates" },
  "fx-aud":     { ko: "호주달러 환율",        en: "RBA Australia dollar rates" },
  "fx-cad":     { ko: "캐나다달러 환율",      en: "BoC Canada dollar rates" },
  "fx-chf":     { ko: "스위스프랑 환율",      en: "SNB Swiss franc" },
  "fx-hkd":     { ko: "홍콩달러 환율",        en: "Hong Kong dollar HKMA" },
  "fx-sgd":     { ko: "싱가포르달러 환율",    en: "MAS Singapore dollar" },
  "fx-thb":     { ko: "태국바트 환율",        en: "Bank of Thailand baht" },
  "fx-nzd":     { ko: "뉴질랜드달러 환율",    en: "RBNZ New Zealand dollar" },
  "fx-inr":     { ko: "인도루피 환율",        en: "RBI India rupee" },
  "fx-vnd":     { ko: "베트남동 환율",        en: "Vietnam dong economy" },
  "fx-try":     { ko: "터키리라 환율",        en: "Turkey lira CBRT" },
  "fx-mxn":     { ko: "멕시코페소 환율",      en: "Mexico peso Banxico" },
  "fx-php":     { ko: "필리핀페소 환율",      en: "Philippines peso BSP" },
  "gas-petrol": { ko: "휘발유 가격 한국 오피넷", en: "OPEC oil price WTI Brent" },
  "gas-diesel": { ko: "경유 가격 한국 오피넷", en: "diesel fuel price Korea" },
  "gas-lpg":    { ko: "LPG 가격 한국 부탄",   en: "LPG autogas price Korea" },
  "gold-kr":    { ko: "금 시세 한국",         en: "gold price LBMA Fed inflation" },
  "air-nrt":    { ko: "도쿄 항공권 가격",         en: "Japan Tokyo tourism airfare" },
  "air-tpe":    { ko: "타이베이 항공권 가격",     en: "Taiwan tourism airfare" },
  "air-kix":    { ko: "오사카 항공권 가격",       en: "Osaka Japan tourism airfare" },
  "air-fuk":    { ko: "후쿠오카 항공권 가격",     en: "Fukuoka Japan tourism airfare" },
  "air-cts":    { ko: "삿포로 항공권 가격",       en: "Sapporo Japan tourism airfare" },
  "air-bkk":    { ko: "방콕 항공권 가격",         en: "Bangkok Thailand tourism airfare" },
  "air-sin":    { ko: "싱가포르 항공권 가격",     en: "Singapore tourism airfare" },
  "air-hkg":    { ko: "홍콩 항공권 가격",         en: "Hong Kong tourism airfare" },
  "air-dps":    { ko: "발리 항공권 가격",         en: "Bali Indonesia tourism airfare" },
  "air-cdg":    { ko: "파리 유럽 항공권 가격",   en: "Paris France Europe airfare" },
  "air-lax":    { ko: "미국 로스앤젤레스 항공권", en: "Los Angeles USA airfare" },
  "air-oka":    { ko: "오키나와 항공권 가격",       en: "Okinawa Japan tourism airfare" },
  "air-kul":    { ko: "쿠알라룸푸르 항공권 가격",   en: "Kuala Lumpur Malaysia tourism airfare" },
  "air-sgn":    { ko: "호치민 베트남 항공권 가격",   en: "Ho Chi Minh Vietnam tourism airfare" },
  "air-han":    { ko: "하노이 베트남 항공권 가격",   en: "Hanoi Vietnam tourism airfare" },
  "air-dad":    { ko: "다낭 베트남 항공권 가격",     en: "Da Nang Vietnam tourism airfare" },
  "air-mnl":    { ko: "마닐라 필리핀 항공권 가격",   en: "Manila Philippines tourism airfare" },
  "air-cgk":    { ko: "자카르타 인도네시아 항공권",  en: "Jakarta Indonesia tourism airfare" },
  "air-pek":    { ko: "베이징 중국 항공권 가격",     en: "Beijing China tourism airfare" },
  "air-pvg":    { ko: "상하이 중국 항공권 가격",     en: "Shanghai China tourism airfare" },
  "air-lhr":    { ko: "런던 영국 항공권 가격",       en: "London UK Europe airfare" },
  "air-syd":    { ko: "시드니 호주 항공권 가격",     en: "Sydney Australia airfare" },
  "air-dxb":    { ko: "두바이 항공권 가격",         en: "Dubai UAE airfare" },
  "air-gum":    { ko: "괌 항공권 가격",             en: "Guam tourism airfare" },
  "air-jfk":    { ko: "뉴욕 미국 항공권 가격",       en: "New York USA airfare" },
};

export async function getNewsSentiment(slug: string): Promise<NewsResult | null> {
  const queries = QUERIES[slug];
  if (!queries) return null;

  // 캐시 hit?
  const cached = await readCache(slug);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    // 한국어·영어 헤드라인 병렬 fetch (한국 시점 + 본국/국제 시점)
    const [koHeads, enHeads] = await Promise.all([
      fetchHeadlines(queries.ko, "ko", "KR"),
      queries.en
        ? fetchHeadlines(queries.en, "en", "US")
        : Promise.resolve<NewsHeadline[]>([]),
    ]);
    // 중복 제거하면서 ko 4개 + en 4개 우선 (밸런스)
    const mergedItems: NewsHeadline[] = [];
    const seen = new Set<string>();
    const take = (arr: NewsHeadline[], n: number) => {
      for (const h of arr) {
        if (mergedItems.length >= 8) break;
        const key = h.title.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          mergedItems.push(h);
          if (--n <= 0) break;
        }
      }
    };
    take(koHeads, 4);
    take(enHeads, 4);
    // 부족하면 채움
    take(koHeads, 8);
    take(enHeads, 8);

    if (mergedItems.length === 0) return cached ?? null;
    const mergedTitles = mergedItems.map((x) => x.title);

    if (!OPENROUTER_KEY && !PROXY_URL) {
      const result: NewsResult = {
        sentiment: "neutral",
        confidence: 0,
        summary: "감성 분석 미설정 (OPENROUTER/Proxy 키 필요)",
        headlines: mergedTitles,
        items: mergedItems,
        fetchedAt: Date.now(),
        live: false,
      };
      await writeCache(slug, result);
      return result;
    }

    // 프록시 우선 (보안: 클라에 키 노출 안 됨)
    const result = PROXY_URL
      ? await classifyViaProxy(slug, mergedItems)
      : await classifyWithLLM(slug, mergedItems);
    // 큰 분위기 전환(bullish↔bearish) 감지 시 알림. neutral 경유는 신호로 안 침.
    // 신뢰도 낮은 결과는 노이즈로 간주(0.5 이상만).
    void notifyOnSentimentShift(slug, cached?.sentiment, result).catch((e) =>
      console.warn("[news shift]", e),
    );
    await writeCache(slug, result);
    return result;
  } catch (e) {
    console.warn("[news] failed", slug, e);
    return cached ? { ...cached, stale: true } : null;
  }
}

// ── Google News RSS → 헤드라인 + link 추출 ────────────
async function fetchHeadlines(
  query: string,
  hl: "ko" | "en" = "ko",
  gl: "KR" | "US" = "KR",
): Promise<NewsHeadline[]> {
  const locale = hl;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const xml = await res.text();
  const items: NewsHeadline[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const titleRe = /<title>(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?<\/title>/;
  const linkRe = /<link>([^<]+)<\/link>/;
  const srcRe = /<source[^>]*>([^<]+)<\/source>/;
  const descRe = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const tm = titleRe.exec(m[1]);
    if (!tm) continue;
    const title = decodeEntities(tm[1].trim());
    if (!title) continue;
    const lm = linkRe.exec(m[1]);
    const link = lm ? lm[1].trim() : undefined;
    const sm = srcRe.exec(m[1]);
    const source = sm ? decodeEntities(sm[1].trim()) : undefined;
    const dm = descRe.exec(m[1]);
    const description = dm
      ? decodeEntities(stripHtml(dm[1])).slice(0, 120) || undefined
      : undefined;
    items.push({ title, link, source, locale, description });
    if (items.length >= 10) break;
  }
  return items;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ── OpenRouter Gemini로 감성 분석 ─────────────────────
async function classifyWithLLM(
  category: string,
  items: NewsHeadline[],
): Promise<NewsResult> {
  const titles = items.map((x) => x.title);
  const newsLines = items
    .map((x, i) => {
      const desc = x.description ? ` — ${x.description}` : "";
      return `${i + 1}. ${x.title}${desc}`;
    })
    .join("\n");
  const prompt = `다음은 "${category}"에 대한 최근 한국·해외 뉴스입니다(한국어/영어 혼합). 제목과 요약을 함께 읽고, 한국 사용자가 사거나(또는 보유) 입장에서 가격이 오를 압력(bullish) / 내릴 압력(bearish) / 중립(neutral) 중 하나를 고르고, confidence(0.0~1.0)와 함께 핵심 흐름을 50자 이내 한국어로 요약하세요. confidence 기준: 기사 다수가 같은 방향이고 강한 시그널이면 0.8+, 혼재·모호하면 0.3~0.5, 거의 무관하면 0.1 미만.

뉴스:
${newsLines}

JSON만 출력: {"sentiment":"bullish|bearish|neutral","confidence":0.0~1.0,"summary":"..."}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "https://eolmalka.app",
      "X-Title": "eolmalka",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "당신은 한국 시세 분석가입니다. 정확한 JSON만 출력." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  let parsed: { sentiment?: string; confidence?: number; summary?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON 파싱 실패 시 텍스트에서 패턴 추출
    const sm = /(bullish|bearish|neutral)/i.exec(raw);
    const cm = /"?confidence"?\s*:\s*([0-9.]+)/i.exec(raw);
    parsed = {
      sentiment: sm?.[1]?.toLowerCase(),
      confidence: cm ? Number(cm[1]) : undefined,
      summary: raw.slice(0, 40),
    };
  }
  const sentiment: NewsSentiment =
    parsed.sentiment === "bullish" || parsed.sentiment === "bearish"
      ? parsed.sentiment
      : "neutral";
  const rawConf = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConf)
    ? Math.max(0, Math.min(1, rawConf))
    : 0.6;
  return {
    sentiment,
    confidence,
    summary: (parsed.summary ?? "").trim().slice(0, 60) || "최근 헤드라인 기반 분석",
    headlines: titles,
    items,
    fetchedAt: Date.now(),
    live: true,
  };
}

// ── 캐시 ──────────────────────────────────────────────
async function readCache(slug: string): Promise<NewsResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    return JSON.parse(raw) as NewsResult;
  } catch {
    return null;
  }
}

async function writeCache(slug: string, result: NewsResult): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(result));
  } catch {}
}

export async function clearNewsCache(slug: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${slug}`);
  } catch {}
}

// ── 프록시(Supabase Edge Function) 호출 ─────────────
async function classifyViaProxy(
  category: string,
  items: NewsHeadline[],
): Promise<NewsResult> {
  const titles = items.map((x) =>
    x.description ? `${x.title} — ${x.description}` : x.title,
  );
  const res = await fetch(PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, headlines: titles }),
  });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  const json = (await res.json()) as {
    sentiment?: string;
    confidence?: number;
    summary?: string;
    error?: string;
  };
  if (json.error) throw new Error(json.error);
  const sentiment: NewsSentiment =
    json.sentiment === "bullish" || json.sentiment === "bearish"
      ? json.sentiment
      : "neutral";
  const rawConf = Number(json.confidence);
  const confidence = Number.isFinite(rawConf)
    ? Math.max(0, Math.min(1, rawConf))
    : 0.6;
  return {
    sentiment,
    confidence,
    summary: (json.summary ?? "").trim().slice(0, 60) || "최근 헤드라인 기반 분석",
    headlines: titles,
    items,
    fetchedAt: Date.now(),
    live: true,
  };
}

// ── 분위기 전환 감지 + 알림 ──────────────────────────
async function notifyOnSentimentShift(
  slug: string,
  prev: NewsSentiment | undefined,
  next: NewsResult,
): Promise<void> {
  if (!prev || !next.live) return;
  // 큰 전환만: bullish ↔ bearish (neutral 경유는 평범)
  const flipped =
    (prev === "bullish" && next.sentiment === "bearish") ||
    (prev === "bearish" && next.sentiment === "bullish");
  if (!flipped) return;
  if ((next.confidence ?? 0) < 0.5) return; // 신뢰도 낮으면 무시
  if (await isInCooldown(slug, "signal")) return;

  const meta = metaFor(slug);
  if (!meta) return;
  const dir = next.sentiment === "bullish" ? "📈 상승" : "📉 하락";
  await scheduleLocalAlert({
    title: `${dir} 분위기 전환 · ${meta.name}`,
    body: next.summary,
    data: { slug, source: "sentiment-shift" },
    kind: "signal",
  });
  await markNotified(slug, "signal");
}

export const SENTIMENT_STYLE: Record<
  NewsSentiment,
  { color: string; label: string; emoji: string }
> = {
  bullish: { color: "#fb7185", label: "상승 압력", emoji: "📈" },
  bearish: { color: "#a3e635", label: "하락 압력", emoji: "📉" },
  neutral: { color: "#a1a1aa", label: "중립", emoji: "📊" },
};
