"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import {
  GitCompare, FlaskConical, FileText, ChevronRight,
  Clock, CheckCircle2, AlertTriangle,
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

/** 납기 표기 — naked number 금지 */
function formatLeadTime(raw: any): { label: string; color: string } {
  if (!raw) return { label: "납기 미확인", color: "text-slate-500 bg-el" };
  const num = parseInt(raw);
  if (isNaN(num)) return { label: `납기 ${raw}`, color: "text-slate-400 bg-el" };
  if (num <= 3) return { label: `리드타임 ${num}영업일 · 빠름`, color: "text-emerald-400 bg-emerald-400/10" };
  if (num <= 7) return { label: `리드타임 ${num}영업일 · 보통`, color: "text-slate-300 bg-el" };
  return { label: `리드타임 ${num}영업일 · 지연 가능`, color: "text-amber-400 bg-amber-400/10" };
}

/** 운영 신호 추출 */
function getOpSignals(product: any, vendor: any) {
  const signals: { label: string; color: string }[] = [];
  signals.push(formatLeadTime(vendor?.leadTime));
  if (product.grade) signals.push({ label: product.grade, color: "text-slate-300 bg-el" });
  if (product.specification) signals.push({ label: product.specification.substring(0, 20), color: "text-slate-400 bg-el" });
  return signals.slice(0, 3);
}

/** Decision layer — 판단 요약 1줄 */
function getDecisionSummary(product: any, vendor: any, unitPrice: number | null): string {
  const parts: string[] = [];
  // 적합성
  if (product.grade) parts.push("현재 조건 적합");
  // 납기
  const lt = vendor?.leadTime ? parseInt(vendor.leadTime) : null;
  if (lt && lt <= 3) parts.push(`리드타임 ${lt}영업일`);
  else if (lt && lt <= 7) parts.push(`리드타임 ${lt}영업일`);
  else if (lt && lt > 7) parts.push(`납기 지연 가능`);
  else parts.push("납기 확인 필요");
  // 가격
  if (unitPrice && unitPrice > 0) {
    if (unitPrice < 50000) parts.push("가격 우수");
    else if (unitPrice < 200000) parts.push("가격 보통");
    else parts.push("가격 높음");
  } else {
    parts.push("견적 요청 권장");
  }
  // 추천
  if (!unitPrice || (lt && lt > 7)) parts.push("비교 후 요청 권장");
  else parts.push("비교 권장");
  return parts.slice(0, 3).join(" · ");
}

export function SourcingResultRow({
  product, isInCompare, isInRequest, isSelected,
  onToggleCompare, onToggleRequest, onSelect, compareSessionCount,
}: SourcingResultRowProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const vendorName = vendor?.vendor?.name;
  const opSignals = getOpSignals(product, vendor);
  const decisionSummary = getDecisionSummary(product, vendor, unitPrice);

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

        {/* Identity + Spec block */}
        <div className="flex-1 min-w-0">
          {/* Line 1: name */}
          <p className="text-sm font-semibold text-slate-100 line-clamp-1 leading-tight">{product.name}</p>
          {/* Line 2: vendor · catalog */}
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 min-w-0">
            {vendorName && <span className="truncate max-w-[120px]">{vendorName}</span>}
            {vendorName && product.catalogNumber && <span className="text-slate-600">·</span>}
            {product.catalogNumber && <span className="font-mono text-slate-500 truncate max-w-[100px]">Cat. {product.catalogNumber}</span>}
            {product.category && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}</span>
              </>
            )}
          </div>
          {/* Line 3: operating signals */}
          {opSignals.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {opSignals.map((sig, idx) => (
                <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sig.color}`}>{sig.label}</span>
              ))}
            </div>
          )}
          {/* Decision layer — 1줄 판단 요약 */}
          <p className="text-[10px] text-slate-500 mt-1 hidden sm:block leading-tight">{decisionSummary}</p>
        </div>

        {/* Center: price + lead time — desktop */}
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
          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />{formatLeadTime(vendor?.leadTime).label.split(" · ")[0]}
          </span>
        </div>

        {/* Desktop CTA */}
        <div className="shrink-0 hidden sm:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* 1순위: 비교 추가 — primary row action */}
          <Button variant="ghost" size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${isInCompare ? "bg-blue-600/15 text-blue-400 hover:bg-blue-600/25" : "text-slate-300 hover:text-blue-400 hover:bg-blue-600/10 border border-bd hover:border-blue-600/30"}`}
            onClick={onToggleCompare}>
            <GitCompare className="h-3 w-3 mr-1" />{isInCompare ? "비교 담김" : "비교 추가"}
          </Button>
          {/* 2순위: 견적 담기 — secondary, 더 약하게 */}
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
