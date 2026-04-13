"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { useDispatchOutboundStore } from "@/lib/store/dispatch-outbound-store";
import {
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Package,
  FileText,
  Zap,
  Shield,
  ExternalLink,
  CalendarClock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import {
  OperationalDetailShell,
  DetailStateFallback,
  type InboxContextStripProps,
  type OperationalHeaderProps,
  type BlockerReviewStripProps,
  type MetaRailProps,
} from "../../_components/operational-detail-shell";
import { buildPOCommandSurface } from "@/lib/ops-console/command-adapters";
import type { CommandSurface } from "@/lib/ops-console/action-model";
import { buildPOOwnership } from "@/lib/ops-console/ownership-adapter";
import { buildPOBlockers } from "@/lib/ops-console/blocker-adapter";
import { buildPORecoveryReentryContext } from "@/lib/ops-console/reentry-context";
import { injectReentryCommand } from "@/lib/ops-console/command-adapters";
import {
  buildPOExecutionModel,
  type POExecutionModel,
  type ApprovalStepSummary,
  type LineExecutionSummary,
  type LineConfirmationSummary,
  type LineReceivingReadiness,
} from "@/lib/ops-console/po-detail-adapter";

// ── Status tones for OperationalHeader ──
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

// ── Step status styling ──
const STEP_TONE_STYLES: Record<string, string> = {
  neutral: "bg-slate-200 text-slate-600 border-slate-200",
  info: "bg-blue-900/40 text-blue-300 border-blue-700",
  warning: "bg-amber-900/40 text-amber-300 border-amber-700",
  danger: "bg-red-900/40 text-red-300 border-red-700",
  success: "bg-green-900/40 text-green-300 border-green-700",
};

const FULFILLMENT_TONE_STYLES: Record<string, string> = {
  neutral: "text-slate-400",
  info: "text-blue-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  success: "text-emerald-400",
};

// ── Readiness indicators ──
const READINESS_DOT: Record<string, string> = {
  ready: "bg-emerald-400",
  needs_review: "bg-amber-400",
  blocked: "bg-red-400",
  partial: "bg-amber-400",
};

const READINESS_TEXT: Record<string, string> = {
  ready: "text-emerald-400",
  needs_review: "text-amber-400",
  blocked: "text-red-400",
  partial: "text-amber-400",
};

// ==========================================================================
// Component
// ==========================================================================

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.poId as string;
  const store = useOpsStore();
  const [showApproval, setShowApproval] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showAck, setShowAck] = useState(true);
  const [showHandoff, setShowHandoff] = useState(true);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

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

  // ── Not found fallback ──
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

  // ── Build execution model ──
  const model: POExecutionModel = useMemo(
    () => buildPOExecutionModel(po, approval, ack, vendorName),
    [po, approval, ack, vendorName],
  );

  const isApproved = po.status === "approved" || po.status === "ready_to_issue";
  const isIssued = po.status === "issued" || po.status === "acknowledged";
  const isAcknowledged = po.status === "acknowledged";
  const ackPending = po.status === "issued" && (!ack || ack.status === "sent" || ack.status === "not_sent");

  // ── Outbound execution intent (created truth 와 분리된 schedule/cancel state) ──
  const outboundRecord = useDispatchOutboundStore((s) => s.recordsByPoId[po.id]);
  // append-only outbound lineage — read-only audit surface 용
  const outboundHistory = useDispatchOutboundStore((s) => s.historyByPoId[po.id] ?? []);
  const hydrateOutbound = useDispatchOutboundStore((s) => s.hydrateFromPersistence);
  const hydrateOutboundServer = useDispatchOutboundStore((s) => s.hydrateFromServerPersistence);

  // 서버 → sessionStorage 순서로 outbound history 를 hydrate (새로고침/탭 재진입 시)
  useEffect(() => {
    // 1. 동기 sessionStorage hydrate (즉각적)
    const synced = hydrateOutbound(po.id);
    // 2. 서버 hydrate (비동기, sessionStorage 에 없을 때만 실행)
    if (!synced) {
      hydrateOutboundServer(po.id);
    }
  }, [po.id, hydrateOutbound, hydrateOutboundServer]);

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
      { label: "납기", value: model.origin.requiredByLabel, tone: model.origin.requiredByTone },
      { label: "생성일", value: new Date(po.createdAt).toLocaleDateString("ko-KR") },
      ...(po.issuedAt ? [{ label: "발행일", value: new Date(po.issuedAt).toLocaleDateString("ko-KR") }] : []),
    ],
    keyParties: [
      { label: "공급사", value: vendorName },
      { label: "담당", value: po.ownerId ?? "-" },
    ],
    riskBadges: [
      ...(model.origin.requiredByTone === "overdue" ? ["납기 초과"] : []),
      ...(model.acknowledgement.phase === "ack_pending" ? ["확인 미응답"] : []),
      ...(model.approvalProgress.overdueStepCount > 0 ? ["승인 SLA 초과"] : []),
      ...(model.acknowledgement.phase === "declined" ? ["공급사 거절"] : []),
    ],
    nextActionSummary: model.nextActionSummary,
  };

  const blockerStrip: BlockerReviewStripProps | undefined = (() => {
    const blockers: BlockerReviewStripProps["blockers"] = [];
    const reviewPoints: BlockerReviewStripProps["reviewPoints"] = [];
    const warnings: BlockerReviewStripProps["warnings"] = [];

    if (model.issueReadiness.readiness === "blocked") {
      for (const b of model.issueReadiness.blockers) {
        blockers.push({ label: b, actionable: false });
      }
    }
    if (model.issueReadiness.readiness === "needs_review") {
      for (const b of model.issueReadiness.blockers) {
        reviewPoints.push({ label: b });
      }
    }
    if (model.acknowledgement.phase === "ack_pending" || model.acknowledgement.phase === "viewed") {
      warnings.push({ label: model.acknowledgement.waitingExternalLabel ?? "공급사 확인 대기" });
    }
    if (model.acknowledgement.phase === "needs_review") {
      reviewPoints.push({ label: "공급사 이슈 검토 필요" });
    }
    if (model.approvalProgress.returnReason) {
      blockers.push({ label: `반송 사유: ${model.approvalProgress.returnReason}`, actionable: true });
    }
    if (model.approvalProgress.conditionalNotes.length > 0) {
      for (const note of model.approvalProgress.conditionalNotes) {
        reviewPoints.push({ label: `조건부: ${note}` });
      }
    }
    if (blockers.length + reviewPoints.length + warnings.length === 0) return undefined;
    return { blockers, reviewPoints, warnings };
  })();

  const ownership = useMemo(
    () => buildPOOwnership(po, approval, ack),
    [po, approval, ack],
  );

  const blockerView = useMemo(
    () => buildPOBlockers(po, approval, ack),
    [po, approval, ack],
  );

  const reentryCtx = useMemo(
    () => ackPending ? buildPORecoveryReentryContext(po, ack) : undefined,
    [po, ack, ackPending],
  );

  const commandSurface: CommandSurface = useMemo(
    () => {
      const base = buildPOCommandSurface({
        po,
        approval,
        ack,
        vendorName,
        onIssuePO: () => store.issuePO(po.id),
        onAcknowledgePO: () => store.acknowledgePO(po.id),
        onGoToReceiving: () => router.push("/dashboard/receiving"),
      });
      return injectReentryCommand(base, reentryCtx);
    },
    [po, approval, ack, vendorName, store, router, reentryCtx],
  );

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
        ownership={ownership}
        blockerStrip={blockerStrip}
        blockerView={blockerView}
        commandSurface={commandSurface}
        metaRail={metaRail}
      >
        {/* ═══════════════════════════════════════════════════════
            A. Upstream Context Strip
            ═══════════════════════════════════════════════════════ */}
        <UpstreamContextStrip model={model} />

        {/* ═══════════════════════════════════════════════════════
            B. Execution Phase Strip
            ═══════════════════════════════════════════════════════ */}
        <ExecutionPhaseStrip model={model} />

        {/* ═══════════════════════════════════════════════════════
            B'. Dispatch Workbench Entry (governance handoff)
            isApproved 상태에서만 노출. 발송 워크벤치는 별도 라우트.
            outbound execution intent (schedule/cancel) 가 있으면
            in-context status 로 표시 — created truth 는 변경하지 않음.
            ═══════════════════════════════════════════════════════ */}
        {isApproved && !isIssued && (
          <>
            <DispatchWorkbenchEntry
              poId={po.id}
              outboundRecord={outboundRecord}
            />
            {/* outbound lineage (history >= 2 일 때만 노출 — 단일 mutation 은 latest strip 으로 충분) */}
            {outboundHistory.length >= 2 && (
              <>
                <DispatchOutboundHistoryStrip
                  history={outboundHistory}
                  onViewAll={() => setAuditModalOpen(true)}
                />
                <DispatchOutboundAuditModal
                  open={auditModalOpen}
                  onOpenChange={setAuditModalOpen}
                  history={outboundHistory}
                  poNumber={po.poNumber}
                />
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            C. Approval Execution Surface
            ═══════════════════════════════════════════════════════ */}
        {approval && (
          <CollapsibleSection
            title="승인 실행"
            badge={model.approvalProgress.overallLabel}
            badgeTone={model.approvalProgress.overallTone}
            open={showApproval}
            onToggle={() => setShowApproval(!showApproval)}
          >
            <ApprovalExecutionSurface model={model} />
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════════════════
            D. Issue Readiness + Line Work Surface
            ═══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          title={`발주 품목 (${po.lines.length}건)`}
          badge={model.issueReadiness.label}
          badgeTone={model.issueReadiness.readiness === "ready" ? "success" : model.issueReadiness.readiness === "needs_review" ? "warning" : "danger"}
          open={showLines}
          onToggle={() => setShowLines(!showLines)}
        >
          {/* Issue readiness strip */}
          <IssueReadinessStrip model={model} />
          {/* Line execution table */}
          <LineExecutionTable lines={model.lineExecutions} />
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════════════════
            E. Vendor Acknowledgement Surface
            ═══════════════════════════════════════════════════════ */}
        {(isIssued || isAcknowledged || model.acknowledgement.phase !== "not_applicable") && (
          <CollapsibleSection
            title="공급사 확인"
            badge={model.acknowledgement.phaseLabel}
            badgeTone={model.acknowledgement.phaseTone}
            open={showAck}
            onToggle={() => setShowAck(!showAck)}
          >
            <AcknowledgementSurface model={model} />
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════════════════
            F. Receiving Handoff Panel
            ═══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          title="입고 인계"
          badge={model.receivingHandoff.label}
          badgeTone={model.receivingHandoff.readiness === "ready" ? "success" : model.receivingHandoff.readiness === "partial" ? "warning" : "danger"}
          open={showHandoff}
          onToggle={() => setShowHandoff(!showHandoff)}
        >
          <ReceivingHandoffPanel model={model} />
        </CollapsibleSection>
      </OperationalDetailShell>
    </div>
  );
}

// ==========================================================================
// Sub-components
// ==========================================================================

// ── Upstream Context Strip ──
function UpstreamContextStrip({ model }: { model: POExecutionModel }) {
  const { origin } = model;
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 font-medium">
        {origin.sourceLabel}
      </span>
      <span className="text-slate-500">→</span>
      <span className="text-slate-500">
        {origin.vendorSummary}
      </span>
      {origin.quoteRoute && (
        <>
          <span className="text-slate-300">|</span>
          <Link
            href={origin.quoteRoute}
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <FileText className="h-3 w-3" />
            견적 {origin.quoteRef}
          </Link>
        </>
      )}
      <span className="ml-auto text-slate-500">
        <span className={cn(
          origin.requiredByTone === "overdue" ? "text-red-400" : origin.requiredByTone === "due_soon" ? "text-amber-400" : "text-slate-500",
        )}>
          {origin.requiredByLabel}
        </span>
      </span>
    </div>
  );
}

// ── Execution Phase Strip ──
function ExecutionPhaseStrip({ model }: { model: POExecutionModel }) {
  const phases = [
    { key: "approval", label: "승인", active: ["approval_pending", "approval_in_progress", "approval_returned"].includes(model.poExecutionState.phase), done: ["approved_not_issued", "issued_ack_pending", "issued_ack_partial", "acknowledged", "receiving_handoff_ready", "partially_received", "received", "closed"].includes(model.poExecutionState.phase) },
    { key: "issue", label: "발행", active: model.poExecutionState.phase === "approved_not_issued", done: ["issued_ack_pending", "issued_ack_partial", "acknowledged", "receiving_handoff_ready", "partially_received", "received", "closed"].includes(model.poExecutionState.phase) },
    { key: "ack", label: "공급사 확인", active: ["issued_ack_pending", "issued_ack_partial"].includes(model.poExecutionState.phase), done: ["acknowledged", "receiving_handoff_ready", "partially_received", "received", "closed"].includes(model.poExecutionState.phase) },
    { key: "handoff", label: "입고 인계", active: ["acknowledged", "receiving_handoff_ready"].includes(model.poExecutionState.phase), done: ["partially_received", "received", "closed"].includes(model.poExecutionState.phase) },
    { key: "receiving", label: "입고", active: model.poExecutionState.phase === "partially_received", done: ["received", "closed"].includes(model.poExecutionState.phase) },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-medium">
      {phases.map((p, i) => (
        <div key={p.key} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-slate-300">→</span>}
          <span
            className={cn(
              "px-2 py-1 rounded",
              p.done ? "bg-emerald-900/30 text-emerald-400" :
              p.active ? "bg-blue-900/30 text-blue-300 ring-1 ring-blue-500/30" :
              "bg-slate-100 text-slate-500",
            )}
          >
            {p.done && <CheckCircle2 className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({
  title,
  badge,
  badgeTone,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  badgeTone?: "neutral" | "info" | "warning" | "danger" | "success";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const toneCls: Record<string, string> = {
    neutral: "bg-slate-200 text-slate-600",
    info: "bg-blue-900/30 text-blue-300",
    warning: "bg-amber-900/30 text-amber-300",
    danger: "bg-red-900/30 text-red-300",
    success: "bg-emerald-900/30 text-emerald-300",
  };

  return (
    <div className="rounded border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</span>
          {badge && (
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded", toneCls[badgeTone ?? "neutral"])}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && <div className="border-t border-slate-200 p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Approval Execution Surface ──
function ApprovalExecutionSurface({ model }: { model: POExecutionModel }) {
  const { approvalProgress: ap } = model;

  return (
    <div className="space-y-3">
      {/* Overall status + blocker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", READINESS_DOT[ap.overallTone === "success" ? "ready" : ap.overallTone === "danger" ? "blocked" : "needs_review"])} />
          <span className="text-sm font-medium text-slate-900">{ap.overallLabel}</span>
          <span className="text-xs text-slate-500">{ap.completedCount}/{ap.totalCount}</span>
        </div>
        {ap.needsEscalation && (
          <span className="text-[10px] text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            에스컬레이션 필요
          </span>
        )}
      </div>

      {/* Blocker label */}
      {ap.blockerLabel && (
        <div className="flex items-center gap-2 text-xs bg-amber-900/10 border border-amber-800/30 rounded px-3 py-2">
          <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300">{ap.blockerLabel}</span>
        </div>
      )}

      {/* Return reason */}
      {ap.returnReason && (
        <div className="flex items-center gap-2 text-xs bg-red-900/10 border border-red-800/30 rounded px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-red-300">반송: {ap.returnReason}</span>
        </div>
      )}

      {/* Conditional notes */}
      {ap.conditionalNotes.length > 0 && (
        <div className="space-y-1">
          {ap.conditionalNotes.map((note, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              조건부: {note}
            </div>
          ))}
        </div>
      )}

      {/* Steps table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-3 py-2 font-medium text-slate-500 w-8">#</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">단계</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">상태</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">담당자</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">비고</th>
            </tr>
          </thead>
          <tbody>
            {ap.steps.map((step) => (
              <tr
                key={step.id}
                className={cn(
                  "border-b border-slate-200 last:border-b-0",
                  step.isCurrent ? "bg-blue-900/10" : "",
                  step.isOverdue ? "bg-red-900/5" : "",
                )}
              >
                <td className="px-3 py-2 text-slate-500 font-mono">{step.order}</td>
                <td className="px-3 py-2 text-slate-700">{step.typeLabel}</td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium", STEP_TONE_STYLES[step.statusTone])}>
                    {step.statusLabel}
                    {step.isOverdue && <Clock className="h-2.5 w-2.5 text-red-400" />}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-500" />
                    {step.assignees.join(", ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{step.decisionLabel ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Issue Readiness Strip ──
function IssueReadinessStrip({ model }: { model: POExecutionModel }) {
  const { issueReadiness: ir } = model;

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", READINESS_DOT[ir.readiness])} />
        <span className={cn("font-medium", READINESS_TEXT[ir.readiness])}>{ir.label}</span>
      </div>
      {ir.missingContext.length > 0 && (
        <div className="flex items-center gap-1 text-amber-400">
          <AlertCircle className="h-3 w-3" />
          {ir.missingContext.join(" · ")}
        </div>
      )}
    </div>
  );
}

// ── Line Execution Table ──
function LineExecutionTable({ lines }: { lines: LineExecutionSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-3 py-2 font-medium text-slate-500 w-8">#</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">품목</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">주문</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">납기</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">이행</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">문서</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">입고</th>
            <th className="text-left px-3 py-2 font-medium text-slate-500">조치</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-slate-200 last:border-b-0">
              <td className="px-3 py-2 text-slate-500 font-mono">{line.lineNumber}</td>
              <td className="px-3 py-2 text-slate-700">
                {line.itemLabel}
                {line.substituteFlag && (
                  <span className="ml-1 text-[10px] text-orange-400">[대체]</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{line.orderedSummary}</td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{line.expectedDelivery ?? "—"}</td>
              <td className="px-3 py-2">
                <span className={cn("font-medium", FULFILLMENT_TONE_STYLES[line.fulfillmentTone])}>
                  {line.fulfillmentLabel}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{line.documentCoverage}</td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{line.receivingRelevance}</td>
              <td className="px-3 py-2">
                {line.nextAction ? (
                  <span className="text-blue-400 font-medium">{line.nextAction}</span>
                ) : line.riskSummary ? (
                  <span className="text-amber-400">{line.riskSummary}</span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Acknowledgement Surface ──
function AcknowledgementSurface({ model }: { model: POExecutionModel }) {
  const { acknowledgement: a } = model;

  if (a.phase === "not_applicable") {
    return (
      <div className="text-xs text-slate-500 text-center py-4">
        발주 발행 후 공급사 확인이 시작됩니다
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Ack status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", READINESS_DOT[a.phase === "acknowledged" ? "ready" : a.phase === "ack_pending" || a.phase === "viewed" ? "needs_review" : a.phase === "declined" ? "blocked" : "needs_review"])} />
          <span className="text-sm font-medium text-slate-900">{a.phaseLabel}</span>
        </div>
        {a.vendorRef && (
          <span className="text-xs text-slate-500">공급사 참조: <span className="text-slate-700">{a.vendorRef}</span></span>
        )}
      </div>

      {/* Promised dates */}
      {(a.promisedShipLabel || a.promisedDeliveryLabel) && (
        <div className="flex items-center gap-4 text-xs">
          {a.promisedShipLabel && (
            <span className="text-slate-500">출하 예정: <span className="text-slate-700">{a.promisedShipLabel}</span></span>
          )}
          {a.promisedDeliveryLabel && (
            <span className="text-slate-500">납품 예정: <span className="text-slate-700">{a.promisedDeliveryLabel}</span></span>
          )}
        </div>
      )}

      {/* Waiting external */}
      {a.waitingExternalLabel && (
        <div className="flex items-center gap-2 text-xs bg-blue-900/10 border border-blue-800/30 rounded px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-blue-300">{a.waitingExternalLabel}</span>
          {a.followUpAction && (
            <span className="ml-auto text-blue-400 font-medium">{a.followUpAction}</span>
          )}
        </div>
      )}

      {/* Follow-up info */}
      {a.followUpOwner && !a.waitingExternalLabel && (
        <div className="text-xs text-slate-500">
          후속 담당: <span className="text-slate-600">{a.followUpOwner}</span>
          {a.followUpAction && <> · <span className="text-blue-400">{a.followUpAction}</span></>}
        </div>
      )}

      {/* Summary badges */}
      {(a.backorderCount > 0 || a.substituteCount > 0 || a.issueCount > 0) && (
        <div className="flex items-center gap-2 text-[10px] font-medium">
          {a.backorderCount > 0 && (
            <span className="rounded bg-amber-900/30 text-amber-300 px-2 py-0.5">재입고 {a.backorderCount}건</span>
          )}
          {a.substituteCount > 0 && (
            <span className="rounded bg-orange-900/30 text-orange-300 px-2 py-0.5">대체품 {a.substituteCount}건</span>
          )}
          {a.issueCount > 0 && (
            <span className="rounded bg-red-900/30 text-red-300 px-2 py-0.5">이슈 {a.issueCount}건</span>
          )}
        </div>
      )}

      {/* Line confirmations table */}
      {a.lineConfirmations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-3 py-2 font-medium text-slate-500 w-8">#</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">품목</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">확인 상태</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">확인 수량</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">납품 예정</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">이슈</th>
              </tr>
            </thead>
            <tbody>
              {a.lineConfirmations.map((lc) => (
                <tr key={lc.poLineId} className="border-b border-slate-200 last:border-b-0">
                  <td className="px-3 py-2 text-slate-500 font-mono">{lc.lineNumber}</td>
                  <td className="px-3 py-2 text-slate-700">{lc.itemName}</td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      lc.status === "confirmed" ? "bg-emerald-900/30 text-emerald-300" :
                      lc.status === "backordered" ? "bg-amber-900/30 text-amber-300" :
                      lc.status === "declined" ? "bg-red-900/30 text-red-300" :
                      "bg-slate-200 text-slate-600",
                    )}>
                      {lc.statusLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono">
                    {lc.confirmedQty ?? "—"}
                    {lc.backorderQty ? <span className="text-amber-400 ml-1">(+{lc.backorderQty} 대기)</span> : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{lc.confirmedDelivery ?? "—"}</td>
                  <td className="px-3 py-2">
                    {lc.hasIssue ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        이슈
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
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

// ── Receiving Handoff Panel ──
function ReceivingHandoffPanel({ model }: { model: POExecutionModel }) {
  const { receivingHandoff: rh } = model;

  return (
    <div className="space-y-3">
      {/* Readiness */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", READINESS_DOT[rh.readiness])} />
          <span className={cn("text-sm font-medium", READINESS_TEXT[rh.readiness])}>{rh.label}</span>
        </div>
        {rh.nextOwner && (
          <span className="text-xs text-slate-500">
            다음 담당: <span className="text-slate-700">{rh.nextOwner}</span>
          </span>
        )}
      </div>

      {/* Blockers */}
      {rh.blockers.length > 0 && (
        <div className="space-y-1">
          {rh.blockers.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-red-300">{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Downstream impact */}
      {rh.downstreamImpact && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded px-3 py-2">
          <Package className="h-3.5 w-3.5 shrink-0" />
          {rh.downstreamImpact}
        </div>
      )}

      {/* Line readiness */}
      {rh.lineReadiness.length > 0 && (
        <div className="grid gap-1">
          {rh.lineReadiness.map((lr) => (
            <div key={lr.lineNumber} className="flex items-center gap-2 text-xs">
              <span className={cn("w-1.5 h-1.5 rounded-full", lr.ready ? "bg-emerald-400" : "bg-slate-500")} />
              <span className="text-slate-700">{lr.lineNumber}. {lr.itemName}</span>
              {lr.reason && <span className="text-slate-500">{lr.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Handoff CTA */}
      {rh.readiness !== "blocked" && (
        <Link
          href={rh.targetRoute}
          className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          입고 관리 이동
        </Link>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Dispatch Workbench Entry — outbound execution intent in-context strip
//
// 발송 워크벤치(/dispatch) 진입점.
// outbound store 의 schedule/cancel intent 를 PO 상세에서 직접 노출한다.
// created truth(po.status) 는 절대 변경하지 않으며, 이 strip 은 오직
// outbound execution lifecycle 만 표시한다.
// ══════════════════════════════════════════════════════════════════════════════

interface DispatchWorkbenchEntryProps {
  poId: string;
  outboundRecord: import("@/lib/store/dispatch-outbound-store").DispatchOutboundRecord | undefined;
}

function DispatchWorkbenchEntry({ poId, outboundRecord }: DispatchWorkbenchEntryProps) {
  const href = `/dashboard/purchase-orders/${poId}/dispatch`;

  // ── 1) outbound intent 없음 → 기본 진입 strip ──
  if (!outboundRecord) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded border border-blue-700/40 bg-blue-900/20 hover:bg-blue-900/30 px-4 py-2.5 text-xs transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-700/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-200 uppercase tracking-wider">
            발송 워크벤치
          </span>
          <span className="text-slate-300">
            PO Created → Dispatch Prep — 공급사 송신 전 최종 검토 진입
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-blue-300" />
      </Link>
    );
  }

  // ── 2) 예약 발송 등록됨 ──
  if (outboundRecord.status === "scheduled" && outboundRecord.scheduledFor) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded border border-amber-700/40 bg-amber-900/15 hover:bg-amber-900/25 px-4 py-2.5 text-xs transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-700/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 uppercase tracking-wider">
            예약 발송 등록
          </span>
          <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-slate-300">
            {formatScheduledFor(outboundRecord.scheduledFor)} 발송 예정 — 워크벤치에서 재예약/취소
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-amber-300" />
      </Link>
    );
  }

  // ── 3) 예약 취소됨 ──
  if (outboundRecord.status === "schedule_cancelled") {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 hover:bg-slate-50 px-4 py-2.5 text-xs transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 uppercase tracking-wider">
            예약 취소됨
          </span>
          <XCircle className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-500">
            {outboundRecord.cancelReason ?? "사유 미기록"} — 워크벤치에서 재시도
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-slate-500" />
      </Link>
    );
  }

  // ── 4) dispatch prep 자체 폐기됨 ──
  if (outboundRecord.status === "prep_cancelled") {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/30 px-4 py-2.5 text-xs transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] font-medium text-rose-200 uppercase tracking-wider">
            발송 준비 폐기
          </span>
          <XCircle className="h-3.5 w-3.5 text-rose-300" />
          <span className="text-slate-400">
            {outboundRecord.cancelReason ?? "사유 미기록"} — 재진입하여 다시 준비 가능
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-rose-300" />
      </Link>
    );
  }

  // ── fallback (status union 확장 시 안전망) ──
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded border border-blue-700/40 bg-blue-900/20 hover:bg-blue-900/30 px-4 py-2.5 text-xs transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-blue-700/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-200 uppercase tracking-wider">
          발송 워크벤치
        </span>
        <span className="text-slate-300">발송 준비 워크벤치 진입</span>
      </div>
      <ArrowRight className="h-3 w-3 text-blue-300" />
    </Link>
  );
}

function formatScheduledFor(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DispatchOutboundHistoryStrip — outbound execution lineage (read-only audit)
//
// canonical truth 는 latest pointer (DispatchWorkbenchEntry) 가 그대로 보유한다.
// 본 strip 은 history 가 2건 이상일 때만 노출되며, 사용자에게 outbound intent 의
// 시간 흐름을 보여주는 작은 read-only 추가 컨텍스트일 뿐이다.
// 현재 UI 상태(latest)와의 중복을 피하기 위해 마지막 element 는 표기에서 제외한다.
// ══════════════════════════════════════════════════════════════════════════════

interface DispatchOutboundHistoryStripProps {
  history: ReadonlyArray<
    import("@/lib/store/dispatch-outbound-store").DispatchOutboundRecord
  >;
  onViewAll?: () => void;
}

function DispatchOutboundHistoryStrip({ history, onViewAll }: DispatchOutboundHistoryStripProps) {
  // 마지막은 latest strip 과 동일하므로 prior lineage 만 노출
  const prior = history.slice(0, -1);
  if (prior.length === 0) return null;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 uppercase tracking-wider">
          이전 발송 인텐트
        </span>
        <span className="text-slate-500">최신 결과 이전 lineage · {prior.length}건</span>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 font-medium"
          >
            전체 보기
          </button>
        )}
      </div>
      <ol className="space-y-1">
        {prior.map((record) => (
          <li key={record.id} className="flex items-center gap-2">
            <span className="text-slate-500 tabular-nums">
              {formatScheduledFor(record.updatedAt)}
            </span>
            <span className="text-slate-600">
              {describeOutboundStatus(record.status)}
            </span>
            {record.status === "scheduled" && record.scheduledFor && (
              <span className="text-slate-500">
                — {formatScheduledFor(record.scheduledFor)} 예정
              </span>
            )}
            {record.cancelReason && (
              <span className="text-slate-500">— {record.cancelReason}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DispatchOutboundAuditModal — 전체 outbound execution lineage timeline
//
// canonical truth 는 DispatchOutboundStore.historyByPoId 가 보유.
// 본 modal 은 read-only audit surface — 어떤 mutation 도 발생시키지 않는다.
// latest (마지막 record) 를 포함한 전체 timeline 을 시간 역순으로 표시한다.
// ══════════════════════════════════════════════════════════════════════════════

interface DispatchOutboundAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ReadonlyArray<
    import("@/lib/store/dispatch-outbound-store").DispatchOutboundRecord
  >;
  poNumber: string;
}

function DispatchOutboundAuditModal({
  open,
  onOpenChange,
  history,
  poNumber,
}: DispatchOutboundAuditModalProps) {
  if (!open) return null;

  // 전체 timeline (latest 포함) — 최신→과거 역순
  const timeline = [...history].reverse();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg mx-4 max-h-[80vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              발송 인텐트 타임라인
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {poNumber} · 전체 {timeline.length}건
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-500 hover:text-slate-700 text-xs font-medium px-2 py-1"
          >
            닫기
          </button>
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ol className="relative border-l border-slate-200 ml-2 space-y-4">
            {timeline.map((record, idx) => {
              const isLatest = idx === 0;
              return (
                <li key={record.id} className="ml-4">
                  {/* Dot */}
                  <span
                    className={cn(
                      "absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2",
                      isLatest
                        ? "bg-blue-500 border-blue-400"
                        : "bg-slate-300 border-slate-200",
                    )}
                    style={{ marginTop: "4px" }}
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
                      {formatScheduledFor(record.updatedAt)}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider bg-blue-950/40 px-1 py-0.5 rounded">
                        최신
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    {describeOutboundStatus(record.status)}
                  </p>
                  {record.status === "scheduled" && record.scheduledFor && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      예정: {formatScheduledFor(record.scheduledFor)}
                    </p>
                  )}
                  {record.cancelReason && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      사유: {record.cancelReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function describeOutboundStatus(
  status: import("@/lib/store/dispatch-outbound-store").DispatchOutboundStatus,
): string {
  switch (status) {
    case "scheduled":
      return "예약 발송 등록";
    case "schedule_cancelled":
      return "예약 취소";
    case "prep_cancelled":
      return "발송 준비 폐기";
    default:
      return status;
  }
}
