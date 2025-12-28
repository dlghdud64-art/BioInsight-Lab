"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, GitCompare, ExternalLink, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    vendor?: string;
    category?: string;
    price?: number;
    unit?: string;
    description?: string;
    catalogNumber?: string;
    // v3.8 신규 필드
    purity?: number; // 예: 99.9
    grade?: string; // 예: "ACS Grade", "HPLC"
    stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "custom"; // custom일 경우 stockText 사용
    stockText?: string; // 예: "2 Weeks"
    casNumber?: string; // 예: "67-64-1"
  };
  isInCompare: boolean;
  onToggleCompare: () => void;
  onAddToQuote: () => void;
}

export function ProductCard({
  product,
  isInCompare,
  onToggleCompare,
  onAddToQuote,
}: ProductCardProps) {
  const { toast } = useToast();
  const [casCopied, setCasCopied] = useState(false);

  const handleCopyCAS = () => {
    if (!product.casNumber) return;
    navigator.clipboard.writeText(product.casNumber);
    setCasCopied(true);
    toast({
      title: "복사됨",
      description: `CAS 번호가 클립보드에 복사되었습니다.`,
    });
    setTimeout(() => setCasCopied(false), 2000);
  };

  const getStockBadge = () => {
    if (!product.stockStatus) return null;

    if (product.stockStatus === "in_stock") {
      return (
        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
          In Stock
        </Badge>
      );
    }

    if (product.stockStatus === "low_stock" || product.stockStatus === "custom") {
      const text = product.stockText || "Low Stock";
      return (
        <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
          {text}
        </Badge>
      );
    }

    if (product.stockStatus === "out_of_stock") {
      return (
        <Badge variant="outline" className="text-slate-500">
          Out of Stock
        </Badge>
      );
    }

    return null;
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 md:p-4 hover:border-slate-300 transition-colors bg-white">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        {/* 좌측: 제품 정보 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h3 className="font-semibold text-sm md:text-base text-slate-900 break-words mb-1.5">
              {product.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-2">
              {product.vendor && (
                <span className="text-xs md:text-sm text-slate-600 font-medium">
                  {product.vendor}
                </span>
              )}
              {product.category && (
                <>
                  <span className="text-slate-400 hidden md:inline">·</span>
                  <Badge variant="outline" className="text-[10px] md:text-xs">
                    {product.category}
                  </Badge>
                </>
              )}
            </div>

            {/* 요약 뱃지 그룹 */}
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              {/* Purity */}
              {product.purity && (
                <Badge variant="secondary" className="text-xs">
                  {product.purity}%
                </Badge>
              )}

              {/* Grade */}
              {product.grade && (
                <Badge variant="outline" className="text-xs">
                  {product.grade}
                </Badge>
              )}

              {/* Stock Status */}
              {getStockBadge()}

              {/* CAS Number */}
              {product.casNumber && (
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={handleCopyCAS}
                >
                  {casCopied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      CAS {product.casNumber}
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-xs md:text-sm text-slate-600 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-500">
            {product.catalogNumber && (
              <div>
                <span className="font-medium">Cat. No:</span> {product.catalogNumber}
              </div>
            )}
          </div>
        </div>

        {/* 우측: 가격 및 액션 버튼 */}
        <div className="flex flex-row md:flex-col md:items-end justify-between md:justify-start gap-3 md:gap-3 md:min-w-[180px]">
          {product.price && (
            <div className="text-left md:text-right">
              <div className="text-base md:text-lg font-bold text-slate-900">
                ₩{product.price.toLocaleString("ko-KR")}
              </div>
              {product.unit && (
                <div className="text-[10px] md:text-xs text-slate-500">/ {product.unit}</div>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-2">
            <Button
              size="sm"
              variant={isInCompare ? "default" : "outline"}
              onClick={onToggleCompare}
              className={`text-xs md:text-sm h-8 md:h-9 ${isInCompare ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            >
              <GitCompare className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
              <span className="hidden md:inline">{isInCompare ? "비교됨" : "비교"}</span>
              <span className="md:hidden">{isInCompare ? "✓" : ""}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddToQuote}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm h-8 md:h-9"
            >
              <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
              <span className="hidden md:inline">품목 추가</span>
              <span className="md:hidden">추가</span>
            </Button>
          </div>

          <Link href={`/products/${product.id}`} className="md:block">
            <Button size="sm" variant="ghost" className="text-[10px] md:text-xs h-7 md:h-8 w-full md:w-auto">
              <ExternalLink className="h-3 w-3 md:mr-1" />
              <span className="hidden md:inline">상세 보기</span>
              <span className="md:hidden">상세</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

