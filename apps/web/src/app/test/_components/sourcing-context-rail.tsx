"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import {
  X,
  FlaskConical,
  GitCompare,
  FileText,
  ExternalLink,
  Thermometer,
  Package,
  Box,
  Calendar,
  ClipboardList,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface SourcingContextRailProps {
  product: any;
  isInCompare: boolean;
  onToggleCompare: () => void;
  onAddToQuote: () => void;
  onClose: () => void;
  /** 견적 요청 work window 열기 */
  onOpenWorkWindow?: () => void;
  searchQuery?: string;
}

/**
 * SourcingContextRail — 소싱 워크벤치 우측 rail.
 *
 * Right Rail 규칙 준수:
 * - quick inspect + low-risk single action만 허용
 * - 복잡한 비교/검토 → work window 승격
 * - 긴 multi-step form 금지
 */
export function SourcingContextRail({
  product,
  isInCompare,
  onToggleCompare,
  onAddToQuote,
  onClose,
  onOpenWorkWindow,
  searchQuery,
}: SourcingContextRailProps) {
  const [imgError, setImgError] = useState(false);
  const vendor = product.vendors?.[0];
  const unitPrice = vendor?.priceInKRW && vendor.priceInKRW > 0 ? vendor.priceInKRW : null;
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const vendorName = vendor?.vendor?.name;

  return (
    <div className="flex flex-col h-full">
      {/* Rail 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bd bg-el">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          제품 상세
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Rail 본문 — 스크롤 가능 */}
      <div className="flex-1 overflow-y-auto">
        {/* 제품 이미지 + 기본 정보 */}
        <div className="px-4 py-3 border-b border-bd/50">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 shrink-0 rounded-md border border-bd bg-el overflow-hidden flex items-center justify-center">
              {!imgError ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <FlaskConical className="h-7 w-7 text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 leading-tight line-clamp-2">
                {product.name}
              </h3>
              {vendorName && (
                <p className="text-xs text-slate-400 mt-0.5">{vendorName}</p>
              )}
              {product.catalogNumber && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Cat. {product.catalogNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 가격 섹션 */}
        <div className="px-4 py-3 border-b border-bd/50">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            가격
          </div>
          {unitPrice ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums text-slate-100">
                <PriceDisplay price={unitPrice} currency="KRW" />
              </span>
              <span className="text-[10px] text-slate-500">(VAT 별도)</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400">가격 문의 필요</span>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
            <Calendar className="h-3 w-3" />
            <span>납기: 견적 시 안내</span>
          </div>
        </div>

        {/* 스펙 섹션 */}
        <div className="px-4 py-3 border-b border-bd/50">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            스펙
          </div>
          <div className="space-y-1.5">
            {product.specification && (
              <div className="flex items-start gap-2 text-xs">
                <Box className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">용량</span>
                  <span className="text-slate-300 ml-1.5">{product.specification}</span>
                </div>
              </div>
            )}
            {product.storageCondition && (
              <div className="flex items-start gap-2 text-xs">
                <Thermometer className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">보관</span>
                  <span className="text-slate-300 ml-1.5">{product.storageCondition}</span>
                </div>
              </div>
            )}
            {product.grade && (
              <div className="flex items-start gap-2 text-xs">
                <Package className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">Grade</span>
                  <span className="text-slate-300 ml-1.5">{product.grade}</span>
                </div>
              </div>
            )}
            {product.category && (
              <div className="flex items-start gap-2 text-xs">
                <ClipboardList className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">분류</span>
                  <span className="text-slate-300 ml-1.5">
                    {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category}
                  </span>
                </div>
              </div>
            )}
            {!product.specification && !product.storageCondition && !product.grade && !product.category && (
              <p className="text-xs text-slate-500">등록된 스펙 없음</p>
            )}
          </div>
        </div>

        {/* 운영 연결 */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            운영 연결
          </div>
          <div className="space-y-1.5">
            <Link
              href={`/products/${product.id}`}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
            >
              <ExternalLink className="h-3 w-3" />
              제품 상세 페이지
            </Link>
            {searchQuery && (
              <Link
                href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
              >
                <TrendingDown className="h-3 w-3" />
                재고 현황 확인
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Rail 하단 액션 — 고정 */}
      <div className="border-t border-bd bg-el px-4 py-3 space-y-2">
        {/* Primary: 견적 담기 */}
        <Button
          size="sm"
          className="w-full h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          onClick={onAddToQuote}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          견적 리스트에 담기
        </Button>

        {/* Secondary: 비교 토글 */}
        <Button
          variant="outline"
          size="sm"
          className={`w-full h-8 text-xs font-medium border-bd ${
            isInCompare
              ? "bg-blue-600/10 text-blue-400 border-blue-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={onToggleCompare}
        >
          <GitCompare className="h-3.5 w-3.5 mr-1.5" />
          {isInCompare ? "비교 목록에서 제거" : "비교 목록에 추가"}
        </Button>
      </div>
    </div>
  );
}
