"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Suspense } from "react";

function SearchAnalysisContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["search-intent", query],
    queryFn: async () => {
      if (!query) return null;
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "분석에 실패했습니다." }));
        throw new Error(error.error || "분석에 실패했습니다.");
      }
      return response.json();
    },
    enabled: !!query,
    retry: false,
  });

  const intent = data?.intent || null;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <PageHeader
          title="검색어 분석 결과 (GPT)"
          description="GPT가 검색어를 분석하여 추출한 타깃, 카테고리, 실험 유형 등의 정보입니다."
          icon={Brain}
          iconColor="text-purple-600"
        />

        <div className="flex items-center gap-2 mb-4">
          <Link href="/test/search" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="text-xs w-full sm:w-auto">
              <ArrowLeft className="h-3 w-3 mr-2" />
              <span className="hidden sm:inline">검색 페이지로 돌아가기</span>
              <span className="sm:hidden">돌아가기</span>
            </Button>
          </Link>
        </div>

        {/* 검색어 표시 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-800">검색어</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 rounded-lg text-base font-medium text-slate-800">
              {query || "검색어가 없습니다"}
            </div>
          </CardContent>
        </Card>

        {/* 분석 결과 */}
        {isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                분석 중...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                분석 오류
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  GPT 분석 중 오류가 발생했습니다.
                </p>
                <p className="text-xs text-slate-500">
                  검색어를 다시 확인하거나, 잠시 후 다시 시도해 주세요.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !intent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-800">분석 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                분석 결과를 가져오지 못했습니다.
                <br />
                검색어를 조금 더 구체적으로 입력해 보세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                GPT 분석 결과
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                검색어에서 추출된 핵심 정보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 타깃 */}
              {intent.target && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">타깃 (Target)</div>
                  <Badge variant="secondary" className="text-sm bg-purple-100 text-purple-700 border-purple-200 px-3 py-1.5">
                    {intent.target}
                  </Badge>
                </div>
              )}

              {/* 실험 유형 */}
              {intent.targetExperiment && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">실험 유형 (Experiment Type)</div>
                  <Badge variant="secondary" className="text-sm bg-blue-100 text-blue-700 border-blue-200 px-3 py-1.5">
                    {intent.targetExperiment}
                  </Badge>
                </div>
              )}

              {/* 카테고리 */}
              {intent.category && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">카테고리 (Category)</div>
                  <Badge variant="secondary" className="text-sm bg-green-100 text-green-700 border-green-200 px-3 py-1.5">
                    {intent.category === "REAGENT" ? "시약" :
                     intent.category === "TOOL" ? "기구" :
                     intent.category === "EQUIPMENT" ? "장비" :
                     intent.category}
                  </Badge>
                </div>
              )}

              {/* 속성 */}
              {intent.properties && intent.properties.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">속성 (Properties)</div>
                  <div className="flex flex-wrap gap-2">
                    {intent.properties.map((prop: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {prop}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 목적 */}
              {intent.purpose && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-medium text-slate-500">목적 (Purpose)</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{intent.purpose}</p>
                </div>
              )}

              {/* Raw JSON (개발/디버깅용) */}
              <details className="pt-2 border-t border-slate-200">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 font-medium">
                  Raw JSON 보기
                </summary>
                <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs overflow-auto border border-slate-200">
                  {JSON.stringify(intent, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function SearchAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-500">로딩 중...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <SearchAnalysisContent />
    </Suspense>
  );
}


