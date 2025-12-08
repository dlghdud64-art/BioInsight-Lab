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
    runSearch,
    gptEnabled,
    setGptEnabled,
  } = useTestFlow();
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-800">검색 설정</CardTitle>
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
              placeholder="예: Human IL-6 ELISA kit"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  runSearch();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs font-medium">
                카테고리
              </Label>
              <Select value={searchCategory} onValueChange={setSearchCategory}>
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

          {/* 2) 단계 이동 버튼 */}
          <div className="pt-2 border-t border-slate-200">
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