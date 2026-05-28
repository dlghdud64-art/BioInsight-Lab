"use client";

/**
 * GovernedActionComposerBridge — store ↔ GovernedActionComposer 연결
 *
 * dashboard-shell에 마운트되어, store state를 composer props로 전달.
 * execution callback은 기존 governance event bus를 통해 처리.
 */

import { useCallback } from "react";
import { GovernedActionComposer } from "./governed-action-composer";
import { useGovernedActionComposerStore } from "@/lib/store/governed-action-composer-store";
import type { GovernedActionProposal } from "@/lib/governed-action/governed-action-dryrun-engine";
import { getGlobalGovernanceEventBus } from "@/lib/ai/governance-event-bus";

/** intent → governance domain 매핑 */
const INTENT_DOMAIN_MAP: Record<string, "dispatch_prep" | "dispatch_execution" | "quote_chain"> = {
  dispatch_now: "dispatch_execution",
  schedule_dispatch: "dispatch_execution",
  request_correction: "dispatch_prep",
  cancel_dispatch_prep: "dispatch_prep",
  prepare_quote_request: "quote_chain",
  send_quote_request: "quote_chain",
  finalize_approval: "quote_chain",
  convert_quote_to_po: "quote_chain",
  reopen_po_conversion: "quote_chain",
  receive_order: "dispatch_execution",
  trigger_reorder: "dispatch_execution",
  reserve_budget: "quote_chain",
  release_budget: "quote_chain",
};

export function GovernedActionComposerBridge() {
  const { isOpen, context, dryRunContext, closeComposer } =
    useGovernedActionComposerStore();

  const handleExecute = useCallback((proposal: GovernedActionProposal) => {
    // governance event bus를 통해 실행 이벤트 발행
    // 실제 mutation은 각 domain의 action handler가 수행
    const bus = getGlobalGovernanceEventBus();
    const domain = INTENT_DOMAIN_MAP[proposal.intentType] ?? "dispatch_prep";
    const primaryRecordId = proposal.affectedRecords[0]?.entityId ?? "";

    bus.publish({
      eventId: `ga_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      domain,
      eventType: `governed_action_${proposal.intentType}`,
      caseId: primaryRecordId,
      poNumber: primaryRecordId,
      fromStatus: proposal.affectedRecords[0]?.currentStatus ?? "",
      toStatus: proposal.affectedRecords[0]?.projectedStatus ?? "",
      actor: "operator",
      timestamp: new Date().toISOString(),
      detail: `Governed action executed: ${proposal.actionLabel}`,
      severity: proposal.irreversible ? "critical" : "info",
      chainStage: null,
      affectedObjectIds: proposal.affectedRecords.map((r) => r.entityId),
      payload: {
        intentType: proposal.intentType,
        irreversible: proposal.irreversible,
        willMutateSupplierFacingState: proposal.willMutateSupplierFacingState,
      },
    });

    // 실행 후 composer 닫기 (실제 mutation 결과는 bus 구독자가 처리)
    setTimeout(() => closeComposer(), 1200);
  }, [closeComposer]);

  return (
    <GovernedActionComposer
      open={isOpen}
      onClose={closeComposer}
      context={context}
      dryRunContext={dryRunContext}
      onExecute={handleExecute}
    />
  );
}
