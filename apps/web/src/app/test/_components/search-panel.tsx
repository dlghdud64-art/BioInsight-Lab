"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Search, ChevronDown, ChevronUp, Brain, Loader2, AlertCircle, FileText, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export function SearchPanel() {
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    searchCategory,
    setSearchCategory,
    searchBrand,
    setSearchBrand,
    sortBy,
    setSortBy,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    grade,
    setGrade,
    runSearch,
    gptEnabled,
    setGptEnabled,
  } = useTestFlow();

  return (
    <div className="space-y-3">
      <Card className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">
            <span>통합 검색 & AI 분석</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            제품을 검색하고 후보를 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 현재 검색어 표시 (읽기 전용) */}
          {searchQuery ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                🔍 현재 검색어
              </Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-3 py-1.5 font-medium break-all"
                >
                  {searchQuery}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                  onClick={() => {
                    setSearchQuery("");
                  }}
                  aria-label="검색어 초기화"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                검색어
              </Label>
              <p className="text-xs text-slate-500">
                우측 상단 검색창에서 검색어를 입력하세요.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-medium">
                카테고리
              </Label>
              <Select value={searchCategory || "all"} onValueChange={(v) => setSearchCategory(v === "all" ? "" : v)}>
                <SelectTrigger id="category" className="h-8 text-xs bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sort" className="text-xs font-medium">
                정렬
              </Label>
              <Select
                value={sortBy}
                onValueChange={(v: any) => setSortBy(v)}
              >
                <SelectTrigger id="sort" className="h-8 text-xs bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">관련도</SelectItem>
                  <SelectItem value="price_low">가격 낮은순</SelectItem>
                  <SelectItem value="price_high">가격 높은순</SelectItem>
                  <SelectItem value="lead_time">납기 빠른순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 고급 필터 */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <Label className="text-xs font-medium text-slate-700 cursor-pointer">고급 필터</Label>
              <div className="flex items-center gap-2">
                {(minPrice !== undefined || maxPrice !== undefined || grade || searchBrand) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMinPrice(undefined);
                      setMaxPrice(undefined);
                      setGrade(undefined);
                      setSearchBrand("");
                    }}
                  >
                    필터 초기화
                  </Button>
                )}
                {isAdvancedFilterOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </button>

            {isAdvancedFilterOpen && (
              <div className="mt-3 space-y-3">
                {/* 브랜드/벤더 */}
                <div className="space-y-1">
                  <Label htmlFor="brand" className="text-[10px] text-slate-600">
                    브랜드/벤더
                  </Label>
                  <Input
                    id="brand"
                    placeholder="예: Thermo Fisher, Bio-Rad"
                    value={searchBrand}
                    onChange={(e) => setSearchBrand(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                {/* 가격 범위 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min-price" className="text-[10px] text-slate-600">
                      최소 가격 ()
                    </Label>
                    <Input
                      id="min-price"
                      type="number"
                      placeholder="0"
                      value={minPrice || ""}
                      onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="max-price" className="text-[10px] text-slate-600">
                      최대 가격 ()
                    </Label>
                    <Input
                      id="max-price"
                      type="number"
                      placeholder="무제한"
                      value={maxPrice || ""}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                {/* Grade */}
                <div className="space-y-1">
                  <Label htmlFor="grade" className="text-[10px] text-slate-600">
                    Grade
                  </Label>
                  <Select value={grade || "all"} onValueChange={(v) => setGrade(v === "all" ? undefined : v)}>
                    <SelectTrigger id="grade" className="text-xs h-8">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="HPLC">HPLC Grade</SelectItem>
                      <SelectItem value="GMP">GMP</SelectItem>
                      <SelectItem value="EP/USP">EP/USP</SelectItem>
                      <SelectItem value="Cell Culture">Cell Culture Tested</SelectItem>
                      <SelectItem value="Analytical">Analytical Grade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-slate-800">옵션</CardTitle>
          <CardDescription className="text-[10px] text-slate-500">
            검색 시 추가로 실행할 옵션을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {/* GPT 분석 옵션 */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="gpt-analysis"
                checked={gptEnabled}
                onCheckedChange={(checked) => setGptEnabled(checked === true)}
              />
              <span className="font-medium text-slate-700">검색 시 GPT 분석 함께 실행</span>
            </label>
            <p className="text-[11px] text-slate-500 pl-6">
              검색 실행 시, 검색어를 GPT로 분석하여 타깃/카테고리/실험 유형을 함께 표시합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 검색어 분석 결과 */}
      <SearchAnalysisResultCard />
    </div>
  );
}

function SearchAnalysisResultCard() {
  const {
    queryAnalysis,
    gptEnabled,
    hasSearched,
    analysisLoading,
    analysisError,
    searchQuery
  } = useTestFlow();

  // GPT 토글 OFF이거나 검색 전이면 표시 안함
  if (!gptEnabled || !hasSearched) {
    return null;
  }

  // 분석 중
  if (analysisLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              GPT가 검색어를 분석하는 중입니다...
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 에러
  if (analysisError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <AlertCircle className="h-3 w-3 mt-0.5 text-amber-500" />
              <div>
                <p className="font-medium">GPT 분석 중 오류가 발생했습니다.</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  검색은 정상적으로 수행되었으니, 필요하다면 다시 시도해 주세요.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 결과 없음
  if (!queryAnalysis) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            검색어 분석 결과 (GPT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">
            분석 결과를 가져오지 못했습니다.
            <br />
            검색어를 조금 더 구체적으로 입력해 보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 결과 있음
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            검색어 분석 결과 (GPT)
          </CardTitle>
          <Link href={`/test/search/analysis?q=${encodeURIComponent(searchQuery || "")}`}>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 bg-slate-900 text-white hover:bg-slate-800"
            >
              <FileText className="h-3 w-3 mr-1" />
              결과 보기
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {queryAnalysis.target && (
          <div className="text-xs">
            <span className="text-slate-500">타깃:</span>{" "}
            <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 ml-1">
              {queryAnalysis.target}
            </Badge>
          </div>
        )}
        {queryAnalysis.targetExperiment && (
          <div className="text-xs">
            <span className="text-slate-500">실험 유형:</span>{" "}
            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 ml-1">
              {queryAnalysis.targetExperiment}
            </Badge>
          </div>
        )}
        {queryAnalysis.category && (
          <div className="text-xs">
            <span className="text-slate-500">카테고리:</span>{" "}
            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-green-200 ml-1">
              {queryAnalysis.category === "REAGENT" ? "시약" :
               queryAnalysis.category === "TOOL" ? "기구" :
               queryAnalysis.category === "EQUIPMENT" ? "장비" :
               queryAnalysis.category}
            </Badge>
          </div>
        )}
        {queryAnalysis.properties && queryAnalysis.properties.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <div className="text-[10px] text-slate-500 mb-1.5">속성:</div>
            <div className="flex flex-wrap gap-1">
              {queryAnalysis.properties.map((prop: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-[10px]">
                  {prop}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {queryAnalysis.purpose && (
          <div className="pt-2 border-t border-slate-200">
            <div className="text-[10px] text-slate-500 mb-1">목적</div>
            <p className="text-xs text-slate-700 leading-relaxed">{queryAnalysis.purpose}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}