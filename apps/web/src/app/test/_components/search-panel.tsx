"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

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
  } = useTestFlow();

  return (
    <div className="space-y-3">
      <Card className="bg-slate-900 rounded-xl shadow-none p-4 border border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">
            <span>검색 필터</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            카테고리·브랜드·가격 등 검색 조건을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 현재 검색어 표시 (읽기 전용) */}
          {searchQuery ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">
                🔍 현재 검색어
              </Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-blue-950/20 text-blue-700 border-blue-800 px-3 py-1.5 font-medium break-all"
                >
                  {searchQuery}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-400"
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
              <Label className="text-xs font-medium text-slate-300">
                검색어
              </Label>
              <p className="text-xs text-slate-500">
                우측 상단 검색창에서 검색어를 입력하세요.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-medium">
                카테고리
              </Label>
              <Select value={searchCategory || "all"} onValueChange={(v) => setSearchCategory(v === "all" ? "" : v)}>
                <SelectTrigger id="category" className="h-8 text-xs bg-slate-900 border-slate-800 focus:ring-2 focus:ring-blue-500">
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
                <SelectTrigger id="sort" className="h-8 text-xs bg-slate-900 border-slate-800 focus:ring-2 focus:ring-blue-500">
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
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <Label className="text-xs font-medium text-slate-300 cursor-pointer">고급 필터</Label>
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
                  <Label htmlFor="brand" className="text-[10px] text-slate-400">
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
                    <Label htmlFor="min-price" className="text-[10px] text-slate-400">
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
                    <Label htmlFor="max-price" className="text-[10px] text-slate-400">
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
                  <Label htmlFor="grade" className="text-[10px] text-slate-400">
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

    </div>
  );
}