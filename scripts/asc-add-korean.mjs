// 한국어(ko) 로컬라이제이션 추가.
// 기존에는 en-US 하나뿐이라 한국 사용자에게도 영어 설명이 노출됐다.
// 재실행 안전 — 이미 있으면 PATCH.
import { asc } from "./asc.mjs";

const VERSION_ID = "cddd4916-4348-48a8-afe7-1d12960f2a99";
const APPINFO_ID = "027fb439-d2b9-4c49-b3f4-fc0386f80dd2";
const LOCALE = "ko";

const SUPPORT_URL = "https://dailightstudio.github.io/eolmalka-pages/";
const PRIVACY_URL = "https://dailightstudio.github.io/eolmalka-pages/privacy.html";

// 영어판과 같은 내용. 실제 기능만 적는다 — 항공권은 아직 합성 데이터라 제외.
const DESCRIPTION = `지금 살까, 기다릴까?

얼말까는 환율·기름값·금 시세를 한 화면에 모아 보여주고, 그 숫자가 실제로 무슨 말을 하는지 알려줍니다.

이런 걸 할 수 있어요

• 과거·현재·예측을 한눈에. 최근 흐름 스파크라인, 지금 가격, 단기 예측까지. 차트 볼 줄 몰라도 됩니다.

• 답이 한 줄로 나옵니다. 항목마다 "지금 사세요" 또는 "기다리세요" 신호가 붙습니다. 전문용어도, 맞춰야 할 대시보드도 없습니다.

• 목표가 알림. 원하는 가격을 정해두면 도달했을 때 알려드립니다. 백그라운드로 확인하니 앱을 열어둘 필요가 없습니다.

• 뉴스 분위기. 최근 헤드라인을 상승·하락으로 요약하고, 분위기가 뒤집히면 알려줍니다.

• 즐겨찾기와 정렬은 다음에 켜도 그대로 남아 있습니다.

무엇을 볼 수 있나요

- 환율: 달러·엔·유로·위안 대비 원화 (유럽중앙은행 기준환율)
- 기름값: 전국 평균 주유소 가격
- 금: 국제 현물 시세

즐겨찾기·목표가·알림 설정은 기기에 저장됩니다.`;

const KEYWORDS = "환율,달러,엔화,유로,위안,원화,금시세,기름값,휘발유,유가,목표가,알림,시세,예측";
const SUBTITLE = "지금 살까, 기다릴까?";
const NAME = "얼말까";

async function upsert(kind, listPath, createType, parentRel, parentId, attributes) {
  const list = await asc(listPath);
  const found = list.data.find((x) => x.attributes.locale === LOCALE);
  if (found) {
    await asc(`/v1/${createType}/${found.id}`, "PATCH", {
      data: { type: createType, id: found.id, attributes },
    });
    console.log(`✔ ${kind} ko 갱신 (${found.id})`);
    return found.id;
  }
  const res = await asc(`/v1/${createType}`, "POST", {
    data: {
      type: createType,
      attributes: { locale: LOCALE, ...attributes },
      relationships: { [parentRel]: { data: { type: parentRel + "s", id: parentId } } },
    },
  });
  console.log(`✔ ${kind} ko 생성 (${res.data.id})`);
  return res.data.id;
}

if (KEYWORDS.length > 100) throw new Error(`keywords ${KEYWORDS.length}자 — 100자 초과`);
if (SUBTITLE.length > 30) throw new Error(`subtitle ${SUBTITLE.length}자 — 30자 초과`);
if (NAME.length > 30) throw new Error(`name ${NAME.length}자 — 30자 초과`);

await upsert(
  "버전 로컬라이제이션",
  `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`,
  "appStoreVersionLocalizations",
  "appStoreVersion",
  VERSION_ID,
  {
    description: DESCRIPTION,
    keywords: KEYWORDS,
    supportUrl: SUPPORT_URL,
    marketingUrl: SUPPORT_URL,
  }
);

await upsert(
  "앱정보 로컬라이제이션",
  `/v1/appInfos/${APPINFO_ID}/appInfoLocalizations`,
  "appInfoLocalizations",
  "appInfo",
  APPINFO_ID,
  { name: NAME, subtitle: SUBTITLE, privacyPolicyUrl: PRIVACY_URL }
);

console.log(
  `\n길이: description ${DESCRIPTION.length}/4000, keywords ${KEYWORDS.length}/100, subtitle ${SUBTITLE.length}/30`
);
