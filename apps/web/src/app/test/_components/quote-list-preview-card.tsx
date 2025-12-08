"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay } from "@/components/products/price-display";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function QuoteListPreviewCard() {
  const { quoteItems, products } = useTestFlow();

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const previewCount = 5;
  const previewItems = quoteItems.slice(0, previewCount);
  const remainingCount = quoteItems.length - previewCount;

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              품목 리스트
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {quoteItems.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 text-center py-4">
              품목을 추가하면 여기에 표시됩니다.
            </p>
            <Link href="/test/quote">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled
              >
                견적 보기 →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 상단 요약 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">
                품목 리스트 ({quoteItems.length}개)
              </span>
              <span className="font-semibold text-slate-900">
                합계 ₩{totalAmount.toLocaleString("ko-KR")}
              </span>
            </div>

            {/* 미리보기 테이블 */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-8 text-[10px] p-1">No.</TableHead>
                    <TableHead className="text-[10px] p-1">제품명</TableHead>
                    <TableHead className="w-12 text-[10px] p-1 text-right">수량</TableHead>
                    <TableHead className="w-16 text-[10px] p-1 text-right">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewItems.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    const vendor = product?.vendors?.[0];
                    return (
                      <TableRow key={item.id} className="h-8">
                        <TableCell className="text-[10px] p-1">{index + 1}</TableCell>
                        <TableCell className="text-[10px] p-1">
                          <div className="truncate max-w-[120px]" title={product?.name || item.productName || "제품"}>
                            {product?.name || item.productName || "제품"}
                          </div>
                          {product?.vendors?.[0]?.vendor?.name && (
                            <div className="text-[9px] text-slate-500 truncate max-w-[120px]">
                              {product.vendors[0].vendor.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] p-1 text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-[10px] p-1 text-right font-medium">
                          {item.lineTotal ? (
                            <PriceDisplay amount={item.lineTotal} currency={vendor?.currency || "KRW"} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {remainingCount > 0 && (
                    <TableRow className="h-8">
                      <TableCell colSpan={4} className="text-[10px] p-1 text-center text-slate-500">
                        … 그 외 {remainingCount}개 품목
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 하단 버튼 */}
            <Link href="/test/quote">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs bg-slate-900 hover:bg-slate-800"
              >
                견적 보기 →
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}