"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, ClipboardCheck, Package, FlaskConical,
  AlertTriangle, RotateCcw, Trash2, ChevronRight, Clock,
  TrendingUp, ShoppingCart, Archive, MapPin, Sparkles,
} from "lucide-react";
import {
  type FlowInsight,
  type InventorySnapshot,
  type UsageRecord,
  detectInsights,
  getInsightColor,
} from "@/lib/inventory/flow-insight-engine";

// ── 흐름 단계 정의 ──
interface FlowStage {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  itemCount: number;
  lotCount: number;
  representative: string[];
  elapsed: string;
  needsAttention: boolean;
  nextAction: string;
  nextActionLabel: string;
}

const MOCK_STAGES: FlowStage[] = [
  { id: "incoming", label: "입고 예정", icon: Truck, color: "text-blue-400", itemCount: 3, lotCount: 4, representative: ["Anti-CD3 Ab", "RPMI 1640"], elapsed: "2일 전 발주", needsAttention: false, nextAction: "/dashboard/purchases", nextActionLabel: "발주 확인" },
  { id: "inspection", label: "검수 대기", icon: ClipboardCheck, color: "text-amber-400", itemCount: 2, lotCount: 2, representative: ["50ml Conical Tube", "Pipette Tips"], elapsed: "입고 후 1일", needsAttention: true, nextAction: "/dashboard/inventory", nextActionLabel: "재고 반영" },
  { id: "stocked", label: "재고 반영", icon: Package, color: "text-emerald-400", itemCount: 45, lotCount: 78, representative: ["FBS", "DMEM", "PBS"], elapsed: "-", needsAttention: false, nextAction: "/dashboard/inventory", nextActionLabel: "재고 현황" },
  { id: "in_use", label: "사용 중", icon: FlaskConical, color: "text-cyan-400", itemCount: 12, lotCount: 15, representative: ["Trypsin-EDTA", "FBS"], elapsed: "활성 사용", needsAttention: false, nextAction: "/dashboard/inventory", nextActionLabel: "사용 추이" },
  { id: "low_stock", label: "안전재고 미만", icon: AlertTriangle, color: "text-red-400", itemCount: 3, lotCount: 5, representative: ["FBS", "DMEM Medium"], elapsed: "5일 내 소진", needsAttention: true, nextAction: "/dashboard/inventory?filter=low", nextActionLabel: "재주문 검토" },
  { id: "reorder", label: "재주문 검토", icon: RotateCcw, color: "text-orange-400", itemCount: 2, lotCount: 3, representative: ["Gibco FBS"], elapsed: "검토 필요", needsAttention: true, nextAction: "/dashboard/inventory", nextActionLabel: "발주 생성" },
  { id: "disposal", label: "폐기 검토", icon: Trash2, color: "text-rose-400", itemCount: 1, lotCount: 1, representative: ["DMEM Lot#2024-A12"], elapsed: "만료 D-7", needsAttention: true, nextAction: "/dashboard/inventory", nextActionLabel: "폐기 처리" },
];

// ── 단계별 상세 mock 품목 ──
interface FlowItem {
  name: string;
  lot: string;
  qty: number;
  status: string;
  reason: string;
}

const MOCK_ITEMS: Record<string, FlowItem[]> = {
  incoming: [
    { name: "Anti-CD3 Antibody", lot: "25A-001", qty: 5, status: "발주 완료", reason: "배송 중 — ETA 3/20" },
    { name: "RPMI 1640 Medium", lot: "-", qty: 10, status: "발주 확인", reason: "공급사 확인 대기" },
    { name: "Pipette Tips (1000µl)", lot: "-", qty: 20, status: "발주 완료", reason: "내일 도착 예정" },
  ],
  inspection: [
    { name: "50ml Conical Tube", lot: "25B-100", qty: 100, status: "검수 필요", reason: "입고 완료, 재고 미반영" },
    { name: "Pipette Tips (200µl)", lot: "25B-101", qty: 50, status: "검수 필요", reason: "수량 확인 필요" },
  ],
  low_stock: [
    { name: "FBS (Fetal Bovine Serum)", lot: "24K-015", qty: 1, status: "부족", reason: "안전재고 5 미만, 6일 내 소진 예상" },
    { name: "DMEM Medium", lot: "24L-022", qty: 2, status: "부족", reason: "최근 14일 사용속도 기준 5일 내 소진" },
    { name: "Trypsin-EDTA", lot: "25A-003", qty: 3, status: "주의", reason: "안전재고 5 미만" },
  ],
  reorder: [
    { name: "Gibco FBS (500ml)", lot: "-", qty: 0, status: "재주문 필요", reason: "최근 사용량 기준 즉시 재발주 권장" },
    { name: "DMEM Medium (500ml)", lot: "-", qty: 0, status: "재주문 검토", reason: "2주 내 소진 예상" },
  ],
  disposal: [
    { name: "DMEM Medium", lot: "2024-A12", qty: 2, status: "만료 임박", reason: "D-7 만료, 미개봉 2ea — 폐기 또는 긴급 사용 검토" },
  ],
};

// ── Mock data for AI insights ──
const MOCK_INVENTORIES: InventorySnapshot[] = [
  { id: "inv-1", productName: "FBS (500ml)", currentQuantity: 1, unit: "ea", safetyStock: 5, averageDailyUsage: 0.3, leadTimeDays: 14, expiryDate: null, lotNumber: "24K-015", location: "냉장고 A-2", storageCondition: "2-8°C" },
  { id: "inv-2", productName: "DMEM Medium (500ml)", currentQuantity: 2, unit: "ea", safetyStock: 5, averageDailyUsage: 0.5, leadTimeDays: 7, expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(), lotNumber: "24L-022", location: "냉장고 A-1", storageCondition: "2-8°C" },
  { id: "inv-3", productName: "Trypsin-EDTA", currentQuantity: 3, unit: "ea", safetyStock: 5, averageDailyUsage: 0.2, leadTimeDays: 10, expiryDate: null, lotNumber: "25A-003", location: "냉장고 A-3", storageCondition: "2-8°C" },
  { id: "inv-4", productName: "PBS 10X (500ml)", currentQuantity: 15, unit: "ea", safetyStock: 3, averageDailyUsage: 0.1, leadTimeDays: 5, expiryDate: null, lotNumber: "25B-010", location: null, storageCondition: "RT" },
  { id: "inv-5", productName: "Anti-CD3 Antibody", currentQuantity: 5, unit: "ea", safetyStock: 2, averageDailyUsage: 0, leadTimeDays: 21, expiryDate: null, lotNumber: "25A-001", location: "냉동고 B-1", storageCondition: "-20°C" },
];

const MOCK_USAGE: UsageRecord[] = [
  // Spike: inv-1 heavy recent usage
  { itemId: "inv-1", quantity: 2, date: new Date(Date.now() - 2 * 86400000).toISOString() },
  { itemId: "inv-1", quantity: 1, date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { itemId: "inv-1", quantity: 0.5, date: new Date(Date.now() - 15 * 86400000).toISOString() },
  { itemId: "inv-1", quantity: 0.3, date: new Date(Date.now() - 25 * 86400000).toISOString() },
  // Normal: inv-2
  { itemId: "inv-2", quantity: 0.5, date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { itemId: "inv-2", quantity: 0.5, date: new Date(Date.now() - 10 * 86400000).toISOString() },
  // inv-3 light use
  { itemId: "inv-3", quantity: 0.2, date: new Date(Date.now() - 7 * 86400000).toISOString() },
  // inv-5: no usage (low turnover)
];

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  usage_spike: TrendingUp,
  expiry_priority: Clock,
  reorder_needed: ShoppingCart,
  low_turnover: Archive,
  location_mismatch: MapPin,
  receiving_delay: Truck,
};

export function InventoryFlowView() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const items = selectedStage ? MOCK_ITEMS[selectedStage] || [] : [];

  // AI Insights
  const allInsights = detectInsights(MOCK_INVENTORIES, MOCK_USAGE);
  const visibleInsights = allInsights.filter((i) => !dismissedInsights.has(i.id));

  return (
    <div className="space-y-5">
      {/* ── AI Insight Strip ── */}
      {visibleInsights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6FA2FF" }}>AI 흐름 분석</span>
            <span className="text-[10px]" style={{ color: "#667389" }}>{visibleInsights.length}건 감지</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {visibleInsights.map((insight) => {
              const color = getInsightColor(insight.severity);
              const Icon = INSIGHT_ICONS[insight.type] || AlertTriangle;
              return (
                <div
                  key={insight.id}
                  className="rounded-lg p-3 flex gap-3 items-start group"
                  style={{ backgroundColor: color.bg, border: `1px solid ${color.border}` }}
                >
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: color.text }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold mb-0.5" style={{ color: color.text }}>{insight.title}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#C8D4E5" }}>{insight.reason}</p>
                  </div>
                  <button
                    onClick={() => setDismissedInsights((prev) => new Set([...prev, insight.id]))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300 flex-shrink-0"
                    title="닫기"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 파이프라인 ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-2 min-w-[800px]">
          {MOCK_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const isSelected = selectedStage === stage.id;
            return (
              <div key={stage.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                  className={`flex-shrink-0 w-[110px] rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/30 bg-el"
                      : "border-bd bg-pn hover:bg-el"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`h-3.5 w-3.5 ${stage.color}`} />
                    <span className="text-[10px] font-bold text-slate-300 truncate">{stage.label}</span>
                  </div>
                  <div className="text-lg font-bold text-slate-100">{stage.itemCount}</div>
                  <div className="text-[10px] text-slate-500">{stage.lotCount} lots</div>
                  {stage.needsAttention && (
                    <Badge className="mt-1.5 h-4 px-1 text-[9px] bg-amber-500/10 text-amber-400 border-0">
                      조치 필요
                    </Badge>
                  )}
                  {/* AI micro-insight per stage */}
                  {stage.id === "low_stock" && (
                    <p className="mt-1 text-[9px] leading-tight" style={{ color: "#FBBF24" }}>6일 내 부족 가능</p>
                  )}
                  {stage.id === "reorder" && (
                    <p className="mt-1 text-[9px] leading-tight" style={{ color: "#FB923C" }}>즉시 발주 권장</p>
                  )}
                  {stage.id === "disposal" && (
                    <p className="mt-1 text-[9px] leading-tight" style={{ color: "#F87171" }}>D-7 만료 1건</p>
                  )}
                </button>
                {i < MOCK_STAGES.length - 1 && (
                  <div className="flex items-center px-1">
                    <ChevronRight className="h-3 w-3 text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 선택된 단계 상세 ── */}
      {selectedStage && (
        <div className="rounded-lg border border-bd bg-pn p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {(() => {
                const stage = MOCK_STAGES.find(s => s.id === selectedStage);
                if (!stage) return null;
                const Icon = stage.icon;
                return (
                  <>
                    <Icon className={`h-4 w-4 ${stage.color}`} />
                    <h3 className="text-sm font-bold text-slate-100">{stage.label}</h3>
                    <Badge variant="secondary" className="text-[10px] bg-el">{items.length}건</Badge>
                  </>
                );
              })()}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs border-bs text-slate-400 bg-transparent hover:bg-el">
              {MOCK_STAGES.find(s => s.id === selectedStage)?.nextActionLabel}
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">이 단계에 해당하는 품목이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-el hover:bg-st transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {item.lot !== "-" && `Lot ${item.lot} · `}{item.status}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 요약 ── */}
      {!selectedStage && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "검수 대기", count: 2, color: "text-amber-400", icon: ClipboardCheck },
            { label: "안전재고 미만", count: 3, color: "text-red-400", icon: AlertTriangle },
            { label: "재주문 검토", count: 2, color: "text-orange-400", icon: RotateCcw },
            { label: "폐기 검토", count: 1, color: "text-rose-400", icon: Trash2 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-bd bg-pn p-3 flex items-center gap-3">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <div>
                <p className="text-xs font-medium text-slate-300">{s.label}</p>
                <p className="text-lg font-bold text-slate-100">{s.count}건</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
