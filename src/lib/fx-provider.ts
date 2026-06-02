// 환율 데이터 제공자 — dd-trip/apps/api/src/fx/fx.provider.ts 포팅(Next.js 환경).
// 우선순위: Twelve Data(키 있을 때) → Frankfurter(무키·ECB) → 합성 폴백.
// `live` = 실데이터 fetch 성공 여부 (키 유무가 아님).

export type FxBase = "USD" | "JPY" | "EUR" | "CNY";
export type FxSource = "twelvedata" | "frankfurter" | "synthetic";

export type FxPoint = {
  date: string; // YYYY-MM-DD
  value: number;
};

export type FxSeriesResult = {
  base: FxBase;
  past: FxPoint[];
  source: FxSource;
  live: boolean;
};

// Frankfurter: 구 api.frankfurter.app → api.frankfurter.dev/v1 로 이전됨.
const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;
const FX_OFFLINE = process.env.FX_OFFLINE === "1";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getFxSeries(
  base: FxBase,
  days: number,
): Promise<FxSeriesResult> {
  if (!FX_OFFLINE && TWELVE_DATA_KEY) {
    try {
      const past = await fetchTwelveData(base, days);
      if (past.length > 5) return { base, past, source: "twelvedata", live: true };
    } catch {
      // 다음 소스로 폴백
    }
  }
  if (!FX_OFFLINE) {
    try {
      const past = await fetchFrankfurter(base, days);
      if (past.length > 5) return { base, past, source: "frankfurter", live: true };
    } catch {
      // 합성으로 폴백
    }
  }
  return { base, past: synthetic(base, days), source: "synthetic", live: false };
}

// ── Frankfurter ─────────────────────────────────────────
async function fetchFrankfurter(base: FxBase, days: number): Promise<FxPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const url = `${FRANKFURTER_BASE}/${ymd(start)}..${ymd(end)}?from=${base}&to=KRW`;
  // Next.js 캐시: 시간당 1회 재호출(환율은 일 단위 갱신이라 충분)
  const res = await fetch(url, { next: { revalidate: 3600 } });
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
  const res = await fetch(url, { next: { revalidate: 3600 } });
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
  const center = base === "USD" ? 1376 : base === "JPY" ? 894 : 1500;
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
