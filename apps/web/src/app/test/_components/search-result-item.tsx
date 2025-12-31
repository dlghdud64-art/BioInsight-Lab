"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import { ShoppingCart, GitCompare, Thermometer, AlertTriangle, Shield, Package, Box, Heart, Calendar, Clock } from "lucide-react";

interface SearchResultItemProps {
  product: any;
  isInCompare: boolean;
  onToggleCompare: () => void;
  onAddToQuote: () => void;
  onClick?: () => void;
}

// 납기 표시 (확실하지 않은 정보는 표시하지 않음)
function LeadTimeDisplay({ leadTime }: { leadTime?: number | string }) {
  // 확실하지 않은 정보는 표시하지 않음
  // 납기일은 항상 "견적 시 안내"로 표시
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <Calendar className="h-3.5 w-3.5 text-gray-400" />
      <span>견적 시 안내</span>
    </div>
  );
}

// 핵심 스펙 추출 (용량, 보관 조건 등)
function getKeySpecs(product: any) {
  const specs: { icon: any; label: string; value: string }[] = [];
  
  if (product.specification) {
    specs.push({ icon: Box, label: "용량", value: product.specification.substring(0, 30) });
  }
  
  if (product.storageCondition) {
    specs.push({ icon: Thermometer, label: "보관", value: product.storageCondition });
  } else if (product.grade) {
    specs.push({ icon: Package, label: "Grade", value: product.grade });
  }

  return specs.slice(0, 3); // 최대 3개만 표시
}

export function SearchResultItem({
  product,
  isInCompare,
  onToggleCompare,
  onAddToQuote,
  onClick,
}: SearchResultItemProps) {
  const vendor = product.vendors?.[0];
  // 가격이 null이거나 0이면 표시하지 않음
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const keySpecs = getKeySpecs(product);

  return (
    <div
      className="bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-100 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group cursor-pointer"
      onClick={onClick}
    >
      {/* 수직 스택 레이아웃 */}
      <div className="p-4 space-y-3">
        {/* 제품명 */}
        <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>

        {/* 브랜드/캣넘버 */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {product.vendors?.[0]?.vendor?.name && (
            <>
              <span>{product.vendors[0].vendor.name}</span>
              {product.catalogNumber && <span>·</span>}
            </>
          )}
          {product.catalogNumber && (
            <span className="font-mono">Cat. {product.catalogNumber}</span>
          )}
        </div>

        {/* 스펙 배지 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {keySpecs.length > 0 && keySpecs.map((spec, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border-0 font-normal"
            >
              {spec.value}
            </Badge>
          ))}
          {product.category && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
            </Badge>
          )}
        </div>

        {/* 가격 & 액션 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* 가격 */}
          <div>
            {unitPrice && unitPrice > 0 ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-blue-600">
                    <PriceDisplay price={unitPrice} currency="KRW" />
                  </span>
                  <span className="text-xs text-gray-400 font-normal">(VAT 별도)</span>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-500">가격 문의</div>
            )}
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* 비교함 담기 */}
            <Button
              variant="outline"
              size="sm"
              className={`bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded h-9 w-9 p-0 ${isInCompare ? "bg-blue-50 border-blue-200 text-blue-600" : ""}`}
              onClick={onToggleCompare}
            >
              <GitCompare className="h-4 w-4" />
            </Button>

            {/* 견적 요청 */}
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all rounded h-9 py-2 px-4 text-sm"
              onClick={onAddToQuote}
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              견적 담기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
