/**
 * WorkbenchProgressOverlay — 대시보드 컨텍스트 유지형 lightweight progress panel
 *
 * 규칙:
 * 1. workbench가 아니다 — center/rail/dock grammar 흉내내지 않음.
 *    stage + blocker + next action + "전체 작업면 열기" CTA만.
 * 2. canonical truth를 mutate하지 않음. read-only summary + workbench hand-off.
 * 3. terminal action(발송/승인)을 직접 노출하지 않음 — workbench 결선 전용.
 * 4. overlay-chrome-store의 widthMode="progress" 일 때만 렌더.
 *
 * 데이터 참조:
 * - overlayRoutePath에서 caseId/poId 추출 → useOrderQueueStore lookup
 * - domain store에서 최신 computed 데이터 참조 (engine truth 그대로)
 */

"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOverlayChromeStore } from "@/lib/store/overlay-chrome-store";
import { useOrderQueueStore } from "@/lib/store/order-queue-store";
import type { ChainStageKey } from "@/components/approval/quote-chain-progress-strip";

// ══════════════════════════════════════════════
// Stage → label / color mapping
// ══════════════════════════════════════════════

const STAGE_LABEL: Record<string, string> = {
  quote_review: "견적 검토",
  quote_shortlist: "견적 선정",
  quote_approval: "견적 승인",
  po_conversion: "PO 전환",
  po_approval: "PO 승인",
  po_send_readiness: "발송 준비",
  po_created: "PO 생성",
  dispatch_prep: "발송 검증",
  sent: "발송 완료",
  supplier_confirmed: "공급 확인",
  receiving_prep: "입고 준비",
};

interface ReadinessConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}

const READINESS_MAP: Record<string, ReadinessConfig> = {
  ready: {
    label: "발송 가능",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    icon: CheckCircle2,
  },
  needs_review: {
    label: "검토 필요",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: Clock,
  },
  blocked: {
    label: "차단됨",
    color: "text-red-700",
    bg: "bg-red-50",
    icon: XCircle,
  },
  incomplete: {
    label: "미완료",
    color: "text-slate-600",
    bg: "bg-slate-100",
    icon: AlertTriangle,
  },
};

// ══════════════════════════════════════════════
// Route parsing helpers
// ══════════════════════════════════════════════

function extractIdsFromRoute(routePath: string | null): {
  caseId: string | null;
  poId: string | null;
  isDispatch: boolean;
} {
  if (!routePath) return { caseId: null, poId: null, isDispatch: false };

  // /dashboard/purchase-orders/[poId]/dispatch
  const poDispatchMatch = routePath.match(
    /\/dashboard\/purchase-orders\/([^/]+)\/dispatch/
  );
  if (poDispatchMatch)
    return { caseId: null, poId: poDispatchMatch[1], isDispatch: true };

  // /dashboard/purchase-orders/[poId]
  const poMatch = routePath.match(/\/dashboard\/purchase-orders\/([^/]+)/);
  if (poMatch)
    return { caseId: null, poId: poMatch[1], isDispatch: false };

  // /dashboard/orders/[caseId]
  const orderMatch = routePath.match(/\/dashboard\/orders\/([^/]+)/);
  if (orderMatch)
    return { caseId: orderMatch[1], poId: null, isDispatch: false };

  return { caseId: null, poId: null, isDispatch: false };
}

// ══════════════════════════════════════════════
// Blocker row
// ══════════════════════════════════════════════

function BlockerRow({
  label,
  severity,
}: {
  label: string;
  severity: "critical" | "warning";
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {severity === "critical" ? (
        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
      )}
      <span
        className={cn(
          "leading-relaxed",
          severity === "critical" ? "text-red-700" : "text-amber-700"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════
// Content-only export (GlobalModal 통합용)
// ══════════════════════════════════════════════

/** BaseModal 내부에 렌더링되는 순수 콘텐츠. GlobalModal registry에서 사용. */
export function WorkbenchProgressContent({
  onClose,
}: {
  onClose?: () => void;
}) {
  return (
    <WorkbenchProgressOverlay
      _renderContentOnly
      _onClose={onClose}
    />
  );
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function WorkbenchProgressOverlay({
  _renderContentOnly,
  _onClose,
}: {
  _renderContentOnly?: boolean;
  _onClose?: () => void;
} = {}) {
  const isOpen = useOverlayChromeStore((s) => s.isOpen);
  const widthMode = useOverlayChromeStore((s) => s.widthMode);
  const overlayRoutePath = useOverlayChromeStore((s) => s.overlayRoutePath);
  const closeOverlay = useOverlayChromeStore((s) => s.closeOverlay);
  const expandToWorkbench = useOverlayChromeStore((s) => s.expandToWorkbench);

  const orders = useOrderQueueStore((s) => s.orders);

  // Route → ID 추출
  const { caseId, poId, isDispatch } = useMemo(
    () => extractIdsFromRoute(overlayRoutePath),
    [overlayRoutePath]
  );

  // Domain store에서 최신 데이터 lookup
  const order = useMemo(() => {
    const lookupId = poId ?? caseId;
    if (!lookupId) return null;
    return orders.find((o) => o.id === lookupId || o.poNumber === lookupId) ?? null;
  }, [poId, caseId, orders]);

  // Progress panel은 widthMode="progress" 일 때만 렌더
  const shouldShow = isOpen && widthMode === "progress";

  const handleOpenChange = (next: boolean) => {
    if (!next) closeOverlay();
  };

  // ── Computed display data ──
  const currentStage: string = order
    ? inferStageFromStatus(order.status)
    : isDispatch
      ? "dispatch_prep"
      : "po_created";

  const nextAction = order?.computed.nextAction ?? "상세 확인 필요";

  const readinessKey = order?.computed.canDispatch
    ? "ready"
    : order?.computed.canApprove
      ? "needs_review"
      : "incomplete";

  const readinessConfig = READINESS_MAP[readinessKey] ?? READINESS_MAP.incomplete;
  const ReadinessIcon = readinessConfig.icon;

  // Blocker 계산 — order queue computed에서 추출
  const blockers: Array<{ label: string; severity: "critical" | "warning" }> =
    useMemo(() => {
      if (!order) return [];
      const result: Array<{ label: string; severity: "critical" | "warning" }> = [];

      if (!order.computed.canDispatch && order.status !== "completed") {
        if (!order.computed.canApprove) {
          result.push({ label: "승인 조건 미충족", severity: "critical" });
        }
      }
      if (
        order.computed.budgetRiskLevel === "over" ||
        order.computed.budgetRiskLevel === "critical"
      ) {
        result.push({
          label: `예산 위험: ${order.computed.budgetRiskLevel}`,
          severity: "critical",
        });
      }
      if (order.computed.budgetRiskLevel === "warning") {
        result.push({ label: "예산 주의 필요", severity: "warning" });
      }
      return result;
    }, [order]);

  const workbenchHref = overlayRoutePath ?? "/dashboard/orders";

  const content = (
    <div className="flex flex-col flex-1 overflow-hidden">
          {/* ── Header ── */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  진행 현황
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    readinessConfig.color,
                    readinessConfig.bg
                  )}
                >
                  {readinessConfig.label}
                </span>
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SheetTitle className="text-base font-semibold text-slate-900 text-left">
              {order
                ? `${order.productName ?? order.poNumber}`
                : "발주 상세"}
            </SheetTitle>
            {order && (
              <SheetDescription className="text-xs text-slate-600 text-left">
                {order.vendorName} · {order.poNumber}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Current Stage */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                현재 단계
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-slate-900">
                  {STAGE_LABEL[currentStage] ?? currentStage}
                </span>
              </div>
            </div>

            {/* Next Action */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                다음 필요 작업
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-slate-800">{nextAction}</span>
              </div>
            </div>

            {/* Dispatch Readiness */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                발송 준비도
              </div>
              <div className="flex items-center gap-2">
                <ReadinessIcon
                  className={cn("h-4 w-4", readinessConfig.color)}
                />
                <span className={cn("text-sm font-medium", readinessConfig.color)}>
                  {readinessConfig.label}
                </span>
              </div>
            </div>

            {/* Blockers */}
            {blockers.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
                <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">
                  차단 사유 ({blockers.length})
                </div>
                <div className="space-y-1.5">
                  {blockers.map((b, i) => (
                    <BlockerRow key={i} label={b.label} severity={b.severity} />
                  ))}
                </div>
              </div>
            )}

            {/* Order info summary */}
            {order && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  요약
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">총액</span>
                    <span className="text-slate-800 font-medium tabular-nums">
                      ₩{order.totalAmount.toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">상태</span>
                    <span className="text-slate-800">{order.status}</span>
                  </div>
                  {order.budgetName && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">예산</span>
                      <span className="text-slate-800">
                        {order.budgetName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              본 패널은 빠른 현황 확인용입니다. 승인·발송 결선은 워크벤치에서
              진행됩니다.
            </p>
          </div>

          {/* ── Footer / Dock ── */}
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 bg-slate-50/60">
            <button
              type="button"
              onClick={closeOverlay}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5"
            >
              닫기
            </button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={expandToWorkbench}
              >
                전체 작업면 열기
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={closeOverlay}
              >
                <Link href={workbenchHref}>
                  워크벤치 이동
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
    </div>
  );

  if (_renderContentOnly) {
    if (_onClose) {
      return (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  진행 현황
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    readinessConfig.color,
                    readinessConfig.bg
                  )}
                >
                  {readinessConfig.label}
                </span>
              </div>
              <button
                type="button"
                onClick={_onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-base font-semibold text-slate-900 text-left">
              {order
                ? `${order.productName ?? order.poNumber}`
                : "발주 상세"}
            </div>
            {order && (
              <div className="text-xs text-slate-600 text-left">
                {order.vendorName} · {order.poNumber}
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Current Stage */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                현재 단계
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-slate-900">
                  {STAGE_LABEL[currentStage] ?? currentStage}
                </span>
              </div>
            </div>

            {/* Next Action */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                다음 필요 작업
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-slate-800">{nextAction}</span>
              </div>
            </div>

            {/* Dispatch Readiness */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                발송 준비도
              </div>
              <div className="flex items-center gap-2">
                <ReadinessIcon
                  className={cn("h-4 w-4", readinessConfig.color)}
                />
                <span className={cn("text-sm font-medium", readinessConfig.color)}>
                  {readinessConfig.label}
                </span>
              </div>
            </div>

            {/* Blockers */}
            {blockers.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
                <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">
                  차단 사유 ({blockers.length})
                </div>
                <div className="space-y-1.5">
                  {blockers.map((b, i) => (
                    <BlockerRow key={i} label={b.label} severity={b.severity} />
                  ))}
                </div>
              </div>
            )}

            {/* Order info summary */}
            {order && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  요약
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">총액</span>
                    <span className="text-slate-800 font-medium tabular-nums">
                      ₩{order.totalAmount.toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">상태</span>
                    <span className="text-slate-800">{order.status}</span>
                  </div>
                  {order.budgetName && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">예산</span>
                      <span className="text-slate-800">
                        {order.budgetName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              본 패널은 빠른 현황 확인용입니다. 승인·발송 결선은 워크벤치에서
              진행됩니다.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <Sheet open={shouldShow} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm bg-white border-l border-slate-200 p-0 flex flex-col"
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}

// ── Helper: status → ChainStageKey 매핑 ──

function inferStageFromStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "quote_review",
    quote_review: "quote_review",
    shortlisted: "quote_shortlist",
    approval_pending: "quote_approval",
    approved: "po_conversion",
    po_conversion: "po_conversion",
    po_created: "po_created",
    dispatch_prep: "dispatch_prep",
    ready_to_send: "dispatch_prep",
    sent: "sent",
    supplier_confirmed: "supplier_confirmed",
    receiving: "receiving_prep",
    completed: "stock_release",
  };
  return map[status] ?? "po_created";
}
