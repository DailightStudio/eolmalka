"use client";

import { useEffect, useState } from "react";

type PermState = "default" | "granted" | "denied" | "unsupported";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function NotifyButton() {
  const [perm, setPerm] = useState<PermState>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission as PermState);
    // 이미 구독 상태인지 확인
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        // 무시
      }
    })();
  }, []);

  const enable = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!VAPID_PUBLIC) {
        setErr("VAPID 공개키가 설정되지 않았습니다. .env.local 확인.");
        return;
      }
      const granted = await Notification.requestPermission();
      setPerm(granted as PermState);
      if (granted !== "granted") {
        setErr("알림 권한이 거부되었습니다.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch (e) {
      console.warn(e);
      setErr("구독 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setErr(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setErr("해제 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (perm === "unsupported") {
    return (
      <p className="text-[11px] text-zinc-600">
        이 브라우저는 웹 푸시를 지원하지 않습니다. (홈 화면 추가 후 재시도 권장)
      </p>
    );
  }

  return (
    <div>
      {subscribed ? (
        <button
          type="button"
          disabled={busy}
          onClick={disable}
          className="w-full rounded-2xl border border-lime-500/40 bg-lime-500/15 px-4 py-3 text-sm font-semibold text-lime-300 disabled:opacity-50"
        >
          {busy ? "처리 중..." : "✓ 알림 켜짐 — 끄기"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || perm === "denied"}
          onClick={enable}
          className="w-full rounded-2xl bg-lime-500 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
        >
          {busy ? "권한 요청 중..." : perm === "denied" ? "알림 차단됨 (브라우저 설정에서 해제)" : "🔔 가격 알림 받기"}
        </button>
      )}
      {err && <p className="mt-2 text-[11px] text-rose-400">{err}</p>}
    </div>
  );
}

// VAPID 공개키(URL-safe base64) → Uint8Array
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
