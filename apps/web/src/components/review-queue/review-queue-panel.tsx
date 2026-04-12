"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import type {
  ReviewQueueItem,
  ReviewStatus,
  MatchCandidate,
  SourceType,
  ConfidenceLevel,
} from "@/lib/review-queue/types";

// ── Props ──
interface ReviewQueuePanelProps {
  items: ReviewQueueItem[];
  stats: {
    total: number;
    confirmed: number;
    needsReview: number;
    matchFailed: number;
    excluded: number;
  };
  onApprove: (id: string) => void;
  onExclude: (id: string) => void;
  onSelectProduct: (id: string, product: MatchCandidate) => void;
  onUpdateItem: (id: string, updates: Partial<ReviewQueueItem>) => void;
  onRemoveItem: (id: string) => void;
  compareReadyCount: number;
  quoteReadyCount: number;
  onSendToCompare: () => void;
  onSendToQuote: () => void;
}

// ── Filter / Sort types ──
type FilterType =
  | "all"
  | "confirmed"
  | "needs_review"
  | "match_failed"
  | "approved"
  | "excluded";

type SortType = "newest" | "review_first" | "confidence";

// ── Status config ──
const STATUS_CONFIG: Record<
  ReviewStatus,
  { dot: string; badge: string; label: string }
> = {
  confirmed: {
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-400 border border-green-500/20",
    label: "확정",
  },
  needs_review: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    label: "검토 필요",
  },
  match_failed: {
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border border-red-500/20",
    label: "매칭 실패",
  },
  compare_needed: {
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    label: "비교 필요",
  },
  approved: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    label: "승인 완료",
  },
  excluded: {
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    label: "제외됨",
  },
};

const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; badge: string }
> = {
  search: { label: "검색", badge: "bg-blue-500/10 text-blue-400" },
  excel: { label: "엑셀", badge: "bg-emerald-500/10 text-emerald-400" },
  protocol: { label: "프로토콜", badge: "bg-violet-500/10 text-violet-400" },
};

const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { label: string; className: string }
> = {
  high: { label: "높음", className: "text-emerald-400" },
  medium: { label: "중간", className: "text-amber-400" },
  low: { label: "낮음", className: "text-red-400" },
};

const CONFIDENCE_SORT_ORDER: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const REVIEW_SORT_ORDER: Record<ReviewStatus, number> = {
  match_failed: 0,
  needs_review: 1,
  compare_needed: 2,
  confirmed: 3,
  approved: 4,
  excluded: 5,
};

// ── Filter tabs ──
const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "confirmed", label: "확정 가능" },
  { key: "needs_review", label: "검토 필요" },
  { key: "match_failed", label: "매칭 실패" },
  { key: "approved", label: "승인 완료" },
  { key: "excluded", label: "제외" },
];

const SORT_OPTIONS: { key: SortType; label: string }[] = [
  { key: "newest", label: "최신순" },
  { key: "review_first", label: "검토 우선" },
  { key: "confidence", label: "신뢰도순" },
];

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════
export function ReviewQueuePanel({
  items,
  stats,
  onApprove,
  onExclude,
  onSelectProduct,
  onUpdateItem,
  onRemoveItem,
  compareReadyCount,
  quoteReadyCount,
  onSendToCompare,
  onSendToQuote,
}: ReviewQueuePanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Filter + Sort ──
  const filtered = useMemo(() => {
    let list =
      filter === "all" ? items : items.filter((i) => i.status === filter);

    switch (sort) {
      case "newest":
        list = [...list].sort(
          (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
        break;
      case "review_first":
        list = [...list].sort(
          (a, b) => REVIEW_SORT_ORDER[a.status] - REVIEW_SORT_ORDER[b.status]
        );
        break;
      case "confidence":
        list = [...list].sort(
          (a, b) =>
            CONFIDENCE_SORT_ORDER[a.confidence] -
            CONFIDENCE_SORT_ORDER[b.confidence]
        );
        break;
    }
    return list;
  }, [items, filter, sort]);

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleBulkApprove = () => {
    selectedIds.forEach((id) => onApprove(id));
    setSelectedIds(new Set());
  };

  const handleBulkExclude = () => {
    selectedIds.forEach((id) => onExclude(id));
    setSelectedIds(new Set());
  };

  const handleClearExcluded = () => {
    items
      .filter((i) => i.status === "excluded")
      .forEach((i) => onRemoveItem(i.id));
  };

  // ── Loading state ──
  // (When items array is empty but parent signals loading via 0 total)
  // This would be controlled by parent; shown here as pattern

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-el border border-bd border-dashed rounded-xl p-8">
        <Search className="h-8 w-8 text-slate-500 mb-3" />
        <div className="text-slate-400 text-base font-medium mb-1.5">
          아직 검토 큐에 담긴 항목이 없습니다
        </div>
        <p className="text-slate-500 text-sm max-w-sm text-center">
          직접 검색하거나 업로드 파일을 해석해 검토 작업을 시작하세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-st">검토 큐</h3>
          <span className="text-xs bg-el text-slate-600 rounded-full px-2 py-0.5 font-medium">
            {stats.total}
          </span>
        </div>

        {/* 상태 요약 칩 */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-green-400">확정 {stats.confirmed}</span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400">검토 {stats.needsReview}</span>
          <span className="text-slate-600">·</span>
          <span className="text-red-400">실패 {stats.matchFailed}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">제외 {stats.excluded}</span>
        </div>
      </div>

      {/* ── Filter tabs + Sort ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-bd">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                filter === f.key
                  ? "bg-el text-slate-900 font-medium"
                  : "text-slate-400 hover:text-slate-600 hover:bg-el/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                sort === s.key
                  ? "bg-el text-slate-700 font-medium"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar (sticky) ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-sh border-b border-bd">
          <span className="text-xs text-slate-600 font-medium">
            {selectedIds.size}건 선택됨
          </span>
          <div className="flex-1" />
          <button
            onClick={handleBulkApprove}
            className="text-[11px] px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            일괄 승인
          </button>
          <button
            onClick={onSendToCompare}
            className="text-[11px] px-3 py-1 rounded border border-bd text-slate-600 hover:bg-el transition-colors"
          >
            비교에 담기
          </button>
          <button
            onClick={handleBulkExclude}
            className="text-[11px] px-3 py-1 rounded text-slate-500 hover:text-slate-600 hover:bg-el transition-colors"
          >
            제외
          </button>
        </div>
      )}

      {/* ── Table rows ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-bd">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            해당 상태의 항목이 없습니다
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id}>
              {/* ── Row (8 columns) ── */}
              <div
                className={`grid grid-cols-[32px_72px_56px_1fr_1fr_100px_56px_56px_120px] items-center gap-2 px-4 py-2.5 text-sm cursor-pointer hover:bg-el/40 transition-colors ${
                  item.status === "excluded" ? "opacity-50" : ""
                }`}
                onClick={() => toggleExpand(item.id)}
              >
                {/* 체크박스 + 확장 아이콘 */}
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                </div>

                {/* 상태 */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_CONFIG[item.status].dot}`}
                  />
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${STATUS_CONFIG[item.status].badge}`}
                  >
                    {STATUS_CONFIG[item.status].label}
                  </span>
                </div>

                {/* 출처 */}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded text-center whitespace-nowrap ${SOURCE_CONFIG[item.sourceType].badge}`}
                >
                  {SOURCE_CONFIG[item.sourceType].label}
                </span>

                {/* 요청 품목 (2줄) */}
                <div className="min-w-0">
                  <div
                    className={`text-slate-900 font-medium truncate text-xs ${
                      item.status === "excluded" ? "line-through" : ""
                    }`}
                  >
                    {item.parsedItemName}
                  </div>
                  <div className="text-slate-500 text-[11px] truncate">
                    {item.rawInput}
                  </div>
                </div>

                {/* 추천 후보 */}
                <div className="min-w-0">
                  <div className="text-slate-700 text-xs truncate">
                    {item.selectedProduct?.productName ??
                      item.matchCandidates[0]?.productName ??
                      "-"}
                  </div>
                  {item.matchCandidates.length > 0 && (
                    <div className="text-slate-500 text-[10px]">
                      후보 {item.matchCandidates.length}개
                    </div>
                  )}
                </div>

                {/* 규격 / 수량 */}
                <div className="text-xs text-slate-400 truncate">
                  {[
                    item.spec,
                    item.quantity != null
                      ? `${item.quantity}${item.unit ?? ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </div>

                {/* 검토 사유 (축약) */}
                <div className="text-[10px] text-amber-400 truncate">
                  {item.reviewReason ? "!" : ""}
                </div>

                {/* 신뢰도 */}
                <span
                  className={`text-[10px] text-center font-medium ${CONFIDENCE_CONFIG[item.confidence].className}`}
                >
                  {CONFIDENCE_CONFIG[item.confidence].label}
                </span>

                {/* 액션 */}
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActions
                    status={item.status}
                    onApprove={() => onApprove(item.id)}
                    onExclude={() => onExclude(item.id)}
                    onRestore={() =>
                      onUpdateItem(item.id, { status: "needs_review" })
                    }
                  />
                </div>
              </div>

              {/* ── Expand panel ── */}
              {expandedId === item.id && (
                <ExpandPanel
                  item={item}
                  onApprove={() => onApprove(item.id)}
                  onExclude={() => onExclude(item.id)}
                  onSelectProduct={(product) =>
                    onSelectProduct(item.id, product)
                  }
                  onSendToCompare={onSendToCompare}
                  onSendToQuote={onSendToQuote}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="sticky bottom-0 flex items-center gap-2 px-4 py-3 bg-sh border-t border-bd">
        <button
          disabled={compareReadyCount === 0}
          onClick={onSendToCompare}
          className="flex-1 text-sm font-medium py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          확정 {compareReadyCount}건 비교로 보내기
        </button>
        <button
          disabled={quoteReadyCount === 0}
          onClick={onSendToQuote}
          className="text-sm font-medium py-2 px-4 rounded-lg border border-bd text-slate-600 hover:bg-el disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          견적 초안 만들기
        </button>
        <button
          onClick={handleClearExcluded}
          className="text-sm text-slate-500 hover:text-slate-600 py-2 px-3 transition-colors"
        >
          제외 항목 정리
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Loading state (export for parent use)
// ══════════════════════════════════════════════
export function ReviewQueueLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
      <p className="text-sm text-slate-400">
        검색 결과를 검토 큐로 정리하는 중...
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════
// Row Actions
// ══════════════════════════════════════════════
function RowActions({
  status,
  onApprove,
  onExclude,
  onRestore,
}: {
  status: ReviewStatus;
  onApprove: () => void;
  onExclude: () => void;
  onRestore: () => void;
}) {
  switch (status) {
    case "confirmed":
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={onApprove}
            className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            승인
          </button>
          <button className="text-[11px] px-2.5 py-1 rounded text-slate-400 hover:text-slate-700 hover:bg-el transition-colors">
            수정
          </button>
        </div>
      );
    case "needs_review":
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={onApprove}
            className="text-[11px] px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            검토
          </button>
          <button
            onClick={onExclude}
            className="text-[11px] px-2.5 py-1 rounded text-slate-400 hover:text-slate-700 hover:bg-el transition-colors"
          >
            수정
          </button>
        </div>
      );
    case "match_failed":
      return (
        <button className="text-[11px] px-2.5 py-1 rounded border border-bd text-slate-600 hover:bg-el transition-colors">
          수동 검색
        </button>
      );
    case "compare_needed":
      return (
        <button className="text-[11px] px-2.5 py-1 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
          비교 보내기
        </button>
      );
    case "approved":
      return (
        <span className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          완료
        </span>
      );
    case "excluded":
      return (
        <button
          onClick={onRestore}
          className="text-[11px] px-2.5 py-1 rounded text-slate-400 hover:text-slate-700 hover:bg-el transition-colors"
        >
          복구
        </button>
      );
  }
}

// ══════════════════════════════════════════════
// Expand Panel
// ══════════════════════════════════════════════
function ExpandPanel({
  item,
  onApprove,
  onExclude,
  onSelectProduct,
  onSendToCompare,
  onSendToQuote,
}: {
  item: ReviewQueueItem;
  onApprove: () => void;
  onExclude: () => void;
  onSelectProduct: (product: MatchCandidate) => void;
  onSendToCompare: () => void;
  onSendToQuote: () => void;
}) {
  const candidates = item.matchCandidates.slice(0, 3);

  return (
    <div className="px-4 pb-4 pt-1 space-y-3 bg-pn/30">
      {/* 원문 입력 */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
          원문 입력
        </div>
        <div className="bg-el rounded p-3 text-xs text-slate-600 font-mono break-all">
          {item.rawInput}
        </div>
      </div>

      {/* AI 추출 필드 (2x3 grid) */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
          AI 추출 필드
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
          <Field label="품목명" value={item.parsedItemName} />
          <Field label="제조사" value={item.manufacturer} />
          <Field label="Cat.No" value={item.catalogNumber} />
          <Field label="규격" value={item.spec} />
          <Field
            label="수량"
            value={
              item.quantity != null ? String(item.quantity) : null
            }
          />
          <Field label="단위" value={item.unit} />
        </div>
      </div>

      {/* 추천 후보 (최대 3개 카드) */}
      {candidates.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            추천 후보
          </div>
          <div className="space-y-1">
            {candidates.map((c) => (
              <div
                key={c.productId}
                className={`flex items-center gap-3 px-3 py-2 rounded border transition-colors cursor-pointer ${
                  item.selectedProduct?.productId === c.productId
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-bd hover:bg-el/50"
                }`}
              >
                <input
                  type="radio"
                  name={`candidate-${item.id}`}
                  checked={item.selectedProduct?.productId === c.productId}
                  onChange={() => onSelectProduct(c)}
                  className="accent-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700 truncate">
                    {c.productName}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {c.brand && <span>{c.brand}</span>}
                    {c.catalogNumber && (
                      <span className="font-mono">{c.catalogNumber}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    c.score >= 0.8
                      ? "bg-emerald-500/10 text-emerald-400"
                      : c.score >= 0.5
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {Math.round(c.score * 100)}%
                </span>
                <button
                  onClick={() => onSelectProduct(c)}
                  className="text-[10px] px-2 py-1 rounded border border-bd text-slate-600 hover:bg-el transition-colors whitespace-nowrap"
                >
                  이 후보 선택
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검토 사유 */}
      {item.reviewReason && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
            검토 사유
          </span>
          <span className="text-xs text-slate-400">{item.reviewReason}</span>
        </div>
      )}

      {/* 하단 CTA row */}
      <div className="flex items-center gap-2 pt-1 border-t border-bd">
        {item.status !== "approved" && item.status !== "excluded" && (
          <button
            onClick={onApprove}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            승인
          </button>
        )}
        {(item.status === "confirmed" || item.status === "approved") && (
          <button
            onClick={onSendToCompare}
            className="text-xs px-3 py-1.5 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            비교 담기
          </button>
        )}
        {(item.status === "confirmed" || item.status === "approved") && (
          <button
            onClick={onSendToQuote}
            className="text-xs px-3 py-1.5 rounded border border-bd text-slate-600 hover:bg-el transition-colors"
          >
            견적 보내기
          </button>
        )}
        {item.status !== "excluded" && (
          <button
            onClick={onExclude}
            className="text-xs px-3 py-1.5 rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            제외
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Field helper
// ══════════════════════════════════════════════
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-600 truncate">{value ?? "-"}</div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Mock data (10건)
// ══════════════════════════════════════════════
export const MOCK_REVIEW_ITEMS: ReviewQueueItem[] = [
  {
    id: "rq-mock-001",
    sourceType: "search",
    rawInput: "Gibco FBS 500mL qualified",
    parsedItemName: "FBS 500mL",
    manufacturer: "Gibco",
    catalogNumber: "16000-044",
    spec: "500mL",
    quantity: 1,
    unit: "EA",
    confidence: "high",
    status: "confirmed",
    matchCandidates: [
      {
        productId: "p-001",
        productName: "Gibco Fetal Bovine Serum, qualified",
        brand: "Gibco",
        catalogNumber: "16000-044",
        score: 0.97,
      },
      {
        productId: "p-002",
        productName: "Gibco FBS, heat-inactivated",
        brand: "Gibco",
        catalogNumber: "10082-147",
        score: 0.82,
      },
    ],
    selectedProduct: {
      productId: "p-001",
      productName: "Gibco Fetal Bovine Serum, qualified",
      brand: "Gibco",
      catalogNumber: "16000-044",
      score: 0.97,
    },
    needsReview: false,
    reviewReason: null,
    addedAt: "2026-03-19T09:00:00Z",
  },
  {
    id: "rq-mock-002",
    sourceType: "search",
    rawInput: "Trypsin 0.25% EDTA",
    parsedItemName: "Trypsin 0.25%",
    manufacturer: null,
    catalogNumber: null,
    spec: "0.25%",
    quantity: 2,
    unit: "EA",
    confidence: "medium",
    status: "needs_review",
    matchCandidates: [
      {
        productId: "p-003",
        productName: "Gibco Trypsin-EDTA 0.25%",
        brand: "Gibco",
        catalogNumber: "25200-056",
        score: 0.74,
      },
      {
        productId: "p-004",
        productName: "Sigma Trypsin-EDTA solution",
        brand: "Sigma-Aldrich",
        catalogNumber: "T4049",
        score: 0.68,
      },
    ],
    selectedProduct: null,
    needsReview: true,
    reviewReason: "제조사 확인 필요",
    addedAt: "2026-03-19T09:01:00Z",
  },
  {
    id: "rq-mock-003",
    sourceType: "search",
    rawInput: "실험용 에탄올 순도 99%",
    parsedItemName: "실험용 에탄올",
    manufacturer: null,
    catalogNumber: null,
    spec: "99%",
    quantity: 1,
    unit: "L",
    confidence: "low",
    status: "match_failed",
    matchCandidates: [],
    selectedProduct: null,
    needsReview: true,
    reviewReason: "매칭 후보 없음 - 수동 검색 필요",
    addedAt: "2026-03-19T09:02:00Z",
  },
  {
    id: "rq-mock-004",
    sourceType: "excel",
    rawInput: "DMEM high glucose w/ L-glut, 500mL x 6",
    parsedItemName: "DMEM 500mL",
    manufacturer: "Gibco",
    catalogNumber: "11965-092",
    spec: "500mL",
    quantity: 6,
    unit: "EA",
    confidence: "high",
    status: "confirmed",
    matchCandidates: [
      {
        productId: "p-005",
        productName: "Gibco DMEM, high glucose, GlutaMAX",
        brand: "Gibco",
        catalogNumber: "11965-092",
        score: 0.95,
      },
    ],
    selectedProduct: {
      productId: "p-005",
      productName: "Gibco DMEM, high glucose, GlutaMAX",
      brand: "Gibco",
      catalogNumber: "11965-092",
      score: 0.95,
    },
    needsReview: false,
    reviewReason: null,
    addedAt: "2026-03-19T09:03:00Z",
  },
  {
    id: "rq-mock-005",
    sourceType: "excel",
    rawInput: "PBS 10x pH7.4 500mL",
    parsedItemName: "PBS buffer",
    manufacturer: "Gibco",
    catalogNumber: null,
    spec: "10x, 500mL",
    quantity: 3,
    unit: "EA",
    confidence: "medium",
    status: "needs_review",
    matchCandidates: [
      {
        productId: "p-006",
        productName: "Gibco PBS, pH 7.4 (1X)",
        brand: "Gibco",
        catalogNumber: "10010-023",
        score: 0.61,
      },
      {
        productId: "p-007",
        productName: "Gibco PBS, pH 7.4 (10X)",
        brand: "Gibco",
        catalogNumber: "70011-044",
        score: 0.58,
      },
    ],
    selectedProduct: null,
    needsReview: true,
    reviewReason: "규격 불일치 - 1X/10X 확인 필요",
    addedAt: "2026-03-19T09:04:00Z",
  },
  {
    id: "rq-mock-006",
    sourceType: "excel",
    rawInput: "Pipette Tips 200uL 1000EA Axygen",
    parsedItemName: "Pipette Tips 1000개",
    manufacturer: "Axygen",
    catalogNumber: "T-200-Y",
    spec: "200uL",
    quantity: 1000,
    unit: "EA",
    confidence: "high",
    status: "confirmed",
    matchCandidates: [
      {
        productId: "p-008",
        productName: "Axygen Universal Fit Pipette Tips 200uL",
        brand: "Axygen",
        catalogNumber: "T-200-Y",
        score: 0.93,
      },
    ],
    selectedProduct: {
      productId: "p-008",
      productName: "Axygen Universal Fit Pipette Tips 200uL",
      brand: "Axygen",
      catalogNumber: "T-200-Y",
      score: 0.93,
    },
    needsReview: false,
    reviewReason: null,
    addedAt: "2026-03-19T09:05:00Z",
  },
  {
    id: "rq-mock-007",
    sourceType: "protocol",
    rawInput: "Conical tube 50mL (centrifuge tube)",
    parsedItemName: "Conical Tube 50mL",
    manufacturer: null,
    catalogNumber: null,
    spec: "50mL",
    quantity: 25,
    unit: null,
    confidence: "medium",
    status: "needs_review",
    matchCandidates: [
      {
        productId: "p-009",
        productName: "Falcon 50mL Conical Centrifuge Tubes",
        brand: "Falcon",
        catalogNumber: "352070",
        score: 0.72,
      },
      {
        productId: "p-010",
        productName: "SPL 50mL Conical Tube",
        brand: "SPL Life Sciences",
        catalogNumber: "50050",
        score: 0.65,
      },
    ],
    selectedProduct: null,
    needsReview: true,
    reviewReason: "단위 해석 필요 - EA/pack 확인",
    addedAt: "2026-03-19T09:06:00Z",
  },
  {
    id: "rq-mock-008",
    sourceType: "protocol",
    rawInput: "세포 배양용 성장인자 EGF recombinant human",
    parsedItemName: "세포 배양용 성장인자",
    manufacturer: null,
    catalogNumber: null,
    spec: null,
    quantity: 1,
    unit: null,
    confidence: "low",
    status: "match_failed",
    matchCandidates: [],
    selectedProduct: null,
    needsReview: true,
    reviewReason: "매칭 후보 없음 - 규격/제조사 미특정",
    addedAt: "2026-03-19T09:07:00Z",
  },
  {
    id: "rq-mock-009",
    sourceType: "search",
    rawInput: "Tris-HCl 1M pH 8.0 1kg Sigma",
    parsedItemName: "Tris-HCl 1kg",
    manufacturer: "Sigma-Aldrich",
    catalogNumber: "T1503",
    spec: "1M, pH 8.0, 1kg",
    quantity: 1,
    unit: "EA",
    confidence: "high",
    status: "approved",
    matchCandidates: [
      {
        productId: "p-011",
        productName: "Sigma Tris(hydroxymethyl)aminomethane hydrochloride",
        brand: "Sigma-Aldrich",
        catalogNumber: "T1503",
        score: 0.96,
      },
    ],
    selectedProduct: {
      productId: "p-011",
      productName: "Sigma Tris(hydroxymethyl)aminomethane hydrochloride",
      brand: "Sigma-Aldrich",
      catalogNumber: "T1503",
      score: 0.96,
    },
    needsReview: false,
    reviewReason: null,
    addedAt: "2026-03-19T08:50:00Z",
  },
  {
    id: "rq-mock-010",
    sourceType: "excel",
    rawInput: "PBS 10x pH7.4 500mL (중복)",
    parsedItemName: "PBS buffer (중복)",
    manufacturer: "Gibco",
    catalogNumber: null,
    spec: "10x, 500mL",
    quantity: 3,
    unit: "EA",
    confidence: "low",
    status: "excluded",
    matchCandidates: [],
    selectedProduct: null,
    needsReview: false,
    reviewReason: "중복 항목으로 제외됨",
    addedAt: "2026-03-19T09:08:00Z",
  },
];
