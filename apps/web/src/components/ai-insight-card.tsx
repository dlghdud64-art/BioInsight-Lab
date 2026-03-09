"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles, FileText, ChevronDown, ChevronUp,
  Search, GitCompare, Lightbulb, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      <Card className="bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center animate-pulse">
                <Sparkles className="h-5 w-5 text-indigo-300" />
              </div>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 bg-indigo-100 rounded animate-pulse w-32" />
              <div className="space-y-1.5">
                <div className="h-3 bg-indigo-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-indigo-100 rounded animate-pulse w-4/5" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-20 bg-indigo-100 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-indigo-100 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
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
    <Card className="bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* 아이콘 */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
          </div>

          {/* 내용 */}
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <h3 className="font-bold text-indigo-900 text-base mb-1">AI 분석 리포트</h3>
              <p className="text-sm text-indigo-800 leading-relaxed">{getInsightText()}</p>
            </div>

            {/* 분석 결과 태그 — 항상 하나 이상 표시 */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                {getCategoryLabel(queryAnalysis.category)}
              </Badge>
              {queryAnalysis.target && (
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                  타깃: {queryAnalysis.target}
                </Badge>
              )}
              {queryAnalysis.targetExperiment && (
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                  실험: {queryAnalysis.targetExperiment}
                </Badge>
              )}
            </div>

            {/* 비교 기준 (요약 영역에 항상 표시) */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold text-indigo-500 self-center mr-0.5">비교 기준</span>
              {getComparisonCriteria().slice(0, 3).map((c, i) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-white/60 text-indigo-700 border-indigo-200 px-2 py-0.5">
                  {c}
                </Badge>
              ))}
            </div>

            {/* CTA 버튼 영역 */}
            <div className="border-t border-indigo-200 pt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                {isExpanded ? "상세 분석 접기" : "상세 분석 보기"}
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <span className="text-indigo-300 text-xs">·</span>
              <Link
                href={`/test/search?q=${encodeURIComponent(query)}&step=compare`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
              >
                <GitCompare className="h-3.5 w-3.5" />
                이 조건으로 비교하기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── 인라인 확장 상세 패널 ── */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-indigo-200 space-y-3">

            {/* 1. 검색어 해석 */}
            <div className="rounded-lg bg-white border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <h4 className="text-sm font-semibold text-slate-900">검색어 해석</h4>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{getInterpretation()}</p>
            </div>

            {/* 2. 분류 정보 그리드 */}
            <div className="rounded-lg bg-white border border-indigo-100 p-4">
              <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">분류 정보</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">카테고리</p>
                  <p className="text-sm font-medium text-slate-900">{getCategoryLabel(queryAnalysis.category)}</p>
                </div>
                <div className="rounded-md bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">실험 유형</p>
                  <p className="text-sm font-medium text-slate-900">{queryAnalysis.targetExperiment || "범용"}</p>
                </div>
                {queryAnalysis.target && (
                  <div className="rounded-md bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">타깃</p>
                    <p className="text-sm font-medium text-slate-900">{queryAnalysis.target}</p>
                  </div>
                )}
                {queryAnalysis.properties && queryAnalysis.properties.length > 0 && (
                  <div className="rounded-md bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">속성</p>
                    <p className="text-sm font-medium text-slate-900">{queryAnalysis.properties.join(", ")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. 비교 기준 추천 */}
            <div className="rounded-lg bg-white border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitCompare className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <h4 className="text-sm font-semibold text-slate-900">추천 비교 기준</h4>
              </div>
              <p className="text-xs text-slate-500 mb-2">이 검색 결과를 비교할 때 확인하면 좋은 항목입니다.</p>
              <div className="flex flex-wrap gap-1.5">
                {getComparisonCriteria().map((criterion, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                    {criterion}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 4. 관련 검색 추천 */}
            <div className="rounded-lg bg-white border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <h4 className="text-sm font-semibold text-slate-900">관련 검색 추천</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {getSuggestedQueries().map((sq, idx) => (
                  <Link
                    key={idx}
                    href={`/test/search?q=${encodeURIComponent(sq)}`}
                    className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    {sq}
                  </Link>
                ))}
              </div>
            </div>

            {/* 5. 비교 CTA */}
            <Link href={`/test/search?q=${encodeURIComponent(query)}&step=compare`} className="block pt-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 text-sm font-semibold shadow-sm transition-all">
                <GitCompare className="h-4 w-4 mr-2" />
                이 조건으로 제품 비교하기
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
