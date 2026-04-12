/**
 * Overlay Chrome Store — UI shell state only
 *
 * 규칙 (CLAUDE.md):
 * - 허용: isOpen, origin, widthMode, activeTab, animation state
 * - 금지: activeCase truth, approval baseline, dispatch readiness, send status
 * - case identity와 canonical data는 route param + existing store/engine에서 읽는다.
 * - overlay는 presentation shell이고, truth는 기존 경로를 따른다.
 */

import { create } from "zustand";

export type OverlayWidthMode = "progress" | "workbench";
export type OverlayOrigin = "dashboard" | "queue" | "card" | "direct";

export interface OverlayChromeState {
  /** overlay 열림 여부 (animation 기준) */
  isOpen: boolean;
  /** 어디서 열었는지 (close 시 돌아갈 context) */
  origin: OverlayOrigin;
  /** progress panel vs full workbench */
  widthMode: OverlayWidthMode;
  /** overlay 내 마지막 활성 탭 (상태 유지용) */
  activeTab: string | null;
  /** 현재 overlay가 가리키는 route path (back 처리용) */
  overlayRoutePath: string | null;
}

export interface OverlayChromeActions {
  openProgressOverlay: (routePath: string, origin?: OverlayOrigin) => void;
  openWorkbenchOverlay: (routePath: string, origin?: OverlayOrigin) => void;
  expandToWorkbench: () => void;
  closeOverlay: () => void;
  setActiveTab: (tab: string) => void;
}

export const useOverlayChromeStore = create<OverlayChromeState & OverlayChromeActions>((set) => ({
  // ── State ──
  isOpen: false,
  origin: "dashboard",
  widthMode: "progress",
  activeTab: null,
  overlayRoutePath: null,

  // ── Actions ──
  openProgressOverlay: (routePath, origin = "dashboard") =>
    set({
      isOpen: true,
      widthMode: "progress",
      origin,
      overlayRoutePath: routePath,
      activeTab: null,
    }),

  openWorkbenchOverlay: (routePath, origin = "dashboard") =>
    set({
      isOpen: true,
      widthMode: "workbench",
      origin,
      overlayRoutePath: routePath,
      activeTab: null,
    }),

  expandToWorkbench: () =>
    set({ widthMode: "workbench" }),

  closeOverlay: () =>
    set({
      isOpen: false,
      overlayRoutePath: null,
      activeTab: null,
    }),

  setActiveTab: (tab) =>
    set({ activeTab: tab }),
}));
