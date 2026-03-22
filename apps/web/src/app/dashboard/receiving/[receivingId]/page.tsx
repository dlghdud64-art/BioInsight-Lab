"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  FileWarning,
  Package,
  Truck,
  ArrowRight,
  Zap,
} from "lucide-react";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import {
  OperationalDetailShell,
  DetailStateFallback,
  type InboxContextStripProps,
  type OperationalHeaderProps,
  type BlockerReviewStripProps,
  type MetaRailProps,
} from "../../_components/operational-detail-shell";
import { buildReceivingCommandSurface } from "@/lib/ops-console/command-adapters";
import type { CommandSurface } from "@/lib/ops-console/action-model";
import { buildReceivingOwnership } from "@/lib/ops-console/ownership-adapter";
import { buildReceivingBlockers } from "@/lib/ops-console/blocker-adapter";
import { buildReceivingExceptionReentryContext } from "@/lib/ops-console/reentry-context";
import { injectReentryCommand } from "@/lib/ops-console/command-adapters";
import {
  buildReceivingExecutionModel,
  type ReceivingExecutionModel,
  type ReceivingExecutionPhase,
  type LotDetailRow,
  type ReceivingLineExecution,
} from "@/lib/ops-console/receiving-detail-adapter";

// ── Phase step config for execution strip ──────────────────────────
const PHASE_STEPS: { key: string; label: string; matchPhases: ReceivingExecutionPhase[] }[] = [
  { key: "arrival", label: "도착 확인", matchPhases: ["expected", "arrived"] },
  { key: "inspection", label: "검수/문서", matchPhases: ["inspection_pending", "inspection_in_progress", "docs_missing"] },
  { key: "lot_capture", label: "Lot/격리", matchPhases: ["quarantine_active"] },
  { key: "posting", label: "재고 반영", matchPhases: ["ready_to_post", "partial_posting"] },
  { key: "handoff", label: "재고 위험", matchPhases: ["posted", "closed"] },
];

// ── Tone → color utilities ─────────────────────────────────────────
const TONE_TEXT: Record<string, string> = {
  neutral: "text-slate-400",
  info: "text-blue-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  success: "text-emerald-400",
};

const TONE_BG: Record<string, string> = {
  neutral: "bg-slate-800/50",
  info: "bg-blue-900/30",
  warning: "bg-amber-900/30",
  danger: "bg-red-900/30",
  success: "bg-emerald-900/30",
};

const TONE_BORDER: Record<string, string> = {
  neutral: "border-slate-700",
  info: "border-blue-800",
  warning: "border-amber-800",
  danger: "border-red-800",
  success: "border-emerald-800",
};

const EXPIRY_TONE_COLOR: Record<string, string> = {
  safe: "text-emerald-400",
  expiring_soon: "text-amber-400",
  expired: "text-red-400",
  missing: "text-slate-500",
};

const QUARANTINE_TONE_COLOR: Record<string, string> = {
  neutral: "text-slate-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  success: "text-emerald-400",
};

// ── Component ──────────────────────────────────────────────────────
export default function ReceivingDetailPage() {
  const params = useParams();
  const receivingId = params.receivingId as string;
  const store = useOpsStore();
  const [expandedLots, setExpandedLots] = useState(false);

  const rb = useMemo(
    () => store.receivingBatches.find((r) => r.id === receivingId),
    [store.receivingBatches, receivingId],
  );

  const linkedPO = useMemo(
    () => (rb?.poId ? store.purchaseOrders.find((p) => p.id === rb.poId) : undefined),
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

  // ── Build unified execution model ──────────────────────────────
  const model: ReceivingExecutionModel = useMemo(
    () => buildReceivingExecutionModel(rb, linkedPO, vendorName),
    [rb, linkedPO, vendorName],
  );

  // ── Shell props ────────────────────────────────────────────────
  const primaryInbox = inboxItems[0];

  const contextStrip: InboxContextStripProps | undefined = primaryInbox
    ? {
        workTypeLabel:
          primaryInbox.workType === "quarantine_constrained"
            ? "격리"
            : primaryInbox.workType === "receiving_issue"
              ? "입고 이슈"
              : "반영 차단",
        whyNow: primaryInbox.summary,
        dueLabel: primaryInbox.dueState.label,
        dueTone: primaryInbox.dueState.tone,
        owner: primaryInbox.owner,
      }
    : undefined;

  const header: OperationalHeaderProps = {
    title: `${rb.receivingNumber} — ${vendorName}`,
    reference: rb.id,
    statusLabel: model.receivingExecutionState.phaseLabel,
    statusTone: model.receivingExecutionState.phaseTone,
    subStatus: model.receiptProgress.label,
    keyDates: [
      { label: "입고일", value: new Date(rb.receivedAt).toLocaleDateString("ko-KR") },
    ],
    keyParties: [
      { label: "공급사", value: vendorName },
      { label: "수령자", value: rb.receivedBy ?? "-" },
      ...(rb.carrierName ? [{ label: "운송", value: rb.carrierName }] : []),
    ],
    riskBadges: [
      ...(model.document.tone === "danger" ? ["문서 누락"] : []),
      ...(model.lotCapture.quarantinedLots > 0 ? ["격리 품목"] : []),
      ...(model.inspection.blockerLabel ? ["검수 미완료"] : []),
      ...(model.receiptProgress.missingLines > 0 ? ["미도착 라인"] : []),
      ...(model.lotCapture.expiredLots > 0 ? ["만료 lot"] : []),
    ],
    nextActionSummary: model.nextActionSummary,
  };

  const blockerStrip: BlockerReviewStripProps | undefined = (() => {
    const blockers: BlockerReviewStripProps["blockers"] = [];
    const reviewPoints: BlockerReviewStripProps["reviewPoints"] = [];
    const warnings: BlockerReviewStripProps["warnings"] = [];

    if (model.document.missingLines > 0)
      blockers.push({ label: `${model.document.missingLines}건 필수 문서 미첨부 — 검수 진행 불가`, actionable: true });
    if (model.lotCapture.blockedLots > 0)
      blockers.push({ label: `${model.lotCapture.blockedLots}건 차단 lot — 재고 반영 불가`, actionable: true });
    if (model.lotCapture.quarantinedLots > 0)
      blockers.push({ label: `${model.lotCapture.quarantinedLots}건 격리 중 — 판정 필요`, actionable: true });
    if (model.inspection.failed > 0)
      blockers.push({ label: `${model.inspection.failed}건 불합격 — 재검수 또는 반품`, actionable: true });

    if (model.inspection.pending > 0)
      reviewPoints.push({ label: `검수 대기 ${model.inspection.pending}건` });
    if (model.document.needsReviewLines > 0)
      reviewPoints.push({ label: `문서 검토 대기 ${model.document.needsReviewLines}건` });

    if (model.receiptProgress.missingLines > 0)
      warnings.push({ label: `${model.receiptProgress.missingLines}건 미도착` });
    if (model.receiptProgress.overReceivedLines > 0)
      warnings.push({ label: `${model.receiptProgress.overReceivedLines}건 초과 수령` });
    if (model.lotCapture.expiredLots > 0)
      warnings.push({ label: `${model.lotCapture.expiredLots}건 만료 lot` });
    if (model.lotCapture.missingExpiryLots > 0)
      warnings.push({ label: `${model.lotCapture.missingExpiryLots}건 유효기한 미입력` });

    if (blockers.length + reviewPoints.length + warnings.length === 0) return undefined;
    return { blockers, reviewPoints, warnings };
  })();

  const ownership = useMemo(() => buildReceivingOwnership(rb), [rb]);
  const blockerView = useMemo(() => buildReceivingBlockers(rb), [rb]);

  const hasException =
    model.document.tone === "danger" ||
    model.lotCapture.quarantinedLots > 0 ||
    model.receiptProgress.missingLines > 0;
  const reentryCtx = useMemo(
    () => (hasException ? buildReceivingExceptionReentryContext(rb) : undefined),
    [rb, hasException],
  );

  const commandSurface: CommandSurface = useMemo(() => {
    const base = buildReceivingCommandSurface({
      rb,
      onCompleteInspection: (lineId: string) => store.completeInspection(rb.id, lineId, true),
      onPostToInventory: () => store.postToInventory(rb.id),
    });
    return injectReentryCommand(base, reentryCtx);
  }, [rb, store, reentryCtx]);

  const metaRail: MetaRailProps = {
    lastUpdated: new Date(rb.receivedAt).toLocaleDateString("ko-KR"),
    linkedEntities: [
      ...(linkedPO
        ? [{ label: "발주", value: linkedPO.poNumber, href: `/dashboard/purchase-orders/${linkedPO.id}` }]
        : []),
      ...(rb.trackingNumber ? [{ label: "운송장", value: rb.trackingNumber }] : []),
    ],
  };

  // ── Execution Phase ────────────────────────────────────────────
  const currentPhase = model.receivingExecutionState.phase;
  const terminalPhases: ReceivingExecutionPhase[] = ["cancelled", "issue_flagged"];
  const isTerminal = terminalPhases.includes(currentPhase);

  return (
    <div className="max-w-7xl mx-auto">
      <OperationalDetailShell
        contextStrip={contextStrip}
        header={header}
        ownership={ownership}
        blockerStrip={blockerStrip}
        blockerView={blockerView}
        commandSurface={commandSurface}
        metaRail={metaRail}
      >
        {/* ── A. Upstream Context Strip ─────────────────────────── */}
        <UpstreamContextStrip origin={model.origin} />

        {/* ── B. Execution Phase Strip ─────────────────────────── */}
        {!isTerminal && <ExecutionPhaseStrip currentPhase={currentPhase} />}

        {/* ── C. Receipt + Inspection Summary ──────────────────── */}
        <ReceiptInspectionSurface model={model} />

        {/* ── D. Document Summary ──────────────────────────────── */}
        <DocumentSurface model={model} />

        {/* ── E. Line Execution Table ──────────────────────────── */}
        <LineExecutionTable lines={model.lineExecutions} />

        {/* ── E-2. Receiving Input Panel (수량 입력 / Lot 생성 / Discrepancy) ── */}
        <ReceivingInputPanel lines={model.lineExecutions} lots={model.lotDetails} />

        {/* ── F. Lot Detail Grid ───────────────────────────────── */}
        <LotDetailSurface
          lots={model.lotDetails}
          lotCapture={model.lotCapture}
          expanded={expandedLots}
          onToggle={() => setExpandedLots((p) => !p)}
        />

        {/* ── G. Posting Readiness ─────────────────────────────── */}
        <PostingReadinessStrip model={model} />

        {/* ── H. Inventory Release + Stock Risk Handoff ────────── */}
        {(model.receivingExecutionState.phase === "posted" ||
          model.receivingExecutionState.phase === "closed" ||
          model.postingReadiness.readiness === "ready") && (
          <InventoryReleaseHandoffPanel model={model} />
        )}
      </OperationalDetailShell>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// A. Upstream Context Strip
// ══════════════════════════════════════════════════════════════════════

function UpstreamContextStrip({ origin }: { origin: ReceivingExecutionModel["origin"] }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-900/50 border border-slate-800 rounded px-3 py-2">
      <Truck className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
      <span className="text-slate-400">{origin.sourceLabel}</span>
      {origin.poRef && origin.poRoute && (
        <>
          <span className="text-slate-700">·</span>
          <Link href={origin.poRoute} className="text-blue-400 hover:text-blue-300 font-mono">
            {origin.poRef}
          </Link>
        </>
      )}
      <span className="text-slate-700">·</span>
      <span>{origin.vendorSummary}</span>
      <span className="text-slate-700">·</span>
      <span>도착 {origin.arrivalLabel}</span>
      {origin.trackingLabel && (
        <>
          <span className="text-slate-700">·</span>
          <span className="font-mono">{origin.trackingLabel}</span>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// B. Execution Phase Strip
// ══════════════════════════════════════════════════════════════════════

function ExecutionPhaseStrip({ currentPhase }: { currentPhase: ReceivingExecutionPhase }) {
  const currentIdx = PHASE_STEPS.findIndex((s) => s.matchPhases.includes(currentPhase));

  return (
    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-3 py-2.5">
      {PHASE_STEPS.map((step, idx) => {
        const isCurrent = idx === currentIdx;
        const isDone = idx < currentIdx;
        const dotCls = isCurrent
          ? "bg-blue-500"
          : isDone
            ? "bg-emerald-500"
            : "bg-slate-700";
        const textCls = isCurrent
          ? "text-blue-300 font-medium"
          : isDone
            ? "text-emerald-400"
            : "text-slate-600";

        return (
          <div key={step.key} className="flex items-center gap-1">
            {idx > 0 && (
              <div className={`w-6 h-px ${isDone ? "bg-emerald-700" : "bg-slate-800"}`} />
            )}
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dotCls}`} />
              <span className={`text-xs ${textCls}`}>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// C. Receipt + Inspection Summary
// ══════════════════════════════════════════════════════════════════════

function ReceiptInspectionSurface({ model }: { model: ReceivingExecutionModel }) {
  const rp = model.receiptProgress;
  const ins = model.inspection;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Receipt Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">수령 현황</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <StatCell label="전체 라인" value={rp.totalLines} />
          <StatCell label="수령 완료" value={rp.receivedLines} tone="success" />
          <StatCell label="부분 수령" value={rp.partialLines} tone={rp.partialLines > 0 ? "warning" : undefined} />
          <StatCell label="미도착" value={rp.missingLines} tone={rp.missingLines > 0 ? "danger" : undefined} />
          <StatCell label="초과 수령" value={rp.overReceivedLines} tone={rp.overReceivedLines > 0 ? "warning" : undefined} />
          <StatCell label="거부" value={rp.rejectedLines} tone={rp.rejectedLines > 0 ? "danger" : undefined} />
        </div>
        <div className="mt-2 text-xs text-slate-400">{rp.label}</div>
      </div>

      {/* Inspection Summary */}
      <div className={`bg-slate-900 border rounded p-3 ${TONE_BORDER[ins.tone]}`}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">검수</span>
          <span className={`text-xs ${TONE_TEXT[ins.tone]}`}>{ins.label}</span>
        </div>
        {ins.totalRequired === 0 ? (
          <div className="text-xs text-slate-500">검수 불요</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <StatCell label="필수" value={ins.totalRequired} />
              <StatCell label="합격" value={ins.passed} tone="success" />
              <StatCell label="불합격" value={ins.failed} tone={ins.failed > 0 ? "danger" : undefined} />
              <StatCell label="대기" value={ins.pending} tone={ins.pending > 0 ? "warning" : undefined} />
              <StatCell label="조건부" value={ins.conditionalPass} tone={ins.conditionalPass > 0 ? "warning" : undefined} />
              <StatCell label="재검수" value={ins.reinspectRequired} tone={ins.reinspectRequired > 0 ? "danger" : undefined} />
            </div>
            {ins.blockerLabel && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {ins.blockerLabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// D. Document Summary
// ══════════════════════════════════════════════════════════════════════

function DocumentSurface({ model }: { model: ReceivingExecutionModel }) {
  const doc = model.document;
  return (
    <div className={`bg-slate-900 border rounded p-3 ${TONE_BORDER[doc.tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <FileWarning className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">문서 현황</span>
        <span className={`text-xs ${TONE_TEXT[doc.tone]}`}>{doc.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <StatCell label="완료" value={doc.completeLines} tone="success" />
        <StatCell label="부분" value={doc.partialLines} tone={doc.partialLines > 0 ? "warning" : undefined} />
        <StatCell label="누락" value={doc.missingLines} tone={doc.missingLines > 0 ? "danger" : undefined} />
        <StatCell label="검토" value={doc.needsReviewLines} tone={doc.needsReviewLines > 0 ? "warning" : undefined} />
      </div>
      {doc.missingTypes.length > 0 && (
        <div className="mt-2 text-xs text-amber-400">
          미첨부: {doc.missingTypes.join(", ")}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// E. Line Execution Table
// ══════════════════════════════════════════════════════════════════════

function LineExecutionTable({ lines }: { lines: ReceivingLineExecution[] }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          수령 라인 ({lines.length}건)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30">
              <th className="text-left px-3 py-2 font-medium text-slate-500 w-8">#</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">품목</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">수량</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">상태</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">문서</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">검수</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Lot</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">반영</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">액션</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const condCls = TONE_TEXT[line.conditionTone] ?? "text-slate-400";
              const docCls = TONE_TEXT[line.documentTone] ?? "text-slate-400";
              const insCls = TONE_TEXT[line.inspectionTone] ?? "text-slate-400";

              return (
                <tr key={line.id} className="border-b border-slate-800 hover:bg-slate-800/20">
                  <td className="px-3 py-2 text-slate-500 font-mono">{line.lineNumber}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-[200px] truncate">{line.itemLabel}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono">{line.orderedVsReceived}</td>
                  <td className={`px-3 py-2 ${condCls}`}>{line.conditionLabel}</td>
                  <td className={`px-3 py-2 ${docCls}`}>{line.documentLabel}</td>
                  <td className={`px-3 py-2 ${insCls}`}>{line.inspectionLabel}</td>
                  <td className="px-3 py-2 text-slate-400">{line.lotSummary}</td>
                  <td className="px-3 py-2 text-slate-400">{line.postingRelevance}</td>
                  <td className="px-3 py-2">
                    {line.nextAction && (
                      <span className="text-xs text-amber-400">{line.nextAction}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// F. Lot Detail Surface
// ══════════════════════════════════════════════════════════════════════

function LotDetailSurface({
  lots,
  lotCapture,
  expanded,
  onToggle,
}: {
  lots: LotDetailRow[];
  lotCapture: ReceivingExecutionModel["lotCapture"];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded border bg-slate-900 ${TONE_BORDER[lotCapture.tone]} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Lot 상세 ({lots.length}건)
          </span>
          <span className={`text-xs ${TONE_TEXT[lotCapture.tone]}`}>{lotCapture.label}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2 font-medium text-slate-500">라인</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">품목</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Lot#</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">수량</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">유효기한</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">격리</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">문서</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">반영</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">리스크</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">액션</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-slate-800 hover:bg-slate-800/20">
                  <td className="px-3 py-2 text-slate-500 font-mono">{lot.lineNumber}</td>
                  <td className="px-3 py-2 text-slate-300 max-w-[140px] truncate">{lot.itemName}</td>
                  <td className="px-3 py-2 text-slate-200 font-mono">{lot.lotNumber}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono">
                    {lot.quantity} {lot.unit}
                  </td>
                  <td className={`px-3 py-2 ${EXPIRY_TONE_COLOR[lot.expiryTone]}`}>{lot.expiryLabel}</td>
                  <td className={`px-3 py-2 ${QUARANTINE_TONE_COLOR[lot.quarantineTone]}`}>
                    {lot.quarantineLabel}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{lot.documentCoverage}</td>
                  <td className="px-3 py-2 text-slate-400">{lot.postingState}</td>
                  <td className="px-3 py-2">
                    {lot.riskBadges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {lot.riskBadges.map((badge) => (
                          <Badge
                            key={badge}
                            variant="outline"
                            className="text-[10px] border-amber-700 text-amber-300 bg-amber-900/20"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {lot.nextAction && (
                      <span className="text-xs text-amber-400">{lot.nextAction}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// G. Posting Readiness Strip
// ══════════════════════════════════════════════════════════════════════

function PostingReadinessStrip({ model }: { model: ReceivingExecutionModel }) {
  const pr = model.postingReadiness;
  const toneCls =
    pr.readiness === "ready"
      ? "border-emerald-800 bg-emerald-900/20"
      : pr.readiness === "partial"
        ? "border-amber-800 bg-amber-900/20"
        : "border-red-800 bg-red-900/20";
  const textCls =
    pr.readiness === "ready"
      ? "text-emerald-400"
      : pr.readiness === "partial"
        ? "text-amber-400"
        : "text-red-400";
  const iconCls =
    pr.readiness === "ready"
      ? "text-emerald-500"
      : pr.readiness === "partial"
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className={`rounded border p-3 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pr.readiness === "ready" ? (
            <Zap className={`h-4 w-4 ${iconCls}`} />
          ) : (
            <AlertCircle className={`h-4 w-4 ${iconCls}`} />
          )}
          <span className={`text-sm font-medium ${textCls}`}>{pr.label}</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {pr.postableLineCount}/{pr.totalLineCount} 라인
        </span>
      </div>

      {pr.blockers.length > 0 && (
        <div className="mt-2 space-y-1">
          {pr.blockers.map((b) => (
            <div key={b} className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="h-1 w-1 rounded-full bg-red-500 flex-shrink-0" />
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// H. Inventory Release + Stock Risk Handoff
// ══════════════════════════════════════════════════════════════════════

function InventoryReleaseHandoffPanel({ model }: { model: ReceivingExecutionModel }) {
  const rel = model.inventoryRelease;
  const handoff = model.stockRiskHandoff;
  const lots = model.lotDetails;

  // Inventory risk signals from lots
  const expiringLots = lots.filter(l => l.expiryTone === "expiring_soon");
  const expiredLots = lots.filter(l => l.expiryTone === "expired");
  const quarantinedLots = lots.filter(l => l.quarantineTone === "danger" || l.quarantineTone === "warning");

  return (
    <div className="space-y-3">
      {/* Inventory Release Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded p-3">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
          재고 반영 결과
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <StatCell label="반영 lot" value={rel.postedLots} tone="success" />
          <StatCell label="격리 lot" value={rel.quarantinedLots} tone={rel.quarantinedLots > 0 ? "danger" : undefined} />
          <StatCell label="가용 수량" value={rel.availableAfterPosting} tone="success" />
          <StatCell label="격리 수량" value={rel.quarantinedAfterPosting} tone={rel.quarantinedAfterPosting > 0 ? "warning" : undefined} />
        </div>
        <div className="mt-2 text-xs text-slate-400">{rel.label}</div>
      </div>

      {/* Inventory Risk Assessment */}
      {(expiringLots.length > 0 || expiredLots.length > 0 || quarantinedLots.length > 0) && (
        <div className="bg-slate-900 border border-amber-800/40 rounded p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            재고 리스크 평가
          </div>
          <div className="space-y-1.5">
            {expiredLots.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-red-400" />
                  <span className="text-red-300">만료 lot {expiredLots.length}건 — 폐기/격리 필요</span>
                </div>
                <Link href="/dashboard/stock-risk" className="text-[10px] text-red-400 hover:text-red-300">검토 →</Link>
              </div>
            )}
            {expiringLots.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-300">만료 임박 lot {expiringLots.length}건 — 우선 사용 권장</span>
                </div>
                <Link href="/dashboard/inventory" className="text-[10px] text-amber-400 hover:text-amber-300">확인 →</Link>
              </div>
            )}
            {quarantinedLots.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3 w-3 text-red-400" />
                  <span className="text-red-300">격리 lot {quarantinedLots.length}건 — 판정 필요</span>
                </div>
                <span className="text-[10px] text-slate-500">격리 유지</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Stock Next Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded p-3">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
          후속 운영 액션
        </div>
        <div className="space-y-1.5">
          <Link href="/dashboard/inventory" className="flex items-center justify-between text-xs py-1 hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors">
            <div className="flex items-center gap-2"><Package className="h-3 w-3 text-slate-500" /><span className="text-slate-300">재고 위치 관리</span></div>
            <ChevronRight className="h-3 w-3 text-slate-600" />
          </Link>
          <Link href="/dashboard/stock-risk" className="flex items-center justify-between text-xs py-1 hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors">
            <div className="flex items-center gap-2"><AlertCircle className="h-3 w-3 text-slate-500" /><span className="text-slate-300">재주문 후보 확인</span></div>
            <ChevronRight className="h-3 w-3 text-slate-600" />
          </Link>
          {expiringLots.length > 0 && (
            <Link href="/dashboard/stock-risk" className="flex items-center justify-between text-xs py-1 hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors">
              <div className="flex items-center gap-2"><Clock className="h-3 w-3 text-amber-400" /><span className="text-amber-300">Expiry 주의 항목 {expiringLots.length}건</span></div>
              <ChevronRight className="h-3 w-3 text-slate-600" />
            </Link>
          )}
        </div>
      </div>

      {/* Stock Risk Handoff */}
      {handoff.needed && (
        <Link
          href={handoff.targetRoute}
          className="block bg-slate-900 border border-teal-800/50 rounded p-3 hover:border-teal-700/60 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              다운스트림 인계 — 재고 위험
            </span>
            <div className="flex items-center gap-1 text-xs text-teal-400 group-hover:text-teal-300">
              이동 <ArrowRight className="h-3 w-3" />
            </div>
          </div>
          <div className="text-sm text-slate-200 mb-1">{handoff.label}</div>
          {handoff.nextOwner && (
            <div className="text-xs text-slate-500">인수: {handoff.nextOwner}</div>
          )}
          {handoff.followUpReasons.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {handoff.followUpReasons.map((r) => (
                <div key={r} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ChevronRight className="h-3 w-3 text-slate-600" />
                  {r}
                </div>
              ))}
            </div>
          )}
        </Link>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Utility: Stat Cell
// ══════════════════════════════════════════════════════════════════════

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "danger";
}) {
  const valueCls = tone
    ? tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : "text-red-400"
    : "text-slate-200";

  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className={`font-medium tabular-nums ${valueCls}`}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// E-2. Receiving Input Panel — 부분 입고 / Lot 생성 / Discrepancy
// ══════════════════════════════════════════════════════════════════════

function ReceivingInputPanel({
  lines,
  lots,
}: {
  lines: ReceivingLineExecution[];
  lots: LotDetailRow[];
}) {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receivedQty, setReceivedQty] = useState<Record<string, string>>({});
  const [newLotNumber, setNewLotNumber] = useState("");
  const [newLotExpiry, setNewLotExpiry] = useState("");
  const [newLotLocation, setNewLotLocation] = useState("");
  const [discrepancies, setDiscrepancies] = useState<Record<string, string>>({});

  const activeLine = lines.find(l => l.id === activeLineId);
  const pendingLines = lines.filter(l => l.conditionTone !== "success");

  return (
    <div className="rounded border border-blue-800/50 bg-blue-900/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-800/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-medium text-blue-300">입고 수량 입력 / Lot 등록</span>
        </div>
        <span className="text-[10px] text-slate-500">{pendingLines.length}건 처리 대기</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Line selector */}
        <div className="flex flex-wrap gap-1.5">
          {lines.map(line => {
            const isActive = activeLineId === line.id;
            const isDone = line.conditionTone === "success";
            return (
              <button
                key={line.id}
                onClick={() => setActiveLineId(isActive ? null : line.id)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium border transition-all ${
                  isActive ? "bg-blue-600/15 text-blue-300 border-blue-600/30"
                  : isDone ? "bg-emerald-600/10 text-emerald-400 border-emerald-600/20 opacity-60"
                  : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600"
                }`}
              >
                #{line.lineNumber} {line.itemLabel.substring(0, 15)}{line.itemLabel.length > 15 ? "…" : ""}
              </button>
            );
          })}
        </div>

        {/* Active line input */}
        {activeLine && (
          <div className="rounded border border-slate-700 bg-slate-900/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">{activeLine.itemLabel}</span>
              <span className="text-[10px] text-slate-500">발주 {activeLine.orderedVsReceived}</span>
            </div>

            {/* 수량 입력 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">실제 도착 수량</label>
                <input
                  type="number"
                  min="0"
                  value={receivedQty[activeLine.id] ?? ""}
                  onChange={e => setReceivedQty(prev => ({ ...prev, [activeLine.id]: e.target.value }))}
                  placeholder="0"
                  className="w-full h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Lot/Batch 번호</label>
                <input
                  type="text"
                  value={newLotNumber}
                  onChange={e => setNewLotNumber(e.target.value)}
                  placeholder="LOT-2026-001"
                  className="w-full h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">유효기한</label>
                <input
                  type="date"
                  value={newLotExpiry}
                  onChange={e => setNewLotExpiry(e.target.value)}
                  className="w-full h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">보관 위치</label>
                <input
                  type="text"
                  value={newLotLocation}
                  onChange={e => setNewLotLocation(e.target.value)}
                  placeholder="연구동 B1 냉장고"
                  className="w-full h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Discrepancy */}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">이슈 (수량 차이 / 파손 / 오배송)</label>
              <select
                value={discrepancies[activeLine.id] ?? ""}
                onChange={e => setDiscrepancies(prev => ({ ...prev, [activeLine.id]: e.target.value }))}
                className="w-full h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:border-blue-600 focus:outline-none"
              >
                <option value="">이슈 없음</option>
                <option value="shortage">수량 부족</option>
                <option value="overage">초과 수령</option>
                <option value="damaged">파손</option>
                <option value="wrong_item">오배송</option>
                <option value="doc_missing">문서 누락</option>
                <option value="expiry_issue">유효기한 문제</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button className="h-7 px-3 text-[10px] font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                수량 확인
              </button>
              {newLotNumber && (
                <button className="h-7 px-3 text-[10px] font-medium rounded bg-emerald-600/15 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/25 transition-colors">
                  Lot 등록
                </button>
              )}
              {discrepancies[activeLine.id] && (
                <button className="h-7 px-3 text-[10px] font-medium rounded bg-amber-600/15 text-amber-400 border border-amber-600/30 hover:bg-amber-600/25 transition-colors">
                  이슈 등록
                </button>
              )}
              <button
                onClick={() => setActiveLineId(null)}
                className="h-7 px-2 text-[10px] text-slate-500 hover:text-slate-300"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {!activeLineId && pendingLines.length > 0 && (
          <div className="text-xs text-slate-500 text-center py-2">
            위 라인을 선택하면 수량 입력과 Lot 등록을 할 수 있습니다
          </div>
        )}
        {pendingLines.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 justify-center py-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            모든 라인 입고 처리 완료
          </div>
        )}
      </div>
    </div>
  );
}
