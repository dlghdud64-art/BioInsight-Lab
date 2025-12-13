"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";

export function SearchPanel() {
  const {
    searchQuery,
    setSearchQuery,
    searchCategory,
    setSearchCategory,
    sortBy,
    setSortBy,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    stockStatus,
    setStockStatus,
    leadTime,
    setLeadTime,
    grade,
    setGrade,
    runSearch,
    gptEnabled,
    setGptEnabled,
  } = useTestFlow();
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-50">
              Step 1
            </span>
            <span>제품 검색</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            제품을 검색하고 후보를 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-query" className="text-xs font-medium">
              검색어
            </Label>
            <Input
              id="search-query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="예: Human IL-6 ELISA kit — 제품명이나 벤더 이름을 입력해 보세요"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  runSearch();
                }
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              제품명, 벤더, 카테고리 키워드로 검색하면 GPT가 관련 제품을 추천해 줍니다.
            </p>
            {/* 샘플 검색어 칩 */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-medium">샘플 검색어:</span>
              {[
                "Human IL-6 ELISA kit",
                "PCR Master Mix",
                "Western Blot Antibody",
                "Cell Culture Medium",
                "DNA Extraction Kit",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setSearchQuery(example);
                    setTimeout(() => runSearch(), 100);
                  }}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-sm"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs font-medium">
                카테고리
              </Label>
              <Select value={searchCategory || "all"} onValueChange={(v) => setSearchCategory(v === "all" ? "" : v)}>
                <SelectTrigger id="category" className="text-xs">
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

            <div className="space-y-2">
              <Label htmlFor="sort" className="text-xs font-medium">
                정렬
              </Label>
              <Select
                value={sortBy}
                onValueChange={(v: any) => setSortBy(v)}
              >
                <SelectTrigger id="sort" className="text-xs">
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
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700">고급 필터</Label>
              {(minPrice !== undefined || maxPrice !== undefined || stockStatus || leadTime || grade) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => {
                    setMinPrice(undefined);
                    setMaxPrice(undefined);
                    setStockStatus(undefined);
                    setLeadTime(undefined);
                    setGrade(undefined);
                  }}
                >
                  필터 초기화
                </Button>
              )}
            </div>

            {/* 가격 범위 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="min-price" className="text-[10px] text-slate-600">
                  최소 가격 (₩)
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
                  최대 가격 (₩)
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

            {/* 재고 여부 */}
            <div className="space-y-1">
              <Label htmlFor="stock-status" className="text-[10px] text-slate-600">
                재고 여부
              </Label>
              <Select value={stockStatus || "all"} onValueChange={(v) => setStockStatus(v === "all" ? undefined : v)}>
                <SelectTrigger id="stock-status" className="text-xs h-8">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="in_stock">재고 있음</SelectItem>
                  <SelectItem value="low_stock">재고 부족</SelectItem>
                  <SelectItem value="out_of_stock">품절</SelectItem>
                  <SelectItem value="order_required">주문 필요</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 납기 */}
            <div className="space-y-1">
              <Label htmlFor="lead-time" className="text-[10px] text-slate-600">
                납기
              </Label>
              <Select value={leadTime || "all"} onValueChange={(v) => setLeadTime(v === "all" ? undefined : v)}>
                <SelectTrigger id="lead-time" className="text-xs h-8">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="immediate">즉시</SelectItem>
                  <SelectItem value="within_week">1주 이내</SelectItem>
                  <SelectItem value="within_month">1개월 이내</SelectItem>
                  <SelectItem value="over_month">1개월 이상</SelectItem>
                </SelectContent>
              </Select>
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

          <Button
            onClick={runSearch}
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            disabled={!searchQuery}
          >
            <Search className="h-4 w-4 mr-2" />
            검색 실행
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800">옵션</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            검색 시 추가로 실행할 옵션을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {/* 1) GPT 분석 옵션 */}
          <div className="space-y-1 pb-4">
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

          {/* 2) 단계 이동 버튼 */}
          <div className="pt-4 border-t border-slate-200 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-xs"
              onClick={() => router.push("/test/quote")}
            >
              품목 리스트 단계로 이동
              <ArrowRight className="h-3 w-3" />
            </Button>
            <p className="mt-1 text-[11px] text-slate-500">
              현재까지 선택한 품목을 확인하고 수정하려면 클릭하세요.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}