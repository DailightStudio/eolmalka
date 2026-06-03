// Google News RSS (무키) → 헤드라인 5개 → OpenRouter Gemini로 감성 분석.
// AsyncStorage 1시간 캐싱.
//
// 보안 트레이드오프: EXPO_PUBLIC_OPENROUTER_KEY가 클라이언트 번들에 박힘 → 디컴파일 노출 가능.
// 데모 단계. 운영 전 server-agent 또는 Supabase Edge Function 프록시로 이관 필요.

import AsyncStorage from "@react-native-async-storage/async-storage";

const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
const MODEL = "google/gemini-2.5-flash";
const CACHE_PREFIX = "eolmalka:news:v1:";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

export type NewsSentiment = "bullish" | "bearish" | "neutral";

export type NewsResult = {
  sentiment: NewsSentiment;
  summary: string;       // 한 줄 한국어 요약 (40자 이내)
  headlines: string[];   // 사용한 헤드라인 (출처 표시용)
  fetchedAt: number;
  live: boolean;         // 실 LLM 호출이었는지(키 있고 성공) / 더미인지
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
  "gold-kr":    { ko: "금 시세 한국",         en: "gold price LBMA Fed inflation" },
  "air-nrt":    { ko: "도쿄 항공권 가격",     en: "Japan tourism airfare" },
  "air-tpe":    { ko: "타이베이 항공권 가격", en: "Taiwan tourism airfare" },
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
        : Promise.resolve<string[]>([]),
    ]);
    // 중복 제거하면서 ko 4개 + en 4개 우선 (밸런스)
    const merged: string[] = [];
    const seen = new Set<string>();
    const take = (arr: string[], n: number) => {
      for (const h of arr) {
        if (merged.length >= 8) break;
        const key = h.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(h);
          if (--n <= 0) break;
        }
      }
    };
    take(koHeads, 4);
    take(enHeads, 4);
    // 부족하면 채움
    take(koHeads, 8);
    take(enHeads, 8);

    if (merged.length === 0) return cached ?? null;

    if (!OPENROUTER_KEY) {
      const result: NewsResult = {
        sentiment: "neutral",
        summary: "감성 분석 미설정 (OPENROUTER 키 필요)",
        headlines: merged,
        fetchedAt: Date.now(),
        live: false,
      };
      await writeCache(slug, result);
      return result;
    }

    const result = await classifyWithLLM(slug, merged);
    await writeCache(slug, result);
    return result;
  } catch (e) {
    console.warn("[news] failed", slug, e);
    return cached ?? null;
  }
}

// ── Google News RSS → 헤드라인 추출 ───────────────────
async function fetchHeadlines(
  query: string,
  hl: "ko" | "en" = "ko",
  gl: "KR" | "US" = "KR",
): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const xml = await res.text();
  const titles: string[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const titleRe = /<title>(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?<\/title>/;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const tm = titleRe.exec(m[1]);
    if (tm) {
      const t = decodeEntities(tm[1].trim());
      if (t) titles.push(t);
    }
    if (titles.length >= 10) break;
  }
  return titles;
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
  headlines: string[],
): Promise<NewsResult> {
  const prompt = `다음은 "${category}"에 대한 최근 한국·해외 뉴스 헤드라인입니다(한국어/영어 혼합). 한국 사용자가 사거나(또는 보유) 입장에서 가격이 오를 압력(bullish) / 내릴 압력(bearish) / 중립(neutral) 중 하나를 고르고, 핵심 흐름을 50자 이내 한국어로 요약하세요. 영어 헤드라인의 핵심도 한국어로 요약에 포함.

헤드라인:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

JSON만 출력: {"sentiment":"bullish|bearish|neutral","summary":"..."}`;

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
  let parsed: { sentiment?: string; summary?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON 파싱 실패 시 텍스트에서 패턴 추출
    const sm = /(bullish|bearish|neutral)/i.exec(raw);
    parsed = { sentiment: sm?.[1]?.toLowerCase(), summary: raw.slice(0, 40) };
  }
  const sentiment: NewsSentiment =
    parsed.sentiment === "bullish" || parsed.sentiment === "bearish"
      ? parsed.sentiment
      : "neutral";
  return {
    sentiment,
    summary: (parsed.summary ?? "").trim().slice(0, 60) || "최근 헤드라인 기반 분석",
    headlines,
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

export const SENTIMENT_STYLE: Record<
  NewsSentiment,
  { color: string; label: string; emoji: string }
> = {
  bullish: { color: "#fb7185", label: "상승 압력", emoji: "📈" },
  bearish: { color: "#a3e635", label: "하락 압력", emoji: "📉" },
  neutral: { color: "#a1a1aa", label: "중립", emoji: "📊" },
};
