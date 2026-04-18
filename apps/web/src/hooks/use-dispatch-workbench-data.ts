/**
 * useDispatchWorkbenchData — dispatch workbench의 governance 계산 + 데이터 로딩 hook
 *
 * 규칙:
 * 1. canonical truth (PurchaseOrderContract)는 read-only 소비만.
 * 2. governance computation은 PO/approval/comparison 입력이 바뀔 때만 재계산.
 * 3. 이 hook은 UI를 렌더하지 않는다 — pure data/computation layer.
 * 4. page와 overlay 모두에서 동일한 governance 결과를 보장한다.
 *
 * 사용처:
 * - /dashboard/purchase-orders/[poId]/dispatch/page.tsx (full-page)
 * - WorkbenchOverlayShell (overlay mode)
 */

"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { useDispatchOutboundStore } from "@/lib/store/dispatch-outbound-store";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import {
  emitPoDataChangedAfterApproval,
  emitDispatchPrepReadinessChanged,
  emitDispatchPrepBlocked,
  emitDispatchPrepSendScheduled,
  emitDispatchPrepCancelled,
  type DispatchReadinessState,
} from "@/lib/ai/dispatch-prep-invalidation";
import {
  shouldPublishWithServer as shouldPublish,
  markPublishedWithServer as markPublished,
} from "@/lib/persistence/governance-event-dedupe-client";
import {
  ensureApprovalSnapshotWithServer as ensureApprovalSnapshotAsync,
  getApprovalSnapshotWithServer as getApprovalSnapshotAsync,
} from "@/lib/persistence/approval-baseline-client";
import {
  ensureApprovalSnapshot,
  getApprovalSnapshot,
  type ApprovalPoSnapshot,
} from "@/lib/ai/approval-snapshot-store";
import {
  evaluateDispatchGovernance,
  buildDispatchPolicySurface,
  type DispatchPreparationGovernanceState,
} from "@/lib/ai/po-dispatch-governance-engine";
import {
  evaluateDispatchSendPrecondition,
  type DispatchSendPreconditionResult,
} from "@/lib/ontology/dispatch/dispatch-send-precondition";
import { buildPoCreatedRecord } from "@/lib/ai/po-created-record";
import type { PoCreatedState, PoCreatedBasis } from "@/lib/ai/po-created-engine";
import { buildPoCreatedDecisionOptions } from "@/lib/ai/po-created-engine";
import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  RequiredDocumentType,
} from "@/lib/review-queue/po-approval-contract";
import type { QuoteComparisonContract } from "@/lib/review-queue/quote-rfq-contract";
import type { DispatchRailContext, SupplierFacingPayloadPreview } from "@/components/approval/dispatch-prep-workbench";

// ══════════════════════════════════════════════
// Helper functions (extracted from page)
// ══════════════════════════════════════════════

const REQUIRED_DOC_LABEL: Record<RequiredDocumentType, string> = {
  coa: "COA",
  msds: "MSDS",
  validation: "검증서",
  warranty: "보증서",
};

function aggregateRequiredDocuments(po: PurchaseOrderContract): string[] {
  const set = new Set<string>();
  for (const line of po.lines) {
    for (const doc of line.requiredDocuments ?? []) {
      set.add(REQUIRED_DOC_LABEL[doc] ?? doc);
    }
  }
  return Array.from(set);
}

function deriveApprovalSnapshotValid(approval: ApprovalExecutionContract | undefined): boolean {
  if (!approval) return false;
  if (approval.status !== "approved") return false;
  if (approval.blockers.length > 0) return false;
  return true;
}

function deriveConversionSnapshotValid(po: PurchaseOrderContract): boolean {
  return po.status !== "draft" && po.status !== "cancelled";
}

function deriveQuoteSnapshotValid(comparison: QuoteComparisonContract | undefined): boolean {
  if (!comparison) return true;
  return comparison.comparisonStatus === "selected" || comparison.comparisonStatus === "converted";
}

function deriveSnapshotInvalidationReason(
  approval: ApprovalExecutionContract | undefined,
  po: PurchaseOrderContract,
  comparison: QuoteComparisonContract | undefined,
): string {
  if (!approval) return "승인 실행 없음 — 재승인 요청";
  if (approval.status === "rejected") return "승인 거부됨 — 재제출 필요";
  if (approval.status === "returned") return "승인 반송 — 보완 후 재제출";
  if (approval.status === "cancelled" || approval.status === "expired") return "승인 만료/취소 — 재승인 요청";
  if (approval.blockers.length > 0) return `승인 차단 사유: ${approval.blockers.join(", ")}`;
  if (po.status === "draft") return "PO 초안 상태 — PO 전환 재실행 필요";
  if (po.status === "cancelled") return "PO 취소 — 재생성 필요";
  if (comparison && comparison.comparisonStatus !== "selected" && comparison.comparisonStatus !== "converted") {
    return "견적 shortlist 미확정 — 비교 결정 필요";
  }
  return "";
}

function diffPoAgainstApprovalBaseline(
  po: PurchaseOrderContract,
  baseline: ApprovalPoSnapshot | null,
): string[] {
  if (!baseline) return [];
  const fields: string[] = [];
  if (baseline.totalAmount !== po.totalAmount) fields.push(`총금액 ${baseline.totalAmount.toLocaleString()} → ${po.totalAmount.toLocaleString()}`);
  if (baseline.vendorId !== po.vendorId) fields.push(`공급사 ${baseline.vendorId} → ${po.vendorId}`);
  if ((baseline.paymentTerms ?? "") !== (po.paymentTerms ?? "")) fields.push("결제조건 변경");
  if ((baseline.incoterms ?? "") !== (po.incoterms ?? "")) fields.push("무역조건 변경");
  if (baseline.shippingRegion !== po.shippingRegion) fields.push("배송지역 변경");
  if (baseline.billToEntity !== po.billToEntity) fields.push("청구법인 변경");
  if (baseline.shipToLocation !== po.shipToLocation) fields.push("배송지 변경");
  if ((baseline.notes ?? "") !== (po.notes ?? "")) fields.push("비고 변경");
  if (baseline.lineCount !== (po.lines?.length ?? 0)) fields.push(`라인 수 ${baseline.lineCount} → ${po.lines?.length ?? 0}`);
  return fields;
}

function buildBasisFromPo(po: PurchaseOrderContract): PoCreatedBasis {
  return {
    vendorIds: [po.vendorId],
    lineCoverageSummary: `${po.lines.length}개 품목`,
    paymentTerm: po.paymentTerms ?? "",
    billingReference: po.billToEntity ?? "",
    deliveryTarget: po.requiredByAt ?? "",
    receivingInstruction: po.shipToLocation ?? "",
    shipToReference: po.shipToLocation ?? "",
    internalNote: po.notes ?? "",
    supplierNote: "",
    commercialSummary: po.paymentTerms ? "결제 조건 확인됨" : "결제 조건 미확인",
    operationalSummary: po.shipToLocation ? "배송지 확인됨" : "배송지 미확인",
  };
}

function buildPoCreatedStateFromPo(po: PurchaseOrderContract): PoCreatedState {
  const basis = buildBasisFromPo(po);
  const sendCriticalMissingCount =
    (basis.vendorIds.length === 0 ? 1 : 0) +
    (!basis.paymentTerm ? 1 : 0) +
    (!basis.shipToReference ? 1 : 0) +
    (!basis.deliveryTarget ? 1 : 0) +
    (!basis.receivingInstruction ? 1 : 0);

  return {
    poCreatedStatus: "po_created_open",
    substatus: sendCriticalMissingCount > 0 ? "missing_operational_completion" : "awaiting_send_readiness_review",
    poCreatedOpenedAt: po.createdAt,
    poCreatedOpenedBy: "conversion_handoff",
    poConversionDraftObjectId: `draft_${po.id}`,
    approvalDecisionObjectId: po.approvalExecutionId ?? `approval_${po.id}`,
    requestSubmissionEventId: `submit_${po.id}`,
    createdVendorCount: 1,
    createdLineCount: po.lines.length,
    createdCommercialFieldCount: basis.paymentTerm ? 1 : 0,
    createdOperationalFieldCount: basis.shipToReference ? 1 : 0,
    missingFieldCount: sendCriticalMissingCount,
    poCreatedBlockedFlag: false,
    poCreatedBlockedReason: null,
    poCreatedObjectId: `pocreated_${po.id}`,
    createdBasis: basis,
  };
}

function buildDispatchGovernanceFromPo(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  comparison: QuoteComparisonContract | undefined,
  vendorName: string,
  approvalBaseline: ApprovalPoSnapshot | null,
): DispatchPreparationGovernanceState {
  const approvalSnapshotValid = deriveApprovalSnapshotValid(approval);
  const conversionSnapshotValid = deriveConversionSnapshotValid(po);
  const quoteSnapshotValid = deriveQuoteSnapshotValid(comparison);
  const allValid = approvalSnapshotValid && conversionSnapshotValid && quoteSnapshotValid;
  const snapshotInvalidationReason = allValid
    ? ""
    : deriveSnapshotInvalidationReason(approval, po, comparison);

  const policyHoldActive = po.status === "on_hold";
  const policyHoldReason = policyHoldActive
    ? po.notes?.trim() || "발주가 보류 상태"
    : "";

  const baselineChangeDetails = diffPoAgainstApprovalBaseline(po, approvalBaseline);
  const dataChangedByTimestamp = (() => {
    if (!po.updatedAt) return false;
    if (po.updatedAt === po.createdAt) return false;
    const approvalDecidedAt = approval?.finalDecisionAt;
    if (!approvalDecidedAt) return false;
    return po.updatedAt > approvalDecidedAt;
  })();
  const dataChangedAfterApproval = approvalBaseline
    ? baselineChangeDetails.length > 0
    : dataChangedByTimestamp;

  const requiredDocuments = aggregateRequiredDocuments(po);
  const attachedDocuments = (po.attachments ?? []).map((a) => a.name);

  return evaluateDispatchGovernance({
    caseId: po.id,
    poNumber: po.poNumber,
    approvalSnapshotValid,
    conversionSnapshotValid,
    snapshotInvalidationReason,
    supplierContactEmail: vendorName ? `contact@${vendorName.replace(/\s+/g, "").toLowerCase()}.example` : "",
    supplierContactName: vendorName,
    shippingAddress: po.shipToLocation ?? "",
    billingAddress: po.billToEntity ?? "",
    paymentTerms: po.paymentTerms ?? "",
    deliveryTerms: po.incoterms ?? "",
    requiredDocuments,
    attachedDocuments,
    policyHoldActive,
    policyHoldReason,
    dataChangedAfterApproval,
    changeDetails: baselineChangeDetails,
    supplierProfileChanged: false,
    supplierProfileChangeDetail: "",
    lockedFields: ["vendorId", "totalAmount", "lines"],
    actor: po.ownerId ?? "operator",
  });
}

function buildSupplierPayloadFromPo(
  po: PurchaseOrderContract,
  vendorName: string,
): SupplierFacingPayloadPreview {
  return {
    recipientName: vendorName,
    recipientEmail: vendorName ? `contact@${vendorName.replace(/\s+/g, "").toLowerCase()}.example` : "",
    sendChannel: "email",
    poSummaryLines: po.lines.slice(0, 5).map((l) => `${l.itemName} × ${l.orderedQuantity}`),
    deliveryReference: po.shipToLocation ?? "",
    paymentReference: po.paymentTerms ?? "",
    attachmentNames: (po.attachments ?? []).map((a) => a.name),
    supplierNote: po.notes ?? "",
  };
}

function buildRailContextFromPo(
  po: PurchaseOrderContract,
  vendorName: string,
): DispatchRailContext {
  return {
    approvalRationale: po.approvalExecutionId
      ? `승인 실행 ${po.approvalExecutionId} 기준으로 발송 준비 진행`
      : "승인 근거 없음 — 재승인 필요",
    quoteShortlistReason: po.quoteRequestId
      ? `견적 ${po.quoteRequestId} 선정 결과 기반`
      : "견적 연결 없음 (manual)",
    supplierProfile: `${vendorName} · ${po.shippingRegion ?? "지역 미지정"}`,
    supplierRoutingExplanation: po.incoterms
      ? `Incoterms ${po.incoterms} 기준 라우팅`
      : "기본 라우팅 — Incoterms 미지정",
  };
}

// ══════════════════════════════════════════════
// Hook return type
// ══════════════════════════════════════════════

export interface DispatchWorkbenchData {
  /** null if PO not found */
  po: PurchaseOrderContract | null;
  vendorName: string;
  poCreatedState: PoCreatedState;
  dispatchGovernance: DispatchPreparationGovernanceState;
  dispatchPolicySurface: ReturnType<typeof buildDispatchPolicySurface>;
  decisionOptions: ReturnType<typeof buildPoCreatedDecisionOptions>;
  record: ReturnType<typeof buildPoCreatedRecord>;
  supplierPayload: SupplierFacingPayloadPreview;
  railContext: DispatchRailContext;
  /**
   * Send action 의 마지막 정문(turnstile).
   * dock 의 Send now / Schedule send 버튼 enable/disable 의 단일 source of truth.
   * handler 는 mutation 직전에도 다시 한 번 검증한다 (UI race 방어).
   */
  sendPrecondition: DispatchSendPreconditionResult;
}

export interface DispatchWorkbenchHandlers {
  handleSendNow: () => void;
  handleScheduleSend: (date: string) => void;
  handleRequestCorrection: (reason: string) => void;
  handleReopenConversion: () => void;
  handleCancelPrep: () => void;
}

// ══════════════════════════════════════════════
// Main hook
// ══════════════════════════════════════════════

export function useDispatchWorkbenchData(
  poId: string,
  options?: {
    /** navigation callback — overlay와 page에서 다르게 동작 */
    onNavigate?: (path: string) => void;
  },
): {
  data: DispatchWorkbenchData | null;
  handlers: DispatchWorkbenchHandlers;
  isLoading: boolean;
} {
  const store = useOpsStore();
  const scheduleSend = useDispatchOutboundStore((s) => s.scheduleSend);
  const cancelDispatchPrep = useDispatchOutboundStore((s) => s.cancelDispatchPrep);
  const navigate = options?.onNavigate;

  const [baselineVersion, setBaselineVersion] = useState(0);

  // ── Approval baseline pre-fetch ──
  useEffect(() => {
    const poNumber = store.purchaseOrders.find((p) => p.id === poId)?.poNumber || poId;
    const localBaseline = getApprovalSnapshot(poNumber);
    if (localBaseline) return;
    getApprovalSnapshotAsync(poNumber).then((serverBaseline) => {
      if (serverBaseline) {
        ensureApprovalSnapshot(serverBaseline);
        setBaselineVersion((v) => v + 1);
      }
    });
  }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps

  const po = useMemo(
    () => store.purchaseOrders.find((p) => p.id === poId) ?? null,
    [store.purchaseOrders, poId],
  );

  const approval = useMemo(
    () => store.approvalExecutions.find((ae) => ae.entityId === poId),
    [store.approvalExecutions, poId],
  );

  const quoteComparison = useMemo(
    () =>
      po?.quoteComparisonId
        ? store.quoteComparisons.find((qc) => qc.id === po.quoteComparisonId)
        : undefined,
    [store.quoteComparisons, po],
  );

  // ── Governance computation ──
  const data = useMemo<DispatchWorkbenchData | null>(() => {
    if (!po) return null;
    const vendorName = VENDOR_MAP[po.vendorId] ?? po.vendorId;
    const poCreatedState = buildPoCreatedStateFromPo(po);
    const approvalBaseline = getApprovalSnapshot(po.poNumber || po.id);
    const dispatchGovernance = buildDispatchGovernanceFromPo(po, approval, quoteComparison, vendorName, approvalBaseline);
    const dispatchPolicySurface = buildDispatchPolicySurface(dispatchGovernance);
    const decisionOptions = buildPoCreatedDecisionOptions(poCreatedState);
    const quoteSnapshotValid = deriveQuoteSnapshotValid(quoteComparison);
    const record = buildPoCreatedRecord({
      poCreatedState,
      dispatchGovernance,
      quoteShortlistSnapshotId: po.quoteComparisonId ?? `shortlist_${po.id}`,
      quoteSnapshotValid,
    });
    const supplierPayload = buildSupplierPayloadFromPo(po, vendorName);
    const railContext = buildRailContextFromPo(po, vendorName);
    const sendPrecondition = evaluateDispatchSendPrecondition(dispatchGovernance);
    return {
      po,
      vendorName,
      poCreatedState,
      dispatchGovernance,
      dispatchPolicySurface,
      decisionOptions,
      record,
      supplierPayload,
      railContext,
      sendPrecondition,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po, approval, quoteComparison, baselineVersion]);

  // ── Approval baseline capture ──
  useEffect(() => {
    if (!po) return;
    const approvalDecidedAt = approval?.finalDecisionAt;
    if (!approvalDecidedAt) return;
    if (approval?.status !== "approved") return;
    const snapshotData = {
      poNumber: po.poNumber || po.id,
      approvalDecidedAt,
      capturedAt: new Date().toISOString(),
      totalAmount: po.totalAmount,
      vendorId: po.vendorId,
      paymentTerms: po.paymentTerms,
      incoterms: po.incoterms,
      shippingRegion: po.shippingRegion,
      billToEntity: po.billToEntity,
      shipToLocation: po.shipToLocation,
      notes: po.notes,
      lineCount: po.lines?.length ?? 0,
    };
    const wrote = ensureApprovalSnapshot(snapshotData);
    ensureApprovalSnapshotAsync(snapshotData);
    if (wrote) {
      setBaselineVersion((v) => v + 1);
    }
  }, [po, approval?.finalDecisionAt, approval?.status]);

  // ── PO data change publish ──
  const publishedPoChangeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!po) return;
    if (!po.updatedAt) return;
    if (po.updatedAt === po.createdAt) return;
    const approvalDecidedAt = approval?.finalDecisionAt;
    if (!approvalDecidedAt) return;
    if (po.updatedAt <= approvalDecidedAt) return;

    const dedupeKey = `${po.poNumber || po.id}::${po.updatedAt}`;
    if (publishedPoChangeKeyRef.current === dedupeKey) return;

    const poNumberForDedupe = po.poNumber || po.id;
    if (!shouldPublish(poNumberForDedupe, "po_data_changed_after_approval", po.updatedAt)) {
      publishedPoChangeKeyRef.current = dedupeKey;
      return;
    }
    publishedPoChangeKeyRef.current = dedupeKey;

    const baseline = getApprovalSnapshot(poNumberForDedupe);
    const changedFields: string[] = [];
    if (baseline) {
      if (baseline.totalAmount !== po.totalAmount) changedFields.push("총금액");
      if (baseline.vendorId !== po.vendorId) changedFields.push("공급사");
      if ((baseline.paymentTerms ?? "") !== (po.paymentTerms ?? "")) changedFields.push("결제조건");
      if ((baseline.incoterms ?? "") !== (po.incoterms ?? "")) changedFields.push("무역조건");
      if (baseline.shippingRegion !== po.shippingRegion) changedFields.push("배송지역");
      if (baseline.billToEntity !== po.billToEntity) changedFields.push("청구법인");
      if (baseline.shipToLocation !== po.shipToLocation) changedFields.push("배송지");
      if ((baseline.notes ?? "") !== (po.notes ?? "")) changedFields.push("비고");
      if (baseline.lineCount !== (po.lines?.length ?? 0)) changedFields.push("라인 수");
    }

    emitPoDataChangedAfterApproval({
      caseId: po.id,
      poNumber: po.poNumber || po.id,
      previousUpdatedAt: po.createdAt ?? null,
      newUpdatedAt: po.updatedAt,
      approvalDecidedAt,
      changedFields,
    });
    markPublished(poNumberForDedupe, "po_data_changed_after_approval", po.updatedAt);
  }, [po, approval?.finalDecisionAt]);

  // ── Dispatch readiness transition publish ──
  const publishedReadinessRef = useRef<DispatchReadinessState | null>(null);
  useEffect(() => {
    if (!po) return;
    if (!data) return;
    const next = data.record.dispatchReadiness as DispatchReadinessState;
    const prev = publishedReadinessRef.current;
    if (prev === next) return;

    const poNumber = po.poNumber || po.id;
    const blockerReasons = (data.record.blockingReasons ?? []).map((r) => r.message);

    const transitionSig = `${prev ?? "null"}->${next}::${blockerReasons.join("|")}`;
    if (shouldPublish(poNumber, "dispatch_prep_readiness_changed", transitionSig)) {
      emitDispatchPrepReadinessChanged({
        caseId: po.id,
        poNumber,
        fromReadiness: prev,
        toReadiness: next,
        blockerReasons,
      });
      markPublished(poNumber, "dispatch_prep_readiness_changed", transitionSig);
    }

    if (next === "blocked" && prev !== "blocked") {
      const blockedSig = blockerReasons.join("|") || "unspecified";
      if (shouldPublish(poNumber, "dispatch_prep_blocked", blockedSig)) {
        emitDispatchPrepBlocked({
          caseId: po.id,
          poNumber,
          blockerReasons,
        });
        markPublished(poNumber, "dispatch_prep_blocked", blockedSig);
      }
    }

    publishedReadinessRef.current = next;
  }, [po, data]);

  // ── Handlers ──
  const handlers = useMemo<DispatchWorkbenchHandlers>(() => ({
    handleSendNow: () => {
      if (!po) return;
      // mutation 직전 마지막 정문 — UI button 이 어떤 이유로든 enable 된 채
      // 클릭됐더라도 store.issuePO 는 여기서 차단된다.
      const precondition = evaluateDispatchSendPrecondition(data?.dispatchGovernance);
      if (!precondition.sendNowAllowed) {
        if (typeof console !== "undefined") {
          console.warn(
            "[dispatch] handleSendNow blocked by precondition:",
            precondition.summary,
            precondition.blockReasons,
          );
        }
        return;
      }
      store.issuePO(po.id);
      navigate?.(`/dashboard/purchase-orders/${po.id}`);
    },
    handleScheduleSend: (date: string) => {
      if (!po) return;
      const precondition = evaluateDispatchSendPrecondition(data?.dispatchGovernance);
      if (!precondition.scheduleSendAllowed) {
        if (typeof console !== "undefined") {
          console.warn(
            "[dispatch] handleScheduleSend blocked by precondition:",
            precondition.summary,
            precondition.blockReasons,
          );
        }
        return;
      }
      scheduleSend(po.id, date);
      const poNumber = po.poNumber || po.id;
      if (shouldPublish(poNumber, "dispatch_prep_send_scheduled", date)) {
        emitDispatchPrepSendScheduled({
          caseId: po.id,
          poNumber,
          scheduledFor: date,
        });
        markPublished(poNumber, "dispatch_prep_send_scheduled", date);
      }
      navigate?.(`/dashboard/purchase-orders/${po.id}`);
    },
    handleRequestCorrection: (_reason: string) => {
      // correction → return to po_created view (handled by caller)
    },
    handleReopenConversion: () => {
      if (!po) return;
      navigate?.(`/dashboard/purchase-orders/${po.id}`);
    },
    handleCancelPrep: () => {
      if (!po) return;
      const reason = "사용자 요청에 의한 발송 준비 취소";
      cancelDispatchPrep(po.id, reason);
      const poNumber = po.poNumber || po.id;
      const sig = `${reason}::${Date.now()}`;
      if (shouldPublish(poNumber, "dispatch_prep_cancelled", sig)) {
        emitDispatchPrepCancelled({
          caseId: po.id,
          poNumber,
          reason,
        });
        markPublished(poNumber, "dispatch_prep_cancelled", sig);
      }
      navigate?.(`/dashboard/purchase-orders/${po.id}`);
    },
  }), [po, store, scheduleSend, cancelDispatchPrep, navigate, data?.dispatchGovernance]);

  return {
    data,
    handlers,
    isLoading: !po,
  };
}
