"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIInsightCardProps {
  query: string;
  productCount: number;
  queryAnalysis?: {
    target?: string;
    category?: string;
    targetExperiment?: string;
    purpose?: string;
  } | null;
}

export function AIInsightCard({ query, productCount, queryAnalysis }: AIInsightCardProps) {
  // Mock 데이터 기반 인사이트 생성
  const getInsightText = () => {
    if (queryAnalysis?.target && queryAnalysis?.targetExperiment) {
      return `검색하신 키워드 '${query}'에 대한 AI 분석 결과입니다. ${queryAnalysis.target} 타깃에 적합한 ${productCount}개의 제품을 찾았습니다. 특히 ${queryAnalysis.targetExperiment} 실험에 최적화된 제품 위주로 선별되었습니다.`;
    } else if (queryAnalysis?.category) {
      const categoryName = queryAnalysis.category === "REAGENT" ? "시약" : 
                          queryAnalysis.category === "TOOL" ? "기구" : 
                          queryAnalysis.category === "EQUIPMENT" ? "장비" : 
                          queryAnalysis.category;
      return `검색하신 키워드 '${query}'에 대한 AI 분석 결과입니다. ${categoryName} 카테고리에 해당하는 ${productCount}개의 제품을 찾았습니다. 실험 목적에 맞는 제품 위주로 선별되었습니다.`;
    } else {
      return `검색하신 키워드 '${query}'에 대한 AI 분석 결과입니다. 실험 목적에 맞는 ${productCount}개의 제품을 찾았습니다. 특히 'Research Grade' 제품 위주로 선별되었습니다.`;
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
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-bold text-indigo-900 text-base mb-1">
                AI 분석 리포트
              </h3>
              <p className="text-sm text-indigo-800 leading-relaxed">
                {getInsightText()}
              </p>
            </div>
            
            {/* 분석 결과 태그 */}
            {queryAnalysis && (
              <div className="flex flex-wrap gap-2 pt-2">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

