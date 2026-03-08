"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Tag,
  Beaker,
  BookOpen,
  Target,
  Microscope,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

// ── 분석 중 스켈레톤 ─────────────────────────────────────────────────
function AnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* summary card skeleton */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-blue-200" />
          <div className="h-4 w-40 rounded bg-blue-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-blue-200/70" />
          <div className="h-4 w-4/5 rounded bg-blue-200/70" />
          <div className="h-4 w-3/5 rounded bg-blue-200/70" />
        </div>
      </div>
      {/* badges skeleton */}
      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-slate-200" />
          ))}
        </div>
      </div>
      {/* grid skeleton */}
      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 카테고리 레이블 한글화 ────────────────────────────────────────────
function categoryLabel(cat?: string) {
  if (!cat) return null;
  const map: Record<string, { label: string; color: string }> = {
    REAGENT: { label: "시약", color: "bg-purple-100 text-purple-700 border-purple-200" },
    TOOL: { label: "기구", color: "bg-green-100 text-green-700 border-green-200" },
    EQUIPMENT: { label: "장비", color: "bg-orange-100 text-orange-700 border-orange-200" },
  };
  return map[cat] ?? { label: cat, color: "bg-slate-100 text-slate-700 border-slate-200" };
}

// ── 본문 ─────────────────────────────────────────────────────────────
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
        const err = await response.json().catch(() => ({ error: "분석에 실패했습니다." }));
        throw new Error(err.error || "분석에 실패했습니다.");
      }
      return response.json();
    },
    enabled: !!query,
    retry: false,
  });

  const intent = data?.intent ?? null;

  // 검색 파라미터를 다음 단계로 전달할 URL 구성
  const compareUrl = query
    ? `/test/search?q=${encodeURIComponent(query)}&step=compare`
    : "/test/search";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-3xl">

        {/* ── 헤더 ── */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/test/search">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              검색으로 돌아가기
            </Button>
          </Link>
        </div>

        {/* ── 페이지 타이틀 ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 shadow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">AI 검색어 분석</h1>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            GPT가 검색어를 분석하여 추출한 실험 컨텍스트 및 카테고리 정보
          </p>
        </div>

        {/* ── 검색어 카드 ── */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4 flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-500 flex-shrink-0">검색어</span>
          <span className="font-semibold text-slate-900 truncate">{query || "—"}</span>
        </div>

        {/* ── 로딩 ── */}
        {isLoading && (
          <div className="space-y-2 mb-5">
            {/* 분석 중 텍스트 애니메이션 */}
            <div className="flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-100 px-5 py-3 mb-4">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600 flex-shrink-0" />
              <p className="text-sm text-purple-700 font-medium">
                AI가 수백만 건의 데이터를 분석 중입니다...
              </p>
            </div>
            <AnalysisSkeleton />
          </div>
        )}

        {/* ── 에러 ── */}
        {!isLoading && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700 text-sm">GPT 분석 오류</p>
              <p className="text-xs text-red-600 mt-1">
                분석 중 오류가 발생했습니다. 검색어를 조금 더 구체적으로 입력하거나 잠시 후 다시 시도해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* ── 결과 없음 ── */}
        {!isLoading && !error && !intent && !isLoading && query && (
          <div className="rounded-xl border bg-white p-8 text-center">
            <Microscope className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">분석 결과를 가져오지 못했습니다.</p>
            <p className="text-xs text-slate-400 mt-1">검색어를 더 구체적으로 입력해 보세요.</p>
          </div>
        )}

        {/* ── 분석 결과 ── */}
        {!isLoading && intent && (
          <div className="space-y-4">

            {/* 1. 핵심 요약 카드 (파란 배경) */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">AI 분석 요약</span>
              </div>
              {intent.purpose ? (
                <p className="text-sm text-blue-800 leading-relaxed">{intent.purpose}</p>
              ) : (
                <p className="text-sm text-blue-600">분석된 목적 정보가 없습니다.</p>
              )}
            </div>

            {/* 2. 카테고리 & 키워드 (Badge 해시태그) */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  카테고리 & 키워드
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <div className="flex flex-wrap gap-2">
                  {intent.category && (() => {
                    const cat = categoryLabel(intent.category);
                    return cat ? (
                      <Badge
                        variant="outline"
                        className={`text-sm px-3 py-1 font-semibold ${cat.color}`}
                      >
                        <Beaker className="h-3 w-3 mr-1" />
                        {cat.label}
                      </Badge>
                    ) : null;
                  })()}
                  {intent.targetExperiment && (
                    <Badge variant="outline" className="text-sm px-3 py-1 bg-blue-100 text-blue-700 border-blue-200 font-medium">
                      <FlaskConical className="h-3 w-3 mr-1" />
                      {intent.targetExperiment}
                    </Badge>
                  )}
                  {intent.target && (
                    <Badge variant="outline" className="text-sm px-3 py-1 bg-violet-100 text-violet-700 border-violet-200 font-medium">
                      <Target className="h-3 w-3 mr-1" />
                      {intent.target}
                    </Badge>
                  )}
                  {intent.properties?.map((prop: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs px-2.5 py-1 text-slate-600">
                      # {prop}
                    </Badge>
                  ))}
                  {!intent.category && !intent.targetExperiment && !intent.target && (
                    <span className="text-xs text-slate-400">추출된 키워드가 없습니다.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. 상세 스펙 그리드 */}
            {(intent.target || intent.targetExperiment || intent.category || intent.purpose) && (
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3 pt-4 px-5">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    상세 분석 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {intent.target && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Target</p>
                        <p className="text-sm font-medium text-slate-900">{intent.target}</p>
                      </div>
                    )}
                    {intent.targetExperiment && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">실험 유형</p>
                        <p className="text-sm font-medium text-slate-900">{intent.targetExperiment}</p>
                      </div>
                    )}
                    {intent.category && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">분류</p>
                        <p className="text-sm font-medium text-slate-900">
                          {intent.category === "REAGENT" ? "시약 (Reagent)"
                            : intent.category === "TOOL" ? "기구 (Tool)"
                            : intent.category === "EQUIPMENT" ? "장비 (Equipment)"
                            : intent.category}
                        </p>
                      </div>
                    )}
                    {intent.properties?.length > 0 && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">속성 ({intent.properties.length})</p>
                        <p className="text-sm font-medium text-slate-900">{intent.properties.join(", ")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. CTA: 제품 비교로 이동 */}
            <div className="pt-2">
              <Link href={compareUrl} className="block">
                <Button
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-13 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-base"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  이 조건으로 제품 비교하기
                  <ChevronRight className="h-5 w-5 ml-auto" />
                </Button>
              </Link>
              <p className="text-center text-xs text-slate-400 mt-2">AI 분석 조건을 기반으로 최적 제품을 찾아드립니다</p>
            </div>

            {/* 5. Raw JSON (접어두기) */}
            <details className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <summary className="cursor-pointer px-5 py-3 text-xs text-slate-500 hover:bg-slate-50 font-medium flex items-center gap-2 select-none">
                <span className="flex-1">Raw JSON 보기</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </summary>
              <pre className="px-5 pb-4 text-xs overflow-auto text-slate-600 bg-slate-50 border-t border-slate-100">
                {JSON.stringify(intent, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/60 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-purple-500" />
            <p className="text-sm text-slate-500">AI 분석 리포트 로딩 중...</p>
          </div>
        </div>
      }
    >
      <SearchAnalysisContent />
    </Suspense>
  );
}
