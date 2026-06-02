// eolmalka Service Worker
// 역할: ① 오프라인 셸 캐시 (앱 셸 패턴) ② 푸시 알림 수신 + 클릭 처리
// 발송 측 구현은 다음 라운드(/api/push/send + Vercel Cron).

const CACHE = "eolmalka-v1";

// 설치: 즉시 활성화로 전환
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// 활성화: 오래된 캐시 정리 + 클라이언트 즉시 점유
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// 네트워크 우선 + 실패 시 캐시 폴백 (SSR/ISR과 잘 어울림)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // API 라우트는 캐시 안 함 (실시간성 우선)
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // 최후의 폴백: 루트 페이지 캐시
        const fallback = await caches.match("/");
        if (fallback) return fallback;
        return new Response("오프라인입니다.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});

// ── 푸시 알림 ────────────────────────────────────────
// 발송 서버(/api/push/send)가 web-push로 보낸 payload 형태:
// { title, body, url, tag, icon }
self.addEventListener("push", (event) => {
  let data = { title: "얼말까", body: "가격 알림" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload 없거나 JSON 아님
  }
  const options = {
    body: data.body,
    icon: data.icon ?? "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url ?? "/" },
    tag: data.tag,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 알림 클릭: 해당 URL로 이동 (이미 열려있으면 포커스)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
