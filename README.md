# 얼말까 (eolmalka)

**"지금 살까, 기다릴까?"** 환율·주유비·항공권·금 시세를 한 화면에서.
과거 차트 + 현재가 + 미래 예측 + "지금 사세요 / 기다리세요" 직관적 신호.

**React Native (Expo) 모바일 앱**. 백엔드 없음 — 데이터는 앱이 직접 fetch, 알림은 로컬.

> 이름: "얼마일까?"의 줄임. 짧게 묻고 짧게 답하는 톤이 컨셉.

## 기술 스택

- **Expo SDK 52** + React Native 0.76 + TypeScript 5
- **Expo Router** (file-based routing)
- **react-native-svg** — 자체 Sparkline 차트
- **AsyncStorage** — 즐겨찾기·정렬·목표가 저장
- **expo-notifications** — 로컬 알림
- **expo-background-fetch + task-manager** — 약 1시간 주기 가격 체크 (OS 결정)

## 데이터 소스

| 카테고리 | 출처 | 상태 |
|---|---|---|
| USD·JPY·EUR·CNY / KRW | Frankfurter (ECB, 무키·무료) | LIVE |
| 휘발유 전국 평균 | 오피넷 OpenAPI (무료, 회원가입 필요) | LIVE |
| 금·항공권 | (예정) 한국금거래소·Travelpayouts | DEMO |

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 오피넷 키 채우기 (선택 — 없으면 휘발유는 합성)
npx expo start
```

- Expo Go 앱(iOS/Android)로 QR 스캔 → 즉시 실행
- `npx expo start --ios` / `--android`로 시뮬레이터·에뮬레이터

## EAS Build (앱스토어 배포)

처음 셋업:

```bash
npm install -g eas-cli
eas login                          # Expo 계정 (jaylabs)
eas init                           # app.json의 extra.eas.projectId 자동 채움
```

빌드 프로필 3개 (`eas.json`):

| 프로필 | 용도 | 명령 |
|---|---|---|
| **development** | 백그라운드 fetch·푸시까지 동작하는 dev 빌드. 본인 폰만 | `eas build --profile development --platform ios` |
| **preview** | 내부 테스터(가족·지인) 100명까지 TestFlight | `eas build --profile preview --platform ios` |
| **production** | 앱스토어 정식 출시. 버전 자동 증가 | `eas build --profile production --platform ios` |

iOS 빌드 전제: **Apple Developer 멤버십 ($99/년)** + 폰 UDID 등록.
Mac 불필요 — Expo 클라우드에서 빌드 후 다운로드 링크 제공.

제출:

```bash
eas submit --profile production --platform ios   # TestFlight → App Store
```

## 폴더

```
app/
  _layout.tsx       # 루트 스택 + 알림 셋업 + 백그라운드 등록
  index.tsx         # 메인 — 카테고리 카드 리스트 + 즐겨찾기 + 정렬
  c/[slug].tsx      # 카테고리 상세 — 차트 + 통계 + 목표가 알림 설정
src/
  components/
    Sparkline.tsx   # react-native-svg 라인 차트
  lib/
    fx-provider.ts  # Frankfurter / Twelve Data / 합성
    gas-provider.ts # 오피넷 avgRecentPrice
    demo-series.ts  # 시계열 빌더 (실데이터 + 합성 폴백)
    signals.ts      # 가격 신호 산출 + 카테고리 메타
    quartiles.ts    # dd-trip price.ts 포팅 — 분위수·verdict
    storage.ts      # AsyncStorage 래퍼 (즐겨찾기·정렬·목표가)
    notifications.ts # 권한·로컬 알림
    background-check.ts # BackgroundFetch + TaskManager 가격 체크
assets/             # 아이콘·스플래시 (placeholder)
```

## 알림 동작

- 카테고리 상세에서 목표가 입력 → 권한 요청 → 저장
- 약 1시간마다 백그라운드 fetch (iOS는 OS가 빈도 조정, 앱 사용 빈도에 따라 변동)
- 즐겨찾기 카테고리 + 목표가 도달 또는 통계 신호 `buy` + `great_deal` 시 로컬 알림
- 앱 안 켜놔도 알림 옴 (RN 네이티브 로컬 알림)

## 디자인 톤

- 다크 + 라임/로즈 시그널. 차분하지만 결정은 명확.
- "지금 사세요 / 기다리세요" 단 한 줄로 끝.
- 광고 톤 X. 잦은 푸시 X.

## 백로그

`BACKLOG.md` 참고. 끝낸 항목은 체크 대신 삭제.
