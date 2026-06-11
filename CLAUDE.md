# 얼말까 (eolmalka) — Claude Code Guide

시세 비교·예측 모바일 앱 (Expo / React Native). 백엔드 없음 — 클라이언트가 직접 fetch, 알림은 로컬.

## 스택

- **Expo SDK 54** + React Native 0.81 + TypeScript 5
- **Expo Router** (file-based, typed routes)
- **react-native-svg** (Sparkline)
- **AsyncStorage** (영구 상태)
- **expo-notifications** + **expo-background-fetch** + **expo-task-manager**

## 실행

- `npm install`
- `npx expo start` — Expo Go로 즉시
- `npx expo start --ios` / `--android` — 시뮬레이터
- `npx expo start --web` — 빠른 RN web 미리보기 (브라우저 알림은 미지원)
- `npm run typecheck`

## 구조

```
app/                    # Expo Router (파일 = 라우트)
  _layout.tsx           # 루트 Stack + 알림/백그라운드 초기화
  index.tsx             # 메인 — 카드 리스트
  c/[slug].tsx          # 카테고리 상세 + 목표가 알림 UI
src/
  components/Sparkline.tsx
  lib/{fx,gas}-provider.ts, demo-series.ts, signals.ts, quartiles.ts
  lib/storage.ts        # AsyncStorage
  lib/notifications.ts  # 로컬 알림
  lib/background-check.ts # BackgroundFetch 태스크
```

## 환경변수 (Expo)

- **EXPO_PUBLIC_* 만 클라이언트 번들에 박힘**. 그 외 접두사는 빌드 시 무시.
- 클라에 박히는 키는 **디컴파일로 추출 가능** — 진짜 보안 필요한 키는 별도 백엔드(또는 server-agent 프록시).
- 현재 박는 키: `EXPO_PUBLIC_OPINET_API_KEY` (오피넷 — 노출돼봐야 유가 조회만)

## 도메인

- **카테고리(slug)**: `fx-usd` 처럼 `<도메인>-<항목>`. CATEGORY_META에 메타.
- **신호(signal)**: `buy` / `wait` / `neutral`. quartile + 30d 변동률 조합.
- **verdict**: `great_deal` / `good` / `average` / `high` — 1년 분포 위치.
- **목표가**: 사용자 설정 가격 이하로 떨어지면 알림 (백그라운드).

## 규칙·주의

- import alias `@/` = `src/`
- 데모 단계에서 실데이터처럼 보이지 않게: 카드에 `LIVE`/`DEMO` 배지 항상.
- 외환·금·항공권은 의사결정 도구로 쓰이니 **출처·예측 모델 항상 표기**.
- "투자 자문" 톤 X — "참고 신호" 톤.
- 백그라운드 fetch는 iOS가 빈도 조정 (앱 활성도에 따라 30분~수시간).
- Android는 더 자주, 배터리 최적화 OFF시 더 안정적.

## 빌드 (EAS)

- 프로필 3개 (`eas.json`): development(본인 폰 dev 빌드) / preview(내부 테스터) / production(스토어)
- 첫 빌드 전: `eas login` (계정 jaylabs) → `eas init` (projectId 발급) → `app.json` extra.eas.projectId 자동 채워짐
- iOS: Apple Developer 멤버십 + 폰 UDID 등록 / Android: 키스토어 자동 관리
- `submit.ios.appleId` = wjs9280@gmail.com (스토어 제출 시)

## 알려진 제약

- iOS 백그라운드 fetch: OS가 최종 결정. 시연용으론 인앱에서 즉시 호출 가능.
- 알림 권한 거부 시: 설정 → 얼말까에서 수동으로 켜야 함.
