"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  toQuoteVendorResponseVM,
  toQuoteComparisonRowVM,
  toQuoteDecisionSummaryVM,
} from "@/lib/ops-console/ops-adapters";
import type { QuoteVendorResponseVM, QuoteComparisonRowVM, QuoteDecisionSummaryVM } from "@/lib/review-queue/quote-rfq-view-models";
import { cn } from "@/lib/utils";
import { CheckCircle2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OperationalDetailShell,
  DetailStateFallback,
  type InboxContextStripProps,
  type OperationalHeaderProps,
  type BlockerReviewStripProps,
  type MetaRailProps,
} from "../../_components/operational-detail-shell";
import { VENDOR_MAP } from "@/lib/ops-console/seed-data";
import { buildQuoteCommandSurface } from "@/lib/ops-console/command-adapters";
import type { CommandSurface } from "@/lib/ops-console/action-model";
import { buildQuoteOwnership } from "@/lib/ops-console/ownership-adapter";
import { buildQuoteBlockers } from "@/lib/ops-console/blocker-adapter";

// ── 상태 라벨 ──
const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  ready_to_send: "발송 준비",
  sent: "발송됨",
  partially_responded: "부분 응답",
  responded: "응답 완료",
  comparison_ready: "비교 준비",
  vendor_selected: "공급사 선정",
  converted_to_po: "발주 전환",
  expired: "만료",
  cancelled: "취소",
};

const STATUS_TONES: Record<string, OperationalHeaderProps["statusTone"]> = {
  draft: "neutral",
  sent: "info",
  partially_responded: "warning",
  responded: "info",
  comparison_ready: "info",
  vendor_selected: "success",
  converted_to_po: "success",
  expired: "danger",
  cancelled: "neutral",
};

const MATCH_TONE_CLASSES: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400",
  info: "bg-blue-500/10 text-blue-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-red-500/10 text-red-400",
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;
  const store = useOpsStore();

  const quoteRequest = useMemo(
    () => store.quoteRequests.find((qr) => qr.id === quoteId),
    [store.quoteRequests, quoteId],
  );

  const responses = useMemo(
    () => store.quoteResponses.filter((r) => r.quoteRequestId === quoteId),
    [store.quoteResponses, quoteId],
  );

  const comparison = useMemo(
    () => store.quoteComparisons.find((c) => c.quoteRequestId === quoteId) ?? null,
    [store.quoteComparisons, quoteId],
  );

  const vendorMap = useMemo(() => {
    const map: Record<string, string> = { ...VENDOR_MAP };
    for (const r of responses) {
      if (!map[r.vendorId]) map[r.vendorId] = r.vendorId;
    }
    return map;
  }, [responses]);

  const vendorCards: QuoteVendorResponseVM[] = useMemo(
    () => responses.map((r) => toQuoteVendorResponseVM(r, vendorMap[r.vendorId] ?? r.vendorId)),
    [responses, vendorMap],
  );

  const comparisonRows: QuoteComparisonRowVM[] = useMemo(
    () => comparison ? comparison.comparableItemRows.map((row) => toQuoteComparisonRowVM(row, vendorMap)) : [],
    [comparison, vendorMap],
  );

  const decisionSummary: QuoteDecisionSummaryVM | null = useMemo(
    () => (comparison ? toQuoteDecisionSummaryVM(comparison, responses, vendorMap) : null),
    [comparison, responses, vendorMap],
  );

  // inbox context from unified inbox
  const inboxItem = useMemo(
    () => store.unifiedInboxItems.find((i) => i.entityId === quoteId),
    [store.unifiedInboxItems, quoteId],
  );

  // Due state
  const dueState = useMemo(() => {
    if (!quoteRequest?.dueAt) return { label: "기한 없음", tone: "normal" as const };
    const now = new Date();
    const due = new Date(quoteRequest.dueAt);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs < 0) return { label: `${Math.abs(Math.floor(diffDays))}일 초과`, tone: "overdue" as const };
    if (diffDays <= 3) return { label: diffDays < 1 ? "오늘 마감" : `${Math.ceil(diffDays)}일 남음`, tone: "due_soon" as const };
    return { label: `${Math.ceil(diffDays)}일 남음`, tone: "normal" as const };
  }, [quoteRequest]);

  const handleSelectVendor = (vendorId: string) => {
    if (!quoteRequest) return;
    store.selectVendor(quoteRequest.id, vendorId);
  };

  const handleConvertToPO = () => {
    if (!quoteRequest) return;
    store.convertQuoteToPO(quoteRequest.id);
    router.push("/dashboard/purchase-orders");
  };

  // ── Not found ──
  if (!quoteRequest) {
    return (
      <div className="max-w-7xl mx-auto">
        <DetailStateFallback
          type="not_found"
          entityLabel="견적 요청"
          nextRoute={{ label: "견적 목록", href: "/dashboard/quotes" }}
        />
      </div>
    );
  }

  const isVendorSelected = quoteRequest.status === "vendor_selected" || quoteRequest.status === "converted_to_po";
  const isConverted = quoteRequest.status === "converted_to_po";

  // ── Shell props ──
  const respondedCount = responses.filter((r) => r.responseStatus === "responded" || r.responseStatus === "incomplete").length;
  const hasSubstitute = responses.some((r) => r.responseItems.some((ri) => ri.substituteOffered));
  const hasMissingDocs = comparisonRows.some((r) => r.vendorColumns.some((vc) => vc.warningBadges.length > 0));

  const contextStrip: InboxContextStripProps | undefined = inboxItem
    ? {
        workTypeLabel: inboxItem.workType === "quote_review_required" ? "견적 검토" : "견적 대기",
        whyNow: inboxItem.summary,
        dueLabel: inboxItem.dueState.label,
        dueTone: inboxItem.dueState.tone,
        owner: inboxItem.owner,
      }
    : undefined;

  const header: OperationalHeaderProps = {
    title: quoteRequest.title,
    reference: quoteRequest.requestNumber,
    statusLabel: STATUS_LABELS[quoteRequest.status] ?? quoteRequest.status,
    statusTone: STATUS_TONES[quoteRequest.status] ?? "neutral",
    subStatus: `${respondedCount}/${quoteRequest.vendorIds.length} 공급사 응답`,
    keyDates: [
      { label: "마감", value: dueState.label, tone: dueState.tone },
      { label: "요청일", value: new Date(quoteRequest.createdAt).toLocaleDateString("ko-KR") },
    ],
    keyParties: [
      { label: "요청팀", value: quoteRequest.requesterTeam ?? "-" },
    ],
    riskBadges: [
      ...(hasSubstitute ? ["대체품 포함"] : []),
      ...(hasMissingDocs ? ["문서 누락"] : []),
      ...(comparison?.missingResponses?.length ? [`미응답 ${comparison.missingResponses.length}곳`] : []),
    ],
    nextActionSummary: isConverted
      ? "발주 전환 완료"
      : isVendorSelected
        ? "발주 전환 가능"
        : "비교 검토 후 공급사 선정",
  };

  const blockerStrip: BlockerReviewStripProps | undefined = (() => {
    const blockers: BlockerReviewStripProps["blockers"] = [];
    const reviewPoints: BlockerReviewStripProps["reviewPoints"] = [];
    const warnings: BlockerReviewStripProps["warnings"] = [];

    if (comparison?.missingResponses?.length) {
      warnings.push({ label: `미응답 공급사 ${comparison.missingResponses.length}곳` });
    }
    if (hasSubstitute) {
      reviewPoints.push({ label: "대체품 제안 포함 — 스펙 적합성 확인 필요" });
    }
    if (hasMissingDocs) {
      reviewPoints.push({ label: "일부 공급사 필수 문서 미첨부" });
    }
    if (decisionSummary?.conversionBlockers.length) {
      for (const b of decisionSummary.conversionBlockers) {
        blockers.push({ label: b, actionable: false });
      }
    }

    if (blockers.length + reviewPoints.length + warnings.length === 0) return undefined;
    return { blockers, reviewPoints, warnings };
  })();

  const commandSurface: CommandSurface = useMemo(
    () =>
      buildQuoteCommandSurface({
        quoteRequest,
        responses,
        comparison,
        vendorMap,
        onSelectVendor: handleSelectVendor,
        onConvertToPO: handleConvertToPO,
      }),
    [quoteRequest, responses, comparison, vendorMap],
  );

  const ownership = useMemo(
    () => buildQuoteOwnership(quoteRequest, responses),
    [quoteRequest, responses],
  );

  const blockerView = useMemo(
    () => buildQuoteBlockers(quoteRequest, responses, comparison),
    [quoteRequest, responses, comparison],
  );

  const metaRail: MetaRailProps = {
    lastUpdated: new Date(quoteRequest.createdAt).toLocaleDateString("ko-KR"),
    sourceLinks: quoteRequest.sourceType ? [{ label: "출처", value: quoteRequest.sourceType }] : undefined,
    linkedEntities: [
      ...(quoteRequest.budgetContextId ? [{ label: "예산", value: quoteRequest.budgetContextId }] : []),
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
        {/* ── 공급사 응답 카드 ── */}
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">공급사 응답</h2>
          {vendorCards.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">아직 공급사 응답이 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {vendorCards.map((vc) => (
                <div
                  key={vc.vendorId}
                  className={cn(
                    "rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2",
                    quoteRequest.summary.selectedVendorId === vc.vendorId && "border-emerald-500/50 ring-1 ring-emerald-500/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">{vc.vendorName}</span>
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                      vc.statusTone === "success" ? "bg-emerald-500/10 text-emerald-400"
                        : vc.statusTone === "warning" ? "bg-amber-500/10 text-amber-400"
                          : "bg-slate-700 text-slate-300",
                    )}>
                      {vc.responseStatusLabel}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <p>{vc.responseCoverage.label}</p>
                    {vc.priceRangeText && <p>가격: {vc.priceRangeText}</p>}
                    {vc.leadTimeRangeText && <p>납기: {vc.leadTimeRangeText}</p>}
                    {vc.missingDocsCount > 0 && <p className="text-amber-400">누락 문서: {vc.missingDocsCount}건</p>}
                    {vc.substituteCount > 0 && <p className="text-blue-400">대체품: {vc.substituteCount}건</p>}
                  </div>

                  {vc.riskBadges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {vc.riskBadges.map((badge) => (
                        <span key={badge} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">{badge}</span>
                      ))}
                    </div>
                  )}

                  {vc.canSelect && !isVendorSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs mt-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => handleSelectVendor(vc.vendorId)}
                    >
                      공급사 선택
                    </Button>
                  )}

                  {quoteRequest.summary.selectedVendorId === vc.vendorId && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      선정됨
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 비교 테이블 ── */}
        {comparisonRows.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">품목 비교</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-3 py-2 font-medium text-slate-500 min-w-[140px]">요청 품목</th>
                    {comparisonRows[0]?.vendorColumns.map((vc) => (
                      <th key={vc.vendorId} className="text-left px-3 py-2 font-medium text-slate-500 min-w-[160px]">
                        {vc.vendorName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.requestItemId} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="text-slate-100 font-medium">{row.itemLabel}</p>
                        {row.issueSummary && <p className="text-amber-400 mt-0.5 text-[10px]">{row.issueSummary}</p>}
                      </td>
                      {row.vendorColumns.map((vc) => (
                        <td key={vc.vendorId} className="px-3 py-2.5">
                          <div className="space-y-1">
                            {vc.priceLabel && <p className="text-slate-100 font-medium">{vc.priceLabel}</p>}
                            {vc.leadTimeLabel && (
                              <p className="text-slate-400 flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {vc.leadTimeLabel}
                              </p>
                            )}
                            <span className={cn(
                              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                              MATCH_TONE_CLASSES[vc.matchTone] ?? MATCH_TONE_CLASSES.info,
                            )}>
                              {vc.matchLabel}
                            </span>
                            {vc.warningBadges.map((wb) => (
                              <span key={wb} className="block text-[10px] text-amber-400">{wb}</span>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </OperationalDetailShell>
    </div>
  );
}
