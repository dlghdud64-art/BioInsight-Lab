"use client";

import { useTestFlow } from "../_components/test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay } from "@/components/products/price-display";
import { useState } from "react";

export default function TestComparePage() {
  const { compareIds, toggleCompare, clearCompare, addProductToQuote } = useTestFlow();
  const [showHighlightDifferences, setShowHighlightDifferences] = useState(false);

  // 비교할 제품 데이터 로드
  const { data: compareProductsData, isLoading, error } = useQuery({
    queryKey: ["test-compare-products", compareIds],
    queryFn: async () => {
      if (compareIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: compareIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch products for comparison");
      }
      return response.json();
    },
    enabled: compareIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 10, // 10분
  });

  const products = compareProductsData?.products || [];

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

  if (compareIds.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>제품 비교</CardTitle>
            <CardDescription>
              비교할 제품이 없습니다. 검색 페이지에서 제품을 비교 목록에 추가해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/test/search">
              <Button className="w-full">
                검색 페이지로 이동
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-muted-foreground">제품 정보를 불러오는 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-sm text-red-600 mb-2">
                제품 정보를 불러오는 중 오류가 발생했습니다.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                제품 ID: {compareIds.join(", ")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                새로고침
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 비교할 속성들
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
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">제품 비교 ({products.length}개)</h2>
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
          <Button variant="outline" onClick={clearCompare}>
            전체 삭제
          </Button>
          <Link href="/test/quote">
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              품목 리스트로 이동
            </Button>
          </Link>
        </div>
      </div>

      {/* 비교 제품 관리 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">비교 중인 제품 ({compareIds.length}/5)</CardTitle>
          <CardDescription>
            비교할 제품을 추가하거나 제거할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {products.map((product: any) => {
              const vendor = product.vendors?.[0];
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {product.brand && (
                        <span className="text-xs text-slate-500">
                          {product.brand}
                        </span>
                      )}
                      {vendor?.vendor?.name && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-xs text-slate-500">
                            {vendor.vendor.name}
                          </span>
                        </>
                      )}
                      {vendor?.priceInKRW && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-xs font-medium text-slate-900">
                            ₩{vendor.priceInKRW.toLocaleString("ko-KR")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleCompare(product.id)}
                    className="ml-4 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    <X className="h-3 w-3 mr-1" />
                    제거
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priceChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tickFormatter={(value) => `₩${value.toLocaleString()}`} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `₩${value.toLocaleString()}`,
                      props.payload.fullName,
                    ]}
                  />
                  <Bar dataKey="price" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 납기 비교 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                납기 비교
              </CardTitle>
              <CardDescription>제품별 최단 납기일 비교</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={leadTimeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tickFormatter={(value) => `${value}일`} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value}일`,
                      props.payload.fullName,
                    ]}
                  />
                  <Bar dataKey="leadTime" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 상세 스펙 비교 테이블 */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>상세 스펙 비교</CardTitle>
            <CardDescription>
              제품의 주요 스펙을 표로 비교합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 w-[150px]">항목</TableHead>
                    {products.map((product: any) => (
                      <TableHead key={product.id} className="min-w-[180px]">
                        {product.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareFields.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell className="sticky left-0 bg-white font-medium w-[150px]">
                        {field.label}
                      </TableCell>
                      {products.map((product: any) => {
                        let value: any;
                        let allValues: any[] = [];

                        if (field.key === "price") {
                          value = product.vendors?.[0]?.priceInKRW || 0;
                          allValues = products.map((p: any) => p.vendors?.[0]?.priceInKRW || 0);
                        } else if (field.key === "leadTime") {
                          value = product.vendors?.[0]?.leadTime || 0;
                          allValues = products.map((p: any) => p.vendors?.[0]?.leadTime || 0);
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
                        } else {
                          value = product[field.key] || "-";
                          allValues = products.map((p: any) => p[field.key] || "-");
                        }

                        const cellClassName = `${getDifferenceHighlight(field.key, allValues)} ${getOptimalHighlight(field.key, value, allValues)}`;

                        return (
                          <TableCell key={product.id} className={cellClassName}>
                            {field.key === "price" && value > 0 ? (
                              `₩${value.toLocaleString()}`
                            ) : field.key === "leadTime" && value > 0 ? (
                              `${value}일`
                            ) : (
                              value
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

