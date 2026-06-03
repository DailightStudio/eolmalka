// 가벼운 i18n — locale 감지 + 핵심 라벨 카탈로그.
// 데이터(카테고리명·뉴스 쿼리·이벤트)는 한국어 유지. UI 골격 라벨만 번역.
// 인프라 다 깔린 뒤 점진적으로 키 추출하면 됨.
// locale 감지는 Hermes Intl (RN 0.76+) 기준. 실패 시 ko 폴백.

export type Locale = "ko" | "en" | "ja";

function detectLocale(): Locale {
  try {
    const l = new Intl.DateTimeFormat().resolvedOptions().locale ?? "ko";
    if (l.startsWith("en")) return "en";
    if (l.startsWith("ja")) return "ja";
  } catch {
    // Hermes Intl 없으면 폴백
  }
  return "ko";
}

export const LOCALE = detectLocale();

// 키 네임: 화면.섹션.용도 (점 구분)
const MESSAGES: Record<Locale, Record<string, string>> = {
  ko: {
    "home.title": "지금 살까,\n기다릴까?",
    "home.subtitle": "환율·주유비·항공권·금. 과거+현재+예측을 한 화면에서.",
    "home.brand": "얼말까",
    "home.sort.default": "기본",
    "home.sort.signal": "신호",
    "home.sort.change": "변동률",
    "home.mode.label": "신호 민감도",
    "home.mode.conservative": "🛡️ 보수",
    "home.mode.default": "기본",
    "home.mode.aggressive": "⚡ 공격",
    "home.add": "+ 카테고리 추가",
    "signal.buy": "지금 사세요",
    "signal.wait": "기다리세요",
    "signal.neutral": "보통",
    "badge.live": "● 실데이터",
    "badge.dummy": "○ 더미",
    // 카테고리 이름/서브타이틀
    "cat.fx-usd.name": "원/달러 환율",
    "cat.fx-usd.sub": "USD/KRW",
    "cat.fx-jpy.name": "원/엔 환율",
    "cat.fx-jpy.sub": "JPY/KRW (100엔)",
    "cat.fx-eur.name": "원/유로 환율",
    "cat.fx-eur.sub": "EUR/KRW",
    "cat.fx-cny.name": "원/위안 환율",
    "cat.fx-cny.sub": "CNY/KRW",
    "cat.gas-petrol.name": "휘발유",
    "cat.gas-petrol.sub": "전국 평균 (오피넷 소매 + KRX 도매 시계열)",
    "cat.gold-kr.name": "금 시세",
    "cat.gold-kr.sub": "KRX 99.99K 1g (한국 시세)",
    "cat.air-nrt.name": "도쿄 항공권",
    "cat.air-nrt.sub": "ICN→NRT 왕복 최저가",
    "cat.air-tpe.name": "타이베이 항공권",
    "cat.air-tpe.sub": "ICN→TPE 왕복 최저가",
    "cat.unit.krw": "원",
    "cat.unit.perL": "원/L",
    "cat.unit.perG": "원/g",
    "cat.fxAdd.name": "원/{korean} 환율",
  },
  en: {
    "home.title": "Buy now,\nor wait?",
    "home.subtitle": "FX, gas, flights, gold. Past + present + forecast on one screen.",
    "home.brand": "EOLMALKA",
    "home.sort.default": "Default",
    "home.sort.signal": "Signal",
    "home.sort.change": "Change",
    "home.mode.label": "Sensitivity",
    "home.mode.conservative": "🛡️ Safe",
    "home.mode.default": "Default",
    "home.mode.aggressive": "⚡ Bold",
    "home.add": "+ Add category",
    "signal.buy": "Buy now",
    "signal.wait": "Hold",
    "signal.neutral": "Normal",
    "badge.live": "● LIVE",
    "badge.dummy": "○ DEMO",
    "cat.fx-usd.name": "USD / KRW",
    "cat.fx-usd.sub": "US Dollar",
    "cat.fx-jpy.name": "JPY / KRW",
    "cat.fx-jpy.sub": "Japanese Yen (per 100)",
    "cat.fx-eur.name": "EUR / KRW",
    "cat.fx-eur.sub": "Euro",
    "cat.fx-cny.name": "CNY / KRW",
    "cat.fx-cny.sub": "Chinese Yuan",
    "cat.gas-petrol.name": "Gasoline",
    "cat.gas-petrol.sub": "National avg (Opinet retail + KRX wholesale)",
    "cat.gold-kr.name": "Gold",
    "cat.gold-kr.sub": "KRX 99.99K per 1g (Korean market)",
    "cat.air-nrt.name": "Flight Tokyo",
    "cat.air-nrt.sub": "ICN→NRT round-trip cheapest",
    "cat.air-tpe.name": "Flight Taipei",
    "cat.air-tpe.sub": "ICN→TPE round-trip cheapest",
    "cat.unit.krw": "KRW",
    "cat.unit.perL": "KRW/L",
    "cat.unit.perG": "KRW/g",
    "cat.fxAdd.name": "{code} / KRW",
  },
  ja: {
    "home.title": "今買うか、\n待つか？",
    "home.subtitle": "為替・ガソリン・航空券・金。過去+現在+予測を一画面で。",
    "home.brand": "オルマルカ",
    "home.sort.default": "標準",
    "home.sort.signal": "シグナル",
    "home.sort.change": "変動",
    "home.mode.label": "感度",
    "home.mode.conservative": "🛡️ 安全",
    "home.mode.default": "標準",
    "home.mode.aggressive": "⚡ 攻撃",
    "home.add": "+ カテゴリ追加",
    "signal.buy": "今買う",
    "signal.wait": "様子見",
    "signal.neutral": "普通",
    "badge.live": "● 実データ",
    "badge.dummy": "○ デモ",
    "cat.fx-usd.name": "USD / KRW",
    "cat.fx-usd.sub": "米ドル",
    "cat.fx-jpy.name": "JPY / KRW",
    "cat.fx-jpy.sub": "100円あたり",
    "cat.fx-eur.name": "EUR / KRW",
    "cat.fx-eur.sub": "ユーロ",
    "cat.fx-cny.name": "CNY / KRW",
    "cat.fx-cny.sub": "人民元",
    "cat.gas-petrol.name": "ガソリン",
    "cat.gas-petrol.sub": "全国平均(オピネット小売 + KRX 卸売)",
    "cat.gold-kr.name": "金相場",
    "cat.gold-kr.sub": "KRX 99.99K 1gあたり(韓国市場)",
    "cat.air-nrt.name": "東京航空券",
    "cat.air-nrt.sub": "ICN→NRT 往復最安値",
    "cat.air-tpe.name": "台北航空券",
    "cat.air-tpe.sub": "ICN→TPE 往復最安値",
    "cat.unit.krw": "ウォン",
    "cat.unit.perL": "ウォン/L",
    "cat.unit.perG": "ウォン/g",
    "cat.fxAdd.name": "{code} / KRW",
  },
};

export function t(key: string, vars?: Record<string, string>): string {
  const raw = MESSAGES[LOCALE][key] ?? MESSAGES.ko[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
