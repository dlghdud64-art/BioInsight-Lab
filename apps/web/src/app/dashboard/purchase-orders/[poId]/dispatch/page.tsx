"use client";

/**
 * PO Dispatch Workbench Mount — Batch 2
 *
 * Quote → Approval → PO Conversion → PO Created → Dispatch Prep 의
 * 실제 production mount point.
 *
 * 본 라우트는 새로운 governance surface 컴포넌트
 * (POCreatedReentrySurface · DispatchPrepWorkbench)를 실제 PO entity에 연결한다.
 *
 * - center=decision, rail=context, dock=action 역할 유지
 * - canonical truth (PurchaseOrderContract)는 절대 mutate하지 않는다
 * - 실제 발송 트랜잭션은 store.issuePO를 통해 outbound execution state로 분리된다
 *   (POCreatedRecord/governance state는 created truth — sent와 분리)
 */

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import { useDispatchOutboundStore } from "@/lib/store/dispatch-outbound-store";

import { QuoteChainWorkbench, type QuoteChainWorkbenchStage } from "@/components/approval/quote-chain-workbenches";
import type { DispatchRailContext, SupplierFacingPayloadPreview } from "@/components/approval/dispatch-prep-workbench";

import {
  evaluateDispatchGovernance,
  buildDispatchPolicySurface,
  type DispatchPreparationGovernanceState,
} from "@/lib/ai/po-dispatch-governance-engine";
import { buildPoCreatedRecord } from "@/lib/ai/po-created-record";
import type { PoCreatedState, PoCreatedBasis } from "@/lib/ai/po-created-engine";
import { buildPoCreatedDecisionOptions } from "@/lib/ai/po-created-engine";
import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  RequiredDocumentType,
} from "@/lib/review-queue/po-approval-contract";
import type { QuoteComparisonContract } from "@/lib/review-queue/quote-rfq-contract";

// ==========================================================================
// PO contract → governance input 변환
//
// canonical PurchaseOrderContract 의 실제 필드를 dispatch governance 입력으로
// 변환한다. stub 값(true/false 고정) 사용 금지.
// ==========================================================================

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

/**
 * approval snapshot 유효성 — 실제 ApprovalExecutionContract 기반으로 평가.
 * - approval 자체가 없으면 invalid
 * - approved 가 아니면 invalid (in_progress / rejected / returned / cancelled / expired 모두 false)
 * - blockers 가 남아있으면 invalid
 */
function deriveApprovalSnapshotValid(approval: ApprovalExecutionContract | undefined): boolean {
  if (!approval) return false;
  if (approval.status !== "approved") return false;
  if (approval.blockers.length > 0) return false;
  return true;
}

/**
 * conversion snapshot 유효성 — PO 가 실제로 conversion 후 단계에 있는지로 평가.
 * draft / cancelled 면 invalid.
 */
function deriveConversionSnapshotValid(po: PurchaseOrderContract): boolean {
  return po.status !== "draft" && po.status !== "cancelled";
}

/**
 * quote shortlist snapshot 유효성 — 실제 QuoteComparisonContract 의 선정/전환 상태로 평가.
 * - 비교가 없으면(quote 미연결: manual/reorder) valid 로 간주 (shortlist 가 의미 없음)
 * - selected / converted 만 valid (shortlist 결정 완료)
 * - partial / not_ready / ready 는 stale (의사결정 미완)
 */
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

// ==========================================================================
// Synthetic state builders
//
// 본 mount point는 PurchaseOrderContract의 실제 필드를
// PoCreatedState · DispatchGovernanceInput으로 변환한다.
// canonical PO contract는 read-only로만 소비한다.
// ==========================================================================

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
): DispatchPreparationGovernanceState {
  const approvalSnapshotValid = deriveApprovalSnapshotValid(approval);
  const conversionSnapshotValid = deriveConversionSnapshotValid(po);
  const quoteSnapshotValid = deriveQuoteSnapshotValid(comparison);
  // 모든 snapshot 축이 유효해야 governance 상 truth — 한 축이라도 무너지면 invalidation reason 노출.
  const allValid = approvalSnapshotValid && conversionSnapshotValid && quoteSnapshotValid;
  const snapshotInvalidationReason = allValid
    ? ""
    : deriveSnapshotInvalidationReason(approval, po, comparison);

  // policy hold: PO 가 명시적으로 on_hold 일 때 활성
  const policyHoldActive = po.status === "on_hold";
  const policyHoldReason = policyHoldActive
    ? po.notes?.trim() || "발주가 보류 상태"
    : "";

  // 승인 이후 데이터 변경 감지: approval 이 있고 finalDecisionAt 이후 PO updated
  // → ApprovalExecutionContract 에 updatedAt 이 없으므로, 명시적 신호 부재 시 false 유지
  const dataChangedAfterApproval = false;

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
    changeDetails: [],
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

// ==========================================================================
// Page
// ==========================================================================

type ViewMode = Extract<QuoteChainWorkbenchStage, "po_created" | "dispatch_prep">;

export default function PurchaseOrderDispatchWorkbenchPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.poId as string;
  const store = useOpsStore();

  const [viewMode, setViewMode] = useState<ViewMode>("po_created");

  // outbound execution store — schedule/cancel intent 만 다룸 (created truth 분리)
  const scheduleSend = useDispatchOutboundStore((s) => s.scheduleSend);
  const cancelDispatchPrep = useDispatchOutboundStore((s) => s.cancelDispatchPrep);

  const po = useMemo(
    () => store.purchaseOrders.find((p) => p.id === poId),
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

  // ── governance computation (memoized over canonical inputs) ──
  const built = useMemo(() => {
    if (!po) return null;
    const vendorName = VENDOR_MAP[po.vendorId] ?? po.vendorId;
    const poCreatedState = buildPoCreatedStateFromPo(po);
    const dispatchGovernance = buildDispatchGovernanceFromPo(po, approval, quoteComparison, vendorName);
    const dispatchPolicySurface = buildDispatchPolicySurface(dispatchGovernance);
    const decisionOptions = buildPoCreatedDecisionOptions(poCreatedState);
    // quote snapshot validity 는 governance 가 이미 위 derive 함수로 평가 — record 에 그대로 전파.
    const quoteSnapshotValid = deriveQuoteSnapshotValid(quoteComparison);
    const record = buildPoCreatedRecord({
      poCreatedState,
      dispatchGovernance,
      quoteShortlistSnapshotId: po.quoteComparisonId ?? `shortlist_${po.id}`,
      quoteSnapshotValid,
    });
    const supplierPayload = buildSupplierPayloadFromPo(po, vendorName);
    const railContext = buildRailContextFromPo(po, vendorName);
    return {
      vendorName,
      poCreatedState,
      dispatchGovernance,
      dispatchPolicySurface,
      decisionOptions,
      record,
      supplierPayload,
      railContext,
    };
  }, [po, approval, quoteComparison]);

  if (!po) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-slate-500">발주 {poId}를 찾을 수 없습니다.</p>
        <Link href="/dashboard/purchase-orders" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">
          ← 발주 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!built) return null;

  const {
    vendorName,
    poCreatedState,
    dispatchPolicySurface,
    decisionOptions,
    record,
    supplierPayload,
    railContext,
    dispatchGovernance,
  } = built;

  // ── Handlers ──
  // 핵심: 실제 발송은 outbound execution state로만 발생한다.
  // POCreatedRecord/governance state는 절대 직접 sent로 점프하지 않는다.
  const handleProceedToDispatchPrep = () => setViewMode("dispatch_prep");
  const handleReturnToPoCreated = () => setViewMode("po_created");

  const handleSendNow = () => {
    // outbound execution boundary
    store.issuePO(po.id);
    router.push(`/dashboard/purchase-orders/${po.id}`);
  };

  const handleScheduleSend = (date: string) => {
    // schedule registration → outbound execution store (created truth 와 분리)
    scheduleSend(po.id, date);
    router.push(`/dashboard/purchase-orders/${po.id}`);
  };

  const handleRequestCorrection = (_reason: string) => {
    setViewMode("po_created");
  };

  const handleReopenConversion = () => {
    router.push(`/dashboard/purchase-orders/${po.id}`);
  };

  const handleCancelPrep = () => {
    // dispatch prep 의도 폐기 → outbound store 에 cancel 기록 (irreversible action 아님)
    cancelDispatchPrep(po.id, "사용자 요청에 의한 발송 준비 취소");
    router.push(`/dashboard/purchase-orders/${po.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 relative min-h-[calc(100vh-4rem)]">
      {/* Top breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
        <Link
          href={`/dashboard/purchase-orders/${po.id}`}
          className="flex items-center gap-1 hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          {po.poNumber} 상세
        </Link>
        <span className="text-slate-700">·</span>
        <span className="text-slate-300">발송 워크벤치</span>
      </div>

      <QuoteChainWorkbench
        stage={viewMode}
        poCreatedProps={{
          state: poCreatedState,
          decisionOptions,
          record,
          vendorName,
          totalAmount: po.totalAmount,
          poNumber: po.poNumber,
          approvalSnapshotValid: dispatchGovernance.approvalSnapshotValid,
          conversionSnapshotValid: dispatchGovernance.conversionSnapshotValid,
          onProceedToDispatchPrep: handleProceedToDispatchPrep,
          onHold: () => router.push(`/dashboard/purchase-orders/${po.id}`),
          onReturnToConversion: handleReopenConversion,
        }}
        dispatchPrepProps={{
          state: dispatchGovernance,
          surface: dispatchPolicySurface,
          vendorName,
          totalAmount: po.totalAmount,
          poNumber: po.poNumber,
          railContext,
          supplierPayload,
          onSendNow: handleSendNow,
          onScheduleSend: handleScheduleSend,
          onRequestCorrection: handleRequestCorrection,
          onReopenConversion: handleReturnToPoCreated,
          onCancelPrep: handleCancelPrep,
        }}
      />
    </div>
  );
}
