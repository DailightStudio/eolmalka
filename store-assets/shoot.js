const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:8081";
const OUT = path.join(__dirname, "screenshots");
const ONB_KEY = "eolmalka:onboarding:v1";

// App Store 규격: iPhone 6.9" = 1290×2796(430×932@3), iPad 13" = 2048×2732(1024×1366@2)
const devices = [
  { name: "iphone69", viewport: { width: 430, height: 932 }, dsr: 3, mobile: true },
  { name: "ipad13", viewport: { width: 1024, height: 1366 }, dsr: 2, mobile: true },
];

// scrollTo: 해당 텍스트 섹션으로 스크롤 후 캡처
const screens = [
  { name: "1-home", url: "/" },
  { name: "2-usd", url: "/c/fx-usd" },
  { name: "3-usd-news", url: "/c/fx-usd", scrollTo: "시장 분위기", wait: 4500 },
  { name: "4-usd-alert", url: "/c/fx-usd", scrollTo: "목표가 알림" },
  { name: "5-gold", url: "/c/gold-kr" },
  { name: "6-air", url: "/c/air-nrt" },
];

async function shoot(page, s, file) {
  try {
    await page.goto(BASE + s.url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.log("goto slow(계속):", s.url);
  }
  await page.waitForTimeout(5000); // fetch + 렌더
  if (s.scrollTo) {
    try {
      await page
        .getByText(s.scrollTo, { exact: false })
        .first()
        .scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(s.wait || 1500);
    } catch (e) {
      console.log("scrollTo miss:", s.scrollTo);
    }
  }
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", path.basename(file), ((fs.statSync(file).size / 1024) | 0) + "KB");
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const d of devices) {
    const ctxOpts = {
      viewport: d.viewport,
      deviceScaleFactor: d.dsr,
      isMobile: d.mobile,
      hasTouch: d.mobile,
    };
    // 앱 화면 (온보딩 스킵)
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript((k) => {
      try { localStorage.setItem(k, "1"); } catch (e) {}
    }, ONB_KEY);
    const page = await ctx.newPage();
    for (const s of screens) {
      await shoot(page, s, path.join(OUT, `${d.name}-${s.name}.png`));
    }
    await ctx.close();
    // 온보딩 (스킵 플래그 없음 → 첫 진입 시 온보딩)
    const octx = await browser.newContext(ctxOpts);
    const opage = await octx.newPage();
    await shoot(opage, { name: "0-onboarding", url: "/" }, path.join(OUT, `${d.name}-0-onboarding.png`));
    await octx.close();
  }
  await browser.close();
  console.log("DONE");
})();
