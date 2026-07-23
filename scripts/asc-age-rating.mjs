// ASC 연령등급 설문 채우기.
// 얼말까는 환율·유가·금 시세 조회 앱 — 폭력/성적/약물/도박 콘텐츠가 없다.
// 유일하게 true 인 것은 광고: react-native-google-mobile-ads(AdMob)가 실제로 붙어 있다.
// (app.json plugins + production 환경의 EXPO_PUBLIC_ADMOB_* 로 확인)
//
// ⚠️ 이건 Apple 에 하는 공식 선언이다. 제출 전 ASC 웹에서 반드시 눈으로 확인할 것.
import { asc } from "./asc.mjs";

const DECL_ID = "027fb439-d2b9-4c49-b3f4-fc0386f80dd2";

const ATTRS = {
  // 콘텐츠 등급 (NONE / INFREQUENT_OR_MILD / FREQUENT_OR_INTENSE)
  alcoholTobaccoOrDrugUseOrReferences: "NONE",
  contests: "NONE",
  gamblingSimulated: "NONE",
  horrorOrFearThemes: "NONE",
  matureOrSuggestiveThemes: "NONE",
  medicalOrTreatmentInformation: "NONE",
  profanityOrCrudeHumor: "NONE",
  sexualContentGraphicAndNudity: "NONE",
  sexualContentOrNudity: "NONE",
  violenceCartoonOrFantasy: "NONE",
  violenceRealistic: "NONE",
  violenceRealisticProlongedGraphicOrSadistic: "NONE",
  gunsOrOtherWeapons: "NONE",

  // 불리언
  advertising: true, // AdMob 배너·전면·리워드 사용
  gambling: false,
  lootBox: false,
  messagingAndChat: false, // 채팅 기능 없음
  parentalControls: false,
  socialMedia: false,
  unrestrictedWebAccess: false, // 뉴스 링크는 외부 브라우저로 열림(인앱 브라우징 아님)
  userGeneratedContent: false, // 사용자 생성 콘텐츠 없음
  healthOrWellnessTopics: false, // 건강·웰니스 정보 제공 안 함
  ageAssurance: false, // 연령 확인 장치 없음 (필수 필드)
};

const res = await asc(`/v1/ageRatingDeclarations/${DECL_ID}`, "PATCH", {
  data: { type: "ageRatingDeclarations", id: DECL_ID, attributes: ATTRS },
});
console.log("✔ 연령등급 선언 저장됨");
const a = res?.data?.attributes ?? {};
const still = Object.entries(a).filter(([, v]) => v === null).map(([k]) => k);
console.log("  미설정으로 남은 항목:", still.length ? still.join(", ") : "없음");
