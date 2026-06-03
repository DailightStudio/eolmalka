// 오프라인 캐시 — AsyncStorage에 마지막 fetch 성공 데이터를 영구 저장.
// fetch-cache.ts(in-memory, 세션 한정)와 별개: 앱 재시작·오프라인에도 살아남는다.
// 저장 형식: { data, ts }. ts는 캐시 기록 시각(ms) — 데이터 신선도 표시에 사용.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type CacheEnvelope<T> = { data: T; ts: number };

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    return env.data ?? null;
  } catch {
    return null;
  }
}

// 데이터와 함께 캐시 기록 시각(ts)도 돌려준다 (오프라인 fallback 시 신선도 계산용).
export async function getCachedEnvelope<T>(
  key: string,
): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const env: CacheEnvelope<T> = { data, ts: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(env));
  } catch {
    // 무시
  }
}

// 데이터 신선도 라벨. fetchedAt(ms) 기준 "방금/X분 전/Xh 전".
// offline=true(오프라인 캐시 fallback)면 "오프라인 (...)" 접두.
export type FreshnessInfo = { text: string; offline: boolean };

export function freshnessLabel(
  fetchedAt: number | undefined,
  offline: boolean,
): FreshnessInfo | null {
  if (!fetchedAt || !Number.isFinite(fetchedAt)) return null;
  const diff = Date.now() - fetchedAt;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const ago = diff < 60000 ? "방금" : hr < 1 ? `${min}분 전` : `${hr}h 전`;
  return {
    text: offline ? `오프라인 (${ago})` : `${ago} 업데이트`,
    offline,
  };
}
