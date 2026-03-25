"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import {
  GitCompare, FlaskConical, FileText, ChevronRight,
  AlertTriangle,
} from "lucide-react";

interface SourcingResultRowProps {
  product: any;
  isInCompare: boolean;
  isInRequest: boolean;
  isSelected: boolean;
  onToggleCompare: () => void;
  onToggleRequest: () => void;
  onSelect: () => void;
  compareSessionCount?: number;
}

// ── 3행: 동적 운영 신호 ──────────────────────────────────────────────────

type ChipColor = "green" | "amber" | "blue" | "neutral";

interface OpSignal {
  label: string;
  color: ChipColor;
}

/**
 * Compact operational chip 색상 맵
 * green  = 진행 가능 / 유리 (재고 확보, 비교 적합, 바로 요청 가능)
 * amber  = 확인 필요 / 위험 (현행 확인 필요, 견적 필요, 재고 확인 필요, 가격 검토 필요)
 * blue   = 다음 행동 추천 (비교 권장, 요청 전환 권장)
 * neutral = 상태 정보 (N영업일, 재고 가능)
 */
const CHIP_STYLES: Record<ChipColor, string> = {
  green: "text-emerald-400 bg-emerald-400/8 border-emerald-400/20",
  amber: "text-amber-400 bg-amber-400/8 border-amber-400/20",
  blue: "text-blue-400 bg-blue-400/8 border-blue-400/20",
  neutral: "text-slate-300 bg-slate-400/8 border-slate-400/15",
};

function buildOperatingSignals(product: any, vendor: any, unitPrice: number | null): OpSignal[] {
  const signals: OpSignal[] = [];
  const lt = vendor?.leadTime;

  // ── 1순위: 납기/견적 ──
  if (!lt) {
    if (!unitPrice || unitPrice <= 0) {
      signals.push({ label: "견적 필요", color: "amber" });
    } else {
      signals.push({ label: "납기 확인 필요", color: "amber" });
    }
  } else {
    const str = String(lt).trim().toLowerCase();
    if (str === "즉시" || str === "즉시 출고" || str === "in stock" || str === "0") {
      signals.push({ label: "즉시 출고", color: "green" });
    } else {
      const num = parseInt(str);
      if (!isNaN(num)) {
        signals.push({ label: `${num}영업일`, color: "neutral" });
      } else {
        signals.push({ label: "납기 확인 필요", color: "amber" });
      }
    }
  }

  // ── 2순위: 재고/가격/확인 필요 ──
  const hasStock = product.stockStatus === "in_stock" || product.inStock === true;
  const stockAvailable = product.stockStatus === "available" || product.stockAvailable === true;
  const lowStock = product.stockStatus === "low" || product.lowStock === true;

  if (hasStock) {
    signals.push({ label: "재고 확보", color: "green" });
  } else if (stockAvailable) {
    signals.push({ label: "재고 가능", color: "neutral" });
  } else if (lowStock) {
    signals.push({ label: "재고 부족", color: "amber" });
  } else if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "재고 확인 필요", color: "amber" });
  } else if (unitPrice > 100000) {
    signals.push({ label: "가격 검토 필요", color: "amber" });
  } else {
    const ltNum = lt ? parseInt(String(lt)) : NaN;
    if (!isNaN(ltNum) && ltNum > 7) {
      signals.push({ label: "현행 확인 필요", color: "amber" });
    } else {
      signals.push({ label: "재고 확인 필요", color: "amber" });
    }
  }

  // ── 3순위: 행동 방향 ──
  if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "요청 전환 권장", color: "blue" });
  } else {
    const isEquipment = product.category === "EQUIPMENT";
    const ltNum = lt ? parseInt(String(lt)) : NaN;
    const highPrice = unitPrice > 100000;
    if (isEquipment || highPrice || (!isNaN(ltNum) && ltNum > 7 && product.category !== "REAGENT")) {
      signals.push({ label: "비교 권장", color: "blue" });
    } else {
      signals.push({ label: "비교 적합", color: "green" });
    }
  }

  return signals.slice(0, 3);
}

// ── 2행: 정적 메타 ──────────────────────────────────────────────────────

function buildStaticMeta(product: any, vendor: any): string {
  const parts: string[] = [];
  const brand = product.brand || vendor?.vendor?.name;
  if (brand) parts.push(brand);
  if (product.catalogNumber) parts.push(`Cat. ${product.catalogNumber}`);
  if (product.category) {
    const label = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES];
    if (label) parts.push(label);
  }
  if (product.specification) {
    parts.push(product.specification.substring(0, 30));
  } else if (product.grade) {
    parts.push(product.grade);
  }
  return parts.join(" · ");
}

// ── Row 상태 스타일 ─────────────────────────────────────────────────────
// 우선순위: selected > membership(compare/request) > hover > default

function getRowStyle(isSelected: boolean, isInCompare: boolean, isInRequest: boolean): string {
  if (isSelected) {
    // 가장 강한 상태: filled surface + stronger border + left accent
    return "bg-[#2a2d32] border-slate-500/50 border-l-2 border-l-blue-500 hover:bg-[#2a2d32]";
  }
  if (isInCompare) {
    // compare membership: 약한 blue tint
    return "bg-blue-600/[0.04] border-blue-600/[0.12] hover:bg-blue-600/[0.07]";
  }
  if (isInRequest) {
    // request membership: 약한 indigo tint (compare와 구분)
    return "bg-indigo-600/[0.04] border-indigo-600/[0.12] hover:bg-indigo-600/[0.07]";
  }
  // default + hover
  return "bg-transparent border-transparent hover:bg-white/[0.03]";
}

// ── Component ────────────────────────────────────────────────────────────

export function SourcingResultRow({
  product, isInCompare, isInRequest, isSelected,
  onToggleCompare, onToggleRequest, onSelect,
}: SourcingResultRowProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const staticMeta = buildStaticMeta(product, vendor);
  const opSignals = buildOperatingSignals(product, vendor, unitPrice);
  const rowStyle = getRowStyle(isSelected, isInCompare, isInRequest);

  return (
    <div
      className={`group relative rounded-lg border transition-all duration-150 cursor-pointer ${rowStyle}`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Thumbnail */}
        <div className="w-10 h-10 shrink-0 rounded border border-bd bg-el overflow-hidden flex items-center justify-center mt-0.5">
          {!imgError ? (
            <img src={imageSrc} alt={product.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <FlaskConical className="h-5 w-5 text-slate-500" />
          )}
        </div>

        {/* 3-tier content */}
        <div className="flex-1 min-w-0">
          {/* 1행: 제품명 */}
          <p className="text-sm font-semibold text-slate-100 line-clamp-1 leading-tight">{product.name}</p>

          {/* 2행: 정적 메타 — slate, 11px, medium */}
          {staticMeta && (
            <p className="text-[11px] font-medium text-slate-400 mt-1 line-clamp-1 leading-tight">{staticMeta}</p>
          )}

          {/* 3행: 동적 운영 신호 — compact operational chips */}
          {opSignals.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden">
              {opSignals.map((sig, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center shrink-0 border rounded-full font-semibold leading-5 ${CHIP_STYLES[sig.color]}`}
                  style={{ fontSize: "11px", height: "20px", paddingLeft: "8px", paddingRight: "8px" }}
                >
                  {sig.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price column — desktop */}
        <div className="shrink-0 hidden md:flex flex-col items-end gap-0.5 mr-1">
          {unitPrice ? (
            <span className="text-sm font-semibold tabular-nums text-slate-200 whitespace-nowrap">
              <PriceDisplay price={unitPrice} currency="KRW" />
            </span>
          ) : (
            <span className="text-xs text-amber-400 flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" />견적 필요
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            {isInRequest ? "견적 후보" : isInCompare ? "비교 후보" : unitPrice ? "VAT 별도" : ""}
          </span>
        </div>

        {/* Desktop CTA */}
        <div className="shrink-0 hidden sm:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${
              isInCompare
                ? "bg-blue-600/15 text-blue-400 hover:bg-blue-600/25"
                : "text-slate-300 hover:text-blue-400 hover:bg-blue-600/10 border border-bd hover:border-blue-600/30"
            }`}
            onClick={onToggleCompare}>
            <GitCompare className="h-3 w-3 mr-1" />{isInCompare ? "비교 후보" : "비교 추가"}
          </Button>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2 rounded text-xs font-medium ${
              isInRequest
                ? "bg-indigo-600/15 text-indigo-400 hover:bg-indigo-600/25"
                : "text-slate-500 hover:text-slate-300 hover:bg-el"
            }`}
            onClick={onToggleRequest}>
            <FileText className="h-3 w-3 mr-1" />{isInRequest ? "견적 후보" : "견적"}
          </Button>
        </div>

        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-colors hidden sm:block mt-1 ${isSelected ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400"}`} />
      </div>

      {/* Mobile bottom: price + CTA */}
      <div className="flex items-center justify-between px-3 pb-2 pt-0 sm:hidden" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs">
          {unitPrice ? (
            <span className="font-semibold tabular-nums text-slate-100"><PriceDisplay price={unitPrice} currency="KRW" /></span>
          ) : (
            <span className="text-amber-400 text-[10px]">견적 필요</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${isInCompare ? "bg-blue-600/15 text-blue-400" : "text-slate-400 border border-bd"}`}
            onClick={onToggleCompare}>
            <GitCompare className="h-3 w-3 mr-1" />{isInCompare ? "비교 후보" : "비교 추가"}
          </Button>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${isInRequest ? "bg-indigo-600/15 text-indigo-400" : "text-slate-500 border border-bd"}`}
            onClick={onToggleRequest}>
            <FileText className="h-3 w-3 mr-1" />{isInRequest ? "견적 후보" : "견적 담기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
