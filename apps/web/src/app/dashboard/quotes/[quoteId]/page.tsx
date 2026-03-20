"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  toQuoteVendorResponseVM,
  toQuoteComparisonRowVM,
  toQuoteDecisionSummaryVM,
} from "@/lib/ops-console/ops-adapters";
import type { QuoteVendorResponseVM } from "@/lib/review-queue/quote-rfq-view-models";
import type { QuoteComparisonRowVM, QuoteDecisionSummaryVM } from "@/lib/review-queue/quote-rfq-view-models";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ── 벤더맵 (데모) ──
const DEMO_VENDOR_MAP: Record<string, string> = {};

// ── 상태 배지 색상 ──

const STATUS_TONE_CLASSES: Record<string, string> = {
  neutral: "bg-zinc-500/10 text-zinc-400",
  info: "bg-blue-500/10 text-blue-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-red-500/10 text-red-400",
  success: "bg-emerald-500/10 text-emerald-400",
};

const MATCH_TONE_CLASSES: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400",
  info: "bg-blue-500/10 text-blue-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-red-500/10 text-red-400",
};

const READINESS_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  ready: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  needs_review: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  blocked: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
};

const READINESS_LABELS: Record<string, string> = {
  ready: "발주 전환 가능",
  needs_review: "검토 필요",
  blocked: "차단됨",
};

// ── Due State 색상 ──

const DUE_TONE_CLASSES: Record<string, string> = {
  normal: "text-slate-400",
  due_soon: "text-amber-400",
  overdue: "text-red-400",
};

// ── 페이지 ──

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;
  const store = useOpsStore();

  // 견적 요청 찾기
  const quoteRequest = useMemo(
    () => store.quoteRequests.find((qr) => qr.id === quoteId),
    [store.quoteRequests, quoteId],
  );

  // 해당 견적의 응답 찾기
  const responses = useMemo(
    () => store.quoteResponses.filter((r) => r.quoteRequestId === quoteId),
    [store.quoteResponses, quoteId],
  );

  // 비교 데이터 찾기
  const comparison = useMemo(
    () => store.quoteComparisons.find((c) => c.quoteRequestId === quoteId) ?? null,
    [store.quoteComparisons, quoteId],
  );

  // 벤더맵 구성
  const vendorMap = useMemo(() => {
    const map: Record<string, string> = { ...DEMO_VENDOR_MAP };
    for (const r of responses) {
      if (!map[r.vendorId]) {
        map[r.vendorId] = r.vendorId;
      }
    }
    return map;
  }, [responses]);

  // ViewModel 변환
  const vendorCards: QuoteVendorResponseVM[] = useMemo(
    () => responses.map((r) => toQuoteVendorResponseVM(r, vendorMap[r.vendorId] ?? r.vendorId)),
    [responses, vendorMap],
  );

  const comparisonRows: QuoteComparisonRowVM[] = useMemo(
    () =>
      comparison
        ? comparison.comparableItemRows.map((row) => toQuoteComparisonRowVM(row, vendorMap))
        : [],
    [comparison, vendorMap],
  );

  const decisionSummary: QuoteDecisionSummaryVM | null = useMemo(
    () => (comparison ? toQuoteDecisionSummaryVM(comparison, responses, vendorMap) : null),
    [comparison, responses, vendorMap],
  );

  // Due state
  const dueState = useMemo(() => {
    if (!quoteRequest?.dueAt) return { label: "기한 없음", tone: "normal" };
    const now = new Date();
    const due = new Date(quoteRequest.dueAt);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs < 0) return { label: `${Math.abs(Math.floor(diffDays))}일 초과`, tone: "overdue" };
    if (diffDays <= 3) return { label: diffDays < 1 ? "오늘 마감" : `${Math.ceil(diffDays)}일 남음`, tone: "due_soon" };
    return { label: `${Math.ceil(diffDays)}일 남음`, tone: "normal" };
  }, [quoteRequest]);

  // 상태 라벨
  const statusLabels: Record<string, string> = {
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

  // 액션 핸들러
  const handleSelectVendor = (vendorId: string) => {
    if (!quoteRequest) return;
    store.selectVendor(quoteRequest.id, vendorId);
  };

  const handleConvertToPO = () => {
    if (!quoteRequest) return;
    store.convertQuoteToPO(quoteRequest.id);
    router.push("/dashboard/purchase-orders");
  };

  // ── 견적 없음 ──
  if (!quoteRequest) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <FileText className="h-10 w-10 opacity-25" />
          <p className="text-sm">해당 견적 요청을 찾을 수 없습니다</p>
          <Link href="/dashboard/quotes">
            <Button variant="outline" size="sm" className="mt-2">
              목록으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isVendorSelected = quoteRequest.status === "vendor_selected" || quoteRequest.status === "converted_to_po";
  const isConverted = quoteRequest.status === "converted_to_po";

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* ── 헤더 ── */}
      <div>
        <Link
          href="/dashboard/quotes"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          견적 목록
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100">
                {quoteRequest.requestNumber}
              </h1>
              <span
                className={cn(
                  "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                  STATUS_TONE_CLASSES.info,
                )}
              >
                {statusLabels[quoteRequest.status] ?? quoteRequest.status}
              </span>
            </div>
            <p className="text-sm text-slate-400">{quoteRequest.title}</p>
          </div>
          <div className={cn("text-sm font-medium", DUE_TONE_CLASSES[dueState.tone])}>
            {dueState.label}
          </div>
        </div>
      </div>

      {/* ── 공급사 응답 카드 ── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">공급사 응답</h2>
        {vendorCards.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">아직 공급사 응답이 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendorCards.map((vc) => (
              <div
                key={vc.vendorId}
                className={cn(
                  "bg-pn rounded-lg border border-bd p-4 space-y-2",
                  quoteRequest.summary.selectedVendorId === vc.vendorId && "border-emerald-500/50 ring-1 ring-emerald-500/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">{vc.vendorName}</span>
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                      STATUS_TONE_CLASSES[vc.statusTone] ?? STATUS_TONE_CLASSES.neutral,
                    )}
                  >
                    {vc.responseStatusLabel}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <p>{vc.responseCoverage.label}</p>
                  {vc.priceRangeText && <p>가격 범위: {vc.priceRangeText}</p>}
                  {vc.leadTimeRangeText && <p>납기: {vc.leadTimeRangeText}</p>}
                  {vc.missingDocsCount > 0 && (
                    <p className="text-amber-400">누락 문서: {vc.missingDocsCount}건</p>
                  )}
                  {vc.substituteCount > 0 && (
                    <p className="text-blue-400">대체품 제안: {vc.substituteCount}건</p>
                  )}
                </div>

                {vc.riskBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {vc.riskBadges.map((badge) => (
                      <span key={badge} className="inline-flex px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}

                {vc.canSelect && !isVendorSelected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs mt-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
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
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">품목 비교</h2>
          <div className="border border-bd rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-el border-b border-bd">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider min-w-[140px]">
                    요청 품목
                  </th>
                  {comparisonRows[0]?.vendorColumns.map((vc) => (
                    <th
                      key={vc.vendorId}
                      className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider min-w-[160px]"
                    >
                      {vc.vendorName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.requestItemId} className="border-b border-bd last:border-b-0 hover:bg-el transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-st font-medium">{row.itemLabel}</p>
                      {row.issueSummary && (
                        <p className="text-amber-400 mt-0.5 text-[10px]">{row.issueSummary}</p>
                      )}
                    </td>
                    {row.vendorColumns.map((vc) => (
                      <td key={vc.vendorId} className="px-3 py-2.5">
                        <div className="space-y-1">
                          {vc.priceLabel && (
                            <p className="text-st font-medium">{vc.priceLabel}</p>
                          )}
                          {vc.leadTimeLabel && (
                            <p className="text-slate-400 flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {vc.leadTimeLabel}
                            </p>
                          )}
                          <span
                            className={cn(
                              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                              MATCH_TONE_CLASSES[vc.matchTone] ?? MATCH_TONE_CLASSES.info,
                            )}
                          >
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

          {/* 마커 범례 */}
          {comparisonRows.some((r) => r.bestPriceMarker || r.fastestLeadMarker) && (
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
              {comparisonRows.some((r) => r.bestPriceMarker) && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  최저가
                </span>
              )}
              {comparisonRows.some((r) => r.fastestLeadMarker) && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  최단 납기
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 의사결정 패널 ── */}
      {decisionSummary && (
        <div className={cn("bg-pn rounded-lg border p-5 space-y-4", READINESS_CLASSES[decisionSummary.conversionReadiness]?.border ?? "border-bd")}>
          <h2 className="text-sm font-semibold text-slate-300">의사결정 요약</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* 추천 공급사 */}
            <div>
              <p className="text-xs text-slate-500 mb-1">추천 공급사</p>
              <p className="text-st font-medium">
                {decisionSummary.recommendedVendorName ?? "추천 없음"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {decisionSummary.recommendationBasis}
              </p>
            </div>

            {/* 전환 준비 상태 */}
            <div>
              <p className="text-xs text-slate-500 mb-1">전환 준비 상태</p>
              <span
                className={cn(
                  "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                  READINESS_CLASSES[decisionSummary.conversionReadiness]?.bg,
                  READINESS_CLASSES[decisionSummary.conversionReadiness]?.text,
                )}
              >
                {READINESS_LABELS[decisionSummary.conversionReadiness]}
              </span>
            </div>

            {/* 미커버 / 대체품 */}
            {(decisionSummary.uncoveredItemCount > 0 || decisionSummary.substituteItemCount > 0) && (
              <div>
                <p className="text-xs text-slate-500 mb-1">주의 항목</p>
                <div className="space-y-0.5 text-xs">
                  {decisionSummary.uncoveredItemCount > 0 && (
                    <p className="text-amber-400">미커버 항목: {decisionSummary.uncoveredItemCount}건</p>
                  )}
                  {decisionSummary.substituteItemCount > 0 && (
                    <p className="text-blue-400">대체품: {decisionSummary.substituteItemCount}건</p>
                  )}
                  {decisionSummary.missingResponseVendorCount > 0 && (
                    <p className="text-slate-400">미응답 공급사: {decisionSummary.missingResponseVendorCount}곳</p>
                  )}
                </div>
              </div>
            )}

            {/* 차단 사유 */}
            {decisionSummary.conversionBlockers.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">차단 사유</p>
                <ul className="space-y-0.5">
                  {decisionSummary.conversionBlockers.map((b) => (
                    <li key={b} className="text-xs text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 pt-2 border-t border-bd">
            {!isVendorSelected && decisionSummary.recommendedVendorName && (
              <Button
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  const vendorId = comparison?.recommendedVendorId;
                  if (vendorId) handleSelectVendor(vendorId);
                }}
              >
                공급사 선택
              </Button>
            )}

            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              disabled={
                !isVendorSelected ||
                isConverted ||
                decisionSummary.conversionReadiness === "blocked"
              }
              onClick={handleConvertToPO}
              title={
                !isVendorSelected
                  ? "먼저 공급사를 선택하세요"
                  : isConverted
                    ? "이미 발주 전환됨"
                    : decisionSummary.conversionReadiness === "blocked"
                      ? "차단 사유 해결 필요"
                      : ""
              }
            >
              발주 전환
            </Button>

            {isConverted && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                발주 전환 완료
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
