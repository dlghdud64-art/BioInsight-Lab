"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SearchAnalysisCard() {
  const { 
    queryAnalysis, 
    gptEnabled, 
    hasSearched, 
    analysisLoading, 
    analysisError,
    runSearch 
  } = useTestFlow();

  // 상태 1: GPT 토글 OFF
  if (!gptEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            검색 실행 시 GPT 분석 결과를 보고 싶다면,
            <br />
            왼쪽 옵션에서 '검색 시 GPT 분석 함께 실행'을 켜주세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 상태 2: GPT 토글 ON, 아직 검색 전
  if (!hasSearched) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            검색어를 입력하고 '검색 실행'을 눌러 주세요.
            <br />
            GPT가 타깃/카테고리/실험 유형을 분석한 결과가 여기 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 상태 3: GPT 토글 ON, 분석 중
  if (analysisLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              GPT가 검색어를 분석하는 중입니다...
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 상태 4: GPT 토글 ON, 분석 완료
  // 4-1) 에러가 있을 때
  if (analysisError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
              <div>
                <p className="font-medium">GPT 분석 중 오류가 발생했습니다.</p>
                <p className="text-xs text-slate-500 mt-1">
                  검색은 정상적으로 수행되었으니, 필요하다면 다시 시도해 주세요.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runSearch}
              className="w-full text-xs"
            >
              다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 4-2) 결과가 있을 때
  if (queryAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {queryAnalysis.target && (
              <Badge variant="outline" className="text-xs">
                타깃: {queryAnalysis.target}
              </Badge>
            )}
            {queryAnalysis.category && (
              <Badge variant="outline" className="text-xs">
                카테고리: {
                  queryAnalysis.category === "REAGENT" ? "시약" :
                  queryAnalysis.category === "TOOL" ? "기구" :
                  queryAnalysis.category === "EQUIPMENT" ? "장비" :
                  queryAnalysis.category
                }
              </Badge>
            )}
            {queryAnalysis.targetExperiment && (
              <Badge variant="outline" className="text-xs">
                실험 유형: {queryAnalysis.targetExperiment}
              </Badge>
            )}
            {queryAnalysis.properties && queryAnalysis.properties.length > 0 && (
              <>
                {queryAnalysis.properties.map((prop: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {prop}
                  </Badge>
                ))}
              </>
            )}
          </div>
          {queryAnalysis.purpose && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-1">목적</p>
              <p className="text-sm text-slate-700">{queryAnalysis.purpose}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 4-3) 결과가 null이지만 에러도 없을 때
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Brain className="h-4 w-4" />
          검색어 분석 결과 (GPT)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">
          분석 결과를 가져오지 못했습니다.
          <br />
          검색어를 조금 더 구체적으로 입력해 보세요.
        </p>
      </CardContent>
    </Card>
  );
}