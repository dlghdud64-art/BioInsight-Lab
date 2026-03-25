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
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Pause,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
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
import { generateCompareDecision, type CompareDecisionSummary } from "@/lib/ai/suggestion-engine";

export default function TestComparePage() {
  const { compareIds, toggleCompare, clearCompare, addProductToQuote, quoteItems } = useTestFlow();
  const { toast } = useToast();
  const router = useRouter();

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
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [resolvedBlockers, setResolvedBlockers] = useState<Set<number>>(new Set());

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

  // 차이점 하이라이트 함수
  const getDifferenceHighlight = (field: string, values: any[]) => {
    if (!showHighlightDifferences) return "";
    const uniqueValues = new Set(values.map((v) => String(v || "-")));
    if (uniqueValues.size > 1) {
      return "bg-yellow-600/10 border-yellow-700";
    }
    return "";
  };

    // Scenario controls sort when no manual sortBy override
    const effectiveSort = scenario === "cost" ? "price"
      : scenario === "leadtime" ? "leadTime"
      : scenario === "spec" ? "specification"
      : sortBy;

    if (field === "price") {
      const numericValues = allValues.filter((v) => typeof v === "number" && v > 0);
      if (numericValues.length > 0) {
        const minValue = Math.min(...numericValues);
        if (value === minValue) {
          return "bg-green-600/10 border-green-700 font-semibold";
        }
      }
    }

    if (field === "leadTime") {
      const numericValues = allValues.filter((v) => typeof v === "number" && v > 0);
      if (numericValues.length > 0) {
        const minValue = Math.min(...numericValues);
        if (value === minValue) {
          return "bg-blue-600/10 border-blue-700 font-semibold";
        }
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

  if (compareIds.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-16 px-4 mt-8">
        {/* 헤더 강화 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-2">Step 2. 제품 비교</h1>
          <p className="text-sm text-slate-400">스펙·가격·납기를 한눈에 비교하세요</p>
        </div>

        {/* Empty State — workspace placeholder */}
        <div className="w-full max-w-3xl mx-auto rounded-xl border border-bd bg-pn p-6 md:p-8">
          {/* 비교 슬롯 3개 placeholder */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            {[1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="rounded-xl border border-dashed border-bd bg-el p-4 md:p-6 flex flex-col items-center justify-center min-h-[160px] md:min-h-[200px] transition-colors hover:border-slate-600"
              >
                <div className="w-11 h-11 rounded-xl bg-pn border border-bd flex items-center justify-center mb-3">
                  <Plus className="h-5 w-5 text-slate-500" />
                </div>
                <span className="text-xs text-slate-500 font-medium">슬롯 {slot}</span>
                <span className="text-[10px] text-slate-600 mt-0.5">비어 있음</span>
              </div>
            ))}
          </div>

          {/* 액션 유도 안내 */}
          <div className="flex flex-col items-center text-center pt-2 pb-2">
            <div className="w-12 h-12 rounded-xl bg-el border border-bd flex items-center justify-center mb-4">
              <Compare className="h-6 w-6 text-slate-500" strokeWidth={1.5} />
            </div>

            <h3 className="text-lg font-semibold text-slate-100 mb-1.5">제품을 추가하고 비교하세요</h3>
            <p className="text-sm text-slate-400 mb-1 max-w-md leading-relaxed">
              Step 1에서 제품을 검색한 뒤 &apos;비교 담기&apos;를 눌러 슬롯을 채워보세요.
            </p>
            <p className="text-xs text-slate-500 mb-6 max-w-md">
              최대 5개 제품의 스펙 · 가격 · 납기를 한눈에 비교할 수 있습니다.
            </p>

            <Link href="/test/search">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8">
                <Search className="h-4 w-4 mr-2" />
                제품 검색하러 가기
              </Button>
            </Link>
          </div>
        </div>
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
              <p className="text-sm text-red-400 mb-2">
                제품 정보를 불러오는 중 오류가 발생했습니다.
              </p>
              <p className="text-xs text-slate-400 mb-4">
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
  
  // 원료 카테고리인 경우 원료 필드를 우선 노출
  const compareFields = [
    { key: "name", label: "제품명" },
    { key: "catalogNumber", label: "카탈로그 번호" },
    { key: "brand", label: "브랜드" },
    { key: "category", label: "카테고리" },
    { key: "specification", label: "규격/용량" },
    { key: "grade", label: "Grade" },
    // 원료 카테고리인 경우 원료 필드를 우선 노출 (일반 필드보다 앞에 배치)
    ...(hasRawMaterial ? [
      { key: "pharmacopoeia", label: "규정/표준", priority: true },
      { key: "coaUrl", label: "COA", priority: true },
      { key: "countryOfOrigin", label: "원산지", priority: true },
      { key: "manufacturer", label: "제조사", priority: true },
    ] : []),
    { key: "price", label: "최저가" },
    { key: "leadTime", label: "납기일" },
    { key: "stockStatus", label: "재고" },
    { key: "minOrderQty", label: "최소 주문량" },
    { key: "vendorCount", label: "공급사 수" },
  ];

  const quoteItemsCount = quoteItems.length;

  // 비교 적합도
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
      {/* ═══ Decision Header ═══ */}
      <div className="shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0">
              <span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span>
            </Link>
            <div className="w-px h-4 md:h-5 bg-bd" />
            <span className="text-xs md:text-sm font-medium text-slate-400">비교 판단</span>
          </div>
          <Link href="/test/search" className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400 hover:text-slate-200 transition-colors">
            소싱으로
          </Link>
        </div>

        {/* Decision Summary Strip */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-bd flex-wrap" style={{ backgroundColor: '#393b3f' }}>
          {/* Suitability badge */}
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${
            suitabilityLevel === "high"
              ? "text-emerald-400 bg-emerald-600/10 border-emerald-600/30"
              : suitabilityLevel === "medium"
              ? "text-amber-400 bg-amber-600/10 border-amber-600/30"
              : "text-red-400 bg-red-600/10 border-red-600/30"
          }`}>
            적합도 {suitabilityLevel === "high" ? "높음" : suitabilityLevel === "medium" ? "보통" : "낮음"}
          </span>

          {/* KPI */}
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400">
            <span>{products.length}개 비교중</span>
            {hasPriceDiff && cheapestProduct && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400">최저가 {cheapestProduct.name.substring(0, 12)}</span>
              </>
            )}
            {fastestProduct && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-blue-400">최단납기 {fastestProduct.name.substring(0, 12)}</span>
              </>
            )}
          </div>

          {/* Difference summary */}
          {products.length >= 2 && (
            <div className="flex items-center gap-1.5">
              {hasPriceDiff && (
                <Badge variant="secondary" className="text-[9px] bg-amber-600/10 text-amber-400 border-amber-600/20">
                  가격차 {Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%
                </Badge>
              )}
              {uniqueCategories.length > 1 && (
                <Badge variant="secondary" className="text-[9px] bg-red-600/10 text-red-400 border-red-600/20">
                  카테고리 혼합
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Scrollable Compare Content ═══ */}
      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">

      {/* 비교 도구 버튼 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto">
          <h2 className="text-base font-semibold text-slate-100">비교 도구</h2>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            onClick={() => setShowHighlightDifferences(!showHighlightDifferences)}
            className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm h-7 sm:h-8"
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] sm:text-xs md:text-sm h-7 sm:h-8 text-slate-400 hover:text-red-400 hover:bg-red-600/10 hover:border-red-700">
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
            className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm h-7 sm:h-8"
            size="sm"
          >
            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">CSV 내보내기</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>
      </div>

      {/* 비교 적합도 + 요약 배너 */}
      {products.length >= 2 && (
        <div className={`rounded-xl border px-4 py-3 space-y-2 ${
          suitabilityLevel === "high"
            ? "bg-green-600/10 border-green-700"
            : suitabilityLevel === "medium"
            ? "bg-amber-600/10 border-amber-700"
            : "bg-orange-600/10 border-orange-700"
        }`}>
          {/* 적합도 라벨 + 설명 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              suitabilityLevel === "high"
                ? "bg-green-600/20 text-green-400"
                : suitabilityLevel === "medium"
                ? "bg-amber-600/20 text-amber-400"
                : "bg-orange-600/20 text-orange-400"
            }`}>
              비교 적합도: {suitabilityLevel === "high" ? "높음" : suitabilityLevel === "medium" ? "보통" : "낮음"}
            </span>
            <span className="text-xs text-slate-400">
              {suitabilityLevel === "high"
                ? "선택된 제품이 동일 카테고리에 속해 직접 비교에 적합합니다."
                : suitabilityLevel === "medium"
                ? "카테고리가 다른 제품이 포함되어 있어 일부 항목만 직접 비교할 수 있습니다."
                : "카테고리가 서로 다른 제품들이 포함되어 있어 스펙 비교 시 주의가 필요합니다."}
            </span>
          </div>
          {/* 빠른 요약 */}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {hasPriceDiff && cheapestProduct && (
              <span className="text-xs text-slate-400">
                최저가:{" "}
                <span className="font-semibold text-slate-300">
                  {cheapestProduct.name.length > 14 ? cheapestProduct.name.slice(0, 14) + "…" : cheapestProduct.name}
                </span>{" "}
                (₩{cheapestPrice.toLocaleString("ko-KR")})
              </span>
            )}
            {hasLeadTimeData && fastestProduct && (
              <span className="text-xs text-slate-400">
                납기 빠름:{" "}
                <span className="font-semibold text-slate-300">
                  {fastestProduct.name.length > 14 ? fastestProduct.name.slice(0, 14) + "…" : fastestProduct.name}
                </span>{" "}
                ({getAverageLeadTime(fastestProduct)}일)
              </span>
            )}
            {!hasPriceDiff && !hasLeadTimeData && (
              <span className="text-xs text-slate-400">가격·납기 데이터가 충분히 등록되면 요약이 표시됩니다.</span>
            )}
          </div>
        </div>
      )}

      {/* ═══ Layer 3: Insight — 핵심 차이 요약 (차트보다 위, 판단 우선) ═══ */}
      {products.length >= 2 && (
        <div className="rounded-xl border border-bd bg-pn px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">핵심 차이 요약</div>
          <div className="space-y-1.5 text-xs text-slate-300">
            {hasPriceDiff && cheapestProduct && (
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">●</span>
                <span>
                  <strong>{cheapestProduct.name.substring(0, 20)}</strong>이 최저가 (₩{cheapestPrice.toLocaleString("ko-KR")}),
                  최고가 대비 <strong className="text-amber-400">{Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%</strong> 저렴
                </span>
              </div>
            )}
            {hasLeadTimeData && fastestProduct && (
              <div className="flex items-start gap-2">
                <span className="text-blue-400 shrink-0">●</span>
                <span>
                  <strong>{fastestProduct.name.substring(0, 20)}</strong>의 납기가 가장 빠름 ({getAverageLeadTime(fastestProduct)}일)
                </span>
              </div>
            )}
            {uniqueCategories.length > 1 && (
              <div className="flex items-start gap-2">
                <span className="text-amber-400 shrink-0">●</span>
                <span>서로 다른 카테고리 ({uniqueCategories.length}개) — 직접 사양 비교에 주의 필요</span>
              </div>
            )}
            {uniqueCategories.length === 1 && (
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">●</span>
                <span>동일 카테고리 — 직접 비교에 적합</span>
              </div>
            )}
            {!hasPriceDiff && !hasLeadTimeData && (
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">●</span>
                <span className="text-slate-400">가격·납기 데이터가 충분히 등록되면 차이 요약이 표시됩니다</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 1-item 안내 ═══ */}
      {products.length === 1 && (
        <div className="rounded-xl border border-blue-600/20 bg-blue-600/5 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-blue-300">
            비교를 시작하려면 항목을 <strong>하나 더 추가</strong>하세요. 현재 1개 제품만 선택되었습니다.
          </div>
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

      {/* ═══ Layer 2: Review Surface — 비교 제품 검토 카드 ═══ */}
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
                      <span className="ml-1 text-blue-400">●</span>
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
                        className="text-xs bg-pn text-white hover:bg-el"
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
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-2 sm:p-3 border border-bs rounded-lg hover:bg-el transition-colors"
                >
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <p className="font-medium text-[11px] sm:text-xs md:text-sm text-slate-100 w-full sm:w-auto text-center sm:text-left break-words">
                        {product.name}
                      </p>
                      <Link href={`/products/${product.id}`} className="w-full sm:w-auto flex justify-center sm:justify-start">
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
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap justify-center sm:justify-start">
                      {product.brand && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          {product.brand}
                        </Badge>
                      )}
                      {product.category && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category}
                        </Badge>
                      )}
                      {vendor?.vendor?.name && (
                        <span className="text-[10px] sm:text-xs text-slate-400">
                          {vendor.vendor.name}
                        </span>
                      )}
                      {vendor?.priceInKRW && (
                        <span className="text-[10px] sm:text-xs font-medium text-slate-100">
                          ₩{vendor.priceInKRW.toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto sm:ml-4 justify-center sm:justify-end">
                    {/* 견적 담기/담김 토글 */}
                    <Button
                      size="sm"
                      variant={quoteItems.some((q: any) => q.productId === product.id) ? "default" : "outline"}
                      onClick={() => {
                        if (!quoteItems.some((q: any) => q.productId === product.id)) {
                          addProductToQuote(product);
                          toast({ title: "견적 리스트에 추가됨", description: product.name });
                        }
                      }}
                      className={`text-[10px] sm:text-xs flex-1 sm:flex-none h-7 sm:h-8 ${
                        quoteItems.some((q: any) => q.productId === product.id)
                          ? "bg-emerald-600/15 text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/25"
                          : ""
                      }`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {quoteItems.some((q: any) => q.productId === product.id) ? "담김" : "견적 담기"}
                    </Button>
                    {/* 비교 제외 */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        trackEvent("compare_remove_item", { product_id: product.id });
                        toggleCompare(product.id);
                      }}
                      className="text-[10px] sm:text-xs hover:bg-red-600/10 hover:text-red-400 hover:border-red-700 flex-1 sm:flex-none h-7 sm:h-8"
                    >
                      <X className="h-3 w-3 mr-1" />
                      제외
                    </Button>
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

      {/* 차트 섹션 */}
      {products.length > 0 && (
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          {/* 가격 비교 차트 */}
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start text-sm sm:text-base md:text-lg">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                가격 비교
              </CardTitle>
              <CardDescription className="text-[10px] sm:text-xs text-center sm:text-left">
                벤더별 등록 최저가 기준 · 환율·배송비·세금은 별도
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <ResponsiveContainer width="100%" height={240} className="sm:h-[260px]">
                <BarChart data={priceChartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                실제 구매가는 공급사·발주 시점에 따라 달라질 수 있습니다.
              </p>
              {/* 판단 요약 */}
              {cheapestProduct && hasPriceDiff && (
                <div className="mt-3 px-3 py-2 bg-pn rounded-lg border border-bs">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-blue-400">최저가</span>는{" "}
                    <span className="font-medium">{cheapestProduct.name.length > 20 ? cheapestProduct.name.substring(0, 20) + "..." : cheapestProduct.name}</span>
                    {" "}(₩{cheapestPrice.toLocaleString()})
                    {highestPrice > cheapestPrice && (
                      <span className="text-slate-400">
                        , 최고가 대비 {Math.round(((highestPrice - cheapestPrice) / highestPrice) * 100)}% 저렴
                      </span>
                    )}
                  </p>
                </div>
              )}

          {/* 납기 비교 차트 */}
          {leadTimeChartData.length > 0 ? (
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start text-sm sm:text-base md:text-lg">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  납기 비교
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs text-center sm:text-left">
                  실제 수령 기준 평균 납기일 · 재고·공급사 상황에 따라 달라질 수 있음
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <ResponsiveContainer width="100%" height={240} className="sm:h-[260px]">
                  <BarChart data={leadTimeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tickFormatter={(value) => `${value}일`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => {
                        const isAvg = props.payload.isAverage;
                        const isUserAvg = props.payload.isUserAverage;
                        return [
                          `${value}일${isAvg ? (isUserAvg ? " (사용자 평균)" : " (벤더 평균)") : ""}`,
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
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" />
                    사용자 평균
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400" />
                    벤더 평균
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />
                    직접 입력
                  </span>
                </div>
                {/* 납기 판단 요약 */}
                {fastestProduct && hasLeadTimeData && (
                  <div className="mt-3 px-3 py-2 bg-pn rounded-lg border border-bs">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-blue-400">최단 납기</span>는{" "}
                      <span className="font-medium">{fastestProduct.name.length > 20 ? fastestProduct.name.substring(0, 20) + "..." : fastestProduct.name}</span>
                      {" "}({getAverageLeadTime(fastestProduct)}일)
                      {productsWithLeadTime.length > 1 && (() => {
                        const avgAll = Math.round(productsWithLeadTime.reduce((sum: number, p: any) => sum + getAverageLeadTime(p), 0) / productsWithLeadTime.length);
                        return avgAll > getAverageLeadTime(fastestProduct) ? (
                          <span className="text-slate-400">, 전체 평균({avgAll}일) 대비 빠름</span>
                        ) : null;
                      })()}
                    </p>
                  </div>
                )}
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
                <div className="text-center py-8 text-slate-400 text-sm">
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
            {/* 모바일: 카드형 레이아웃 */}
            <div className="md:hidden space-y-4 p-4">
              {products.map((product: any, productIndex: number) => (
                <div key={product.id} className="border border-bs rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-slate-100 flex-1">{product.name}</h3>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      제품 {productIndex + 1}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {compareFields.map((field) => {
                      let value: any;
                      if (field.key === "price") {
                        value = product.vendors?.[0]?.priceInKRW || 0;
                      } else if (field.key === "leadTime") {
                        const vendorKey = `${product.id}_${product.vendors?.[0]?.vendor?.id || 0}`;
                        const manualLeadTime = manualLeadTimes[vendorKey];
                        value = manualLeadTime || getAverageLeadTime(product) || 0;
                      } else if (field.key === "stockStatus") {
                        value = product.vendors?.[0]?.stockStatus || "-";
                      } else if (field.key === "minOrderQty") {
                        value = product.vendors?.[0]?.minOrderQty || "-";
                      } else if (field.key === "vendorCount") {
                        value = product.vendors?.length || 0;
                      } else if (field.key === "category") {
                        value = PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES] || product.category;
                      } else {
                        value = product[field.key] || "-";
                      }
                      
                      if (field.key === "leadTime" && value === 0) return null;
                      
                      return (
                        <div key={field.key} className="flex items-start justify-between gap-2 py-1 border-b border-bd last:border-0">
                          <span className="text-xs text-slate-400 font-medium">{field.label}</span>
                          <span className="text-xs text-slate-100 text-right flex-1">
                            {field.key === "price" && value > 0 ? (
                              `₩${value.toLocaleString()}`
                            ) : (
                              String(value)
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 데스크톱: 테이블 레이아웃 */}
            <div className="hidden md:block overflow-x-auto -mx-2 sm:-mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-2 sm:px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-pn z-10 w-[100px] sm:w-[120px] md:w-[150px] text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4">항목</TableHead>
                      {products.map((product: any, index: number) => (
                        <TableHead key={product.id} className="min-w-[120px] sm:min-w-[150px] md:min-w-[180px] text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-4">
                          <div className="flex items-start justify-between gap-0.5 sm:gap-1 md:gap-2">
                            <span className="flex-1 text-[10px] sm:text-xs md:text-sm text-center sm:text-left break-words leading-tight">{product.name}</span>
                            <div className="flex flex-col gap-0.5 sm:gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5"
                                onClick={() => moveProduct(index, "up")}
                                disabled={index === 0}
                                title="위로 이동"
                              >
                                <ArrowUp className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5"
                                onClick={() => moveProduct(index, "down")}
                                disabled={index === products.length - 1}
                                title="아래로 이동"
                              >
                                <ArrowDown className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3" />
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
                        <TableCell className="sticky left-0 bg-pn font-medium w-[100px] sm:w-[120px] md:w-[150px] text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4">
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
                          <TableCell key={product.id} className={`${cellClassName} text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4`}>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-0.5 sm:gap-1 md:gap-2">
                              {displayLeadTime > 0 ? (
                                <>
                                  <span className={isAverage ? "text-slate-400" : ""}>
                                    {displayLeadTime}일
                                    {isAverage && (
                                      <span className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 ml-0.5 sm:ml-1">
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
                          <TableCell key={product.id} className={`${cellClassName} text-[10px] sm:text-xs md:text-sm text-center sm:text-left px-1 sm:px-2 md:px-4`}>
                            {field.key === "price" && value > 0 ? (
                              <span className="whitespace-nowrap">₩{value.toLocaleString()}</span>
                            ) : (
                              <span className="break-words">{String(value)}</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
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
          </CardContent>
        </Card>
      )}

      {/* 대체품 추천 섹션 */}
      {products.length > 0 && (
        <Card className="mt-4 sm:mt-6">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-blue-400" />
              대체품 추천
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-xs md:text-sm text-center sm:text-left leading-relaxed">
              현재 비교 중인 제품과 유사한 대체 후보를 함께 확인해보세요.<br className="hidden sm:block" />
              카테고리, 용도, 규격, 공급 가능성을 기준으로 추천합니다.
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
          )}
        </div>

      </div>

      {/* ═══ 3. Sticky Action Dock ═══ */}
      <div
        className="shrink-0 border-t border-slate-700 px-4 md:px-6 py-2.5"
        style={{ backgroundColor: '#434548' }}
      >
        <div className="flex items-center justify-between max-w-[1240px] mx-auto flex-wrap gap-2">
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

            {/* Primary: enter review mode */}
            {products.length >= 2 ? (
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={() => {
                  trackEvent("compare_review_enter", { product_count: products.length, scenario });
                  setReviewMode(true);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                선택안 검토
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                onClick={() => {
                  products.forEach((product: any) => addProductToQuote(product));
                  toast({ title: "견적 리스트에 추가됨", description: `${products.length}개 제품을 담았습니다.` });
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                견적 담기
              </Button>
            )}

            {quoteItemsCount > 0 && (
              <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium" asChild>
                <Link href="/test/quote">요청 조립 →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Review Center Work Window ═══ */}
      {reviewMode && products.length >= 2 && (() => {
        const recommended = products[0]; // scenario-sorted first = recommended
        const recVendor = recommended?.vendors?.[0];
        const recPrice = recVendor?.priceInKRW || 0;
        const rejected = products.slice(1);
        const blockerItems: string[] = [];
        if (uniqueCategories.length > 1) blockerItems.push("서로 다른 카테고리 항목 포함 — 직접 비교 주의");
        if (products.some((p: any) => !p.vendors?.[0]?.priceInKRW)) blockerItems.push("일부 제품 가격 미등록");
        if (products.some((p: any) => !p.specification)) blockerItems.push("일부 제품 규격 미입력");
        const allResolved = blockerItems.length === 0 || blockerItems.every((_, i) => resolvedBlockers.has(i));

        return (
          <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
            {/* Review Header — sticky */}
            <div className="shrink-0 border-b border-bd" style={{ backgroundColor: '#434548' }}>
              <div className="flex items-center justify-between px-4 md:px-6 py-2.5">
                <div className="flex items-center gap-2">
                  <Link href="/" className="flex items-center gap-1.5 shrink-0">
                    <span className="text-base md:text-lg font-bold text-slate-100 tracking-tight">LabAxis</span>
                    <span className="text-xs md:text-sm font-semibold text-slate-400">검토</span>
                  </Link>
                  <div className="w-px h-5 bg-bd hidden sm:block" />
                  <span className="text-xs text-slate-400 hidden sm:block">선택안 검토 및 전달 준비</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={() => setReviewMode(false)}>
                    <ArrowLeft className="h-3 w-3 mr-1" />비교로 돌아가기
                  </Button>
                </div>
              </div>
              {/* Final review summary strip */}
              <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-t border-bd/50 flex-wrap" style={{ backgroundColor: '#393b3f' }}>
                <Badge variant="secondary" className="text-[10px] bg-emerald-600/10 text-emerald-400 border-emerald-600/20">추천안</Badge>
                <span className="text-xs font-medium text-slate-200">{recommended?.name?.substring(0, 30)}</span>
                {recPrice > 0 && <span className="text-xs tabular-nums text-slate-100 font-semibold">₩{recPrice.toLocaleString("ko-KR")}</span>}
                <span className="text-slate-600">·</span>
                <span className="text-[10px] text-slate-400">{products.length}개 비교 · {rejected.length}개 대안</span>
                {blockerItems.length > 0 && (
                  <span className="text-[10px] text-amber-400"><AlertTriangle className="h-3 w-3 inline mr-0.5" />{blockerItems.length}건 확인</span>
                )}
                {allResolved && <span className="text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3 inline mr-0.5" />전달 가능</span>}
              </div>
            </div>

            {/* Review body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Center: 3 review blocks */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">

                {/* Block A: 선택안 요약 */}
                <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
                  <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                    <span className="text-xs font-medium text-slate-200">선택안 요약</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-el border border-bd flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-100">{recommended?.name}</p>
                        <p className="text-xs text-slate-400">{recVendor?.vendor?.name || "공급사"} · {recommended?.catalogNumber || "—"}</p>
                      </div>
                      {recPrice > 0 && <span className="text-lg font-bold tabular-nums text-slate-100">₩{recPrice.toLocaleString("ko-KR")}</span>}
                    </div>
                    <div className="mt-3 text-xs text-slate-300 space-y-1">
                      {hasPriceDiff && <p>• 비교 대상 중 <strong className="text-emerald-400">최저가</strong> (가격차 {Math.round(((highestPrice - cheapestPrice) / cheapestPrice) * 100)}%)</p>}
                      {hasLeadTimeData && fastestProduct?.id === recommended?.id && <p>• <strong className="text-blue-400">최단 납기</strong> ({getAverageLeadTime(recommended)}일)</p>}
                      {uniqueCategories.length <= 1 && <p>• 동일 카테고리 — 규격 직접 비교 적합</p>}
                    </div>
                  </div>
                </div>

                {/* Block B: Blocker / Exception Checklist */}
                <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
                  <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                    <span className="text-xs font-medium text-slate-200">확인 항목 ({blockerItems.length}건)</span>
                  </div>
                  <div className="p-4">
                    {blockerItems.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />확인 필요 항목 없음 — 바로 전달 가능합니다
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {blockerItems.map((item, idx) => {
                          const resolved = resolvedBlockers.has(idx);
                          return (
                            <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded border ${resolved ? "border-emerald-600/20 bg-emerald-600/5" : "border-amber-600/20 bg-amber-600/5"}`}>
                              <div className="flex items-center gap-2 text-xs">
                                {resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                                <span className={resolved ? "text-slate-400 line-through" : "text-amber-300"}>{item}</span>
                              </div>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                                onClick={() => setResolvedBlockers(prev => {
                                  const next = new Set(prev);
                                  next.has(idx) ? next.delete(idx) : next.add(idx);
                                  return next;
                                })}>
                                {resolved ? "되돌리기" : "해결됨"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Block C: Handoff memo */}
                <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
                  <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                    <span className="text-xs font-medium text-slate-200">전달 메모</span>
                    <span className="text-[10px] text-slate-500 ml-2">견적관리 워크큐에 함께 전달됩니다</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <Textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="선택 배경, 공급사 협의 필요사항, 조건부 확인 항목, 긴급도 등"
                      className="min-h-[80px] text-xs bg-pn border-bd resize-none"
                    />
                  </div>
                </div>

                {/* Rejected candidates — collapsed */}
                {rejected.length > 0 && (
                  <details className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
                    <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200" style={{ backgroundColor: '#434548' }}>
                      대안 후보 ({rejected.length}건) — 펼치기
                    </summary>
                    <div className="p-4 space-y-1.5">
                      {rejected.map((p: any) => {
                        const v = p.vendors?.[0];
                        const price = v?.priceInKRW || 0;
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded border border-bd bg-pn">
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-300 truncate block">{p.name}</span>
                              <span className="text-[10px] text-slate-500">{v?.vendor?.name || "—"}</span>
                            </div>
                            {price > 0 && <span className="text-slate-400 tabular-nums shrink-0">₩{price.toLocaleString("ko-KR")}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>

              {/* Review Evidence Rail */}
              <div className="hidden lg:flex w-[380px] shrink-0 border-l border-bd flex-col overflow-y-auto" style={{ backgroundColor: '#353739' }}>
                <div className="px-5 py-4 border-b border-bd">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 근거 요약</div>
                  <div className="space-y-2 text-xs text-slate-300">
                    {hasPriceDiff && cheapestProduct && (
                      <div className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">●</span><span>최저가 {cheapestProduct.name.substring(0, 20)} (₩{cheapestPrice.toLocaleString("ko-KR")})</span></div>
                    )}
                    {hasLeadTimeData && fastestProduct && (
                      <div className="flex items-start gap-2"><span className="text-blue-400 shrink-0">●</span><span>최단납기 {fastestProduct.name.substring(0, 20)} ({getAverageLeadTime(fastestProduct)}일)</span></div>
                    )}
                    {uniqueCategories.length > 1 && (
                      <div className="flex items-start gap-2"><span className="text-amber-400 shrink-0">●</span><span>카테고리 혼합 ({uniqueCategories.length}개)</span></div>
                    )}
                  </div>
                </div>
                <div className="px-5 py-4 border-b border-bd">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">전달 상태</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-400">추천안</span><span className="text-slate-200">{recommended?.name?.substring(0, 15)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">확인 필요</span><span className={allResolved ? "text-emerald-400" : "text-amber-400"}>{allResolved ? "모두 해결" : `${blockerItems.length - resolvedBlockers.size}건 미해결`}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">메모</span><span className="text-slate-200">{reviewNote ? "작성됨" : "없음"}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">전달 가능</span><span className={allResolved ? "text-emerald-400 font-medium" : "text-amber-400"}>{allResolved ? "예" : "아니오"}</span></div>
                  </div>
                </div>
                <div className="flex-1" />
                <div className="px-5 py-4 border-t border-bd space-y-2" style={{ backgroundColor: '#434548' }}>
                  <Button size="sm" className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                    disabled={!allResolved}
                    onClick={() => {
                      products.forEach((p: any) => addProductToQuote(p));
                      trackEvent("compare_review_handoff", { product_count: products.length, note: !!reviewNote });
                      toast({ title: "견적관리 워크큐로 전달 준비 완료", description: `${products.length}개 제품이 견적 리스트에 추가되었습니다` });
                      setReviewMode(false);
                      router.push("/test/quote");
                    }}>
                    <Send className="h-3 w-3 mr-1.5" />
                    검토 완료 후 Workqueue로 보내기
                  </Button>
                  <Button size="sm" variant="outline" className="w-full h-7 text-[10px] text-slate-400 border-bd" onClick={() => setReviewMode(false)}>
                    비교로 돌아가기
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile sticky dock for review */}
            <div className="lg:hidden shrink-0 border-t-2 border-bd px-4 py-3" style={{ backgroundColor: '#434548' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {allResolved
                    ? <span className="text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3 inline mr-0.5" />전달 가능</span>
                    : <span className="text-[10px] text-amber-400"><AlertTriangle className="h-3 w-3 inline mr-0.5" />{blockerItems.length - resolvedBlockers.size}건 미해결</span>
                  }
                </div>
                <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                  disabled={!allResolved}
                  onClick={() => {
                    products.forEach((p: any) => addProductToQuote(p));
                    toast({ title: "전달 준비 완료", description: `${products.length}개 제품 추가됨` });
                    setReviewMode(false);
                    router.push("/test/quote");
                  }}>
                  Workqueue로 보내기
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

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
    </div>

    {products.length > 0 && (
      <div className="shrink-0 border-t-2 border-bd px-4 md:px-6 py-3" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center justify-between max-w-6xl mx-auto flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-slate-200">{products.length}개 비교중</span>
            {quoteItemsCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-emerald-600/15 text-emerald-400">견적 {quoteItemsCount}건</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-xs text-slate-400 hover:text-slate-200" asChild>
              <Link href="/test/search">다시 검색</Link>
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              onClick={() => {
                products.forEach((product: any) => addProductToQuote(product));
                toast({ title: "견적 리스트에 추가됨", description: `${products.length}개 제품을 담았습니다.` });
              }}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />전체 견적 담기
            </Button>
            {quoteItemsCount > 0 && (
              <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium" asChild>
                <Link href="/test/quote">요청 조립 →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    )}
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
          <span className="text-sm font-medium text-slate-300">{product.name}</span>
        </div>
        <p className="text-xs text-slate-400">대체품을 찾는 중...</p>
      </div>
    );
  }

  // 유사도 60% 미만 대체품 필터링
  const qualifiedAlts = (alternatives?.alternatives || []).filter(
    (alt: any) => alt.similarity >= 0.6
  );

  if (qualifiedAlts.length === 0) {
    return null;
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{product.name}</span>
        <Badge variant="outline" className="text-xs">
          대체품 {qualifiedAlts.length}개
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {qualifiedAlts.map((alt: any) => {
          const inCompare = compareIds.includes(alt.id);
          
          return (
            <Card key={alt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  {alt.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={alt.imageUrl}
                      alt={alt.name}
                      className="w-12 h-12 object-cover rounded"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Image
                      src="/brand/Bio-Insight.png"
                      alt={alt.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 object-cover rounded"
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
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">스펙 유사도</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      alt.similarity >= 0.8
                        ? "bg-green-600/20 text-green-400"
                        : alt.similarity >= 0.6
                        ? "bg-blue-600/20 text-blue-400"
                        : "bg-el text-slate-400"
                    }`}>
                      {Math.round(alt.similarity * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-el rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        alt.similarity >= 0.8
                          ? "bg-green-600/100"
                          : alt.similarity >= 0.6
                          ? "bg-blue-600/100"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.round(alt.similarity * 100)}%` }}
                    />
                  </div>
                  {alt.similarityReasons && alt.similarityReasons.length > 0 && (
                    <p className="text-xs text-slate-400 leading-relaxed pt-0.5">
                      <span className="font-medium text-slate-300">대체 가능: </span>
                      {alt.similarityReasons.slice(0, 3).join(", ")}
                    </p>
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
                    variant={inCompare ? "secondary" : "outline"}
                    size="sm"
                    className={`flex-1 text-xs ${inCompare ? "text-slate-400" : "text-blue-400 border-blue-700 hover:bg-blue-600/10"}`}
                    onClick={() => onAddToCompare(alt.id)}
                    disabled={inCompare}
                  >
                    <Compare className="h-3 w-3 mr-1" />
                    {inCompare ? "비교에 추가됨" : "비교에 추가"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-slate-300 px-2"
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

