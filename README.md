# 얼말까 (eolmalka)

**"지금 살까, 기다릴까?"** 한 화면에서 답해주는 시세 비교/예측 앱.

환율·주유비·항공권·금. 과거 차트 + 현재가 + 미래 예측을 보여주고, "지금 사세요 / 기다리세요" 직관적 신호로 결정을 돕습니다.

> 이름 의미: "얼마일까?"의 줄임 — 짧게 묻고 짧게 답하는 톤이 그대로 컨셉.

## 기술 스택

- **Next.js 16** (App Router) + React 19 + TypeScript 5
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- 외부 API:
  - **환율(현재 LIVE):** Frankfurter (ECB 기준, 무키·무료) — USD/KRW · JPY/KRW. Twelve Data 키 있으면 우선.
  - 주유비: 오피넷 (한국석유공사) OpenAPI
  - 금: 한국금거래소 / KRX 금시장 (공식 API 한정적 → 스크래핑 후보)
  - 항공권: Skyscanner / Amadeus / Travelpayouts 어필리에이트
- 캐싱: Vercel KV (Upstash Redis)
- 배포: Vercel

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 키 채우기 (없어도 데모는 동작)
npm run dev
```

`http://localhost:3000` → 카테고리 목록. 카드 클릭 → `/c/[slug]` 상세.

## 카테고리 (현재 데모 6개)

| slug | 이름 | 출처(예정) |
|---|---|---|
| `fx-usd` | 원/달러 환율 | ECOS |
| `fx-jpy` | 원/엔 환율 | ECOS |
| `gas-petrol` | 휘발유 | 오피넷 |
| `gold-kr` | 금 24K | 한국금거래소 |
| `air-nrt` | 도쿄 항공권 | Skyscanner/Travelpayouts |
| `air-tpe` | 타이베이 항공권 | Skyscanner/Travelpayouts |

## 폴더

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    c/[slug]/page.tsx       # 카테고리 상세 (차트 자리 + 신호)
  lib/
    demo-categories.ts      # 더미 카테고리 데이터
```

## 디자인 톤

- 다크 + 라임/로즈 시그널. 차분하지만 결정은 명확.
- "지금 사세요 / 기다리세요" 단 한 줄로 끝낼 수 있어야 함.
- 광고 톤 X. 지나치게 잦은 푸시 X (알람 프리미엄은 옵션).

## 수익화 후보

- 알림(원하는 가격 도달 시 푸시) 프리미엄
- 항공권 어필리에이트 (Travelpayouts 등)
- 광고

## 백로그·진행 메모

`BACKLOG.md` 참고. 끝낸 항목은 체크 대신 삭제.
