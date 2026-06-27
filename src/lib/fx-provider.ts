import { getCachedEnvelope, setCached } from "./cache";
import { cachedFetch } from "./fetch-cache";

// 환율 데이터 제공자 — dd-trip fx.provider.ts 포팅.
// 우선순위: Twelve Data(키 있을 때) → Frankfurter(무키·ECB) → 합성 폴백.
// 시계열 확보 후, 최신 1포인트만 다음 금융(Daum)의 실시간 매매기준율로 덮어쓴다.
//   (Frankfurter는 ECB 일별 기준환율이라 네이버/다음이 보여주는 시장 매매기준율과 살짝 다름)
// `live` = 실데이터 fetch 성공 여부 (키 유무가 아님).
// Expo: process.env.EXPO_PUBLIC_* 만 클라이언트 번들에 박힌다.

// Frankfurter가 지원하는 어떤 base든 OK — 타입은 string으로 완화.
// 100엔 단위 스케일링은 JPY에만 적용.
export type FxBase = string;
export type FxSource = "twelvedata" | "frankfurter" | "daum" | "synthetic";

export type FxPoint = {
  date: string; // YYYY-MM-DD
  value: number;
};

export type FxSeriesResult = {
  base: FxBase;
  past: FxPoint[];
  source: FxSource;
  live: boolean;
  fetchedAt?: number; // 실데이터 fetch 성공 시각(ms). 오프라인 fallback이면 캐시 기록 시각.
};

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";
const TWELVE_DATA_KEY = process.env.EXPO_PUBLIC_TWELVE_DATA_KEY;
const FX_OFFLINE = process.env.EXPO_PUBLIC_FX_OFFLINE === "1";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getFxSeries(base: FxBase, days: number): Promise<FxSeriesResult> {
  // 실시간 매매기준율 반영 위해 15분 TTL
  return cachedFetch(`fx:${base}:${days}`, () => fetchFxSeriesUncached(base, days), 15 * 60 * 1000);
}

async function fetchFxSeriesUncached(
  base: FxBase,
  days: number,
): Promise<FxSeriesResult> {
  const cacheKey = `cache:fx:${base}:${days}`;
  if (!FX_OFFLINE && TWELVE_DATA_KEY) {
    try {
      const past = await fetchTwelveData(base, days);
      if (past.length > 5) {
        const result: FxSeriesResult = {
          base,
          past,
          source: "twelvedata",
          live: true,
          fetchedAt: Date.now(),
        };
        await applyLiveOverride(result);
        await setCached(cacheKey, result);
        return result;
      }
    } catch {
      // 다음 소스로 폴백
    }
  }
  if (!FX_OFFLINE) {
    try {
      const past = await fetchFrankfurter(base, days);
      if (past.length > 5) {
        const result: FxSeriesResult = {
          base,
          past,
          source: "frankfurter",
          live: true,
          fetchedAt: Date.now(),
        };
        await applyLiveOverride(result);
        await setCached(cacheKey, result);
        return result;
      }
    } catch {
      // 오프라인 캐시 → 합성으로 폴백
    }
  }
  // Frankfurter 미지원 통화(예: VND) — 다음 금융 /days 차트로 전체 시계열 확보.
  // /days는 오늘 매매기준율까지 포함하므로 applyLiveOverride(2차 호출) 불필요.
  if (!FX_OFFLINE) {
    try {
      const past = await fetchDaumSeries(base, days);
      if (past.length > 5) {
        const result: FxSeriesResult = {
          base,
          past,
          source: "daum",
          live: true,
          fetchedAt: Date.now(),
        };
        await setCached(cacheKey, result);
        return result;
      }
    } catch {
      // 오프라인 캐시 → 합성으로 폴백
    }
  }
  // 네트워크 실패 시 마지막 성공 데이터(영구 캐시) 사용 — 신선도는 캐시 기록 시각.
  if (!FX_OFFLINE) {
    const cached = await getCachedEnvelope<FxSeriesResult>(cacheKey);
    if (cached && cached.data.past.length > 5) {
      return { ...cached.data, live: false, fetchedAt: cached.ts };
    }
  }
  return { base, past: synthetic(base, days), source: "synthetic", live: false };
}

// ── 실시간 매매기준율 덮어쓰기 (다음 금융) ───────────────
// 시계열(과거)은 그대로 두고, 최신 1포인트만 실시간 값으로 교체한다.
// 실패하면 기존 시계열을 손대지 않는다(비공식 엔드포인트라 견고한 폴백 보장).
async function applyLiveOverride(result: FxSeriesResult): Promise<FxSeriesResult> {
  if (FX_OFFLINE) return result;
  const live = await fetchDaumLiveRate(result.base);
  if (live == null) return result; // 실패 → 기존 시계열 유지
  const todayStr = ymd(new Date());
  const last = result.past[result.past.length - 1];
  if (last && last.date === todayStr) {
    last.value = live; // 오늘 포인트가 이미 있으면 값만 갱신
  } else {
    // 오늘 ≥ 마지막 날짜이므로 날짜 정렬은 유지된다.
    result.past.push({ date: todayStr, value: live });
  }
  result.source = "daum";
  result.fetchedAt = Date.now();
  return result;
}

// 다음 금융 실시간 매매기준율. basePrice를 그대로 사용(표시 단위 일치).
// JPY는 100엔 단위(한국 관행)라 앱 단위와 동일 → 별도 스케일링 없음.
// referer + User-Agent 없으면 403 → 비공식 엔드포인트. 어떤 실패든 null 반환(throw 없음).
async function fetchDaumLiveRate(base: FxBase): Promise<number | null> {
  try {
    const url = `https://finance.daum.net/api/exchanges/FRX.KRW${base}`;
    const res = await fetch(url, {
      headers: {
        referer: "https://finance.daum.net/exchanges",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { basePrice?: number };
    const v = Number(json.basePrice);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

// 다음 금융 /days 차트 — Frankfurter 미지원 통화(예: VND)의 전체 시계열 확보용.
// 응답은 최신순(newest first)이라 오름차순 정렬한다. 실패하면 throw → 호출부가 폴백.
async function fetchDaumSeries(base: FxBase, days: number): Promise<FxPoint[]> {
  const perPage = Math.max(7, days + 5);
  const url =
    `https://finance.daum.net/api/exchanges/FRX.KRW${base}/days` +
    `?perPage=${perPage}&page=1&pagination=false`;
  const res = await fetch(url, {
    headers: {
      referer: `https://finance.daum.net/exchanges/FRX.KRW${base}`,
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!res.ok) throw new Error(`Daum days HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { date?: string; basePrice?: number }[];
  };
  const rows = json.data ?? [];
  return rows
    .map((row) => {
      const date = String(row.date).slice(0, 10);
      let value = Number(row.basePrice);
      // VND는 basePrice가 100동 단위(예: 5.87 ≈ 100×0.0587) → 앱 단위(1동)로 변환.
      if (base === "VND") value = value / 100;
      return { date, value };
    })
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Frankfurter ─────────────────────────────────────────
async function fetchFrankfurter(base: FxBase, days: number): Promise<FxPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const url = `${FRANKFURTER_BASE}/${ymd(start)}..${ymd(end)}?from=${base}&to=KRW`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const json = (await res.json()) as {
    rates?: Record<string, { KRW?: number }>;
  };
  const rates = json.rates ?? {};
  // JPY는 일반적으로 1엔 단위 → 100엔 단위로 변환(한국 관행)
  const scale = base === "JPY" ? 100 : 1;
  return Object.entries(rates)
    .map(([d, r]) => ({ date: d, value: Number(r?.KRW) * scale }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Twelve Data (옵션) ──────────────────────────────────
async function fetchTwelveData(base: FxBase, days: number): Promise<FxPoint[]> {
  const symbol = `${base}/KRW`;
  const size = Math.max(1, days + 1);
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
    `&interval=1day&outputsize=${size}&apikey=${TWELVE_DATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const json = (await res.json()) as {
    values?: { datetime: string; close: string }[];
    status?: string;
    message?: string;
  };
  if (!json.values) throw new Error(json.message ?? json.status ?? "no values");
  const scale = base === "JPY" ? 100 : 1;
  return json.values
    .map((v) => ({ date: v.datetime.slice(0, 10), value: Number(v.close) * scale }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── 합성 폴백 (네트워크 차단·테스트 결정성) ──────────────
function synthetic(base: FxBase, days: number): FxPoint[] {
  // 합성용 대략적 중심값 (실데이터 실패 시 폴백)
  const CENTERS: Record<string, number> = {
    USD: 1376, JPY: 894, EUR: 1480, CNY: 191,
    GBP: 1740, AUD: 905, NZD: 830, CAD: 1010,
    CHF: 1530, HKD: 175, SGD: 1020, THB: 41,
    VND: 0.055, INR: 16.5, TRY: 39, MXN: 70, PHP: 24,
  };
  const center = CENTERS[base] ?? 1000;
  const out: FxPoint[] = [];
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const at = now - i * DAY_MS;
    const wave = Math.sin((i / 60) * Math.PI * 2) * (center * 0.03);
    const trend = (days - i) * (center * 0.00005);
    out.push({
      date: ymd(new Date(at)),
      value: Math.round((center + wave - trend) * 100) / 100,
    });
  }
  return out;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
