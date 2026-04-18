/**
 * useOverlayDeepLink — URL query-param 기반 overlay deep-link 지원
 *
 * ?overlay=/dashboard/purchase-orders/{poId}/dispatch 형태의 URL로
 * 직접 접근하면 overlay를 자동으로 연다.
 *
 * 규칙:
 * 1. 마운트 시 1회만 읽고 param을 제거 (뒤로가기 시 재열림 방지)
 * 2. overlay-chrome-store만 조작 — canonical route는 건드리지 않음
 * 3. mobile에서는 overlay 대신 해당 route로 redirect
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useOverlayChromeStore, type OverlayWidthMode } from "@/lib/store/overlay-chrome-store";

const OVERLAY_PARAM = "overlay";
const MODE_PARAM = "overlayMode";
const OVERLAY_MIN_WIDTH = 768;

export function useOverlayDeepLink() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openProgressOverlay = useOverlayChromeStore((s) => s.openProgressOverlay);
  const openWorkbenchOverlay = useOverlayChromeStore((s) => s.openWorkbenchOverlay);
  const didProcess = useRef(false);

  useEffect(() => {
    if (didProcess.current) return;

    const overlayPath = searchParams.get(OVERLAY_PARAM);
    if (!overlayPath) return;

    didProcess.current = true;

    const mode = (searchParams.get(MODE_PARAM) ?? "progress") as OverlayWidthMode;

    // mobile → redirect to full page
    if (typeof window !== "undefined" && window.innerWidth < OVERLAY_MIN_WIDTH) {
      router.replace(overlayPath);
      return;
    }

    // desktop → open overlay + clean URL
    if (mode === "workbench") {
      openWorkbenchOverlay(overlayPath, "direct");
    } else {
      openProgressOverlay(overlayPath, "direct");
    }

    // query param 제거 (history replace — 뒤로가기 시 재열림 방지)
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete(OVERLAY_PARAM);
    newParams.delete(MODE_PARAM);
    const newUrl = newParams.toString()
      ? `${pathname}?${newParams.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router, pathname, openProgressOverlay, openWorkbenchOverlay]);
}
