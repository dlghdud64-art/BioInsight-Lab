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

// ── 3행: 동적 운영 신호 생성 ─────────────────────────────────────────────

interface OpSignal {
  label: string;
  color: "green" | "amber" | "blue" | "gray";
}

function buildOperatingSignals(product: any, vendor: any, unitPrice: number | null): OpSignal[] {
  const signals: OpSignal[] = [];

  // ── 1순위: 납기/견적 ──
  const lt = vendor?.leadTime;
  if (!lt) {
    // 납기 데이터 없음
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
        if (num <= 3) signals.push({ label: `${num}영업일`, color: "green" });
        else if (num <= 7) signals.push({ label: `${num}영업일`, color: "gray" });
        else signals.push({ label: `${num}영업일`, color: "amber" });
      } else {
        signals.push({ label: "납기 확인 필요", color: "amber" });
      }
    }
  }

  // ── 2순위: 재고/가격 ──
  const hasStock = product.stockStatus === "in_stock" || product.inStock === true;
  const stockAvailable = product.stockStatus === "available" || product.stockAvailable === true;
  const lowStock = product.stockStatus === "low" || product.lowStock === true;

  if (hasStock) {
    signals.push({ label: "재고 확보", color: "green" });
  } else if (stockAvailable) {
    signals.push({ label: "재고 가능", color: "green" });
  } else if (lowStock) {
    signals.push({ label: "재고 부족", color: "amber" });
  } else if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "재고 확인 필요", color: "amber" });
  } else if (unitPrice > 100000) {
    signals.push({ label: "가격 검토 필요", color: "amber" });
  } else {
    // lead time long + no stock info
    const ltNum = lt ? parseInt(String(lt)) : NaN;
    if (!isNaN(ltNum) && ltNum > 7) {
      signals.push({ label: "현행 확인 필요", color: "amber" });
    } else if (!hasStock && !stockAvailable && !lowStock) {
      signals.push({ label: "재고 확인 필요", color: "amber" });
    }
  }

  // ── 3순위: 행동 방향 ──
  if (!unitPrice || unitPrice <= 0) {
    signals.push({ label: "요청 전환 권장", color: "amber" });
  } else {
    const isEquipment = product.category === "EQUIPMENT";
    const ltNum = lt ? parseInt(String(lt)) : NaN;
    const highPrice = unitPrice > 100000;

    if (isEquipment || highPrice || (!isNaN(ltNum) && ltNum > 7 && product.category !== "REAGENT")) {
      signals.push({ label: "비교 권장", color: "green" });
    } else {
      signals.push({ label: "비교 적합", color: "green" });
    }
  }

  return signals.slice(0, 3);
}

const SIGNAL_COLORS: Record<OpSignal["color"], string> = {
  green: "text-emerald-400 bg-emerald-400/10",
  amber: "text-amber-400 bg-amber-400/10",
  blue: "text-blue-400 bg-blue-400/10",
  gray: "text-slate-300 bg-el",
};

// ── 2행: 정적 메타 조립 ─────────────────────────────────────────────────

function buildStaticMeta(product: any, vendor: any): string {
  const parts: string[] = [];
  // 제조사/브랜드
  const brand = product.brand || vendor?.vendor?.name;
  if (brand) parts.push(brand);
  // Cat No
  if (product.catalogNumber) parts.push(`Cat. ${product.catalogNumber}`);
  // 카테고리
  if (product.category) {
    const label = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES];
    if (label) parts.push(label);
  }
  // 핵심 규격 (1개만, 짧게)
  if (product.specification) {
    const spec = product.specification.substring(0, 30);
    parts.push(spec);
  } else if (product.grade) {
    parts.push(product.grade);
  }
  return parts.join(" · ");
}

// ── Component ────────────────────────────────────────────────────────────

export function SourcingResultRow({
  product, isInCompare, isInRequest, isSelected,
  onToggleCompare, onToggleRequest, onSelect, compareSessionCount,
}: SourcingResultRowProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const staticMeta = buildStaticMeta(product, vendor);
  const opSignals = buildOperatingSignals(product, vendor, unitPrice);

  return (
    <div
      className={`group relative rounded-lg border transition-all duration-150 cursor-pointer ${
        isSelected
          ? "bg-blue-600/10 border-blue-600/40 border-l-2 border-l-blue-500"
          : "bg-pn border-bd hover:bg-el hover:border-bd"
      }`}
      onClick={onSelect}
    >
      {/* Main row */}
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
          {/* 1행: 제품 식별 — 제품명만 크게 */}
          <p className="text-sm font-semibold text-slate-100 line-clamp-1 leading-tight">{product.name}</p>

          {/* 2행: 정적 메타 — 제조사·Cat·카테고리·핵심 규격 */}
          {staticMeta && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 leading-tight">{staticMeta}</p>
          )}

          {/* 3행: 동적 운영 신호 — separate signal line */}
          {opSignals.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {opSignals.map((sig, idx) => (
                <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SIGNAL_COLORS[sig.color]}`}>
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
            {isInRequest ? "선택됨" : isInCompare ? "비교 후보" : unitPrice ? "VAT 별도" : ""}
          </span>
        </div>

        {/* Desktop CTA */}
        <div className="shrink-0 hidden sm:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${isInCompare ? "bg-blue-600/15 text-blue-400 hover:bg-blue-600/25" : "text-slate-300 hover:text-blue-400 hover:bg-blue-600/10 border border-bd hover:border-blue-600/30"}`}
            onClick={onToggleCompare}>
            <GitCompare className="h-3 w-3 mr-1" />{isInCompare ? "비교 담김" : "비교 추가"}
          </Button>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2 rounded text-xs font-medium ${isInRequest ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25" : "text-slate-500 hover:text-slate-300 hover:bg-el"}`}
            onClick={onToggleRequest}>
            <FileText className="h-3 w-3 mr-1" />{isInRequest ? "견적 담김" : "견적"}
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
          <Button variant="ghost" size="sm" className={`h-7 px-2.5 rounded text-xs font-medium ${isInCompare ? "bg-blue-600/15 text-blue-400" : "text-slate-400 border border-bd"}`} onClick={onToggleCompare}>
            <GitCompare className="h-3 w-3 mr-1" />{isInCompare ? "비교 담김" : "비교 추가"}
          </Button>
          <Button variant="ghost" size="sm" className={`h-7 px-2.5 rounded text-xs font-medium ${isInRequest ? "bg-emerald-600/15 text-emerald-400" : "bg-blue-600/10 text-blue-400"}`} onClick={onToggleRequest}>
            <FileText className="h-3 w-3 mr-1" />{isInRequest ? "견적 담김" : "견적 담기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
