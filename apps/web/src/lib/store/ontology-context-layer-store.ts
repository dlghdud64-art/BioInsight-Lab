/**
 * ontology-context-layer-store.ts
 *
 * Zustand store for Ontology Contextual Action Layer overlay state.
 *
 * DESIGN:
 * - overlay open/close state
 * - current resolved actions from next-action-resolver
 * - sourcing page context bridge (compareIds, quoteItems 등)
 * - canonical truth를 변경하지 않음 — 표시 전용
 */

import { create } from "zustand";
import type {
  ResolvedNextActionResult,
  ContextualActionInput,
  ContextualCounts,
  AppRoute,
  WorkflowStage,
  ContextualBlocker,
  SourcingContextDetail,
  SourceContext,
} from "@/lib/ontology/contextual-action/ontology-next-action-resolver";
import {
  resolveNextAction,
  classifyRoute,
} from "@/lib/ontology/contextual-action/ontology-next-action-resolver";

// ══════════════════════════════════════════════
// Store State
// ══════════════════════════════════════════════

interface OntologyContextLayerState {
  /** Overlay open state */
  isOpen: boolean;

  /** Last resolved result */
  resolved: ResolvedNextActionResult | null;

  /** Current context input (for re-resolution) */
  currentInput: ContextualActionInput | null;

  // ── Actions ──

  /** Open the overlay — resolves actions from current context */
  open: (pathname: string, context: Partial<OntologyContextBridgeData>) => void;

  /** Close the overlay */
  close: () => void;

  /** Update context without opening (e.g., when page state changes) */
  updateContext: (pathname: string, context: Partial<OntologyContextBridgeData>) => void;

  /** Re-resolve from current input */
  reResolve: () => void;
}

/** Bridge data from page components to the resolver */
export interface OntologyContextBridgeData {
  compareIds: string[];
  quoteItems: Array<{ id: string; productId?: string }>;
  selectedEntityIds: string[];
  selectedEntityType: ContextualActionInput["selectedEntityType"];
  currentStage: WorkflowStage | null;
  activeBlockers: ContextualBlocker[];
  snapshotValid: boolean;
  policyHoldActive: boolean;
  hasPendingCriticalEvents: boolean;
  activeWorkWindow: string | null;
  counts: Partial<ContextualCounts>;
  /** Sourcing-specific enrichment data */
  sourcingDetail?: SourcingContextDetail;
  /** Source route/entity when user entered support/help mid-workflow */
  sourceContext?: SourceContext | null;
}

const DEFAULT_COUNTS: ContextualCounts = {
  compareIds: 0,
  quoteItems: 0,
  pendingQuotes: 0,
  pendingApprovals: 0,
  activePoConversions: 0,
  dispatchPrepItems: 0,
  pendingReceiving: 0,
};

function buildInput(
  pathname: string,
  bridge: Partial<OntologyContextBridgeData>,
): ContextualActionInput {
  const route: AppRoute = classifyRoute(pathname);

  return {
    currentRoute: route,
    selectedEntityIds: bridge.selectedEntityIds ?? [],
    selectedEntityType: bridge.selectedEntityType ?? "none",
    currentStage: bridge.currentStage ?? null,
    activeBlockers: bridge.activeBlockers ?? [],
    snapshotValid: bridge.snapshotValid ?? true,
    policyHoldActive: bridge.policyHoldActive ?? false,
    hasPendingCriticalEvents: bridge.hasPendingCriticalEvents ?? false,
    activeWorkWindow: bridge.activeWorkWindow ?? null,
    counts: {
      ...DEFAULT_COUNTS,
      compareIds: bridge.compareIds?.length ?? bridge.counts?.compareIds ?? 0,
      quoteItems: bridge.quoteItems?.length ?? bridge.counts?.quoteItems ?? 0,
      ...bridge.counts,
    },
    sourcingDetail: bridge.sourcingDetail,
    sourceContext: bridge.sourceContext ?? null,
  };
}

// ══════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════

export const useOntologyContextLayerStore = create<OntologyContextLayerState>((set, get) => ({
  isOpen: false,
  resolved: null,
  currentInput: null,

  open: (pathname, context) => {
    const input = buildInput(pathname, context);
    const resolved = resolveNextAction(input);
    // resolved === null 이면 ontology panel 노출 대상이 아님 (support direct entry 등).
    // 호출자가 open() 을 불러도 열지 않는다 — "아무데서나 뜨는" global launcher 회귀 방지.
    if (!resolved) {
      set({ isOpen: false, resolved: null, currentInput: input });
      return;
    }
    set({ isOpen: true, resolved, currentInput: input });
  },

  close: () => {
    set({ isOpen: false });
  },

  updateContext: (pathname, context) => {
    const input = buildInput(pathname, context);
    const resolved = resolveNextAction(input);
    // resolved 가 null 로 바뀌면 열려 있던 panel 도 닫는다.
    set((s) => ({
      resolved,
      currentInput: input,
      isOpen: resolved ? s.isOpen : false,
    }));
  },

  reResolve: () => {
    const { currentInput } = get();
    if (!currentInput) return;
    const resolved = resolveNextAction(currentInput);
    set((s) => ({
      resolved,
      isOpen: resolved ? s.isOpen : false,
    }));
  },
}));
