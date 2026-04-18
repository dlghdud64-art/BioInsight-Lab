"use client";

import { Button } from "@/components/ui/button";
import {
  X,
  GitCompare,
  FileText,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ProductDetailSummary, toDetailData } from "./product-detail-summary";

interface SourcingContextRailProps {
  product: any;
  isInCompare: boolean;
  isInRequest: boolean;
  onToggleCompare: () => void;
  onToggleRequest: () => void;
  onClose: () => void;
  onOpenCompareWindow?: () => void;
  onOpenRequestWindow?: () => void;
  compareCount?: number;
  requestCount?: number;
  searchQuery?: string;
}

/**
 * SourcingContextRail — 소싱 워크벤치 우측 inspect rail.
 *
 * 재고관리 화면의 inventory-context-panel 패턴 이식:
 * - 판단 정보 우선, 설명 정보는 나중
 * - 액션 가능한 작업 보조면
 * - ProductDetailSummary 재사용 (같은 detail truth)
 */
export function SourcingContextRail({
  product,
  isInCompare,
  isInRequest,
  onToggleCompare,
  onToggleRequest,
  onClose,
  onOpenCompareWindow,
  onOpenRequestWindow,
  compareCount = 0,
  requestCount = 0,
  searchQuery,
}: SourcingContextRailProps) {
  const { data: session } = useSession();
  const isGuest = !session?.user;
  const detailData = toDetailData(product);

  return (
    <div className="flex flex-col h-full">
      {/* Rail 헤더 — sticky */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          제품 상세
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500 hover:text-slate-600"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Membership 상태 라벨 */}
      {(isInCompare || isInRequest) && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-slate-200 bg-slate-50">
          {isInCompare && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              <GitCompare className="h-3 w-3" />비교 후보에 포함됨
            </span>
          )}
          {isInRequest && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              <FileText className="h-3 w-3" />견적 후보에 포함됨
            </span>
          )}
        </div>
      )}

      {/* Rail 본문 — 스크롤, shared detail summary 재사용 */}
      <div className="flex-1 overflow-y-auto">
        <ProductDetailSummary
          data={detailData}
          isInCompare={isInCompare}
          isInRequest={isInRequest}
          onToggleCompare={onToggleCompare}
          onToggleRequest={onToggleRequest}
          compareCount={compareCount}
          requestCount={requestCount}
          variant="full"
          showDetailLink={true}
        />

        {/* 비로그인 안내 */}
        {isGuest && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
            <p className="text-[10px] text-blue-600">비교·견적 요청은 로그인 후 진행됩니다.</p>
          </div>
        )}

        {/* 다음 단계 — 짧은 행동형 */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            다음 단계
          </div>
          <div className="space-y-1.5 text-xs">
            {!isInCompare && !isInRequest && (
              <p className="text-slate-600">비교 후보에 추가하거나 견적 후보에 추가</p>
            )}
            {isInCompare && compareCount >= 2 && onOpenCompareWindow && (
              <button
                onClick={onOpenCompareWindow}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <GitCompare className="h-3 w-3" />
                {compareCount}개 비교 시작
              </button>
            )}
            {isInCompare && compareCount < 2 && (
              <p className="text-amber-600">비교 후보 1개 더 추가</p>
            )}
            {isInRequest && onOpenRequestWindow && (
              <button
                onClick={onOpenRequestWindow}
                className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-300 transition-colors"
              >
                <FileText className="h-3 w-3" />
                견적 요청서 만들기
              </button>
            )}
          </div>
        </div>

        {/* 운영 연결 */}
        {searchQuery && (
          <div className="px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">연결</div>
            <Link
              href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors py-1"
            >
              <TrendingDown className="h-3 w-3" />
              재고 현황 확인
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
