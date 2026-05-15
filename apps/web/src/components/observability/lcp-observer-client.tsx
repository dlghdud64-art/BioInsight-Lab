"use client";

/**
 * §11.246d-3 #lcp-buffered-observer — 호영님 P0 §11.246e baseline 보강.
 *
 * Silent client component — useEffect mount 시 observeLCP() 호출 + cleanup.
 * render 0 (DOM 영향 0). layout.tsx body 안 mount.
 *
 * canonical truth lock:
 *   - Provider stack / children 위치 변경 0
 *   - mutation 0 / schema 0
 */

import { useEffect } from "react";
import { observeLCP } from "@/lib/performance/lcp-observer";

export function LcpObserverClient() {
  useEffect(() => {
    const cleanup = observeLCP();
    return cleanup;
  }, []);

  return null;
}
