"use client";

import { useEffect, useState } from "react";
import { useCompareStore } from "@/lib/store/compare-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { ShoppingCart, GitCompare, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function SearchResultList({ query }: { query: string }) {
  const [results, setResults] = useState<any[]>([]);
  const { productIds, addProduct, removeProduct, hasProduct } = useCompareStore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!query) return;

    fetch(`/api/search?q=${query}`)
      .then((res) => res.json())
      .then((data) => setResults(data));
  }, [query]);

  const handleToggleCompare = (productId: string, productName: string) => {
    if (hasProduct(productId)) {
      removeProduct(productId);
      toast({
        title: "비교에서 제거",
        description: `${productName}이(가) 비교 목록에서 제거되었습니다.`,
      });
    } else {
      if (productIds.length >= 5) {
        toast({
          title: "최대 개수 초과",
          description: "최대 5개까지 비교할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }
      addProduct(productId);
      toast({
        title: "비교에 추가",
        description: `${productName}이(가) 비교 목록에 추가되었습니다.`,
      });
    }
  };

  const handleAddToQuote = (product: any) => {
    // 품목 리스트에 추가하려면 test/quote 페이지로 이동하거나 상태 관리 필요
    toast({
      title: "품목 추가",
      description: "품목 리스트 기능을 사용하려면 기능 체험 플로우를 이용해주세요.",
      action: (
        <Link href="/test/search">
          <Button size="sm" variant="outline">
            기능 체험 플로우로 이동
          </Button>
        </Link>
      ),
    });
  };

  if (!query) return <p className="text-muted-foreground">검색어를 입력하세요.</p>;
  if (results.length === 0) return <p className="text-muted-foreground">검색 결과가 없습니다.</p>;

  return (
    <div className="space-y-4">
      {results.map((p: any) => {
        const isInCompare = hasProduct(p.id);
        return (
          <div
            key={p.id}
            className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              {/* 좌측: 제품 정보 */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h3 className="font-semibold text-base text-slate-900">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-600">{p.vendor}</span>
                    {p.category && (
                      <>
                        <span className="text-slate-400">·</span>
                        <Badge variant="outline" className="text-xs">
                          {p.category}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {p.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {p.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  {p.spec && (
                    <div>
                      <span className="font-medium">Spec:</span> {p.spec}
                    </div>
                  )}
                  {p.catalogNumber && (
                    <div>
                      <span className="font-medium">Cat. No:</span> {p.catalogNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 가격 및 액션 버튼 */}
              <div className="flex flex-col items-end gap-3 min-w-[180px]">
                {p.price && (
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">
                      ₩{p.price.toLocaleString("ko-KR")}
                    </div>
                    {p.unit && (
                      <div className="text-xs text-slate-500">/ {p.unit}</div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isInCompare ? "default" : "outline"}
                    onClick={() => handleToggleCompare(p.id, p.name)}
                    className={isInCompare ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                  >
                    <GitCompare className="h-4 w-4 mr-1" />
                    {isInCompare ? "비교됨" : "비교"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddToQuote(p)}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    품목 추가
                  </Button>
                </div>

                <Link href={`/products/${p.id}`}>
                  <Button size="sm" variant="ghost" className="text-xs">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    상세 보기
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

