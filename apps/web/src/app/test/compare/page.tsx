"use client";

import { useTestFlow } from "../_components/test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { X, ShoppingCart, BarChart3, Eye, EyeOff, Loader2, ArrowUpDown, Filter, Download, Plus, ArrowUp, ArrowDown, GripVertical, Edit2, FileText, Check, Search, Sparkles, GitCompare as Compare } from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay } from "@/components/products/price-display";
import { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function TestComparePage() {
  const { compareIds, toggleCompare, clearCompare, addProductToQuote } = useTestFlow();
  const { toast } = useToast();
  const [showHighlightDifferences, setShowHighlightDifferences] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price" | "price_high" | "specification" | "leadTime" | "vendorCount">("name");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [productOrder, setProductOrder] = useState<number[]>([]); // 제품 순서 관리
  const [manualLeadTimes, setManualLeadTimes] = useState<Record<string, number>>(() => {
    // 로컬 스토리지에서 저장된 납기 정보 불러오기
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("manualLeadTimes") || "{}");
      } catch {
        return {};
      }
    }
    return {};
  });
  const [editingLeadTime, setEditingLeadTime] = useState<{ productId: string; vendorIndex: number } | null>(null);
  const [tempLeadTime, setTempLeadTime] = useState<string>("");

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

  const allProducts = compareProductsData?.products || [];

  // 제품 순서 초기화 (제품이 변경될 때)
  useEffect(() => {
    if (allProducts.length > 0) {
      // 제품이 변경되면 순서를 초기화
      const newOrder = allProducts.map((_item: any, index: number) => index);
      setProductOrder(newOrder);
    } else {
      setProductOrder([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts.length]);

  // 순서 변경 함수
  const moveProduct = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === productOrder.length - 1) return;
    
    const newOrder = [...productOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setProductOrder(newOrder);
  };

  // 필터링 및 정렬
  const products = useMemo(() => {
    let filtered = [...allProducts];

    // 카테고리 필터
    if (filterCategory !== "all") {
      filtered = filtered.filter((p: any) => p.category === filterCategory);
    }

    // 브랜드 필터
    if (filterBrand !== "all") {
      filtered = filtered.filter((p: any) => p.brand === filterBrand);
    }

    // 벤더 필터
    if (filterVendor !== "all") {
      filtered = filtered.filter((p: any) => 
        p.vendors?.some((v: any) => v.vendor?.name === filterVendor)
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "ko");
      } else if (sortBy === "price") {
        const priceA = a.vendors?.[0]?.priceInKRW || 0;
        const priceB = b.vendors?.[0]?.priceInKRW || 0;
        return priceA - priceB;
      } else if (sortBy === "price_high") {
        const priceA = a.vendors?.[0]?.priceInKRW || 0;
        const priceB = b.vendors?.[0]?.priceInKRW || 0;
        return priceB - priceA;
      } else if (sortBy === "specification") {
        // 규격/용량 기준 정렬 (숫자 추출하여 비교)
        const specA = a.specification || "";
        const specB = b.specification || "";
        // 숫자 추출 (예: "500mL" -> 500, "1mg" -> 1)
        const numA = parseFloat(specA.match(/\d+\.?\d*/)?.[0] || "0");
        const numB = parseFloat(specB.match(/\d+\.?\d*/)?.[0] || "0");
        return numA - numB;
      } else if (sortBy === "leadTime") {
        const leadTimeA = a.vendors?.[0]?.leadTime || 999;
        const leadTimeB = b.vendors?.[0]?.leadTime || 999;
        return leadTimeA - leadTimeB;
      } else if (sortBy === "vendorCount") {
        return (b.vendors?.length || 0) - (a.vendors?.length || 0);
      }
      return 0;
    });

    // 순서 적용
    if (productOrder.length === filtered.length && productOrder.length > 0) {
      const ordered = productOrder.map((orderIndex) => filtered[orderIndex]).filter(Boolean);
      return ordered.length > 0 ? ordered : filtered;
    }
    
    return filtered;
  }, [allProducts, filterCategory, filterBrand, filterVendor, sortBy, productOrder]);

  // 브랜드 목록 추출
  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    allProducts.forEach((p: any) => {
      if (p.brand) brandSet.add(p.brand);
    });
    return Array.from(brandSet).sort();
  }, [allProducts]);

  // 벤더 목록 추출
  const vendors = useMemo(() => {
    const vendorSet = new Set<string>();
    allProducts.forEach((p: any) => {
      p.vendors?.forEach((v: any) => {
        if (v.vendor?.name) vendorSet.add(v.vendor.name);
      });
    });
    return Array.from(vendorSet).sort();
  }, [allProducts]);

  // 다른 사용자들의 평균 납기일 조회
  const { data: averageLeadTimesData } = useQuery({
    queryKey: ["average-lead-times", compareIds],
    queryFn: async () => {
      if (compareIds.length === 0) return { averageLeadTimes: {} };
      const response = await fetch("/api/products/average-lead-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: compareIds }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch average lead times");
      }
      return response.json();
    },
    enabled: compareIds.length > 0,
    staleTime: 1000 * 60 * 10, // 10분
  });

  const averageLeadTimes = averageLeadTimesData?.averageLeadTimes || {};

  // 제품별 평균 납기일 계산 (다른 사용자들의 데이터 기반)
  const getAverageLeadTime = (product: any) => {
    // 다른 사용자들의 평균 납기일 우선 사용
    if (averageLeadTimes[product.id]) {
      return averageLeadTimes[product.id];
    }
    
    // 없으면 벤더별 납기일의 평균 사용
    if (!product.vendors || product.vendors.length === 0) return 0;
    
    const leadTimes: number[] = [];
    product.vendors.forEach((v: any) => {
      const vendorKey = `${product.id}_${v.vendor?.id || 0}`;
      const manual = manualLeadTimes[vendorKey];
      if (manual) {
        leadTimes.push(manual);
      } else if (v.leadTime !== null && v.leadTime !== undefined && v.leadTime > 0) {
        leadTimes.push(v.leadTime);
      }
    });
    
    if (leadTimes.length === 0) return 0;
    const sum = leadTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / leadTimes.length);
  };

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

  // 납기 비교 차트 데이터 (다른 사용자들의 평균 납기일 사용)
  const leadTimeChartData = products.map((product: any) => {
    // 수동 입력한 납기 정보가 있으면 우선 사용
    const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
    const manualLeadTime = manualLeadTimes[vendorKey];
    
    if (manualLeadTime) {
      return {
        name: product.name.length > 15 ? product.name.substring(0, 15) + "..." : product.name,
        fullName: product.name,
        leadTime: manualLeadTime,
        isAverage: false,
        isUserAverage: false,
      };
    }
    
    // 다른 사용자들의 평균 납기일 사용
    const avgLeadTime = getAverageLeadTime(product);
    if (avgLeadTime > 0) {
      return {
        name: product.name.length > 15 ? product.name.substring(0, 15) + "..." : product.name,
        fullName: product.name,
        leadTime: avgLeadTime,
        isAverage: true,
        isUserAverage: !!averageLeadTimes[product.id],
      };
    }
    
    return null;
  }).filter(Boolean); // 납기 정보가 없는 제품 제외

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
  // 원료 카테고리인 제품이 있는지 확인
  const hasRawMaterial = products.some((p: any) => p.category === "RAW_MATERIAL");
  
  const compareFields = [
    { key: "name", label: "제품명" },
    { key: "catalogNumber", label: "카탈로그 번호" },
    { key: "brand", label: "브랜드" },
    { key: "category", label: "카테고리" },
    { key: "specification", label: "규격/용량" },
    { key: "grade", label: "Grade" },
    // 원료 카테고리인 경우 추가 필드
    ...(hasRawMaterial ? [
      { key: "pharmacopoeia", label: "규정/표준" },
      { key: "coaUrl", label: "COA" },
      { key: "countryOfOrigin", label: "원산지" },
      { key: "manufacturer", label: "제조사" },
    ] : []),
    { key: "price", label: "최저가" },
    { key: "leadTime", label: "납기일" },
    { key: "stockStatus", label: "재고" },
    { key: "minOrderQty", label: "최소 주문량" },
    { key: "vendorCount", label: "공급사 수" },
  ];

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-center sm:text-left">제품 비교 ({products.length}개)</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 text-center sm:text-left">
            여러 제품의 스펙, 가격, 납기를 한눈에 비교하세요
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setShowHighlightDifferences(!showHighlightDifferences)}
            className="gap-2 text-xs sm:text-sm"
            size="sm"
          >
            {showHighlightDifferences ? (
              <>
                <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">차이점 숨기기</span>
                <span className="sm:hidden">숨기기</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">차이점 하이라이트</span>
                <span className="sm:hidden">하이라이트</span>
              </>
            )}
          </Button>
          <Button variant="outline" onClick={clearCompare} size="sm" className="text-xs sm:text-sm">
            전체 삭제
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              products.forEach((product) => addProductToQuote(product));
              toast({
                title: "추가 완료",
                description: `${products.length}개 제품이 품목 리스트에 추가되었습니다.`,
              });
            }}
            className="gap-2 text-xs sm:text-sm"
            size="sm"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">모두 추가</span>
            <span className="sm:hidden">추가</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // 비교 결과를 CSV로 내보내기
              const csvHeaders = ["제품명", "카탈로그 번호", "브랜드", "카테고리", "규격/용량", "Grade", "최저가", "납기일", "재고", "최소 주문량", "공급사 수"];
              const csvRows = products.map((product: any) => {
                const vendor = product.vendors?.[0];
                return [
                  product.name || "",
                  product.catalogNumber || "",
                  product.brand || "",
                  PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category || "",
                  product.specification || "",
                  product.grade || "",
                  vendor?.priceInKRW ? `₩${vendor.priceInKRW.toLocaleString()}` : "",
                  vendor?.leadTime ? `${vendor.leadTime}일` : "",
                  vendor?.stockStatus || "",
                  vendor?.minOrderQty || "",
                  product.vendors?.length || 0,
                ];
              });
              
              const csvContent = [
                csvHeaders.join(","),
                ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
              ].join("\n");
              
              const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              const url = URL.createObjectURL(blob);
              link.setAttribute("href", url);
              link.setAttribute("download", `제품비교_${new Date().toISOString().split("T")[0]}.csv`);
              link.style.visibility = "hidden";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="gap-2 text-xs sm:text-sm"
            size="sm"
          >
            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">CSV 내보내기</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href="/test/search" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 text-xs sm:text-sm" size="sm">
                <Search className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="hidden sm:inline">검색 페이지로 이동</span>
                <span className="sm:hidden">검색</span>
              </Button>
            </Link>
            <Link href="/test/quote" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="hidden sm:inline">품목 리스트로 이동</span>
                <span className="sm:hidden">리스트</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 비교 제품 관리 리스트 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <CardTitle className="text-base sm:text-lg text-center sm:text-left">비교 중인 제품 ({compareIds.length}/5)</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-center sm:text-left">
                비교할 제품을 추가하거나 제거할 수 있습니다
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[140px]">
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">제품명순</SelectItem>
                  <SelectItem value="price">가격 낮은순</SelectItem>
                  <SelectItem value="price_high">가격 높은순</SelectItem>
                  <SelectItem value="specification">규격/용량순</SelectItem>
                  <SelectItem value="leadTime">납기 빠른순</SelectItem>
                  <SelectItem value="vendorCount">공급사 많은순</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs w-full sm:w-auto">
                    <Filter className="h-3 w-3 mr-1" />
                    필터
                    {(filterCategory !== "all" || filterBrand !== "all" || filterVendor !== "all") && (
                      <span className="ml-1 text-blue-600">●</span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-sm">필터 설정</DialogTitle>
                    <DialogDescription className="text-xs">
                      비교할 제품을 필터링합니다
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">카테고리</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">브랜드</Label>
                      <Select value={filterBrand} onValueChange={setFilterBrand}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          {brands.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">벤더</Label>
                      <Select value={filterVendor} onValueChange={setFilterVendor}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor} value={vendor}>
                              {vendor}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setFilterCategory("all");
                          setFilterBrand("all");
                          setFilterVendor("all");
                        }}
                      >
                        초기화
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => setIsFilterDialogOpen(false)}
                      >
                        적용
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {products.map((product: any) => {
              const vendor = product.vendors?.[0];
              return (
                <div
                  key={product.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-2 sm:p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <p className="font-medium text-xs sm:text-sm text-slate-900 truncate w-full sm:w-auto text-center sm:text-left">
                        {product.name}
                      </p>
                      <Link href={`/products/${product.id}`} className="w-full sm:w-auto flex justify-center sm:justify-start">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs w-full sm:w-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          상세보기
                        </Button>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap justify-center sm:justify-start">
                      {product.brand && (
                        <Badge variant="secondary" className="text-xs">
                          {product.brand}
                        </Badge>
                      )}
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category}
                        </Badge>
                      )}
                      {vendor?.vendor?.name && (
                        <span className="text-xs text-slate-500">
                          {vendor.vendor.name}
                        </span>
                      )}
                      {vendor?.priceInKRW && (
                        <span className="text-xs font-medium text-slate-900">
                          ₩{vendor.priceInKRW.toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto sm:ml-4 justify-center sm:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        addProductToQuote(product);
                        toast({
                          title: "추가 완료",
                          description: `${product.name}이(가) 품목 리스트에 추가되었습니다.`,
                        });
                      }}
                      className="text-xs flex-1 sm:flex-none"
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      추가
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleCompare(product.id)}
                      className="text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex-1 sm:flex-none"
                    >
                      <X className="h-3 w-3 mr-1" />
                      제거
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 차트 섹션 */}
      {products.length > 0 && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {/* 가격 비교 차트 */}
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-center sm:justify-start">
              <BarChart3 className="h-5 w-5" />
              가격 비교
            </CardTitle>
            <CardDescription className="text-center sm:text-left">제품별 최저가 비교</CardDescription>
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
          {leadTimeChartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-center sm:justify-start">
                  <BarChart3 className="h-5 w-5" />
                  납기 비교
                </CardTitle>
                <CardDescription className="text-center sm:text-left">
                  제품별 평균 납기일 비교 (다른 사용자들의 실제 구매 데이터 기반)
                </CardDescription>
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
                      formatter={(value: number, name: string, props: any) => {
                        const isAvg = props.payload.isAverage;
                        const isUserAvg = props.payload.isUserAverage;
                        return [
                          `${value}일${isAvg ? (isUserAvg ? " (다른 사용자 평균)" : " (벤더 평균)") : ""}`,
                          props.payload.fullName,
                        ];
                      }}
                    />
                    <Bar 
                      dataKey="leadTime" 
                      fill="#82ca9d"
                      name="납기일"
                    >
                      {leadTimeChartData.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isAverage 
                            ? (entry.isUserAverage ? "#3b82f6" : "#fbbf24") 
                            : "#82ca9d"
                          } 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-center sm:justify-start">
                  <BarChart3 className="h-5 w-5" />
                  납기 비교
                </CardTitle>
                <CardDescription className="text-center sm:text-left">납기 정보가 있는 제품이 없습니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500 text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p>평균 납기일 정보가 있는 제품이 없습니다.</p>
                  <p className="text-xs mt-2">
                    다른 사용자들의 실제 구매 데이터를 기반으로 평균 납기일이 계산됩니다.
                    <br />
                    데이터가 쌓이면 자동으로 표시됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 상세 스펙 비교 테이블 */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center sm:text-left">상세 스펙 비교</CardTitle>
            <CardDescription className="text-center sm:text-left">
              제품의 주요 스펙을 표로 비교합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-10 w-[120px] sm:w-[150px] text-xs sm:text-sm text-center sm:text-left">항목</TableHead>
                      {products.map((product: any, index: number) => (
                        <TableHead key={product.id} className="min-w-[150px] sm:min-w-[180px] text-xs sm:text-sm">
                          <div className="flex items-center justify-between gap-1 sm:gap-2">
                            <span className="flex-1 truncate text-xs sm:text-sm text-center sm:text-left">{product.name}</span>
                            <div className="flex flex-col gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-4 w-4 sm:h-5 sm:w-5"
                                onClick={() => moveProduct(index, "up")}
                                disabled={index === 0}
                                title="위로 이동"
                              >
                                <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-4 w-4 sm:h-5 sm:w-5"
                                onClick={() => moveProduct(index, "down")}
                                disabled={index === products.length - 1}
                                title="아래로 이동"
                              >
                                <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </Button>
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareFields.map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="sticky left-0 bg-white font-medium w-[120px] sm:w-[150px] text-xs sm:text-sm text-center sm:text-left">
                          {field.label}
                        </TableCell>
                      {products.map((product: any) => {
                        let value: any;
                        let allValues: any[] = [];

                        if (field.key === "price") {
                          value = product.vendors?.[0]?.priceInKRW || 0;
                          allValues = products.map((p: any) => p.vendors?.[0]?.priceInKRW || 0);
                        } else if (field.key === "leadTime") {
                          // 납기일은 평균 납기일 사용
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
                          const isUserAverage = !!averageLeadTimes[product.id];
                          const displayLeadTime = manualLeadTime || averageLeadTime;
                          const isAverage = !manualLeadTime && averageLeadTime > 0;
                          
                        return (
                          <TableCell key={product.id} className={`${cellClassName} text-xs sm:text-sm text-center sm:text-left`}>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2">
                              {displayLeadTime > 0 ? (
                                <>
                                  <span className={isAverage ? "text-slate-600" : ""}>
                                    {displayLeadTime}일
                                    {isAverage && (
                                      <span className="text-[10px] sm:text-xs text-slate-400 ml-1">
                                        ({isUserAverage ? "다른 사용자 평균" : "벤더 평균"})
                                      </span>
                                    )}
                                  </span>
                                    {manualLeadTime > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          setEditingLeadTime({ productId: product.id, vendorIndex: 0 });
                                          setTempLeadTime(manualLeadTime?.toString() || "");
                                        }}
                                        title="납기일 수정"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </div>
                            </TableCell>
                          );
                        }
                        
                        return (
                          <TableCell key={product.id} className={`${cellClassName} text-xs sm:text-sm text-center sm:text-left`}>
                            {field.key === "price" && value > 0 ? (
                              `₩${value.toLocaleString()}`
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* 대체품 추천 섹션 */}
      {products.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              대체품 추천
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-center sm:text-left">
              각 제품과 유사한 스펙의 대체품을 추천합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {products.map((product: any) => (
                <ProductAlternativesCard
                  key={product.id}
                  product={product}
                  onAddToCompare={(productId) => {
                    if (compareIds.length >= 5) {
                      toast({
                        title: "최대 5개까지만 비교할 수 있습니다",
                        variant: "destructive",
                      });
                      return;
                    }
                    toggleCompare(productId);
                  }}
                  compareIds={compareIds}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 납기일 수정 다이얼로그 */}
      <Dialog open={!!editingLeadTime} onOpenChange={(open) => !open && setEditingLeadTime(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>납기일 입력</DialogTitle>
            <DialogDescription>
              견적서를 받은 후 확인한 납기일을 입력하세요. 이 정보는 이 브라우저에만 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="leadTime">납기일 (일)</Label>
              <Input
                id="leadTime"
                type="number"
                min="0"
                value={tempLeadTime}
                onChange={(e) => setTempLeadTime(e.target.value)}
                placeholder="예: 14"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingLeadTime(null);
                  setTempLeadTime("");
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (editingLeadTime) {
                    const leadTime = parseInt(tempLeadTime) || 0;
                    const product = products.find((p: any) => p.id === editingLeadTime.productId);
                    if (product) {
                      const vendorKey = `${product.id}_${product.vendors?.[editingLeadTime.vendorIndex]?.vendor?.id || 0}`;
                      setManualLeadTimes((prev) => {
                        const updated = { ...prev, [vendorKey]: leadTime };
                        // 로컬 스토리지에 저장
                        if (typeof window !== "undefined") {
                          localStorage.setItem("manualLeadTimes", JSON.stringify(updated));
                        }
                        return updated;
                      });
                    }
                    setEditingLeadTime(null);
                    setTempLeadTime("");
                  }
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 제품별 대체품 카드 컴포넌트
function ProductAlternativesCard({
  product,
  onAddToCompare,
  compareIds,
}: {
  product: any;
  onAddToCompare: (productId: string) => void;
  compareIds: string[];
}) {
  const { data: alternatives, isLoading } = useQuery({
    queryKey: ["product-alternatives", product.id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.id}/alternatives?limit=3`);
      if (!response.ok) return { alternatives: [] };
      return response.json();
    },
    enabled: !!product.id,
  });

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{product.name}</span>
        </div>
        <p className="text-xs text-slate-500">대체품을 찾는 중...</p>
      </div>
    );
  }

  if (!alternatives?.alternatives || alternatives.alternatives.length === 0) {
    return null;
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{product.name}</span>
        <Badge variant="outline" className="text-xs">
          대체품 {alternatives.alternatives.length}개
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {alternatives.alternatives.map((alt: any) => {
          const inCompare = compareIds.includes(alt.id);
          
          return (
            <Card key={alt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  {alt.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={alt.imageUrl}
                      alt={alt.name}
                      className="w-12 h-12 object-cover rounded"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm line-clamp-2">
                      <Link
                        href={`/products/${alt.id}`}
                        className="hover:underline"
                      >
                        {alt.name}
                      </Link>
                    </CardTitle>
                    {alt.brand && (
                      <CardDescription className="text-xs mt-0.5">
                        {alt.brand}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* 유사도 및 근거 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">유사도</span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(alt.similarity * 100)}%
                    </Badge>
                  </div>
                  {alt.similarityReasons && alt.similarityReasons.length > 0 && (
                    <div className="space-y-0.5">
                      {alt.similarityReasons.slice(0, 2).map((reason: string, idx: number) => (
                        <div key={idx} className="text-xs text-slate-600 flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-600" />
                          {reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 가격 정보 */}
                {alt.minPrice !== undefined && (
                  <div className="text-sm font-semibold">
                    ₩{alt.minPrice.toLocaleString("ko-KR")}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onAddToCompare(alt.id)}
                    disabled={inCompare}
                  >
                    <Compare className="h-3 w-3 mr-1" />
                    {inCompare ? "추가됨" : "비교"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    asChild
                  >
                    <Link href={`/products/${alt.id}`}>
                      <Eye className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

