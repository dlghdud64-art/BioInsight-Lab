"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import {
  GitCompare,
  Thermometer,
  Package,
  Box,
  FlaskConical,
  FileText,
  ChevronRight,
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

/** 핵심 스펙 추출 */
function getKeySpecs(product: any) {
  const specs: { label: string; value: string }[] = [];
  if (product.specification) {
    specs.push({ label: "용량", value: product.specification.substring(0, 24) });
  }
  if (product.storageCondition) {
    specs.push({ label: "보관", value: product.storageCondition });
  } else if (product.grade) {
    specs.push({ label: "Grade", value: product.grade });
  }
  return specs.slice(0, 3);
}

/**
 * SourcingResultRow — 소싱 워크벤치용 dense row.
 *
 * 3-line info hierarchy:
 * - Line 1: 제품명 (max 2줄) + 가격 (우측)
 * - Line 2: 공급사 · Cat. 번호
 * - Line 3: spec/pack tags (controlled wrap)
 *
 * 모든 토글은 reversible (add-only 금지)
 */
export function SourcingResultRow({
  product,
  isInCompare,
  isInRequest,
  isSelected,
  onToggleCompare,
  onToggleRequest,
  onSelect,
  compareSessionCount,
}: SourcingResultRowProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const keySpecs = getKeySpecs(product);
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const vendorName = vendor?.vendor?.name;

  return (
    <div
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer
        ${isSelected
          ? "bg-blue-600/10 border-blue-600/40 border-l-2 border-l-blue-500"
          : "bg-pn border-bd hover:bg-el hover:border-bd"
        }
      `}
      onClick={onSelect}
    >
      {/* 1. 썸네일 — 40×40 compact */}
      <div className="w-10 h-10 shrink-0 rounded border border-bd bg-el overflow-hidden flex items-center justify-center">
        {!imgError ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FlaskConical className="h-5 w-5 text-slate-500" />
        )}
      </div>

      {/* 2. 정보 블록 — 3-line hierarchy */}
      <div className="flex-1 min-w-0">
        {/* Line 1: 제품명 (max 2줄) */}
        <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-tight">
          {product.name}
        </p>
        {/* Line 2: 공급사 · Cat. 번호 */}
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 min-w-0">
          {vendorName && <span className="truncate max-w-[140px]">{vendorName}</span>}
          {vendorName && product.catalogNumber && <span className="text-slate-600">·</span>}
          {product.catalogNumber && (
            <span className="font-mono text-slate-500 truncate max-w-[120px]">Cat. {product.catalogNumber}</span>
          )}
        </div>
        {/* Line 3: spec/pack tags (controlled wrap) */}
        {keySpecs.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {keySpecs.map((spec, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 bg-el text-slate-500 border-bd font-normal"
              >
                {spec.value}
              </Badge>
            ))}
            {product.category && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-bd text-slate-500 font-normal hidden sm:inline-flex"
              >
                {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* 3. Status markers */}
      <div className="shrink-0 hidden sm:flex items-center gap-1">
        {isInCompare && (
          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400 font-medium">
            <GitCompare className="h-2.5 w-2.5" />비교
          </span>
        )}
        {isInRequest && (
          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-400 font-medium">
            <FileText className="h-2.5 w-2.5" />견적
          </span>
        )}
      </div>

      {/* 4. 가격 */}
      <div className="shrink-0 text-right mr-1 hidden sm:block">
        {unitPrice ? (
          <span className="text-sm font-semibold tabular-nums text-slate-100 whitespace-nowrap">
            <PriceDisplay price={unitPrice} currency="KRW" />
          </span>
        ) : (
          <span className="text-xs text-slate-500">가격 문의</span>
        )}
      </div>

      {/* 5. CTA — reversible toggles, stop propagation */}
      <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* 비교 토글 — reversible */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 rounded ${
            isInCompare
              ? "bg-blue-600/15 text-blue-400 hover:bg-blue-600/25"
              : "text-slate-500 hover:text-slate-300 hover:bg-el"
          }`}
          onClick={onToggleCompare}
          title={isInCompare ? "비교 해제" : "비교 담기"}
        >
          <GitCompare className="h-3.5 w-3.5" />
        </Button>

        {/* 견적 토글 — reversible (담기 ↔ 해제) */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 px-2 rounded text-xs font-medium ${
            isInRequest
              ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25"
              : "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300"
          }`}
          onClick={onToggleRequest}
          title={isInRequest ? "견적 해제" : "견적 담기"}
        >
          <FileText className="h-3 w-3 mr-1" />
          {isInRequest ? "담김" : "견적"}
        </Button>
      </div>

      {/* 6. Rail indicator */}
      <ChevronRight
        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
          isSelected ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400"
        }`}
      />
    </div>
  );
}
