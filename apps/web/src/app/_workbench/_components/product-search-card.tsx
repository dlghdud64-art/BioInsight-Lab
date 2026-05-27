"use client";

import { TestCard } from "./test-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

interface ProductSearchCardProps {
  searchQuery: string;
  category: string;
  sortBy: "relevance" | "price_low" | "price_high" | "lead_time";
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onSortByChange: (sortBy: "relevance" | "price_low" | "price_high" | "lead_time") => void;
  onSearch: () => void;
}

export function ProductSearchCard({
  searchQuery,
  category,
  sortBy,
  onQueryChange,
  onCategoryChange,
  onSortByChange,
  onSearch,
}: ProductSearchCardProps) {

  return (
    <TestCard
      title="제품 검색"
      subtitle="제품명, 벤더, 카테고리를 입력하고 GPT 기반 검색을 체험합니다."
    >
      <Input
        value={searchQuery}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && searchQuery) {
            onSearch();
          }
        }}
        placeholder='예: "Human IL-6 ELISA kit", "0.22um filter"'
        className="text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={category || "all"} onValueChange={(v) => onCategoryChange(v === "all" ? "" : v)}>
          <SelectTrigger className="text-xs h-8">
            <SelectValue placeholder="카테고리" />
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
        <Select value={sortBy} onValueChange={(v: any) => onSortByChange(v)}>
          <SelectTrigger className="text-xs h-8">
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
      <Button size="sm" className="w-full" onClick={onSearch} disabled={!searchQuery}>
        <Search className="h-4 w-4 mr-2" />
        검색
      </Button>
      <p className="text-[10px] text-muted-foreground">
        예: "Human IL-6 ELISA kit", "0.22um filter"
      </p>
    </TestCard>
  );
}