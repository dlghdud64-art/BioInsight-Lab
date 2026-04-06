"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, ArrowRight,
  AlertTriangle, Sparkles, X, Truck, ListChecks, GitCompareArrows,
  FileCheck2, ShoppingCart, CircleCheck, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";

// ═══════════════════════════════════════════════════════════════════
//  PO Conversion Queue (발주 전환 큐)
//  역할: 회신 완료 이후, 어떤 건을 발주로 넘길지 정리하는 전환 큐
//  범위: 구매 운영 전체가 아님 — 선택안 확정 / 발주 전환 직전 상태만
//  LabAxis 내부에서 승인을 처리하지 않음 (내부 그룹웨어가 승인 책임)
//  approval은 외부 상태 참고 badge로만 표시
// ═══════════════════════════════════════════════════════════════════

// ── 더미 타입 ──
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
  blockerReason: string;          // 현재 왜 막혀 있는지 1줄
  nextStage: string;              // 이 건의 다음 단계
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
  review_required:  { label: "선택안 검토 필요", bg: "bg-blue-600/10",    text: "text-blue-400",    border: "border-blue-600/30" },
  ready_for_po:     { label: "발주 전환 가능",   bg: "bg-emerald-600/10", text: "text-emerald-400", border: "border-emerald-600/30" },
  hold:             { label: "보류",             bg: "bg-amber-600/10",   text: "text-amber-400",   border: "border-amber-600/30" },
  confirmed:        { label: "선택안 확정",       bg: "bg-purple-600/10",  text: "text-purple-400",  border: "border-purple-600/30" },
};

const EXTERNAL_APPROVAL_MAP: Record<ExternalApprovalStatus, { label: string; className: string }> = {
  approved: { label: "외부 승인 완료", className: "text-emerald-400 bg-emerald-600/10 border-emerald-600/20" },
  pending:  { label: "외부 승인 대기", className: "text-amber-400 bg-amber-600/10 border-amber-600/20" },
  unknown:  { label: "외부 승인 미확인", className: "text-slate-400 bg-slate-600/10 border-slate-600/20" },
};

const AI_STATUS_MAP: Record<AiRecStatus, { label: string; icon: string; className: string }> = {
  recommended:   { label: "AI 추천 완료", icon: "✓", className: "text-emerald-400" },
  review_needed: { label: "AI 검토 필요", icon: "△", className: "text-amber-400" },
  hold:          { label: "AI 판단 보류", icon: "—", className: "text-slate-500" },
};

const NEXT_ACTION_MAP: Record<NextAction, { label: string; ctaLabel: string; railCtaLabel: string }> = {
  review_selection:        { label: "선택안 검토",       ctaLabel: "선택안 검토",       railCtaLabel: "선택안 검토 시작" },
  prepare_po:              { label: "발주 전환 준비",    ctaLabel: "발주 전환 준비",    railCtaLabel: "발주 전환 시작" },
  wait_reply:              { label: "추가 회신 대기",    ctaLabel: "추가 확인",         railCtaLabel: "회신 현황 확인" },
  check_external_approval: { label: "외부 승인 확인",    ctaLabel: "승인 상태 확인",    railCtaLabel: "승인 연결 확인" },
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
      { id: "opt-a1", label: "추천안 A", supplierName: "BioKorea", price: 185000, leadDays: 3, rationale: ["최저가", "납기 최단", "기존 거래 이력 있음"], recommendationLevel: "primary" },
      { id: "opt-a2", label: "대체안 B", supplierName: "LabSource", price: 198000, leadDays: 5, moq: 5, rationale: ["MOQ 5팩 이상", "단가 7% 높음"], recommendationLevel: "alternate" },
      { id: "opt-a3", label: "보수안 C", supplierName: "SciSupply", price: 210000, leadDays: 2, rationale: ["납기 2일", "단가 13% 높음", "긴급 시 유리"], recommendationLevel: "conservative" },
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
      { id: "opt-b1", label: "추천안 A", supplierName: "GibcoKR", price: 580000, leadDays: 14, rationale: ["최저가", "납기 14일 — 다소 길음"], recommendationLevel: "primary" },
      { id: "opt-b2", label: "대체안 B", supplierName: "Capricorn", price: 620000, leadDays: 7, rationale: ["납기 7일", "기존 선호 공급사", "단가 7% 높음"], recommendationLevel: "alternate" },
      { id: "opt-b3", label: "보수안 C", supplierName: "HyClone", price: 690000, leadDays: 5, moq: 2, rationale: ["MOQ 2병", "납기 최단", "단가 19% 높음"], recommendationLevel: "conservative" },
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
      { id: "opt-c1", label: "잠정안 A", supplierName: "Eppendorf", price: 320000, leadDays: 7, rationale: ["2곳 회신 기준 최저가", "추가 회신 시 변경 가능"], recommendationLevel: "primary" },
      { id: "opt-c2", label: "잠정안 B", supplierName: "Rainin", price: 345000, leadDays: 5, rationale: ["납기 빠름", "추가 회신 대기 중"], recommendationLevel: "alternate" },
      { id: "opt-c3", label: "보류", supplierName: "—", price: 0, leadDays: 0, rationale: ["핵심 공급사 미회신", "비교 불완전"], recommendationLevel: "conservative" },
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
      { id: "opt-d3", label: "보수안", supplierName: "Welgene", price: 380000, leadDays: 3, rationale: ["국내 공급", "납기 최단", "LOT 이력 짧음"], recommendationLevel: "conservative" },
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
      { id: "opt-e2", label: "대체안 B", supplierName: "Corning", price: 310000, leadDays: 4, rationale: ["납기 빠름", "코팅 품질 우수"], recommendationLevel: "alternate" },
      { id: "opt-e3", label: "보수안 C", supplierName: "SPL Life Sciences", price: 195000, leadDays: 3, rationale: ["국내 최저가", "기존 사용 이력 없음"], recommendationLevel: "conservative" },
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
      { id: "opt-f1", label: "대체 추천안", supplierName: "Welgene", price: 145000, leadDays: 2, rationale: ["기존 대비 40% 절감", "국내 생산", "동등 스펙 검증 완료"], recommendationLevel: "primary" },
      { id: "opt-f2", label: "기존 유지안", supplierName: "Gibco", price: 245000, leadDays: 7, rationale: ["기존 사용 이력", "안정성 검증 완료"], recommendationLevel: "alternate" },
      { id: "opt-f3", label: "보수안", supplierName: "Sigma", price: 210000, leadDays: 5, rationale: ["중간 가격대", "납기 적정"], recommendationLevel: "conservative" },
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
      { id: "opt-g1", label: "기존 유지안 (최적)", supplierName: "Corning", price: 165000, leadDays: 5, rationale: ["기존 거래처", "가격 변동 없음", "납기 안정"], recommendationLevel: "primary" },
      { id: "opt-g2", label: "대체안", supplierName: "Nunc", price: 158000, leadDays: 10, rationale: ["단가 4% 낮음", "납기 2배", "전환 불필요"], recommendationLevel: "alternate" },
      { id: "opt-g3", label: "긴급안", supplierName: "SPL Life Sciences", price: 178000, leadDays: 2, rationale: ["납기 2일", "단가 8% 높음"], recommendationLevel: "conservative" },
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
      { id: "opt-h1", label: "추천안 A", supplierName: "Millipore", price: 520000, leadDays: 21, rationale: ["정품", "납기 21일 — 길음"], recommendationLevel: "primary" },
      { id: "opt-h2", label: "대체안 B", supplierName: "Bio-Rad", price: 485000, leadDays: 10, rationale: ["납기 10일", "0.45μm 동등품"], recommendationLevel: "alternate" },
      { id: "opt-h3", label: "긴급안 C", supplierName: "국내 대리점", price: 580000, leadDays: 3, rationale: ["국내 재고", "단가 12% 높음", "긴급 시 유리"], recommendationLevel: "conservative" },
    ],
    selectedOptionId: undefined,
    nextAction: "review_selection",
    createdDaysAgo: 2,
    totalBudget: 520000,
  },
];

// ── 큐 탭 정의 ──
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
  const [workWindowPhase, setWorkWindowPhase] = useState<number>(0); // 0-based phase index

  // ── 필터링 ──
  const filteredItems = useMemo(() => {
    let items = MOCK_DATA;
    if (queueTab !== "all") {
      items = items.filter(i => getQueueTab(i) === queueTab);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.requestTitle.toLowerCase().includes(q) || i.itemSummary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [queueTab, searchQuery]);

  // ── 큐 통계 ──
  const queueCounts = useMemo(() => {
    const counts = { all: MOCK_DATA.length, review: 0, ready: 0, check: 0, hold: 0 };
    for (const item of MOCK_DATA) {
      const tab = getQueueTab(item);
      counts[tab]++;
    }
    return counts;
  }, []);

  // ── 선택된 항목 ──
  const selectedItem = selectedId ? MOCK_DATA.find(i => i.id === selectedId) ?? null : null;

  const closeRail = useCallback(() => setSelectedId(null), []);

  // ── KPI 계산 ──
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
    <div className="p-4 md:p-8 pt-6 md:pt-6 max-w-7xl mx-auto w-full">

      {/* ══ 1. 페이지 헤더 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            발주 전환 큐
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            회신 완료 건의 선택안을 확정하고 발주로 넘깁니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/quotes">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <ShoppingCart className="h-3.5 w-3.5" />
              견적 큐
            </Button>
          </Link>
        </div>
      </div>

      {/* ══ 2. 운영 현황 KPI ══ */}
      <div className="rounded-lg border border-bd bg-pn p-4 mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
          전환 큐 현황
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button type="button" onClick={() => setQueueTab("review")}
            className={`flex items-start gap-3 rounded-md border p-3 text-left hover:bg-el transition-colors ${
              kpis.reviewNeeded > 0 ? "border-blue-900/50 bg-blue-950/20" : "border-bd bg-el/50"
            }`}>
            <ListChecks className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">선택안 확정 필요</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.reviewNeeded > 0 ? "text-blue-400" : "text-slate-900"}`}>{kpis.reviewNeeded}건</p>
            </div>
          </button>

          <button type="button" onClick={() => setQueueTab("ready")}
            className={`flex items-start gap-3 rounded-md border p-3 text-left hover:bg-el transition-colors ${
              kpis.readyForPo > 0 ? "border-emerald-900/50 bg-emerald-950/20" : "border-bd bg-el/50"
            }`}>
            <CircleCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">발주 전환 가능</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.readyForPo > 0 ? "text-emerald-400" : "text-slate-900"}`}>{kpis.readyForPo}건</p>
            </div>
          </button>

          <button type="button" onClick={() => setQueueTab("check")}
            className={`flex items-start gap-3 rounded-md border p-3 text-left hover:bg-el transition-colors ${
              kpis.checkNeeded > 0 ? "border-amber-900/50 bg-amber-950/20" : "border-bd bg-el/50"
            }`}>
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">추가 검토 필요</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.checkNeeded > 0 ? "text-amber-400" : "text-slate-900"}`}>{kpis.checkNeeded}건</p>
            </div>
          </button>

          <button type="button" onClick={() => setQueueTab("hold")}
            className="flex items-start gap-3 rounded-md border border-bd bg-el/50 p-3 text-left hover:bg-el transition-colors">
            <Clock className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">보류</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{kpis.holdCount}건</p>
            </div>
          </button>
        </div>
      </div>

      {/* ══ 3. 큐 탭 + 검색 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {([
            { key: "all" as QueueTab, label: "전체" },
            { key: "review" as QueueTab, label: "선택안 검토" },
            { key: "ready" as QueueTab, label: "발주 가능" },
            { key: "check" as QueueTab, label: "추가 확인" },
            { key: "hold" as QueueTab, label: "보류" },
          ]).map((tab) => (
            <button key={tab.key} type="button" onClick={() => setQueueTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                queueTab === tab.key
                  ? "bg-el text-slate-900 border border-bs"
                  : "text-slate-500 hover:text-slate-600 hover:bg-el/50 border border-transparent"
              }`}>
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                queueTab === tab.key ? "bg-slate-700 text-slate-600" : "bg-el/50 text-slate-500"
              }`}>{queueCounts[tab.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0 sm:max-w-[280px] sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="품목명 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs border-bd" />
        </div>
      </div>

      {/* ══ 4. Queue + Rail 레이아웃 ══ */}
      <div className="flex gap-4">

        {/* ── 좌측: Queue 리스트 ── */}
        <div className={`flex-1 min-w-0 space-y-2 transition-all ${selectedItem ? "md:max-w-[calc(100%-380px)]" : ""}`}>
          {filteredItems.length === 0 && (
            <div className="rounded-xl border border-bd bg-pn p-8 text-center">
              <Package className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">회신 완료 건부터 선택안 검토와 발주 전환 준비를 시작할 수 있습니다.</p>
            </div>
          )}

          {filteredItems.map((item) => {
            const cs = CONVERSION_STATUS_MAP[item.conversionStatus];
            const ai = AI_STATUS_MAP[item.aiRecommendationStatus];
            const ext = EXTERNAL_APPROVAL_MAP[item.externalApprovalStatus];
            const na = NEXT_ACTION_MAP[item.nextAction];
            const isSelected = selectedId === item.id;
            const bestOption = item.aiOptions.find(o => o.recommendationLevel === "primary");

            return (
              <div key={item.id}
                className={`bg-pn rounded-xl border transition-colors p-4 cursor-pointer ${
                  isSelected ? "border-blue-600/40 ring-1 ring-blue-600/20 bg-blue-600/5"
                  : "border-bd/80 hover:border-bd"
                }`}
                onClick={() => setSelectedId(item.id)}>

                {/* 상태 신호 */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>
                    {cs.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${ext.className}`}>
                    {ext.label}
                  </span>
                  {item.blockerType !== "none" && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400 border border-amber-600/20">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {item.blockerType === "price_gap" ? "가격 차이" : item.blockerType === "lead_time" ? "납기 이슈" : item.blockerType === "partial_reply" ? "일부 회신" : item.blockerType === "moq_issue" ? "MOQ 조건" : "확인 필요"}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 ml-auto">{item.createdDaysAgo}일 전</span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate mb-1">{item.requestTitle}</h3>
                    <p className="text-xs text-slate-400 mb-1 truncate">{item.itemSummary}</p>

                    {/* 현재 막힘 + 다음 단계 — 운영 판단성 */}
                    <div className="flex flex-col gap-0.5 mb-2">
                      <p className="text-[11px] text-slate-500 leading-snug">
                        <span className={item.blockerType !== "none" ? "text-amber-400/80" : "text-slate-500"}>막힘:</span>{" "}
                        <span className={item.blockerType !== "none" ? "text-amber-400/70" : "text-slate-500"}>{item.blockerReason}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        <span className="text-blue-400/70">다음:</span>{" "}
                        <span className="text-slate-400">{item.nextStage}</span>
                      </p>
                    </div>

                    {/* 메타 — 핵심 수치만 */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                      <span className={`text-[11px] flex items-center gap-1 ${ai.className}`}>
                        <Sparkles className="h-3 w-3 shrink-0" />{ai.label}
                      </span>
                      <span className={`text-[11px] flex items-center gap-1 ${item.supplierReplies === item.totalSuppliers ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Truck className="h-3 w-3" />회신 {item.supplierReplies}/{item.totalSuppliers}
                      </span>
                      <span className="text-[11px] text-slate-700 font-medium">{formatPrice(item.totalBudget)}</span>
                      {bestOption && <span className="text-[10px] text-slate-500">추천: {bestOption.supplierName}</span>}
                      {item.selectedOptionId && (
                        <span className="text-[11px] text-purple-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />확정
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row CTA */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[100px]" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm"
                      variant={item.conversionStatus === "ready_for_po" || item.conversionStatus === "confirmed" ? "default" : "outline"}
                      className={`h-7 text-xs w-full ${item.conversionStatus === "ready_for_po" || item.conversionStatus === "confirmed" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}>
                      {na.ctaLabel}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                    <span className="text-[9px] text-slate-500 text-center">다음: {na.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 우측: Rail 패널 ── */}
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
            <div className="hidden md:flex flex-col w-[370px] flex-shrink-0 rounded-xl border border-bd bg-pn overflow-hidden max-h-[calc(100vh-160px)]">

              {/* Rail header */}
              <div className="px-4 py-3 border-b border-bd bg-el/30 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ext.className}`}>{ext.label}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{selectedItem.requestTitle}</h3>
                  <p className="text-[11px] text-slate-500 truncate">{selectedItem.itemSummary}</p>
                </div>
                <button onClick={closeRail} className="p-1 hover:bg-el rounded text-slate-500 hover:text-slate-600 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rail scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* A. AI 선택안 3개 */}
                <div className="px-4 py-3 border-b border-bd/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3 w-3 text-blue-400" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">AI 선택안</span>
                    <span className={`text-[10px] ml-auto ${ai.className}`}>{ai.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedItem.aiOptions.map((opt) => {
                      const isSelected = selectedItem.selectedOptionId === opt.id;
                      const isPrimary = opt.recommendationLevel === "primary";
                      return (
                        <div key={opt.id} className={`rounded-lg border p-2.5 ${
                          isSelected ? "border-blue-600/40 bg-blue-600/5"
                          : isPrimary ? "border-emerald-600/30 bg-emerald-600/5"
                          : "border-bd/50 bg-el/30"
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                                isPrimary ? "bg-emerald-600/20 text-emerald-400" : "bg-el text-slate-400"
                              }`}>
                                {opt.recommendationLevel === "primary" ? "추천" : opt.recommendationLevel === "alternate" ? "대체" : "보수"}
                              </span>
                              <span className="text-xs font-medium text-slate-700">{opt.supplierName}</span>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-blue-400" />}
                            </div>
                            <span className="text-xs font-semibold text-slate-900">{formatPrice(opt.price)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span>납기 {opt.leadDays}일</span>
                            {opt.moq && <span>MOQ {opt.moq}</span>}
                          </div>
                          {opt.rationale.length > 0 && (
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">{opt.rationale.join(" · ")}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* B. 가격·납기 요약 */}
                <div className="px-4 py-3 border-b border-bd/50">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">가격 · 납기 비교</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-400">가격 범위</span><span className="text-slate-700 font-medium">{formatPrice(minPrice)} ~ {formatPrice(maxPrice)}</span></div>
                    {spread > 0 && <div className="flex justify-between text-xs"><span className="text-slate-400">가격 차이</span><span className={spread > 20 ? "text-amber-400 font-medium" : "text-slate-600"}>{spread}%</span></div>}
                    <div className="flex justify-between text-xs"><span className="text-slate-400">회신 현황</span><span className={selectedItem.supplierReplies === selectedItem.totalSuppliers ? "text-emerald-400 font-medium" : "text-amber-400"}>{selectedItem.supplierReplies}/{selectedItem.totalSuppliers} 완료</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">예산</span><span className="text-slate-700">{formatPrice(selectedItem.totalBudget)}</span></div>
                    {bestOption && <div className="flex justify-between text-xs"><span className="text-slate-400">추천 공급사</span><span className="text-emerald-400 font-medium">{bestOption.supplierName}</span></div>}
                  </div>
                </div>

                {/* C. 발주 Readiness — blocker/next stage 중심 */}
                <div className="px-4 py-3 border-b border-bd/50">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">발주 Readiness</div>

                  {/* Blocker box */}
                  <div className={`rounded-md px-3 py-2 mb-2 ${
                    selectedItem.blockerType === "none"
                      ? "bg-emerald-600/5 border border-emerald-600/20"
                      : "bg-amber-600/5 border border-amber-600/20"
                  }`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: selectedItem.blockerType === "none" ? "#34D399" : "#FBBF24" }}>
                      {selectedItem.blockerType === "none" ? "차단 없음" : "현재 막힘"}
                    </p>
                    <p className={`text-[11px] leading-snug ${selectedItem.blockerType === "none" ? "text-emerald-400/80" : "text-amber-400/80"}`}>
                      {selectedItem.blockerReason}
                    </p>
                  </div>

                  {/* Next stage box */}
                  <div className="rounded-md px-3 py-2 mb-3 bg-blue-600/5 border border-blue-600/20">
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5 text-blue-400">다음 단계</p>
                    <p className="text-[11px] text-blue-400/80 leading-snug">{selectedItem.nextStage}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-400">발주 가능</span><span className={selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "text-emerald-400" : "text-amber-400"}>{selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "가능" : "조건 해소 필요"}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">외부 승인</span><span className={selectedItem.externalApprovalStatus === "approved" ? "text-emerald-400" : selectedItem.externalApprovalStatus === "pending" ? "text-amber-400" : "text-slate-500"}>{ext.label}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">선택안</span><span className={selectedItem.selectedOptionId ? "text-purple-400" : "text-slate-500"}>{selectedItem.selectedOptionId ? "확정됨" : "미확정"}</span></div>
                  </div>
                </div>

              </div>{/* end scrollable body */}

              {/* Rail bottom CTA */}
              <div className="px-4 py-3 border-t border-bd bg-el/30 space-y-1.5">
                <Button size="sm"
                  className={`w-full h-8 text-xs font-medium ${
                    selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed"
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "border-bd text-slate-600"
                  }`}
                  variant={selectedItem.conversionStatus === "ready_for_po" || selectedItem.conversionStatus === "confirmed" ? "default" : "outline"}
                  onClick={() => { setWorkWindowPhase(0); setActiveWorkWindow(selectedItem.nextAction); }}>
                  {na.railCtaLabel}<ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
                <div className="flex gap-1.5">
                  <Link href={`/quotes/${selectedItem.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full h-7 text-[11px] text-slate-400 border-bd">전체 상세 열기</Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="flex-1 h-7 text-[11px] text-slate-500" onClick={closeRail}>닫기</Button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>{/* end flex container */}

      {/* ═══ Center Work Window — 선택안 확정 → 발주 생성 → 공급사 발송 → 다음 handoff ═══ */}
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

        // 현재 item 상태에 따른 시작 phase
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
                if (isLastPhase) {
                  console.log("[Purchases] handoff_complete", { id: selectedItem.id });
                  setActiveWorkWindow(null);
                  setWorkWindowPhase(0);
                } else {
                  setWorkWindowPhase(phase + 1);
                }
              },
            }}
            secondaryAction={phase > initialPhase
              ? { label: "이전 단계", onClick: () => setWorkWindowPhase(phase - 1) }
              : { label: "닫기", onClick: () => { setActiveWorkWindow(null); setWorkWindowPhase(0); } }
            }
          >
            <div className="space-y-4">

              {/* ── Phase indicator strip ── */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
                {HANDOFF_PHASES.map((ph, i) => (
                  <div key={ph.key} className="flex items-center flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { if (i >= initialPhase) setWorkWindowPhase(i); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                        i === phase
                          ? "bg-blue-600/15 text-blue-400 border border-blue-600/30"
                          : i < phase
                          ? "text-emerald-400/70 border border-emerald-600/20 bg-emerald-600/5"
                          : "text-slate-500 border border-transparent"
                      }`}
                    >
                      {i < phase ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : ph.icon}
                      <span className="hidden sm:inline">{ph.label}</span>
                      <span className="sm:hidden">{i + 1}</span>
                    </button>
                    {i < HANDOFF_PHASES.length - 1 && (
                      <ChevronRight className="h-3 w-3 mx-0.5 text-slate-600 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {/* ── Context header (always visible) ── */}
              <div className="rounded-lg border border-bd bg-pn p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                  {selectedItem.blockerType !== "none" && (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-amber-600/20 bg-amber-600/5 text-amber-400">
                      {selectedItem.blockerReason}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{selectedItem.requestTitle}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedItem.itemSummary} · 예산 {formatPrice(selectedItem.totalBudget)}</p>
              </div>

              {/* ════ Phase 0: 선택안 확정 ════ */}
              {phase === 0 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-700">AI 선택안 3개 — 하나를 확정하세요</span>
                    </div>
                    <div className="space-y-2">
                      {selectedItem.aiOptions.map((opt) => {
                        const isPrimary = opt.recommendationLevel === "primary";
                        const isConfirmed = selectedItem.selectedOptionId === opt.id;
                        return (
                          <div key={opt.id} className={`rounded-lg border p-3 cursor-pointer transition-colors hover:bg-el/50 ${
                            isConfirmed ? "border-blue-600/40 bg-blue-600/5"
                            : isPrimary ? "border-emerald-600/30 bg-emerald-600/5"
                            : "border-bd/50"
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isPrimary ? "bg-emerald-600/20 text-emerald-400" : "bg-el text-slate-400"
                                }`}>{opt.label}</span>
                                <span className="text-sm font-medium text-slate-700">{opt.supplierName}</span>
                                {isConfirmed && <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-600/30">확정</Badge>}
                              </div>
                              <span className="text-sm font-bold text-slate-900">{formatPrice(opt.price)}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-slate-400 mb-1">
                              <span>납기 {opt.leadDays}일</span>
                              {opt.moq && <span>MOQ {opt.moq}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {opt.rationale.map((r, ri) => (
                                <span key={ri} className="text-[10px] px-1.5 py-0.5 rounded bg-el text-slate-500 border border-bd/30">{r}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {bestOption && (
                    <p className="text-[11px] text-slate-500 px-1">
                      AI 추천: <span className="text-emerald-400 font-medium">{bestOption.supplierName}</span> ({formatPrice(bestOption.price)}, 납기 {bestOption.leadDays}일)
                    </p>
                  )}
                </div>
              )}

              {/* ════ Phase 1: PO 생성 준비 ════ */}
              {phase === 1 && (
                <div className="space-y-3">
                  {/* 확정된 선택안 요약 */}
                  {bestOption && (
                    <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-400">확정 선택안</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{bestOption.supplierName}</span>
                        <span className="text-sm font-bold text-slate-900">{formatPrice(bestOption.price)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">납기 {bestOption.leadDays}일 · {bestOption.rationale.join(" · ")}</p>
                    </div>
                  )}

                  {/* PO 체크리스트 */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <FileCheck2 className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-700">PO 생성 체크리스트</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "선택안 확정 완료", done: !!selectedItem.selectedOptionId, detail: selectedItem.selectedOptionId ? "확정됨" : "미확정" },
                        { label: "외부 승인 상태 확인", done: selectedItem.externalApprovalStatus === "approved", detail: selectedItem.externalApprovalStatus === "approved" ? "승인 완료" : selectedItem.externalApprovalStatus === "pending" ? "대기 중" : "미확인" },
                        { label: "가격·납기 조건 확인", done: selectedItem.blockerType === "none", detail: selectedItem.blockerType === "none" ? "조건 충족" : selectedItem.blockerReason },
                        { label: "배송지 정보 확인", done: false, detail: "입력 필요" },
                        { label: "PO 번호 생성 준비", done: false, detail: "자동 생성 예정" },
                      ].map((check) => (
                        <div key={check.label} className="flex items-center gap-2.5">
                          {check.done
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                            : <div className="h-3.5 w-3.5 rounded-full border border-bd flex-shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs ${check.done ? "text-slate-600" : "text-slate-500"}`}>{check.label}</span>
                          </div>
                          <span className={`text-[10px] flex-shrink-0 ${check.done ? "text-emerald-400/70" : "text-slate-500"}`}>{check.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Blocker 경고 (해당 시) */}
                  {selectedItem.blockerType !== "none" && (
                    <div className="rounded-lg border border-amber-600/20 bg-amber-600/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-400">차단 사항</span>
                      </div>
                      <p className="text-[11px] text-amber-400/80">{selectedItem.blockerReason}</p>
                      <p className="text-[10px] text-slate-500 mt-1">해소 후 다음 단계로 진행하세요.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ════ Phase 2: 공급사 발송 준비 ════ */}
              {phase === 2 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Truck className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-700">공급사 발송 정보</span>
                    </div>
                    <div className="space-y-2">
                      {bestOption && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">발주 대상</span>
                          <span className="text-slate-700 font-medium">{bestOption.supplierName}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">품목</span>
                        <span className="text-slate-700">{selectedItem.itemSummary}</span>
                      </div>
                      {bestOption && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">단가</span>
                            <span className="text-slate-700 font-medium">{formatPrice(bestOption.price)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">예상 납기</span>
                            <span className="text-slate-700">{bestOption.leadDays}일</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">예산</span>
                        <span className="text-slate-700">{formatPrice(selectedItem.totalBudget)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 발송 준비 상태 */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <span className="text-xs font-semibold text-slate-700 mb-2 block">발송 준비 체크</span>
                    <div className="space-y-2">
                      {[
                        { label: "PO 문서 생성", done: false },
                        { label: "공급사 연락처 확인", done: true },
                        { label: "발송 메일/팩스 준비", done: false },
                        { label: "내부 기록 저장", done: false },
                      ].map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-xs">
                          {check.done
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            : <div className="h-3.5 w-3.5 rounded-full border border-bd" />
                          }
                          <span className={check.done ? "text-slate-600" : "text-slate-500"}>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ════ Phase 3: 다음 Handoff ════ */}
              {phase === 3 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400">발주 완료 후 다음 흐름</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-600/15 border border-blue-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-blue-400">1</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">발주 큐로 자동 이관</p>
                          <p className="text-[11px] text-slate-500">PO 발송 후 입고 추적 큐로 넘어갑니다</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-slate-600/15 border border-slate-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400">2</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600">입고 확인 대기</p>
                          <p className="text-[11px] text-slate-500">공급사 배송 → 입고 확인 → 재고 반영</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-slate-600/15 border border-slate-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400">3</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600">운영 기록 완료</p>
                          <p className="text-[11px] text-slate-500">소싱 → 비교 → 발주 → 입고 이력이 자동 기록됩니다</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 현재 건 요약 */}
                  <div className="rounded-lg border border-bd bg-pn p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">이 건의 다음 단계</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-400">{selectedItem.nextStage}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </CenterWorkWindow>
        );
      })()}

    </div>
  );
}
