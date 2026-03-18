"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, ClipboardCheck, Package, FlaskConical,
  AlertTriangle, RotateCcw, Trash2, ChevronRight, Clock,
} from "lucide-react";

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

export function InventoryFlowView() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const items = selectedStage ? MOCK_ITEMS[selectedStage] || [] : [];

  return (
    <div className="space-y-6">
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
