"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import {
  OperationalDetailShell,
  DetailStateFallback,
  type InboxContextStripProps,
  type OperationalHeaderProps,
  type BlockerReviewStripProps,
  type DecisionPanelProps,
  type MetaRailProps,
} from "../../_components/operational-detail-shell";

// ── Status config ──
const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  pending_approval: "승인 대기",
  approval_in_progress: "승인 진행",
  approved: "승인 완료",
  ready_to_issue: "발행 준비",
  issued: "발행 완료",
  acknowledged: "공급사 확인",
  partially_received: "부분 입고",
  received: "입고 완료",
  closed: "종료",
  cancelled: "취소",
  on_hold: "보류",
};

const STATUS_TONES: Record<string, OperationalHeaderProps["statusTone"]> = {
  draft: "neutral",
  pending_approval: "warning",
  approval_in_progress: "warning",
  approved: "info",
  ready_to_issue: "info",
  issued: "success",
  acknowledged: "success",
  partially_received: "warning",
  received: "success",
  closed: "neutral",
  cancelled: "danger",
  on_hold: "warning",
};

const STEP_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-700/60 text-slate-300 border-slate-600",
  active: "bg-amber-900/40 text-amber-300 border-amber-700",
  approved: "bg-green-900/40 text-green-300 border-green-700",
  rejected: "bg-red-900/40 text-red-300 border-red-700",
  skipped: "bg-slate-700/60 text-slate-400 border-slate-600",
};

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  active: "진행",
  approved: "승인",
  rejected: "반려",
  skipped: "건너뜀",
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.poId as string;
  const store = useOpsStore();
  const [showApproval, setShowApproval] = useState(true);

  const po = useMemo(
    () => store.purchaseOrders.find((p) => p.id === poId),
    [store.purchaseOrders, poId],
  );

  const approval = useMemo(
    () => store.approvalExecutions.find((ae) => ae.entityId === poId),
    [store.approvalExecutions, poId],
  );

  const ack = useMemo(
    () => store.acknowledgements.find((a) => a.poId === poId),
    [store.acknowledgements, poId],
  );

  const inboxItem = useMemo(
    () => store.unifiedInboxItems.find((i) => i.entityId === poId),
    [store.unifiedInboxItems, poId],
  );

  if (!po) {
    return (
      <div className="max-w-7xl mx-auto">
        <DetailStateFallback
          type="not_found"
          entityLabel="발주"
          nextRoute={{ label: "발주 목록", href: "/dashboard/purchase-orders" }}
        />
      </div>
    );
  }

  const vendorName = VENDOR_MAP[po.vendorId] ?? po.vendorId;
  const isApproved = po.status === "approved" || po.status === "ready_to_issue";
  const isIssued = po.status === "issued" || po.status === "acknowledged";
  const isAcknowledged = po.status === "acknowledged";
  const ackPending = po.status === "issued" && (!ack || ack.status === "sent" || ack.status === "not_sent");

  // Due state
  const dueState = (() => {
    if (!po.requiredByAt) return { label: "납기 미정", tone: "normal" as const };
    const diffMs = new Date(po.requiredByAt).getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs < 0) return { label: `${Math.abs(Math.floor(diffDays))}일 초과`, tone: "overdue" as const };
    if (diffDays <= 5) return { label: `${Math.ceil(diffDays)}일 남음`, tone: "due_soon" as const };
    return { label: `${Math.ceil(diffDays)}일 남음`, tone: "normal" as const };
  })();

  // ── Shell props ──
  const contextStrip: InboxContextStripProps | undefined = inboxItem
    ? {
        workTypeLabel: inboxItem.workType === "po_ready_to_issue" ? "발행 준비" : inboxItem.workType === "po_ack_pending" ? "확인 대기" : "발주",
        whyNow: inboxItem.summary,
        dueLabel: inboxItem.dueState.label,
        dueTone: inboxItem.dueState.tone,
        owner: inboxItem.owner,
      }
    : undefined;

  const header: OperationalHeaderProps = {
    title: `${po.poNumber} — ${vendorName}`,
    reference: po.id,
    statusLabel: STATUS_LABELS[po.status] ?? po.status,
    statusTone: STATUS_TONES[po.status] ?? "neutral",
    subStatus: `₩${po.totalAmount.toLocaleString("ko-KR")} · ${po.lines.length}개 품목`,
    keyDates: [
      { label: "납기", value: dueState.label, tone: dueState.tone },
      { label: "생성일", value: new Date(po.createdAt).toLocaleDateString("ko-KR") },
      ...(po.issuedAt ? [{ label: "발행일", value: new Date(po.issuedAt).toLocaleDateString("ko-KR") }] : []),
    ],
    keyParties: [
      { label: "공급사", value: vendorName },
      { label: "담당", value: po.ownerId ?? "-" },
    ],
    riskBadges: [
      ...(dueState.tone === "overdue" ? ["납기 초과"] : []),
      ...(ackPending ? ["확인 미응답"] : []),
    ],
    nextActionSummary: isApproved
      ? "발주서 발행"
      : ackPending
        ? "공급사 확인 독촉"
        : isAcknowledged
          ? "입고 대기"
          : "승인 진행 확인",
  };

  const blockerStrip: BlockerReviewStripProps | undefined = (() => {
    const blockers: BlockerReviewStripProps["blockers"] = [];
    const reviewPoints: BlockerReviewStripProps["reviewPoints"] = [];
    if (!isApproved && !isIssued && approval?.status !== "approved") {
      blockers.push({ label: "승인 미완료 — 발행 불가", actionable: false });
    }
    if (ackPending) {
      reviewPoints.push({ label: "공급사 발주 확인 미응답" });
    }
    if (blockers.length + reviewPoints.length === 0) return undefined;
    return { blockers, reviewPoints, warnings: [] };
  })();

  const decisionPanel: DecisionPanelProps = {
    readinessSummary: isApproved
      ? "발행 가능"
      : isIssued
        ? ackPending
          ? "공급사 확인 대기 중"
          : "입고 핸드오프 가능"
        : "승인 완료 후 발행 가능",
    readinessReady: isApproved || isAcknowledged,
    blockedReasons: !isApproved && !isIssued ? ["승인 프로세스 미완료"] : [],
    recommendedAction: isApproved
      ? "발주서 발행 실행"
      : ackPending
        ? "공급사 확인 독촉"
        : isAcknowledged
          ? "입고 준비"
          : undefined,
    handoffTarget: isAcknowledged
      ? { label: "입고 관리", href: "/dashboard/receiving" }
      : undefined,
    actions: [
      {
        label: "발주 발행",
        onClick: () => { store.issuePO(po.id); },
        variant: "primary",
        disabled: !isApproved,
        disabledReason: !isApproved ? "승인 완료 후 발행 가능" : undefined,
      },
      {
        label: "공급사 확인 수신",
        onClick: () => { store.acknowledgePO(po.id); },
        variant: "secondary",
        disabled: po.status !== "issued",
        disabledReason: po.status !== "issued" ? "발행 후 확인 가능" : undefined,
      },
      {
        label: "입고 시작",
        onClick: () => router.push("/dashboard/receiving"),
        variant: "secondary",
        disabled: !isAcknowledged,
        disabledReason: !isAcknowledged ? "확인 완료 후 진행 가능" : undefined,
      },
    ],
  };

  const metaRail: MetaRailProps = {
    lastUpdated: new Date(po.createdAt).toLocaleDateString("ko-KR"),
    linkedEntities: [
      ...(po.quoteRequestId ? [{ label: "견적", value: po.quoteRequestId, href: `/dashboard/quotes/${po.quoteRequestId}` }] : []),
      ...(po.quoteComparisonId ? [{ label: "비교", value: po.quoteComparisonId }] : []),
    ],
  };

  return (
    <div className="max-w-7xl mx-auto">
      <OperationalDetailShell
        contextStrip={contextStrip}
        header={header}
        blockerStrip={blockerStrip}
        decisionPanel={decisionPanel}
        metaRail={metaRail}
      >
        {/* ── 승인 타임라인 ── */}
        {approval && (
          <div className="rounded border border-slate-800 bg-slate-900 overflow-hidden">
            <button
              onClick={() => setShowApproval(!showApproval)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">승인 타임라인</span>
                <span className="text-xs text-slate-400">
                  {approval.steps.filter((s) => s.status === "approved").length}/{approval.steps.length} 완료
                </span>
              </div>
              {showApproval ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {showApproval && (
              <div className="border-t border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="text-left px-4 py-2 font-medium text-slate-500 w-10">#</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">단계</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">상태</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">담당자</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">결정</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500">일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approval.steps.map((step) => (
                      <tr
                        key={step.id}
                        className={`border-b border-slate-800 last:border-b-0 ${step.status === "active" ? "bg-amber-900/10" : ""}`}
                      >
                        <td className="px-4 py-2 text-slate-500 font-mono">{step.stepOrder}</td>
                        <td className="px-4 py-2 text-slate-200">{step.stepType}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-xs ${STEP_STATUS_STYLES[step.status] ?? ""}`}>
                            {STEP_STATUS_LABELS[step.status] ?? step.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-500" />
                            {step.assigneeIds.join(", ")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {step.decisions?.[0]?.comment ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-500 font-mono">
                          {step.completedAt ? new Date(step.completedAt).toLocaleDateString("ko-KR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 발주 품목 ── */}
        <div className="rounded border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              발주 품목 ({po.lines.length}건)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-2 font-medium text-slate-500 w-10">#</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">품목</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">수량</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500">금액</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">입고</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">잔량</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-800 last:border-b-0">
                    <td className="px-4 py-2 text-slate-500 font-mono">{line.lineNumber}</td>
                    <td className="px-4 py-2 text-slate-200">
                      {line.itemName}
                      {line.substituteApproved && (
                        <span className="ml-1 text-[10px] text-orange-400">[대체]</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {line.orderedQuantity} {line.orderedUnit}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300">
                      ₩{line.lineTotal.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{line.receivedQuantity}/{line.orderedQuantity}</td>
                    <td className="px-4 py-2">
                      <span className={line.remainingQuantity > 0 ? "text-amber-400" : "text-emerald-400"}>
                        {line.remainingQuantity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-400 text-right">
            합계: <span className="text-slate-100 font-medium">₩{po.totalAmount.toLocaleString("ko-KR")}</span>
          </div>
        </div>

        {/* ── 공급사 확인 요약 ── */}
        {ack && ack.status === "acknowledged" && (
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-xs font-medium text-emerald-400 mb-1">공급사 확인 완료</div>
            <div className="text-xs text-slate-400">
              {ack.acknowledgedAt && `확인일: ${new Date(ack.acknowledgedAt).toLocaleDateString("ko-KR")}`}
              {ack.promisedDeliveryAt && ` · 예정 납기: ${new Date(ack.promisedDeliveryAt).toLocaleDateString("ko-KR")}`}
            </div>
          </div>
        )}
      </OperationalDetailShell>
    </div>
  );
}
