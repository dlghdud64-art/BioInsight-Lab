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
        group relative rounded-lg border transition-all duration-150 cursor-pointer
        ${isSelected
          ? "bg-blue-600/10 border-blue-600/40 border-l-2 border-l-blue-500"
          : "bg-pn border-bd hover:bg-el hover:border-bd"
        }
      `}
      onClick={onSelect}
    >
      {/* Top section: thumbnail + info + price + chevron */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Thumbnail */}
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

        {/* Info block */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-tight">
            {product.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 min-w-0">
            {vendorName && <span className="truncate max-w-[140px]">{vendorName}</span>}
            {vendorName && product.catalogNumber && <span className="text-slate-600">·</span>}
            {product.catalogNumber && (
              <span className="font-mono text-slate-500 truncate max-w-[120px]">Cat. {product.catalogNumber}</span>
            )}
          </div>
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

        {/* Price — desktop */}
        <div className="shrink-0 text-right mr-1 hidden sm:block">
          {unitPrice ? (
            <span className="text-sm font-semibold tabular-nums text-slate-100 whitespace-nowrap">
              <PriceDisplay price={unitPrice} currency="KRW" />
            </span>
          ) : (
            <span className="text-xs text-slate-500">가격 문의</span>
          )}
        </div>

        {/* Desktop CTA — hierarchy: primary=견적, secondary=비교 */}
        <div className="shrink-0 hidden sm:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Secondary: 비교 — text label, not icon-only */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 rounded text-xs font-medium ${
              isInCompare
                ? "bg-blue-600/15 text-blue-400 hover:bg-blue-600/25"
                : "text-slate-500 hover:text-slate-300 hover:bg-el border border-transparent hover:border-bd"
            }`}
            onClick={onToggleCompare}
          >
            <GitCompare className="h-3 w-3 mr-1" />
            {isInCompare ? "비교 담김" : "비교 추가"}
          </Button>
          {/* Primary: 견적 — stronger visual weight */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${
              isInRequest
                ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25"
                : "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300"
            }`}
            onClick={onToggleRequest}
          >
            <FileText className="h-3 w-3 mr-1" />
            {isInRequest ? "견적 담김" : "견적 담기"}
          </Button>
        </div>

        {/* Chevron */}
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-colors hidden sm:block ${
            isSelected ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400"
          }`}
        />
      </div>

      {/* Bottom section — mobile only: price + CTA buttons */}
      <div className="flex items-center justify-between px-3 pb-2 pt-0 sm:hidden" onClick={(e) => e.stopPropagation()}>
        {/* Mobile price */}
        <div className="text-xs">
          {unitPrice ? (
            <span className="font-semibold tabular-nums text-slate-100">
              <PriceDisplay price={unitPrice} currency="KRW" />
            </span>
          ) : (
            <span className="text-slate-500">가격 문의</span>
          )}
        </div>

        {/* Mobile CTA */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${
              isInCompare
                ? "bg-blue-600/15 text-blue-400"
                : "text-slate-400 border border-bd"
            }`}
            onClick={onToggleCompare}
          >
            <GitCompare className="h-3 w-3 mr-1" />
            {isInCompare ? "비교 담김" : "비교 추가"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2.5 rounded text-xs font-medium ${
              isInRequest
                ? "bg-emerald-600/15 text-emerald-400"
                : "bg-blue-600/10 text-blue-400"
            }`}
            onClick={onToggleRequest}
          >
            <FileText className="h-3 w-3 mr-1" />
            {isInRequest ? "견적 담김" : "견적 담기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
