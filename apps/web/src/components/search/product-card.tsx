"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check, Package, ShoppingCart, Heart, Plus, Thermometer, Box, Calendar } from "lucide-react";
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
    purity?: number;
    grade?: string;
    stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "custom";
    stockText?: string;
    casNumber?: string;
    specification?: string;
    storageCondition?: string;
  };
  isInCompare?: boolean;
  onToggleCompare?: () => void;
  onAddToQuote?: () => void;
}

export function ProductCard({
  product,
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

  // 재고 상태는 표시하지 않음 (확실하지 않은 정보)

  // 핵심 스펙 추출 (용량, 보관 조건 등)
  const getKeySpecs = () => {
    const specs: { icon: any; label: string; value: string }[] = [];
    
    if (product.specification) {
      specs.push({ icon: Box, label: "용량", value: product.specification });
    }
    
    if (product.storageCondition) {
      specs.push({ icon: Thermometer, label: "보관", value: product.storageCondition });
    } else if (product.grade) {
      specs.push({ icon: Package, label: "Grade", value: product.grade });
    }

    return specs.slice(0, 3); // 최대 3개만 표시
  };

  const keySpecs = getKeySpecs();

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-100 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group">
      {/* 수직 스택 레이아웃 */}
      <div className="p-4 space-y-3">
        {/* 제품명 */}
        <Link href={`/products/${product.id}`} className="block">
          <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 hover:text-blue-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* 브랜드/캣넘버 */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {product.vendor && (
            <>
              <span>{product.vendor}</span>
              {product.catalogNumber && <span>·</span>}
            </>
          )}
          {product.catalogNumber && (
            <span className="font-mono">Cat. {product.catalogNumber}</span>
          )}
        </div>

        {/* 스펙 배지 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {keySpecs.length > 0 && keySpecs.map((spec, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border-0 font-normal"
            >
              {spec.value}
            </Badge>
          ))}
          {product.purity && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {product.purity}%
            </Badge>
          )}
          {product.category && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {product.category}
            </Badge>
          )}
        </div>

        {/* 가격 & 액션 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* 가격 */}
          <div>
            {product.price && product.price > 0 ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-blue-600">
                    ₩{product.price.toLocaleString("ko-KR")}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">(VAT 별도)</span>
                </div>
                {product.unit && (
                  <div className="text-xs text-gray-500">/ {product.unit}</div>
                )}
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-500">가격 문의</div>
            )}
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-center gap-2">
            {/* 비교함 담기 */}
            <Button
              variant="outline"
              size="sm"
              className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded h-9 w-9 p-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast({
                  title: "비교함에 추가됨",
                  description: "제품이 비교함에 추가되었습니다.",
                });
              }}
            >
              <Heart className="h-4 w-4" />
            </Button>

            {/* 견적 요청 */}
            <Link href={`/products/${product.id}`} onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all rounded h-9 py-2 px-4 text-sm"
              >
                <ShoppingCart className="h-4 w-4 mr-1.5" />
                견적 담기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
