"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2 } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";

interface VirtualizedTableBodyProps {
  fields: Array<{ key: string; label: string }>;
  products: any[];
  manualLeadTimes: Record<string, number>;
  averageLeadTimes: Record<string, number>;
  getAverageLeadTime: (product: any) => number | null;
  getDifferenceHighlight: (key: string, allValues: any[]) => string;
  getOptimalHighlight: (key: string, value: any, allValues: any[]) => string;
  onLeadTimeEdit: (productId: string, vendorIndex: number) => void;
  editingLeadTime: { productId: string; vendorIndex: number } | null;
  tempLeadTime: string;
  setTempLeadTime: (value: string) => void;
  onLeadTimeSave: () => void;
  onLeadTimeCancel: () => void;
}

export function VirtualizedTableBody({
  fields,
  products,
  manualLeadTimes,
  averageLeadTimes,
  getAverageLeadTime,
  getDifferenceHighlight,
  getOptimalHighlight,
  onLeadTimeEdit,
  editingLeadTime,
  tempLeadTime,
  setTempLeadTime,
  onLeadTimeSave,
  onLeadTimeCancel,
}: VirtualizedTableBodyProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 각 행의 예상 높이
    overscan: 5, // 화면 밖에 렌더링할 추가 행 수
  });

  return (
    <>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const field = fields[Number(virtualRow.key)];
        return (
          <TableRow
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
                <TableCell className="sticky left-0 bg-white font-medium w-[100px] sm:w-[120px] md:w-[150px] text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4 z-10">
                  {field.label}
                </TableCell>
                {products.map((product: any) => {
                  let value: any;
                  let allValues: any[] = [];

                  // 필드별 값 추출 (기존 로직과 동일)
                  if (field.key === "price") {
                    value = product.vendors?.[0]?.priceInKRW || 0;
                    allValues = products.map((p: any) => p.vendors?.[0]?.priceInKRW || 0);
                  } else if (field.key === "leadTime") {
                    const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
                    const manualLeadTime = manualLeadTimes[vendorKey];
                    value = manualLeadTime || getAverageLeadTime(product) || 0;
                    allValues = products.map((p: any) => {
                      const pVendorKey = `${p.id}_${p.vendors?.[0]?.vendor?.id || 0}`;
                      const pManualLeadTime = manualLeadTimes[pVendorKey];
                      return pManualLeadTime || getAverageLeadTime(p) || 0;
                    });
                  } else if (field.key === "stockStatus") {
                    value = product.vendors?.[0]?.stockStatus || "-";
                    allValues = products.map((p: any) => p.vendors?.[0]?.stockStatus || "-");
                  } else if (field.key === "minOrderQty") {
                    value = product.vendors?.[0]?.minOrderQty || "-";
                    allValues = products.map((p: any) => p.vendors?.[0]?.minOrderQty || "-");
                  } else if (field.key === "vendorCount") {
                    value = product.vendors?.length || 0;
                    allValues = products.map((p: any) => p.vendors?.length || 0);
                  } else if (field.key === "category") {
                    value = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category;
                    allValues = products.map((p: any) => PRODUCT_CATEGORIES[p.category as keyof typeof PRODUCT_CATEGORIES] || p.category);
                  } else if (field.key === "catalogNumber") {
                    value = product.catalogNumber || "-";
                    allValues = products.map((p: any) => p.catalogNumber || "-");
                  } else if (field.key === "specification") {
                    value = product.specification || "-";
                    allValues = products.map((p: any) => p.specification || "-");
                  } else if (field.key === "grade") {
                    value = product.grade || "-";
                    allValues = products.map((p: any) => p.grade || "-");
                  } else if (field.key === "pharmacopoeia") {
                    value = product.pharmacopoeia || "-";
                    allValues = products.map((p: any) => p.pharmacopoeia || "-");
                  } else if (field.key === "coaUrl") {
                    value = product.coaUrl ? "있음" : "-";
                    allValues = products.map((p: any) => (p.coaUrl ? "있음" : "-"));
                  } else if (field.key === "countryOfOrigin") {
                    value = product.countryOfOrigin || "-";
                    allValues = products.map((p: any) => p.countryOfOrigin || "-");
                  } else if (field.key === "manufacturer") {
                    value = product.manufacturer || "-";
                    allValues = products.map((p: any) => p.manufacturer || "-");
                  } else {
                    value = product[field.key] || "-";
                    allValues = products.map((p: any) => p[field.key] || "-");
                  }

                  const cellClassName = `${getDifferenceHighlight(field.key, allValues)} ${getOptimalHighlight(field.key, value, allValues)}`;

                  // 납기일 필드 특별 처리
                  if (field.key === "leadTime") {
                    const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
                    const manualLeadTime = manualLeadTimes[vendorKey];
                    const averageLeadTime = getAverageLeadTime(product);
                    const displayLeadTime = manualLeadTime || averageLeadTime;
                    const isEditing = editingLeadTime?.productId === product.id && editingLeadTime?.vendorIndex === 0;

                    return (
                      <TableCell key={product.id} className={`${cellClassName} text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4`}>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={tempLeadTime}
                              onChange={(e) => setTempLeadTime(e.target.value)}
                              className="h-6 w-16 text-xs"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onLeadTimeSave}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onLeadTimeCancel}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-slate-50 p-1 rounded"
                            onClick={() => onLeadTimeEdit(product.id, 0)}
                          >
                            {displayLeadTime && displayLeadTime > 0 ? `${displayLeadTime}일` : "-"}
                            {!manualLeadTime && averageLeadTime && (
                              <span className="text-[9px] text-slate-500 ml-1">(평균)</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  }

                  // 가격 필드 특별 처리
                  if (field.key === "price") {
                    return (
                      <TableCell key={product.id} className={`${cellClassName} text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4`}>
                        {value > 0 ? (
                          <PriceDisplay price={value} currency="KRW" />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    );
                  }

                  // 일반 필드
                  return (
                    <TableCell key={product.id} className={`${cellClassName} text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4`}>
                      {typeof value === "string" && value.length > 50 ? (
                        <span title={value}>{value.substring(0, 50)}...</span>
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
    </>
  );
}

