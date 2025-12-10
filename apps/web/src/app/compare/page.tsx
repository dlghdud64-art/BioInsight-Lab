"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, BarChart3, TrendingUp, TrendingDown, Eye, EyeOff, Search, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

export default function ComparePage() {
  const { productIds, addProduct, removeProduct, clearProducts, hasProduct } = useCompareStore();
  const [showHighlightDifferences, setShowHighlightDifferences] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const { toast } = useToast();

  // 제품 검색
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["product-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { products: [] };
      const response = await fetch(`/api/products/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      if (!response.ok) throw new Error("Failed to search products");
      return response.json();
    },
    enabled: searchQuery.trim().length > 0 && showSearchResults,
  });

  const searchResults = searchData?.products || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSearchResults(true);
  };

  const handleAddToCompare = (productId: string, productName: string) => {
    if (hasProduct(productId)) {
      toast({
        title: "이미 추가됨",
        description: "이 제품은 이미 비교 목록에 있습니다.",
        variant: "default",
      });
      return;
    }
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
      title: "추가 완료",
      description: `${productName}이(가) 비교 목록에 추가되었습니다.`,
    });
    setSearchQuery("");
    setShowSearchResults(false);
    
    // 비교 목록 섹션으로 스크롤
    setTimeout(() => {
      const compareListSection = document.getElementById("compare-list-section");
      if (compareListSection) {
        compareListSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch products");
      }
      return response.json();
    },
    enabled: productIds.length > 0,
    retry: 1,
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
        <div className="max-w-7xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold mb-6">제품 비교</h1>
          
          {/* 검색 섹션 */}
          <Card>
            <CardHeader>
              <CardTitle>제품 검색 및 추가</CardTitle>
              <CardDescription>
                비교할 제품을 검색하고 추가하세요 (최대 5개)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="제품명, 벤더, 시약명 검색... (예: PBS, FBS, Trypsin)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchResults(false);
                    }}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={!searchQuery.trim() || isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      검색 중...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      검색
                    </>
                  )}
                </Button>
              </form>

              {/* 검색 결과 */}
              {showSearchResults && (
                <div className="mt-4 space-y-2">
                  {isSearching ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>검색 중...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>검색 결과가 없습니다.</p>
                      <p className="text-sm mt-2">다른 검색어를 시도해보세요.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {searchResults.map((product: any) => {
                        const vendor = product.vendors?.[0];
                        const isAlreadyAdded = hasProduct(product.id);
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                          >
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm text-slate-900 truncate">
                                {product.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {vendor?.vendor?.name && (
                                  <span className="text-xs text-slate-500">
                                    {vendor.vendor.name}
                                  </span>
                                )}
                                {product.category && (
                                  <span className="text-xs text-slate-500">
                                    · {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                                  </span>
                                )}
                                {vendor?.priceInKRW && (
                                  <span className="text-xs font-medium text-slate-900">
                                    · ₩{vendor.priceInKRW.toLocaleString("ko-KR")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isAlreadyAdded ? "outline" : "default"}
                              onClick={() => handleAddToCompare(product.id, product.name)}
                              disabled={isAlreadyAdded || productIds.length >= 5}
                              className="ml-4"
                            >
                              {isAlreadyAdded ? (
                                "추가됨"
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  추가
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t">
                <Link href="/search">
                  <Button variant="outline" className="w-full">
                    전체 검색 페이지로 이동
                  </Button>
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
        {/* 비교 제품 관리 리스트 - 위로 이동 */}
        <Card id="compare-list-section">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">비교 중인 제품 ({productIds.length}/5)</CardTitle>
                <CardDescription>
                  비교할 제품을 추가하거나 제거할 수 있습니다
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-muted-foreground">제품 정보를 불러오는 중...</p>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 mb-2">
                    제품 정보를 불러오는 중 오류가 발생했습니다.
                  </p>
                  <p className="text-xs text-amber-600">
                    제품 ID: {productIds.join(", ")}
                  </p>
                </div>
                {/* 제품 ID만이라도 표시 */}
                {productIds.map((id: string) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        제품 ID: {id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        정보를 불러오는 중...
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeProduct(id)}
                      className="ml-4 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      <X className="h-3 w-3 mr-1" />
                      제거
                    </Button>
                  </div>
                ))}
              </div>
            ) : products.length === 0 && productIds.length > 0 ? (
              <div className="space-y-2">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-800 mb-2">
                    제품 정보를 찾을 수 없습니다.
                  </p>
                  <p className="text-xs text-slate-600 mb-3">
                    제품 ID: {productIds.join(", ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    제품이 데이터베이스에 없거나 삭제되었을 수 있습니다.
                  </p>
                </div>
                {/* 제품 ID 목록 표시 */}
                {productIds.map((id: string) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        제품 ID: {id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        정보 없음
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeProduct(id)}
                      className="ml-4 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      <X className="h-3 w-3 mr-1" />
                      제거
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
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
                          {product.name || product.id}
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
                        onClick={() => removeProduct(product.id)}
                        className="ml-4 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                      >
                        <X className="h-3 w-3 mr-1" />
                        제거
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
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