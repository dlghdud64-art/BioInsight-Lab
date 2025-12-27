"use client";

import { TestCard } from "./test-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

interface CandidateProductsCardProps {
  products?: Array<{
    id: string;
    name: string;
    brand?: string;
    category?: string;
    vendors?: Array<{
      priceInKRW?: number;
      leadTime?: number;
    }>;
  }>;
  isLoading?: boolean;
  selectedProductIds?: string[];
  onToggleSelect?: (productId: string) => void;
}

export function CandidateProductsCard({
  products = [],
  isLoading = false,
  selectedProductIds = [],
  onToggleSelect,
}: CandidateProductsCardProps) {
  return (
    <TestCard
      title="제품 후보 & 비교"
      subtitle="검색 결과 중 비교 대상 제품들을 확인합니다."
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">검색 중...</p>
      ) : products.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {products.slice(0, 5).map((product) => {
            const isSelected = selectedProductIds.includes(product.id);
            const minPrice = product.vendors?.reduce(
              (min, v) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
              null as number | null
            );
            return (
              <div
                key={product.id}
                className="p-2 border rounded text-xs hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    {product.brand && (
                      <div className="text-muted-foreground">{product.brand}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                        </Badge>
                      )}
                      {minPrice && (
                        <span className="text-muted-foreground">{minPrice.toLocaleString()}원</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect?.(product.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          검색어를 입력하면 결과가 표시됩니다.
        </p>
      )}
    </TestCard>
  );
}

