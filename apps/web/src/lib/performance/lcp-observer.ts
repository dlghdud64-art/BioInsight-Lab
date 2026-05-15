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
// §11.246d-5 #web-vitals-cls-fid-inp — Core Web Vitals 4 metric (LCP/CLS/FID/INP)
//   모두 expose. observeCLS/FID/INP 추가 export. 기존 LCP API 보존.
declare global {
  interface Window {
    __labaxisLCP?: {
      value: number;
      element?: string;
      url?: string;
      updatedAt: number;
    };
    __labaxisCLS?: {
      value: number;
      entryCount: number;
      updatedAt: number;
    };
    __labaxisFID?: {
      value: number;
      eventType?: string;
      updatedAt: number;
    };
    __labaxisINP?: {
      value: number;
      eventType?: string;
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

/**
 * §11.246d-5 #web-vitals-cls-fid-inp — CLS (Cumulative Layout Shift) observer.
 *   layout-shift entry 누적 합산. hadRecentInput=true 는 사용자 의도적 input 으로 인한
 *   shift 이므로 제외 (W3C CLS spec).
 *   window.__labaxisCLS = { value, entryCount, updatedAt } expose.
 */
export function observeCLS(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!("PerformanceObserver" in window)) return () => {};

  let clsValue = 0;
  let entryCount = 0;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ls = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        // hadRecentInput=true 제외 — 사용자 의도적 클릭/입력 후 100ms 내 발생한 shift.
        if (ls.hadRecentInput) continue;
        clsValue += ls.value ?? 0;
        entryCount += 1;
      }
      window.__labaxisCLS = {
        value: clsValue,
        entryCount,
        updatedAt: Date.now(),
      };
    });

    observer.observe({ type: "layout-shift", buffered: true });

    return () => {
      try {
        observer.disconnect();
      } catch {
        // silent
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * §11.246d-5 #web-vitals-cls-fid-inp — FID (First Input Delay) observer.
 *   first-input entry 의 processingStart - startTime = input delay.
 *   legacy metric (web-vitals 가 INP 으로 대체 권장) 이지만 호영님 spec 정합 위해 보존.
 *   window.__labaxisFID = { value, eventType, updatedAt } expose.
 */
export function observeFID(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!("PerformanceObserver" in window)) return () => {};

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const first = entries[0] as
        | (PerformanceEntry & { processingStart?: number; name?: string })
        | undefined;
      if (!first || first.processingStart === undefined) return;

      window.__labaxisFID = {
        value: first.processingStart - first.startTime,
        eventType: first.name,
        updatedAt: Date.now(),
      };
    });

    observer.observe({ type: "first-input", buffered: true });

    return () => {
      try {
        observer.disconnect();
      } catch {
        // silent
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * §11.246d-5 #web-vitals-cls-fid-inp — INP (Interaction to Next Paint) observer.
 *   event entry 의 duration 최대값 = interaction latency.
 *   web-vitals 2024 표준 (FID 대체). pointerdown / keydown / click 등 event type
 *   에 대해 duration tracking.
 *   window.__labaxisINP = { value, eventType, updatedAt } expose.
 */
export function observeINP(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!("PerformanceObserver" in window)) return () => {};

  let maxDuration = 0;
  let maxEventType: string | undefined;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ev = entry as PerformanceEntry & { duration?: number; name?: string; interactionId?: number };
        // interactionId === 0 은 non-interactive event (예: scroll) — 제외.
        if (!ev.interactionId) continue;
        const dur = ev.duration ?? 0;
        if (dur > maxDuration) {
          maxDuration = dur;
          maxEventType = ev.name;
          window.__labaxisINP = {
            value: maxDuration,
            eventType: maxEventType,
            updatedAt: Date.now(),
          };
        }
      }
    });

    // durationThreshold 16 (기본) — 16ms 이하 event 는 보고 안 됨 (1 frame budget).
    observer.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);

    return () => {
      try {
        observer.disconnect();
      } catch {
        // silent
      }
    };
  } catch {
    return () => {};
  }
}
