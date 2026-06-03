// 인앱 리뷰 요청 — expo-store-review.
// 첫 실행 후 일정 기간(3일) 지난 사용자에게 1회만 시스템 리뷰 다이얼로그를 띄운다.
// OS가 빈도를 제한하므로 requestReview가 실제로 표시될지는 보장되지 않는다.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const FIRST_OPEN = "eolmalka:first_open:v1";
const REVIEW_ASKED = "eolmalka:review_asked:v1";

const MIN_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function maybeRequestReview(): Promise<void> {
  try {
    // 첫 실행 시각 기록 (없을 때만)
    let firstOpen = await AsyncStorage.getItem(FIRST_OPEN);
    if (!firstOpen) {
      firstOpen = String(Date.now());
      await AsyncStorage.setItem(FIRST_OPEN, firstOpen);
    }

    // 이미 요청했으면 종료
    const asked = await AsyncStorage.getItem(REVIEW_ASKED);
    if (asked) return;

    // 첫 실행 후 3일 미만이면 대기
    const elapsed = Date.now() - Number(firstOpen);
    if (!Number.isFinite(elapsed) || elapsed < MIN_DAYS * DAY_MS) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_ASKED, "1");
  } catch {
    // 무시
  }
}
