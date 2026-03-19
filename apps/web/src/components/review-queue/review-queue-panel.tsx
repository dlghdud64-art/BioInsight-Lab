"use client";

import { useState } from "react";
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

// ── Filter type ──
type FilterType = "all" | "confirmed" | "needs_review" | "match_failed";

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
  excluded: {
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    label: "제외됨",
  },
};

const CONFIDENCE_BADGE: Record<ConfidenceLevel, string> = {
  high: "bg-green-500/10 text-green-400 border border-green-500/20",
  medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  low: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  search: "검색",
  excel: "엑셀",
  protocol: "프로토콜",
};

// ── Component ──
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? items
      : items.filter((i) => i.status === filter);

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleClearExcluded = () => {
    items
      .filter((i) => i.status === "excluded")
      .forEach((i) => onRemoveItem(i.id));
  };

  // ── Filter chips ──
  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "confirmed", label: "확정" },
    { key: "needs_review", label: "검토 필요" },
    { key: "match_failed", label: "실패" },
  ];

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-slate-400 text-lg font-medium mb-2">
          검토할 항목이 없습니다
        </div>
        <p className="text-slate-500 text-sm max-w-xs">
          검색하거나 파일을 업로드하면 여기에 검토 항목이 쌓입니다.
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
          <span className="text-xs bg-el text-slate-300 rounded-full px-2 py-0.5">
            {stats.total}
          </span>
        </div>

        {/* 상태 요약 */}
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

      {/* ── Filter toggle ── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-bd">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              filter === f.key
                ? "bg-el text-slate-100 font-medium"
                : "text-slate-400 hover:text-slate-300 hover:bg-el/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-bd">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            해당 상태의 항목이 없습니다
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id}>
              {/* ── Row ── */}
              <div
                className={`grid grid-cols-[80px_64px_1fr_1fr_100px_72px_120px] items-center gap-2 px-4 py-2.5 text-sm cursor-pointer hover:bg-el/40 transition-colors ${
                  item.status === "excluded" ? "opacity-50" : ""
                }`}
                onClick={() => toggleExpand(item.id)}
              >
                {/* 상태 */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[item.status].dot}`}
                  />
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_CONFIG[item.status].badge}`}
                  >
                    {STATUS_CONFIG[item.status].label}
                  </span>
                </div>

                {/* 출처 */}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-el text-slate-400 text-center">
                  {SOURCE_LABEL[item.sourceType]}
                </span>

                {/* 품목 */}
                <div className="min-w-0">
                  <div
                    className={`text-slate-100 font-medium truncate ${
                      item.status === "excluded" ? "line-through" : ""
                    }`}
                  >
                    {item.parsedItemName}
                  </div>
                  <div className="text-slate-500 text-xs truncate">
                    {item.rawInput}
                  </div>
                </div>

                {/* 추천 후보 */}
                <div className="min-w-0">
                  <div className="text-slate-200 text-xs truncate">
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

                {/* 규격/수량 */}
                <div className="text-xs text-slate-400 truncate">
                  {[item.spec, item.quantity != null ? `${item.quantity}${item.unit ?? ""}` : null]
                    .filter(Boolean)
                    .join(" · ") || "-"}
                </div>

                {/* 신뢰도 */}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded text-center ${CONFIDENCE_BADGE[item.confidence]}`}
                >
                  {item.confidence}
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
          className="text-sm font-medium py-2 px-4 rounded-lg border border-bd text-slate-300 hover:bg-el disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          견적 초안 만들기
        </button>
        <button
          onClick={handleClearExcluded}
          className="text-sm text-slate-500 hover:text-slate-300 py-2 px-3 transition-colors"
        >
          제외 항목 정리
        </button>
      </div>
    </div>
  );
}

// ── Row Actions ──
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
        <button className="text-[11px] px-2.5 py-1 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
          비교 담기
        </button>
      );
    case "needs_review":
      return (
        <>
          <button
            onClick={onApprove}
            className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            승인
          </button>
          <button
            onClick={onExclude}
            className="text-[11px] px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-el transition-colors"
          >
            제외
          </button>
        </>
      );
    case "match_failed":
      return (
        <button className="text-[11px] px-2.5 py-1 rounded border border-bd text-slate-300 hover:bg-el transition-colors">
          수동 검색
        </button>
      );
    case "excluded":
      return (
        <button
          onClick={onRestore}
          className="text-[11px] px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-el transition-colors"
        >
          복구
        </button>
      );
  }
}

// ── Expand Panel ──
function ExpandPanel({
  item,
  onApprove,
  onExclude,
  onSelectProduct,
}: {
  item: ReviewQueueItem;
  onApprove: () => void;
  onExclude: () => void;
  onSelectProduct: (product: MatchCandidate) => void;
}) {
  const candidates = item.matchCandidates.slice(0, 3);

  return (
    <div className="px-4 pb-4 pt-1 space-y-3">
      {/* 원문 입력값 */}
      <div className="bg-el rounded p-3 text-xs text-slate-300 font-mono break-all">
        {item.rawInput}
      </div>

      {/* AI 추출 필드 */}
      <div className="grid grid-cols-5 gap-2 text-xs">
        <Field label="품목명" value={item.parsedItemName} />
        <Field label="제조사" value={item.manufacturer} />
        <Field label="Cat.No" value={item.catalogNumber} />
        <Field label="규격" value={item.spec} />
        <Field
          label="수량"
          value={
            item.quantity != null
              ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
              : null
          }
        />
      </div>

      {/* 추천 후보 리스트 */}
      {candidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
            추천 후보
          </div>
          {candidates.map((c) => (
            <label
              key={c.productId}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-el/50 cursor-pointer text-xs transition-colors"
            >
              <input
                type="radio"
                name={`candidate-${item.id}`}
                checked={item.selectedProduct?.productId === c.productId}
                onChange={() => onSelectProduct(c)}
                className="accent-blue-500"
              />
              <span className="text-slate-200 flex-1 truncate">
                {c.productName}
              </span>
              {c.brand && (
                <span className="text-slate-500">{c.brand}</span>
              )}
              {c.catalogNumber && (
                <span className="text-slate-500 font-mono">
                  {c.catalogNumber}
                </span>
              )}
              <span className="text-slate-500">
                {Math.round(c.score * 100)}%
              </span>
            </label>
          ))}
        </div>
      )}

      {/* 검토 사유 */}
      {item.reviewReason && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            검토 사유
          </span>
          <span className="text-xs text-slate-400">{item.reviewReason}</span>
        </div>
      )}

      {/* 하단 CTA */}
      <div className="flex items-center gap-2 pt-1">
        {item.status !== "confirmed" && item.status !== "excluded" && (
          <button
            onClick={onApprove}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            승인
          </button>
        )}
        {item.status === "confirmed" && (
          <>
            <button className="text-xs px-3 py-1.5 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors">
              비교 담기
            </button>
            <button className="text-xs px-3 py-1.5 rounded border border-bd text-slate-300 hover:bg-el transition-colors">
              견적 보내기
            </button>
          </>
        )}
        {item.status !== "excluded" && (
          <button
            onClick={onExclude}
            className="text-xs px-3 py-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-el transition-colors"
          >
            제외
          </button>
        )}
      </div>
    </div>
  );
}

// ── Field helper ──
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-300 truncate">{value ?? "-"}</div>
    </div>
  );
}
