"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  ChevronRight,
  GitCompare,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  CompareQueueItem,
  CompareStatus,
  MatchCandidate,
  SourceType,
} from "@/lib/review-queue/types";

// ── 상태 badge ──
const STATUS_CONFIG: Record<CompareStatus, { label: string; dot: string; text: string }> = {
  pending_comparison: { label: "비교 대기", dot: "bg-blue-400", text: "text-blue-400" },
  selection_needed: { label: "선택 필요", dot: "bg-amber-400", text: "text-amber-400" },
  selection_confirmed: { label: "선택 확정", dot: "bg-emerald-400", text: "text-emerald-400" },
  removed: { label: "제외됨", dot: "bg-slate-500", text: "text-slate-500" },
};

const SOURCE_BADGE: Record<SourceType, { label: string; cls: string }> = {
  search: { label: "검색", cls: "bg-blue-500/10 text-blue-400" },
  excel: { label: "엑셀", cls: "bg-emerald-500/10 text-emerald-400" },
  protocol: { label: "프로토콜", cls: "bg-violet-500/10 text-violet-400" },
};

type FilterTab = "all" | CompareStatus;

interface CompareQueuePanelProps {
  items: CompareQueueItem[];
  onSelectProduct: (compareItemId: string, productId: string) => void;
  onConfirmSelection: (compareItemId: string) => void;
  onRemove: (compareItemId: string) => void;
  onSendToQuote: (items: CompareQueueItem[]) => void;
  quoteReadyCount: number;
}

export function CompareQueuePanel({
  items,
  onSelectProduct,
  onConfirmSelection,
  onRemove,
  onSendToQuote,
  quoteReadyCount,
}: CompareQueuePanelProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return items.filter((i) => i.status !== "removed");
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const stats = useMemo(() => ({
    total: items.filter((i) => i.status !== "removed").length,
    selectionNeeded: items.filter((i) => i.status === "selection_needed").length,
    confirmed: items.filter((i) => i.status === "selection_confirmed").length,
    pending: items.filter((i) => i.status === "pending_comparison").length,
  }), [items]);

  const selectedItem = useMemo(
    () => items.find((i) => i.compareItemId === selectedId) ?? null,
    [items, selectedId]
  );

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "selection_needed", label: "선택 필요" },
    { key: "selection_confirmed", label: "선택 확정" },
    { key: "pending_comparison", label: "비교 대기" },
    { key: "removed", label: "제외" },
  ];

  // ── Empty ──
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 bg-el border border-bd border-dashed rounded-xl text-center">
        <GitCompare className="h-8 w-8 text-slate-500 mb-3" />
        <p className="text-sm font-medium text-slate-300 mb-1">
          아직 비교 큐에 담긴 항목이 없습니다
        </p>
        <p className="text-xs text-slate-500">
          Step 1 검토 큐에서 후보 비교가 필요한 항목을 보내주세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── 상단 헤더 ── */}
      <div className="flex flex-col gap-3 pb-4 border-b border-bd">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100">제품 비교</h3>
            <Badge variant="secondary" className="bg-el text-slate-300 text-[10px]">
              {stats.total}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>선택 필요 <strong className="text-amber-400">{stats.selectionNeeded}</strong></span>
            <span>·</span>
            <span>확정 <strong className="text-emerald-400">{stats.confirmed}</strong></span>
            <span>·</span>
            <span>견적 가능 <strong className="text-blue-400">{quoteReadyCount}</strong></span>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-el text-slate-100"
                  : "text-slate-500 hover:text-slate-300 hover:bg-st"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 본문 2컬럼 ── */}
      <div className="flex-1 grid md:grid-cols-[1fr_400px] gap-4 pt-4 min-h-0">
        {/* 좌측: 리스트 */}
        <div className="overflow-y-auto space-y-1.5 pr-1">
          {filtered.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            const src = SOURCE_BADGE[item.sourceType];
            const isActive = selectedId === item.compareItemId;

            return (
              <button
                key={item.compareItemId}
                onClick={() => setSelectedId(item.compareItemId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isActive
                    ? "bg-el border-blue-500/40"
                    : "bg-pn border-bd hover:bg-el"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {/* 상태 */}
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
                  </span>
                  {/* source */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${src.cls}`}>{src.label}</span>
                  {/* 후보 수 */}
                  <span className="text-[10px] text-slate-500 ml-auto">
                    후보 {item.candidateProducts.length}개
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-200 truncate">{item.parsedItemName}</p>
                <p className="text-xs text-slate-500 truncate">{item.normalizedNeed}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400">
                    {item.selectedProductId
                      ? item.candidateProducts.find((c) => c.productId === item.selectedProductId)?.productName ?? "선택됨"
                      : "아직 선택되지 않음"}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {[item.spec, item.quantity && item.unit ? `${item.quantity} ${item.unit}` : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 우측: 상세 비교 패널 */}
        <div className="bg-pn border border-bd rounded-xl p-4 overflow-y-auto">
          {selectedItem ? (
            <div className="space-y-4">
              {/* 헤더 */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedItem.status].dot}`} />
                  <span className={`text-[10px] font-medium ${STATUS_CONFIG[selectedItem.status].text}`}>
                    {STATUS_CONFIG[selectedItem.status].label}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGE[selectedItem.sourceType].cls}`}>
                    {SOURCE_BADGE[selectedItem.sourceType].label}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-100">{selectedItem.parsedItemName}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{selectedItem.normalizedNeed}</p>
                {selectedItem.spec && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[selectedItem.spec, selectedItem.quantity && selectedItem.unit ? `${selectedItem.quantity} ${selectedItem.unit}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              {/* 원문/source context */}
              <div className="bg-el rounded-lg p-3">
                <p className="text-[10px] text-slate-500 mb-1">원문</p>
                <p className="text-xs text-slate-300">{selectedItem.sourceContext}</p>
              </div>

              {/* 후보 비교 카드 */}
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-2">
                  후보 {selectedItem.candidateProducts.length}개
                </p>
                <div className="space-y-2">
                  {selectedItem.candidateProducts.map((candidate) => {
                    const isSelected = selectedItem.selectedProductId === candidate.productId;
                    return (
                      <div
                        key={candidate.productId}
                        className={`p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-blue-500/5 border-blue-500/40"
                            : "bg-el border-bd hover:border-bs"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-200">{candidate.productName}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${
                              candidate.score >= 0.9
                                ? "text-emerald-400 border-emerald-500/30"
                                : candidate.score >= 0.7
                                ? "text-amber-400 border-amber-500/30"
                                : "text-red-400 border-red-500/30"
                            }`}
                          >
                            {Math.round(candidate.score * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {[candidate.brand, candidate.catalogNumber].filter(Boolean).join(" · ") || "정보 없음"}
                        </p>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={`mt-2 h-7 text-[11px] ${
                            isSelected
                              ? "bg-blue-600 hover:bg-blue-500 text-white"
                              : "border-bd text-slate-400 hover:text-slate-200"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(selectedItem.compareItemId, candidate.productId);
                          }}
                        >
                          {isSelected ? (
                            <><Check className="h-3 w-3 mr-1" /> 선택됨</>
                          ) : (
                            "이 후보 선택"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 선택 제품 요약 */}
              {selectedItem.selectedProductId && (
                <div className="border-l-2 border-blue-500 bg-pn p-3 rounded-r-lg">
                  <p className="text-[10px] text-blue-400 font-medium mb-1">선택된 제품</p>
                  {(() => {
                    const prod = selectedItem.candidateProducts.find(
                      (c) => c.productId === selectedItem.selectedProductId
                    );
                    if (!prod) return null;
                    return (
                      <>
                        <p className="text-sm font-medium text-slate-200">{prod.productName}</p>
                        <p className="text-xs text-slate-400">
                          {[prod.brand, prod.catalogNumber].filter(Boolean).join(" · ")}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 하단 CTA */}
              <div className="flex gap-2 pt-2 border-t border-bd">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500"
                  disabled={!selectedItem.selectedProductId || selectedItem.status === "selection_confirmed"}
                  onClick={() => onConfirmSelection(selectedItem.compareItemId)}
                >
                  선택 확정
                </Button>
                {selectedItem.status === "selection_confirmed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-bd"
                    onClick={() => onSendToQuote([selectedItem])}
                  >
                    견적 초안으로 보내기 <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-slate-500 hover:text-red-400 ml-auto"
                  onClick={() => onRemove(selectedItem.compareItemId)}
                >
                  제외
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Search className="h-6 w-6 text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">항목을 선택하면 후보 비교 패널이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 하단 고정 바 ── */}
      <div className="sticky bottom-0 bg-sh border-t border-bd py-3 px-1 flex items-center gap-3 mt-4">
        <Button
          className="h-9 text-xs bg-blue-600 hover:bg-blue-500"
          disabled={quoteReadyCount === 0}
          onClick={() => {
            const eligible = items.filter((i) => i.status === "selection_confirmed");
            onSendToQuote(eligible);
          }}
        >
          선택 확정 {quoteReadyCount}건 견적으로 보내기
        </Button>
        <span className="text-[10px] text-slate-500">
          선택 필요 {stats.selectionNeeded}건 · 비교 대기 {stats.pending}건
        </span>
      </div>
    </div>
  );
}

// ── Loading ──
export function CompareQueueLoading() {
  return (
    <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">후보 제품을 비교 가능한 형태로 정리하는 중...</span>
    </div>
  );
}

// ── Mock Data ──
export const MOCK_COMPARE_ITEMS: CompareQueueItem[] = [
  {
    compareItemId: "cmp-1",
    sourceQueueItemId: "rq-1",
    sourceType: "search",
    parsedItemName: "Fetal Bovine Serum",
    normalizedNeed: "Fetal Bovine Serum · 500mL",
    candidateProducts: [
      { productId: "p1", productName: "Gibco FBS (A3160801)", brand: "Thermo Fisher", catalogNumber: "A3160801", score: 0.95 },
      { productId: "p2", productName: "Corning FBS (35-010-CV)", brand: "Corning", catalogNumber: "35-010-CV", score: 0.88 },
      { productId: "p3", productName: "Sigma FBS (F7524)", brand: "Sigma-Aldrich", catalogNumber: "F7524", score: 0.82 },
    ],
    selectedProductId: null,
    manufacturer: null,
    catalogNumber: null,
    spec: "500mL",
    quantity: 2,
    unit: "병",
    comparisonReason: "후보 비교 필요",
    reviewReason: "multiple_candidates",
    confidence: "high",
    sourceContext: "검색어: \"FBS 500mL\"",
    evidenceSummary: null,
    status: "selection_needed",
  },
  {
    compareItemId: "cmp-2",
    sourceQueueItemId: "rq-4",
    sourceType: "excel",
    parsedItemName: "DMEM Medium",
    normalizedNeed: "DMEM Medium · 500mL",
    candidateProducts: [
      { productId: "p4", productName: "Gibco DMEM (11965092)", brand: "Thermo Fisher", catalogNumber: "11965092", score: 0.92 },
      { productId: "p5", productName: "Corning DMEM (10-013-CV)", brand: "Corning", catalogNumber: "10-013-CV", score: 0.85 },
    ],
    selectedProductId: null,
    manufacturer: null,
    catalogNumber: null,
    spec: "500mL",
    quantity: 3,
    unit: "병",
    comparisonReason: "후보 비교 필요",
    reviewReason: "multiple_candidates",
    confidence: "medium",
    sourceContext: "엑셀: DMEM / 500mL / 3개",
    evidenceSummary: null,
    status: "selection_needed",
  },
  {
    compareItemId: "cmp-3",
    sourceQueueItemId: "rq-7",
    sourceType: "protocol",
    parsedItemName: "Trypsin-EDTA",
    normalizedNeed: "Trypsin-EDTA · 0.25%",
    candidateProducts: [
      { productId: "p6", productName: "Gibco Trypsin-EDTA (25200056)", brand: "Thermo Fisher", catalogNumber: "25200056", score: 0.91 },
      { productId: "p7", productName: "Sigma Trypsin (T4049)", brand: "Sigma-Aldrich", catalogNumber: "T4049", score: 0.78 },
    ],
    selectedProductId: null,
    manufacturer: null,
    catalogNumber: null,
    spec: "0.25% · 100mL",
    quantity: 1,
    unit: "병",
    comparisonReason: "후보 비교 필요",
    reviewReason: "multiple_candidates",
    confidence: "medium",
    sourceContext: "프로토콜: \"Trypsinize cells using 0.25% Trypsin-EDTA\"",
    evidenceSummary: "Step 3: Cell detachment",
    status: "pending_comparison",
  },
  {
    compareItemId: "cmp-4",
    sourceQueueItemId: "rq-2",
    sourceType: "search",
    parsedItemName: "PBS Buffer",
    normalizedNeed: "PBS Buffer · 500mL",
    candidateProducts: [
      { productId: "p8", productName: "Gibco DPBS (14190144)", brand: "Thermo Fisher", catalogNumber: "14190144", score: 0.96 },
    ],
    selectedProductId: "p8",
    manufacturer: "Thermo Fisher",
    catalogNumber: "14190144",
    spec: "500mL",
    quantity: 5,
    unit: "병",
    comparisonReason: null,
    reviewReason: null,
    confidence: "high",
    sourceContext: "검색어: \"PBS 500mL\"",
    evidenceSummary: null,
    status: "selection_confirmed",
  },
  {
    compareItemId: "cmp-5",
    sourceQueueItemId: "rq-6",
    sourceType: "excel",
    parsedItemName: "Pipette Tips 200uL",
    normalizedNeed: "Pipette Tips · 200uL · 1000개/랙",
    candidateProducts: [
      { productId: "p9", productName: "Eppendorf Tips 200uL (0030000870)", brand: "Eppendorf", catalogNumber: "0030000870", score: 0.93 },
    ],
    selectedProductId: "p9",
    manufacturer: "Eppendorf",
    catalogNumber: "0030000870",
    spec: "200uL · 1000 tips/rack",
    quantity: 3,
    unit: "랙",
    comparisonReason: null,
    reviewReason: null,
    confidence: "high",
    sourceContext: "엑셀: Pipette Tips 200uL / 3랙",
    evidenceSummary: null,
    status: "selection_confirmed",
  },
  {
    compareItemId: "cmp-6",
    sourceQueueItemId: "rq-3",
    sourceType: "search",
    parsedItemName: "실험용 에탄올",
    normalizedNeed: "실험용 에탄올",
    candidateProducts: [],
    selectedProductId: null,
    manufacturer: null,
    catalogNumber: null,
    spec: null,
    quantity: null,
    unit: null,
    comparisonReason: null,
    reviewReason: "no_match",
    confidence: "low",
    sourceContext: "검색어: \"실험용 에탄올\"",
    evidenceSummary: null,
    status: "removed",
  },
];
