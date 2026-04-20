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
  critical: { label: "긴급", dot: "bg-red-500", bg: "bg-red-50 text-red-600 border-red-200" },
  high:     { label: "높음", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-600 border-amber-200" },
  medium:   { label: "보통", dot: "bg-blue-500", bg: "bg-blue-50 text-blue-600 border-blue-200" },
  low:      { label: "낮음", dot: "bg-slate-400", bg: "bg-slate-50 text-slate-500 border-slate-200" },
};

const CATEGORY_CONFIG: Record<QueueCategory, { label: string; icon: React.ElementType; color: string }> = {
  expiring_soon:    { label: "만료 임박",       icon: Calendar,     color: "text-red-500" },
  disposal_review:  { label: "폐기 처리",       icon: Trash2,       color: "text-red-500" },
  reorder_priority: { label: "재주문 우선",     icon: ShoppingCart,  color: "text-amber-500" },
  no_location:      { label: "위치 미지정",     icon: MapPin,        color: "text-blue-500" },
  label_reprint:    { label: "라벨 재출력",     icon: Printer,       color: "text-violet-500" },
  receiving_pending:{ label: "입고 미정리",     icon: PackageCheck,  color: "text-emerald-500" },
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
      recommendedAction: "우선 사용 또는 폐기 처리",
      actionLabel: "폐기 처리",
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
      actionLabel: "폐기 처리",
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

  // 정렬: risk 우선, 동일 risk 내에서 category 우선순위 적용
  // ontology 우선순위: 만료 lot 폐기 > MSDS > 보관 > 점검 > 재주문
  const riskOrder: QueueRiskLevel[] = ["critical", "high", "medium", "low"];
  const categoryOrder: QueueCategory[] = [
    "expiring_soon",     // 1순위: 만료 lot 폐기 처리
    "disposal_review",   // 2순위: 폐기 처리
    "receiving_pending", // 3순위: 입고 미정리
    "no_location",       // 4순위: 위치 미지정 (보관 조건 불일치)
    "reorder_priority",  // 5순위: 재주문 (만료 lot 해결 후)
    "label_reprint",     // 6순위: 라벨
  ];
  const sorted = [...filtered].sort((a, b) => {
    const riskDiff = riskOrder.indexOf(a.risk) - riskOrder.indexOf(b.risk);
    if (riskDiff !== 0) return riskDiff;
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
  });

  // Top priority item for banner
  const topItem = sorted[0] ?? null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <Flame className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-[13px] font-extrabold text-slate-900">
              우선 처리 큐
            </h3>
            <p className="text-[10px] font-medium text-slate-400">
              ontology 우선순위 · {queueItems.length}건 대기
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-500 text-[10px] px-2 py-0.5 font-bold"
        >
          <Clock className="h-3 w-3 mr-1" />
          실시간
        </Badge>
      </div>

      {/* Category filter pills */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
            selectedCategory === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {cfg.label} {count}
            </button>
          );
        })}
      </div>

      {/* Queue items */}
      <div className="divide-y divide-slate-100">
        {sorted.map((item) => {
          const riskCfg = RISK_CONFIG[item.risk];
          const catCfg = CATEGORY_CONFIG[item.category];
          const CatIcon = catCfg.icon;

          return (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
              onClick={() => onItemClick?.(item)}
            >
              {/* Line 1: Risk dot + Product + Risk badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full shrink-0 ${riskCfg.dot}`} />
                <span className="text-[13px] font-bold text-slate-900 truncate flex-1">
                  {item.productName}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border shrink-0 font-bold ${riskCfg.bg}`}
                >
                  {riskCfg.label}
                </Badge>
              </div>

              {/* Line 2: 상태 + 리스크 1줄 + lot (축약) */}
              <div className="flex items-center gap-1.5 ml-4 text-[11px]">
                <CatIcon className={`h-3 w-3 shrink-0 ${catCfg.color}`} />
                <span className={`font-bold ${catCfg.color}`}>{catCfg.label}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 truncate">{item.reason}</span>
                {item.lotNumber && (
                  <span className="text-slate-400 font-mono shrink-0 hidden sm:inline">Lot {item.lotNumber}</span>
                )}
              </div>

              {/* Line 3: 권장 액션 + CTA */}
              <div className="flex items-center justify-between mt-1.5 ml-4">
                <span className="text-[10px] text-slate-400">
                  권장: <span className="text-slate-500 font-bold">{item.recommendedAction}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 font-bold"
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
          <Shield className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">모든 재고가 정상 범위입니다.</p>
        </div>
      )}
    </div>
  );
}
