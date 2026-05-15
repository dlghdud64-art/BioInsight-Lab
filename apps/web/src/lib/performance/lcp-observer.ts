/**
 * §11.246d-3 #lcp-buffered-observer — 호영님 P0 §11.246e baseline 보강 (LCP RUM)
 *
 * 호영님 spec:
 *   - §11.246e baseline 측정 시 LCP entries null 발견 — PerformanceObserver
 *     buffered:true 누락 때문 (page load 이전 발생한 entry 미캡처)
 *   - PerformanceObserver buffered:true 적용으로 이미 발생한 LCP entry 캡처
 *   - Real User Monitoring (RUM) 인프라 기반 — 후속 cluster (FID/CLS/INP) 단초
 *
 * Strategy:
 *   - silent observer (render 0, console.log 0)
 *   - window.__labaxisLCP 으로 가장 최신 LCP 값 expose (debug + Chrome MCP)
 *   - SSR safe (typeof window === "undefined" guard)
 *   - PerformanceObserver 미지원 환경 graceful fallback (no-op)
 *
 * canonical truth lock:
 *   - mutation 0 (silent observer)
 *   - schema 0 / migration 0
 */

// §11.246d-3 — window 객체 augmentation (debug + RUM 측정).
declare global {
  interface Window {
    __labaxisLCP?: {
      value: number;
      element?: string;
      url?: string;
      updatedAt: number;
    };
  }
}

/**
 * PerformanceObserver buffered:true 으로 largest-contentful-paint entry 캡처.
 * 가장 최신 LCP entry 값을 `window.__labaxisLCP` 에 expose.
 *
 * @returns cleanup function (observer.disconnect) — useEffect return 정합
 */
export function observeLCP(): () => void {
  // SSR safe guard — server build 시 window undefined.
  if (typeof window === "undefined") return () => {};

  // PerformanceObserver 미지원 환경 (오래된 browser) graceful fallback.
  if (!("PerformanceObserver" in window)) return () => {};

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      // 마지막 entry 가 가장 최신 LCP value (W3C spec — LCP can update multiple times).
      const last = entries[entries.length - 1] as
        | (PerformanceEntry & { element?: { tagName?: string }; url?: string; size?: number })
        | undefined;
      if (!last) return;

      window.__labaxisLCP = {
        value: last.startTime,
        element: last.element?.tagName,
        url: last.url,
        updatedAt: Date.now(),
      };
    });

    // buffered:true — 이미 발생한 LCP entry 캡처 (호영님 spec 핵심).
    observer.observe({ type: "largest-contentful-paint", buffered: true });

    // useEffect cleanup return.
    return () => {
      try {
        observer.disconnect();
      } catch {
        // already disconnected / browser closed — silent
      }
    };
  } catch {
    // PerformanceObserver constructor 또는 observe() 실패 — silent fallback.
    return () => {};
  }
}
