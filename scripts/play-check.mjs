// Play Console 에 앱이 등록됐는지 확인한다 (서비스계정으로 읽기만).
// edits.insert 로 편집세션을 열어보고 바로 삭제 — 앱이 없으면 404 가 난다.
//   node scripts/play-check.mjs
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PKG = "com.dailightstudio.eolmalka";
const KEY_PATH = new URL("../credentials/pindog-3c73b6f46ee2_e5c393.json", import.meta.url);

const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken() {
  const sa = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const sig = cryptoSign("sha256", Buffer.from(input), createPrivateKey(sa.private_key));
  const jwt = `${input}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`토큰 발급 실패: ${JSON.stringify(j).slice(0, 400)}`);
  return j.access_token;
}

const token = await accessToken();
console.log("✔ 서비스계정 인증 통과");

const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const res = await fetch(`${base}/edits`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}",
});
const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(`✔ Play Console 에 ${PKG} 존재함 (edit ${body.id})`);
  // 만든 편집세션은 바로 정리한다 — 아무것도 변경하지 않았다.
  await fetch(`${base}/edits/${body.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("  (확인용 편집세션 삭제됨 — 변경사항 없음)");

  const t = await fetch(`${base}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.json());
  const tracks = await fetch(`${base}/edits/${t.id}/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  for (const tr of tracks.tracks ?? []) {
    const rel = (tr.releases ?? [])
      .map((r) => `${r.status} vc=${(r.versionCodes ?? []).join(",") || "-"}`)
      .join(" | ");
    console.log(`    트랙 ${tr.track}: ${rel || "릴리스 없음"}`);
  }
  await fetch(`${base}/edits/${t.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
} else {
  console.log(`✖ Play Console 에 ${PKG} 없음 또는 접근 불가 (HTTP ${res.status})`);
  console.log("  ", JSON.stringify(body?.error?.message ?? body).slice(0, 300));
}
