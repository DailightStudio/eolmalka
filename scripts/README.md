# scripts/

## asc.mjs
App Store Connect API 최소 클라이언트. 의존성 없음(node 내장 crypto만).
키는 `credentials/AuthKey_*.p8` 를 읽는다 — 이 디렉터리에 비밀값은 없다.

```bash
node scripts/asc.mjs "/v1/apps/6782645385"
node scripts/asc.mjs "/v1/appInfos/<id>" PATCH '{"data":{...}}'
```

## asc-fill-metadata.mjs
1.0 버전 en-US 메타데이터(설명·키워드·지원URL·부제·개인정보방침 URL)를 채운다. 재실행 안전.

## asc-age-rating.mjs
연령등급 설문을 채운다. `advertising: true`(AdMob 실제 탑재) 외에는 전부 NONE/false.
⚠️ Apple 에 하는 공식 선언 — 제출 전 ASC 웹에서 눈으로 확인할 것.

## 주의
- `credentials/` 는 gitignore 대상(.gitignore:23), `*.p8` 도 별도 차단(.gitignore:17).
- 이 레포는 **public** 이다. 스크립트에 키·비번을 하드코딩하지 말 것.

## asc-review-detail.mjs
심사 연락처(App Review Information)를 만든다. 전화번호는 개발자 실제 번호라
코드에 넣지 않고 인자로 받는다.

```bash
node scripts/asc-review-detail.mjs "+82 10-1234-5678"
```

## API 로 안 되는 것 (ASC 웹에서 직접)
- **App Privacy(데이터 수집 선언)** — ASC API 가 엔드포인트를 노출하지 않는다
  (`/v1/appDataUsages` 404, app/appStoreVersion 리소스에 privacy 관계 없음).
  이 앱은 Firebase Analytics·Crashlytics·AdMob 탑재 → 식별자/사용 데이터 수집에 해당.
- **contentRightsDeclaration** — 뉴스 헤드라인(Google News RSS)을 표시하므로
  제3자 콘텐츠 사용 여부 판단이 필요. 개발자가 직접 선언할 것.
