"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import { ShoppingCart, GitCompare, Thermometer, AlertTriangle, Shield } from "lucide-react";

interface SearchResultItemProps {
  product: any;
  isInCompare: boolean;
  onToggleCompare: () => void;
  onAddToQuote: () => void;
  onClick?: () => void;
}

// 재고 상태 배지 컴포넌트
function StockStatusBadge({ stockStatus }: { stockStatus?: string }) {
  if (!stockStatus) return null;

  const status = stockStatus.toLowerCase();
  
  if (status.includes("재고") || status.includes("in stock") || status.includes("available")) {
    return (
      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-[10px]">
        재고 있음
      </Badge>
    );
  } else if (status.includes("주문") || status.includes("order") || status.includes("backorder")) {
    return (
      <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 text-[10px]">
        주문 필요
      </Badge>
    );
  } else if (status.includes("품절") || status.includes("out of stock") || status.includes("unavailable")) {
    return (
      <Badge variant="outline" className="bg-white text-slate-500 border-slate-300 text-[10px]">
        품절
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-[10px]">
      {stockStatus}
    </Badge>
  );
}

// 납기 포맷팅 함수
function formatLeadTime(leadTime?: number | string): string {
  if (!leadTime) return "";

  const days = typeof leadTime === "string" ? parseInt(leadTime) : leadTime;
  
  if (days <= 0) {
    return "재고 있음";
  } else if (days === 1) {
    return "1일";
  } else if (days < 7) {
    return `${days}일`;
  } else if (days < 14) {
    return "1-2주";
  } else if (days < 30) {
    const weeks = Math.ceil(days / 7);
    return `${weeks}주`;
  } else {
    const months = Math.ceil(days / 30);
    return `${months}개월`;
  }
}

// 재고/납기 상태 배지 컴포넌트
function LeadTimeBadge({ leadTime }: { leadTime?: number | string }) {
  if (!leadTime) return null;

  const days = typeof leadTime === "string" ? parseInt(leadTime) : leadTime;
  
  if (days <= 2) {
    return (
      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-[10px] font-medium">
        빠름
      </Badge>
    );
  } else if (days <= 7) {
    return (
      <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 text-[10px]">
        보통
      </Badge>
    );
  } else if (days <= 14) {
    return (
      <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 text-[10px]">
        지연
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="bg-white text-slate-500 border-slate-300 text-[10px]">
        장기
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
    <div className="text-xs md:text-sm text-slate-500 break-words leading-relaxed">
      {parts.join(" · ")}
    </div>
  );
}

// 도메인 디테일 뱃지 (보관조건, 위험물, PPE)
function DomainDetailBadges({ product }: { product: any }) {
  const hasStorageCondition = product.storageCondition;
  const hasHazardCodes = product.hazardCodes || product.pictograms;
  const hasPpe = product.ppe;

  if (!hasStorageCondition && !hasHazardCodes && !hasPpe) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      {hasStorageCondition && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9px] text-slate-600"
          title={`보관: ${product.storageCondition}`}
        >
          <Thermometer className="h-2.5 w-2.5 text-slate-500" strokeWidth={1.5} />
          <span>{product.storageCondition}</span>
        </span>
      )}
      {hasHazardCodes && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[9px] text-slate-700"
          title={`위험물: ${product.hazardCodes || product.pictograms}`}
        >
          <AlertTriangle className="h-2.5 w-2.5 text-slate-600" strokeWidth={1.5} />
          <span>{product.hazardCodes || product.pictograms}</span>
        </span>
      )}
      {hasPpe && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9px] text-slate-600"
          title={`PPE: ${product.ppe}`}
        >
          <Shield className="h-2.5 w-2.5 text-slate-500" strokeWidth={1.5} />
          <span>{product.ppe}</span>
        </span>
      )}
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
      className="p-4 md:p-5 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* 좌측: 제품명, 벤더 */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <h3 className="font-semibold text-base md:text-lg text-slate-900 break-words leading-snug">
              {product.name}
            </h3>
            {product.vendors?.[0]?.vendor?.name && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {product.vendors[0].vendor.name}
              </p>
            )}
          </div>

          {/* 중간: 카테고리, Grade/규격, 카탈로그 번호, 스펙 요약 */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                </Badge>
              )}
              {product.grade && (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  {product.grade}
                </Badge>
              )}
              {product.catalogNumber && (
                <span className="text-[10px] md:text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  Cat.No: {product.catalogNumber}
                </span>
              )}
              {product.lotNumber && (
                <span className="text-[10px] md:text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  Lot: {product.lotNumber}
                </span>
              )}
            </div>
            <SpecSummary product={product} />
            <DomainDetailBadges product={product} />
          </div>
        </div>

        {/* 우측: 가격, 재고/납기, 액션 */}
        <div className="flex flex-row md:flex-col md:items-end justify-between md:justify-start gap-3 md:gap-2 md:min-w-[160px]">
          <div className="text-left md:text-right space-y-1.5">
            {unitPrice > 0 ? (
              <div className="text-base md:text-lg font-semibold text-slate-900">
                <PriceDisplay price={unitPrice} currency="KRW" />
              </div>
            ) : (
              <div className="text-sm text-slate-400">가격 문의</div>
            )}
            
            <div className="flex flex-col md:items-end gap-1.5">
              {stockStatus && (
                <div className="flex items-center gap-1">
                  <StockStatusBadge stockStatus={stockStatus} />
                </div>
              )}
              {leadTime && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] md:text-xs text-slate-600 font-medium">
                    납기: {formatLeadTime(leadTime)}
                  </span>
                  <LeadTimeBadge leadTime={leadTime} />
                </div>
              )}
              {!leadTime && !stockStatus && (
                <span className="text-[10px] md:text-xs text-slate-400">재고/납기 문의</span>
              )}
            </div>
          </div>

          {/* 퀵 액션 버튼 */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={isInCompare ? "default" : "outline"}
              onClick={onToggleCompare}
              className={`text-xs h-8 md:h-9 px-2 md:px-3 ${isInCompare ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
              title={isInCompare ? "비교에서 제거" : "비교에 추가"}
            >
              <GitCompare className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              <span className="hidden sm:inline">비교</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddToQuote}
              className="text-xs h-8 md:h-9 px-2 md:px-3 bg-slate-900 hover:bg-slate-800 text-white"
              title="구매 요청 리스트에 이 제품을 추가합니다."
            >
              <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              <span className="hidden sm:inline">리스트에 담기</span>
              <span className="sm:hidden">담기</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}