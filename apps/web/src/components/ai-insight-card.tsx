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
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-indigo-600/20 bg-indigo-600/5">
        <div className="w-6 h-6 rounded bg-indigo-600/10 flex items-center justify-center animate-pulse shrink-0">
          <Sparkles className="h-3 w-3 text-indigo-400" />
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <div className="h-2.5 bg-indigo-600/10 rounded animate-pulse w-32" />
        </div>
      </div>
    );
  }

  if (!queryAnalysis) return null;

  const getCategoryLabel = (cat?: string) => {
    if (!cat) return "일반";
    const map: Record<string, string> = { REAGENT: "시약", TOOL: "기구", EQUIPMENT: "장비" };
    return map[cat] || cat;
  };

  const getInsightText = () => {
    if (queryAnalysis.target && queryAnalysis.targetExperiment) {
      return `'${query}' 검색 결과, ${queryAnalysis.target} 타깃에 적합한 ${queryAnalysis.targetExperiment} 관련 ${productCount}개 제품을 찾았습니다.`;
    }
    if (queryAnalysis.category) {
      return `'${query}' 검색 결과, ${getCategoryLabel(queryAnalysis.category)} 카테고리에서 ${productCount}개 제품을 찾았습니다.`;
    }
    return `'${query}' 검색 결과, 실험 목적에 맞는 ${productCount}개 제품을 찾았습니다.`;
  };

  const getInterpretation = () => {
    if (queryAnalysis.purpose) return queryAnalysis.purpose;
    if (queryAnalysis.target && queryAnalysis.targetExperiment) {
      return `'${query}'는 ${queryAnalysis.target}을(를) 대상으로 ${queryAnalysis.targetExperiment} 실험에 사용되는 제품으로 분석됩니다.`;
    }
    if (queryAnalysis.category) {
      return `'${query}'는 ${getCategoryLabel(queryAnalysis.category)} 카테고리로 분류됩니다.`;
    }
    return `'${query}'에 해당하는 제품을 분석했습니다.`;
  };

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

  return (
    <div className="rounded border border-indigo-600/20 bg-indigo-600/5 overflow-hidden">
      {/* Single-line strip — ultra compact */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-indigo-600/10 transition-colors"
      >
        <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
        <p className="text-[11px] text-indigo-300 leading-snug line-clamp-1 flex-1 min-w-0">
          {getInsightText()}
        </p>
        <Badge variant="secondary" className="bg-indigo-600/10 text-indigo-400 border-indigo-600/20 text-[9px] px-1.5 py-0 shrink-0">
          {getCategoryLabel(queryAnalysis.category)}
        </Badge>
        <div className="shrink-0 text-indigo-400">
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>

      {/* 확장 상세 */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-indigo-600/20">
          <div className="flex flex-wrap items-center gap-1 pt-1.5">
            <span className="text-[10px] font-medium text-indigo-400 mr-0.5">비교 기준</span>
            {getComparisonCriteria().slice(0, 4).map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] text-indigo-300 border-indigo-600/20 px-1.5 py-0">
                {c}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-indigo-300/80 leading-relaxed">{getInterpretation()}</p>
        </div>
      )}
    </div>
  );
}
