// ASC 1.0 버전 메타데이터 채우기 (설명·키워드·URL·부제·개인정보방침).
// 실행: node scripts/asc-fill-metadata.mjs
// 재실행 안전 — 같은 값을 다시 PATCH 할 뿐이다.
import { asc } from "./asc.mjs";

const VERSION_LOC = "11121c6e-9b5f-400f-81f9-9e462c8e5ed5"; // en-US, version 1.0
const APPINFO_LOC = "a6173669-1718-43e0-bb57-b24b6201d38b"; // en-US

const SUPPORT_URL = "https://dailightstudio.github.io/eolmalka-pages/";
const PRIVACY_URL = "https://dailightstudio.github.io/eolmalka-pages/privacy.html";

// 앱이 실제로 하는 것만 적는다. 항공권은 아직 합성 데이터라 언급하지 않는다(README 기준).
const DESCRIPTION = `Should you buy now — or wait?

eolmalka puts exchange rates, fuel prices, and gold on one screen, then tells you what the numbers actually say.

WHAT YOU GET

• Past, present, and forecast in one view. A sparkline of recent history, the live price, and a short-term projection — no chart-reading required.

• A plain answer. Every item shows a simple signal: buy now, or wait. No jargon, no dashboard to configure.

• Target price alerts. Set a number and get a notification when it is reached. Checks run in the background, so you do not have to open the app.

• News sentiment. Recent headlines are summarized as bullish or bearish, with an alert when the mood flips.

• Favorites and sorting that stay put between sessions.

WHAT IS COVERED

- Exchange rates: USD, JPY, EUR and CNY against KRW, based on European Central Bank reference rates
- Gasoline: national average pump prices in Korea
- Gold: international spot price

Your favorites, target prices, and alert settings are stored on your device.`;

// 100자 제한. 쉼표 구분, 공백 없이.
const KEYWORDS =
  "exchange rate,currency,won,KRW,USD,JPY,gold price,gas price,fuel,forecast,price alert,fx";

const SUBTITLE = "Buy now or wait? Ask the data."; // 30자 제한

async function main() {
  if (KEYWORDS.length > 100) throw new Error(`keywords ${KEYWORDS.length}자 — 100자 초과`);
  if (SUBTITLE.length > 30) throw new Error(`subtitle ${SUBTITLE.length}자 — 30자 초과`);
  if (DESCRIPTION.length > 4000) throw new Error(`description ${DESCRIPTION.length}자 — 4000자 초과`);

  await asc(`/v1/appStoreVersionLocalizations/${VERSION_LOC}`, "PATCH", {
    data: {
      type: "appStoreVersionLocalizations",
      id: VERSION_LOC,
      attributes: {
        description: DESCRIPTION,
        keywords: KEYWORDS,
        supportUrl: SUPPORT_URL,
        marketingUrl: SUPPORT_URL,
      },
    },
  });
  console.log("✔ 버전 로컬라이제이션 (설명·키워드·지원URL·마케팅URL)");

  await asc(`/v1/appInfoLocalizations/${APPINFO_LOC}`, "PATCH", {
    data: {
      type: "appInfoLocalizations",
      id: APPINFO_LOC,
      attributes: { subtitle: SUBTITLE, privacyPolicyUrl: PRIVACY_URL },
    },
  });
  console.log("✔ 앱 정보 로컬라이제이션 (부제·개인정보처리방침 URL)");

  console.log(
    `\n길이: description ${DESCRIPTION.length}/4000, keywords ${KEYWORDS.length}/100, subtitle ${SUBTITLE.length}/30`
  );
}

await main();
