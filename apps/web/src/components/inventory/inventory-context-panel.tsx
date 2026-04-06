"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  AlertTriangle,
  Calendar,
  MapPin,
  Package,
  FileText,
  ShoppingCart,
  Trash2,
  ArrowLeftRight,
  Printer,
  Shield,
  Clock,
  Truck,
  Sparkles,
  ChevronRight,
  Info,
  ExternalLink,
  FlaskConical,
  Thermometer,
  History,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

/* ── Types ── */
export interface ContextPanelItem {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  category?: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  location?: string | null;
  storageCondition?: string | null;
  hazard?: boolean;
  testPurpose?: string | null;
  vendor?: string | null;
  deliveryPeriod?: string | null;
  inUseOrUnopened?: string | null;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  notes?: string | null;
}

export interface ContextLotInfo {
  lotNumber: string;
  quantity: number;
  receivedDate: string;
  expiryDate: string | null;
  location: string | null;
  status: "active" | "expiring" | "expired" | "depleted";
}

export interface ContextRisk {
  type: "expiring" | "reorder" | "below_safety" | "location_issue" | "label_issue" | "storage_issue";
  severity: "critical" | "high" | "medium" | "low";
  label: string;
  detail: string;
}

export interface ContextConnectedFlow {
  type: "purchase" | "quote" | "incoming" | "delay" | "sds";
  label: string;
  detail: string;
  date?: string;
  link?: string;
}

export interface RecommendedAction {
  type: "reorder" | "dispose" | "relocate" | "label" | "inspect" | "use_first";
  label: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
}

/* ── Mock data generators ── */
function generateMockLots(item: ContextPanelItem): ContextLotInfo[] {
  const lots: ContextLotInfo[] = [];
  if (item.lotNumber) {
    const isExpiring = item.expiryDate
      ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000) <= 7
      : false;
    lots.push({
      lotNumber: item.lotNumber,
      quantity: Math.max(1, Math.floor(item.currentQuantity * 0.6)),
      receivedDate: "2025-11-15",
      expiryDate: item.expiryDate || null,
      location: item.location || null,
      status: isExpiring ? "expiring" : "active",
    });
  }
  // Add a second mock lot
  lots.push({
    lotNumber: item.lotNumber ? `${item.lotNumber.slice(0, -1)}Z` : "25A01-M",
    quantity: Math.max(1, item.currentQuantity - (lots[0]?.quantity ?? 0)),
    receivedDate: "2026-01-20",
    expiryDate: null,
    location: item.location || null,
    status: "active",
  });
  return lots;
}

function generateMockRisks(item: ContextPanelItem): ContextRisk[] {
  const risks: ContextRisk[] = [];
  const now = Date.now();

  if (item.expiryDate) {
    const days = Math.ceil((new Date(item.expiryDate).getTime() - now) / 86400000);
    if (days <= 0) {
      risks.push({
        type: "expiring",
        severity: "critical",
        label: "유효기간 만료",
        detail: `만료일 ${format(new Date(item.expiryDate), "yyyy.MM.dd")} (${Math.abs(days)}일 경과)`,
      });
    } else if (days <= 7) {
      risks.push({
        type: "expiring",
        severity: "critical",
        label: "만료 임박",
        detail: `D-${days} (${format(new Date(item.expiryDate), "yyyy.MM.dd")})`,
      });
    } else if (days <= 30) {
      risks.push({
        type: "expiring",
        severity: "high",
        label: "만료 주의",
        detail: `D-${days} (${format(new Date(item.expiryDate), "yyyy.MM.dd")})`,
      });
    }
  }

  if (item.safetyStock !== null && item.currentQuantity <= item.safetyStock) {
    risks.push({
      type: "below_safety",
      severity: item.currentQuantity === 0 ? "critical" : "high",
      label: "안전재고 미만",
      detail: `현재 ${item.currentQuantity} ${item.unit} / 기준 ${item.safetyStock} ${item.unit}`,
    });
  }

  if (item.averageDailyUsage && item.averageDailyUsage > 0) {
    const daysLeft = item.currentQuantity / item.averageDailyUsage;
    if (daysLeft <= (item.leadTimeDays ?? 14)) {
      risks.push({
        type: "reorder",
        severity: daysLeft <= 3 ? "critical" : "high",
        label: "재주문 필요",
        detail: `현재 사용 속도 기준 ${Math.ceil(daysLeft)}일 내 소진 예상`,
      });
    }
  }

  if (!item.location) {
    risks.push({
      type: "location_issue",
      severity: "medium",
      label: "위치 미지정",
      detail: "보관 위치가 등록되지 않음",
    });
  }

  if (item.storageCondition && item.storageCondition.includes("freezer") && !item.location) {
    risks.push({
      type: "storage_issue",
      severity: "high",
      label: "보관 조건 불일치",
      detail: "냉동 보관 필요 품목, 위치 확인 필요",
    });
  }

  return risks;
}

function generateMockConnectedFlows(item: ContextPanelItem): ContextConnectedFlow[] {
  const flows: ContextConnectedFlow[] = [];

  flows.push({
    type: "purchase",
    label: "최근 구매",
    detail: `${item.vendor || "공급사 미지정"} · ${item.currentQuantity * 2} ${item.unit}`,
    date: "2026-02-15",
  });

  if (item.safetyStock !== null && item.currentQuantity <= item.safetyStock) {
    flows.push({
      type: "incoming",
      label: "입고 예정",
      detail: `발주 진행 중 · 예상 ${item.deliveryPeriod || "2주"}`,
      date: "2026-03-25",
    });
  }

  if (item.leadTimeDays && item.leadTimeDays >= 21) {
    flows.push({
      type: "delay",
      label: "공급 리드타임",
      detail: `평균 ${item.leadTimeDays}일 소요 · 긴급 발주 시 추가 비용`,
    });
  }

  if (item.hazard) {
    flows.push({
      type: "sds",
      label: "안전 정보",
      detail: "SDS 문서 확인 필요 · PPE 착용 의무",
    });
  }

  return flows;
}

function generateMockActions(item: ContextPanelItem): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (item.averageDailyUsage && item.averageDailyUsage > 0) {
    const daysLeft = item.currentQuantity / item.averageDailyUsage;
    if (daysLeft <= (item.leadTimeDays ?? 14)) {
      actions.push({
        type: "reorder",
        label: "재주문 검토",
        reasoning: `재주문: 최근 14일 사용속도 기준 ${Math.ceil(daysLeft)}일 내 소진 — 리드타임(${item.leadTimeDays ?? 14}일) 감안 시 즉시 발주 권장`,
        priority: "high",
      });
    }
  }

  if (item.expiryDate) {
    const days = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 7 && days > 0) {
      actions.push({
        type: "dispose",
        label: "폐기 검토",
        reasoning: `폐기: 만료 D-${days} / 미개봉 ${Math.max(1, Math.floor(item.currentQuantity * 0.3))}ea — lot ${item.lotNumber || "N/A"} 유효기한 임박으로 폐기 또는 긴급 소진 필요`,
        priority: "high",
      });
      actions.push({
        type: "use_first",
        label: "우선 사용 권장",
        reasoning: `만료 임박 lot 우선 소진으로 폐기 손실 최소화 — FEFO(First-Expiry-First-Out) 원칙 적용`,
        priority: "medium",
      });
    } else if (days <= 0) {
      actions.push({
        type: "dispose",
        label: "즉시 폐기",
        reasoning: `폐기: 유효기간 만료 ${Math.abs(days)}일 경과, 사용 불가 — 규정 상 즉시 폐기 처리 필수`,
        priority: "high",
      });
    }
  }

  if (!item.location && item.storageCondition) {
    actions.push({
      type: "relocate",
      label: "위치 이동/등록",
      reasoning: `위치 이동: ${item.storageCondition.includes("freezer") ? "냉동" : item.storageCondition.includes("fridge") ? "냉장" : "상온"} 보관 조건 불일치 — 현재 위치 미지정으로 품질 저하 위험`,
      priority: "medium",
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: "inspect",
      label: "정기 점검",
      reasoning: "특이사항 없음. 다음 정기 점검 시 상태 확인 권장",
      priority: "low",
    });
  }

  return actions;
}

/* ── Mock recent transactions ── */
interface RecentTransaction {
  type: "in" | "out" | "dispose";
  label: string;
  detail: string;
  date: string;
}

function generateMockTransactions(item: ContextPanelItem): RecentTransaction[] {
  const txs: RecentTransaction[] = [];
  txs.push({
    type: "in",
    label: "입고",
    detail: `${item.vendor || "공급사"} · ${Math.ceil(item.currentQuantity * 0.4)} ${item.unit}`,
    date: "3/25",
  });
  txs.push({
    type: "out",
    label: "출고 (실험 사용)",
    detail: `${item.testPurpose || "일반 실험"} · 2 ${item.unit}`,
    date: "3/27",
  });
  if (item.expiryDate) {
    const days = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) {
      txs.push({
        type: "dispose",
        label: "폐기 처리",
        detail: `만료 lot ${item.lotNumber || "N/A"} · 1 ${item.unit}`,
        date: "3/28",
      });
    }
  }
  txs.push({
    type: "out",
    label: "출고 (이동)",
    detail: `${item.location || "선반"} → 실험실 B`,
    date: "3/29",
  });
  return txs.slice(0, 4);
}

/* ── Severity badge styling ── */
const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-pg0/15 text-slate-400 border-slate-500/30",
};

const LOT_STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  expiring: "bg-amber-500/15 text-amber-400",
  expired: "bg-red-500/15 text-red-400",
  depleted: "bg-pg0/15 text-slate-400",
};

const LOT_STATUS_LABEL: Record<string, string> = {
  active: "정상",
  expiring: "임박",
  expired: "만료",
  depleted: "소진",
};

const FLOW_ICON: Record<string, React.ElementType> = {
  purchase: ShoppingCart,
  quote: FileText,
  incoming: Truck,
  delay: Clock,
  sds: Shield,
};

const ACTION_PRIORITY_STYLE: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-500",
};

/* ── Component ── */
interface InventoryContextPanelProps {
  item: ContextPanelItem;
  isOpen: boolean;
  onClose: () => void;
  onReorder?: (item: ContextPanelItem) => void;
  onEdit?: (item: ContextPanelItem) => void;
  onDispose?: (item: ContextPanelItem) => void;
  /** Lot 전체 추적 surface로 drill-down 진입 */
  onLotDrillDown?: () => void;
  className?: string;
}

export function InventoryContextPanel({
  item,
  isOpen,
  onClose,
  onReorder,
  onEdit,
  onDispose,
  onLotDrillDown,
  className = "",
}: InventoryContextPanelProps) {
  const lots = generateMockLots(item);
  const risks = generateMockRisks(item);
  const flows = generateMockConnectedFlows(item);
  const actions = generateMockActions(item);

  if (!isOpen) return null;

  return (
    <div
      className={`w-[420px] shrink-0 border-l border-bd bg-el overflow-y-auto h-full ${className}`}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-el border-b border-bd px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {item.hazard && (
                <Badge className="border-none bg-red-500/15 text-red-400 text-[10px] px-1.5 py-0">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  유해물질
                </Badge>
              )}
              {risks.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${SEVERITY_STYLE[risks[0].severity]}`}
                >
                  {risks.length}건 리스크
                </Badge>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
              {item.productName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>{item.brand || "-"}</span>
              <span className="text-slate-700">|</span>
              <span className="font-mono">{item.catalogNumber || "-"}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-600 hover:bg-slate-700/50 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* ── A. Basic Info ── */}
        <section>
          <SectionHeader icon={Package} label="기본 정보" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5">
            <InfoRow label="현재 수량">
              <span
                className={`font-bold ${
                  item.currentQuantity === 0
                    ? "text-red-400"
                    : item.safetyStock !== null && item.currentQuantity <= item.safetyStock
                      ? "text-amber-400"
                      : "text-slate-700"
                }`}
              >
                {item.currentQuantity}
              </span>
              <span className="text-slate-500 ml-0.5">{item.unit}</span>
            </InfoRow>
            <InfoRow label="안전재고">
              {item.safetyStock !== null ? (
                <span className="text-slate-600">{item.safetyStock} {item.unit}</span>
              ) : (
                <span className="text-slate-600">미설정</span>
              )}
            </InfoRow>
            <InfoRow label="카테고리">
              <span className="text-slate-600">{item.category || "시약"}</span>
            </InfoRow>
            <InfoRow label="보관 조건">
              <span className="text-slate-600 flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-slate-500" />
                {formatStorageCondition(item.storageCondition)}
              </span>
            </InfoRow>
            <InfoRow label="위치">
              {item.location ? (
                <span className="text-slate-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  {item.location}
                </span>
              ) : (
                <span className="text-amber-400 text-[11px]">미지정</span>
              )}
            </InfoRow>
            <InfoRow label="시험항목">
              <span className="text-slate-600 text-[11px]">{item.testPurpose || "-"}</span>
            </InfoRow>
          </div>
        </section>

        {/* ── B. Lot Info ── */}
        <section>
          <SectionHeader icon={FlaskConical} label="Lot 정보" />
          <div className="mt-2.5 space-y-2">
            {lots.map((lot) => (
              <div
                key={lot.lotNumber}
                className="rounded-lg border border-bd bg-pn px-3 py-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-600">
                    {lot.lotNumber}
                  </span>
                  <Badge className={`text-[10px] px-1.5 py-0 border-none ${LOT_STATUS_STYLE[lot.status]}`}>
                    {LOT_STATUS_LABEL[lot.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">수량</span>
                    <span className="text-slate-400">{lot.quantity} {item.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">입고일</span>
                    <span className="text-slate-400">{format(new Date(lot.receivedDate), "yyyy.MM.dd")}</span>
                  </div>
                  {lot.expiryDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">유효기한</span>
                      <span className={`${lot.status === "expiring" || lot.status === "expired" ? "text-red-400 font-medium" : "text-slate-400"}`}>
                        {format(new Date(lot.expiryDate), "yyyy.MM.dd")}
                      </span>
                    </div>
                  )}
                  {lot.location && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">위치</span>
                      <span className="text-slate-400">{lot.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Lot drill-down entry */}
            {onLotDrillDown && (
              <button
                type="button"
                onClick={onLotDrillDown}
                className="w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg border border-bd bg-pn hover:bg-el transition-colors group"
              >
                <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-600">
                  Lot 전체 추적 보기
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
              </button>
            )}
          </div>
        </section>

        {/* ── C. Operational Risk ── */}
        {risks.length > 0 && (
          <section>
            <SectionHeader icon={AlertTriangle} label="운영 리스크" count={risks.length} />
            <div className="mt-2.5 space-y-2">
              {risks.map((risk, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-bd bg-pn px-3 py-2.5"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${SEVERITY_STYLE[risk.severity]}`}
                  >
                    {risk.severity === "critical" ? "긴급" : risk.severity === "high" ? "높음" : risk.severity === "medium" ? "보통" : "낮음"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{risk.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{risk.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── D. Connected Flow ── */}
        <section>
          <SectionHeader icon={History} label="연결된 흐름" />
          <div className="mt-2.5 space-y-2">
            {flows.map((flow, idx) => {
              const FlowIcon = FLOW_ICON[flow.type] || Info;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-bd bg-pn px-3 py-2.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-el shrink-0 mt-0.5">
                    <FlowIcon className="h-3 w-3 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">{flow.label}</p>
                      {flow.date && (
                        <span className="text-[10px] text-slate-600">{flow.date}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{flow.detail}</p>
                  </div>
                  {flow.link && (
                    <ExternalLink className="h-3 w-3 text-slate-600 hover:text-slate-400 shrink-0 mt-1 cursor-pointer" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── E. Recent Transactions ── */}
        <section>
          <SectionHeader icon={ArrowRight} label="최근 입출고" />
          <div className="mt-2.5 space-y-1.5">
            {generateMockTransactions(item).map((tx, idx) => (
              <div key={idx} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-bd bg-pn">
                <div className={`flex h-5 w-5 items-center justify-center rounded ${
                  tx.type === "in" ? "bg-emerald-500/15" : tx.type === "out" ? "bg-amber-500/15" : "bg-red-500/15"
                }`}>
                  <span className={`text-[9px] font-bold ${
                    tx.type === "in" ? "text-emerald-400" : tx.type === "out" ? "text-amber-400" : "text-red-400"
                  }`}>{tx.type === "in" ? "입" : tx.type === "out" ? "출" : "폐"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-medium">{tx.label}</span>
                    <span className="text-[10px] text-slate-600">{tx.date}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{tx.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── F. Consumption & Lead Time Rationale ── */}
        {item.averageDailyUsage && item.averageDailyUsage > 0 && (
          <section>
            <SectionHeader icon={Info} label="소진 예측 근거" />
            <div className="mt-2.5 rounded-lg border border-bd bg-pn px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">일평균 사용량</span>
                <span className="text-slate-600 font-medium">{item.averageDailyUsage} {item.unit}/일</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">예상 소진일</span>
                <span className={`font-medium ${
                  (item.currentQuantity / item.averageDailyUsage) <= (item.leadTimeDays ?? 14) ? "text-red-400" : "text-slate-600"
                }`}>{Math.ceil(item.currentQuantity / item.averageDailyUsage)}일 후</span>
              </div>
              {item.leadTimeDays && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">공급 리드타임</span>
                  <span className="text-slate-600 font-medium">{item.leadTimeDays}일</span>
                </div>
              )}
              {item.leadTimeDays && item.averageDailyUsage > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-bd/40">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {(() => {
                      const daysLeft = item.currentQuantity / item.averageDailyUsage;
                      if (daysLeft <= item.leadTimeDays) {
                        return `최근 14일 사용속도 기준 ${Math.ceil(daysLeft)}일 내 소진 예상 — 리드타임(${item.leadTimeDays}일) 감안 시 즉시 발주 권장`;
                      }
                      return `현재 사용 속도 유지 시 ${Math.ceil(daysLeft)}일 여유 — 리드타임 내 안전`;
                    })()}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── G. Recommended Actions ── */}
        <section>
          <SectionHeader icon={Sparkles} label="권장 액션 + 추천 이유" />
          <div className="mt-2.5 space-y-2">
            {actions.map((action, idx) => (
              <div
                key={idx}
                className={`rounded-lg border border-bd bg-pn px-3 py-2.5 border-l-2 ${ACTION_PRIORITY_STYLE[action.priority]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-700">{action.label}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-0.5"
                    onClick={() => {
                      if (action.type === "reorder") onReorder?.(item);
                      else if (action.type === "dispose") onDispose?.(item);
                      else onEdit?.(item);
                    }}
                  >
                    실행
                    <ChevronRight className="h-2.5 w-2.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1">
                  <Info className="h-3 w-3 shrink-0 mt-px text-slate-600" />
                  <span>
                    <span className="font-medium text-slate-400">추천 이유:</span>{" "}
                    {action.reasoning}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── H. Last Modified / Audit ── */}
        <section>
          <SectionHeader icon={History} label="최근 수정 이력" />
          <div className="mt-2.5 rounded-lg border border-bd bg-pn px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">마지막 수정</span>
              <span className="text-slate-400">2026-03-28 14:22</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">수정자</span>
              <span className="text-slate-600">김연구원</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">변경 내용</span>
              <span className="text-slate-400">수량 조정 5→3</span>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky footer actions — state-based primary action */}
      <div className="sticky bottom-0 bg-el border-t border-bd px-5 py-3">
        {(() => {
          // 상태별 primary action 차등 노출
          const isLow = item.safetyStock !== null && item.currentQuantity <= item.safetyStock;
          const isExpiring = item.expiryDate ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000) <= 7 : false;
          const isExpired = item.expiryDate ? new Date(item.expiryDate).getTime() < Date.now() : false;
          const isOut = item.currentQuantity === 0;

          if (isExpired) {
            return (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-bd bg-pn text-slate-600" onClick={() => onEdit?.(item)}>정보 수정</Button>
                <Button size="sm" className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-500 text-white font-medium" onClick={() => onDispose?.(item)}>
                  <AlertTriangle className="h-3 w-3 mr-1" />폐기 검토
                </Button>
              </div>
            );
          }
          if (isExpiring) {
            return (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-bd bg-pn text-slate-600" onClick={() => onDispose?.(item)}>폐기/검토</Button>
                <Button size="sm" className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium" onClick={() => onReorder?.(item)}>
                  <Sparkles className="h-3 w-3 mr-1" />재주문 + 교체
                </Button>
              </div>
            );
          }
          if (isOut || isLow) {
            return (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-bd bg-pn text-slate-600" onClick={() => onEdit?.(item)}>정보 수정</Button>
                <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={() => onReorder?.(item)}>
                  <ShoppingCart className="h-3 w-3 mr-1" />재주문
                </Button>
              </div>
            );
          }
          // 정상
          return (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-bd bg-pn text-slate-600" onClick={() => onEdit?.(item)}>정보 수정</Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-bd bg-pn text-slate-600" onClick={() => onReorder?.(item)}>
                <Sparkles className="h-3 w-3 mr-1" />재발주 검토
              </Button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Sub-components ── */
function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</h4>
      {count !== undefined && (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 border-bs text-slate-500"
        >
          {count}
        </Badge>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[11px] text-slate-600 shrink-0">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}

function formatStorageCondition(condition: string | null | undefined): string {
  if (!condition) return "미지정";
  const map: Record<string, string> = {
    freezer_20: "-20°C 냉동",
    freezer_80: "-80°C 초저온",
    fridge: "2-8°C 냉장",
    room_temp_std: "상온",
    room_temp_dark: "상온/차광",
  };
  return map[condition] || condition;
}
