"use client";

import { useTestFlow } from "../_components/test-flow-provider";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  ShoppingCart,
  Eye,
  EyeOff,
  Loader2,
  ArrowUpDown,
  Filter,
  Download,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  FileText,
  Check,
  Search,
  GitCompare as Compare,
  ExternalLink,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceDisplay } from "@/components/products/price-display";
import { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TestComparePage() {
  const { compareIds, toggleCompare, clearCompare, addProductToQuote, quoteItems } = useTestFlow();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [showHighlightDifferences, setShowHighlightDifferences] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price" | "price_high" | "specification" | "leadTime" | "vendorCount">("name");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [productOrder, setProductOrder] = useState<number[]>([]);
  const [manualLeadTimes, setManualLeadTimes] = useState<Record<string, number>>(() => {
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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("cost");

  // ── Data fetching ──────────────────────────────────────────────────────────
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const allProducts = compareProductsData?.products || [];

  const { data: averageLeadTimesData } = useQuery({
    queryKey: ["average-lead-times", compareIds],
    queryFn: async () => {
      if (compareIds.length === 0) return { averageLeadTimes: {} };
      const response = await fetch("/api/products/average-lead-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: compareIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch average lead times");
      return response.json();
    },
    enabled: compareIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const averageLeadTimes = averageLeadTimesData?.averageLeadTimes || {};

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (allProducts.length > 0) {
      setProductOrder(allProducts.map((_item: any, index: number) => index));
    } else {
      setProductOrder([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts.length]);

  useEffect(() => {
    if (compareIds.length > 0) {
      trackEvent("compare_open", { product_count: compareIds.length });
    }
  }, []); // mount only

  // ── Utility functions ──────────────────────────────────────────────────────
  const moveProduct = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === productOrder.length - 1) return;
    const newOrder = [...productOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setProductOrder(newOrder);
  };

  const getAverageLeadTime = (product: any) => {
    if (averageLeadTimes[product.id]) return averageLeadTimes[product.id];
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
    return Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length);
  };

  // Keep chart data calculated (not rendered per directive, but kept for CSV/logic)
  const priceChartData = allProducts.map((product: any) => {
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

  const leadTimeChartData = allProducts.map((product: any) => {
    const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
    const manualLeadTime = manualLeadTimes[vendorKey];
    if (manualLeadTime) {
      return { name: product.name, fullName: product.name, leadTime: manualLeadTime, isAverage: false, isUserAverage: false };
    }
    const avgLeadTime = getAverageLeadTime(product);
    if (avgLeadTime > 0) {
      return { name: product.name, fullName: product.name, leadTime: avgLeadTime, isAverage: true, isUserAverage: !!averageLeadTimes[product.id] };
    }
    return null;
  }).filter(Boolean);

  // ── Filter + Sort (scenario-aware) ────────────────────────────────────────
  const products = useMemo(() => {
    let filtered = [...allProducts];
    if (filterCategory !== "all") filtered = filtered.filter((p: any) => p.category === filterCategory);
    if (filterBrand !== "all") filtered = filtered.filter((p: any) => p.brand === filterBrand);
    if (filterVendor !== "all") filtered = filtered.filter((p: any) => p.vendors?.some((v: any) => v.vendor?.name === filterVendor));

    // Scenario controls sort when no manual sortBy override
    const effectiveSort = scenario === "cost" ? "price"
      : scenario === "leadtime" ? "leadTime"
      : scenario === "spec" ? "specification"
      : sortBy;

    filtered.sort((a, b) => {
      if (effectiveSort === "name") return a.name.localeCompare(b.name, "ko");
      if (effectiveSort === "price") {
        const pa = a.vendors?.[0]?.priceInKRW || 0;
        const pb = b.vendors?.[0]?.priceInKRW || 0;
        return pa - pb;
      }
      if (effectiveSort === "price_high") {
        const pa = a.vendors?.[0]?.priceInKRW || 0;
        const pb = b.vendors?.[0]?.priceInKRW || 0;
        return pb - pa;
      }
      if (effectiveSort === "specification") {
        const numA = parseFloat((a.specification || "").match(/\d+\.?\d*/)?.[0] || "0");
        const numB = parseFloat((b.specification || "").match(/\d+\.?\d*/)?.[0] || "0");
        return numA - numB;
      }
      if (effectiveSort === "leadTime") {
        return (a.vendors?.[0]?.leadTime || 999) - (b.vendors?.[0]?.leadTime || 999);
      }
      if (effectiveSort === "vendorCount") return (b.vendors?.length || 0) - (a.vendors?.length || 0);
      return 0;
    });

    if (productOrder.length === filtered.length && productOrder.length > 0) {
      const ordered = productOrder.map((i) => filtered[i]).filter(Boolean);
      return ordered.length > 0 ? ordered : filtered;
    }
    return filtered;
  }, [allProducts, filterCategory, filterBrand, filterVendor, sortBy, productOrder, scenario]);

  const brands = useMemo(() => {
    const s = new Set<string>();
    allProducts.forEach((p: any) => { if (p.brand) s.add(p.brand); });
    return Array.from(s).sort();
  }, [allProducts]);

  const vendors = useMemo(() => {
    const s = new Set<string>();
    allProducts.forEach((p: any) => { p.vendors?.forEach((v: any) => { if (v.vendor?.name) s.add(v.vendor.name); }); });
    return Array.from(s).sort();
  }, [allProducts]);

  // ── Decision-surface derived values ───────────────────────────────────────
  const uniqueCategories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
  const suitabilityLevel: "high" | "medium" | "low" =
    uniqueCategories.length <= 1 ? "high" : uniqueCategories.length === 2 ? "medium" : "low";

  const cheapestProduct = products.length >= 2
    ? products.reduce((best: any, p: any) => {
        const price = p.vendors?.[0]?.priceInKRW || 0;
        const bestPrice = best?.vendors?.[0]?.priceInKRW || 0;
        return price > 0 && (bestPrice === 0 || price < bestPrice) ? p : best;
      }, null)
    : null;
  const highestPrice = products.reduce((max: number, p: any) => {
    const price = p.vendors?.[0]?.priceInKRW || 0;
    return price > max ? price : max;
  }, 0);
  const cheapestPrice = cheapestProduct?.vendors?.[0]?.priceInKRW || 0;
  const hasPriceDiff = cheapestPrice > 0 && highestPrice > cheapestPrice;

  const productsWithLeadTime = products.filter((p: any) => getAverageLeadTime(p) > 0);
  const hasLeadTimeData = productsWithLeadTime.length >= 2;
  const fastestProduct = hasLeadTimeData
    ? productsWithLeadTime.reduce((best: any, p: any) => getAverageLeadTime(p) < getAverageLeadTime(best) ? p : best)
    : null;

  const quoteItemsCount = quoteItems.length;

  // ── Highlight helpers ──────────────────────────────────────────────────────
  const getDifferenceHighlight = (_field: string, values: any[]) => {
    if (!showHighlightDifferences) return "";
    const uniqueValues = new Set(values.map((v) => String(v || "-")));
    return uniqueValues.size > 1 ? "bg-yellow-600/10 border-yellow-700" : "";
  };

  const getOptimalHighlight = (field: string, value: any, allValues: any[]) => {
    if (!showHighlightDifferences) return "";
    if (field === "price") {
      const nums = allValues.filter((v) => typeof v === "number" && v > 0);
      if (nums.length > 0 && value === Math.min(...nums)) return "bg-green-600/10 border-green-700 font-semibold";
    }
    if (field === "leadTime") {
      const nums = allValues.filter((v) => typeof v === "number" && v > 0);
      if (nums.length > 0 && value === Math.min(...nums)) return "bg-blue-600/10 border-blue-700 font-semibold";
    }
    return "";
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
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
      ...csvRows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
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
    trackEvent("compare_export_csv", { product_count: products.length });
  };

  // ── Matrix fields ──────────────────────────────────────────────────────────
  const hasRawMaterial = products.some((p: any) => p.category === "RAW_MATERIAL");
  const matrixFields = [
    { key: "price", label: "최저가" },
    { key: "leadTime", label: "납기일" },
    { key: "specification", label: "규격/용량" },
    { key: "grade", label: "Grade" },
    { key: "minOrderQty", label: "포장 단위" },
    { key: "stockStatus", label: "재고" },
    { key: "vendorCount", label: "공급사 수" },
    { key: "brand", label: "공급사/브랜드" },
    { key: "catalogNumber", label: "카탈로그 번호" },
    ...(hasRawMaterial ? [
      { key: "countryOfOrigin", label: "원산지" },
      { key: "manufacturer", label: "제조사" },
    ] : []),
  ];

  // ── Empty/Loading/Error states ─────────────────────────────────────────────
  if (compareIds.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#303236' }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Compare className="h-7 w-7 text-slate-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-1.5">제품을 추가하고 비교하세요</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-sm">
            Step 1에서 제품을 검색한 뒤 &apos;비교 담기&apos;를 눌러 슬롯을 채워보세요.
            최대 5개 제품의 스펙·가격·납기를 한눈에 비교할 수 있습니다.
          </p>
          <Link href="/test/search">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white px-6">
              <Search className="h-4 w-4 mr-2" />
              제품 검색하러 가기
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-lg w-full">
          {[1, 2, 3].map((slot) => (
            <div key={slot} className="rounded-xl border border-dashed border-slate-700 bg-slate-800/50 p-4 flex flex-col items-center justify-center min-h-[120px]">
              <Plus className="h-4 w-4 text-slate-600 mb-1.5" />
              <span className="text-[10px] text-slate-600">슬롯 {slot}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-400">제품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ backgroundColor: '#303236' }}>
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">제품 정보를 불러오는 중 오류가 발생했습니다.</p>
          <p className="text-xs text-slate-500 mb-4">제품 ID: {compareIds.join(", ")}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>새로고침</Button>
        </div>
      </div>
    );
  }

  // ── Selected product for evidence rail ────────────────────────────────────
  const selectedProduct = selectedProductId ? products.find((p: any) => p.id === selectedProductId) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ 1. Sticky Decision Header ═══ */}
      <div className="shrink-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-slate-700"
          style={{ backgroundColor: '#434548' }}
        >
          <div className="flex items-center gap-2.5">
            <Link href="/" className="shrink-0">
              <span className="text-sm font-bold text-slate-200 tracking-tight">LabAxis</span>
            </Link>
            <div className="w-px h-4 bg-slate-700" />
            <span className="text-xs font-medium text-slate-400">비교 판단</span>
          </div>
          <Link
            href="/test/search"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            소싱으로
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Decision summary strip */}
        <div
          className="flex items-center gap-2 px-4 md:px-6 py-1.5 border-b border-slate-700 flex-wrap"
          style={{ backgroundColor: '#393b3f' }}
        >
          {/* Suitability badge */}
          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded border font-medium ${
            suitabilityLevel === "high"
              ? "text-emerald-400 bg-emerald-600/10 border-emerald-600/30"
              : suitabilityLevel === "medium"
              ? "text-amber-400 bg-amber-600/10 border-amber-600/30"
              : "text-red-400 bg-red-600/10 border-red-600/30"
          }`}>
            비교 적합도 {suitabilityLevel === "high" ? "높음" : suitabilityLevel === "medium" ? "보통" : "낮음"}
          </span>

          <span className="text-[10px] text-slate-500">{products.length}개 비교중</span>

          {hasPriceDiff && cheapestProduct && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-emerald-400">최저가 {cheapestProduct.name.substring(0, 14)}</span>
            </>
          )}
          {fastestProduct && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-blue-400">최단납기 {fastestProduct.name.substring(0, 14)}</span>
            </>
          )}

          {hasPriceDiff && (
            <Badge className="text-[9px] h-4 bg-amber-600/10 text-amber-400 border-amber-600/20 border">
              가격차 {Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%
            </Badge>
          )}
          {uniqueCategories.length > 1 && (
            <Badge className="text-[9px] h-4 bg-red-600/10 text-red-400 border-red-600/20 border">
              카테고리 혼합
            </Badge>
          )}
        </div>
      </div>

      {/* ═══ 2. Main content (flex-1, two-pane) ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: scrollable main area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 space-y-5">

            {/* ── 1-item notice ────────────────────────────────────────────── */}
            {products.length === 1 && (
              <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-blue-300">
                  비교를 시작하려면 항목을 <strong>하나 더 추가</strong>하세요. 현재 1개 제품만 선택되었습니다.
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-400 border-blue-600/30" asChild>
                    <Link href="/test/search">유사 제품 찾기</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[10px] bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={() => {
                      addProductToQuote(products[0]);
                      toast({ title: "견적 리스트에 추가됨", description: products[0].name });
                    }}
                  >
                    이 항목만 견적 담기
                  </Button>
                </div>
              </div>
            )}

            {/* ── a) Scenario strip ────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">비교 관점</span>
              {[
                { key: "cost", label: "최저 총비용" },
                { key: "leadtime", label: "최단 납기" },
                { key: "spec", label: "규격 완전 일치" },
                { key: "manual", label: "수동 선택" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    scenario === s.key
                      ? "bg-blue-600/20 text-blue-300 border-blue-600/40"
                      : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1.5">
                {/* Highlight toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHighlightDifferences(!showHighlightDifferences)}
                  className="h-7 px-2 text-[10px] text-slate-400 hover:text-slate-200"
                >
                  {showHighlightDifferences ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showHighlightDifferences ? "숨기기" : "차이점"}
                </Button>
                {/* Filter */}
                <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-slate-400 hover:text-slate-200">
                      <Filter className="h-3 w-3 mr-1" />
                      필터
                      {(filterCategory !== "all" || filterBrand !== "all" || filterVendor !== "all") && (
                        <span className="ml-1 text-blue-400">●</span>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-sm">필터 설정</DialogTitle>
                      <DialogDescription className="text-xs">비교할 제품을 필터링합니다</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">카테고리</Label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">브랜드</Label>
                        <Select value={filterBrand} onValueChange={setFilterBrand}>
                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {brands.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">벤더</Label>
                        <Select value={filterVendor} onValueChange={setFilterVendor}>
                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {vendors.map((vendor) => <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setFilterCategory("all"); setFilterBrand("all"); setFilterVendor("all"); }}>
                          초기화
                        </Button>
                        <Button size="sm" className="text-xs" onClick={() => setIsFilterDialogOpen(false)}>적용</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* ── b) Decision candidate cards ──────────────────────────────── */}
            <div className="space-y-2">
              {products.map((product: any, index: number) => {
                const vendor = product.vendors?.[0];
                const isCheapest = cheapestProduct?.id === product.id && hasPriceDiff;
                const isFastest = fastestProduct?.id === product.id && hasLeadTimeData;
                const isInQuote = quoteItems.some((q: any) => q.productId === product.id);
                const isSelected = selectedProductId === product.id;
                const leadTime = getAverageLeadTime(product);

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductId(isSelected ? null : product.id)}
                    className={`rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? "border-blue-600/50 bg-blue-600/5"
                        : isCheapest
                        ? "border-emerald-700/40 bg-emerald-600/5 hover:border-emerald-600/60"
                        : isFastest
                        ? "border-blue-700/40 bg-blue-600/5 hover:border-blue-600/60"
                        : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                    }`}
                  >
                    <div className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                      {/* Left: product info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-100 leading-tight">{product.name}</span>
                          {isCheapest && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-600/20">최저가</span>}
                          {isFastest && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400 border border-blue-600/20">최단납기</span>}
                          {!vendor?.priceInKRW && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">가격 문의</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                          {product.brand && <span>{product.brand}</span>}
                          {product.catalogNumber && <><span className="text-slate-700">·</span><span>{product.catalogNumber}</span></>}
                          {product.specification && <><span className="text-slate-700">·</span><span>{product.specification}</span></>}
                        </div>
                      </div>

                      {/* Center: price + lead time */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          {vendor?.priceInKRW ? (
                            <div className="text-sm font-bold text-slate-100">₩{vendor.priceInKRW.toLocaleString("ko-KR")}</div>
                          ) : (
                            <div className="text-xs text-slate-500">가격 미등록</div>
                          )}
                          {leadTime > 0 && (
                            <div className="text-[10px] text-slate-500">{leadTime}일 납기</div>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!isInQuote) {
                              addProductToQuote(product);
                              toast({ title: "견적 리스트에 추가됨", description: product.name });
                            }
                          }}
                          className={`h-7 px-2 text-[10px] ${
                            isInQuote
                              ? "text-emerald-400 bg-emerald-600/10 border border-emerald-600/20"
                              : "text-slate-400 hover:text-slate-200 border border-slate-700"
                          }`}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {isInQuote ? "담김" : "견적 담기"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { trackEvent("compare_remove_item", { product_id: product.id }); toggleCompare(product.id); }}
                          className="h-7 px-2 text-[10px] text-slate-500 hover:text-red-400 hover:bg-red-600/10 border border-slate-700"
                        >
                          <X className="h-3 w-3 mr-1" />
                          제외
                        </Button>
                        {/* Reorder */}
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveProduct(index, "up")} disabled={index === 0} className="text-slate-600 hover:text-slate-300 disabled:opacity-30">
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                          <button onClick={() => moveProduct(index, products.length - 1)} disabled={index === products.length - 1} className="text-slate-600 hover:text-slate-300 disabled:opacity-30">
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── c) Normalized Decision Matrix ────────────────────────────── */}
            {products.length >= 2 && (
              <div className="rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between" style={{ backgroundColor: '#393b3f' }}>
                  <span className="text-xs font-semibold text-slate-300">판단 매트릭스</span>
                  <span className="text-[10px] text-slate-500">항목별 비교</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="sticky left-0 z-10 w-28 text-[10px] text-slate-500 px-3 py-2" style={{ backgroundColor: '#303236' }}>항목</TableHead>
                        {products.map((product: any) => (
                          <TableHead key={product.id} className="min-w-[140px] text-[10px] text-slate-300 px-3 py-2">
                            <div className="leading-tight">
                              <div className="font-medium truncate max-w-[130px]">{product.name}</div>
                              {product.brand && <div className="text-slate-500 font-normal">{product.brand}</div>}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixFields.map((field) => (
                        <TableRow key={field.key} className="border-slate-800 hover:bg-slate-800/30">
                          <TableCell className="sticky left-0 z-10 text-[10px] font-medium text-slate-400 px-3 py-2" style={{ backgroundColor: '#303236' }}>
                            {field.label}
                          </TableCell>
                          {products.map((product: any) => {
                            let value: any;
                            let allValues: any[] = [];

                            if (field.key === "price") {
                              value = product.vendors?.[0]?.priceInKRW || 0;
                              allValues = products.map((p: any) => p.vendors?.[0]?.priceInKRW || 0);
                            } else if (field.key === "leadTime") {
                              const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
                              value = manualLeadTimes[vendorKey] || getAverageLeadTime(product) || 0;
                              allValues = products.map((p: any) => {
                                const vk = `${p.id}_${p.vendors?.[0]?.vendor?.id || 0}`;
                                return manualLeadTimes[vk] || getAverageLeadTime(p) || 0;
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

                            const cellClass = `${getDifferenceHighlight(field.key, allValues)} ${getOptimalHighlight(field.key, value, allValues)}`;

                            // Judgment badge
                            let judgment: { label: string; cls: string } | null = null;
                            if (field.key === "price" && value > 0) {
                              const nums = allValues.filter((v: any) => typeof v === "number" && v > 0);
                              if (nums.length > 1 && value === Math.min(...nums)) {
                                judgment = { label: "최저", cls: "text-emerald-400 bg-emerald-600/10 border-emerald-600/20" };
                              } else if (nums.length > 1 && value === Math.max(...nums)) {
                                judgment = { label: "최고", cls: "text-amber-400 bg-amber-600/10 border-amber-600/20" };
                              }
                            }
                            if (field.key === "leadTime" && typeof value === "number" && value > 0) {
                              const nums = allValues.filter((v: any) => typeof v === "number" && v > 0);
                              if (nums.length > 1 && value === Math.min(...nums)) {
                                judgment = { label: "최단", cls: "text-blue-400 bg-blue-600/10 border-blue-600/20" };
                              }
                            }

                            // Lead time special rendering
                            if (field.key === "leadTime") {
                              const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
                              const manualLT = manualLeadTimes[vendorKey];
                              const avgLT = getAverageLeadTime(product);
                              const isUserAvg = !!averageLeadTimes[product.id];
                              const displayLT = manualLT || avgLT;
                              return (
                                <TableCell key={product.id} className={`${cellClass} text-[10px] px-3 py-2`}>
                                  <div className="flex items-center gap-1">
                                    {displayLT > 0 ? (
                                      <>
                                        <span className="text-slate-200">{displayLT}일</span>
                                        {!manualLT && avgLT > 0 && (
                                          <span className="text-[9px] text-slate-500">({isUserAvg ? "평균" : "벤더"})</span>
                                        )}
                                        {manualLT && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingLeadTime({ productId: product.id, vendorIndex: 0 }); setTempLeadTime(manualLT.toString()); }}
                                            className="text-slate-600 hover:text-slate-400"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                        {judgment && (
                                          <span className={`text-[9px] px-1 py-0.5 rounded border ${judgment.cls}`}>{judgment.label}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell key={product.id} className={`${cellClass} text-[10px] px-3 py-2`}>
                                <div className="flex items-center gap-1">
                                  {field.key === "price" && value > 0 ? (
                                    <span className="text-slate-200 font-medium">₩{value.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-slate-300">{String(value)}</span>
                                  )}
                                  {judgment && (
                                    <span className={`text-[9px] px-1 py-0.5 rounded border ${judgment.cls}`}>{judgment.label}</span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── d) Recommendation block ───────────────────────────────────── */}
            {products.length >= 2 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-3 space-y-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-200">추천 근거 요약</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {hasPriceDiff && cheapestProduct && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">●</span>
                      <span className="text-slate-300">
                        <strong className="text-slate-200">{cheapestProduct.name.substring(0, 22)}</strong>이 최저가
                        (₩{cheapestPrice.toLocaleString()}) — 최고가 대비{" "}
                        <strong className="text-amber-400">{Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%</strong> 저렴
                      </span>
                    </div>
                  )}
                  {hasLeadTimeData && fastestProduct && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5 shrink-0">●</span>
                      <span className="text-slate-300">
                        <strong className="text-slate-200">{fastestProduct.name.substring(0, 22)}</strong>의 납기가 가장 빠름
                        ({getAverageLeadTime(fastestProduct)}일)
                      </span>
                    </div>
                  )}
                  {uniqueCategories.length > 1 && (
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5 shrink-0">●</span>
                      <span className="text-slate-400">서로 다른 카테고리 ({uniqueCategories.length}개) 포함 — 직접 사양 비교 시 주의 필요</span>
                    </div>
                  )}
                  {!hasPriceDiff && !hasLeadTimeData && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 mt-0.5 shrink-0">●</span>
                      <span className="text-slate-500">가격·납기 데이터가 충분히 등록되면 추천 근거가 표시됩니다</span>
                    </div>
                  )}
                </div>

                {/* 다음 조치 */}
                <div className="pt-1 border-t border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] text-slate-500">다음 조치</span>
                  <div className="flex items-center gap-2">
                    {quoteItemsCount === 0 ? (
                      <span className="text-[10px] text-slate-400">제품을 선택해 견적 담기를 눌러보세요</span>
                    ) : (
                      <Button size="sm" className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white" asChild>
                        <Link href="/test/quote">견적 {quoteItemsCount}건 → 요청 조립</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Evidence Rail (lg+, 400px) ────────────────────────────────────── */}
        <div className="hidden lg:flex w-[380px] shrink-0 border-l border-slate-700 flex-col overflow-y-auto" style={{ backgroundColor: '#2c2e32' }}>
          {selectedProduct ? (
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-100 leading-snug">{selectedProduct.name}</div>
                  {selectedProduct.brand && <div className="text-[10px] text-slate-500 mt-0.5">{selectedProduct.brand}</div>}
                </div>
                <button onClick={() => setSelectedProductId(null)} className="text-slate-600 hover:text-slate-400 shrink-0 mt-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Vendor info */}
              {selectedProduct.vendors?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">공급사 정보</div>
                  {selectedProduct.vendors.map((v: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-700 p-2.5 space-y-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-300">{v.vendor?.name || "공급사"}</span>
                        {v.priceInKRW && <span className="text-emerald-400 font-semibold">₩{v.priceInKRW.toLocaleString()}</span>}
                      </div>
                      {v.leadTime && <div className="text-slate-500">납기 {v.leadTime}일</div>}
                      {v.stockStatus && <div className="text-slate-500">재고 {v.stockStatus}</div>}
                      {v.minOrderQty && <div className="text-slate-500">최소 주문 {v.minOrderQty}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Spec details */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">스펙 상세</div>
                <div className="rounded-lg border border-slate-700 p-2.5 space-y-1.5 text-[10px]">
                  {[
                    { label: "카탈로그 번호", value: selectedProduct.catalogNumber },
                    { label: "규격/용량", value: selectedProduct.specification },
                    { label: "Grade", value: selectedProduct.grade },
                    { label: "카테고리", value: PRODUCT_CATEGORIES[selectedProduct.category as keyof typeof PRODUCT_CATEGORIES] || selectedProduct.category },
                    { label: "원산지", value: selectedProduct.countryOfOrigin },
                    { label: "제조사", value: selectedProduct.manufacturer },
                  ].filter(row => row.value).map((row) => (
                    <div key={row.label} className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">{row.label}</span>
                      <span className="text-slate-300 text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={() => {
                    if (!quoteItems.some((q: any) => q.productId === selectedProduct.id)) {
                      addProductToQuote(selectedProduct);
                      toast({ title: "견적 리스트에 추가됨", description: selectedProduct.name });
                    }
                  }}
                  disabled={quoteItems.some((q: any) => q.productId === selectedProduct.id)}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {quoteItems.some((q: any) => q.productId === selectedProduct.id) ? "이미 담김" : "견적 담기"}
                </Button>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs text-red-400 border-red-700/30 hover:bg-red-600/10"
                    onClick={() => { trackEvent("compare_remove_item", { product_id: selectedProduct.id }); toggleCompare(selectedProduct.id); setSelectedProductId(null); }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    비교 제외
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                    <Link href={`/products/${selectedProduct.id}`} target="_blank">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      상세 페이지
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">비교 요약</div>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>비교 중인 제품</span>
                  <span className="text-slate-200">{products.length}개</span>
                </div>
                {cheapestPrice > 0 && (
                  <div className="flex justify-between">
                    <span>최저가</span>
                    <span className="text-emerald-400">₩{cheapestPrice.toLocaleString()}</span>
                  </div>
                )}
                {highestPrice > 0 && (
                  <div className="flex justify-between">
                    <span>최고가</span>
                    <span className="text-slate-300">₩{highestPrice.toLocaleString()}</span>
                  </div>
                )}
                {hasPriceDiff && (
                  <div className="flex justify-between">
                    <span>가격 차</span>
                    <span className="text-amber-400">{Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%</span>
                  </div>
                )}
                {fastestProduct && (
                  <div className="flex justify-between">
                    <span>최단 납기</span>
                    <span className="text-blue-400">{getAverageLeadTime(fastestProduct)}일</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-[10px] text-slate-600">제품 카드를 클릭하면 상세 정보를 확인할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ═══ 3. Sticky Action Dock ═══ */}
      <div
        className="shrink-0 border-t border-slate-700 px-4 md:px-6 py-2.5"
        style={{ backgroundColor: '#434548' }}
      >
        <div className="flex items-center justify-between max-w-5xl mx-auto flex-wrap gap-2">
          {/* Left: context info */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              {scenario === "cost" ? "최저 총비용"
                : scenario === "leadtime" ? "최단 납기"
                : scenario === "spec" ? "규격 완전 일치"
                : "수동 선택"}
            </span>
            <span className="text-slate-700">·</span>
            <span>{products.length}개 제품</span>
            {cheapestPrice > 0 && highestPrice > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span>₩{cheapestPrice.toLocaleString()} — ₩{highestPrice.toLocaleString()}</span>
              </>
            )}
          </div>

          {/* Right: CTAs */}
          <div className="flex items-center gap-2">
            {/* Clear all */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-slate-500 hover:text-red-400 hover:bg-red-600/10">
                  전체 비우기
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>비교 대상 전체 비우기</AlertDialogTitle>
                  <AlertDialogDescription>
                    비교 중인 제품 {compareIds.length}개를 모두 제거합니다. 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={clearCompare} className="bg-red-600 hover:bg-red-700">
                    전체 비우기
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* CSV */}
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-slate-400 hover:text-slate-200" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>

            {/* Primary: add to quote */}
            <Button
              size="sm"
              className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              onClick={() => {
                products.forEach((product: any) => addProductToQuote(product));
                toast({ title: "견적 리스트에 추가됨", description: `${products.length}개 제품을 담았습니다.` });
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              견적 담기 ({products.length}개 선택)
            </Button>

            {quoteItemsCount > 0 && (
              <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium" asChild>
                <Link href="/test/quote">요청 조립 →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Lead time edit dialog ──────────────────────────────────────────── */}
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
              <Button variant="outline" onClick={() => { setEditingLeadTime(null); setTempLeadTime(""); }}>취소</Button>
              <Button
                onClick={() => {
                  if (editingLeadTime) {
                    const leadTime = parseInt(tempLeadTime) || 0;
                    const product = products.find((p: any) => p.id === editingLeadTime.productId);
                    if (product) {
                      const vendorKey = `${product.id}_${product.vendors?.[editingLeadTime.vendorIndex]?.vendor?.id || 0}`;
                      setManualLeadTimes((prev) => {
                        const updated = { ...prev, [vendorKey]: leadTime };
                        if (typeof window !== "undefined") localStorage.setItem("manualLeadTimes", JSON.stringify(updated));
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
