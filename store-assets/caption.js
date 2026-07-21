const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SHOTS = path.join(__dirname, "screenshots");
const OUT = path.join(__dirname, "final");

const devices = [
  { name: "iphone69", W: 1290, H: 2796 },
  { name: "ipad13", W: 2048, H: 2732 },
];

// 깨끗한 화면 + 한글 마케팅 헤드라인. src 지정 시 그 파일 사용(실기 캡처), iphoneOnly는 iPad 스킵.
const captions = [
  { file: "1-home", title: "환율·유가·금·항공권,<br><b>한 화면에</b>" },
  { file: "2-usd", title: "지금 가격,<br><b>1년 분포</b> 어디쯤?" },
  { file: "5-gold", title: "<b>실시간</b> 시세 +<br><b>30일 예측</b>" },
  { file: "6-air", title: "항공권 <b>살 타이밍</b>도<br>한눈에" },
  { file: "7-news", title: "뉴스로 읽는<br><b>시장 분위기</b>", src: "C:/Users/Jay-server/Desktop/projects/server-agent/uploads/img_2a89680e.jpg", iphoneOnly: true },
  { file: "0-onboarding", title: "지금 살까,<br><b>기다릴까?</b>" },
];

function buildHtml(W, H, title, mime, b64) {
  const titleSize = Math.round(W * 0.06);
  const shotW = Math.round(W * 0.84);
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif}
  body{width:${W}px;height:${H}px;background:linear-gradient(160deg,#0b0f17,#161c26);display:flex;flex-direction:column;align-items:center}
  .t{margin-top:${Math.round(H * 0.05)}px;color:#fafafa;font-size:${titleSize}px;font-weight:800;line-height:1.2;text-align:center;letter-spacing:-1px;padding:0 7%}
  .t b{color:#a3e635}
  img{margin-top:${Math.round(H * 0.035)}px;width:${shotW}px;border-radius:${Math.round(W * 0.055)}px;box-shadow:0 24px 80px rgba(0,0,0,.55);border:1px solid #2a2f3a}
  </style><div class="t">${title}</div><img src="data:${mime};base64,${b64}">`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const d of devices) {
    const ctx = await browser.newContext({
      viewport: { width: d.W, height: d.H },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    for (const c of captions) {
      if (c.iphoneOnly && d.name !== "iphone69") continue;
      const src = c.src || path.join(SHOTS, `${d.name}-${c.file}.png`);
      if (!fs.existsSync(src)) { console.log("missing:", src); continue; }
      const mime = /\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png";
      const b64 = fs.readFileSync(src).toString("base64");
      await page.setContent(buildHtml(d.W, d.H, c.title, mime, b64), { waitUntil: "load" });
      await page.waitForTimeout(300);
      const out = path.join(OUT, `${d.name}-${c.file}.png`);
      await page.screenshot({ path: out });
      console.log("saved", path.basename(out), ((fs.statSync(out).size / 1024) | 0) + "KB");
    }
    await ctx.close();
  }
  await browser.close();
  console.log("DONE");
})();
