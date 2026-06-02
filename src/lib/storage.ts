import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVS = "eolmalka:favs:v1";
const SORT = "eolmalka:sort:v1";
const TARGETS = "eolmalka:targets:v1";

export type SortMode = "default" | "signal" | "change";
export type Targets = Record<string, number | null>;

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
