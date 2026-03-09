"use client";

import Link from "next/link";
import { Sparkles, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  const getInsightText = () => {
    if (queryAnalysis?.target && queryAnalysis?.targetExperiment) {
      return `'${query}' 검색에 대한 AI 분석 결과입니다. ${queryAnalysis.target} 타깃에 적합하며 ${queryAnalysis.targetExperiment} 실험에 최적화된 ${productCount}개 제품을 찾았습니다.`;
    } else if (queryAnalysis?.category) {
      const categoryName =
        queryAnalysis.category === "REAGENT" ? "시약" :
        queryAnalysis.category === "TOOL" ? "기구" :
        queryAnalysis.category === "EQUIPMENT" ? "장비" :
        queryAnalysis.category;
      return `'${query}' 검색에 대한 AI 분석 결과입니다. ${categoryName} 카테고리에서 실험 목적에 맞는 ${productCount}개 제품을 찾았습니다.`;
    } else {
      return `'${query}' 검색에 대한 AI 분석 결과입니다. 실험 목적에 맞는 ${productCount}개 제품을 찾았습니다.`;
    }
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

            {/* 분석 결과 태그 */}
            {queryAnalysis && (
              <div className="flex flex-wrap gap-2">
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
                {queryAnalysis.category && (
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                    카테고리: {queryAnalysis.category === "REAGENT" ? "시약" :
                               queryAnalysis.category === "TOOL" ? "기구" :
                               queryAnalysis.category === "EQUIPMENT" ? "장비" :
                               queryAnalysis.category}
                  </Badge>
                )}
              </div>
            )}

            {/* 목적 텍스트 */}
            {queryAnalysis?.purpose && (
              <p className="text-xs text-indigo-700 leading-relaxed border-t border-indigo-200 pt-2">
                {queryAnalysis.purpose}
              </p>
            )}

            {/* 상세 분석 CTA */}
            <div className="border-t border-indigo-200 pt-2">
              <Link
                href={`/test/search/analysis?q=${encodeURIComponent(query)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                AI 분석 상세 보기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
