"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Heart, Thermometer, Box, FlaskConical } from "lucide-react";
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
    imageUrl?: string;
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
  const [imgError, setImgError] = useState(false);
  const imageSrc = product.imageUrl || `/api/products/${product.id}/image`;
  const showFallback = imgError;

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
        {/* 썸네일 + 제품명 */}
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 shrink-0 rounded-md border border-slate-100 bg-white overflow-hidden flex items-center justify-center">
            {!showFallback ? (
              <img
                src={imageSrc}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <FlaskConical className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/products/${product.id}`} className="block">
              <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
            </Link>
            {/* 브랜드/캣넘버 */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
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
          </div>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-2 pt-2 border-t border-gray-100">
          {/* 가격 */}
          <div className="flex-shrink-0">
            {product.price && product.price > 0 ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-lg font-bold text-blue-600">
                    ₩{product.price.toLocaleString("ko-KR")}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">(VAT 별도)</span>
                </div>
                {product.unit && (
                  <div className="text-xs text-gray-500 whitespace-nowrap">/ {product.unit}</div>
                )}
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-500">가격 문의</div>
            )}
          </div>

          {/* 버튼 그룹: 견적 담기(Primary) / 비교함(보조) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded h-9 w-9 p-0"
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
            <Link href={`/products/${product.id}`} onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded h-9 py-2 px-4 text-sm font-medium"
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
