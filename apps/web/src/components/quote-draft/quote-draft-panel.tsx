"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Package,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type {
  QuoteDraftItem,
  QuoteDraftStatus,
  SourceType,
} from "@/lib/review-queue/types";
import {
  canSubmitQuoteDraftItem,
  mapQuoteDraftWarnings,
} from "@/lib/review-queue/types";

// ── 상태 badge ──
const STATUS_CONFIG: Record<QuoteDraftStatus, { label: string; dot: string; text: string }> = {
  draft_ready: { label: "제출 가능", dot: "bg-emerald-400", text: "text-emerald-400" },
  missing_required_fields: { label: "필수 정보 누락", dot: "bg-red-400", text: "text-red-400" },
  awaiting_review: { label: "검토 필요", dot: "bg-amber-400", text: "text-amber-400" },
  removed: { label: "제외됨", dot: "bg-slate-500", text: "text-slate-500" },
};

const SOURCE_BADGE: Record<SourceType, { label: string; cls: string }> = {
  search: { label: "검색", cls: "bg-blue-500/10 text-blue-400" },
  excel: { label: "엑셀", cls: "bg-emerald-500/10 text-emerald-400" },
  protocol: { label: "프로토콜", cls: "bg-violet-500/10 text-violet-400" },
};

const BUDGET_LABELS: Record<string, { text: string; cls: string }> = {
  budgetLinked: { text: "예산 연결됨", cls: "text-emerald-400" },
  budgetSuggested: { text: "예산 연결 가능", cls: "text-blue-400" },
  budgetCheckRequired: { text: "예산 확인 필요", cls: "text-amber-400" },
  noBudgetContext: { text: "예산 정보 없음", cls: "text-slate-500" },
};

const INVENTORY_LABELS: Record<string, { text: string; cls: string }> = {
  inventoryAvailable: { text: "보유 재고 있음", cls: "text-blue-400" },
  possibleDuplicatePurchase: { text: "중복 구매 가능성", cls: "text-amber-400" },
  noInventoryMatch: { text: "재고 없음", cls: "text-slate-500" },
  inventoryCheckRequired: { text: "재고 확인 필요", cls: "text-amber-400" },
};

type FilterTab = "all" | QuoteDraftStatus;

interface QuoteDraftPanelProps {
  items: QuoteDraftItem[];
  onUpdateItem: (id: string, updates: Partial<QuoteDraftItem>) => void;
  onRemove: (id: string) => void;
  onSubmit: (items: QuoteDraftItem[]) => void;
  onBackToStep2: (sourceQueueItemId: string) => void;
}

export function QuoteDraftPanel({
  items,
  onUpdateItem,
  onRemove,
  onSubmit,
  onBackToStep2,
}: QuoteDraftPanelProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return items.filter((i) => i.status !== "removed");
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const stats = useMemo(() => ({
    total: items.filter((i) => i.status !== "removed").length,
    ready: items.filter((i) => i.status === "draft_ready").length,
    missing: items.filter((i) => i.status === "missing_required_fields").length,
    review: items.filter((i) => i.status === "awaiting_review").length,
    budgetWarning: items.filter((i) => i.budgetHint === "budgetCheckRequired").length,
    inventoryWarning: items.filter((i) => i.inventoryHint === "possibleDuplicatePurchase").length,
  }), [items]);

  const selectedItem = useMemo(
    () => items.find((i) => i.quoteDraftItemId === selectedId) ?? null,
    [items, selectedId]
  );

  const submittable = useMemo(
    () => items.filter(canSubmitQuoteDraftItem),
    [items]
  );

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "draft_ready", label: "제출 가능" },
    { key: "missing_required_fields", label: "정보 누락" },
    { key: "awaiting_review", label: "검토 필요" },
    { key: "removed", label: "제외" },
  ];

  // ── Empty ──
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 bg-el border border-bd border-dashed rounded-xl text-center">
        <FileText className="h-8 w-8 text-slate-500 mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-1">
          아직 견적 초안에 담긴 항목이 없습니다
        </p>
        <p className="text-xs text-slate-500">
          Step 2에서 선택 확정된 항목을 보내주세요
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
            <h3 className="text-sm font-bold text-slate-900">견적 요청 초안</h3>
            <Badge variant="secondary" className="bg-el text-slate-600 text-[10px]">{stats.total}</Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>제출 가능 <strong className="text-emerald-400">{stats.ready}</strong></span>
            <span>·</span>
            <span>누락 <strong className="text-red-400">{stats.missing}</strong></span>
            <span>·</span>
            <span>검토 <strong className="text-amber-400">{stats.review}</strong></span>
            {stats.budgetWarning > 0 && <><span>·</span><span>예산 경고 <strong className="text-amber-400">{stats.budgetWarning}</strong></span></>}
            {stats.inventoryWarning > 0 && <><span>·</span><span>재고 중복 <strong className="text-amber-400">{stats.inventoryWarning}</strong></span></>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.key ? "bg-el text-slate-900" : "text-slate-500 hover:text-slate-600 hover:bg-st"
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
            const warnings = mapQuoteDraftWarnings(item);
            const isActive = selectedId === item.quoteDraftItemId;

            return (
              <button
                key={item.quoteDraftItemId}
                onClick={() => setSelectedId(item.quoteDraftItemId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isActive ? "bg-el border-blue-500/40" : "bg-pn border-bd hover:bg-el"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${src.cls}`}>{src.label}</span>
                </div>
                <p className="text-sm font-medium text-slate-700 truncate">{item.parsedItemName}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">
                    {[item.manufacturer, item.catalogNumber].filter(Boolean).join(" · ") || "제품 정보"}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {item.spec ? `${item.spec} · ` : ""}{item.quantity} {item.unit}
                  </span>
                </div>
                {warnings.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-400 truncate">{warnings[0]}</span>
                    {warnings.length > 1 && <span className="text-[10px] text-slate-500">+{warnings.length - 1}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 우측: 상세 패널 */}
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
                <h4 className="text-base font-bold text-slate-900">{selectedItem.parsedItemName}</h4>
              </div>

              {/* 선택 제품 */}
              <div className="bg-el rounded-lg p-3">
                <p className="text-[10px] text-slate-500 mb-1">선택 제품</p>
                <p className="text-sm text-slate-700">
                  {[selectedItem.manufacturer, selectedItem.catalogNumber].filter(Boolean).join(" · ") || selectedItem.selectedProductId}
                </p>
                {selectedItem.spec && <p className="text-xs text-slate-400 mt-0.5">{selectedItem.spec}</p>}
              </div>

              {/* 수량/단위/메모 수정 */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-medium">제출 정보</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">수량</label>
                    <Input
                      type="number"
                      value={selectedItem.quantity ?? ""}
                      onChange={(e) => onUpdateItem(selectedItem.quoteDraftItemId, { quantity: Number(e.target.value) || 0 })}
                      className="h-8 text-sm bg-el border-bd"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">단위</label>
                    <Input
                      value={selectedItem.unit ?? ""}
                      onChange={(e) => onUpdateItem(selectedItem.quoteDraftItemId, { unit: e.target.value })}
                      className="h-8 text-sm bg-el border-bd"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">메모 (공급사 전달)</label>
                  <Input
                    value={selectedItem.notes ?? ""}
                    onChange={(e) => onUpdateItem(selectedItem.quoteDraftItemId, { notes: e.target.value })}
                    className="h-8 text-sm bg-el border-bd"
                    placeholder="납기, 용도, 특이사항 등"
                  />
                </div>
              </div>

              {/* 예산 힌트 */}
              <div className="bg-el rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-[10px] text-slate-500 font-medium">예산 힌트</p>
                </div>
                {selectedItem.budgetHint ? (
                  <p className={`text-xs ${BUDGET_LABELS[selectedItem.budgetHint]?.cls ?? "text-slate-400"}`}>
                    {BUDGET_LABELS[selectedItem.budgetHint]?.text ?? selectedItem.budgetHint}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">예산 정보가 연결되지 않았습니다</p>
                )}
              </div>

              {/* 재고 힌트 */}
              <div className="bg-el rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-[10px] text-slate-500 font-medium">재고 힌트</p>
                </div>
                {selectedItem.inventoryHint ? (
                  <p className={`text-xs ${INVENTORY_LABELS[selectedItem.inventoryHint]?.cls ?? "text-slate-400"}`}>
                    {INVENTORY_LABELS[selectedItem.inventoryHint]?.text ?? selectedItem.inventoryHint}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">연결된 재고 없음</p>
                )}
              </div>

              {/* 원문/근거 */}
              <div className="bg-el rounded-lg p-3">
                <p className="text-[10px] text-slate-500 mb-1">원문</p>
                <p className="text-xs text-slate-600">{selectedItem.sourceContext}</p>
                {selectedItem.evidenceSummary && (
                  <p className="text-xs text-slate-400 mt-1">{selectedItem.evidenceSummary}</p>
                )}
              </div>

              {/* 경고 */}
              {(() => {
                const w = mapQuoteDraftWarnings(selectedItem);
                if (w.length === 0) return null;
                return (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-[10px] text-amber-400 font-medium mb-1">제출 전 확인 사항</p>
                    <ul className="space-y-0.5">
                      {w.map((msg, i) => (
                        <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          {msg}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* 하단 CTA */}
              <div className="flex gap-2 pt-2 border-t border-bd">
                {canSubmitQuoteDraftItem(selectedItem) ? (
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-500" onClick={() => onSubmit([selectedItem])}>
                    <Send className="h-3 w-3 mr-1" /> 견적 요청 제출
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 text-xs" disabled>
                    필수 정보를 입력해주세요
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-bd"
                  onClick={() => onBackToStep2(selectedItem.sourceQueueItemId)}
                >
                  <ArrowLeft className="h-3 w-3 mr-1" /> Step 2로 돌아가기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-slate-500 hover:text-red-400 ml-auto"
                  onClick={() => onRemove(selectedItem.quoteDraftItemId)}
                >
                  제외
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FileText className="h-6 w-6 text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">항목을 선택하면 견적 상세 정보가 표시됩니다</p>
              <p className="text-xs text-slate-500 mt-1">수량, 단위, 예산 및 재고 힌트를 확인하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 하단 고정 바 ── */}
      <div className="sticky bottom-0 bg-sh border-t border-bd py-3 px-1 flex items-center gap-3 mt-4">
        <Button
          className="h-9 text-xs bg-blue-600 hover:bg-blue-500"
          disabled={submittable.length === 0}
          onClick={() => onSubmit(submittable)}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          제출 가능 {submittable.length}건 견적 요청
        </Button>
        <span className="text-[10px] text-slate-500">
          누락 {stats.missing}건 · 검토 {stats.review}건
        </span>
      </div>
    </div>
  );
}

// ── Loading ──
export function QuoteDraftLoading() {
  return (
    <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">견적 초안을 제출 가능한 형태로 정리하는 중...</span>
    </div>
  );
}

// ── Mock Data ──
export const MOCK_QUOTE_DRAFTS: QuoteDraftItem[] = [
  {
    quoteDraftItemId: "qd-1",
    sourceQueueItemId: "rq-1",
    sourceType: "search",
    selectedProductId: "p1",
    parsedItemName: "Gibco FBS (A3160801)",
    manufacturer: "Thermo Fisher",
    catalogNumber: "A3160801",
    spec: "500mL",
    quantity: 2,
    unit: "병",
    notes: null,
    sourceContext: "검색어: \"FBS 500mL\"",
    evidenceSummary: null,
    budgetHint: "budgetSuggested",
    inventoryHint: "noInventoryMatch",
    status: "draft_ready",
  },
  {
    quoteDraftItemId: "qd-2",
    sourceQueueItemId: "rq-4",
    sourceType: "excel",
    selectedProductId: "p4",
    parsedItemName: "Gibco DMEM (11965092)",
    manufacturer: "Thermo Fisher",
    catalogNumber: "11965092",
    spec: "500mL",
    quantity: 3,
    unit: "병",
    notes: "cell culture용",
    sourceContext: "엑셀: DMEM / 500mL / 3개",
    evidenceSummary: null,
    budgetHint: "budgetLinked",
    inventoryHint: "inventoryAvailable",
    status: "awaiting_review",
  },
  {
    quoteDraftItemId: "qd-3",
    sourceQueueItemId: "rq-2",
    sourceType: "search",
    selectedProductId: "p8",
    parsedItemName: "Gibco DPBS (14190144)",
    manufacturer: "Thermo Fisher",
    catalogNumber: "14190144",
    spec: "500mL",
    quantity: 5,
    unit: "병",
    notes: null,
    sourceContext: "검색어: \"PBS 500mL\"",
    evidenceSummary: null,
    budgetHint: null,
    inventoryHint: "possibleDuplicatePurchase",
    status: "awaiting_review",
  },
  {
    quoteDraftItemId: "qd-4",
    sourceQueueItemId: "rq-6",
    sourceType: "excel",
    selectedProductId: "p9",
    parsedItemName: "Eppendorf Tips 200uL",
    manufacturer: "Eppendorf",
    catalogNumber: "0030000870",
    spec: "200uL · 1000 tips/rack",
    quantity: 3,
    unit: "랙",
    notes: null,
    sourceContext: "엑셀: Pipette Tips 200uL / 3랙",
    evidenceSummary: null,
    budgetHint: "budgetLinked",
    inventoryHint: "noInventoryMatch",
    status: "draft_ready",
  },
  {
    quoteDraftItemId: "qd-5",
    sourceQueueItemId: "rq-7",
    sourceType: "protocol",
    selectedProductId: "p6",
    parsedItemName: "Gibco Trypsin-EDTA (25200056)",
    manufacturer: "Thermo Fisher",
    catalogNumber: "25200056",
    spec: "0.25% · 100mL",
    quantity: 0,
    unit: "",
    notes: null,
    sourceContext: "프로토콜: \"Trypsinize cells using 0.25% Trypsin-EDTA\"",
    evidenceSummary: "Step 3: Cell detachment",
    budgetHint: "budgetCheckRequired",
    inventoryHint: null,
    status: "missing_required_fields",
  },
];
