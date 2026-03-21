"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useRef, useMemo } from "react";
import { QuoteRequestPanel, QuoteItemsSummaryPanel, type QuoteRequestPanelRef } from "../../_components/quote-panel";
import { useTestFlow } from "../../_components/test-flow-provider";
import { useCompareStore } from "@/lib/store/compare-store";
import { calculateAssembly, type VendorGroup } from "../../_components/request-assembly";
import { PriceDisplay } from "@/components/products/price-display";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Package,
  ChevronRight,
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
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
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
  const canSend = level === "ready_to_write_request" || level === "split_required" || level === "review_first";
  const activeGroup: VendorGroup | undefined = vendorGroups[activeGroupIdx];

  const handleVendorNoteChange = (vendorId: string, note: string) => {
    setVendorNotes((prev) => ({ ...prev, [vendorId]: note }));
    requestPanelRef.current?.markDirty();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ Layer 1: Session Header ═══ */}
      <div className="shrink-0">
        {/* Top bar — wordmark + navigation */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0">
              <span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span>
            </Link>
            <div className="w-px h-4 md:h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">견적 요청 검토 및 확정</span>
          </div>
          <Link href="/test/quote" className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            요청 조립으로
          </Link>
        </div>

        {/* Session context — operational header, not thin strip */}
        <div className="px-4 md:px-6 py-3 border-b border-bd" style={{ backgroundColor: '#393b3f' }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: session description */}
            <div className="min-w-0">
              <p className="text-xs text-slate-300 mb-1.5">
                조립된 요청 단위를 검토하고 공급사 전달 전 마지막 보완을 진행하세요.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
                  <ReadinessIcon className="h-3 w-3" />
                  {config.label}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{summary.totalItems}건</span>
                  <span className="text-slate-600">·</span>
                  <span>{summary.vendorCount}곳</span>
                  <span className="text-slate-600">·</span>
                  <span>요청 {summary.requestCount}건</span>
                </div>
                <Badge variant="secondary" className="text-[9px] bg-pn text-slate-300 border-bd">
                  {vendorGroups.length > 1
                    ? `요청서 ${activeGroupIdx + 1} / ${vendorGroups.length} 검토 중`
                    : `1건 요청서 검토 중`
                  }
                </Badge>
              </div>
            </div>
            {/* Right: amount + status pills */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-lg font-bold tabular-nums text-slate-100">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
              <div className="flex items-center gap-1.5">
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
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Layer 2: Request Context / Split Workband ═══ */}
      {vendorGroups.length > 0 && (
        <div className="shrink-0 px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#353739' }}>
          {/* Context text */}
          <p className="text-[10px] text-slate-500 mb-2">
            {vendorGroups.length > 1
              ? `총 ${summary.totalItems}개 품목이 ${vendorGroups.length}개 공급사 기준으로 ${vendorGroups.length}건의 요청서로 분리 전송됩니다`
              : `${activeGroup?.vendorName || "공급사"} 대상 ${summary.totalItems}건 품목 요청서를 검토 중입니다`
            }
          </p>
          {/* Unit selector tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {vendorGroups.map((g, idx) => (
              <button
                key={g.vendorName}
                onClick={() => setActiveGroupIdx(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  idx === activeGroupIdx
                    ? "bg-blue-600/10 text-blue-400 border-blue-600/30"
                    : "text-slate-400 border-bd hover:bg-el hover:text-slate-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <div className="text-left">
                  <span className="block">{g.vendorName}</span>
                  <span className="block text-[10px] opacity-70">{g.itemCount}건 · ₩{g.subtotal.toLocaleString("ko-KR")}</span>
                </div>
                {idx === activeGroupIdx && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300">검토 중</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Layer 3+4+5+6: Main Content — 3-panel layout ═══ */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Review Surface + Completion Form ── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4">

          {/* ═══ Readiness Gate — decision driver, not decoration ═══ */}
          <div className={`rounded-lg border px-4 py-3 ${
            level === "blocked" ? "border-red-600/20 bg-red-600/5"
            : level === "review_first" ? "border-amber-600/20 bg-amber-600/5"
            : level === "split_required" ? "border-blue-600/20 bg-blue-600/5"
            : "border-emerald-600/20 bg-emerald-600/5"
          }`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <ReadinessIcon className={`h-4 w-4 shrink-0 ${
                  level === "blocked" ? "text-red-400"
                  : level === "review_first" ? "text-amber-400"
                  : level === "split_required" ? "text-blue-400"
                  : "text-emerald-400"
                }`} />
                <span className="text-xs font-medium text-slate-200">{config.label}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {canSend
                  ? `${summary.requestCount}건 요청 전송 가능`
                  : "전송 불가 — 아래 항목을 확인하세요"
                }
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-2">
              {level === "ready_to_write_request" && "모든 항목이 준비되었습니다. 보완 사항이 있으면 아래에서 추가하세요."}
              {level === "split_required" && `공급사별 분리 요청이 적용되어 ${vendorGroups.length}건으로 전송됩니다. 각 요청서를 검토하세요.`}
              {level === "review_first" && "일부 항목에 추가 확인이 필요합니다. 아래 내용을 검토하세요."}
              {level === "blocked" && "필수 정보가 부족합니다. 차단 사유를 해결한 뒤 전송하세요."}
            </p>
            {(blockers.length > 0 || warnings.length > 0) && (
              <div className="space-y-1 pt-1 border-t border-bd/30">
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

          {/* Request Unit Review Surface — BEFORE form */}
          {activeGroup && (
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">{activeGroup.vendorName}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-pn text-slate-400">{activeGroup.itemCount}건</Badge>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-100">₩{activeGroup.subtotal.toLocaleString("ko-KR")}</span>
              </div>
              <div className="divide-y divide-bd/50">
                {activeGroup.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{item.productName}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        {item.catalogNumber && (
                          <span className="font-mono text-slate-500 truncate max-w-[100px]">Cat. {item.catalogNumber}</span>
                        )}
                        {item.isInCompare && (
                          <span className="text-[9px] px-1 py-0 rounded bg-blue-600/10 text-blue-400">비교중</span>
                        )}
                        {!item.hasPrice && (
                          <span className="text-[9px] px-1 py-0 rounded bg-amber-600/10 text-amber-400">가격 미확인</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">×{item.quantity}</span>
                    <div className="shrink-0 text-right w-20">
                      {item.hasPrice ? (
                        <span className="text-sm font-semibold tabular-nums text-slate-100">
                          <PriceDisplay price={item.lineTotal} currency="KRW" />
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">문의</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Form Surface — after review, positioned as "보완" not "작성" */}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2 px-1">공급사 전달 정보 보완</div>
            <QuoteRequestPanel ref={requestPanelRef} vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
          </div>
        </div>

        {/* ── Right: Active Decision Panel ── */}
        <div className="hidden lg:flex w-[320px] shrink-0 border-l border-bd flex-col overflow-y-auto" style={{ backgroundColor: '#393b3f' }}>
          {/* Readiness */}
          <div className="px-4 py-3 border-b border-bd">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">요청 준비 상태</span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />
                {config.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-100">{summary.totalItems}</p>
                <p className="text-[10px] text-slate-500">품목</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-100">{summary.requestCount}</p>
                <p className="text-[10px] text-slate-500">요청서</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-100">{summary.vendorCount}</p>
                <p className="text-[10px] text-slate-500">공급사</p>
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-bd/50">
              <span className="text-xs text-slate-400">예상 합계</span>
              <span className="text-sm font-bold tabular-nums text-slate-100">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
            </div>
          </div>

          {/* Active group detail */}
          {activeGroup && (
            <div className="px-4 py-3 border-b border-bd">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">현재 검토 요청</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">공급사</span>
                  <span className="text-slate-200 font-medium">{activeGroup.vendorName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">품목</span>
                  <span className="text-slate-200">{activeGroup.itemCount}건</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">금액</span>
                  <span className="text-slate-200 tabular-nums">₩{activeGroup.subtotal.toLocaleString("ko-KR")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Split summary */}
          {vendorGroups.length > 1 && (
            <div className="px-4 py-3 border-b border-bd">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">전체 요청 분리</div>
              <div className="space-y-1.5">
                {vendorGroups.map((g, idx) => (
                  <button
                    key={g.vendorName}
                    onClick={() => setActiveGroupIdx(idx)}
                    className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${
                      idx === activeGroupIdx ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-el"
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{g.vendorName}</span>
                    <span className="tabular-nums">{g.itemCount}건 · ₩{g.subtotal.toLocaleString("ko-KR")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary panel from quote-panel */}
          <div className="flex-1">
            <QuoteItemsSummaryPanel vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
          </div>

          {/* Panel CTA — active unit 판단 */}
          <div className="px-4 py-3 border-t border-bd space-y-2">
            {vendorGroups.length > 1 && activeGroupIdx < vendorGroups.length - 1 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs text-blue-400 border-blue-600/30 hover:bg-blue-600/10"
                onClick={() => setActiveGroupIdx(activeGroupIdx + 1)}
              >
                다음 요청서 검토
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            {vendorGroups.length > 1 && activeGroupIdx > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-7 text-[10px] text-slate-400"
                onClick={() => setActiveGroupIdx(activeGroupIdx - 1)}
              >
                이전 요청서로
              </Button>
            )}
            <Link href="/test/quote" className="block">
              <Button size="sm" variant="ghost" className="w-full h-7 text-[10px] text-slate-500 hover:text-slate-300">
                요청 조립으로 돌아가기
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ Layer 7: Sticky Action Layer — always visible ═══ */}
      {quoteItems.length > 0 && (
        <div className="shrink-0 border-t-2 border-bd px-4 md:px-6 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            {/* Left: readiness + summary */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />
                {config.label}
              </span>
              <span className="text-xs text-slate-400 tabular-nums font-medium hidden sm:block">
                {summary.totalItems}건 · ₩{summary.totalAmount.toLocaleString("ko-KR")}
              </span>
              {vendorGroups.length > 1 && (
                <span className="text-[10px] text-blue-400 hidden md:block">
                  {vendorGroups.length}건 분리 전송
                </span>
              )}
            </div>

            {/* Right: CTAs */}
            <div className="flex items-center gap-2 shrink-0">
              {vendorGroups.length > 1 && activeGroupIdx < vendorGroups.length - 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs text-slate-400 border-bd hover:text-slate-200"
                  onClick={() => setActiveGroupIdx(activeGroupIdx + 1)}
                >
                  다음 요청서
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                disabled={!canSend}
                form="quote-request-form"
                type="submit"
              >
                견적 요청 보내기
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
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
