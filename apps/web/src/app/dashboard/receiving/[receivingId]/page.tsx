"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  expected: "입고 예정",
  arrived: "도착",
  inspection_in_progress: "검수 중",
  ready_to_post: "반영 준비",
  partially_posted: "부분 반영",
  posted: "반영 완료",
  closed: "종료",
  cancelled: "취소",
};

const STATUS_TONES: Record<string, OperationalHeaderProps["statusTone"]> = {
  expected: "neutral",
  arrived: "info",
  inspection_in_progress: "warning",
  ready_to_post: "info",
  partially_posted: "warning",
  posted: "success",
  closed: "neutral",
  cancelled: "danger",
};

const INSPECTION_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-slate-700 text-slate-300 border-slate-600" },
  in_progress: { label: "진행", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  passed: { label: "합격", className: "bg-green-900/40 text-green-300 border-green-700" },
  failed: { label: "불합격", className: "bg-red-900/40 text-red-300 border-red-700" },
};

const QUARANTINE_BADGE: Record<string, { label: string; className: string }> = {
  quarantined: { label: "격리", className: "bg-amber-900/30 text-amber-300 border-amber-700" },
  released: { label: "해제", className: "bg-green-900/30 text-green-300 border-green-700" },
  pending: { label: "대기", className: "bg-slate-700 text-slate-300 border-slate-600" },
};

export default function ReceivingDetailPage() {
  const params = useParams();
  const receivingId = params.receivingId as string;
  const store = useOpsStore();
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});

  const rb = useMemo(
    () => store.receivingBatches.find((r) => r.id === receivingId),
    [store.receivingBatches, receivingId],
  );

  const linkedPO = useMemo(
    () => rb?.poId ? store.purchaseOrders.find((p) => p.id === rb.poId) : undefined,
    [store.purchaseOrders, rb],
  );

  const inboxItems = useMemo(
    () => store.unifiedInboxItems.filter((i) => i.entityId === receivingId),
    [store.unifiedInboxItems, receivingId],
  );

  if (!rb) {
    return (
      <div className="max-w-7xl mx-auto">
        <DetailStateFallback
          type="not_found"
          entityLabel="입고 배치"
          nextRoute={{ label: "입고 목록", href: "/dashboard/receiving" }}
        />
      </div>
    );
  }

  const vendorName = VENDOR_MAP[rb.vendorId] ?? rb.vendorId;
  const hasDocMissing = rb.lineReceipts.some((l) => l.documentStatus === "partial" || l.documentStatus === "missing");
  const hasQuarantine = rb.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === "quarantined"));
  const hasInspectionPending = rb.lineReceipts.some((l) => l.inspectionRequired && (l.inspectionStatus === "pending" || l.inspectionStatus === "in_progress"));
  const passedCount = rb.lineReceipts.filter((l) => l.inspectionStatus === "passed").length;
  const totalReceived = rb.lineReceipts.reduce((sum, l) => sum + l.receivedQuantity, 0);
  const totalOrdered = rb.lineReceipts.reduce((sum, l) => sum + l.orderedQuantity, 0);

  const isPosted = rb.status === "posted" || rb.status === "closed";
  const canPost = !hasDocMissing && !hasQuarantine && !hasInspectionPending && !isPosted;

  // Primary inbox item
  const primaryInbox = inboxItems[0];

  const contextStrip: InboxContextStripProps | undefined = primaryInbox
    ? {
        workTypeLabel: primaryInbox.workType === "quarantine_constrained" ? "격리" : primaryInbox.workType === "receiving_issue" ? "입고 이슈" : "반영 차단",
        whyNow: primaryInbox.summary,
        dueLabel: primaryInbox.dueState.label,
        dueTone: primaryInbox.dueState.tone,
        owner: primaryInbox.owner,
      }
    : undefined;

  const header: OperationalHeaderProps = {
    title: `${rb.receivingNumber} — ${vendorName}`,
    reference: rb.id,
    statusLabel: STATUS_LABELS[rb.status] ?? rb.status,
    statusTone: STATUS_TONES[rb.status] ?? "neutral",
    subStatus: `${totalReceived}/${totalOrdered} 수령 · 검수 ${passedCount}/${rb.lineReceipts.length}`,
    keyDates: [
      { label: "입고일", value: new Date(rb.receivedAt).toLocaleDateString("ko-KR") },
    ],
    keyParties: [
      { label: "공급사", value: vendorName },
      { label: "수령자", value: rb.receivedBy ?? "-" },
      ...(rb.carrierName ? [{ label: "운송", value: rb.carrierName }] : []),
    ],
    riskBadges: [
      ...(hasDocMissing ? ["문서 누락"] : []),
      ...(hasQuarantine ? ["격리 품목"] : []),
      ...(hasInspectionPending ? ["검수 미완료"] : []),
      ...(totalReceived < totalOrdered ? ["부분 수령"] : []),
    ],
    nextActionSummary: isPosted
      ? "반영 완료"
      : canPost
        ? "재고 반영 가능"
        : hasDocMissing
          ? "문서 확보 후 검수"
          : hasQuarantine
            ? "격리 검사 실행"
            : "검수 완료 후 반영",
  };

  const blockerStrip: BlockerReviewStripProps | undefined = (() => {
    const blockers: BlockerReviewStripProps["blockers"] = [];
    const reviewPoints: BlockerReviewStripProps["reviewPoints"] = [];
    const warnings: BlockerReviewStripProps["warnings"] = [];

    if (hasDocMissing) blockers.push({ label: "필수 문서 미첨부 — 검수 진행 불가", actionable: true });
    if (hasQuarantine) blockers.push({ label: "온도 이탈/손상 품목 격리 중", actionable: true });
    if (hasInspectionPending) reviewPoints.push({ label: `검수 대기 ${rb.lineReceipts.filter((l) => l.inspectionRequired && l.inspectionStatus !== "passed" && l.inspectionStatus !== "failed").length}건` });
    if (totalReceived < totalOrdered) warnings.push({ label: `${totalOrdered - totalReceived}건 미도착` });

    if (blockers.length + reviewPoints.length + warnings.length === 0) return undefined;
    return { blockers, reviewPoints, warnings };
  })();

  const decisionPanel: DecisionPanelProps = {
    readinessSummary: isPosted
      ? "재고 반영 완료"
      : canPost
        ? "재고 반영 가능"
        : "차단 요인 해소 필요",
    readinessReady: canPost,
    blockedReasons: [
      ...(hasDocMissing ? ["문서 미첨부 라인 존재"] : []),
      ...(hasQuarantine ? ["격리 품목 미해결"] : []),
      ...(hasInspectionPending ? ["검수 미완료"] : []),
    ],
    recommendedAction: isPosted
      ? undefined
      : hasDocMissing
        ? "공급사에 문서 재요청"
        : hasQuarantine
          ? "격리 검사 실행 후 판정"
          : canPost
            ? "재고 반영 실행"
            : "검수 완료 후 반영",
    handoffTarget: isPosted
      ? { label: "재고 위험 관리", href: "/dashboard/stock-risk" }
      : undefined,
    actions: [
      ...rb.lineReceipts
        .filter((l) => l.inspectionRequired && l.inspectionStatus !== "passed" && l.inspectionStatus !== "failed")
        .map((l) => ({
          label: `라인 ${l.lineNumber} 검수 완료`,
          onClick: () => store.completeInspection(rb.id, l.id, true),
          variant: "secondary" as const,
        })),
      {
        label: isPosted ? "✓ 반영 완료" : "재고 반영",
        onClick: () => store.postToInventory(rb.id),
        variant: "primary" as const,
        disabled: !canPost || isPosted,
        disabledReason: isPosted ? "이미 반영됨" : !canPost ? "차단 요인 해소 필요" : undefined,
      },
    ],
  };

  const metaRail: MetaRailProps = {
    lastUpdated: new Date(rb.receivedAt).toLocaleDateString("ko-KR"),
    linkedEntities: [
      ...(linkedPO ? [{ label: "발주", value: linkedPO.poNumber, href: `/dashboard/purchase-orders/${linkedPO.id}` }] : []),
      ...(rb.trackingNumber ? [{ label: "운송장", value: rb.trackingNumber }] : []),
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
        {/* ── 수령 라인 테이블 ── */}
        <div className="rounded border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              수령 라인 ({rb.lineReceipts.length}건)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-3 py-2 font-medium text-slate-500 w-8">#</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">품목</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">주문</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">수령</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">상태</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">문서</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">검수</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Lot</th>
                </tr>
              </thead>
              <tbody>
                {rb.lineReceipts.map((line) => {
                  const insBadge = INSPECTION_BADGE[line.inspectionStatus] ?? INSPECTION_BADGE.pending;
                  const isExpanded = expandedLines[line.id];
                  const docTone = line.documentStatus === "complete" ? "text-emerald-400" : "text-amber-400";
                  const condTone = line.conditionStatus === "ok" ? "text-emerald-400" : line.conditionStatus === "temperature_excursion" ? "text-red-400" : "text-amber-400";

                  return (
                    <tbody key={line.id}>
                      <tr className="border-b border-slate-800">
                        <td className="px-3 py-2 text-slate-500 font-mono">{line.lineNumber}</td>
                        <td className="px-3 py-2 text-slate-200">{line.itemName}</td>
                        <td className="px-3 py-2 text-slate-400">{line.orderedQuantity}</td>
                        <td className="px-3 py-2 text-slate-300">{line.receivedQuantity}</td>
                        <td className="px-3 py-2">
                          <span className={condTone}>
                            {line.conditionStatus === "ok" ? "양호" : line.conditionStatus === "temperature_excursion" ? "온도이탈" : line.conditionStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={docTone}>
                            {line.documentStatus === "complete" ? "완료" : line.documentStatus === "partial" ? "부분" : "누락"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${insBadge.className}`}>
                            {insBadge.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setExpandedLines((prev) => ({ ...prev, [line.id]: !prev[line.id] }))}
                            className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                          >
                            {line.lotRecords.length}건
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-800">
                          <td colSpan={8} className="px-3 py-0">
                            <div className="py-2 pl-6 space-y-1">
                              {line.lotRecords.map((lot) => {
                                const qBadge = QUARANTINE_BADGE[lot.quarantineStatus];
                                return (
                                  <div key={lot.id} className="flex items-center gap-4 text-[11px] text-slate-400">
                                    <span className="font-mono text-slate-300">{lot.lotNumber}</span>
                                    <span>{lot.quantity} {lot.unit}</span>
                                    <span className="font-mono">{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString("ko-KR") : "—"}</span>
                                    <span>{lot.storageCondition}</span>
                                    {qBadge && lot.quarantineStatus !== "released" && lot.quarantineStatus !== "not_applicable" && (
                                      <Badge variant="outline" className={`text-[10px] ${qBadge.className}`}>
                                        {qBadge.label}
                                      </Badge>
                                    )}
                                    <span className={lot.coaAttached ? "text-emerald-400" : "text-amber-400"}>
                                      COA: {lot.coaAttached ? "✓" : "✗"}
                                    </span>
                                    {lot.notes && <span className="text-slate-500 italic">{lot.notes}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 검수 요약 ── */}
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">검수 요약</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-500">전체</div>
              <div className="text-slate-200 font-medium">{rb.lineReceipts.length}건</div>
            </div>
            <div>
              <div className="text-slate-500">합격</div>
              <div className="text-emerald-400 font-medium">{passedCount}건</div>
            </div>
            <div>
              <div className="text-slate-500">대기</div>
              <div className="text-amber-400 font-medium">
                {rb.lineReceipts.filter((l) => l.inspectionRequired && (l.inspectionStatus === "pending" || l.inspectionStatus === "in_progress")).length}건
              </div>
            </div>
            <div>
              <div className="text-slate-500">불합격</div>
              <div className="text-red-400 font-medium">
                {rb.lineReceipts.filter((l) => l.inspectionStatus === "failed").length}건
              </div>
            </div>
          </div>
        </div>
      </OperationalDetailShell>
    </div>
  );
}
