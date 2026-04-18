/**
 * useOverlayKeyboard — overlay 전용 keyboard shortcut
 *
 * - ESC: overlay 닫기 (Radix가 이미 처리하지만, full overlay outside Radix에 대한 fallback)
 * - Cmd/Ctrl+Shift+W: progress ↔ workbench 전환
 *
 * DashboardShell에서 1회 마운트.
 */

"use client";

import { useEffect } from "react";
import { useOverlayChromeStore } from "@/lib/store/overlay-chrome-store";

export function useOverlayKeyboard() {
  const isOpen = useOverlayChromeStore((s) => s.isOpen);
  const widthMode = useOverlayChromeStore((s) => s.widthMode);
  const closeOverlay = useOverlayChromeStore((s) => s.closeOverlay);
  const expandToWorkbench = useOverlayChromeStore((s) => s.expandToWorkbench);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      // ESC fallback — Radix가 이미 처리하지만 혹시 모를 edge case
      if (e.key === "Escape" && !e.defaultPrevented) {
        closeOverlay();
        return;
      }

      // Cmd/Ctrl+Shift+W: progress → workbench 전환
      if (
        e.key === "W" &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        widthMode === "progress"
      ) {
        e.preventDefault();
        expandToWorkbench();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, widthMode, closeOverlay, expandToWorkbench]);
}
