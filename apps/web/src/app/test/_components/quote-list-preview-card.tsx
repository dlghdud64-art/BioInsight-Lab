"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay } from "@/components/products/price-display";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function QuoteListPreviewCard() {
  const { quoteItems, products, updateQuoteItem } = useTestFlow();
  const [editingQuantities, setEditingQuantities] = useState<Record<string, number>>({});

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  // 전체 품목 표시 (스크롤로 확인 가능)
  const previewItems = quoteItems;
  const remainingCount = 0;

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuoteItem(itemId, { quantity: newQuantity });
    setEditingQuantities((prev) => ({ ...prev, [itemId]: newQuantity }));
  };

  const handleQuantityInput = (itemId: string, value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setEditingQuantities((prev) => ({ ...prev, [itemId]: num }));
    }
  };

  const handleQuantityBlur = (itemId: string) => {
    const quantity = editingQuantities[itemId];
    if (quantity && quantity >= 1) {
      handleQuantityChange(itemId, quantity);
    } else {
      // 원래 값으로 복원
      const item = quoteItems.find((i) => i.id === itemId);
      if (item) {
        setEditingQuantities((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    }
  };

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
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow className="h-9">
                      <TableHead className="w-8 text-[10px] p-2">No.</TableHead>
                      <TableHead className="text-[10px] p-2">제품명</TableHead>
                      <TableHead className="w-20 text-[10px] p-2 text-right">수량</TableHead>
                      <TableHead className="w-20 text-[10px] p-2 text-right">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {previewItems.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    const vendor = product?.vendors?.[0];
                    return (
                      <TableRow key={item.id} className="h-10">
                        <TableCell className="text-[11px] p-2">{index + 1}</TableCell>
                        <TableCell className="text-[11px] p-2">
                          <div className="truncate max-w-[140px]" title={product?.name || item.productName || "제품"}>
                            {product?.name || item.productName || "제품"}
                          </div>
                          {product?.vendors?.[0]?.vendor?.name && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {product.vendors[0].vendor.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => handleQuantityChange(item.id, (item.quantity || 1) - 1)}
                              disabled={(item.quantity || 1) <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={editingQuantities[item.id] ?? item.quantity ?? 1}
                              onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                              onBlur={() => handleQuantityBlur(item.id)}
                              className="h-7 w-14 text-center text-[11px] p-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={() => handleQuantityChange(item.id, (item.quantity || 1) + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] p-2 text-right font-medium">
                          {item.lineTotal ? (
                            <PriceDisplay price={item.lineTotal} currency={vendor?.currency || "KRW"} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {remainingCount > 0 && (
                    <TableRow className="h-9">
                      <TableCell colSpan={4} className="text-[10px] p-2 text-center text-slate-500">
                        … 그 외 {remainingCount}개 품목
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
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

