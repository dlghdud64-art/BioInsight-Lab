"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import { ShoppingCart, GitCompare } from "lucide-react";
import Link from "next/link";

interface SearchResultItemProps {
  product: any;
  isInCompare: boolean;
  onToggleCompare: () => void;
  onAddToQuote: () => void;
  onClick?: () => void;
}

// 재고/납기 상태 배지 컴포넌트
function LeadTimeBadge({ leadTime }: { leadTime?: number | string }) {
  if (!leadTime) return null;

  const days = typeof leadTime === "string" ? parseInt(leadTime) : leadTime;
  
  if (days <= 2) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
        빠른 출고
      </Badge>
    );
  } else if (days <= 7) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
        보통
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
        지연 가능
      </Badge>
    );
  }
}

// 스펙 요약 생성 (태그형 한 줄)
function SpecSummary({ product }: { product: any }) {
  const parts: string[] = [];
  
  if (product.target) parts.push(product.target);
  if (product.category) {
    const categoryName = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES];
    if (categoryName) parts.push(categoryName);
  }
  if (product.specification) {
    // specification에서 주요 키워드 추출 (예: "96-well", "500mL" 등)
    const spec = product.specification.substring(0, 20);
    parts.push(spec);
  }

  if (parts.length === 0) return null;

  return (
    <div className="text-xs text-slate-500 truncate">
      {parts.join(" · ")}
    </div>
  );
}

export function SearchResultItem({
  product,
  isInCompare,
  onToggleCompare,
  onAddToQuote,
  onClick,
}: SearchResultItemProps) {
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW || 0;
  const leadTime = vendor?.leadTime;
  const stockStatus = vendor?.stockStatus;

  return (
    <div
      className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 좌측: 제품명, 벤더 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">
              {product.name}
            </h3>
            {product.vendors?.[0]?.vendor?.name && (
              <p className="text-xs text-slate-500 mt-0.5">
                {product.vendors[0].vendor.name}
              </p>
            )}
          </div>

          {/* 중간: 카테고리, Grade/규격, 스펙 요약 */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <Badge variant="outline" className="text-[10px]">
                  {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                </Badge>
              )}
              {product.grade && (
                <Badge variant="secondary" className="text-[10px]">
                  {product.grade}
                </Badge>
              )}
              {product.catalogNumber && (
                <span className="text-[10px] text-slate-500">
                  {product.catalogNumber}
                </span>
              )}
            </div>
            <SpecSummary product={product} />
          </div>
        </div>

        {/* 우측: 가격, 재고/납기, 액션 */}
        <div className="flex flex-col items-end gap-2 min-w-[140px]">
          <div className="text-right space-y-1">
            {unitPrice > 0 ? (
              <div className="text-sm font-semibold text-slate-900">
                <PriceDisplay amount={unitPrice} currency={vendor?.currency || "KRW"} />
              </div>
            ) : (
              <div className="text-xs text-slate-400">가격 문의</div>
            )}
            
            <div className="flex items-center gap-2 justify-end">
              {leadTime ? (
                <>
                  <span className="text-[10px] text-slate-500">{leadTime}일</span>
                  <LeadTimeBadge leadTime={leadTime} />
                </>
              ) : stockStatus ? (
                <span className="text-[10px] text-slate-500">재고 확인</span>
              ) : null}
            </div>
          </div>

          {/* 퀵 액션 버튼 */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={isInCompare ? "default" : "outline"}
              onClick={onToggleCompare}
              className={`text-xs h-8 px-3 ${isInCompare ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
              title={isInCompare ? "비교에서 제거" : "비교에 추가"}
            >
              <GitCompare className="h-3 w-3 mr-1" />
              <span>비교</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddToQuote}
              className="text-xs h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white"
              title="품목 리스트에 추가"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              <span>품목 추가</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

