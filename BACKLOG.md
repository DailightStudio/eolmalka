# 백로그

언젠가 손볼 것들. 끝낸 항목은 **체크 대신 삭제**.

## 데이터 연동

- ~~**금** 국제 현물가~~ — CoinGecko PAXG로 LIVE 연동 완료.
- ~~**금 (KRX 금시장 종가)**~~ — `EXPO_PUBLIC_DATA_GO_KR_KEY` 설정·활성화. MA7 스무딩 + 합성 메꿈 제거.
- **항공권** — Travelpayouts 어필리에이트 또는 Amadeus Self-Service. 노선·왕복 최저가 1주일 단위. (현재 합성)
- ~~휘발유 시도별~~ — `getSidoPrices()` + 휘발유 상세에 저렴/비싼 시도 카드. 시군구는 future.
- ~~**일별 시세 누적**~~ — AsyncStorage `series-store.ts` 완료. 백그라운드 fetch마다 누적, 365일 트림.
- ~~**휘발유 1Y 백필**~~ — `opinet-daily-provider.ts.backfillChunk()` chunked+resumable (30일/회). gas-petrol 진입마다 fire-and-forget.

## 알림

- ~~로컬 알림 권한 + 백그라운드 fetch + 목표가 도달 시 알림~~ — 완료
- ~~알림 중복 방지~~ — `isInCooldown`(target 6h, signal 24h) `background-check.ts` 적용 완료
- ~~알림 채널 분류~~ — target/signal/system 3채널 (Android channel, iOS sound 차별)
- ~~즐겨찾기 + 목표가 동기화~~ — 해제 시 자동 제거

## 뉴스·감성

- ~~Google News RSS + OpenRouter Gemini 감성 분석~~ — 완료 (1h 캐싱)
- ~~**OpenRouter 키 프록시화**~~ — Supabase Edge Function(`supabase/functions/news-sentiment`)로 이관. `EXPO_PUBLIC_NEWS_PROXY_URL` 설정 시 프록시 우선, 미설정 시 직호출 폴백.
- ~~장기 분위기 변화 알림~~ — bullish↔bearish 전환 + confidence ≥ 0.5 시 signal 채널 푸시
- ~~뉴스 카드 탭 → 원문 링크~~ — RSS link 추출 + Linking.openURL

## UX

- ~~SVG Sparkline~~ — 완료 (react-native-svg)
- ~~즐겨찾기·정렬~~ — 완료 (AsyncStorage)
- ~~목표가 입력 UI~~ — 완료
- ~~카테고리 검색·추가~~ — `/add` 검색 + 선택 개수 + 추가된 것 상단 정렬
- **위젯(iOS)** — 홈 화면 위젯에 즐겨찾기 1개 시세
- ~~공유~~ — RN `Share.share()` 텍스트 공유 (헤더 공유 버튼). 캡처 이미지 공유는 future (view-shot + expo-sharing 패키지 필요).
- ~~다국어 인프라~~ — `src/lib/i18n.ts` (ko/en/ja), Hermes Intl로 locale 감지. **핵심 라벨만 적용**(헤더·sort·mode·신호 라벨). 카테고리명·뉴스 쿼리·이벤트는 ko 유지 — 점진 확장.

## 빌드/배포

- ~~eas.json 3 프로필(development/preview/production)~~ 완료
- **`eas init`** — projectId 발급 (사용자가 1회 실행, app.json의 extra.eas.projectId 자동 채움)
- ~~아이콘·스플래시 정리~~ — `scripts/gen-icons.py`로 브랜드(라임 상승 스파크라인) placeholder 자동 생성. splash는 `expo-splash-screen` 플러그인으로 이관. **디자이너 교체 시 같은 스크립트 자리에 새 PNG만 덮으면 됨.**
- 앱스토어/플레이스토어 자료 (스크린샷·설명문)
- iOS 폰 UDID 등록 (development 빌드용)

## 데이터·모델

- ~~카테고리별 예측 가중~~ — fx/gold/gas/air 각각 7d/30d/90d 추세 가중 분리 (`computeBlendedDrift`).
- ~~항공권 계절성 모델~~ — `buildSeasonalAdjuster` 작년 동월 평균 × 7-8월/12-1월 휴가 부스트 (`projectForecast`의 air-* 분기)
- ~~신호 임계치 사용자 조정~~ — `SignalMode` (conservative/default/aggressive). 메인 헤더에 칩, computeStats(slug, mode) + background-check 적용
- ~~예측 백테스트~~ — `backtestForecast()` (MAPE/RMSE/±1σ 적중률). 카테고리 화면에 표시.
