/**
 * Playwright로 Expo 웹 앱 스크린샷 캡처
 * 실행: node store-assets/capture-screenshots.mjs
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:8081';

// Google Play 폰 스크린샷: 1080×1920
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2.77;  // 390*2.77 ≈ 1080

const SCREENS = [
  { name: '01-home',        url: '/',             title: '홈 — 카드 목록 + 신호' },
  { name: '02-detail-usd',  url: '/c/fx-usd',     title: '달러 상세 — 차트 + 예측' },
  { name: '03-detail-gas',  url: '/c/gas-petrol',  title: '휘발유 상세 — 시도별 가격' },
  { name: '04-detail-air',  url: '/c/air-nrt',     title: '항공권 상세 — 타이밍 차트' },
  { name: '05-add',         url: '/add',           title: '카테고리 추가' },
  { name: '06-onboarding',  url: '/onboarding',    title: '온보딩' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });

  const page = await context.newPage();

  // 외부 API 요청 즉시 abort → 합성 데모 데이터 폴백 유도 (로딩 무한대기 방지)
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      route.continue();
    } else {
      route.abort();
    }
  });

  // 온보딩 완료 플래그 세팅 (리다이렉트 방지)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('eolmalka:onboarding:v1', '1');
  });

  for (const screen of SCREENS) {
    console.log(`캡처: ${screen.title}`);
    try {
      await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(4000);  // 합성 데이터 렌더링 대기

      const outPath = join(__dir, `${screen.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  → ${outPath}`);
    } catch (e) {
      console.error(`  ✗ ${screen.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\n완료! store-assets/*.png 확인하세요.');
}

main().catch(console.error);
