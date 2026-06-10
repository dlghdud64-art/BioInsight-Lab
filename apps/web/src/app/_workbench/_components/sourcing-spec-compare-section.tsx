"use client";

/**
 * §11.381a — 스펙 비교(Spec Compare) 섹션
 *
 * compare 라우트의 스펙표·하이라이트를 소싱 "비교 검토" 단계로 same-canvas 흡수.
 * - 데이터 경로: /api/products/compare (compare 와 동일 — canonical truth 보존)
 * - pre-quote 5컬럼: 제품명·브랜드·카테고리·규격/용량·Grade (catalog-borne)
 * - 견적 충전 컬럼(최저가·납기): 데이터 부재 시 "견적 대기" 명시 (fake data 0)
 * - 하이라이트: 최저가(emerald) / 최단납기(blue) — compare 배지 로직 이식
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { GitCompare, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { ResultCandidateDecision } from "@/lib/ai/sourcing-result-review-engine";

interface CompareProductVendor {
  id: string;
  vendor: { id: string; name: string };
  priceInKRW?: number | null;
  leadTime?: number | null;
}

interface CompareProduct {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  catalogNumber?: string | null;
  specification?: string | null;
  grade?: string | null;
  vendors?: CompareProductVendor[];
}

interface SourcingSpecCompareSectionProps {
  compareCandidates: ResultCandidateDecision[];
}

function minVendorPrice(p: CompareProduct): number | null {
  const prices = (p.vendors || []).map(v => v.priceInKRW).filter((n): n is number => typeof n === "number" && n > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function minVendorLeadTime(p: CompareProduct): number | null {
  const leads = (p.vendors || []).map(v => v.leadTime).filter((n): n is number => typeof n === "number" && n > 0);
  return leads.length > 0 ? Math.min(...leads) : null;
}

export function SourcingSpecCompareSection({ compareCandidates }: SourcingSpecCompareSectionProps) {
  const candidateIds = useMemo(() => compareCandidates.map(c => c.candidateId).slice(0, 5), [compareCandidates]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sourcing-spec-compare", candidateIds],
    queryFn: async () => {
      const response = await csrfFetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: candidateIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "스펙 비교 데이터 조회 실패");
      }
      return response.json();
    },
    enabled: candidateIds.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const products: CompareProduct[] = data?.products || [];

  const { cheapestId, fastestId } = useMemo(() => {
    let cId: string | null = null; let cVal = Infinity;
    let fId: string | null = null; let fVal = Infinity;
    products.forEach(p => {
      const price = minVendorPrice(p);
      if (price !== null && price < cVal) { cVal = price; cId = p.id; }
      const lead = minVendorLeadTime(p);
      if (lead !== null && lead < fVal) { fVal = lead; fId = p.id; }
    });
    return { cheapestId: cId, fastestId: fId };
  }, [products]);

  if (candidateIds.length < 2) return null;

  return (
    <div>
      <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">스펙 비교(Spec Compare)</span>

      {isLoading && (
        <div className="mt-2 flex items-center gap-2 px-3 py-3 rounded-md border border-bd/40 bg-[#252A33]">
          <Loader2 className="h-3.5 w-3.5 text-slate-500 animate-spin shrink-0" />
          <span className="text-[10px] text-slate-500">카탈로그 스펙 조회 중…</span>
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-md border border-red-200/20 bg-red-600/[0.04]">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-300 flex-1">{error instanceof Error ? error.message : "스펙 비교 데이터 조회 실패"}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />재시도
          </Button>
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <div className="mt-2 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33]">
          <span className="text-[10px] text-slate-500">비교 후보의 카탈로그 매칭이 없습니다. 견적 유입 시 스펙이 충전됩니다.</span>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <div className="mt-2 rounded-md border border-bd/40 bg-[#252A33] overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-bd/40">
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">제품명</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">브랜드</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">카테고리</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">규격/용량</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">Grade</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">최저가</th>
                <th className="px-3 py-2 text-[9px] font-medium text-slate-500 uppercase tracking-wider">납기</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const price = minVendorPrice(p);
                const lead = minVendorLeadTime(p);
                const isCheapest = cheapestId === p.id && price !== null;
                const isFastest = fastestId === p.id && lead !== null;
                return (
                  <tr key={p.id} className="border-b border-bd/20 last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <GitCompare className="h-3 w-3 text-blue-400 shrink-0" />
                        <span className="text-[10px] text-slate-200 font-medium">{p.name}</span>
                        {isCheapest && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-600/20">최저가</span>}
                        {isFastest && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400 border border-blue-600/20">최단납기</span>}
                      </div>
                      {p.catalogNumber && <span className="text-[9px] text-slate-500 block mt-0.5">{p.catalogNumber}</span>}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-300">{p.brand || <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-300">{p.category ? (PRODUCT_CATEGORIES[p.category as keyof typeof PRODUCT_CATEGORIES] || p.category) : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-300">{p.specification || <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-300">{p.grade || <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2">
                      {price !== null
                        ? <span className={`text-[10px] font-medium ${isCheapest ? "text-emerald-400" : "text-slate-200"}`}>₩{price.toLocaleString("ko-KR")}</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/40">견적 대기</span>}
                    </td>
                    <td className="px-3 py-2">
                      {lead !== null
                        ? <span className={`text-[10px] font-medium ${isFastest ? "text-blue-400" : "text-slate-200"}`}>{lead}일</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/40">견적 대기</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
