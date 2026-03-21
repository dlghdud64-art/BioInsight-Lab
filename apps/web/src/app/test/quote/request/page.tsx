"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useRef, useMemo, useEffect } from "react";
import { QuoteRequestPanel, QuoteItemsSummaryPanel, type QuoteRequestPanelRef } from "../../_components/quote-panel";
import { useTestFlow } from "../../_components/test-flow-provider";
import { useSession } from "next-auth/react";
import { useRouter as useNavRouter } from "next/navigation";
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
  const [holdUnits, setHoldUnits] = useState<Set<string>>(new Set());
  const [submissionOutcome, setSubmissionOutcome] = useState<{
    sentCount: number;
    heldCount: number;
    vendorCount: number;
    totalAmount: number;
    heldVendors: string[];
    sentAt: string;
  } | null>(null);
  const requestPanelRef = useRef<QuoteRequestPanelRef>(null);

  const { quoteItems, products, compareIds } = useTestFlow();
  const { data: session, status: authStatus } = useSession();
  const navRouter = useNavRouter();
  const { productIds: compareStoreIds } = useCompareStore();

  // Auth gate — request 확정 route는 로그인 필요
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      navRouter.replace(`/auth/signin?callbackUrl=${encodeURIComponent("/test/quote/request")}`);
    }
  }, [authStatus, navRouter]);

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

  // Per-unit status
  const readyCount = vendorGroups.filter(g => !holdUnits.has(g.vendorName)).length;
  const holdCount = holdUnits.size;
  const toggleHold = (vendorName: string) => {
    setHoldUnits(prev => {
      const next = new Set(prev);
      if (next.has(vendorName)) next.delete(vendorName);
      else next.add(vendorName);
      return next;
    });
  };

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
                {holdUnits.has(g.vendorName) ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600/20 text-slate-400">보류</span>
                ) : idx === activeGroupIdx ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300">검토 중</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300">전송</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Submission Outcome View ═══ */}
      {submissionOutcome && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 space-y-5">
            {/* Outcome Header */}
            <div className="text-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-100 mb-1">견적 요청이 전송되었습니다</h2>
              <p className="text-sm text-slate-400">{submissionOutcome.sentAt}</p>
            </div>

            {/* Outcome Summary */}
            <div className="rounded-lg border border-bd bg-pn px-5 py-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-3">전송 결과</div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-emerald-400">{submissionOutcome.sentCount}</p>
                  <p className="text-xs text-slate-500">전송 완료</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-amber-400">{submissionOutcome.heldCount}</p>
                  <p className="text-xs text-slate-500">보류</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-slate-100">{submissionOutcome.vendorCount}</p>
                  <p className="text-xs text-slate-500">공급사</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-slate-100">₩{submissionOutcome.totalAmount.toLocaleString("ko-KR")}</p>
                  <p className="text-xs text-slate-500">전송 금액</p>
                </div>
              </div>
            </div>

            {/* Queue Handoff Summary */}
            <div className="rounded-lg border border-bd bg-pn px-5 py-4 space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">다음 운영 단계</div>
              {submissionOutcome.sentCount > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-bd/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-sm text-slate-200 font-medium">공급사 회신 대기</p>
                      <p className="text-[10px] text-slate-400">{submissionOutcome.sentCount}건 전송됨 — 구매 검토 큐에서 추적</p>
                    </div>
                  </div>
                  <Link href="/dashboard/purchases">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/10">
                      구매 검토 큐 열기
                    </Button>
                  </Link>
                </div>
              )}
              {submissionOutcome.heldCount > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-bd/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-sm text-slate-200 font-medium">보류 항목</p>
                      <p className="text-[10px] text-slate-400">{submissionOutcome.heldVendors.join(", ")} — {submissionOutcome.heldCount}건 보류</p>
                    </div>
                  </div>
                  <Link href="/test/quote">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] text-amber-400 border-amber-600/30 hover:bg-amber-600/10">
                      요청 조립으로
                    </Button>
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-200 font-medium">추가 요청 계속</p>
                    <p className="text-[10px] text-slate-400">다른 제품 검색 및 견적 요청</p>
                  </div>
                </div>
                <Link href="/test/search">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-400 border-blue-600/30 hover:bg-blue-600/10">
                    소싱 워크벤치
                  </Button>
                </Link>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <Link href="/dashboard/purchases">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6">
                  구매 검토 큐에서 확인
                  <ArrowRight className="h-3.5 w-3.5 ml-2" />
                </Button>
              </Link>
              <Link href="/test/search">
                <Button variant="outline" className="text-slate-300 border-bd">
                  추가 소싱 계속
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Layer 3+4+5+6: Main Content — 3-panel layout ═══ */}
      {!submissionOutcome && <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Unit Board + Focused Edit ── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4">

          {/* ═══ A. Vendor Request Unit Board — 전송 단위 카드 그리드 ═══ */}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2 px-1">전송 단위 ({vendorGroups.length}건)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {vendorGroups.map((g, idx) => {
                const isHeld = holdUnits.has(g.vendorName);
                const isActive = idx === activeGroupIdx;
                const hasMsg = !!vendorNotes[g.vendorId];
                return (
                  <button
                    key={g.vendorName}
                    onClick={() => setActiveGroupIdx(idx)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      isActive
                        ? "border-blue-600/40 bg-blue-600/5 ring-1 ring-blue-600/20"
                        : isHeld
                        ? "border-amber-600/30 bg-amber-600/5 opacity-60"
                        : "border-bd bg-pn hover:bg-el"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-100 truncate">{g.vendorName}</span>
                      </div>
                      {isHeld ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-400 border border-amber-600/20 shrink-0">보류</span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 shrink-0">전송</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{g.itemCount}건</span>
                      <span className="text-slate-600">·</span>
                      <span className="tabular-nums font-medium text-slate-200">₩{g.subtotal.toLocaleString("ko-KR")}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {hasMsg ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-pn border border-bd text-slate-400">메시지 ✓</span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-pn border border-bd text-slate-500">메시지 없음</span>
                      )}
                      {g.items.some(i => !i.hasPrice) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400">가격 미확인</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ B. Preflight Gate ═══ */}
          <div className={`rounded-lg border px-4 py-3 ${
            level === "blocked" ? "border-red-600/20 bg-red-600/5"
            : level === "review_first" ? "border-amber-600/20 bg-amber-600/5"
            : level === "split_required" ? "border-blue-600/20 bg-blue-600/5"
            : "border-emerald-600/20 bg-emerald-600/5"
          }`}>
            <div className="flex items-center justify-between mb-1">
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
                {canSend ? `전송 ${readyCount}건 · 보류 ${holdCount}건` : "전송 불가"}
              </span>
            </div>
            {(blockers.length > 0 || warnings.length > 0) && (
              <div className="space-y-1 mt-2">
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

          {/* ═══ C. Focused Edit Surface — active unit 기준 ═══ */}
          {activeGroup && (
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200">{activeGroup.vendorName} 요청서 편집</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-pn text-slate-400">{activeGroup.itemCount}건 · ₩{activeGroup.subtotal.toLocaleString("ko-KR")}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-6 px-2 text-[10px] ${holdUnits.has(activeGroup.vendorName) ? "text-amber-400" : "text-slate-500 hover:text-amber-400"}`}
                  onClick={() => toggleHold(activeGroup.vendorName)}
                >
                  {holdUnits.has(activeGroup.vendorName) ? "전송으로 복원" : "보류 처리"}
                </Button>
              </div>
              {holdUnits.has(activeGroup.vendorName) && (
                <div className="px-4 py-1.5 bg-amber-600/5 border-b border-amber-600/20">
                  <span className="text-[10px] text-amber-400">이 요청서는 보류 상태입니다. 전송 대상에서 제외됩니다.</span>
                </div>
              )}
              {/* 품목 요약 (dense) */}
              <div className="px-4 py-2 border-b border-bd/50">
                <div className="text-[10px] text-slate-500 mb-1">포함 품목</div>
                <div className="space-y-1">
                  {activeGroup.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate max-w-[200px]">{item.productName}</span>
                      <span className="text-slate-400 tabular-nums shrink-0">×{item.quantity} {item.hasPrice ? `₩${item.lineTotal.toLocaleString("ko-KR")}` : "문의"}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Form — 이 unit의 보완 */}
              <div className="p-4">
                <QuoteRequestPanel
                  ref={requestPanelRef}
                  vendorNotes={vendorNotes}
                  onVendorNoteChange={handleVendorNoteChange}
                  onSubmitSuccess={(result) => {
                    const heldVendors = Array.from(holdUnits);
                    setSubmissionOutcome({
                      sentCount: result.sentCount,
                      heldCount: heldVendors.length,
                      vendorCount: result.vendorCount,
                      totalAmount: result.totalAmount,
                      heldVendors,
                      sentAt: new Date().toLocaleString("ko-KR"),
                    });
                  }}
                />
              </div>
            </div>
          )}
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
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-400">{readyCount}</p>
                <p className="text-[10px] text-slate-500">전송</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-amber-400">{holdCount}</p>
                <p className="text-[10px] text-slate-500">보류</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-100">{summary.totalItems}</p>
                <p className="text-[10px] text-slate-500">품목</p>
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
      </div>}

      {/* ═══ Layer 7: Sticky Action Layer — always visible ═══ */}
      {!submissionOutcome && quoteItems.length > 0 && (
        <div className="shrink-0 border-t-2 border-bd px-4 md:px-6 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            {/* Left: readiness + summary */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />
                {config.label}
              </span>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span className="text-[10px] text-emerald-400">전송 {readyCount}</span>
                {holdCount > 0 && <span className="text-[10px] text-amber-400">보류 {holdCount}</span>}
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 tabular-nums font-medium">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
              </div>
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
                disabled={!canSend || readyCount === 0}
                form="quote-request-form"
                type="submit"
              >
                {readyCount > 0 ? `${readyCount}건 전송` : "견적 요청 보내기"}
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
