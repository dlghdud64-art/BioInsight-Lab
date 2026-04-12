/**
 * useWorkbenchOverlayOpen — overlay 열기 진입점 hook
 *
 * 규칙:
 * 1. desktop wide (md+) → overlay-chrome-store를 통해 overlay 열기
 * 2. mobile/narrow → router.push로 full-page 이동 (fallback)
 * 3. overlay는 route-backed — overlayRoutePath에 canonical route를 저장
 * 4. 호출자는 caseId/poId + route만 제공, overlay mode 판단은 이 hook이 담당
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useOverlayChromeStore,
  type OverlayOrigin,
  type OverlayWidthMode,
} from "@/lib/store/overlay-chrome-store";

// ── Width threshold: md breakpoint (768px) ──
const OVERLAY_MIN_WIDTH = 768;

function isDesktopWide(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= OVERLAY_MIN_WIDTH;
}

export interface OpenWorkbenchOverlayOptions {
  /** canonical route path (e.g., /dashboard/purchase-orders/abc/dispatch) */
  routePath: string;
  /** 어디서 열었는지 */
  origin?: OverlayOrigin;
  /** progress overlay vs full workbench */
  mode?: OverlayWidthMode;
}

/**
 * Returns a function that opens the workbench overlay on desktop,
 * or navigates to the full page on mobile.
 */
export function useWorkbenchOverlayOpen() {
  const router = useRouter();
  const openProgressOverlay = useOverlayChromeStore((s) => s.openProgressOverlay);
  const openWorkbenchOverlay = useOverlayChromeStore((s) => s.openWorkbenchOverlay);

  const openOverlay = useCallback(
    (opts: OpenWorkbenchOverlayOptions) => {
      const { routePath, origin = "dashboard", mode = "progress" } = opts;

      // Mobile/narrow → full-page fallback
      if (!isDesktopWide()) {
        router.push(routePath);
        return;
      }

      // Desktop → overlay
      if (mode === "workbench") {
        openWorkbenchOverlay(routePath, origin);
      } else {
        openProgressOverlay(routePath, origin);
      }
    },
    [router, openProgressOverlay, openWorkbenchOverlay],
  );

  return openOverlay;
}
