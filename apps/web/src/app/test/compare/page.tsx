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
import { buildCompareDecisionOptionSet } from "@/lib/ai/decision-option-builders";
import type { DecisionOption, DecisionOptionSet } from "@/lib/ai/decision-option-set";

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
  // ── Step 3: compareSessionId — compareIds 기반 세션 식별자 ──
  const compareSessionId = useMemo(() => `cs_${compareIds.slice().sort().join("_")}`, [compareIds]);
  // ── Step 3 상태 분리: activeCompareItemId (rail용) + selectedDecisionItemId (기준안) ──
  const [activeCompareItemId, setActiveCompareItemId] = useState<string | null>(null);
  const [selectedDecisionItemId, _setSelectedDecisionItemId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try { return sessionStorage.getItem("compare_selectedDecisionItemId") || null; } catch { return null; }
    }
    return null;
  });
  const setSelectedDecisionItemId = (id: string | null) => {
    _setSelectedDecisionItemId(id);
    try { id ? sessionStorage.setItem("compare_selectedDecisionItemId", id) : sessionStorage.removeItem("compare_selectedDecisionItemId"); } catch {}
  };
  const [scenario, _setScenario] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try { return sessionStorage.getItem("compare_scenario") || "cost"; } catch { return "cost"; }
    }
    return "cost";
  });
  const setScenario = (s: string) => {
    _setScenario(s);
    try { sessionStorage.setItem("compare_scenario", s); } catch {}
  };
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [aiJudgmentDismissed, setAiJudgmentDismissed] = useState(false);
  const [resolvedBlockers, setResolvedBlockers] = useState<Set<number>>(new Set());
  // ── P2: 3-option decision surface ──
  const [activeDecisionOptionStrategy, setActiveDecisionOptionStrategy] = useState<"conservative" | "balanced" | "alternative">("balanced");

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
  // restore: selectedDecisionItemId가 현재 세션에 없으면 초기화
  useEffect(() => {
    if (allProducts.length > 0 && selectedDecisionItemId) {
      if (!allProducts.some((p: any) => p.id === selectedDecisionItemId)) {
        setSelectedDecisionItemId(null);
      }
    }
  }, [allProducts]); // eslint-disable-line react-hooks/exhaustive-deps

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
      : scenario === "spec_match" ? "specification"
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

  // AI Decision Summary
  const aiDecision = useMemo<CompareDecisionSummary | null>(
    () => generateCompareDecision({ products, scenario, getAverageLeadTime, quoteItemsCount }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.length, scenario, quoteItemsCount],
  );

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
          <Link href="/app/search">
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
  const selectedProduct = activeCompareItemId ? products.find((p: any) => p.id === activeCompareItemId) : null;
  const decisionProduct = selectedDecisionItemId ? products.find((p: any) => p.id === selectedDecisionItemId) : null;
  // recommendedItemId = scenario 정렬 1등 (자동 계산, 사용자 확정 아님)
  const recommendedItemId = products.length >= 2 ? products[0]?.id : null;

  // ── P2: 3-option decision set ──
  const compareOptionSet = useMemo<DecisionOptionSet | null>(() => {
    if (products.length < 2) return null;
    return buildCompareDecisionOptionSet({
      compareSessionId,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name || "",
        priceKRW: p.vendors?.[0]?.priceInKRW ?? null,
        leadTimeDays: getAverageLeadTime(p) || null,
        specMatchScore: null,
      })),
    });
  }, [compareSessionId, products, getAverageLeadTime]);

  const compareOptions = compareOptionSet?.options ?? [];
  const activeDecisionOption = compareOptions.find(o => o.frame === activeDecisionOptionStrategy) ?? compareOptions.find(o => o.frame === "balanced") ?? null;
  const shouldShowDecisionStrip = compareOptions.length === 3 && !aiJudgmentDismissed;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ 1. Sticky Decision Header ═══ */}
      <div className="shrink-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 md:px-6 py-1.5 border-b border-bd/50 bg-el"
        >
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm md:text-base font-bold text-slate-100 tracking-tight">LabAxis</span>
              <span className="text-xs md:text-sm font-semibold text-slate-400">비교</span>
            </Link>
            <div className="w-px h-5 bg-bd hidden sm:block" />
            <span className="text-xs text-slate-400 hidden sm:block">비교 판단 워크벤치</span>
          </div>
          <Link
            href="/app/search"
            className="flex items-center gap-1 text-xs md:text-sm text-slate-300 hover:text-white transition-colors font-medium"
          >
            소싱으로
            <ChevronRight className="h-3.5 w-3.5" />
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
          {/* 기준안 상태 */}
          {selectedDecisionItemId ? (
            <span className="text-[10px] text-emerald-400 font-medium">기준안 선택됨</span>
          ) : (
            <span className="text-[10px] text-slate-500">기준안 미선택</span>
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
          <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-4 space-y-5">

            {/* ── 1-item notice ────────────────────────────────────────────── */}
            {products.length === 1 && (
              <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-blue-300">
                  비교를 시작하려면 항목을 <strong>하나 더 추가</strong>하세요. 현재 1개 제품만 선택되었습니다.
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-400 border-blue-600/30" asChild>
                    <Link href="/app/search">유사 제품 찾기</Link>
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
                { key: "spec_match", label: "규격 완전 일치" },
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
                const isActive = activeCompareItemId === product.id;
                const isDecision = selectedDecisionItemId === product.id;
                const leadTime = getAverageLeadTime(product);

                return (
                  <div
                    key={product.id}
                    onClick={() => setActiveCompareItemId(isActive ? null : product.id)}
                    className={`rounded-xl border transition-colors cursor-pointer ${
                      isDecision
                        ? "border-emerald-500/60 bg-emerald-600/10 ring-1 ring-emerald-500/30"
                        : isActive
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
                          {isDecision && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-medium">기준안</span>}
                          {recommendedItemId === product.id && !isDecision && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-300 border border-blue-600/20">추천</span>}
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
                        {!isDecision ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedDecisionItemId(product.id)}
                            className="h-7 px-2 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-600/30 hover:bg-blue-600/10"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            기준안 설정
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedDecisionItemId(null)}
                            className="h-7 px-2 text-[10px] text-emerald-400 bg-emerald-600/10 border border-emerald-600/20"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            기준안
                          </Button>
                        )}
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

            {/* ═══ P2: 3-Option Decision Strip — 반자동 운영 판단안 ═══ */}
            {shouldShowDecisionStrip && (
              <div className="space-y-3">
                {/* strip header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-slate-300">판단안 3개</span>
                    <span className="text-[10px] text-slate-500">현재 비교 기준에 따라 3개의 검토 전략을 제안합니다</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-slate-500 hover:text-slate-300" onClick={() => setAiJudgmentDismissed(true)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* 3-option cards */}
                <div className="grid grid-cols-3 gap-2">
                  {compareOptions.map((opt) => {
                    const isActive = activeDecisionOption?.id === opt.id;
                    const strategyLabel = opt.frame === "conservative" ? "보수형" : opt.frame === "balanced" ? "균형형" : "대안형";
                    const strategyColor = opt.frame === "conservative" ? "blue" : opt.frame === "balanced" ? "emerald" : "amber";
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`text-left rounded-lg border p-2.5 transition-all ${
                          isActive
                            ? `border-${strategyColor}-500/40 bg-${strategyColor}-600/10 ring-1 ring-${strategyColor}-500/30`
                            : "border-slate-700/50 bg-[#2a2c30] hover:border-slate-600"
                        }`}
                        onClick={() => setActiveDecisionOptionStrategy(opt.frame as "conservative" | "balanced" | "alternative")}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                            isActive ? `bg-${strategyColor}-600/20 text-${strategyColor}-300 border border-${strategyColor}-500/30` : "bg-slate-700/50 text-slate-400"
                          }`}>{strategyLabel}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded ${
                            opt.confidence >= 0.8 ? "text-emerald-400" : opt.confidence >= 0.6 ? "text-blue-400" : "text-slate-500"
                          }`}>{opt.confidence >= 0.8 ? "높음" : opt.confidence >= 0.6 ? "보통" : "낮음"}</span>
                        </div>
                        <div className="text-[11px] font-medium text-slate-200 mb-0.5">{opt.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-2">{opt.rationale}</div>
                      </button>
                    );
                  })}
                </div>

                {/* active option detail */}
                {activeDecisionOption && (
                  <div className="rounded-lg border border-slate-700/50 bg-[#2a2c30] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">{activeDecisionOption.title}</span>
                      <span className="text-[9px] text-slate-500">{activeDecisionOption.recommendedUseCase}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{activeDecisionOption.rationale}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] font-semibold text-emerald-400 mb-1">장점</div>
                        {activeDecisionOption.strengths.map((s, i) => (
                          <div key={i} className="text-[10px] text-slate-300 flex items-start gap-1">
                            <Check className="h-2.5 w-2.5 text-emerald-500 mt-0.5 shrink-0" />{s}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[9px] font-semibold text-amber-400 mb-1">리스크</div>
                        {activeDecisionOption.risks.map((r) => (
                          <div key={r.id} className="text-[10px] text-slate-300 flex items-start gap-1">
                            <AlertTriangle className={`h-2.5 w-2.5 mt-0.5 shrink-0 ${r.severity === "high" ? "text-red-400" : r.severity === "medium" ? "text-amber-400" : "text-slate-500"}`} />{r.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* commit CTA — preview와 분리 */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                      <Button size="sm" className="h-7 px-3 text-[10px] bg-blue-600 hover:bg-blue-500 text-white"
                        onClick={() => {
                          // operator commit: preview → actual selectedDecisionItemId 변경
                          const targetId = (activeDecisionOption as any).targetItemId ?? products[0]?.id;
                          if (targetId) {
                            setSelectedDecisionItemId(targetId);
                            trackEvent("compare_decision_option_committed", { strategy: activeDecisionOption.frame, targetId });
                            toast({ title: "기준안 설정됨", description: activeDecisionOption.title });
                          }
                        }}>
                        이 안으로 기준안 설정
                      </Button>
                      {selectedDecisionItemId && (
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] text-emerald-300 hover:bg-emerald-600/10 border border-emerald-600/20"
                          onClick={() => router.push("/app/quote")}>
                          요청 단계 준비
                        </Button>
                      )}
                      {!selectedDecisionItemId && (
                        <span className="text-[10px] text-slate-500">기준안 채택 후 요청 단계로 이동할 수 있습니다</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── d-2) Recommendation block ───────────────────────────────────── */}
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

                {/* 추천안 → 기준안 반영 */}
                {recommendedItemId && recommendedItemId !== selectedDecisionItemId && (
                  <div className="pt-1 border-t border-slate-700 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] text-slate-400">
                      추천: <strong className="text-slate-200">{products[0]?.name?.substring(0, 20)}</strong>
                      {selectedDecisionItemId ? " (현재 기준안과 다름)" : " (기준안 미선택)"}
                    </span>
                    <Button size="sm" className="h-7 px-3 text-[10px] bg-blue-600 hover:bg-blue-500 text-white"
                      onClick={() => setSelectedDecisionItemId(recommendedItemId)}>
                      기준안으로 설정
                    </Button>
                  </div>
                )}

                {/* 다음 조치 */}
                <div className="pt-1 border-t border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] text-slate-500">
                    {selectedDecisionItemId
                      ? `기준안: ${decisionProduct?.name?.substring(0, 20) || "선택됨"}`
                      : "기준안 미선택"}
                  </span>
                  <div className="flex items-center gap-2">
                    {quoteItemsCount === 0 ? (
                      <span className="text-[10px] text-slate-400">제품을 선택해 견적 담기를 눌러보세요</span>
                    ) : (
                      <Button size="sm" className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white" asChild>
                        <Link href="/app/quote">견적 {quoteItemsCount}건 → 요청 조립</Link>
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
                <button onClick={() => setActiveCompareItemId(null)} className="text-slate-600 hover:text-slate-400 shrink-0 mt-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 현재 상태 + 기준안 설정 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600/10 text-blue-300 border border-blue-600/20">비교 중</span>
                {selectedDecisionItemId === activeCompareItemId ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-300 border border-emerald-500/20">기준안</span>
                ) : (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-slate-400 hover:text-blue-300 border border-slate-700"
                    onClick={() => setSelectedDecisionItemId(activeCompareItemId)}>
                    기준안으로 설정
                  </Button>
                )}
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
        <div className="flex items-center justify-between max-w-[1240px] mx-auto flex-wrap gap-2">
          {/* Left: context info */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              {scenario === "cost" ? "최저 총비용"
                : scenario === "leadtime" ? "최단 납기"
                : scenario === "spec_match" ? "규격 완전 일치"
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

            {/* 기준안 상태 */}
            {selectedDecisionItemId ? (
              <span className="text-[10px] text-emerald-400 hidden sm:inline">
                기준안: {decisionProduct?.name?.substring(0, 15)}
              </span>
            ) : (
              <span className="text-[10px] text-amber-400 hidden sm:inline">기준안 미선택</span>
            )}

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
                <Link href="/app/quote">요청 조립 →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Review Center Work Window ═══ */}
      {reviewMode && products.length >= 2 && (() => {
        // 기준안이 있으면 기준안 기준으로 handoff. 없으면 추천안만 표시 (자동 확정 금지)
        const recommended = selectedDecisionItemId
          ? products.find((p: any) => p.id === selectedDecisionItemId) ?? null
          : null;
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
              <div className="flex items-center justify-between px-4 md:px-6 py-1.5 border-b border-bd/50">
                <div className="flex items-center gap-2">
                  <Link href="/" className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm md:text-base font-bold text-slate-100 tracking-tight">LabAxis</span>
                    <span className="text-[11px] md:text-xs font-semibold text-slate-400">검토</span>
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
                    <div className="flex justify-between text-xs"><span className="text-slate-400">{selectedDecisionItemId ? "기준안" : "추천안"}</span><span className="text-slate-200">{recommended?.name?.substring(0, 15)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">확인 필요</span><span className={allResolved ? "text-emerald-400" : "text-amber-400"}>{allResolved ? "모두 해결" : `${blockerItems.length - resolvedBlockers.size}건 미해결`}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">메모</span><span className="text-slate-200">{reviewNote ? "작성됨" : "없음"}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">전달 가능</span><span className={allResolved ? "text-emerald-400 font-medium" : "text-amber-400"}>{allResolved ? "예" : "아니오"}</span></div>
                  </div>
                </div>
                <div className="flex-1" />
                <div className="px-5 py-4 border-t border-bd space-y-2" style={{ backgroundColor: '#434548' }}>
                  <Button size="sm" className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                    disabled={!allResolved || !decisionProduct}
                    onClick={() => {
                      if (!decisionProduct) return;
                      addProductToQuote(decisionProduct);
                      trackEvent("compare_review_handoff", { selectedDecisionItemId, note: !!reviewNote });
                      toast({ title: "견적 리스트에 추가됨", description: decisionProduct.name });
                      setReviewMode(false);
                      router.push("/app/quote");
                    }}>
                    <Send className="h-3 w-3 mr-1.5" />
                    {decisionProduct ? "기준안 견적 전환" : "기준안 선택 필요"}
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
                  disabled={!allResolved || !recommended}
                  onClick={() => {
                    if (!recommended) return;
                    addProductToQuote(recommended);
                    toast({ title: "견적 전환 완료", description: recommended.name });
                    setReviewMode(false);
                    router.push("/app/quote");
                  }}>
                  {recommended ? "기준안 견적 전환" : "기준안 선택 필요"}
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
  );
}
