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
  ArrowLeft, ArrowRight, FileText, CheckCircle2, AlertTriangle, AlertCircle, Info, ChevronRight, Eye, BookmarkPlus,
} from "lucide-react";

const READINESS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  ready_to_write_request: { color: "text-emerald-400 bg-emerald-600/10 border-emerald-600/30", icon: CheckCircle2, label: "전송 가능" },
  review_first: { color: "text-amber-400 bg-amber-600/10 border-amber-600/30", icon: AlertTriangle, label: "검토 필요" },
  blocked: { color: "text-red-400 bg-red-600/10 border-red-600/30", icon: AlertCircle, label: "전송 불가" },
  split_required: { color: "text-blue-400 bg-blue-600/10 border-blue-600/30", icon: Info, label: "분리 전송" },
};

function QuoteRequestPageContent() {
  const [vendorNotes, setVendorNotes] = useState<Record<string, string>>({});
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [holdUnits, setHoldUnits] = useState<Set<string>>(new Set());
  const [submissionOutcome, setSubmissionOutcome] = useState<{
    sentCount: number; heldCount: number; vendorCount: number; totalAmount: number; heldVendors: string[]; sentAt: string;
  } | null>(null);
  const requestPanelRef = useRef<QuoteRequestPanelRef>(null);

  const { quoteItems, products, compareIds } = useTestFlow();
  const { data: session, status: authStatus } = useSession();
  const navRouter = useNavRouter();
  const { productIds: compareStoreIds } = useCompareStore();

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      navRouter.replace(`/auth/signin?callbackUrl=${encodeURIComponent("/test/quote/request")}`);
    }
  }, [authStatus, navRouter]);

  const allCompareIds = useMemo(() => [...new Set([...compareIds, ...compareStoreIds])], [compareIds, compareStoreIds]);
  const assembly = useMemo(() => calculateAssembly(quoteItems, allCompareIds, products), [quoteItems, allCompareIds, products]);
  const { level, vendorGroups, summary, blockers, warnings } = assembly;
  const config = READINESS_CONFIG[level] || READINESS_CONFIG.blocked;
  const ReadinessIcon = config.icon;
  const canSend = level === "ready_to_write_request" || level === "split_required" || level === "review_first";
  const activeGroup: VendorGroup | undefined = vendorGroups[activeGroupIdx];
  const readyCount = vendorGroups.filter(g => !holdUnits.has(g.vendorName)).length;
  const holdCount = holdUnits.size;
  const toggleHold = (v: string) => setHoldUnits(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const handleVendorNoteChange = (vendorId: string, note: string) => {
    setVendorNotes(prev => ({ ...prev, [vendorId]: note }));
    requestPanelRef.current?.markDirty();
  };
  const handleSubmitSuccess = (result: { sentCount: number; vendorCount: number; totalAmount: number }) => {
    setSubmissionOutcome({
      sentCount: result.sentCount, heldCount: holdCount, vendorCount: result.vendorCount,
      totalAmount: result.totalAmount, heldVendors: Array.from(holdUnits), sentAt: new Date().toLocaleString("ko-KR"),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ Session Header ═══ */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span></Link>
            <div className="w-px h-4 md:h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">견적 요청 확정</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg md:text-xl font-bold tabular-nums text-slate-100 hidden sm:block">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
              <ReadinessIcon className="h-3 w-3" />{config.label}
            </span>
            <Link href="/test/quote" className="text-[10px] md:text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="h-3 w-3 inline mr-0.5" />요청 조립
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ Queue Selector Strip ═══ */}
      {vendorGroups.length > 0 && !submissionOutcome && (
        <div className="shrink-0 px-4 md:px-6 py-2 border-b border-bd overflow-x-auto flex items-center gap-2" style={{ backgroundColor: '#353739' }}>
          {vendorGroups.map((g, idx) => {
            const isHeld = holdUnits.has(g.vendorName);
            const isActive = idx === activeGroupIdx;
            return (
              <button key={g.vendorName} onClick={() => setActiveGroupIdx(idx)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                  isActive ? "bg-blue-600/10 text-blue-300 border-blue-600/30 ring-1 ring-blue-600/20"
                  : isHeld ? "text-slate-500 border-bd opacity-50" : "text-slate-400 border-bd hover:bg-el"
                }`}>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>{g.vendorName}</span>
                <span className="text-[10px] tabular-nums opacity-70">₩{g.subtotal.toLocaleString("ko-KR")}</span>
                {isHeld ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-400">보류</span>
                : isActive ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300">편집 중</span>
                : <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-300">전송</span>}
              </button>
            );
          })}
          <span className="text-[10px] text-slate-500 shrink-0 ml-1">
            {readyCount}건 전송 · {holdCount > 0 ? `${holdCount}건 보류` : "보류 없음"}
          </span>
        </div>
      )}

      {/* ═══ Submission Outcome ═══ */}
      {submissionOutcome && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 space-y-5">
            <div className="text-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-100 mb-1">견적 요청이 전송되었습니다</h2>
              <p className="text-sm text-slate-400">{submissionOutcome.sentAt}</p>
            </div>
            <div className="rounded-lg border border-bd bg-pn px-5 py-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div><p className="text-2xl font-bold tabular-nums text-emerald-400">{submissionOutcome.sentCount}</p><p className="text-xs text-slate-500">전송</p></div>
                <div><p className="text-2xl font-bold tabular-nums text-amber-400">{submissionOutcome.heldCount}</p><p className="text-xs text-slate-500">보류</p></div>
                <div><p className="text-2xl font-bold tabular-nums text-slate-100">{submissionOutcome.vendorCount}</p><p className="text-xs text-slate-500">공급사</p></div>
                <div><p className="text-lg font-bold tabular-nums text-slate-100">₩{submissionOutcome.totalAmount.toLocaleString("ko-KR")}</p><p className="text-xs text-slate-500">금액</p></div>
              </div>
            </div>
            <div className="rounded-lg border border-bd bg-pn px-5 py-4 space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">다음 운영 단계</div>
              {submissionOutcome.sentCount > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-bd/50">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><div><p className="text-sm text-slate-200 font-medium">공급사 회신 대기</p><p className="text-[10px] text-slate-400">{submissionOutcome.sentCount}건 — 구매 검토 큐에서 추적</p></div></div>
                  <Link href="/dashboard/purchases"><Button size="sm" variant="outline" className="h-7 text-[10px] text-emerald-400 border-emerald-600/30">구매 검토 큐</Button></Link>
                </div>
              )}
              {submissionOutcome.heldCount > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-bd/50">
                  <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><div><p className="text-sm text-slate-200 font-medium">보류 항목</p><p className="text-[10px] text-slate-400">{submissionOutcome.heldVendors.join(", ")}</p></div></div>
                  <Link href="/test/quote"><Button size="sm" variant="outline" className="h-7 text-[10px] text-amber-400 border-amber-600/30">요청 조립</Button></Link>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-4">
              <Link href="/dashboard/purchases"><Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6">구매 검토 큐<ArrowRight className="h-3.5 w-3.5 ml-2" /></Button></Link>
              <Link href="/test/search"><Button variant="outline" className="text-slate-300 border-bd">추가 소싱</Button></Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Main: Center Work Window + Send Queue Rail ═══ */}
      {!submissionOutcome && <div className="flex-1 overflow-hidden flex">

        {/* ── Center Work Window ── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4">

          {/* Preflight Gate */}
          {(blockers.length > 0 || warnings.length > 0) && (
            <div className={`rounded-lg border px-4 py-3 ${level === "blocked" ? "border-red-600/20 bg-red-600/5" : "border-amber-600/20 bg-amber-600/5"}`}>
              <div className="flex items-center gap-2 mb-1">
                <ReadinessIcon className={`h-4 w-4 ${level === "blocked" ? "text-red-400" : "text-amber-400"}`} />
                <span className="text-xs font-medium text-slate-200">{level === "blocked" ? "전송 차단" : "전송 전 확인"}</span>
              </div>
              <div className="space-y-1">
                {blockers.map((m, i) => <div key={`b${i}`} className="flex items-center gap-2 text-[10px] text-red-300"><AlertCircle className="h-3 w-3 shrink-0 text-red-400" />{m}</div>)}
                {warnings.map((m, i) => <div key={`w${i}`} className="flex items-center gap-2 text-[10px] text-amber-300"><AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />{m}</div>)}
              </div>
            </div>
          )}

          {/* Request Context Header + Focused Edit */}
          {activeGroup && (
            <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
              {/* Context header */}
              <div className="px-4 py-3 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-100">{activeGroup.vendorName}</span>
                    {holdUnits.has(activeGroup.vendorName)
                      ? <Badge variant="secondary" className="text-[9px] bg-amber-600/15 text-amber-400 border-amber-600/20">보류</Badge>
                      : <Badge variant="secondary" className="text-[9px] bg-emerald-600/15 text-emerald-400 border-emerald-600/20">전송 대상</Badge>
                    }
                  </div>
                  <Button size="sm" variant="ghost" className={`h-7 px-2.5 text-[10px] ${holdUnits.has(activeGroup.vendorName) ? "text-emerald-400" : "text-amber-400"}`}
                    onClick={() => toggleHold(activeGroup.vendorName)}>
                    {holdUnits.has(activeGroup.vendorName) ? "전송으로 복원" : "보류 처리"}
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{activeGroup.itemCount}건</span>
                  <span className="text-slate-600">·</span>
                  <span className="tabular-nums text-slate-200 font-medium">₩{activeGroup.subtotal.toLocaleString("ko-KR")}</span>
                  {vendorGroups.length > 1 && <><span className="text-slate-600">·</span><span>요청서 {activeGroupIdx + 1}/{vendorGroups.length}</span></>}
                </div>
              </div>

              {holdUnits.has(activeGroup.vendorName) && (
                <div className="px-4 py-2 bg-amber-600/5 border-b border-amber-600/20 text-[10px] text-amber-400">이 요청서는 보류 상태입니다. 전송 대상에서 제외됩니다.</div>
              )}

              {/* 품목 compact table */}
              <div className="px-4 py-2 border-b border-bd/50">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">포함 품목</div>
                <table className="w-full text-xs">
                  <tbody>
                    {activeGroup.items.map(item => (
                      <tr key={item.id} className="border-b border-bd/30 last:border-0">
                        <td className="py-1.5 text-slate-200 truncate max-w-[200px]">{item.productName}</td>
                        <td className="py-1.5 text-slate-400 tabular-nums text-right w-12">×{item.quantity}</td>
                        <td className="py-1.5 text-slate-200 tabular-nums text-right w-24 font-medium">
                          {item.hasPrice ? <PriceDisplay price={item.lineTotal} currency="KRW" /> : <span className="text-slate-500">문의</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Form — 공급사 전달 정보 보완 */}
              <div className="p-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-3">공급사 전달 정보</div>
                <QuoteRequestPanel ref={requestPanelRef} vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} onSubmitSuccess={handleSubmitSuccess} />
              </div>
            </div>
          )}
        </div>

        {/* ── Send Queue Rail (400px, sticky) ── */}
        <div className="hidden lg:flex w-[400px] shrink-0 border-l border-bd flex-col" style={{ backgroundColor: '#353739' }}>

          {/* Rail 1: 전송 준비 상태 */}
          <div className="px-5 py-4 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-3">이번 전송</div>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <div className="rounded-lg bg-pn border border-bd p-2.5">
                <p className="text-xl font-bold tabular-nums text-emerald-400">{readyCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">전송</p>
              </div>
              <div className="rounded-lg bg-pn border border-bd p-2.5">
                <p className="text-xl font-bold tabular-nums text-amber-400">{holdCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">보류</p>
              </div>
              <div className="rounded-lg bg-pn border border-bd p-2.5">
                <p className="text-xl font-bold tabular-nums text-slate-100">{summary.totalItems}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">품목</p>
              </div>
            </div>
            {blockers.length > 0 && (
              <div className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />차단 {blockers.length}건</div>
            )}
          </div>

          {/* Rail 2: Split Navigator */}
          <div className="px-5 py-3 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">요청 분리</div>
            <div className="space-y-1">
              {vendorGroups.map((g, idx) => {
                const isActive = idx === activeGroupIdx;
                const isHeld = holdUnits.has(g.vendorName);
                return (
                  <button key={g.vendorName} onClick={() => setActiveGroupIdx(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${
                      isActive ? "bg-blue-600/10 border border-blue-600/30" : "hover:bg-el border border-transparent"
                    }`}>
                    {isActive && <div className="w-0.5 h-6 rounded-full bg-blue-500 shrink-0" />}
                    <div className="flex-1 text-left min-w-0">
                      <span className={`block truncate ${isActive ? "text-blue-300 font-medium" : "text-slate-300"}`}>{g.vendorName}</span>
                      <span className="block text-[10px] text-slate-500">{g.itemCount}건</span>
                    </div>
                    <span className={`tabular-nums text-right ${isActive ? "text-blue-300 font-semibold" : "text-slate-400"}`}>₩{g.subtotal.toLocaleString("ko-KR")}</span>
                    {isHeld && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-400 shrink-0">보류</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rail 3: Active Request Summary */}
          {activeGroup && (
            <div className="px-5 py-3 border-b border-bd flex-1 overflow-y-auto">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">선택 요청 상세</div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-slate-400">공급사</span><span className="text-slate-200 font-medium">{activeGroup.vendorName}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">품목</span><span className="text-slate-200">{activeGroup.itemCount}건</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">금액</span><span className="text-slate-200 tabular-nums font-medium">₩{activeGroup.subtotal.toLocaleString("ko-KR")}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">메시지</span><span className="text-slate-200">{vendorNotes[activeGroup.vendorId] ? "작성됨" : "없음"}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">상태</span>
                  {holdUnits.has(activeGroup.vendorName) ? <span className="text-amber-400">보류</span> : <span className="text-emerald-400">전송 대상</span>}
                </div>
              </div>
              {/* Line items preview */}
              <div className="mt-3 pt-3 border-t border-bd/50">
                <div className="text-[10px] text-slate-500 mb-1.5">품목 미리보기</div>
                {activeGroup.items.slice(0, 3).map(item => (
                  <div key={item.id} className="flex justify-between text-[11px] py-0.5">
                    <span className="text-slate-300 truncate max-w-[180px]">{item.productName}</span>
                    <span className="text-slate-400 tabular-nums shrink-0">{item.hasPrice ? `₩${item.lineTotal.toLocaleString("ko-KR")}` : "문의"}</span>
                  </div>
                ))}
                {activeGroup.items.length > 3 && <p className="text-[10px] text-slate-500 mt-1">+{activeGroup.items.length - 3}건 더</p>}
              </div>
            </div>
          )}

          {/* Rail 4: Sticky Footer — total + CTA */}
          <div className="px-5 py-4 border-t border-bd shrink-0" style={{ backgroundColor: '#434548' }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-xs text-slate-400">전송 예상 합계</span>
              <span className="text-xl font-bold tabular-nums text-slate-100">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
            </div>
            <div className="space-y-2">
              <Button size="sm" className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                disabled={!canSend || readyCount === 0} form="quote-request-form" type="submit">
                {readyCount > 0 ? `${readyCount}건 전송 준비 완료` : "전송 불가"}
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-slate-400 border-bd"><BookmarkPlus className="h-3 w-3 mr-1" />임시 저장</Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-slate-400 border-bd"><Eye className="h-3 w-3 mr-1" />미리보기</Button>
              </div>
            </div>
          </div>
        </div>

      </div>}

      {/* ═══ Sticky Send Dock (mobile/tablet) ═══ */}
      {!submissionOutcome && quoteItems.length > 0 && (
        <div className="lg:hidden shrink-0 border-t-2 border-bd px-4 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />{config.label}
              </span>
              <span className="text-xs text-slate-400 tabular-nums font-medium">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {vendorGroups.length > 1 && activeGroupIdx < vendorGroups.length - 1 && (
                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs text-slate-400 border-bd" onClick={() => setActiveGroupIdx(activeGroupIdx + 1)}>
                  다음<ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
              <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                disabled={!canSend || readyCount === 0} form="quote-request-form" type="submit">
                {readyCount > 0 ? `${readyCount}건 전송` : "전송 불가"}
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
