"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/products/price-display";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import {
  FlaskConical,
  GitCompare,
  FileText,
  Thermometer,
  Package,
  Box,
  Calendar,
  ClipboardList,
  ExternalLink,
  Check,
} from "lucide-react";
import Link from "next/link";

// ── Shared detail truth adapter ──

export interface ProductDetailData {
  id: string;
  name: string;
  vendorName: string | null;
  catalogNumber: string | null;
  brand: string | null;
  specification: string | null;
  storageCondition: string | null;
  grade: string | null;
  category: string | null;
  unitPrice: number | null;
  imageUrl: string | null;
}

/** 제품 객체 → detail truth 변환 */
export function toDetailData(product: any): ProductDetailData {
  const vendor = product.vendors?.[0];
  return {
    id: product.id,
    name: product.name,
    vendorName: vendor?.vendor?.name || product.brand || null,
    catalogNumber: product.catalogNumber || null,
    brand: product.brand || null,
    specification: product.specification || null,
    storageCondition: product.storageCondition || null,
    grade: product.grade || null,
    category: product.category || null,
    unitPrice: vendor?.priceInKRW > 0 ? vendor.priceInKRW : null,
    imageUrl: product.imageUrl || null,
  };
}

// ── Shared Detail Summary Component ──

interface ProductDetailSummaryProps {
  data: ProductDetailData;
  isInCompare: boolean;
  isInRequest: boolean;
  onToggleCompare?: () => void;
  onToggleRequest?: () => void;
  compareCount?: number;
  requestCount?: number;
  /** compact: nested inspect 용 (더 작은 이미지, 축약된 스펙) */
  variant?: "full" | "compact";
  /** full-page 링크 표시 */
  showDetailLink?: boolean;
}

export function ProductDetailSummary({
  data,
  isInCompare,
  isInRequest,
  onToggleCompare,
  onToggleRequest,
  compareCount = 0,
  requestCount = 0,
  variant = "full",
  showDetailLink = true,
}: ProductDetailSummaryProps) {
  const [imgError, setImgError] = useState(false);
  const imageSrc = data.imageUrl || `/api/products/${data.id}/image`;
  const imgSize = variant === "compact" ? "w-10 h-10" : "w-14 h-14";
  const iconSize = variant === "compact" ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className="space-y-0">
      {/* 제품 이미지 + 기본 정보 */}
      <div className="px-4 py-3 border-b border-bd/50">
        <div className="flex items-start gap-3">
          <div className={`${imgSize} shrink-0 rounded-md border border-bd bg-el overflow-hidden flex items-center justify-center`}>
            {!imgError ? (
              <img
                src={imageSrc}
                alt={data.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <FlaskConical className={`${iconSize} text-slate-500`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 leading-tight line-clamp-2">
              {data.name}
            </h3>
            {data.vendorName && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{data.vendorName}</p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              {data.catalogNumber && (
                <span className="text-xs text-slate-500 font-mono truncate">Cat. {data.catalogNumber}</span>
              )}
              {data.brand && data.brand !== data.vendorName && (
                <>
                  {data.catalogNumber && <span className="text-slate-600 text-xs">·</span>}
                  <span className="text-xs text-slate-500 truncate">{data.brand}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 가격 */}
      <div className="px-4 py-3 border-b border-bd/50">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">가격</div>
        {data.unitPrice ? (
          <div className="flex items-baseline gap-1.5">
            <span className={`${variant === "compact" ? "text-base" : "text-lg"} font-bold tabular-nums text-slate-100`}>
              <PriceDisplay price={data.unitPrice} currency="KRW" />
            </span>
            <span className="text-[10px] text-slate-500">(VAT 별도)</span>
          </div>
        ) : (
          <span className="text-sm text-slate-400">가격 문의 필요</span>
        )}
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          <span>납기: 견적 시 안내</span>
        </div>
      </div>

      {/* 스펙 */}
      <div className="px-4 py-3 border-b border-bd/50">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">스펙</div>
        <div className="space-y-1.5">
          {data.specification && (
            <div className="flex items-start gap-2 text-xs">
              <Box className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span className="text-slate-500">용량</span>
              <span className="text-slate-300 ml-auto truncate max-w-[140px]">{data.specification}</span>
            </div>
          )}
          {data.storageCondition && (
            <div className="flex items-start gap-2 text-xs">
              <Thermometer className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span className="text-slate-500">보관</span>
              <span className="text-slate-300 ml-auto truncate max-w-[140px]">{data.storageCondition}</span>
            </div>
          )}
          {data.grade && (
            <div className="flex items-start gap-2 text-xs">
              <Package className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span className="text-slate-500">Grade</span>
              <span className="text-slate-300 ml-auto truncate max-w-[140px]">{data.grade}</span>
            </div>
          )}
          {data.category && (
            <div className="flex items-start gap-2 text-xs">
              <ClipboardList className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span className="text-slate-500">분류</span>
              <span className="text-slate-300 ml-auto">
                {PRODUCT_CATEGORIES[data.category as keyof typeof PRODUCT_CATEGORIES] || data.category}
              </span>
            </div>
          )}
          {!data.specification && !data.storageCondition && !data.grade && !data.category && (
            <p className="text-xs text-slate-500">등록된 스펙 없음</p>
          )}
        </div>
      </div>

      {/* 소싱 상태 */}
      <div className="px-4 py-3 border-b border-bd/50">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5">소싱 상태</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <GitCompare className="h-3 w-3 text-blue-400" />
              <span className="text-slate-400">비교 목록</span>
            </div>
            <span className={isInCompare ? "text-blue-400 font-medium" : "text-slate-500"}>
              {isInCompare ? `포함됨 (${compareCount})` : "미포함"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-emerald-400" />
              <span className="text-slate-400">견적 요청</span>
            </div>
            <span className={isInRequest ? "text-emerald-400 font-medium" : "text-slate-500"}>
              {isInRequest ? `포함됨 (${requestCount})` : "미포함"}
            </span>
          </div>
        </div>
      </div>

      {/* 액션 바 — 비교 primary, 견적 secondary */}
      {(onToggleCompare || onToggleRequest) && (
        <div className="px-4 py-3 border-b border-bd/50 space-y-1.5">
          {onToggleCompare && (
            isInCompare ? (
              <div className="w-full h-7 px-3 rounded text-xs font-medium inline-flex items-center gap-1.5 bg-blue-600/12 text-blue-400/80 border border-blue-600/20">
                <Check className="h-3 w-3" />비교 후보에 포함됨
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full h-7 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
                onClick={onToggleCompare}
              >
                <GitCompare className="h-3 w-3 mr-1.5" />비교 후보에 추가
              </Button>
            )
          )}
          {onToggleRequest && (
            isInRequest ? (
              <div className="w-full h-7 px-3 rounded text-xs font-medium inline-flex items-center gap-1.5 bg-slate-500/10 text-slate-400 border border-slate-500/15">
                <Check className="h-3 w-3" />견적 후보에 포함됨
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs font-medium border-bd text-slate-400 hover:text-slate-200"
                onClick={onToggleRequest}
              >
                <FileText className="h-3 w-3 mr-1.5" />견적 후보에 추가
              </Button>
            )
          )}
        </div>
      )}

      {/* Full detail link (fallback) */}
      {showDetailLink && (
        <div className="px-4 py-2">
          <Link
            href={`/products/${data.id}`}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
          >
            <ExternalLink className="h-3 w-3" />
            전체 상세 페이지
          </Link>
        </div>
      )}
    </div>
  );
}
