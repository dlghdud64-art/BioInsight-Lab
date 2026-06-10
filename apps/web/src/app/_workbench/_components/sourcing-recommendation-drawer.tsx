"use client";

/**
 * §11.318 Phase 1c — 대체품/벤더 추천 드로어 (same-canvas Sheet)
 * §11.381b 이식 (2026-06-10): compare/_components → _workbench/_components.
 *   compare 라우트 retire(Phase B) 에 따른 구출 — 소싱 비교 검토 단계가
 *   canonical 소비처. CTA 재배선: 구 compare 견적 경로 → /app/quote.
 *
 * 결정(호영님 2026-05-29):
 *   - 기존 compare-analysis-drawer 패턴 재사용(Sheet 같은 캔버스).
 *   - 신규 page 없음. 제품 행 CTA → 이 드로어.
 *   - 데이터 출처 = PurchaseRecord(실거래). 없으면 hasData=false + 견적 유도.
 *   - "과거 구매 기록 기반" 뱃지 항상 표시(출처 투명성).
 *   - 자유 텍스트 추천/전략 표시 0 (환각 표면 차단).
 *
 * Dead button 없음:
 *   - 벤더 행 → 견적 요청 실 wiring
 *   - 빈 상태 → "견적 요청하기" Link(/app/quote)
 */

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ShoppingCart, Database, TrendingDown, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import type { SourcingRecommendation, VendorOption, SubstituteOption } from "@/lib/compare-workspace/sourcing-recommendation";

// ── 응답 타입 ──

interface SourcingRecommendResponse {
  success: boolean;
  productId: string;
  productName: string;
  dataSource: "purchase_history" | "none";
  sourceLabel: string;
  recommendation: SourcingRecommendation;
}

// ── Props ──

interface SourcingRecommendationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

// ── 서브 컴포넌트 ──

function SourceBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] gap-1 text-slate-400 border-slate-600"
      data-testid="sourcing-source-badge"
    >
      <Database className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}

function VendorRow({ vendor, isFirst }: { vendor: VendorOption; isFirst: boolean }) {
  const priceLabel = vendor.unitPrice != null
    ? `₩${vendor.unitPrice.toLocaleString("ko-KR")}`
    : "가격 미확인";
  const leadLabel = vendor.leadTimeDays != null
    ? `${vendor.leadTimeDays}일`
    : "납기 미확인";
  const dateLabel = new Date(vendor.lastPurchasedAt).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
        isFirst ? "border-emerald-700 bg-emerald-950/20" : "border-slate-700 bg-el"
      }`}
      data-testid="sourcing-vendor-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100 truncate">{vendor.vendorName}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs text-slate-400">
            {dateLabel} 최근구매 · {vendor.purchaseCount}회
          </span>
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Clock className="h-2.5 w-2.5" />
            {leadLabel}
            {vendor.leadTimeSource === "unknown" && (
              <span className="text-slate-500 ml-0.5">(미확인)</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          {vendor.isLowestPrice && (
            <Badge className="text-[10px] py-0 px-1.5 bg-emerald-600 text-white gap-0.5">
              <TrendingDown className="h-2.5 w-2.5" /> 최저가
            </Badge>
          )}
          {vendor.isFastest && vendor.leadTimeDays != null && (
            <Badge className="text-[10px] py-0 px-1.5 bg-blue-600 text-white gap-0.5">
              <Clock className="h-2.5 w-2.5" /> 최단납기
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p
          className={`text-sm font-bold ${
            vendor.unitPrice != null ? "text-slate-100" : "text-slate-500"
          }`}
        >
          {priceLabel}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">단가</p>
      </div>
    </div>
  );
}

function SubstituteRow({ sub }: { sub: SubstituteOption }) {
  const priceLabel = sub.unitPrice != null
    ? `₩${sub.unitPrice.toLocaleString("ko-KR")}`
    : "가격 미확인";
  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-el"
      data-testid="sourcing-substitute-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200 truncate">{sub.itemName}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {sub.vendorName}
          {sub.catalogNumber ? ` · ${sub.catalogNumber}` : ""}
        </p>
        <p className="text-[11px] text-slate-500 mt-1 italic">{sub.reason}</p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={`text-xs font-semibold ${
            sub.unitPrice != null ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {priceLabel}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ productName }: { productName: string }) {
  return (
    <div
      className="flex flex-col items-center gap-4 py-12 px-4 text-center"
      data-testid="sourcing-empty-state"
    >
      <div className="rounded-full bg-slate-800 p-4">
        <Database className="h-8 w-8 text-slate-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-200">구매 이력이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          {productName}에 대한 과거 구매 기록이 없습니다.
          <br />
          견적을 요청하여 벤더 정보를 확보하세요.
        </p>
      </div>
      <Link href="/app/quote">
        <Button
          size="sm"
          className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
          data-testid="sourcing-empty-quote-cta"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          견적 요청하기
        </Button>
      </Link>
    </div>
  );
}

// ── 메인 드로어 ──

export function SourcingRecommendationDrawer({
  open,
  onOpenChange,
  productId,
  productName,
}: SourcingRecommendationDrawerProps) {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<SourcingRecommendResponse>({
    queryKey: ["sourcing-recommend", productId],
    queryFn: async () => {
      const res = await fetch(`/api/sourcing/recommend?productId=${encodeURIComponent(productId)}`);
      if (!res.ok) throw new Error("추천 데이터를 불러오지 못했습니다.");
      return res.json();
    },
    enabled: open && !!productId,
    staleTime: 60_000,
  });

  const rec = data?.recommendation;
  const hasData = rec?.hasData ?? false;
  const vendors = rec?.sameProductOtherVendors ?? [];
  const substitutes = rec?.substitutes ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[480px] bg-[#0f1117] border-l border-slate-700 overflow-y-auto"
        data-testid="sourcing-recommendation-drawer"
      >
        <SheetHeader className="border-b border-slate-700 pb-4 mb-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-slate-100 text-base leading-snug">
                대체품/벤더 찾기
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-400 mt-0.5 truncate">
                {productName}
              </SheetDescription>
            </div>
            {data?.sourceLabel && (
              <SourceBadge label={data.sourceLabel} />
            )}
          </div>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* 로딩 */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-400" data-testid="sourcing-loading">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">구매 이력 조회 중...</p>
            </div>
          )}

          {/* 에러 */}
          {isError && !isLoading && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-lg border border-red-700 bg-red-950/20"
              data-testid="sourcing-error"
            >
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">데이터 조회 실패</p>
                <p className="text-xs text-red-400 mt-0.5">
                  {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
                </p>
              </div>
            </div>
          )}

          {/* 데이터 없음(empty) */}
          {!isLoading && !isError && !hasData && (
            <EmptyState productName={productName} />
          )}

          {/* 데이터 있음 */}
          {!isLoading && !isError && hasData && (
            <>
              {/* 같은 제품 벤더 비교 */}
              {vendors.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-200">
                      같은 제품 — 벤더별 비교
                    </h3>
                    <span className="text-xs text-slate-500">{vendors.length}곳</span>
                  </div>
                  <div className="space-y-2">
                    {vendors.map((v, i) => (
                      <VendorRow key={v.vendorName} vendor={v} isFirst={i === 0} />
                    ))}
                  </div>
                  {/* 벤더 선택 후 견적 CTA */}
                  <div className="mt-3">
                    <Link href="/app/quote">
                      <Button
                        size="sm"
                        className="w-full gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                        data-testid="sourcing-vendor-quote-cta"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        선택 벤더로 견적 요청
                      </Button>
                    </Link>
                  </div>
                </section>
              )}

              {/* 유사 대체품 */}
              {substitutes.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="h-4 w-4 text-blue-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-200">
                      유사 대체품
                    </h3>
                    <span className="text-xs text-slate-500">
                      같은 카테고리 · 과거 구매 기록 기반
                    </span>
                  </div>
                  <div className="space-y-2">
                    {substitutes.slice(0, 5).map((s, i) => (
                      <SubstituteRow key={i} sub={s} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
