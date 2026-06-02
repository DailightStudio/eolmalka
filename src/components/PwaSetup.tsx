"use client";

import { useEffect } from "react";

// 클라이언트에서 Service Worker 등록.
// dev 환경에서도 등록되도록 한다 (HMR과 충돌 없음, 캐시는 가벼움).
export function PwaSetup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        console.warn("[PWA] SW 등록 실패:", e);
      }
    };
    // 페이지 로드 후 한 박자 미뤄 등록(메인 스레드 양보)
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
