"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  MapPin,
  Package,
  Sparkles,
  Loader2,
  Trash2,
  ShoppingCart,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";
// §11.374 P3.3 #mobile-surface-unify — 재고 모바일 상태요약 2x2 정합.

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
  /** §inventory-mobile-reorder-gate P2 — 추천 쿼리 로딩 중 상세 시트 CTA 로딩 상태(침묵 no-op 방지). */
  reorderRecoLoading?: boolean;
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

/* §11.251d — 카드 안 배지용 짧은 라벨 매핑. 호영님 spec "긴급/검토" 같은
   짧은 라벨 축약 정합. 상세 권장 액션 섹션 (line 624) 은 기존 긴 label 유지. */
function getRecommendedAction(inv: ProductInventory): { label: string; shortLabel: string; type: "reorder" | "dispose" | "use_first" | "assign_location" | "none" } {
  const issue = classifyIssue(inv);
  switch (issue) {
    case "out_of_stock":
      return { label: "긴급 재발주 필요", shortLabel: "긴급", type: "reorder" };
    case "low_stock":
      return { label: "재발주 검토", shortLabel: "검토", type: "reorder" };
    case "reorder_lead":
      return { label: "리드타임 기반 재주문", shortLabel: "재주문", type: "reorder" };
    case "expired":
      return { label: "폐기 검토 필요", shortLabel: "폐기", type: "dispose" };
    case "expiring":
      return { label: "우선 사용 권장", shortLabel: "임박", type: "use_first" };
    case "no_location":
      return { label: "보관 위치 지정", shortLabel: "위치", type: "assign_location" };
    default:
      return { label: "", shortLabel: "", type: "none" };
  }
}

// ── Status badge config ──
// §11.283d #status-config-traffic-light — 호영님 P0+ 보고 (위험/부족/정상/검토
//   카드 색상 옅은 베이지 잔존): §11.283c-2 sweep 가 색상명만 amber→yellow
//   바꿨고 dark mode `/40` opacity 패턴 (bg-yellow-900/40) 그대로 잔존 → 호영님
//   spec light mode 신호등 (bg-[#fdf3ec] text-[#b45821]) 정합 swap.
// §11.283e #lot-strip-badge — lot_issue 색상 분기는 §web-mobile-reskin 에서
//   STATUS_CONFIG.expiring 단일 소스로 통합(별도 shortLabel 색상 ternary 제거).
// §11.302 — expiring 주의색 = muted amber #b45821 (쨍한 yellow 금지, 호영님 2026-06-30).
//   ⚠ dotCls 는 §web-mobile-reskin 카드 재설계 후 미사용(정의만 보존, 렌더 제거).
// §11.273d #inventory-mobile-badge-contrast — 배지 대비: §web-mobile-reskin 이후
//   긴급도 차별화는 STATUS_CONFIG 신호등(danger=bg-red-600 text-white) + action.type
//   기반 색상(text-red-400 / text-[#b45821])으로 대체. 구 6색 shortLabel 배지·border-l-* 제거.
const STATUS_CONFIG: Record<StatusType, { label: string; dotCls: string; badgeCls: string }> = {
  normal: {
    label: "정상",
    dotCls: "bg-emerald-500",
    badgeCls: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  low: {
    label: "부족",
    dotCls: "bg-red-500",
    badgeCls: "bg-red-100 text-red-700 border-red-200",
  },
  expiring: {
    label: "임박",
    dotCls: "bg-[#b45821]",
    badgeCls: "bg-[#fdf3ec] text-[#b45821] border-[#f3d4bf]",
  },
  danger: {
    label: "위험",
    dotCls: "bg-red-600",
    badgeCls: "bg-red-600 text-white border-red-700",
  },
};

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
        {/* §11.306c — 호영님 옵션 A (2026-05-26): Badge 좌측 dot indicator 제거.
            배지 본체 색상 (statusCfg.badgeCls) 만으로 상태 충분 — 같은 색 dot 은
            대비 부족 (예: danger 의 bg-red-600 dot 이 bg-red-600 배지 안 보임).
            제품명 좌측 단독 dot (line ~306) 은 별도 시각 신호 — 보존. */}
        <Badge className={`text-[10px] px-1.5 py-0 border shrink-0 ${statusCfg.badgeCls}`}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Row 2: Quantity + Expiry */}
      <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3 text-slate-600" />
          <span className={`font-semibold ${
            status === "danger" ? "text-red-400" :
            status === "low" ? "text-red-600" :
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
              if (d != null && d <= 30) return "text-[#b45821]";
              return "text-slate-400";
            })()}>
              {expiryDate}
            </span>
          </span>
        )}
      </div>

      {/* Row 2.5: 안전재고 게이지 (목업 §03) */}
      {inv.safetyStock != null && inv.safetyStock > 0 && (
        <div className="mb-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              status === "danger" || status === "low"
                ? "bg-red-500"
                : status === "expiring"
                  ? "bg-[#b45821]"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, Math.round((inv.currentQuantity / inv.safetyStock) * 100))}%` }}
          />
        </div>
      )}

      {/* Row 3: Recommended action */}
      {action.type !== "none" && (
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium ${
            action.type === "reorder" ? "text-red-400/80" :
            action.type === "dispose" ? "text-red-600/80" :
            action.type === "use_first" ? "text-[#b45821]/80" :
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
  reorderRecoLoading = false,
}: {
  inv: ProductInventory | null;
  open: boolean;
  onClose: () => void;
  onReorder: (inv: ProductInventory) => void;
  onEdit: (inv: ProductInventory) => void;
  reorderRecoLoading?: boolean;
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

  /**
   * §inventory-item-sheet-compact (핸드오프 2026-08-04 · 배치만 채택)
   *
   * 실측(2026-08-19 프로덕션 414px): 값 없는 필드도 전부 행으로 렌더돼 상태·보관 조건·
   *   공급사·납기·용도 5개가 대시(-)로 깔렸고, 유일한 CTA 가 최하단이라 스크롤해야 나왔다.
   *
   * 채택   배치 — 경고+CTA 를 헤더 바로 아래로 · 값 있는 필드만 행 · 미입력은 1줄 접기
   * 미채택 색  — 시안의 yellow 경고 카드. reorder 권장 톤은 blue 유지(sentinel 8건 잠금).
   *            CLAUDE.md §9 가 같은 상태를 L157 yellow / L162 red 로 두 번 규정해
   *            정책 자체가 미해소다. 색 결정은 별도 카드(시트 배치 배치에 끼울 크기가 아님).
   * 미구현 핸드오프 §3 액션 2버튼(QR 스캔 · 상세 보기). 상세 보기 목적지인 품목 브리핑이
   *            데스크톱 전용(InventoryContextPanel)이라 모바일에 없다 — 만들면 dead button.
   */
  const recommendedQty = Math.max(0, (inv.safetyStock ?? 0) - inv.currentQuantity);

  // 값이 있는 필드만 행을 만든다. null/빈 문자열은 아래 "미입력" 접기로 묶는다(대시 금지).
  const rows: Array<{ label: string; value: React.ReactNode }> = [];
  const missing: string[] = [];
  const pushRow = (label: string, raw: unknown, node?: React.ReactNode) => {
    const filled = raw !== null && raw !== undefined && String(raw).trim() !== "";
    if (filled) rows.push({ label, value: node ?? String(raw) });
    else missing.push(label);
  };

  pushRow("상태", inv.inUseOrUnopened);
  pushRow("보관 조건", inv.storageCondition, inv.storageCondition ? getStorageConditionLabel(inv.storageCondition) : undefined);
  pushRow("공급사", inv.vendor);
  pushRow("납기", inv.deliveryPeriod);
  pushRow("용도", inv.testPurpose);
  pushRow("최소 주문", inv.minOrderQty, `${inv.minOrderQty} ${inv.unit}`);
  // 위험물·자동 재주문은 항상 값이 있다(불리언) — 미입력 대상 아님.
  rows.push({
    label: "위험물",
    value: inv.hazard ? (
      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
        <AlertTriangle className="h-3 w-3" /> 해당
      </span>
    ) : (
      <span className="text-slate-500">비해당</span>
    ),
  });
  rows.push({ label: "자동 재주문", value: inv.autoReorderEnabled ? "활성화" : "비활성화" });
  if (inv.notes && inv.notes.trim()) rows.push({ label: "메모", value: inv.notes });

  return (
    <Sheet open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl bg-pg border-t border-bd max-h-[85vh] overflow-y-auto px-5 pb-8"
        /* §inventory-mobile-reorder-gate P4 — scrim이 fixed 헤더를 덮지 않도록 overlay만 오프셋. */
        overlayClassName="!top-14"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-10 h-1 rounded-full bg-st" />
        </div>

        {/* ── 헤더: 품목명 + 상태 pill + 메타 1줄(제조사 · Cat · Lot) ── */}
        <SheetHeader className="mb-3 text-left">
          <div className="flex items-center gap-2 mb-1">
            {/* §11.306c — Sheet header Badge 좌측 dot 제거 (line 395-398 와 정합). */}
            <Badge className={`text-[10px] px-1.5 py-0 border ${statusCfg.badgeCls}`}>
              {statusCfg.label}
            </Badge>
            {daysLeft != null && daysLeft <= 30 && (
              <Badge className={`text-[10px] px-1.5 py-0 border-none ${
                daysLeft <= 0 ? "bg-red-600 text-white" : "bg-[#fdf3ec] text-[#b45821]"
              }`}>
                {daysLeft <= 0 ? "만료됨" : `D-${daysLeft}`}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-[19px] font-extrabold text-slate-900 leading-snug">
            {inv.product.name}
          </SheetTitle>
          {/* 메타는 1줄로 압축 — Lot 은 별도 카드에서 끌어올렸다(값 있을 때만 표기). */}
          <p className="text-xs text-slate-500 mt-0.5">
            {[
              inv.product.brand,
              inv.product.catalogNumber,
              inv.lotNumber ? `Lot ${inv.lotNumber}` : null,
            ]
              .filter((v) => v && String(v).trim() !== "")
              .join(" · ")}
          </p>
        </SheetHeader>

        <div className="space-y-3">
          {/* ── 경고 + CTA: 시트 최상단(스크롤 없이 보이는 자리) ──
              §11.327 톤 유지 — AI 제안 = accent(blue) 카드, 심각도는 rose 도트/숫자로만. */}
          {action.type === "reorder" ? (
            <section className="rounded-[18px] border border-blue-200 bg-blue-50 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11.5px] font-extrabold text-blue-700">
                  <Sparkles className="h-[13px] w-[13px]" />
                  AI 권장
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-rose-700">
                  <span className="h-[7px] w-[7px] rounded-full bg-rose-500" aria-hidden />
                  {inv.currentQuantity === 0 ? "재고 소진" : "안전재고 미달"}
                </span>
              </div>
              <h5 className="text-base font-extrabold text-slate-900 leading-tight mb-1">
                {action.label}
              </h5>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-3">
                {inv.safetyStock != null ? (
                  <>
                    현재 재고 <b className="font-extrabold text-rose-700">{inv.currentQuantity}{inv.unit}</b>가
                    {" "}안전재고 <b className="font-extrabold text-rose-700">{inv.safetyStock}{inv.unit}</b> 이하입니다.
                  </>
                ) : (
                  getReasonText(inv)
                )}
              </p>
              {reorderRecoLoading ? (
                /* §inventory-mobile-reorder-gate P2 — 추천 쿼리 로딩 중 침묵 금지:
                   비활성 로딩 상태 표기, 산출되면 자동 활성(쿼리 완료 시 재렌더). */
                <Button
                  disabled
                  className="w-full bg-blue-300 text-white h-[42px] text-[13.5px] font-bold cursor-wait"
                >
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  추천 수량 계산 중…
                </Button>
              ) : (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-[42px] text-[13.5px] font-bold"
                  onClick={() => {
                    onReorder(inv);
                    onClose();
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {recommendedQty > 0 ? `AI 재발주 검토 · 권장 ${recommendedQty}${inv.unit}` : "AI 재발주 검토"}
                </Button>
              )}
            </section>
          ) : action.type !== "none" ? (
            <section className={`rounded-xl border p-3.5 ${
              action.type === "dispose" ? "border-red-500/20 bg-red-900/10" :
              action.type === "use_first" ? "border-[#f3d4bf] bg-[#fdf3ec]" :
              "border-violet-500/20 bg-violet-950/10"
            }`}>
              <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                권장 액션
              </h5>
              <p className={`text-sm font-semibold mb-1 ${
                action.type === "dispose" ? "text-red-600" :
                action.type === "use_first" ? "text-[#b45821]" :
                "text-violet-400"
              }`}>
                {action.label}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0 text-slate-600" />
                {getReasonText(inv)}
              </p>
            </section>
          ) : null}

          {/* ── 핵심 3수치: 수량 / 유효기간 / 보관 위치 ── */}
          <div className="grid grid-cols-3 gap-px bg-bd border border-bd rounded-xl overflow-hidden">
            <div className="bg-pn px-3 py-2.5">
              <p className="text-[10.5px] text-slate-500">수량</p>
              <p className="text-[15px] font-extrabold mt-0.5">
                <span className={
                  status === "danger" ? "text-red-600" :
                  status === "low" ? "text-red-600" :
                  "text-slate-900"
                }>{inv.currentQuantity}</span>
                {inv.safetyStock != null && (
                  <span className="text-[11px] font-medium text-slate-400">/{inv.safetyStock}</span>
                )}
              </p>
            </div>
            <div className="bg-pn px-3 py-2.5">
              <p className="text-[10.5px] text-slate-500">유효기간</p>
              <p className="text-[13.5px] font-extrabold text-slate-900 mt-0.5">
                {inv.expiryDate ? format(new Date(inv.expiryDate), "yyyy.MM.dd") : "없음"}
              </p>
            </div>
            <div className="bg-pn px-3 py-2.5">
              <p className="text-[10.5px] text-slate-500">보관 위치</p>
              {/* 운영상 의미 있는 공백 — 대시가 아니라 "미지정"으로 정직 표기. */}
              <p className={`text-[13.5px] font-extrabold mt-0.5 ${inv.location ? "text-slate-900" : "text-slate-500"}`}>
                {inv.location || "미지정"}
              </p>
            </div>
          </div>

          {/* ── 값 있는 필드만 컴팩트 행 ── */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-bd bg-pn overflow-hidden">
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex items-start justify-between gap-3 px-3.5 py-2.5 text-xs ${i > 0 ? "border-t border-bd" : ""}`}
                >
                  <span className="text-slate-500 shrink-0">{r.label}</span>
                  <span className="font-medium text-slate-800 text-right break-words">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── 미입력 접기 1줄 — 행을 만들지 않고 건수로만 알린다 ── */}
          {missing.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-bd bg-el px-3.5 py-2.5">
              <p className="text-[11.5px] text-slate-500 min-w-0 truncate">
                미입력 {missing.length}건 · {missing.join(", ")}
              </p>
              <button
                type="button"
                onClick={() => {
                  onEdit(inv);
                  onClose();
                }}
                className="shrink-0 rounded-lg border border-bd bg-pn px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 active:bg-el"
              >
                채우기
              </button>
            </div>
          )}

          {/* ── 액션 행 ──
              핸드오프 §3(QR 스캔 · 상세 보기)은 이번 배치 미구현 — 위 주석 참조. */}
          <div className="pt-1">
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
            {(action.type === "none" || action.type === "use_first") && (
              <Button
                variant="outline"
                className="w-full border-bd text-slate-600 hover:bg-el h-11 text-sm"
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
  reorderRecoLoading = false,
}: MobileInventoryViewProps) {
  const [detailItem, setDetailItem] = useState<ProductInventory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // 목업 §03 — 필터 칩(전체/부족/만료임박/위치미지정). 같은 화면 필터(same-canvas).
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "expiring" | "no_location">("all");

  const openDetail = (inv: ProductInventory) => {
    setDetailItem(inv);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
  };

  const filtered = useMemo(() => {
    let list = inventories;
    if (statusFilter !== "all") {
      list = list.filter((inv) => {
        if (statusFilter === "low") {
          const st = getItemStatus(inv);
          return st === "low" || st === "danger";
        }
        if (statusFilter === "expiring") return getItemStatus(inv) === "expiring";
        if (statusFilter === "no_location") return !inv.location;
        return true;
      });
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((inv) => {
      const name = (inv.product?.name ?? "").toLowerCase();
      const brand = (inv.product?.brand ?? "").toLowerCase();
      const cat = (inv.product?.catalogNumber ?? "").toLowerCase();
      const lot = (inv.lotNumber ?? "").toLowerCase();
      const vendor = (inv.vendor ?? "").toLowerCase();
      return name.includes(q) || brand.includes(q) || cat.includes(q) || lot.includes(q) || vendor.includes(q);
    });
  }, [inventories, searchQuery, statusFilter]);

  const topReorder = useMemo(() => {
    const def = inventories
      .filter((i) => { const s = getItemStatus(i); return s === "low" || s === "danger"; })
      .map((i) => ({ i, gap: (i.safetyStock ?? 0) - i.currentQuantity }))
      .sort((x, y) => y.gap - x.gap);
    return def[0]?.i ?? null;
  }, [inventories]);

  return (
    <div className="space-y-5">
      {/* 1. 재발주 추천 배너 (목업 §03, rose) — 가장 부족한 1건 → onReorder(실 핸들러). */}
      {/* §11.251d #mobile-inventory-ux — 카드 배지 긴 라벨 줄바꿈 차단(truncate). FAB 는
          §307 에서 헤더 inline(relative)로 이전. STATUS_CONFIG 4-status·getRecommendedAction 보존. */}
      {topReorder ? (
        <button
          type="button"
          onClick={() => onReorder(topReorder)}
          className="w-full text-left bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-3 flex items-center gap-3 active:bg-blue-100 transition-colors"
        >
          <span className="flex-none h-9 w-9 rounded-[11px] bg-white border border-blue-200 grid place-items-center text-blue-700">
            <ShoppingCart className="h-[18px] w-[18px]" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-extrabold text-slate-900 truncate">{topReorder.product.name} 재발주 검토 권장</p>
            <p className="text-[12px] text-slate-500">
              현재 <b className="font-extrabold text-rose-700">{topReorder.currentQuantity}{topReorder.unit}</b>
              {topReorder.safetyStock != null ? ` · 안전재고 ${topReorder.safetyStock} 대비 ${Math.max(0, topReorder.safetyStock - topReorder.currentQuantity)} 부족` : ""}
            </p>
          </div>
          <span className="bg-blue-600 text-white text-[12px] font-extrabold px-3 py-1.5 rounded-full shrink-0">재발주</span>
        </button>
      ) : null}

      {/* 2.5 필터 칩 (목업 §03, same-canvas 필터) */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
        {([
          { k: "all", label: "전체" },
          { k: "low", label: "부족", danger: true },
          { k: "expiring", label: "만료 임박" },
          { k: "no_location", label: "위치 미지정" },
        ] as const).map((c) => {
          const on = statusFilter === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setStatusFilter(c.k)}
              aria-pressed={on}
              className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${
                on
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "danger" in c && c.danger
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

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
              {searchQuery.trim() || statusFilter !== "all" ? "조건에 맞는 재고가 없습니다" : "등록된 재고가 없습니다"}
            </p>
            {(searchQuery.trim() || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => { onSearchChange(""); setStatusFilter("all"); }}
                className="mt-3 min-h-[40px] px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600"
              >
                필터 초기화
              </button>
            )}
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
        reorderRecoLoading={reorderRecoLoading}
      />
    </div>
  );
}
