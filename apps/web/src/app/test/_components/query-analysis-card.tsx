"use client";

import { TestCard } from "./test-card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface QueryAnalysisCardProps {
  intent?: {
    target?: string;
    category?: string;
    experimentType?: string;
    sampleType?: string;
    [key: string]: any;
  } | null;
}

export function QueryAnalysisCard({ intent }: QueryAnalysisCardProps) {
  return (
    <TestCard
      title="검색어 분석 결과"
      subtitle="타깃, 카테고리, 실험 유형 등 GPT가 이해한 내용을 보여줍니다."
    >
      {intent ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium">GPT 분석 결과</span>
          </div>
          {intent.target && (
            <Badge variant="outline" className="text-xs">
              타깃: {intent.target}
            </Badge>
          )}
          {intent.category && (
            <Badge variant="outline" className="text-xs">
              카테고리: {intent.category}
            </Badge>
          )}
          {intent.experimentType && (
            <Badge variant="outline" className="text-xs">
              실험: {intent.experimentType}
            </Badge>
          )}
          {intent.sampleType && (
            <Badge variant="outline" className="text-xs">
              샘플: {intent.sampleType}
            </Badge>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw JSON 보기
            </summary>
            <pre className="mt-2 p-2 bg-slate-100 rounded text-[10px] overflow-auto">
              {JSON.stringify(intent, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          검색어를 입력하면 분석 결과가 표시됩니다.
        </p>
      )}
    </TestCard>
  );
}



