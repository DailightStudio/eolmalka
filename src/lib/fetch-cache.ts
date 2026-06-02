// 모듈 레벨 in-memory 캐시. 같은 앱 세션 동안 동일 키 재사용.
// API 호출이 무거운 KRX 365일·Frankfurter·CoinGecko 등에 적용.
// 1h TTL (환율·시세는 일별 갱신이라 충분).

type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value;
}

export function setCached<T>(key: string, value: T, ttlMs = 60 * 60 * 1000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// 같은 키가 들어오면 한 번만 fetch — 중복 호출 합치기(thundering herd 방지).
const inflight = new Map<string, Promise<unknown>>();

export async function cachedFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 60 * 60 * 1000,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      const v = await loader();
      setCached(key, v, ttlMs);
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
