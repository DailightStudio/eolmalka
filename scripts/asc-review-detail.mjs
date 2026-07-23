// 앱 심사 연락처(App Review Information) 생성/갱신.
// 전화번호는 개발자 실제 번호라 코드에 넣지 않는다 — 인자로 받는다.
//
//   node scripts/asc-review-detail.mjs "+82 10-1234-5678"
//
// 형식: '+' + 국가코드로 시작해야 Apple 이 받는다(예: +82 10 1234 5678).
import { asc } from "./asc.mjs";

const VERSION_ID = "cddd4916-4348-48a8-afe7-1d12960f2a99"; // 1.0

const phone = process.argv[2];
if (!phone) {
  console.error('사용법: node scripts/asc-review-detail.mjs "+82 10-1234-5678"');
  process.exit(1);
}
if (!phone.startsWith("+")) {
  console.error("전화번호는 '+' 와 국가코드로 시작해야 한다. 예: +82 10-1234-5678");
  process.exit(1);
}

const attributes = {
  contactFirstName: "Jinho",
  contactLastName: "Seo",
  contactEmail: "wjs9280@gmail.com",
  contactPhone: phone,
  demoAccountRequired: false, // 로그인 자체가 없는 앱
  notes:
    "No account or login is required to use any feature. All prices come from public sources: " +
    "ECB reference rates via Frankfurter (FX), Opinet (Korean fuel prices), CoinGecko (gold). " +
    "Notifications are local and opt-in.",
};

// 이미 있으면 PATCH, 없으면 POST.
let existing = null;
try {
  const res = await asc(`/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
  existing = res?.data?.id ?? null;
} catch {
  /* 미생성 — POST 로 간다 */
}

if (existing) {
  await asc(`/v1/appStoreReviewDetails/${existing}`, "PATCH", {
    data: { type: "appStoreReviewDetails", id: existing, attributes },
  });
  console.log("✔ 심사 연락처 갱신됨:", existing);
} else {
  const res = await asc("/v1/appStoreReviewDetails", "POST", {
    data: {
      type: "appStoreReviewDetails",
      attributes,
      relationships: {
        appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
      },
    },
  });
  console.log("✔ 심사 연락처 생성됨:", res.data.id);
}
