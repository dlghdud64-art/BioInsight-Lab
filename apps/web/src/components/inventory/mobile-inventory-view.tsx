"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Sparkles,
  Trash2,
  ShoppingCart,
  FlaskConical,
  Shield,
  Info,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";

// ── Types ──
interface ProductInventory {
  id: string;
  productId: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  minOrderQty: number | null;
  location: string | null;
  expiryDate: string | null;
  notes: string | null;
  lotNumber?: string | null;
  storageCondition?: string | null;
  hazard?: boolean;
  testPurpose?: string | null;
  vendor?: string | null;
  deliveryPeriod?: string | null;
  inUseOrUnopened?: string | null;
  averageExpiry?: string | null;
  autoReorderEnabled?: boolean;
  autoReorderThreshold?: number;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  product: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  };
}

type StatusType = "normal" | "low" | "expiring" | "danger";
type IssueType = "out_of_stock" | "low_stock" | "reorder_lead" | "expiring" | "expired" | "no_location";

interface MobileInventoryViewProps {
  inventories: ProductInventory[];
  onReorder: (inv: ProductInventory) => void;
  onEdit: (inv: ProductInventory) => void;
  onDelete: (inv: ProductInventory) => void;
  onRestock: (inv: ProductInventory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

// ── Helpers ──
const now = new Date();

function isReorderNeededByLeadTime(inv: ProductInventory) {
  const dailyUsage = inv.averageDailyUsage ?? 0;
  const leadTime = inv.leadTimeDays ?? 0;
  if (dailyUsage > 0 && leadTime > 0) {
    return inv.currentQuantity <= dailyUsage * leadTime;
  }
  return false;
}

function getItemStatus(inv: ProductInventory): StatusType {
  if (inv.currentQuantity === 0) return "danger";
  if (inv.expiryDate) {
    const d = new Date(inv.expiryDate);
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "danger";
    if (days <= 30) return "expiring";
  }
  if (inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock) return "low";
  if (isReorderNeededByLeadTime(inv)) return "low";
  return "normal";
}

function classifyIssue(inv: ProductInventory): IssueType {
  if (inv.currentQuantity === 0) return "out_of_stock";
  if (inv.expiryDate) {
    const d = new Date(inv.expiryDate);
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "expired";
    if (days <= 30) return "expiring";
  }
  if (inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock) return "low_stock";
  if (isReorderNeededByLeadTime(inv)) return "reorder_lead";
  if (!inv.location) return "no_location";
  return "low_stock";
}

function getClosestExpiryDate(inv: ProductInventory): string | null {
  if (!inv.expiryDate) return null;
  const d = new Date(inv.expiryDate);
  if (isNaN(d.getTime())) return null;
  return format(d, "yyyy.MM.dd");
}

function getDaysUntilExpiry(inv: ProductInventory): number | null {
  if (!inv.expiryDate) return null;
  const d = new Date(inv.expiryDate);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getRecommendedAction(inv: ProductInventory): { label: string; type: "reorder" | "dispose" | "use_first" | "assign_location" | "none" } {
  const issue = classifyIssue(inv);
  switch (issue) {
    case "out_of_stock":
      return { label: "긴급 재발주 필요", type: "reorder" };
    case "low_stock":
      return { label: "재발주 검토", type: "reorder" };
    case "reorder_lead":
      return { label: "리드타임 기반 재주문", type: "reorder" };
    case "expired":
      return { label: "폐기 검토 필요", type: "dispose" };
    case "expiring":
      return { label: "우선 사용 권장", type: "use_first" };
    case "no_location":
      return { label: "보관 위치 지정", type: "assign_location" };
    default:
      return { label: "", type: "none" };
  }
}

// ── Status badge config ──
const STATUS_CONFIG: Record<StatusType, { label: string; dotCls: string; badgeCls: string }> = {
  normal: {
    label: "정상",
    dotCls: "bg-emerald-400",
    badgeCls: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
  },
  low: {
    label: "부족",
    dotCls: "bg-orange-400",
    badgeCls: "bg-orange-950/40 text-orange-400 border-orange-800/50",
  },
  expiring: {
    label: "임박",
    dotCls: "bg-amber-400",
    badgeCls: "bg-amber-950/40 text-amber-400 border-amber-800/50",
  },
  danger: {
    label: "위험",
    dotCls: "bg-red-400",
    badgeCls: "bg-red-950/40 text-red-400 border-red-800/50",
  },
};

// ════════════════════════════════════════════════
// Mobile Summary Strip
// ════════════════════════════════════════════════
function MobileSummaryStrip({ inventories }: { inventories: ProductInventory[] }) {
  const reorderCount = inventories.filter((inv) => {
    const isOut = inv.currentQuantity === 0;
    const isLow = inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock;
    const byLead = isReorderNeededByLeadTime(inv);
    return isOut || isLow || byLead;
  }).length;

  const expiringCount = inventories.filter((inv) => {
    if (!inv.expiryDate) return false;
    const d = new Date(inv.expiryDate);
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  }).length;

  const disposeCount = inventories.filter((inv) => {
    if (!inv.expiryDate) return false;
    const d = new Date(inv.expiryDate);
    return d.getTime() < now.getTime();
  }).length;

  const issueCount = inventories.filter((inv) => {
    const noLoc = !inv.location;
    const hasHazard = inv.hazard;
    return noLoc || hasHazard;
  }).length;

  const cards = [
    { label: "재주문 필요", count: reorderCount, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShoppingCart },
    { label: "만료 임박", count: expiringCount, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
    { label: "폐기 검토", count: disposeCount, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: Trash2 },
    { label: "점검 이슈", count: issueCount, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", icon: AlertTriangle },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`flex-shrink-0 w-[130px] rounded-xl border ${c.border} bg-el px-3 py-2.5`}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className={`flex h-5 w-5 items-center justify-center rounded-md ${c.bg}`}>
              <c.icon className={`h-2.5 w-2.5 ${c.color}`} />
            </div>
            <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">{c.label}</span>
          </div>
          <div className={`text-xl font-bold tracking-tight ${c.count > 0 ? c.color : "text-slate-600"}`}>
            {c.count}
            <span className="ml-0.5 text-[10px] font-normal text-slate-600">건</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// Mobile Priority Queue (Today's Tasks)
// ════════════════════════════════════════════════
function MobilePriorityQueue({
  inventories,
  onItemTap,
}: {
  inventories: ProductInventory[];
  onItemTap: (inv: ProductInventory) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const urgentItems = useMemo(() => {
    return inventories
      .filter((inv) => {
        const status = getItemStatus(inv);
        return status !== "normal";
      })
      .sort((a, b) => {
        const priority: Record<StatusType, number> = { danger: 0, expiring: 1, low: 2, normal: 3 };
        return priority[getItemStatus(a)] - priority[getItemStatus(b)];
      });
  }, [inventories]);

  if (urgentItems.length === 0) return null;

  const visibleItems = expanded ? urgentItems : urgentItems.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">
          오늘 처리할 재고 작업
          <span className="ml-1.5 text-xs font-normal text-slate-500">{urgentItems.length}건</span>
        </h3>
      </div>
      <div className="space-y-2">
        {visibleItems.map((inv) => {
          const status = getItemStatus(inv);
          const statusCfg = STATUS_CONFIG[status];
          const action = getRecommendedAction(inv);
          const daysLeft = getDaysUntilExpiry(inv);
          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => onItemTap(inv)}
              className="w-full text-left rounded-xl border border-bd bg-pn p-3 active:bg-el transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusCfg.dotCls}`} />
                    <span className="text-sm font-semibold text-slate-900 truncate">{inv.product.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{inv.currentQuantity} {inv.unit}</span>
                    {daysLeft != null && daysLeft <= 30 && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span className={daysLeft <= 0 ? "text-red-400" : "text-amber-400"}>
                          {daysLeft <= 0 ? "만료됨" : `D-${daysLeft}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {action.type !== "none" && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      action.type === "reorder" ? "bg-red-950/30 text-red-400" :
                      action.type === "dispose" ? "bg-orange-950/30 text-orange-400" :
                      action.type === "use_first" ? "bg-amber-950/30 text-amber-400" :
                      "bg-violet-950/30 text-violet-400"
                    }`}>
                      {action.label}
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {urgentItems.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-slate-600 transition-colors"
        >
          {expanded ? "접기" : `더보기 (+${urgentItems.length - 3}건)`}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// Mobile Item Card
// ════════════════════════════════════════════════
function MobileItemCard({
  inv,
  onTap,
}: {
  inv: ProductInventory;
  onTap: () => void;
}) {
  const status = getItemStatus(inv);
  const statusCfg = STATUS_CONFIG[status];
  const expiryDate = getClosestExpiryDate(inv);
  const action = getRecommendedAction(inv);

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left rounded-xl border border-bd bg-pn p-3.5 active:bg-el transition-colors"
    >
      {/* Row 1: Name + Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">
          {inv.product.name}
        </h4>
        <Badge className={`text-[10px] px-1.5 py-0 border shrink-0 ${statusCfg.badgeCls}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotCls}`} />
          {statusCfg.label}
        </Badge>
      </div>

      {/* Row 2: Quantity + Expiry */}
      <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3 text-slate-600" />
          <span className={`font-semibold ${
            status === "danger" ? "text-red-400" :
            status === "low" ? "text-orange-400" :
            "text-slate-700"
          }`}>
            {inv.currentQuantity}
          </span>
          <span>{inv.unit}</span>
          {inv.safetyStock != null && (
            <span className="text-slate-600">/ {inv.safetyStock}</span>
          )}
        </span>
        {expiryDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-600" />
            <span className={(() => {
              const d = getDaysUntilExpiry(inv);
              if (d != null && d <= 0) return "text-red-400";
              if (d != null && d <= 30) return "text-amber-400";
              return "text-slate-400";
            })()}>
              {expiryDate}
            </span>
          </span>
        )}
      </div>

      {/* Row 3: Recommended action */}
      {action.type !== "none" && (
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium ${
            action.type === "reorder" ? "text-red-400/80" :
            action.type === "dispose" ? "text-orange-400/80" :
            action.type === "use_first" ? "text-amber-400/80" :
            "text-violet-400/80"
          }`}>
            {action.label}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
        </div>
      )}
      {action.type === "none" && (
        <div className="flex items-center justify-end">
          <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
        </div>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════
// Mobile Detail Sheet (Bottom)
// ════════════════════════════════════════════════
function MobileDetailSheet({
  inv,
  open,
  onClose,
  onReorder,
  onEdit,
}: {
  inv: ProductInventory | null;
  open: boolean;
  onClose: () => void;
  onReorder: (inv: ProductInventory) => void;
  onEdit: (inv: ProductInventory) => void;
}) {
  if (!inv) return null;

  const status = getItemStatus(inv);
  const statusCfg = STATUS_CONFIG[status];
  const daysLeft = getDaysUntilExpiry(inv);
  const action = getRecommendedAction(inv);

  const getReasonText = (inv: ProductInventory): string => {
    const issue = classifyIssue(inv);
    switch (issue) {
      case "out_of_stock":
        return "재고가 0이므로 즉시 재발주가 필요합니다.";
      case "low_stock":
        return `현재 재고(${inv.currentQuantity})가 안전재고(${inv.safetyStock}) 이하입니다.`;
      case "reorder_lead":
        return `일평균 사용량(${inv.averageDailyUsage}) x 리드타임(${inv.leadTimeDays}일) 기준, 재주문 시점입니다.`;
      case "expired":
        return "유효기간이 만료되었습니다. 폐기 절차를 검토하세요.";
      case "expiring":
        return `유효기간이 ${daysLeft}일 남았습니다. 우선 사용하거나 재발주를 검토하세요.`;
      case "no_location":
        return "보관 위치가 지정되지 않았습니다. 추적 관리를 위해 위치를 지정하세요.";
      default:
        return "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl bg-pg border-t border-bd max-h-[85vh] overflow-y-auto px-5 pb-8"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-10 h-1 rounded-full bg-st" />
        </div>

        <SheetHeader className="mb-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-[10px] px-1.5 py-0 border ${statusCfg.badgeCls}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotCls}`} />
              {statusCfg.label}
            </Badge>
            {daysLeft != null && daysLeft <= 30 && (
              <Badge className={`text-[10px] px-1.5 py-0 border-none ${
                daysLeft <= 0 ? "bg-red-950/40 text-red-400" : "bg-amber-950/40 text-amber-400"
              }`}>
                {daysLeft <= 0 ? "만료됨" : `D-${daysLeft}`}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg font-bold text-slate-900 leading-snug">
            {inv.product.name}
          </SheetTitle>
          {inv.product.brand && (
            <p className="text-xs text-slate-500 mt-0.5">
              {inv.product.brand}
              {inv.product.catalogNumber && ` | ${inv.product.catalogNumber}`}
            </p>
          )}
        </SheetHeader>

        <div className="space-y-4">
          {/* Lot Info */}
          <section className="rounded-xl border border-bd bg-pn p-3.5">
            <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3" />
              Lot 정보
            </h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-slate-600">Lot #</span>
                <p className="font-mono font-medium text-slate-600 mt-0.5">{inv.lotNumber || "-"}</p>
              </div>
              <div>
                <span className="text-slate-600">수량</span>
                <p className="font-medium text-slate-600 mt-0.5">
                  <span className={
                    status === "danger" ? "text-red-400" :
                    status === "low" ? "text-orange-400" :
                    "text-slate-700"
                  }>{inv.currentQuantity}</span> {inv.unit}
                  {inv.safetyStock != null && <span className="text-slate-600 ml-1">/ 안전 {inv.safetyStock}</span>}
                </p>
              </div>
              <div>
                <span className="text-slate-600">유효기간</span>
                <p className="font-medium text-slate-600 mt-0.5">
                  {inv.expiryDate ? format(new Date(inv.expiryDate), "yyyy.MM.dd") : "-"}
                </p>
              </div>
              <div>
                <span className="text-slate-600">상태</span>
                <p className="font-medium text-slate-600 mt-0.5">{inv.inUseOrUnopened || "-"}</p>
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="rounded-xl border border-bd bg-pn p-3.5">
            <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              위치
            </h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-slate-600">보관 위치</span>
                <p className="font-medium text-slate-600 mt-0.5">{inv.location || "미지정"}</p>
              </div>
              <div>
                <span className="text-slate-600">보관 조건</span>
                <p className="font-medium text-slate-600 mt-0.5">
                  {inv.storageCondition ? getStorageConditionLabel(inv.storageCondition) : "-"}
                </p>
              </div>
            </div>
          </section>

          {/* Purchase Link */}
          <section className="rounded-xl border border-bd bg-pn p-3.5">
            <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3" />
              구매 연결
            </h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-slate-600">공급사</span>
                <p className="font-medium text-slate-600 mt-0.5">{inv.vendor || "-"}</p>
              </div>
              <div>
                <span className="text-slate-600">납기</span>
                <p className="font-medium text-slate-600 mt-0.5">{inv.deliveryPeriod || "-"}</p>
              </div>
              <div>
                <span className="text-slate-600">최소 주문</span>
                <p className="font-medium text-slate-600 mt-0.5">{inv.minOrderQty ?? "-"} {inv.minOrderQty ? inv.unit : ""}</p>
              </div>
              <div>
                <span className="text-slate-600">용도</span>
                <p className="font-medium text-slate-600 mt-0.5 line-clamp-1">{inv.testPurpose || "-"}</p>
              </div>
            </div>
          </section>

          {/* Safety Info */}
          <section className="rounded-xl border border-bd bg-pn p-3.5">
            <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              안전 정보
            </h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-slate-600">위험물</span>
                <p className="font-medium mt-0.5">
                  {inv.hazard ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> 해당
                    </span>
                  ) : (
                    <span className="text-slate-400">비해당</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-slate-600">자동 재주문</span>
                <p className="font-medium text-slate-600 mt-0.5">
                  {inv.autoReorderEnabled ? "활성화" : "비활성화"}
                </p>
              </div>
            </div>
            {inv.notes && (
              <div className="mt-2.5 pt-2.5 border-t border-bd text-xs">
                <span className="text-slate-600">메모</span>
                <p className="text-slate-400 mt-0.5 leading-relaxed">{inv.notes}</p>
              </div>
            )}
          </section>

          {/* Recommended Action + Reasoning */}
          {action.type !== "none" && (
            <section className={`rounded-xl border p-3.5 ${
              action.type === "reorder" ? "border-red-500/20 bg-red-950/10" :
              action.type === "dispose" ? "border-orange-500/20 bg-orange-950/10" :
              action.type === "use_first" ? "border-amber-500/20 bg-amber-950/10" :
              "border-violet-500/20 bg-violet-950/10"
            }`}>
              <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                권장 액션
              </h5>
              <p className={`text-sm font-semibold mb-1 ${
                action.type === "reorder" ? "text-red-400" :
                action.type === "dispose" ? "text-orange-400" :
                action.type === "use_first" ? "text-amber-400" :
                "text-violet-400"
              }`}>
                {action.label}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0 text-slate-600" />
                {getReasonText(inv)}
              </p>
            </section>
          )}

          {/* Action Button */}
          <div className="pt-1">
            {(action.type === "reorder" || action.type === "use_first") && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm font-semibold"
                onClick={() => {
                  onReorder(inv);
                  onClose();
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI 재발주 검토
              </Button>
            )}
            {action.type === "dispose" && (
              <Button
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-950/20 h-11 text-sm font-semibold"
                onClick={() => onClose()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                폐기 절차 시작
              </Button>
            )}
            {action.type === "assign_location" && (
              <Button
                variant="outline"
                className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-950/20 h-11 text-sm font-semibold"
                onClick={() => {
                  onEdit(inv);
                  onClose();
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                위치 지정하기
              </Button>
            )}
            {action.type === "none" && (
              <Button
                variant="outline"
                className="w-full border-bd text-slate-400 hover:bg-el h-11 text-sm"
                onClick={() => {
                  onEdit(inv);
                  onClose();
                }}
              >
                정보 수정
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ════════════════════════════════════════════════
// Main Export: MobileInventoryView
// ════════════════════════════════════════════════
export function MobileInventoryView({
  inventories,
  onReorder,
  onEdit,
  onDelete,
  onRestock,
  searchQuery,
  onSearchChange,
}: MobileInventoryViewProps) {
  const [detailItem, setDetailItem] = useState<ProductInventory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (inv: ProductInventory) => {
    setDetailItem(inv);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return inventories;
    const q = searchQuery.toLowerCase().trim();
    return inventories.filter((inv) => {
      const name = (inv.product?.name ?? "").toLowerCase();
      const brand = (inv.product?.brand ?? "").toLowerCase();
      const cat = (inv.product?.catalogNumber ?? "").toLowerCase();
      const lot = (inv.lotNumber ?? "").toLowerCase();
      const vendor = (inv.vendor ?? "").toLowerCase();
      return name.includes(q) || brand.includes(q) || cat.includes(q) || lot.includes(q) || vendor.includes(q);
    });
  }, [inventories, searchQuery]);

  return (
    <div className="space-y-5">
      {/* 1. Summary Strip */}
      <MobileSummaryStrip inventories={inventories} />

      {/* 2. Priority Queue */}
      <MobilePriorityQueue inventories={inventories} onItemTap={openDetail} />

      {/* 3. Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="품목명, 제조사, Lot..."
          className="w-full h-10 rounded-xl border border-bd bg-pn px-4 text-sm text-slate-700 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>

      {/* 4. Item Cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Package className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">
              {searchQuery.trim() ? "검색 결과가 없습니다" : "등록된 재고가 없습니다"}
            </p>
          </div>
        ) : (
          filtered.map((inv) => (
            <MobileItemCard key={inv.id} inv={inv} onTap={() => openDetail(inv)} />
          ))
        )}
      </div>

      {/* 5. Detail Bottom Sheet */}
      <MobileDetailSheet
        inv={detailItem}
        open={detailOpen}
        onClose={closeDetail}
        onReorder={onReorder}
        onEdit={onEdit}
      />
    </div>
  );
}
