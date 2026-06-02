// POST  /api/push/subscribe  — 클라가 발급받은 push subscription 저장
// DELETE /api/push/subscribe  — endpoint로 구독 제거
// 저장소는 다음 라운드(Vercel KV) 도입 전엔 로그만. 그래도 클라는 정상 동작.

import { NextResponse } from "next/server";

type SubscriptionPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

export async function POST(req: Request) {
  let body: SubscriptionPayload;
  try {
    body = (await req.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  // TODO: Vercel KV에 저장 (다음 라운드)
  //   await kv.hset(`sub:${hash(body.endpoint)}`, { ...body, createdAt: Date.now() })
  console.log("[push/subscribe] new", body.endpoint.slice(0, 60) + "…");
  return NextResponse.json({ ok: true, stored: false });
}

export async function DELETE(req: Request) {
  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  }
  console.log("[push/subscribe] remove", body.endpoint.slice(0, 60) + "…");
  return NextResponse.json({ ok: true });
}
