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
  onAddToQuote: () => void;
  onSelect: () => void;
  onRequestQuote?: () => void;
  compareSessionCount?: number;
}

/** 핵심 스펙 추출 */
function getKeySpecs(product: any) {
  const specs: { icon: any; label: string; value: string }[] = [];
  if (product.specification) {
    specs.push({ icon: Box, label: "용량", value: product.specification.substring(0, 24) });
  }
  if (product.storageCondition) {
    specs.push({ icon: Thermometer, label: "보관", value: product.storageCondition });
  } else if (product.grade) {
    specs.push({ icon: Package, label: "Grade", value: product.grade });
  }
  return specs.slice(0, 2);
}

/**
 * SourcingResultRow — 소싱 워크벤치용 dense row.
 *
 * 쇼핑 카드가 아닌 운영 워크벤치 행:
 * - 클릭 → right rail open (onSelect)
 * - Primary CTA → center work window (onRequestQuote)
 * - Secondary → compare toggle
 */
export function SourcingResultRow({
  product,
  isInCompare,
  isInRequest,
  isSelected,
  onToggleCompare,
  onAddToQuote,
  onSelect,
  onRequestQuote,
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

      {/* 2. 정보 블록 — flex-1 */}
      <div className="flex-1 min-w-0">
        {/* 제품명 + 벤더/카탈로그 */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-100 truncate leading-tight">
            {product.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 min-w-0">
          {vendorName && <span className="truncate max-w-[120px]">{vendorName}</span>}
          {vendorName && product.catalogNumber && <span className="text-slate-600">·</span>}
          {product.catalogNumber && (
            <span className="font-mono text-slate-500 shrink-0">Cat. {product.catalogNumber}</span>
          )}
          {/* 스펙 뱃지 */}
          {keySpecs.map((spec, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 bg-el text-slate-500 border-bd font-normal hidden sm:inline-flex"
            >
              {spec.value}
            </Badge>
          ))}
          {product.category && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 border-bd text-slate-500 font-normal hidden md:inline-flex"
            >
              {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
            </Badge>
          )}
        </div>
      </div>

      {/* 3. Status markers */}
      <div className="shrink-0 flex items-center gap-1 hidden sm:flex">
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

      {/* 5. Primary CTA — single action, stop propagation */}
      <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* 비교 토글 — secondary (icon only) */}
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

        {/* 견적 담기 — primary CTA (single) */}
        {!isInRequest ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 rounded text-xs font-medium bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300"
            onClick={onAddToQuote}
          >
            <FileText className="h-3 w-3 mr-1" />
            견적
          </Button>
        ) : (
          <span className="text-[10px] text-emerald-400 px-1.5">담김</span>
        )}
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
