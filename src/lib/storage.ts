import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVS = "eolmalka:favs:v1";
const SORT = "eolmalka:sort:v1";
const TARGETS = "eolmalka:targets:v1";
const NOTIFY_LOG = "eolmalka:notifylog:v1";
const USER_CATS = "eolmalka:userCats:v1";
const SIGNAL_MODE = "eolmalka:signalMode:v1";

export type SortMode = "default" | "signal" | "change";
export type SignalMode = "conservative" | "default" | "aggressive";
export type Targets = Record<string, number | null>;
// kind: 'target' = 사용자 목표가 도달, 'signal' = 통계 신호 buy
// epoch ms 마지막 발송 시각
export type NotifyLog = Record<string, { target?: number; signal?: number }>;

export async function loadFavs(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FAVS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function saveFavs(favs: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(FAVS, JSON.stringify([...favs]));
  } catch {
    // 무시
  }
}

export async function loadSort(): Promise<SortMode> {
  try {
    const raw = await AsyncStorage.getItem(SORT);
    if (raw === "signal" || raw === "change" || raw === "default") return raw;
  } catch {}
  return "default";
}

export async function saveSort(m: SortMode): Promise<void> {
  try {
    await AsyncStorage.setItem(SORT, m);
  } catch {}
}

export async function loadSignalMode(): Promise<SignalMode> {
  try {
    const raw = await AsyncStorage.getItem(SIGNAL_MODE);
    if (raw === "conservative" || raw === "aggressive" || raw === "default") return raw;
  } catch {}
  return "default";
}

export async function saveSignalMode(m: SignalMode): Promise<void> {
  try {
    await AsyncStorage.setItem(SIGNAL_MODE, m);
  } catch {}
}

export async function loadTargets(): Promise<Targets> {
  try {
    const raw = await AsyncStorage.getItem(TARGETS);
    if (!raw) return {};
    return JSON.parse(raw) as Targets;
  } catch {
    return {};
  }
}

export async function saveTargets(t: Targets): Promise<void> {
  try {
    await AsyncStorage.setItem(TARGETS, JSON.stringify(t));
  } catch {}
}

export async function setTarget(slug: string, value: number | null): Promise<Targets> {
  const t = await loadTargets();
  if (value === null) delete t[slug];
  else t[slug] = value;
  await saveTargets(t);
  return t;
}

// ── 알림 발송 이력 (쿨다운용) ─────────────────────────
export async function loadNotifyLog(): Promise<NotifyLog> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFY_LOG);
    if (!raw) return {};
    return JSON.parse(raw) as NotifyLog;
  } catch {
    return {};
  }
}

async function saveNotifyLog(log: NotifyLog): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFY_LOG, JSON.stringify(log));
  } catch {}
}

export async function markNotified(
  slug: string,
  kind: "target" | "signal",
): Promise<void> {
  const log = await loadNotifyLog();
  log[slug] = { ...(log[slug] ?? {}), [kind]: Date.now() };
  await saveNotifyLog(log);
}

// 쿨다운 검사: target 6h, signal 24h
const COOLDOWN_MS = {
  target: 6 * 60 * 60 * 1000,
  signal: 24 * 60 * 60 * 1000,
};

export async function isInCooldown(
  slug: string,
  kind: "target" | "signal",
): Promise<boolean> {
  const log = await loadNotifyLog();
  const last = log[slug]?.[kind];
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS[kind];
}

// ── 사용자 정의 카테고리 (현재는 환율 base만) ─────────
// 저장 형식: ["AUD", "SGD"] — 시스템 기본(USD/JPY/EUR/CNY) 제외한 추가 통화 코드
export async function loadUserCategories(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_CATS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return arr.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

export async function addUserCategory(base: string): Promise<string[]> {
  const list = await loadUserCategories();
  const code = base.includes("-") ? base : base.toUpperCase();
  if (!list.includes(code)) list.push(code);
  try {
    await AsyncStorage.setItem(USER_CATS, JSON.stringify(list));
  } catch {}
  return list;
}

export async function removeUserCategory(base: string): Promise<string[]> {
  const list = await loadUserCategories();
  const code = base.includes("-") ? base : base.toUpperCase();
  const next = list.filter((c) => c !== code);
  try {
    await AsyncStorage.setItem(USER_CATS, JSON.stringify(next));
  } catch {}
  return next;
}

const ONBOARDING_DONE = "eolmalka:onboarding:v1";

export async function loadOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_DONE)) === "1";
  } catch {
    return false;
  }
}

export async function saveOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE, "1");
  } catch {}
}
