import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Point } from "./demo-series";

// 카테고리별 일별 가격 누적 저장소.
// 백그라운드 fetch(또는 앱 진입)마다 appendDaily 호출 → 한 달 누적되면
// 합성 시계열 꼬리를 실 데이터로 점진적 치환 → 분위수·MA 정확도 점진 향상.
// 365일 초과는 오래된 것부터 트림.

const PREFIX = "eolmalka:dailyseries:v1:";
const MAX_DAYS = 365;

function key(slug: string): string {
  return `${PREFIX}${slug}`;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export async function loadDailySeries(slug: string): Promise<Point[]> {
  try {
    const raw = await AsyncStorage.getItem(key(slug));
    if (!raw) return [];
    const arr = JSON.parse(raw) as Point[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((p) => p && typeof p.date === "string" && Number.isFinite(p.value));
  } catch {
    return [];
  }
}

export async function appendDaily(slug: string, value: number, when: Date = new Date()): Promise<Point[]> {
  if (!Number.isFinite(value) || value <= 0) return loadDailySeries(slug);
  const today = ymd(when);
  const list = await loadDailySeries(slug);
  const lastIdx = list.findIndex((p) => p.date === today);
  if (lastIdx >= 0) {
    list[lastIdx] = { date: today, value };
  } else {
    list.push({ date: today, value });
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = list.length > MAX_DAYS ? list.slice(-MAX_DAYS) : list;
  try {
    await AsyncStorage.setItem(key(slug), JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

// 합성 시계열 + 누적된 실 데이터 병합:
// - 누적 일자 부분만 실 데이터로 치환 (날짜 매칭)
// - 누적 없는 날짜는 합성 그대로 유지
// 결과: 시간이 갈수록 차트 꼬리(=최근 구간)가 실 데이터로 메꿔짐.
export function mergeWithDaily(synthetic: Point[], daily: Point[]): {
  merged: Point[];
  liveDays: number;
} {
  if (daily.length === 0) return { merged: synthetic, liveDays: 0 };
  const map = new Map(daily.map((p) => [p.date, p.value]));
  let liveDays = 0;
  const merged = synthetic.map((p) => {
    const live = map.get(p.date);
    if (live != null) {
      liveDays++;
      return { date: p.date, value: live };
    }
    return p;
  });
  // 합성 마지막 날짜보다 뒤의 실 데이터도 있을 수 있음(앱 안 열고 며칠 지난 경우 신규 일자)
  const lastSynDate = synthetic[synthetic.length - 1]?.date;
  if (lastSynDate) {
    for (const p of daily) {
      if (p.date > lastSynDate) {
        merged.push(p);
        liveDays++;
      }
    }
  }
  return { merged, liveDays };
}

export async function clearDailySeries(slug: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(slug));
  } catch {}
}

// 백필용: 여러 일자 한 번에 저장 (날짜별 dedup, 최신값 우선).
// appendDaily를 N번 부르면 매번 직렬화/역직렬화 → bulk로 한 번에.
export async function bulkAppendDaily(slug: string, points: Point[]): Promise<Point[]> {
  if (points.length === 0) return loadDailySeries(slug);
  const list = await loadDailySeries(slug);
  const map = new Map(list.map((p) => [p.date, p.value] as const));
  for (const p of points) {
    if (!p || typeof p.date !== "string" || !Number.isFinite(p.value) || p.value <= 0) continue;
    map.set(p.date, p.value);
  }
  const merged: Point[] = Array.from(map, ([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = merged.length > MAX_DAYS ? merged.slice(-MAX_DAYS) : merged;
  try {
    await AsyncStorage.setItem(key(slug), JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}
