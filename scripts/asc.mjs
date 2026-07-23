// App Store Connect API 최소 클라이언트 (의존성 없음 — node 내장 crypto 만 사용)
// 사용: node scripts/asc.mjs <경로>            → GET
//       node scripts/asc.mjs <경로> <메서드> <json바디>
// 키는 credentials/ 의 .p8 (gitignore 이중 차단). 이 파일 자체엔 비밀값 없음.
import { createSign, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";

const KEY_ID = "WGX6S9GS9Y";
const ISSUER_ID = "5cd9dfce-33e5-42da-b072-229c40769344";
const KEY_PATH = new URL("../credentials/AuthKey_WGX6S9GS9Y_ce8f24.p8", import.meta.url);

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(readFileSync(KEY_PATH));
  // ES256 은 JOSE raw(R||S) 서명이어야 한다. DER 기본값이면 Apple 이 거부한다.
  const sig = cryptoSign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}

export async function asc(path, method = "GET", body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${method} ${path}\n${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , path, method = "GET", bodyStr] = process.argv;
  const out = await asc(path, method, bodyStr ? JSON.parse(bodyStr) : undefined);
  console.log(JSON.stringify(out, null, 2));
}
