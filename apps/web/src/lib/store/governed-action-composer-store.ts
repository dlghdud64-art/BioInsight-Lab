/**
 * Governed Action Composer Store — overlay 열림/닫힘 + 진입점 context
 *
 * 규칙 (CLAUDE.md):
 * - 허용: open state, origin, 진입 context (workbench stage, route, selection)
 * - 금지: canonical truth, execution state, action result
 * - composer는 presentation shell. truth는 기존 store/engine에서 읽는다.
 */

import { create } from "zustand";
import type { ComposerWorkbenchContext } from "@/lib/governed-action/governed-action-intent-engine";
import type { DryRunContext } from "@/lib/governed-action/governed-action-dryrun-engine";

export type ComposerOrigin =
  | "command_palette"
  | "queue_action"
  | "dispatch_dock"
  | "po_created_dock"
  | "rail_context"
  | "direct";

export interface GovernedActionComposerState {
  /** overlay 열림 여부 */
  isOpen: boolean;
  /** 어디서 열었는지 */
  origin: ComposerOrigin;
  /** workbench context (진입점에서 주입) */
  context: ComposerWorkbenchContext | null;
  /** dry-run context (진입점에서 주입) */
  dryRunContext: DryRunContext | null;
}

export interface GovernedActionComposerActions {
  /** composer 열기 — context와 dryRunContext를 함께 주입 */
  openComposer: (opts: {
    origin: ComposerOrigin;
    context: ComposerWorkbenchContext;
    dryRunContext?: DryRunContext | null;
  }) => void;
  /** composer 닫기 */
  closeComposer: () => void;
  /** dryRunContext 갱신 (open 이후 lazy hydration) */
  updateDryRunContext: (ctx: DryRunContext) => void;
}

export const useGovernedActionComposerStore = create<
  GovernedActionComposerState & GovernedActionComposerActions
>((set) => ({
  // ── State ──
  isOpen: false,
  origin: "direct",
  context: null,
  dryRunContext: null,

  // ── Actions ──
  openComposer: ({ origin, context, dryRunContext }) =>
    set({
      isOpen: true,
      origin,
      context,
      dryRunContext: dryRunContext ?? null,
    }),

  closeComposer: () =>
    set({
      isOpen: false,
      context: null,
      dryRunContext: null,
    }),

  updateDryRunContext: (ctx) =>
    set({ dryRunContext: ctx }),
}));
