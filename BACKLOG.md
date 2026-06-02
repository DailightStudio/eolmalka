# 백로그

언젠가 손볼 것들. 끝낸 항목은 **체크 대신 삭제**.

## 데이터 연동

- ~~**금** 국제 현물가~~ — CoinGecko PAXG로 LIVE 연동 완료.
- **금 (KRX 금시장 종가)** — 진짜 한국 시세(부가세 포함). 공공데이터포털 키 발급 → `krx-gold-provider.ts` 활성화.
- **항공권** — Travelpayouts 어필리에이트 또는 Amadeus Self-Service. 노선·왕복 최저가 1주일 단위.
- **휘발유 시도/시군구별** — 오피넷 `avgSidoPrice` 활용.
- ~~**일별 시세 누적**~~ — AsyncStorage `series-store.ts` 완료. 백그라운드 fetch마다 누적, 365일 트림.
- **휘발유 1Y 백필** — `opinet-daily-provider.ts.backfillDays(365)` 1회 실행 (rate limit 주의).

## 알림

- ~~로컬 알림 권한 + 백그라운드 fetch + 목표가 도달 시 알림~~ — 완료
- **알림 중복 방지** — 카테고리당 발송 이력(마지막 발송 시각) 저장 → 24h 쿨다운
- **알림 채널 분류** — 목표가 / 통계 신호 / 시스템 (소리 다르게)
- **즐겨찾기 + 목표가 동기화** — 즐겨찾기 해제 시 목표가도 함께 제거(또는 보존 옵션)

## 뉴스·감성

- ~~Google News RSS + OpenRouter Gemini 감성 분석~~ — 완료 (1h 캐싱)
- **OpenRouter 키 프록시화** — 현재 EXPO_PUBLIC_으로 클라 노출 상태. server-agent 또는 Supabase Edge Function 프록시로 이관.
- **장기 분위기 변화 알림** — 어제 bullish → 오늘 bearish 같은 큰 전환 시 푸시
- **뉴스 카드 탭 → 원문 링크** — Google News URL 같이 fetch

## UX

- ~~SVG Sparkline~~ — 완료 (react-native-svg)
- ~~즐겨찾기·정렬~~ — 완료 (AsyncStorage)
- ~~목표가 입력 UI~~ — 완료
- **카테고리 검색·추가** — 사용자가 환율 통화 추가 (예: AUD/SGD)
- **위젯(iOS)** — 홈 화면 위젯에 즐겨찾기 1개 시세
- **공유** — 카드 캡처 → 카카오톡 공유
- **다국어** — en, ja (환율은 외국인 수요)

## 빌드/배포

- ~~eas.json 3 프로필(development/preview/production)~~ 완료
- **`eas init`** — projectId 발급 (사용자가 1회 실행, app.json의 extra.eas.projectId 자동 채움)
- 아이콘·스플래시 디자인 (현재 placeholder)
- 앱스토어/플레이스토어 자료 (스크린샷·설명문)
- iOS 폰 UDID 등록 (development 빌드용)

## 데이터·모델

- 예측 모델: 현재는 단순 평균회귀. 카테고리별 계절성 강한 항공권은 별도 모델 필요.
- 신호 임계치 사용자 조정 옵션 (보수적/공격적)
