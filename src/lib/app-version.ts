import Constants from "expo-constants";
import * as Updates from "expo-updates";

export function appVersionLabel(): string {
  let version = "?";
  let tag = "base";

  try {
    version = Constants.expoConfig?.version ?? "?";
  } catch {}

  try {
    if (__DEV__) {
      tag = "dev";
    } else if (Updates.isEmbeddedLaunch) {
      tag = "base";
    } else if (Updates.updateId) {
      tag = Updates.updateId.slice(0, 8);
    } else {
      tag = "base";
    }
  } catch {
    tag = "base";
  }

  return `v${version} · ${tag}`;
}
