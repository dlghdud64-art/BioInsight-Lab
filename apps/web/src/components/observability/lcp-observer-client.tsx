"use client";

/**
 * §11.246d-3 #lcp-buffered-observer — 호영님 P0 §11.246e baseline 보강.
 * §11.246d-5 — Core Web Vitals 4 metric (LCP/CLS/FID/INP).
 * §11.246d-4 — page unload 시 navigator.sendBeacon 으로 /api/analytics/rum 전송.
 *
 * Silent client component — useEffect mount 시 4 observer 호출 + cleanup.
 * visibilitychange 'hidden' 시점에 RUM beacon 발화 (page exit / tab switch / mobile background).
 * render 0 (DOM 영향 0). layout.tsx body 안 mount.
 */

import { useEffect } from "react";
import {
  observeLCP,
  observeCLS,
  observeFID,
  observeINP,
} from "@/lib/performance/lcp-observer";

export function LcpObserverClient() {
  useEffect(() => {
    // §11.246d-5 — 4 observer 병렬 mount. 각각 cleanup 반환.
    const cleanups = [observeLCP(), observeCLS(), observeFID(), observeINP()];

    // §11.246d-4 — page unload 시 RUM beacon 전송.
    //   visibilitychange 'hidden' 이 가장 안정 (pagehide/beforeunload 보다 모바일 정합 ↑).
    //   navigator.sendBeacon 은 page unload 중에도 fire-and-forget 전송 보장.
    const sendRumBeacon = () => {
      if (typeof window === "undefined") return;
      if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
      const payload = {
        lcp: window.__labaxisLCP?.value,
        cls: window.__labaxisCLS?.value,
        fid: window.__labaxisFID?.value,
        inp: window.__labaxisINP?.value,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent.slice(0, 500),
      };
      // 최소 1 metric 이라도 있을 때만 전송 (빈 beacon 차단).
      if (
        payload.lcp === undefined &&
        payload.cls === undefined &&
        payload.fid === undefined &&
        payload.inp === undefined
      ) {
        return;
      }
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/rum", blob);
      } catch {
        // navigator.sendBeacon 실패 시 silent (best-effort RUM).
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendRumBeacon();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
