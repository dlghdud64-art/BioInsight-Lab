"use client";

import { useState } from "react";
import {
  Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AIInsightCardProps {
  query: string;
  productCount: number;
  isLoading?: boolean;
  queryAnalysis?: {
    target?: string;
    category?: string;
    targetExperiment?: string;
    purpose?: string;
    properties?: string[];
  } | null;
}

export function AIInsightCard({ query, productCount, isLoading, queryAnalysis }: AIInsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 md:px-5 md:py-4 bg-indigo-50 border border-indigo-100 rounded-lg">
        <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg bg-indigo-100 flex items-center justify-center animate-pulse shrink-0">
          <Sparkles className="h-3.5 w-3.5 md:h-5 md:w-5 text-indigo-300" />
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-indigo-100 rounded animate-pulse w-32" />
          <div className="h-3 bg-indigo-100 rounded animate-pulse w-4/5 hidden md:block" />
        </div>
      </div>
    );
  }

  if (!queryAnalysis) return null;

  // ── 카테고리 레이블 ──
  const getCategoryLabel = (cat?: string) => {
    if (!cat) return "일반";
    const map: Record<string, string> = { REAGENT: "시약", TOOL: "기구", EQUIPMENT: "장비" };
    return map[cat] || cat;
  };

  // ── 요약 텍스트 (항상 유의미한 문장) ──
  const getInsightText = () => {
    if (queryAnalysis.target && queryAnalysis.targetExperiment) {
      return `'${query}' 검색 결과, ${queryAnalysis.target} 타깃에 적합한 ${queryAnalysis.targetExperiment} 관련 ${productCount}개 제품을 찾았습니다.`;
    }
    if (queryAnalysis.category) {
      return `'${query}' 검색 결과, ${getCategoryLabel(queryAnalysis.category)} 카테고리에서 ${productCount}개 제품을 찾았습니다.`;
    }
    return `'${query}' 검색 결과, 실험 목적에 맞는 ${productCount}개 제품을 찾았습니다.`;
  };

  // ── 상세 해석 (빈 필드에도 안정적 fallback) ──
  const getInterpretation = () => {
    if (queryAnalysis.purpose) return queryAnalysis.purpose;
    if (queryAnalysis.target && queryAnalysis.targetExperiment) {
      return `'${query}'는 ${queryAnalysis.target}을(를) 대상으로 ${queryAnalysis.targetExperiment} 실험에 사용되는 제품으로 분석됩니다. 순도, 용량, 납기를 기준으로 비교하면 최적의 선택을 할 수 있습니다.`;
    }
    if (queryAnalysis.category) {
      return `'${query}'는 ${getCategoryLabel(queryAnalysis.category)} 카테고리로 분류됩니다. 가격, 브랜드, 주요 스펙을 비교하여 연구 목적에 적합한 제품을 선택하세요.`;
    }
    return `'${query}'에 해당하는 제품을 분석했습니다. 제조사, 가격, 규격 등을 비교하면 연구 목적에 맞는 제품을 찾을 수 있습니다.`;
  };

  // ── 비교 기준 추천 (항상 반환) ──
  const getComparisonCriteria = (): string[] => {
    const base =
      queryAnalysis.category === "EQUIPMENT" ? ["가격", "브랜드", "보증 기간", "납기"] :
      queryAnalysis.category === "TOOL" ? ["가격", "소재", "멸균 여부", "수량 단위"] :
      ["가격", "순도/등급", "용량/규격", "납기"];

    if (queryAnalysis.properties && queryAnalysis.properties.length > 0) {
      const merged = [...new Set([...queryAnalysis.properties.slice(0, 3), ...base])];
      return merged.slice(0, 5);
    }
    return base;
  };

  // ── 관련 검색 추천 ──
  const getSuggestedQueries = (): string[] => {
    const suggestions: string[] = [];
    if (queryAnalysis.category === "REAGENT") {
      suggestions.push(`${query} analytical grade`, `${query} 대용량`);
    } else if (queryAnalysis.category === "EQUIPMENT") {
      suggestions.push(`${query} 소형`, `${query} 최신 모델`);
    } else {
      suggestions.push(`${query} 고순도`, `${query} 대체품`);
    }
    if (queryAnalysis.target) {
      suggestions.push(`${queryAnalysis.target} 관련 시약`);
    }
    return suggestions.slice(0, 3);
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-lg overflow-hidden">
      {/* Compact strip (기본 — 모바일 최적화) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 md:px-5 md:py-4 text-left hover:bg-indigo-100/50 transition-colors"
      >
        <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 md:h-5 md:w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-indigo-800 leading-snug line-clamp-1 md:line-clamp-none">
            {getInsightText()}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0">
              {getCategoryLabel(queryAnalysis.category)}
            </Badge>
            {queryAnalysis.target && (
              <span className="text-[10px] text-indigo-500 hidden sm:inline">타깃: {queryAnalysis.target}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-indigo-500">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* ── 확장 상세 패널 ── */}
      {isExpanded && (
        <div className="px-3 pb-3 md:px-5 md:pb-4 pt-1 space-y-2.5 border-t border-indigo-200">

          {/* 비교 기준 */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[10px] font-semibold text-indigo-500 mr-0.5">비교 기준</span>
            {getComparisonCriteria().slice(0, 4).map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] bg-[#1a1a1e]/60 text-indigo-700 border-indigo-200 px-2 py-0.5">
                {c}
              </Badge>
            ))}
          </div>

          {/* 검색어 해석 */}
          <p className="text-xs text-indigo-700 leading-relaxed">{getInterpretation()}</p>

          {/* 관련 검색 추천 */}
          <div className="flex flex-wrap gap-1.5">
            {getSuggestedQueries().map((sq, idx) => (
              <a
                key={idx}
                href={`/test/search?q=${encodeURIComponent(sq)}`}
                className="text-[10px] px-2.5 py-1 rounded-full bg-[#1a1a1e]/80 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                {sq}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
