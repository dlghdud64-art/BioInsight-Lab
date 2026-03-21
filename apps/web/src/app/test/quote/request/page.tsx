"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useRef, useMemo } from "react";
import { QuoteRequestPanel, QuoteItemsSummaryPanel, type QuoteRequestPanelRef } from "../../_components/quote-panel";
import { useTestFlow } from "../../_components/test-flow-provider";
import { useCompareStore } from "@/lib/store/compare-store";
import { calculateAssembly } from "../../_components/request-assembly";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";

// ── Readiness config ──

const READINESS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  ready_to_write_request: { color: "text-emerald-400 bg-emerald-600/10 border-emerald-600/30", icon: CheckCircle2, label: "요청 가능" },
  review_first: { color: "text-amber-400 bg-amber-600/10 border-amber-600/30", icon: AlertTriangle, label: "검토 필요" },
  blocked: { color: "text-red-400 bg-red-600/10 border-red-600/30", icon: AlertCircle, label: "요청 불가" },
  split_required: { color: "text-blue-400 bg-blue-600/10 border-blue-600/30", icon: Info, label: "분리 요청" },
};

function QuoteRequestPageContent() {
  const [vendorNotes, setVendorNotes] = useState<Record<string, string>>({});
  const requestPanelRef = useRef<QuoteRequestPanelRef>(null);

  const { quoteItems, products, compareIds } = useTestFlow();
  const { productIds: compareStoreIds } = useCompareStore();

  const allCompareIds = useMemo(
    () => [...new Set([...compareIds, ...compareStoreIds])],
    [compareIds, compareStoreIds],
  );

  const assembly = useMemo(
    () => calculateAssembly(quoteItems, allCompareIds, products),
    [quoteItems, allCompareIds, products],
  );

  const { level, vendorGroups, summary, blockers, warnings } = assembly;
  const config = READINESS_CONFIG[level] || READINESS_CONFIG.blocked;
  const ReadinessIcon = config.icon;

  const handleVendorNoteChange = (vendorId: string, note: string) => {
    setVendorNotes((prev) => ({
      ...prev,
      [vendorId]: note,
    }));
    requestPanelRef.current?.markDirty();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
      {/* ═══ Assembly-Aware Request Header ═══ */}
      <div className="shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0">
              <span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span>
            </Link>
            <div className="w-px h-4 md:h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">견적 요청 확정</span>
          </div>
          <Link href="/test/quote" className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            요청 조립으로
          </Link>
        </div>

        {/* Request Split / Group Context Band */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-bd flex-wrap" style={{ backgroundColor: '#393b3f' }}>
          {/* Readiness badge */}
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
            <ReadinessIcon className="h-3 w-3" />
            {config.label}
          </span>

          {/* KPI */}
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400">
            <span>{summary.totalItems}건</span>
            <span className="text-slate-600">·</span>
            <span>{summary.vendorCount}곳</span>
            <span className="text-slate-600">·</span>
            <span>요청 {summary.requestCount}건</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-200 font-medium tabular-nums">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
          </div>

          {/* Split info */}
          {vendorGroups.length > 1 && (
            <Badge variant="secondary" className="text-[9px] bg-blue-600/10 text-blue-400 border-blue-600/20">
              {vendorGroups.length}건 분리 전송
            </Badge>
          )}

          {/* Warnings */}
          {blockers.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-400">
              <AlertCircle className="h-2.5 w-2.5" />차단 {blockers.length}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />확인 {warnings.length}
            </span>
          )}
        </div>

        {/* Readiness gate — blockers/warnings inline */}
        {(blockers.length > 0 || warnings.length > 0) && (
          <div className="px-4 md:px-6 py-2 border-b border-bd space-y-1" style={{ backgroundColor: '#353739' }}>
            {blockers.map((msg, i) => (
              <div key={`b${i}`} className="flex items-center gap-2 text-[10px] text-red-300">
                <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />{msg}
              </div>
            ))}
            {warnings.map((msg, i) => (
              <div key={`w${i}`} className="flex items-center gap-2 text-[10px] text-amber-300">
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />{msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Request Detail Completion Surface ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-3 md:px-6 py-4">
          {/* Vendor group context — before form */}
          {vendorGroups.length > 0 && (
            <div className="rounded-lg border border-bd bg-pn px-4 py-3 mb-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">요청 분리 현황</div>
              <div className="flex flex-wrap gap-3">
                {vendorGroups.map((g) => (
                  <div key={g.vendorName} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-slate-500" />
                    <span className="text-slate-300 font-medium">{g.vendorName}</span>
                    <span className="text-slate-500">{g.itemCount}건</span>
                    <span className="text-slate-400 tabular-nums">₩{g.subtotal.toLocaleString("ko-KR")}</span>
                  </div>
                ))}
              </div>
              {vendorGroups.length > 1 && (
                <p className="text-[10px] text-blue-400 mt-2">
                  총 {summary.totalItems}개 품목이 {vendorGroups.length}개 공급사 기준으로 {vendorGroups.length}건의 요청서로 분리 전송됩니다
                </p>
              )}
            </div>
          )}

          {/* Form + Summary grid */}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
            {/* Left: 견적 요청 폼 */}
            <div className="w-full order-2 lg:order-1 lg:col-span-8">
              <QuoteRequestPanel ref={requestPanelRef} vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
            </div>

            {/* Right: Sticky Decision Panel */}
            <div className="w-full order-1 lg:order-2 lg:col-span-4">
              <div className="lg:sticky lg:top-4 space-y-3">
                {/* Readiness state */}
                <div className="rounded-lg border border-bd bg-pn px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">요청 준비 상태</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
                      <ReadinessIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums text-slate-100">{summary.totalItems}</p>
                      <p className="text-[10px] text-slate-500">품목</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-slate-100">{summary.requestCount}</p>
                      <p className="text-[10px] text-slate-500">요청서</p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-bd/50">
                    <span className="text-xs text-slate-400">예상 합계</span>
                    <span className="text-sm font-bold tabular-nums text-slate-100">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
                  </div>
                </div>

                {/* Summary panel */}
                <QuoteItemsSummaryPanel vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuoteRequestPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <QuoteRequestPageContent />
    </Suspense>
  );
}
