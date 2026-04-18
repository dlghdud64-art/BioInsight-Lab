"use client";

/**
 * PO Dispatch Workbench Page — hook-based thin wrapper
 *
 * Quote → Approval → PO Conversion → PO Created → Dispatch Prep 의
 * 실제 production mount point.
 *
 * governance 계산, event publish, approval baseline 관리는 전부
 * useDispatchWorkbenchData hook에 위임. 이 page는:
 * 1. route param → poId 추출
 * 2. viewMode (po_created | dispatch_prep) UI state 관리
 * 3. breadcrumb + QuoteChainWorkbench 렌더
 *
 * overlay에서도 동일 hook을 소비하므로 governance 결과가 보장된다.
 *
 * - center=decision, rail=context, dock=action 역할 유지
 * - canonical truth (PurchaseOrderContract)는 절대 mutate하지 않는다
 * - 실제 발송 트랜잭션은 store.issuePO를 통해 outbound execution state로 분리된다
 *   (POCreatedRecord/governance state는 created truth — sent와 분리)
 */

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDispatchWorkbenchData } from "@/hooks/use-dispatch-workbench-data";
import { QuoteChainWorkbench, type QuoteChainWorkbenchStage } from "@/components/approval/quote-chain-workbenches";

// ==========================================================================
// Page
// ==========================================================================

type ViewMode = Extract<QuoteChainWorkbenchStage, "po_created" | "dispatch_prep">;

export default function PurchaseOrderDispatchWorkbenchPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.poId as string;

  const [viewMode, setViewMode] = useState<ViewMode>("po_created");

  // navigation callback — full-page route이므로 router.push 직접 사용
  const handleNavigate = useCallback(
    (path: string) => router.push(path),
    [router],
  );

  const { data, handlers, isLoading } = useDispatchWorkbenchData(poId, {
    onNavigate: handleNavigate,
  });

  // ── viewMode 전환 핸들러 (page-local UI state) ──
  const handleProceedToDispatchPrep = useCallback(
    () => setViewMode("dispatch_prep"),
    [],
  );
  const handleReturnToPoCreated = useCallback(
    () => setViewMode("po_created"),
    [],
  );
  const handleRequestCorrection = useCallback(
    (_reason: string) => setViewMode("po_created"),
    [],
  );

  // ── Loading / Not found ──
  if (isLoading || !data) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-slate-500">
          {isLoading ? "로딩 중..." : `발주 ${poId}를 찾을 수 없습니다.`}
        </p>
        <Link
          href="/dashboard/purchase-orders"
          className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
        >
          ← 발주 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const {
    po,
    vendorName,
    poCreatedState,
    dispatchGovernance,
    dispatchPolicySurface,
    decisionOptions,
    record,
    supplierPayload,
    railContext,
  } = data;

  return (
    <div className="max-w-7xl mx-auto p-4 relative min-h-[calc(100vh-4rem)]">
      {/* Top breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
        <Link
          href={`/dashboard/purchase-orders/${po!.id}`}
          className="flex items-center gap-1 hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          {po!.poNumber} 상세
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
          totalAmount: po!.totalAmount,
          poNumber: po!.poNumber,
          approvalSnapshotValid: dispatchGovernance.approvalSnapshotValid,
          conversionSnapshotValid: dispatchGovernance.conversionSnapshotValid,
          onProceedToDispatchPrep: handleProceedToDispatchPrep,
          onHold: () => handleNavigate(`/dashboard/purchase-orders/${po!.id}`),
          onReturnToConversion: () =>
            handleNavigate(`/dashboard/purchase-orders/${po!.id}`),
        }}
        dispatchPrepProps={{
          state: dispatchGovernance,
          surface: dispatchPolicySurface,
          vendorName,
          totalAmount: po!.totalAmount,
          poNumber: po!.poNumber,
          railContext,
          supplierPayload,
          onSendNow: handlers.handleSendNow,
          onScheduleSend: handlers.handleScheduleSend,
          onRequestCorrection: handleRequestCorrection,
          onReopenConversion: handleReturnToPoCreated,
          onCancelPrep: handlers.handleCancelPrep,
        }}
      />
    </div>
  );
}
