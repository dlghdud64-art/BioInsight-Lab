"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, BarChart3, TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function ComparePage() {
  const { productIds, removeProduct, clearProducts } = useCompareStore();
  const [showHighlightDifferences, setShowHighlightDifferences] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = data?.products || [];

  // 가격 비교 차트 데이터
  const priceChartData = products.map((product: any) => {
    const minPrice = product.vendors?.reduce(
      (min: number, v: any) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
      null
    );
    return {
      name: product.name.length > 15 ? product.name.substring(0, 15) + "..." : product.name,
      fullName: product.name,
      price: minPrice || 0,
    };
  });

  // 납기 비교 차트 데이터
  const leadTimeChartData = products.map((product: any) => {
    const minLeadTime = product.vendors?.reduce(
      (min: number, v: any) => (v.leadTime !== null && (!min || v.leadTime < min) ? v.leadTime : min),
      null
    );
    return {
      name: product.name.length > 15 ? product.name.substring(0, 15) + "..." : product.name,
      fullName: product.name,
      leadTime: minLeadTime || 0,
    };
  });

  // 차이점 하이라이트 함수
  const getDifferenceHighlight = (field: string, values: any[]) => {
    if (!showHighlightDifferences) return "";
    const uniqueValues = new Set(values.map((v) => String(v || "-")));
    if (uniqueValues.size > 1) {
      return "bg-yellow-50 border-yellow-200";
    }
    return "";
  };

  // 최적값 하이라이트 (최저 가격, 최단 납기 등)
  const getOptimalHighlight = (field: string, value: any, allValues: any[]) => {
    if (!showHighlightDifferences) return "";
    
    if (field === "price") {
      const numericValues = allValues.filter((v) => typeof v === "number" && v > 0);
      if (numericValues.length > 0) {
        const minValue = Math.min(...numericValues);
        if (value === minValue) {
          return "bg-green-50 border-green-200 font-semibold";
        }
      }
    }
    
    if (field === "leadTime") {
      const numericValues = allValues.filter((v) => typeof v === "number" && v > 0);
      if (numericValues.length > 0) {
        const minValue = Math.min(...numericValues);
        if (value === minValue) {
          return "bg-blue-50 border-blue-200 font-semibold";
        }
      }
    }
    
    return "";
  };

  if (productIds.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">제품 비교</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                비교할 제품을 추가해주세요
              </p>
              <div className="text-center">
                <Link href="/search">
                  <Button>제품 검색하기</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 비교할 속성들 (더 풍부한 스펙)
  const compareFields = [
    { key: "name", label: "제품명" },
    { key: "brand", label: "브랜드" },
    { key: "category", label: "카테고리" },
    { key: "price", label: "최저가" },
    { key: "leadTime", label: "납기일" },
    { key: "stockStatus", label: "재고" },
    { key: "minOrderQty", label: "최소 주문량" },
    { key: "vendorCount", label: "공급사 수" },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 비교 제품 관리 리스트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">비교 중인 제품 관리</CardTitle>
            <CardDescription>
              비교할 제품을 추가하거나 제거할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {products.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {product.name}
                    </p>
                    {product.brand && (
                      <p className="text-xs text-slate-500 mt-1">
                        {product.brand}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeProduct(product.id)}
                    className="ml-4 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    제거
                  </Button>
                </div>
              ))}
              {products.length < 5 && (
                <div className="pt-2 border-t border-slate-200">
                  <Link href="/search">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      + 제품 추가하기
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">제품 비교 ({products.length}개)</h1>
            <p className="text-muted-foreground mt-1">
              여러 제품의 스펙, 가격, 납기를 한눈에 비교하세요
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowHighlightDifferences(!showHighlightDifferences)}
              className="gap-2"
            >
              {showHighlightDifferences ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  차이점 숨기기
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  차이점 하이라이트
                </>
              )}
            </Button>
            <Button variant="outline" onClick={clearProducts}>
              전체 삭제
            </Button>
            <Link href="/compare/quote">
              <Button>
                <ShoppingCart className="h-4 w-4 mr-2" />
                견적 요청
              </Button>
            </Link>
          </div>
        </div>

        {/* 차트 섹션 */}
        {products.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* 가격 비교 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  가격 비교
                </CardTitle>
                <CardDescription>제품별 최저가 비교</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => `₩${value.toLocaleString()}`}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.fullName;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="price" fill="#8884d8" name="가격 (₩)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 납기 비교 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  납기 비교
                </CardTitle>
                <CardDescription>제품별 최단 납기일 비교</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={leadTimeChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => `${value}일`}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.fullName;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="leadTime"
                      stroke="#82ca9d"
                      name="납기 (일)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 상세 비교 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>상세 스펙 비교</CardTitle>
            <CardDescription>
              제품의 주요 스펙을 표로 비교합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-semibold sticky left-0 bg-background z-10 min-w-[150px]">
                      항목
                    </th>
                    {products.map((product: any) => (
                      <th key={product.id} className="p-4 text-left min-w-[200px] relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => removeProduct(product.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="pr-8">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-semibold hover:underline block mb-1"
                          >
                            {product.name}
                          </Link>
                          {product.brand && (
                            <span className="text-sm text-muted-foreground">
                              {product.brand}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareFields.map((field) => {
                    const values = products.map((p: any) => {
                      if (field.key === "name") return p.name;
                      if (field.key === "brand") return p.brand || "-";
                      if (field.key === "category") return PRODUCT_CATEGORIES[p.category] || "-";
                      if (field.key === "price") {
                        const minPrice = p.vendors?.reduce(
                          (min: number, v: any) =>
                            v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                          null
                        );
                        return minPrice || 0;
                      }
                      if (field.key === "leadTime") {
                        const minLeadTime = p.vendors?.reduce(
                          (min: number, v: any) =>
                            v.leadTime !== null && (!min || v.leadTime < min) ? v.leadTime : min,
                          null
                        );
                        return minLeadTime || 0;
                      }
                      if (field.key === "stockStatus") {
                        const inStock = p.vendors?.some(
                          (v: any) => v.stockStatus === "재고 있음" || v.stockStatus === "In Stock"
                        );
                        return inStock ? "재고 있음" : "재고 없음";
                      }
                      if (field.key === "minOrderQty") {
                        const minOrder = p.vendors?.reduce(
                          (min: number, v: any) =>
                            v.minOrderQty && (!min || v.minOrderQty < min) ? v.minOrderQty : min,
                          null
                        );
                        return minOrder || "-";
                      }
                      if (field.key === "vendorCount") {
                        return p.vendors?.length || 0;
                      }
                      return "-";
                    });

                    return (
                      <tr key={field.key} className="border-b hover:bg-muted/30">
                        <td className={`p-4 font-medium sticky left-0 bg-background z-10 ${getDifferenceHighlight(field.key, values)}`}>
                          {field.label}
                        </td>
                        {products.map((product: any, idx: number) => {
                          let value: React.ReactNode = "-";
                          const cellValue = values[idx];
                          const cellHighlight = getOptimalHighlight(field.key, cellValue, values);

                          if (field.key === "name") {
                            value = product.name;
                          } else if (field.key === "brand") {
                            value = product.brand || "-";
                          } else if (field.key === "category") {
                            value = PRODUCT_CATEGORIES[product.category] || "-";
                          } else if (field.key === "price") {
                            const minPrice = product.vendors?.reduce(
                              (min: number, v: any) =>
                                v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                              null
                            );
                            value = minPrice ? (
                              <span className="font-semibold text-green-600">
                                ₩{minPrice.toLocaleString()}
                              </span>
                            ) : (
                              "가격 문의"
                            );
                          } else if (field.key === "leadTime") {
                            const minLeadTime = product.vendors?.reduce(
                              (min: number, v: any) =>
                                v.leadTime !== null && (!min || v.leadTime < min) ? v.leadTime : min,
                              null
                            );
                            value = minLeadTime ? (
                              <span className="flex items-center gap-1">
                                {minLeadTime}일
                                {minLeadTime <= 7 && (
                                  <TrendingDown className="h-3 w-3 text-green-500" />
                                )}
                              </span>
                            ) : (
                              "-"
                            );
                          } else if (field.key === "stockStatus") {
                            const inStock = product.vendors?.some(
                              (v: any) => v.stockStatus === "재고 있음" || v.stockStatus === "In Stock"
                            );
                            value = (
                              <span className={inStock ? "text-green-600 font-medium" : "text-red-600"}>
                                {inStock ? "재고 있음" : "재고 없음"}
                              </span>
                            );
                          } else if (field.key === "minOrderQty") {
                            const minOrder = product.vendors?.reduce(
                              (min: number, v: any) =>
                                v.minOrderQty && (!min || v.minOrderQty < min) ? v.minOrderQty : min,
                              null
                            );
                            value = minOrder ? `${minOrder}개` : "-";
                          } else if (field.key === "vendorCount") {
                            const count = product.vendors?.length || 0;
                            value = (
                              <span className="text-blue-600 font-medium">
                                {count}개 공급사
                              </span>
                            );
                          }

                          return (
                            <td
                              key={product.id}
                              className={`p-4 ${getDifferenceHighlight(field.key, values)} ${cellHighlight}`}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
