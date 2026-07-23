// App Store 배포 지역을 한국(KOR) 단독으로 설정한다.
// 앱 UI가 한국어 전용(i18n 없음, 하드코딩 한글 31개)이라 해외 배포 시
// 영어 스토어 설명과 실제 앱이 불일치한다 — 그래서 한국만 연다.
//
// 되돌리려면 ASC 웹 또는 이 스크립트를 고쳐 원하는 지역을 켜면 된다.
//   node scripts/asc-territories-korea-only.mjs [--dry]
import { asc } from "./asc.mjs";

const APP_ID = "6782645385";
const OPEN = new Set(["KOR"]); // 열어둘 지역
const dry = process.argv.includes("--dry");

// 전체 지역 목록 (페이지네이션)
const territories = [];
let next = "/v1/territories?limit=200";
while (next) {
  const page = await asc(next);
  territories.push(...page.data.map((t) => t.id));
  const link = page.links?.next;
  next = link ? link.replace("https://api.appstoreconnect.apple.com", "") : null;
}
console.log(`전체 지역 ${territories.length}개, 열 지역 ${[...OPEN].join(",")}`);

if (dry) {
  console.log("--dry — 전송하지 않음");
  process.exit(0);
}

// API 는 모든 지역의 available 값을 한 번에 요구한다.
const data = territories.map((id) => ({ type: "territoryAvailabilities", id: `\${t${id}}` }));
const included = territories.map((id) => ({
  type: "territoryAvailabilities",
  id: `\${t${id}}`,
  attributes: { available: OPEN.has(id) },
  relationships: { territory: { data: { type: "territories", id } } },
}));

const res = await asc("/v2/appAvailabilities", "POST", {
  data: {
    type: "appAvailabilities",
    attributes: { availableInNewTerritories: false }, // 새 지역 자동 추가 안 함
    relationships: {
      app: { data: { type: "apps", id: APP_ID } },
      territoryAvailabilities: { data },
    },
  },
  included,
});

console.log("✔ 배포 지역 설정됨:", res.data.id);

// 검증
const check = await asc(
  `/v2/appAvailabilities/${res.data.id}/territoryAvailabilities?limit=200`
);
const on = check.data.filter((t) => t.attributes.available);
console.log(`  판매 가능 지역: ${on.length}개`);
