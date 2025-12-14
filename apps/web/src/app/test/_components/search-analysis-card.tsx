"use client";

import { useState } from "react";
import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export function SearchAnalysisCard() {
  const [expanded, setExpanded] = useState(false);
  const { 
    queryAnalysis, 
    gptEnabled, 
    hasSearched, 
    analysisLoading, 
    analysisError,
    runSearch,
    searchQuery
  } = useTestFlow();

  // 상태 1: GPT 토글 OFF
  if (!gptEnabled) {
    return (
      <Card>
        <CardHeader className="flex items-center justify-between pb-3">
          <div className="flex-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
              <Brain className="h-4 w-4" />
              검색어 분석 결과 (GPT)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600">
              검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
            </p>
          </div>
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
        <CardHeader className="flex items-center justify-between pb-3">
          <div className="flex-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
              <Brain className="h-4 w-4" />
              검색어 분석 결과 (GPT)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600">
              검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                접기
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                자세히 보기
              </>
            )}
          </Button>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                검색어를 분석하여 <strong>타깃</strong>, <strong>실험 유형</strong>, <strong>카테고리</strong> 등을 자동으로 추출한 결과가 여기에 표시됩니다.
              </p>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-900">예시 분석 결과</p>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-white rounded border border-blue-100 p-2.5">
                    <div className="text-[10px] font-medium text-slate-500 mb-1.5">검색어</div>
                    <div className="text-xs font-medium text-slate-800">"Human IL-6 Sandwich ELISA kit"</div>
                  </div>
                  <div className="space-y-1.5 pt-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-500 font-medium min-w-[60px]">타깃:</span>
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                        Human IL-6
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-500 font-medium min-w-[60px]">실험 유형:</span>
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                        Sandwich ELISA
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-500 font-medium min-w-[60px]">카테고리:</span>
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                        ELISA Kit
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    💡 검색어에 <strong>제품명</strong>, <strong>타깃</strong>, <strong>실험 유형</strong>을 함께 입력하면 GPT가 자동으로 분석합니다.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // 상태 3: GPT 토글 ON, 분석 중
  if (analysisLoading) {
    return (
      <Card>
        <CardHeader className="flex items-center justify-between pb-3">
          <div className="flex-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
              <Brain className="h-4 w-4" />
              검색어 분석 결과 (GPT)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600">
              검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
            </p>
          </div>
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
        <CardHeader className="flex items-center justify-between pb-3">
          <div className="flex-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
              <Brain className="h-4 w-4" />
              검색어 분석 결과 (GPT)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600">
              검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
            </p>
          </div>
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
        <CardHeader className="flex items-center justify-between pb-3">
          <div className="flex-1">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
              <Brain className="h-4 w-4" />
              검색어 분석 결과 (GPT)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600">
              검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasSearched && searchQuery && (
              <Link href={`/test/search/analysis?q=${encodeURIComponent(searchQuery)}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  별도 페이지에서 보기
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 text-xs"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  접기
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  자세히 보기
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              {queryAnalysis.target && (
                <div className="text-xs">
                  <span className="text-slate-500">타깃:</span>{" "}
                  <strong className="text-slate-700">{queryAnalysis.target}</strong>
                </div>
              )}
              {queryAnalysis.targetExperiment && (
                <div className="text-xs">
                  <span className="text-slate-500">실험 유형:</span>{" "}
                  <strong className="text-slate-700">{queryAnalysis.targetExperiment}</strong>
                </div>
              )}
              {queryAnalysis.category && (
                <div className="text-xs">
                  <span className="text-slate-500">카테고리:</span>{" "}
                  <strong className="text-slate-700">
                    {queryAnalysis.category === "REAGENT" ? "시약" :
                    queryAnalysis.category === "TOOL" ? "기구" :
                    queryAnalysis.category === "EQUIPMENT" ? "장비" :
                    queryAnalysis.category}
                  </strong>
                </div>
              )}
              {queryAnalysis.properties && queryAnalysis.properties.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap gap-1.5">
                    {queryAnalysis.properties.map((prop: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {prop}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {queryAnalysis.purpose && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-1">목적</p>
                <p className="text-sm text-slate-700">{queryAnalysis.purpose}</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  // 4-3) 결과가 null이지만 에러도 없을 때
  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-3">
        <div className="flex-1">
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 whitespace-nowrap">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
          <p className="mt-1 text-xs text-slate-600">
            검색어에서 핵심 키워드, 항목, 카테고리를 추출해 보여줍니다.
          </p>
        </div>
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