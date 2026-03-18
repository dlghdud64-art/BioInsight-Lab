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
        reasoning: `최근 14일 사용속도 기준 ${Math.ceil(daysLeft)}일 내 소진 예상`,
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
        reasoning: `lot ${item.lotNumber || "N/A"} / 만료 D-${days} / 미개봉 ${Math.max(1, Math.floor(item.currentQuantity * 0.3))}ea`,
        priority: "high",
      });
      actions.push({
        type: "use_first",
        label: "우선 사용 권장",
        reasoning: `만료 임박 lot 우선 소진으로 폐기 손실 최소화`,
        priority: "medium",
      });
    } else if (days <= 0) {
      actions.push({
        type: "dispose",
        label: "즉시 폐기",
        reasoning: `유효기간 만료 ${Math.abs(days)}일 경과, 사용 불가`,
        priority: "high",
      });
    }
  }

  if (!item.location && item.storageCondition) {
    actions.push({
      type: "relocate",
      label: "위치 이동/등록",
      reasoning: `${item.storageCondition.includes("freezer") ? "냉동" : item.storageCondition.includes("fridge") ? "냉장" : "상온"} 보관 품목, 현재 위치 미지정`,
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

/* ── Severity badge styling ── */
const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-[#111114]0/15 text-slate-400 border-slate-500/30",
};

const LOT_STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  expiring: "bg-amber-500/15 text-amber-400",
  expired: "bg-red-500/15 text-red-400",
  depleted: "bg-[#111114]0/15 text-slate-400",
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
  className?: string;
}

export function InventoryContextPanel({
  item,
  isOpen,
  onClose,
  onReorder,
  onEdit,
  onDispose,
  className = "",
}: InventoryContextPanelProps) {
  const lots = generateMockLots(item);
  const risks = generateMockRisks(item);
  const flows = generateMockConnectedFlows(item);
  const actions = generateMockActions(item);

  if (!isOpen) return null;

  return (
    <div
      className={`w-[420px] shrink-0 border-l border-[#2a2a2e] bg-[#222226] overflow-y-auto h-full ${className}`}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#222226] border-b border-[#2a2a2e] px-5 py-4">
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
            <h2 className="text-base font-bold text-slate-100 leading-tight truncate">
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
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 shrink-0"
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
                      : "text-slate-200"
                }`}
              >
                {item.currentQuantity}
              </span>
              <span className="text-slate-500 ml-0.5">{item.unit}</span>
            </InfoRow>
            <InfoRow label="안전재고">
              {item.safetyStock !== null ? (
                <span className="text-slate-300">{item.safetyStock} {item.unit}</span>
              ) : (
                <span className="text-slate-600">미설정</span>
              )}
            </InfoRow>
            <InfoRow label="카테고리">
              <span className="text-slate-300">{item.category || "시약"}</span>
            </InfoRow>
            <InfoRow label="보관 조건">
              <span className="text-slate-300 flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-slate-500" />
                {formatStorageCondition(item.storageCondition)}
              </span>
            </InfoRow>
            <InfoRow label="위치">
              {item.location ? (
                <span className="text-slate-300 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  {item.location}
                </span>
              ) : (
                <span className="text-amber-400 text-[11px]">미지정</span>
              )}
            </InfoRow>
            <InfoRow label="시험항목">
              <span className="text-slate-300 text-[11px]">{item.testPurpose || "-"}</span>
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
                className="rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-300">
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
                  className="flex items-start gap-2.5 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-2.5"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${SEVERITY_STYLE[risk.severity]}`}
                  >
                    {risk.severity === "critical" ? "긴급" : risk.severity === "high" ? "높음" : risk.severity === "medium" ? "보통" : "낮음"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">{risk.label}</p>
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
                  className="flex items-start gap-2.5 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-2.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#222226] shrink-0 mt-0.5">
                    <FlowIcon className="h-3 w-3 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-300">{flow.label}</p>
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

        {/* ── E. Recommended Actions ── */}
        <section>
          <SectionHeader icon={Sparkles} label="권장 조치" />
          <div className="mt-2.5 space-y-2">
            {actions.map((action, idx) => (
              <div
                key={idx}
                className={`rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-2.5 border-l-2 ${ACTION_PRIORITY_STYLE[action.priority]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-200">{action.label}</p>
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
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {action.reasoning}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 bg-[#222226] border-t border-[#2a2a2e] px-5 py-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs border-[#2a2a2e] bg-[#1a1a1e] text-slate-300 hover:bg-[#2a2a2e] hover:text-slate-100"
          onClick={() => onEdit?.(item)}
        >
          정보 수정
        </Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white"
          onClick={() => onReorder?.(item)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          재발주 검토
        </Button>
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
          className="text-[9px] px-1 py-0 border-[#333338] text-slate-500"
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
