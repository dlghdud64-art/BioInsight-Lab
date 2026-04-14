"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, ArrowRight,
  AlertTriangle, Sparkles, X, Truck, ListChecks, GitCompareArrows,
  FileCheck2, ShoppingCart, CircleCheck, ChevronRight, FileText, Zap,
} from "lucide-react";
import Link from "next/link";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { useOntologyContextBridge } from "@/hooks/use-ontology-context-bridge";

// ═══════════════════════════════════════════════════════════════════
//  PO Conversion Queue (발주 전환 큐)
// ═══════════════════════════════════════════════════════════════════

// ── 타입 ──
type RecommendationLevel = "primary" | "alternate" | "conservative";
type ConversionStatus = "review_required" | "ready_for_po" | "hold" | "confirmed";
type BlockerType = "price_gap" | "lead_time" | "partial_reply" | "approval_unknown" | "moq_issue" | "none";
type ExternalApprovalStatus = "approved" | "pending" | "unknown";
type NextAction = "review_selection" | "prepare_po" | "wait_reply" | "check_external_approval";
type AiRecStatus = "recommended" | "review_needed" | "hold";

interface AiOption {
  id: string;
  label: string;
  supplierName: string;
  price: number;
  leadDays: number;
  moq?: number;
  rationale: string[];
  recommendationLevel: RecommendationLevel;
}

interface PurchaseExecutionItem {
  id: string;
  requestTitle: string;
  itemSummary: string;
  supplierReplies: number;
  totalSuppliers: number;
  externalApprovalStatus: ExternalApprovalStatus;
  conversionStatus: ConversionStatus;
  blockerType: BlockerType;
  blockerReason: string;
  nextStage: string;
  currentPreferredOption?: string;
  aiRecommendationStatus: AiRecStatus;
  aiOptions: AiOption[];
  selectedOptionId?: string;
  nextAction: NextAction;
  createdDaysAgo: number;
  totalBudget: number;
}

// ── 상태 라벨 맵 ──
const CONVERSION_STATUS_MAP: Record<ConversionStatus, { label: string; bg: string; text: string; border: string }> = {
  review_required:  { label: "선택안 검토 필요", bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  ready_for_po:     { label: "발주 전환 가능",   bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  hold:             { label: "보류",             bg: "bg-slate-50",   text: "text-slate-500",   border: "border-slate-200" },
  confirmed:        { label: "선택안 확정",       bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
};

const EXTERNAL_APPROVAL_MAP: Record<ExternalApprovalStatus, { label: string; className: string }> = {
  approved: { label: "외부 승인 완료", className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  pending:  { label: "외부 승인 대기", className: "text-amber-600 bg-amber-50 border-amber-200" },
  unknown:  { label: "외부 승인 미확인", className: "text-slate-500 bg-slate-50 border-slate-200" },
};

const AI_STATUS_MAP: Record<AiRecStatus, { label: string; className: string }> = {
  recommended:   { label: "AI 추천 완료", className: "text-emerald-600" },
  review_needed: { label: "AI 검토 필요", className: "text-amber-600" },
  hold:          { label: "AI 판단 보류", className: "text-slate-500" },
};

const NEXT_ACTION_MAP: Record<NextAction, { label: string; ctaLabel: string; railCtaLabel: string }> = {
  review_selection:        { label: "선택안 검토",       ctaLabel: "선택안 검토",       railCtaLabel: "선택안 검토 시작" },
  prepare_po:              { label: "발주 전환 준비",    ctaLabel: "발주 전환 준비",    railCtaLabel: "발주 전환 시작" },
  wait_reply:              { label: "추가 회신 대기",    ctaLabel: "추가 확인",         railCtaLabel: "회신 현황 확인" },
  check_external_approval: { label: "외부 승인 확인",    ctaLabel: "승인 상태 확인",    railCtaLabel: "승인 연결 확인" },
};

const BLOCKER_LABEL: Record<BlockerType, string> = {
  price_gap: "가격 차이",
  lead_time: "납기 이슈",
  partial_reply: "일부 미회신",
  approval_unknown: "확인 필요",
  moq_issue: "MOQ 조건",
  none: "",
};

// ── 더미 데이터 8건 ──
const MOCK_DATA: PurchaseExecutionItem[] = [
  {
    id: "pe-001",
    requestTitle: "PCR 튜브 (0.2mL) 회신 완료",
    itemSummary: "PCR Tubes 0.2mL, Flat Cap, 1000ea/pk",
    supplierReplies: 3, totalSuppliers: 3,
    externalApprovalStatus: "approved",
    conversionStatus: "ready_for_po",
    blockerType: "none",
    blockerReason: "차단 없음 — 즉시 발주 가능",
    nextStage: "공급사 발송 준비",
    currentPreferredOption: "opt-a1",
    aiRecommendationStatus: "recommended",
    aiOptions: [
      { id: "opt-a1", label: "추천안 A", supplierName: "BioKorea", price: 185000, leadDays: 3, rationale: ["최저가", "납기 최단", "기존 거래 이력"], recommendationLevel: "primary" },
      { id: "opt-a2", label: "대체안 B", supplierName: "LabSource", price: 198000, leadDays: 5, moq: 5, rationale: ["MOQ 5팩 이상", "단가 7% 높음"], recommendationLevel: "alternate" },
      { id: "opt-a3", label: "보수안 C", supplierName: "SciSupply", price: 210000, leadDays: 2, rationale: ["납기 2일", "단가 13% 높음"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "prepare_po",
    createdDaysAgo: 5,
    totalBudget: 925000,
  },
  {
    id: "pe-002",
    requestTitle: "Premium Fetal Bovine Serum 회신 완료",
    itemSummary: "FBS, Heat Inactivated, 500mL",
    supplierReplies: 3, totalSuppliers: 3,
    externalApprovalStatus: "approved",
    conversionStatus: "review_required",
    blockerType: "price_gap",
    blockerReason: "최저가와 선호 공급사 간 가격/납기 충돌",
    nextStage: "선택안 확정 후 발주 전환",
    currentPreferredOption: undefined,
    aiRecommendationStatus: "review_needed",
    aiOptions: [
      { id: "opt-b1", label: "추천안 A", supplierName: "GibcoKR", price: 580000, leadDays: 14, rationale: ["최저가", "납기 14일"], recommendationLevel: "primary" },
      { id: "opt-b2", label: "대체안 B", supplierName: "Capricorn", price: 620000, leadDays: 7, rationale: ["납기 7일", "기존 선호 공급사"], recommendationLevel: "alternate" },
      { id: "opt-b3", label: "보수안 C", supplierName: "HyClone", price: 690000, leadDays: 5, moq: 2, rationale: ["MOQ 2병", "납기 최단"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "review_selection",
    createdDaysAgo: 8,
    totalBudget: 1160000,
  },
  {
    id: "pe-003",
    requestTitle: "Filtered Pipette Tips (200μL) 회신 일부 도착",
    itemSummary: "Filter Tips 200μL, Sterile, 960ea/pk",
    supplierReplies: 2, totalSuppliers: 4,
    externalApprovalStatus: "unknown",
    conversionStatus: "hold",
    blockerType: "partial_reply",
    blockerReason: "핵심 공급사 2곳 미회신 — 비교 불완전",
    nextStage: "추가 회신 확보 후 선택안 검토",
    currentPreferredOption: undefined,
    aiRecommendationStatus: "hold",
    aiOptions: [
      { id: "opt-c1", label: "잠정안 A", supplierName: "Eppendorf", price: 320000, leadDays: 7, rationale: ["2곳 회신 기준 최저가"], recommendationLevel: "primary" },
      { id: "opt-c2", label: "잠정안 B", supplierName: "Rainin", price: 345000, leadDays: 5, rationale: ["납기 빠름"], recommendationLevel: "alternate" },
      { id: "opt-c3", label: "보류", supplierName: "—", price: 0, leadDays: 0, rationale: ["핵심 공급사 미회신"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "wait_reply",
    createdDaysAgo: 3,
    totalBudget: 640000,
  },
  {
    id: "pe-004",
    requestTitle: "DMEM/F-12 배지 선택안 확정",
    itemSummary: "DMEM/F-12, GlutaMAX, 500mL × 10",
    supplierReplies: 2, totalSuppliers: 2,
    externalApprovalStatus: "approved",
    conversionStatus: "confirmed",
    blockerType: "none",
    blockerReason: "차단 없음 — 선택안 확정 완료",
    nextStage: "PO 생성 → 공급사 발송",
    currentPreferredOption: "opt-d1",
    aiRecommendationStatus: "recommended",
    aiOptions: [
      { id: "opt-d1", label: "확정안", supplierName: "Thermo Fisher", price: 420000, leadDays: 5, rationale: ["기존 거래처", "LOT 관리 안정"], recommendationLevel: "primary" },
      { id: "opt-d2", label: "대체안", supplierName: "Corning", price: 395000, leadDays: 10, rationale: ["단가 6% 낮음", "납기 2배"], recommendationLevel: "alternate" },
      { id: "opt-d3", label: "보수안", supplierName: "Welgene", price: 380000, leadDays: 3, rationale: ["국내 공급", "납기 최단"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: "opt-d1",
    nextAction: "prepare_po",
    createdDaysAgo: 12,
    totalBudget: 420000,
  },
  {
    id: "pe-005",
    requestTitle: "96-Well Microplate (Black, Flat Bottom)",
    itemSummary: "96-Well Black Plate, Flat Bottom, 50ea/cs",
    supplierReplies: 3, totalSuppliers: 3,
    externalApprovalStatus: "pending",
    conversionStatus: "review_required",
    blockerType: "approval_unknown",
    blockerReason: "외부 승인 결과 미도착 — 승인 확인 후 진행 가능",
    nextStage: "외부 승인 확인 → 발주 전환",
    currentPreferredOption: "opt-e1",
    aiRecommendationStatus: "recommended",
    aiOptions: [
      { id: "opt-e1", label: "추천안 A", supplierName: "Greiner Bio", price: 285000, leadDays: 7, rationale: ["최저가", "표준 사양"], recommendationLevel: "primary" },
      { id: "opt-e2", label: "대체안 B", supplierName: "Corning", price: 310000, leadDays: 4, rationale: ["납기 빠름"], recommendationLevel: "alternate" },
      { id: "opt-e3", label: "보수안 C", supplierName: "SPL Life Sciences", price: 195000, leadDays: 3, rationale: ["국내 최저가"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "check_external_approval",
    createdDaysAgo: 6,
    totalBudget: 570000,
  },
  {
    id: "pe-006",
    requestTitle: "Trypsin-EDTA (0.25%) 대체품 추천",
    itemSummary: "Trypsin-EDTA 0.25%, 100mL × 6",
    supplierReplies: 3, totalSuppliers: 3,
    externalApprovalStatus: "approved",
    conversionStatus: "review_required",
    blockerType: "none",
    blockerReason: "대체품 40% 절감안 검토 필요",
    nextStage: "대체품 확정 또는 기존 유지 결정",
    currentPreferredOption: undefined,
    aiRecommendationStatus: "review_needed",
    aiOptions: [
      { id: "opt-f1", label: "대체 추천안", supplierName: "Welgene", price: 145000, leadDays: 2, rationale: ["기존 대비 40% 절감", "국내 생산"], recommendationLevel: "primary" },
      { id: "opt-f2", label: "기존 유지안", supplierName: "Gibco", price: 245000, leadDays: 7, rationale: ["기존 사용 이력"], recommendationLevel: "alternate" },
      { id: "opt-f3", label: "보수안", supplierName: "Sigma", price: 210000, leadDays: 5, rationale: ["중간 가격대"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "review_selection",
    createdDaysAgo: 4,
    totalBudget: 490000,
  },
  {
    id: "pe-007",
    requestTitle: "Cryovial (2mL) 기존 선택안 유지 최적",
    itemSummary: "Cryogenic Vials 2mL, Internal Thread, 500ea",
    supplierReplies: 2, totalSuppliers: 2,
    externalApprovalStatus: "approved",
    conversionStatus: "ready_for_po",
    blockerType: "none",
    blockerReason: "차단 없음 — 기존 거래처 유지, 가격 변동 없음",
    nextStage: "PO 생성 → 공급사 발송",
    currentPreferredOption: "opt-g1",
    aiRecommendationStatus: "recommended",
    aiOptions: [
      { id: "opt-g1", label: "기존 유지안 (최적)", supplierName: "Corning", price: 165000, leadDays: 5, rationale: ["기존 거래처", "가격 변동 없음"], recommendationLevel: "primary" },
      { id: "opt-g2", label: "대체안", supplierName: "Nunc", price: 158000, leadDays: 10, rationale: ["단가 4% 낮음", "납기 2배"], recommendationLevel: "alternate" },
      { id: "opt-g3", label: "긴급안", supplierName: "SPL Life Sciences", price: 178000, leadDays: 2, rationale: ["납기 2일"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: "opt-g1",
    nextAction: "prepare_po",
    createdDaysAgo: 7,
    totalBudget: 330000,
  },
  {
    id: "pe-008",
    requestTitle: "Western Blot Transfer Membrane",
    itemSummary: "PVDF Membrane, 0.45μm, 26.5cm × 3.75m Roll",
    supplierReplies: 3, totalSuppliers: 4,
    externalApprovalStatus: "unknown",
    conversionStatus: "review_required",
    blockerType: "lead_time",
    blockerReason: "추천안 납기 21일 — 긴급안과 정품 중 결정 필요",
    nextStage: "납기/가격 트레이드오프 결정 후 선택안 확정",
    currentPreferredOption: undefined,
    aiRecommendationStatus: "review_needed",
    aiOptions: [
      { id: "opt-h1", label: "추천안 A", supplierName: "Millipore", price: 520000, leadDays: 21, rationale: ["정품", "납기 21일"], recommendationLevel: "primary" },
      { id: "opt-h2", label: "대체안 B", supplierName: "Bio-Rad", price: 485000, leadDays: 10, rationale: ["납기 10일", "동등품"], recommendationLevel: "alternate" },
      { id: "opt-h3", label: "긴급안 C", supplierName: "국내 대리점", price: 580000, leadDays: 3, rationale: ["국내 재고", "단가 12% 높음"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "review_selection",
    createdDaysAgo: 2,
    totalBudget: 520000,
  },
];

// ── 큐 탭 ──
type QueueTab = "all" | "review" | "ready" | "check" | "hold";

function getQueueTab(item: PurchaseExecutionItem): QueueTab {
  if (item.conversionStatus === "hold") return "hold";
  if (item.conversionStatus === "ready_for_po" || item.conversionStatus === "confirmed") return "ready";
  if (item.nextAction === "check_external_approval") return "check";
  return "review";
}

// ═══════════════════════════════════════════════════════════════════

export default function PurchasesPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeWorkWindow, setActiveWorkWindow] = useState<string | null>(null);
  const [workWindowPhase, setWorkWindowPhase] = useState<number>(0);

  // ── Ontology Context Layer bridge ──
  useOntologyContextBridge({
    currentStage: "approval_pending",
    activeWorkWindow: activeWorkWindow ?? null,
    counts: { pendingApprovals: MOCK_DATA.filter(i => getQueueTab(i) === "review").length },
  });

  // ── 필터링 ──
  const filteredItems = useMemo(() => {
    let items = MOCK_DATA;
    if (queueTab !== "all") items = items.filter(i => getQueueTab(i) === queueTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.requestTitle.toLowerCase().includes(q) || i.itemSummary.toLowerCase().includes(q));
    }
    return items;
  }, [queueTab, searchQuery]);

  // ── 큐 통계 ──
  const queueCounts = useMemo(() => {
    const counts = { all: MOCK_DATA.length, review: 0, ready: 0, check: 0, hold: 0 };
    for (const item of MOCK_DATA) counts[getQueueTab(item)]++;
    return counts;
  }, []);

  const selectedItem = selectedId ? MOCK_DATA.find(i => i.id === selectedId) ?? null : null;
  const closeRail = useCallback(() => setSelectedId(null), []);

  // ── KPI ──
  const kpis = useMemo(() => {
    let reviewNeeded = 0, readyForPo = 0, checkNeeded = 0, holdCount = 0;
    for (const item of MOCK_DATA) {
      if (item.conversionStatus === "review_required") reviewNeeded++;
      if (item.conversionStatus === "ready_for_po" || item.conversionStatus === "confirmed") readyForPo++;
      if (item.nextAction === "check_external_approval") checkNeeded++;
      if (item.conversionStatus === "hold") holdCount++;
    }
    return { reviewNeeded, readyForPo, checkNeeded, holdCount };
  }, []);

  const formatPrice = (n: number) => n > 0 ? `₩${n.toLocaleString("ko-KR")}` : "—";

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pt-4 md:pt-4">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ═══ 브레드크럼 ═══ */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-700 transition-colors">구매 및 예산</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-900 font-medium">구매 운영</span>
        </div>

        {/* ═══ 페이지 헤더 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">발주 전환 큐</h1>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-600 bg-blue-50">Beta</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">회신 완료된 건의 선택안을 확정하고 발주로 넘깁니다.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/dashboard/quotes">
              <Button variant="outline" size="sm" className="h-10 px-4 text-sm gap-2 border-slate-200 font-medium">
                <FileText className="h-4 w-4" /> 견적 큐
              </Button>
            </Link>
            <Button size="sm" className="h-10 px-5 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
              <Zap className="h-4 w-4" /> 일괄 발주 전환
            </Button>
          </div>
        </div>

        {/* ═══ KPI 카드 4개 ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50"
            label="선택안 확정 필요"
            value={kpis.reviewNeeded}
            valueColor={kpis.reviewNeeded > 0 ? "text-blue-600" : "text-slate-900"}
            sub="선택안 확정 필요"
            active={queueTab === "review"}
            onClick={() => setQueueTab(queueTab === "review" ? "all" : "review")}
          />
          <KpiCard
            icon={<CircleCheck className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50"
            label="발주 전환 가능"
            value={kpis.readyForPo}
            valueColor={kpis.readyForPo > 0 ? "text-emerald-600" : "text-slate-900"}
            sub="발주 전환 가능"
            active={queueTab === "ready"}
            onClick={() => setQueueTab(queueTab === "ready" ? "all" : "ready")}
          />
          <KpiCard
            icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
            iconBg="bg-amber-50"
            label="추가 검토 필요"
            value={kpis.checkNeeded}
            valueColor={kpis.checkNeeded > 0 ? "text-amber-600" : "text-slate-900"}
            sub="추가 검토 필요"
            active={queueTab === "check"}
            onClick={() => setQueueTab(queueTab === "check" ? "all" : "check")}
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-slate-400" />}
            iconBg="bg-slate-100"
            label="보류"
            value={kpis.holdCount}
            valueColor="text-slate-900"
            sub="보류"
            active={queueTab === "hold"}
            onClick={() => setQueueTab(queueTab === "hold" ? "all" : "hold")}
          />
        </div>

        {/* ═══ 큐 탭 + 검색 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "all" as QueueTab, label: "전체" },
              { key: "review" as QueueTab, label: "선택안" },
              { key: "ready" as QueueTab, label: "발주" },
              { key: "check" as QueueTab, label: "추가" },
              { key: "hold" as QueueTab, label: "보류" },
            ]).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setQueueTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  queueTab === tab.key
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60 border border-transparent"
                }`}>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  queueTab === tab.key ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400"
                }`}>{queueCounts[tab.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="품목명 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm bg-white border-slate-200" />
          </div>
        </div>

        {/* ═══ Queue + Rail ═══ */}
        <div className="flex gap-5">

          {/* ── 큐 리스트 ── */}
          <div className={`flex-1 min-w-0 space-y-2 transition-all ${selectedItem ? "md:max-w-[calc(100%-400px)]" : ""}`}>
            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 mb-1">해당하는 항목이 없습니다</p>
                <p className="text-xs text-slate-400">회신 완료 건부터 선택안 검토와 발주 전환을 시작할 수 있습니다.</p>
              </div>
            )}

            {filteredItems.map((item) => {
              const cs = CONVERSION_STATUS_MAP[item.conversionStatus];
              const ai = AI_STATUS_MAP[item.aiRecommendationStatus];
              const ext = EXTERNAL_APPROVAL_MAP[item.externalApprovalStatus];
              const na = NEXT_ACTION_MAP[item.nextAction];
              const isSelected = selectedId === item.id;
              const bestOption = item.aiOptions.find(o => o.recommendationLevel === "primary");
              const isReady = item.conversionStatus === "ready_for_po" || item.conversionStatus === "confirmed";

              return (
                <div key={item.id}
                  className={`rounded-xl border bg-white transition-all cursor-pointer hover:shadow-md ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedId(item.id)}>

                  <div className="p-4">
                    {/* 상단: 배지 + 시간 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cs.bg} ${cs.text} ${cs.border}`}>
                        {cs.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${ext.className}`}>
                        {ext.label}
                      </span>
                      {item.blockerType !== "none" && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                          {BLOCKER_LABEL[item.blockerType]}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
                        <Clock className="h-3 w-3" />{item.createdDaysAgo}일 전
                      </span>
                    </div>

                    {/* 본문: 제목 + AI/회신 정보 + CTA */}
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-0.5">{item.requestTitle}</h3>
                        <p className="text-xs text-slate-500 mb-3">{item.itemSummary}</p>

                        {/* 막힘/다음 단계 2열 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">막힘 확인</p>
                            <p className={`text-[11px] leading-snug flex items-start gap-1.5 ${item.blockerType !== "none" ? "text-amber-600" : "text-slate-500"}`}>
                              {item.blockerType !== "none"
                                ? <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                : <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5 text-emerald-500" />
                              }
                              {item.blockerReason}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">다음 단계</p>
                            <p className="text-[11px] text-blue-600 leading-snug flex items-start gap-1.5">
                              <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              {item.nextStage}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 우측: AI 정보 + 가격 + CTA */}
                      <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <span className={`text-[11px] flex items-center gap-1 justify-end mb-0.5 ${ai.className}`}>
                            <Sparkles className="h-3 w-3" />{ai.label}
                          </span>
                          <span className="text-[11px] flex items-center gap-1 justify-end text-slate-500">
                            <FileText className="h-3 w-3" />회신 {item.supplierReplies}/{item.totalSuppliers}
                          </span>
                        </div>
                        <p className="text-xl font-extrabold text-slate-900">{formatPrice(item.totalBudget)}</p>
                        {bestOption && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Truck className="h-3 w-3" />{bestOption.supplierName}
                          </span>
                        )}
                        <Button size="sm"
                          variant={isReady ? "default" : "outline"}
                          className={`w-full h-9 text-xs font-semibold mt-1 ${isReady ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" : "border-slate-200 text-slate-700"}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}>
                          {na.ctaLabel} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        <span className="text-[10px] text-slate-400">다음: {na.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Rail 패널 ── */}
          {selectedItem && (() => {
            const cs = CONVERSION_STATUS_MAP[selectedItem.conversionStatus];
            const ai = AI_STATUS_MAP[selectedItem.aiRecommendationStatus];
            const ext = EXTERNAL_APPROVAL_MAP[selectedItem.externalApprovalStatus];
            const na = NEXT_ACTION_MAP[selectedItem.nextAction];
            const bestOption = selectedItem.aiOptions.find(o => o.recommendationLevel === "primary");
            const prices = selectedItem.aiOptions.filter(o => o.price > 0).map(o => o.price);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            const maxPrice = prices.length ? Math.max(...prices) : 0;
            const spread = minPrice > 0 && prices.length >= 2 ? Math.round(((maxPrice - minPrice) / minPrice) * 100) : 0;

            return (
              <div className="hidden md:flex flex-col w-[380px] flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[calc(100vh-160px)] shadow-sm">

                {/* Rail header */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ext.className}`}>{ext.label}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedItem.requestTitle}</h3>
                    <p className="text-[11px] text-slate-500 truncate">{selectedItem.itemSummary}</p>
                  </div>
                  <button onClick={closeRail} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 shrink-0 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Rail body */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

                  {/* AI 선택안 */}
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">AI 선택안</span>
                      <span className={`text-[10px] ml-auto ${ai.className}`}>{ai.label}</span>
                    </div>
                    <div className="space-y-2">
                      {selectedItem.aiOptions.map((opt) => {
                        const isConfirmed = selectedItem.selectedOptionId === opt.id;
                        const isPrimary = opt.recommendationLevel === "primary";
                        return (
                          <div key={opt.id} className={`rounded-lg border p-3 ${
                            isConfirmed ? "border-blue-200 bg-blue-50"
                            : isPrimary ? "border-emerald-200 bg-emerald-50/50"
                            : "border-slate-100 bg-slate-50/50"
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isPrimary ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {opt.recommendationLevel === "primary" ? "추천" : opt.recommendationLevel === "alternate" ? "대체" : "보수"}
                                </span>
                                <span className="text-xs font-medium text-slate-700">{opt.supplierName}</span>
                                {isConfirmed && <CheckCircle2 className="h-3 w-3 text-blue-600" />}
                              </div>
                              <span className="text-xs font-bold text-slate-900">{formatPrice(opt.price)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                              <span>납기 {opt.leadDays}일</span>
                              {opt.moq && <span>MOQ {opt.moq}</span>}
                            </div>
                            {opt.rationale.length > 0 && (
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">{opt.rationale.join(" · ")}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 가격/납기 요약 */}
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">가격 · 납기 비교</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">가격 범위</span><span className="text-slate-900 font-medium">{formatPrice(minPrice)} ~ {formatPrice(maxPrice)}</span></div>
                      {spread > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500">가격 차이</span><span className={spread > 20 ? "text-amber-600 font-medium" : "text-slate-600"}>{spread}%</span></div>}
                      <div className="flex justify-between text-xs"><span className="text-slate-500">회신 현황</span><span className={selectedItem.supplierReplies === selectedItem.totalSuppliers ? "text-emerald-600 font-medium" : "text-amber-600"}>{selectedItem.supplierReplies}/{selectedItem.totalSuppliers} 완료</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">예산</span><span className="text-slate-900 font-medium">{formatPrice(selectedItem.totalBudget)}</span></div>
                      {bestOption && <div className="flex justify-between text-xs"><span className="text-slate-500">추천 공급사</span><span className="text-emerald-600 font-medium">{bestOption.supplierName}</span></div>}
                    </div>
                  </div>

                  {/* 발주 Readiness */}
                  <div className="px-5 py-4">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">발주 Readiness</div>
                    <div className={`rounded-lg px-3 py-2.5 mb-2.5 ${
                      selectedItem.blockerType === "none" ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${selectedItem.blockerType === "none" ? "text-emerald-500" : "text-amber-500"}`}>
                        {selectedItem.blockerType === "none" ? "차단 없음" : "현재 막힘"}
                      </p>
                      <p className={`text-[11px] leading-snug ${selectedItem.blockerType === "none" ? "text-emerald-600" : "text-amber-600"}`}>
                        {selectedItem.blockerReason}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2.5 mb-3 bg-blue-50 border border-blue-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-blue-500">다음 단계</p>
                      <p className="text-[11px] text-blue-600 leading-snug">{selectedItem.nextStage}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">발주 가능</span><span className={selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "text-emerald-600 font-medium" : "text-amber-600"}>{selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "가능" : "조건 해소 필요"}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">외부 승인</span><span className={selectedItem.externalApprovalStatus === "approved" ? "text-emerald-600 font-medium" : selectedItem.externalApprovalStatus === "pending" ? "text-amber-600" : "text-slate-500"}>{ext.label}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">선택안</span><span className={selectedItem.selectedOptionId ? "text-purple-600 font-medium" : "text-slate-500"}>{selectedItem.selectedOptionId ? "확정됨" : "미확정"}</span></div>
                    </div>
                  </div>
                </div>

                {/* Rail CTA */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  <Button size="sm"
                    className={`w-full h-9 text-xs font-semibold ${
                      selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed"
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        : "border-slate-200 text-slate-700"
                    }`}
                    variant={selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "default" : "outline"}
                    onClick={() => { setWorkWindowPhase(0); setActiveWorkWindow(selectedItem.nextAction); }}>
                    {na.railCtaLabel}<ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                  <div className="flex gap-2">
                    <Link href={`/quotes/${selectedItem.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-8 text-[11px] text-slate-500 border-slate-200">전체 상세</Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="flex-1 h-8 text-[11px] text-slate-500" onClick={closeRail}>닫기</Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ═══ Work Window ═══ */}
        {activeWorkWindow && selectedItem && (() => {
          const na = NEXT_ACTION_MAP[selectedItem.nextAction];
          const cs = CONVERSION_STATUS_MAP[selectedItem.conversionStatus];
          const bestOption = selectedItem.aiOptions.find(o => o.recommendationLevel === "primary");

          const HANDOFF_PHASES = [
            { key: "select",   label: "선택안 확정",   icon: <Sparkles className="h-3 w-3" /> },
            { key: "po_prep",  label: "PO 생성 준비",  icon: <FileCheck2 className="h-3 w-3" /> },
            { key: "dispatch", label: "공급사 발송",    icon: <Truck className="h-3 w-3" /> },
            { key: "handoff",  label: "다음 Handoff",  icon: <ArrowRight className="h-3 w-3" /> },
          ];

          const initialPhase = selectedItem.selectedOptionId
            ? (selectedItem.conversionStatus === "confirmed" || selectedItem.conversionStatus === "ready_for_po" ? 1 : 0)
            : 0;
          const phase = Math.max(workWindowPhase, initialPhase);
          const isLastPhase = phase >= HANDOFF_PHASES.length - 1;
          const primaryLabel = isLastPhase ? "완료 — 발주 큐로 이동" : `다음: ${HANDOFF_PHASES[Math.min(phase + 1, HANDOFF_PHASES.length - 1)].label}`;

          return (
            <CenterWorkWindow
              open={true}
              onClose={() => { setActiveWorkWindow(null); setWorkWindowPhase(0); }}
              title={HANDOFF_PHASES[phase].label}
              subtitle={`${selectedItem.requestTitle} · ${cs.label}`}
              phase="ready"
              primaryAction={{
                label: primaryLabel,
                onClick: () => {
                  if (isLastPhase) { setActiveWorkWindow(null); setWorkWindowPhase(0); }
                  else setWorkWindowPhase(phase + 1);
                },
              }}
              secondaryAction={phase > initialPhase
                ? { label: "이전 단계", onClick: () => setWorkWindowPhase(phase - 1) }
                : { label: "닫기", onClick: () => { setActiveWorkWindow(null); setWorkWindowPhase(0); } }
              }
            >
              <div className="space-y-4">
                {/* Phase indicator */}
                <div className="flex items-center gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {HANDOFF_PHASES.map((ph, i) => (
                    <div key={ph.key} className="flex items-center flex-shrink-0">
                      <button type="button" onClick={() => { if (i >= initialPhase) setWorkWindowPhase(i); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          i === phase ? "bg-blue-50 text-blue-600 border border-blue-200"
                          : i < phase ? "text-emerald-600 border border-emerald-200 bg-emerald-50"
                          : "text-slate-400 border border-transparent"
                        }`}>
                        {i < phase ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : ph.icon}
                        <span className="hidden sm:inline">{ph.label}</span>
                      </button>
                      {i < HANDOFF_PHASES.length - 1 && <ChevronRight className="h-3 w-3 mx-0.5 text-slate-300" />}
                    </div>
                  ))}
                </div>

                {/* Context */}
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                    {selectedItem.blockerType !== "none" && (
                      <span className="text-[10px] px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600">{selectedItem.blockerReason}</span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedItem.requestTitle}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{selectedItem.itemSummary} · 예산 {formatPrice(selectedItem.totalBudget)}</p>
                </div>

                {/* Phase 0: 선택안 확정 */}
                {phase === 0 && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">AI 선택안 — 하나를 확정하세요</span>
                      </div>
                      <div className="space-y-2">
                        {selectedItem.aiOptions.map((opt) => {
                          const isPrimary = opt.recommendationLevel === "primary";
                          const isConfirmed = selectedItem.selectedOptionId === opt.id;
                          return (
                            <div key={opt.id} className={`rounded-lg border p-3 cursor-pointer transition-colors hover:shadow-sm ${
                              isConfirmed ? "border-blue-200 bg-blue-50"
                              : isPrimary ? "border-emerald-200 bg-emerald-50/50"
                              : "border-slate-100"
                            }`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPrimary ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{opt.label}</span>
                                  <span className="text-sm font-medium text-slate-700">{opt.supplierName}</span>
                                  {isConfirmed && <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">확정</Badge>}
                                </div>
                                <span className="text-sm font-bold text-slate-900">{formatPrice(opt.price)}</span>
                              </div>
                              <div className="flex gap-3 text-xs text-slate-500 mb-1">
                                <span>납기 {opt.leadDays}일</span>
                                {opt.moq && <span>MOQ {opt.moq}</span>}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {opt.rationale.map((r, ri) => (
                                  <span key={ri} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">{r}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 1: PO 생성 준비 */}
                {phase === 1 && (
                  <div className="space-y-3">
                    {bestOption && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-600">확정 선택안</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{bestOption.supplierName}</span>
                          <span className="text-sm font-bold text-slate-900">{formatPrice(bestOption.price)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">납기 {bestOption.leadDays}일 · {bestOption.rationale.join(" · ")}</p>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">PO 생성 체크리스트</span>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { label: "선택안 확정 완료", done: !!selectedItem.selectedOptionId, detail: selectedItem.selectedOptionId ? "확정됨" : "미확정" },
                          { label: "외부 승인 상태 확인", done: selectedItem.externalApprovalStatus === "approved", detail: selectedItem.externalApprovalStatus === "approved" ? "승인 완료" : "대기 중" },
                          { label: "가격·납기 조건 확인", done: selectedItem.blockerType === "none", detail: selectedItem.blockerType === "none" ? "조건 충족" : selectedItem.blockerReason },
                          { label: "배송지 정보 확인", done: false, detail: "입력 필요" },
                          { label: "PO 번호 생성 준비", done: false, detail: "자동 생성 예정" },
                        ].map((c) => (
                          <div key={c.label} className="flex items-center gap-2.5">
                            {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> : <div className="h-4 w-4 rounded-full border-2 border-slate-200 flex-shrink-0" />}
                            <span className={`text-xs flex-1 ${c.done ? "text-slate-700" : "text-slate-500"}`}>{c.label}</span>
                            <span className={`text-[10px] flex-shrink-0 ${c.done ? "text-emerald-600" : "text-slate-400"}`}>{c.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 2: 공급사 발송 */}
                {phase === 2 && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Truck className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">공급사 발송 정보</span>
                      </div>
                      <div className="space-y-2">
                        {bestOption && <div className="flex justify-between text-xs"><span className="text-slate-500">발주 대상</span><span className="text-slate-900 font-medium">{bestOption.supplierName}</span></div>}
                        <div className="flex justify-between text-xs"><span className="text-slate-500">품목</span><span className="text-slate-700">{selectedItem.itemSummary}</span></div>
                        {bestOption && <>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">단가</span><span className="text-slate-900 font-medium">{formatPrice(bestOption.price)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">예상 납기</span><span className="text-slate-700">{bestOption.leadDays}일</span></div>
                        </>}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <span className="text-xs font-bold text-slate-700 mb-2.5 block">발송 준비 체크</span>
                      <div className="space-y-2.5">
                        {[
                          { label: "PO 문서 생성", done: false },
                          { label: "공급사 연락처 확인", done: true },
                          { label: "발송 메일/팩스 준비", done: false },
                          { label: "내부 기록 저장", done: false },
                        ].map((c) => (
                          <div key={c.label} className="flex items-center gap-2.5 text-xs">
                            {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <div className="h-4 w-4 rounded-full border-2 border-slate-200" />}
                            <span className={c.done ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 3: Handoff */}
                {phase === 3 && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-blue-600">발주 완료 후 다음 흐름</span>
                      </div>
                      <div className="space-y-3">
                        {[
                          { n: "1", title: "발주 큐로 자동 이관", sub: "PO 발송 후 입고 추적 큐로 넘어갑니다", active: true },
                          { n: "2", title: "입고 확인 대기", sub: "공급사 배송 → 입고 확인 → 재고 반영", active: false },
                          { n: "3", title: "운영 기록 완료", sub: "소싱 → 비교 → 발주 → 입고 이력 자동 기록", active: false },
                        ].map((s) => (
                          <div key={s.n} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${s.active ? "bg-blue-100 border border-blue-200" : "bg-white border border-slate-200"}`}>
                              <span className={`text-[10px] font-bold ${s.active ? "text-blue-600" : "text-slate-400"}`}>{s.n}</span>
                            </div>
                            <div>
                              <p className={`text-xs font-medium ${s.active ? "text-slate-800" : "text-slate-600"}`}>{s.title}</p>
                              <p className="text-[11px] text-slate-500">{s.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CenterWorkWindow>
          );
        })()}

      </div>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ icon, iconBg, label, value, valueColor, sub, active, onClick }: {
  icon: React.ReactNode; iconBg: string; label: string; value: number; valueColor: string; sub: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border bg-white p-5 text-left transition-all hover:shadow-md ${
        active ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-extrabold ${valueColor}`}>{value}<span className="text-base font-normal text-slate-400 ml-0.5">건</span></p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </button>
  );
}
