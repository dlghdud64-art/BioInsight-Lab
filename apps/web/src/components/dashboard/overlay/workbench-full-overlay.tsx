/**
 * WorkbenchFullOverlay — 대시보드 컨텍스트 유지형 full workbench overlay
 *
 * 규칙:
 * 1. overlay-chrome-store의 widthMode="workbench" 일 때만 렌더.
 * 2. QuoteChainWorkbench를 Dialog 안에서 보여줌 — center/rail/dock grammar 유지.
 * 3. canonical truth는 useDispatchWorkbenchData hook에서 읽음 — overlay 자체는 truth를 보유하지 않음.
 * 4. ESC / backdrop click으로 닫기. focus trap은 Radix Dialog가 자동 제공.
 * 5. desktop wide → overlay, mobile/narrow → full-page fallback (overlay 대신 route 이동).
 *
 * mount: DashboardShell에 단일 mount.
 */

"use client";

import * as React from "react";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlayChromeStore } from "@/lib/store/overlay-chrome-store";
import { useDispatchWorkbenchData } from "@/hooks/use-dispatch-workbench-data";
import { QuoteChainWorkbench, type QuoteChainWorkbenchStage } from "@/components/approval/quote-chain-workbenches";

// ══════════════════════════════════════════════
// Route parsing
// ══════════════════════════════════════════════

function extractPoIdFromRoute(routePath: string | null): string | null {
  if (!routePath) return null;
  // /dashboard/purchase-orders/[poId]/dispatch
  const dispatchMatch = routePath.match(/\/dashboard\/purchase-orders\/([^/]+)\/dispatch/);
  if (dispatchMatch) return dispatchMatch[1];
  // /dashboard/purchase-orders/[poId]
  const poMatch = routePath.match(/\/dashboard\/purchase-orders\/([^/]+)/);
  if (poMatch) return poMatch[1];
  return null;
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function WorkbenchFullOverlay() {
  const isOpen = useOverlayChromeStore((s) => s.isOpen);
  const widthMode = useOverlayChromeStore((s) => s.widthMode);
  const overlayRoutePath = useOverlayChromeStore((s) => s.overlayRoutePath);
  const closeOverlay = useOverlayChromeStore((s) => s.closeOverlay);
  const router = useRouter();

  const shouldShow = isOpen && widthMode === "workbench";
  const poId = useMemo(() => extractPoIdFromRoute(overlayRoutePath), [overlayRoutePath]);

  type ViewMode = Extract<QuoteChainWorkbenchStage, "po_created" | "dispatch_prep">;
  const [viewMode, setViewMode] = useState<ViewMode>("po_created");

  // overlay 내에서의 navigation은 overlay를 닫고 실제 route로 이동
  const handleNavigate = useCallback((path: string) => {
    closeOverlay();
    router.push(path);
  }, [closeOverlay, router]);

  const { data, handlers, isLoading } = useDispatchWorkbenchData(
    poId ?? "",
    { onNavigate: handleNavigate },
  );

  // overlay가 열릴 때 dispatch route면 dispatch_prep으로 시작
  useEffect(() => {
    if (shouldShow && overlayRoutePath?.includes("/dispatch")) {
      setViewMode("dispatch_prep");
    } else if (shouldShow) {
      setViewMode("po_created");
    }
  }, [shouldShow, overlayRoutePath]);

  const handleOpenChange = (next: boolean) => {
    if (!next) closeOverlay();
  };

  // correction은 viewMode만 바꿈 (overlay 내 전환)
  const handleRequestCorrection = useCallback((_reason: string) => {
    setViewMode("po_created");
  }, []);

  const handleReopenConversion = useCallback(() => {
    setViewMode("po_created");
  }, []);

  if (!shouldShow) return null;

  return (
    <DialogPrimitive.Root open={shouldShow} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          {/* Backdrop */}
          <DialogPrimitive.Overlay className="absolute inset-0 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* Content — near full-screen on desktop, true full on mobile */}
          <DialogPrimitive.Content
            className="relative z-[80] flex flex-col w-[95vw] max-w-7xl h-[90vh] max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            {/* ── Header bar ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                  발송 워크벤치
                </span>
                {data?.po && (
                  <span className="text-sm font-medium text-slate-800">
                    {data.po.poNumber}
                    <span className="text-slate-400 ml-2">·</span>
                    <span className="text-slate-500 ml-2">{data.vendorName}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {data?.po && (
                  <Link
                    href={overlayRoutePath ?? `/dashboard/purchase-orders/${poId}/dispatch`}
                    onClick={closeOverlay}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100"
                  >
                    <Maximize2 className="h-3 w-3" />
                    전체 페이지
                  </Link>
                )}
                <DialogPrimitive.Close className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                  <span className="sr-only">닫기</span>
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading || !data ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-500">
                    {!poId ? "발주 정보를 찾을 수 없습니다." : "로딩 중..."}
                  </p>
                </div>
              ) : (
                <QuoteChainWorkbench
                  stage={viewMode}
                  poCreatedProps={{
                    state: data.poCreatedState,
                    decisionOptions: data.decisionOptions,
                    record: data.record,
                    vendorName: data.vendorName,
                    totalAmount: data.po!.totalAmount,
                    poNumber: data.po!.poNumber,
                    approvalSnapshotValid: data.dispatchGovernance.approvalSnapshotValid,
                    conversionSnapshotValid: data.dispatchGovernance.conversionSnapshotValid,
                    onProceedToDispatchPrep: () => setViewMode("dispatch_prep"),
                    onHold: () => handleNavigate(`/dashboard/purchase-orders/${poId}`),
                    onReturnToConversion: () => handleNavigate(`/dashboard/purchase-orders/${poId}`),
                  }}
                  dispatchPrepProps={{
                    state: data.dispatchGovernance,
                    surface: data.dispatchPolicySurface,
                    vendorName: data.vendorName,
                    totalAmount: data.po!.totalAmount,
                    poNumber: data.po!.poNumber,
                    railContext: data.railContext,
                    supplierPayload: data.supplierPayload,
                    onSendNow: handlers.handleSendNow,
                    onScheduleSend: handlers.handleScheduleSend,
                    onRequestCorrection: handleRequestCorrection,
                    onReopenConversion: handleReopenConversion,
                    onCancelPrep: handlers.handleCancelPrep,
                  }}
                />
              )}
            </div>

            {/* Accessible title (visually hidden) */}
            <DialogPrimitive.Title className="sr-only">
              발송 워크벤치 {data?.po?.poNumber ?? ""}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              PO {data?.po?.poNumber ?? ""} 발송 준비 워크벤치 — 검토, 승인, 발송 결선
            </DialogPrimitive.Description>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
