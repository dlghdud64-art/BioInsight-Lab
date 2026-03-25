"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Search, Package, FileText, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle,
  X, ArrowLeft, ArrowRight, Truck, Clock, Send, Pause,
} from "lucide-react";
import { getStageInfo, getNextActionLabel, canConvertToPO, type ProcurementStage, type ApprovalPolicy, type ApprovalStatus } from "@/lib/procurement-stage";
import { evaluateGuardrails, hasBlocker, getGuardrailSummary, SEVERITY_CONFIG, type GuardrailResult } from "@/lib/guardrail";

type OrderStatus = "pending" | "quoted" | "ordered" | "shipping" | "delivered";

// ── PO Conversion Item (mock-compatible) ──
interface POCandidate {
  id: string;
  title: string;
  vendor: string;
  items: Array<{ name: string; catalogNumber: string; quantity: number; unitPrice: number; lineTotal: number; leadTime: string }>;
  totalAmount: number;
  expectedDelivery: string;
  selectionReason: string;
  blockers: string[];
  approvalPolicy: ApprovalPolicy;
  approvalStatus: ApprovalStatus;
  stage: ProcurementStage;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; dot: "amber" | "blue" | "slate" | "emerald"; dotPulse?: boolean; className: string; borderClass: string }
> = {
  pending: {
    label: "견적 대기",
    dot: "amber",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    borderClass: "border-[#2a2a2e]",
  },
  quoted: {
    label: "견적 도착",
    dot: "blue",
    dotPulse: true,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    borderClass: "border-blue-100",
  },
  ordered: {
    label: "발주 완료",
    dot: "slate",
    className: "bg-[#222226] text-slate-400 border-[#2a2a2e]",
    borderClass: "border-[#2a2a2e]",
  },
  shipping: {
    label: "배송 중",
    dot: "emerald",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderClass: "border-[#2a2a2e]",
  },
  delivered: {
    label: "배송 완료",
    dot: "emerald",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderClass: "border-[#2a2a2e]",
  },
};

const MOCK_ORDERS: POCandidate[] = [
  {
    id: "poc-001",
    title: "Thermo Fisher FBS 외 2건",
    vendor: "Thermo Fisher Scientific",
    items: [
      { name: "Fetal Bovine Serum", catalogNumber: "10270106", quantity: 2, unitPrice: 450000, lineTotal: 900000, leadTime: "3일" },
      { name: "DMEM Medium 500ml", catalogNumber: "11965092", quantity: 5, unitPrice: 42000, lineTotal: 210000, leadTime: "2일" },
      { name: "Trypsin-EDTA 0.25%", catalogNumber: "25200056", quantity: 3, unitPrice: 38000, lineTotal: 114000, leadTime: "3일" },
    ],
    totalAmount: 1224000,
    expectedDelivery: "2026-03-25",
    selectionReason: "최저 총비용 + 납기 우선 + 기존 거래처",
    blockers: [],
    approvalPolicy: "none",
    approvalStatus: "not_required",
    stage: "po_conversion_candidate",
  },
  {
    id: "poc-002",
    title: "Sigma-Aldrich Acetone 외 1건",
    vendor: "Sigma-Aldrich",
    items: [
      { name: "Acetone HPLC Grade 2.5L", catalogNumber: "34850", quantity: 4, unitPrice: 85000, lineTotal: 340000, leadTime: "5일" },
    ],
    totalAmount: 340000,
    expectedDelivery: "2026-03-28",
    selectionReason: "규격 완전 일치",
    blockers: ["위험물 취급 문서 확인 필요"],
    approvalPolicy: "none",
    approvalStatus: "not_required",
    stage: "po_conversion_candidate",
  },
];

function POConversionContent() {
  const { data: session, status } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState("연구동 B1 시약실");
  const [poNote, setPoNote] = useState("");
  const [resolvedBlockers, setResolvedBlockers] = useState<Set<string>>(new Set());
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());

  // In production: useQuery to fetch po_conversion_candidate items
  const candidates = MOCK_ORDERS;
  const selected = candidates.find((c: POCandidate) => c.id === selectedId) ?? candidates[0];

  // Guard check — guardrail layer 기반
  const unresolvedBlockers = selected ? selected.blockers.filter((b: string) => !resolvedBlockers.has(b)) : [];
  const approvalCleared = selected ? canConvertToPO(selected.approvalPolicy, selected.approvalStatus) : false;
  const activeItems = selected ? selected.items.filter((_: POCandidate["items"][number], idx: number) => !excludedItems.has(`${selected.id}-${idx}`)) : [];
  const activeTotal = activeItems.reduce((sum: number, i: POCandidate["items"][number]) => sum + i.lineTotal, 0);

  // Guardrail evaluation
  const guardrailResults: GuardrailResult[] = useMemo(() => {
    if (!selected) return [];
    return evaluateGuardrails({
      stage: "po_conversion_candidate",
      totalAmount: activeTotal,
      budgetLimit: 5000000, // TODO: org policy에서 가져오기
      vendorApproved: true, // TODO: vendor approval 상태 연결
      approvalPolicy: selected.approvalPolicy,
      approvalStatus: selected.approvalStatus,
      isHazardous: selected.blockers.some((b: string) => b.includes("위험물")),
      hazardousDocsReady: !selected.blockers.some((b: string) => b.includes("위험물")),
    });
  }, [selected, activeTotal]);

  const guardrailBlocked = hasBlocker(guardrailResults);
  const canCreate = unresolvedBlockers.length === 0 && approvalCleared && activeItems.length > 0 && !guardrailBlocked;

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ PO Decision Header ═══ */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span></Link>
            <div className="w-px h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">발주 전환</span>
          </div>
          <div className="flex items-center gap-3">
            {selected && <span className="text-lg font-bold tabular-nums text-slate-100 hidden sm:block">₩{activeTotal.toLocaleString("ko-KR")}</span>}
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${
              canCreate ? "text-emerald-400 bg-emerald-600/10 border-emerald-600/30" : "text-amber-400 bg-amber-600/10 border-amber-600/30"
            }`}>
              {canCreate ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {canCreate ? "생성 가능" : "조건 확인"}
            </span>
            <Link href="/dashboard/quotes"><Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500"><ArrowLeft className="h-3 w-3 mr-1" />워크큐</Button></Link>
          </div>
        </div>
        {/* Candidate selector strip */}
        <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b border-bd overflow-x-auto" style={{ backgroundColor: '#3e4044' }}>
          {candidates.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${
                (selected?.id === c.id) ? "bg-blue-600/10 text-blue-300 border-blue-600/30" : "text-slate-400 border-transparent hover:bg-el"
              }`}>
              <FileText className="h-3.5 w-3.5" />
              <span>{c.vendor}</span>
              <span className="text-[10px] tabular-nums opacity-70">₩{c.totalAmount.toLocaleString("ko-KR")}</span>
              {c.blockers.length > 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-400">{c.blockers.length}</span>}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 shrink-0 ml-1">{candidates.length}건 전환 후보</span>
        </div>
      </div>

      {/* ═══ Main: Center + Evidence Rail ═══ */}
      {selected && <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">

          {/* Block A: Line Item 확정 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd flex items-center justify-between" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-200">발주 대상 품목 ({activeItems.length}/{selected.items.length}건)</span>
              <span className="text-xs tabular-nums text-slate-100 font-semibold">₩{activeTotal.toLocaleString("ko-KR")}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bd/50 text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">품목</th>
                  <th className="text-left px-2 py-2 font-medium">Cat.</th>
                  <th className="text-right px-2 py-2 font-medium">수량</th>
                  <th className="text-right px-2 py-2 font-medium">단가</th>
                  <th className="text-right px-2 py-2 font-medium">소계</th>
                  <th className="text-center px-2 py-2 font-medium">납기</th>
                  <th className="text-center px-2 py-2 font-medium">포함</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => {
                  const key = `${selected.id}-${idx}`;
                  const excluded = excludedItems.has(key);
                  return (
                    <tr key={idx} className={`border-b border-bd/30 last:border-0 ${excluded ? "opacity-40" : ""}`}>
                      <td className="px-4 py-2 text-slate-200 truncate max-w-[200px]">{item.name}</td>
                      <td className="px-2 py-2 text-slate-500 font-mono">{item.catalogNumber}</td>
                      <td className="px-2 py-2 text-slate-200 tabular-nums text-right">×{item.quantity}</td>
                      <td className="px-2 py-2 text-slate-400 tabular-nums text-right">₩{item.unitPrice.toLocaleString("ko-KR")}</td>
                      <td className="px-2 py-2 text-slate-100 tabular-nums text-right font-medium">₩{item.lineTotal.toLocaleString("ko-KR")}</td>
                      <td className="px-2 py-2 text-slate-400 text-center">{item.leadTime}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setExcludedItems(prev => {
                          const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
                        })} className={`text-[10px] px-1.5 py-0.5 rounded ${excluded ? "text-red-400 bg-red-600/10" : "text-emerald-400 bg-emerald-600/10"}`}>
                          {excluded ? "제외" : "포함"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Block B: 발주 조건 확정 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-200">발주 조건</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">배송지</label>
                  <Input value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} className="h-8 text-xs bg-pn border-bd" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">희망 납기</label>
                  <Input value={selected.expectedDelivery} readOnly className="h-8 text-xs bg-pn border-bd text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">공급사 전달 메모</label>
                <Textarea value={poNote} onChange={e => setPoNote(e.target.value)} placeholder="발주 시 공급사에 전달할 메모" className="min-h-[60px] text-xs bg-pn border-bd resize-none" />
              </div>
            </div>
          </div>

          {/* Block C: 정책/문서/예산 가드 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-200">전환 가드</span>
            </div>
            <div className="p-4 space-y-2">
              {/* Approval guard */}
              <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                <div className="flex items-center gap-2 text-xs">
                  {approvalCleared ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  <span className="text-slate-300">승인 상태</span>
                </div>
                <span className={`text-[10px] ${approvalCleared ? "text-emerald-400" : "text-red-400"}`}>
                  {selected.approvalPolicy === "none" ? "승인 불필요" : selected.approvalStatus === "externally_approved" ? "외부 승인 완료" : "승인 대기"}
                </span>
              </div>
              {/* Line items guard */}
              <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                <div className="flex items-center gap-2 text-xs">
                  {activeItems.length > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  <span className="text-slate-300">발주 대상</span>
                </div>
                <span className={`text-[10px] ${activeItems.length > 0 ? "text-emerald-400" : "text-red-400"}`}>{activeItems.length}건 확정</span>
              </div>
              {/* Blocker guards */}
              {selected.blockers.map((b, idx) => {
                const resolved = resolvedBlockers.has(b);
                return (
                  <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded border ${resolved ? "border-emerald-600/20 bg-emerald-600/5" : "border-amber-600/20 bg-amber-600/5"}`}>
                    <div className="flex items-center gap-2 text-xs">
                      {resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      <span className={resolved ? "text-slate-400 line-through" : "text-amber-300"}>{b}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setResolvedBlockers(prev => {
                      const next = new Set(prev); next.has(b) ? next.delete(b) : next.add(b); return next;
                    })}>{resolved ? "되돌리기" : "해결됨"}</Button>
                  </div>
                );
              })}
              {/* Guardrail layer results */}
              {guardrailResults.map((gr, idx) => (
                <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded border ${SEVERITY_CONFIG[gr.severity].bgColor} ${SEVERITY_CONFIG[gr.severity].borderColor}`}>
                  <div className="flex items-center gap-2 text-xs">
                    {gr.severity === "blocked" ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    : gr.severity === "conditional" ? <AlertTriangle className="h-3.5 w-3.5 text-blue-400" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                    <span className={SEVERITY_CONFIG[gr.severity].color}>{gr.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{gr.recommendedAction}</span>
                </div>
              ))}
              {selected.blockers.length === 0 && guardrailResults.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />모든 조건 충족
                </div>
              )}
            </div>
          </div>

          {/* Block D: 최종 전환 요약 */}
          <div className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-emerald-400">{selected.vendor}</strong> 기준 {activeItems.length}개 품목,
              총 <strong className="text-slate-100">₩{activeTotal.toLocaleString("ko-KR")}</strong>,
              납기 {selected.expectedDelivery},
              {canCreate ? " PO 생성 가능 상태" : " 조건 확인 필요"}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">PO 생성 후 Receiving 대기 상태로 이동 · 선택 근거와 문서는 PO 기록에 연결</p>
          </div>
        </div>

        {/* ═══ PO Evidence Rail (400px) ═══ */}
        <div className="hidden lg:flex w-[400px] shrink-0 border-l border-bd flex-col" style={{ backgroundColor: '#353739' }}>
          <div className="px-5 py-4 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">선택 근거</div>
            <p className="text-xs text-slate-300">{selected.selectionReason}</p>
          </div>
          <div className="px-5 py-3 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">발주 요약</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">공급사</span><span className="text-slate-200 font-medium">{selected.vendor}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">품목</span><span className="text-slate-200">{activeItems.length}건</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">총액</span><span className="text-slate-200 tabular-nums font-medium">₩{activeTotal.toLocaleString("ko-KR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">납기</span><span className="text-slate-200">{selected.expectedDelivery}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">승인</span>
                <span className={approvalCleared ? "text-emerald-400" : "text-amber-400"}>
                  {selected.approvalPolicy === "none" ? "불필요" : approvalCleared ? "완료" : "대기"}
                </span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">가드 상태</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {canCreate ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                <span className={canCreate ? "text-emerald-400" : "text-amber-400"}>{canCreate ? "모든 조건 충족" : `${unresolvedBlockers.length}건 미해결`}</span>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          {/* Rail footer CTA */}
          <div className="px-5 py-4 border-t border-bd shrink-0 space-y-2" style={{ backgroundColor: '#434548' }}>
            <Button size="sm" className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40" disabled={!canCreate}>
              <Truck className="h-3 w-3 mr-1.5" />PO 생성
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-slate-400 border-bd">
                <Pause className="h-3 w-3 mr-1" />보류
              </Button>
              <Link href="/dashboard/quotes" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] text-slate-400 border-bd">워크큐</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>}

      {/* ═══ Sticky Action Dock (mobile) ═══ */}
      {selected && (
        <div className="lg:hidden shrink-0 border-t-2 border-bd px-4 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${canCreate ? "text-emerald-400" : "text-amber-400"}`}>
                {canCreate ? "생성 가능" : `${unresolvedBlockers.length}건 확인`}
              </span>
              <span className="text-xs tabular-nums text-slate-100 font-medium">₩{activeTotal.toLocaleString("ko-KR")}</span>
            </div>
            <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40" disabled={!canCreate}>
              PO 생성
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <POConversionContent />
    </Suspense>
  );
}
