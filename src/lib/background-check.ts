import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { getSeries } from "./demo-series";
import { computeStats, metaFor } from "./signals";
import { isInCooldown, loadFavs, loadTargets, markNotified } from "./storage";
import { scheduleLocalAlert } from "./notifications";

const TASK_NAME = "eolmalka-price-check-v1";

// 백그라운드 태스크: 즐겨찾기 카테고리만 fetch → 목표가 도달 또는 신호 'buy'면 알림
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const [favs, targets] = await Promise.all([loadFavs(), loadTargets()]);
    if (favs.size === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    let fired = 0;
    for (const slug of favs) {
      const meta = metaFor(slug);
      if (!meta) continue;
      const series = await getSeries(slug);
      const stats = computeStats(series);
      const target = targets[slug];

      // 1) 사용자 목표가 도달 — 6h 쿨다운
      if (target != null && stats.current <= target) {
        if (await isInCooldown(slug, "target")) continue;
        await scheduleLocalAlert({
          title: `🎯 ${meta.name} 목표가 도달`,
          body: `${stats.current.toLocaleString()}${meta.unit} (목표 ${target.toLocaleString()}${meta.unit})`,
          data: { slug },
        });
        await markNotified(slug, "target");
        fired++;
        continue;
      }

      // 2) 통계 신호 buy + great_deal — 24h 쿨다운
      if (stats.signal === "buy" && stats.verdict === "great_deal") {
        if (await isInCooldown(slug, "signal")) continue;
        await scheduleLocalAlert({
          title: `📉 ${meta.name} 저점권`,
          body: `${stats.current.toLocaleString()}${meta.unit} · ${stats.signalText}`,
          data: { slug },
        });
        await markNotified(slug, "signal");
        fired++;
      }
    }

    return fired > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    console.warn("[background-check] error", e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundCheck(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (registered) return;
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 60, // 1시간 (iOS는 OS가 조정)
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn("[background-check] register failed", e);
  }
}

export async function unregisterBackgroundCheck(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (registered) await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch {
    // 무시
  }
}
