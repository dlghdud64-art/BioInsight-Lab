"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Calendar,
  Trash2,
  ShoppingCart,
  MapPin,
  Printer,
  PackageCheck,
  ChevronRight,
  Clock,
  Flame,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/* ── Types ── */
export type QueueRiskLevel = "critical" | "high" | "medium" | "low";
export type QueueCategory =
  | "expiring_soon"
  | "disposal_review"
  | "reorder_priority"
  | "no_location"
  | "label_reprint"
  | "receiving_pending";

export interface QueueItem {
  id: string;
  productName: string;
  lotNumber?: string;
  risk: QueueRiskLevel;
  category: QueueCategory;
  reason: string;
  /** AI 추천 근거 — 왜 이 항목이 큐에 올랐는지 설명 */
  rationale: string;
  recommendedAction: string;
  actionLabel: string;
  meta?: Record<string, string>;
}

/* ── Config maps ── */
const RISK_CONFIG: Record<QueueRiskLevel, { label: string; dot: string; bg: string }> = {
  critical: { label: "긴급", dot: "bg-red-500", bg: "bg-red-500/10 text-red-400 border-red-500/20" },
  high:     { label: "높음", dot: "bg-amber-500", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  medium:   { label: "보통", dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  low:      { label: "낮음", dot: "bg-slate-400", bg: "bg-pg0/10 text-slate-400 border-slate-500/20" },
};

const CATEGORY_CONFIG: Record<QueueCategory, { label: string; icon: React.ElementType; color: string }> = {
  expiring_soon:    { label: "만료 임박",       icon: Calendar,     color: "text-red-400" },
  disposal_review:  { label: "폐기 검토",       icon: Trash2,       color: "text-red-400" },
  reorder_priority: { label: "재주문 우선",     icon: ShoppingCart,  color: "text-amber-400" },
  no_location:      { label: "위치 미지정",     icon: MapPin,        color: "text-blue-400" },
  label_reprint:    { label: "라벨 재출력",     icon: Printer,       color: "text-violet-400" },
  receiving_pending:{ label: "입고 미정리",     icon: PackageCheck,  color: "text-emerald-400" },
};

/* ── Mock data generator ── */
export function generateMockQueueItems(): QueueItem[] {
  return [
    {
      id: "q-1",
      productName: "Gibco FBS (500ml)",
      lotNumber: "23K15-Y",
      risk: "critical",
      category: "expiring_soon",
      reason: "만료 D-3 / 미개봉 2ea",
      rationale: "만료 D-3: 유효기한까지 3일 남은 미개봉 2ea — 즉시 사용하지 않으면 전량 폐기 손실",
      recommendedAction: "우선 사용 또는 폐기 검토",
      actionLabel: "폐기 검토",
    },
    {
      id: "q-2",
      productName: "DMEM Medium (500ml)",
      risk: "critical",
      category: "reorder_priority",
      reason: "안전재고 미만, 6일 내 소진 예상",
      rationale: "최근 14일 사용속도 기준 6일 내 소진 예상 — 리드타임(10일) 고려 시 즉시 발주 필요",
      recommendedAction: "긴급 재주문 필요",
      actionLabel: "재주문",
    },
    {
      id: "q-3",
      productName: "Trypsin-EDTA Solution",
      lotNumber: "25B03-A",
      risk: "high",
      category: "disposal_review",
      reason: "만료 D-7 / 개봉 후 14일 경과",
      rationale: "만료 D-7 + 개봉 후 14일 경과: 제조사 권장 개봉 후 사용기한(14일) 초과, 활성 저하 우려",
      recommendedAction: "폐기 후 신규 lot 발주",
      actionLabel: "폐기 검토",
    },
    {
      id: "q-4",
      productName: "Pipette Tips (1000uL)",
      risk: "high",
      category: "reorder_priority",
      reason: "안전재고 5 box 대비 현재 2 box",
      rationale: "최근 14일 사용속도 기준 7일 내 소진 예상 — 안전재고(5 box) 대비 현재 2 box",
      recommendedAction: "정기 발주 시 포함 권장",
      actionLabel: "재주문",
    },
    {
      id: "q-5",
      productName: "Cell Lysis Buffer",
      risk: "medium",
      category: "no_location",
      reason: "냉장 보관 품목, 현재 위치 미지정",
      rationale: "위치 미지정: 냉장(2-8°C) 보관 필수 품목이나 보관 위치 미등록 — 보관 조건 불일치 위험",
      recommendedAction: "보관 위치 등록 필요",
      actionLabel: "위치 지정",
    },
    {
      id: "q-6",
      productName: "Falcon 50ml Conical Tube",
      lotNumber: "24C12-R",
      risk: "medium",
      category: "label_reprint",
      reason: "QR 라벨 손상 / 스캔 불가",
      rationale: "QR 라벨 손상으로 바코드 스캔 불가 — 재고 추적 누락 및 출납 오류 가능성",
      recommendedAction: "라벨 재출력 필요",
      actionLabel: "라벨 출력",
    },
    {
      id: "q-7",
      productName: "Anti-CD3 Antibody",
      risk: "low",
      category: "receiving_pending",
      reason: "입고 3일 경과, 검수 미완료",
      rationale: "입고 후 3일 경과, 검수 미완료 — 냉동 보관 품목 상온 방치 시 품질 저하 우려",
      recommendedAction: "검수 및 위치 배정 필요",
      actionLabel: "검수 처리",
    },
    {
      id: "q-8",
      productName: "PBS Solution (1L)",
      lotNumber: "25A08-D",
      risk: "low",
      category: "receiving_pending",
      reason: "입고 후 Lot 정보 미입력",
      rationale: "Lot 정보 미입력: 유효기한·입고일 미등록으로 만료 모니터링 불가",
      recommendedAction: "Lot 번호 및 유효기한 등록",
      actionLabel: "정보 입력",
    },
  ];
}

/* ── Component ── */
interface PriorityActionQueueProps {
  items?: QueueItem[];
  onAction?: (item: QueueItem) => void;
  onItemClick?: (item: QueueItem) => void;
  className?: string;
}

export function PriorityActionQueue({
  items,
  onAction,
  onItemClick,
  className = "",
}: PriorityActionQueueProps) {
  const queueItems = items ?? generateMockQueueItems();
  const [selectedCategory, setSelectedCategory] = useState<QueueCategory | "all">("all");

  const filtered = selectedCategory === "all"
    ? queueItems
    : queueItems.filter((item) => item.category === selectedCategory);

  // Category counts for filter pills
  const categoryCounts = queueItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const riskOrder: QueueRiskLevel[] = ["critical", "high", "medium", "low"];
  const sorted = [...filtered].sort(
    (a, b) => riskOrder.indexOf(a.risk) - riskOrder.indexOf(b.risk)
  );

  return (
    <div className={`rounded-xl border border-bd bg-pn overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-bd flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              오늘 처리할 재고 작업
            </h3>
            <p className="text-[11px] text-slate-500">
              {queueItems.length}건 대기 중
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5"
        >
          <Clock className="h-3 w-3 mr-1" />
          실시간
        </Badge>
      </div>

      {/* Category filter pills */}
      <div className="px-4 py-2.5 border-b border-bd flex gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
            selectedCategory === "all"
              ? "bg-slate-600/50 text-slate-200"
              : "bg-el text-slate-500 hover:text-slate-300"
          }`}
        >
          전체 {queueItems.length}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as QueueCategory[]).map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? "all" : cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
                selectedCategory === cat
                  ? "bg-slate-600/50 text-slate-200"
                  : "bg-el text-slate-500 hover:text-slate-300"
              }`}
            >
              {cfg.label} {count}
            </button>
          );
        })}
      </div>

      {/* Queue items */}
      <div className="divide-y divide-bd">
        {sorted.map((item) => {
          const riskCfg = RISK_CONFIG[item.risk];
          const catCfg = CATEGORY_CONFIG[item.category];
          const CatIcon = catCfg.icon;

          return (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-el transition-colors cursor-pointer group"
              onClick={() => onItemClick?.(item)}
            >
              {/* Row 1: Risk + Product + Category badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${riskCfg.dot}`} />
                <span className="text-sm font-semibold text-slate-200 truncate flex-1">
                  {item.productName}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border shrink-0 ${riskCfg.bg}`}
                >
                  {riskCfg.label}
                </Badge>
              </div>

              {/* Row 2: Category icon + reason */}
              <div className="flex items-start gap-2 ml-4">
                <CatIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${catCfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <span className={`font-medium ${catCfg.color}`}>{catCfg.label}</span>
                    <span className="mx-1.5 text-slate-600">|</span>
                    {item.reason}
                  </p>
                  {item.lotNumber && (
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                      Lot: {item.lotNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: AI 추천 근거 */}
              <div className="mt-1.5 ml-4 rounded-md bg-pn/60 border border-bd/50 px-2.5 py-1.5">
                <p className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                  <Sparkles className="h-3 w-3 shrink-0 mt-px text-amber-500/70" />
                  <span>
                    <span className="font-semibold text-slate-400">추천 근거</span>
                    <span className="mx-1 text-slate-700">—</span>
                    {item.rationale}
                  </span>
                </p>
              </div>

              {/* Row 4: Recommended action + quick action */}
              <div className="flex items-center justify-between mt-2 ml-4">
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-slate-600" />
                  권장: {item.recommendedAction}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.(item);
                  }}
                >
                  {item.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Shield className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
          <p className="text-xs text-slate-500">모든 재고가 정상 범위입니다.</p>
        </div>
      )}
    </div>
  );
}
