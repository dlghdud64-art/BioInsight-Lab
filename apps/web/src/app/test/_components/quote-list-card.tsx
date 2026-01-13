"use client";

import { TestCard } from "./test-card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface QuoteListCardProps {
  productCount?: number;
}

export function QuoteListCard({ productCount = 0 }: QuoteListCardProps) {
  const router = useRouter();

  return (
    <TestCard
      title="견적 요청 리스트"
      subtitle="그룹웨어 양식에 붙여넣을 견적 요청 리스트를 확인합니다."
    >
      {productCount > 0 ? (
        <div className="text-xs text-muted-foreground space-y-2">
          <p>{productCount}개 제품이 비교 목록에 추가되었습니다.</p>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/test/search")}
          >
            견적 요청 리스트 만들기
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          제품을 비교 목록에 추가하면 여기에 표시됩니다.
        </p>
      )}
    </TestCard>
  );
}

