# 얼말까 (eolmalka) — Claude Code Guide

"지금 살까, 기다릴까?" 시세 비교·예측 앱. 환율·주유비·항공권·금.

> 참고: Next.js 16은 학습 데이터와 다를 수 있음. 필요 시 `node_modules/next/dist/docs/` 확인.

## 스택

- **Next.js 16** (App Router, `src/app`) + React 19 + TypeScript 5
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- 외부 API: ECOS / 오피넷 / 한국금거래소 / 항공권 어필리에이트
- 캐싱: Vercel KV (Upstash Redis)

## 실행·빌드

- `npm install`
- `npm run dev` — localhost:3000
- `npm run build` / `npm start`
- `npm run lint`

## 구조

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    c/[slug]/page.tsx        # 카테고리 상세
  lib/
    demo-categories.ts       # 더미 데이터 (실데이터 연동 전까지)
```

## 설정·시크릿

- `.env.local`에 키 작성 (`.env.example` 복사). `.env*`는 gitignore (예외: `.env.example`).
- 외부 API 키는 **전부 서버 전용**. 브라우저 노출 금지 (요금·rate limit 보호).
- 브라우저 노출(`NEXT_PUBLIC_*`)은 `NEXT_PUBLIC_SITE_URL` 정도만.

## 도메인·용어

- **신호(signal)**: `buy` / `wait` / `neutral` — 카드·상세 헤더 색 결정
- **카테고리(category)**: 한 줄짜리 정보 단위. slug는 `fx-usd`처럼 `<도메인>-<항목>`
- 예측은 단순 모델부터 — 이동평균 / 계절성 → 필요시 시계열 ML

## 규칙·주의

- 페이지 import alias는 `@/` (= `src/`).
- 데모 단계에서 실데이터처럼 보이게 하지 말 것 — 데모 디스클레이머 항상 표기.
- 항공권 가격은 출발일·인원·항공사·노선 따라 천차만별 → "최저가" 표시 시 조건 명시 필수.
- 외환·금·항공권 모두 의사결정 도구로 쓰이므로 **추정 모델/데이터 출처를 항상 표기**.
- 금융상품 자문이 되지 않도록 표현 주의 ("투자/매수 권유" X, "참고 신호" 톤).
