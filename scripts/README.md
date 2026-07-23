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
