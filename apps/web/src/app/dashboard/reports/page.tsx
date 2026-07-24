"use client";

export const dynamic = 'force-dynamic';

import { csrfFetch } from "@/lib/api-client";
import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CloudUpload, FileText, RefreshCcw, FileDown, BarChart2, Layers, Activity, CheckCircle2, SlidersHorizontal, X } from "lucide-react";
// §reports-filter-redesign — 필터 접기(팝오버) + 활성 칩.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { DateRangePicker } from "@/components/ui/date-range-picker";
// §mobile-reports — <768px 전용 뷰(핸드오프 6a/6c). 데이터/파생은 본 파일 canonical 재사용.
import { MobileReportView } from "./mobile-report-view";

// ---------------------------------------------------------------------------
// Derived insight helpers — pure functions over report data
// ---------------------------------------------------------------------------

interface CategoryItem {
  // ⚠️ contract: server (`/api/reports/purchase`) returns `{ name, amount }`
  // — must stay aligned. See ADR-002 §11.42.
  name: string;
  amount: number;
  color?: string;
  budget?: number;
}

interface VendorItem {
  // ⚠️ contract: server returns `{ name, amount }`. Y-axis dataKey is "name".
  // See ADR-002 §11.42.
  name: string;
  amount: number;
}

interface MonthlyItem {
  month: string;
  amount: number;
}

interface DetailItem {
  date?: string;
  purchaseDate?: string;
  productName?: string;
  product?: string;
  vendorName?: string;
  vendor?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  totalAmount?: number;
  amount?: number;
  // §reports-honesty P3 — 견적행 정직 표기용(route P2 신규 필드).
  //   품목 단가가 스키마상 부재하여 견적 품목 금액은 구조적으로 미상 ⇒ ₩0 단정 금지.
  quoteTotalAmount?: number | null; // 견적 단위 확정 총액(있을 때만)
  pending?: boolean; // true = 금액 미확정(회신 대기)
  type?: string; // "quote" | "purchase"
}

function deriveInsights(
  categoryData: CategoryItem[],
  vendorData: VendorItem[],
  monthlyData: MonthlyItem[],
  details: DetailItem[],
  totalAmount: number,
) {
  // 1. Spend change drivers — top growing category
  const sortedCats = [...categoryData].sort((a, b) => b.amount - a.amount);
  const topCat = sortedCats[0];
  const topCatPct = totalAmount > 0 && topCat && topCat.amount > 0 ? Math.round((topCat.amount / totalAmount) * 100) : 0;

  // 2. Outlier detection — items > 2x average unit price
  const prices = details
    .map((d) => d.unitPrice ?? d.price ?? 0)
    .filter((p) => p > 0);
  const avgUnitPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const outlierCount = prices.filter((p) => p > avgUnitPrice * 2).length;

  // 3. Cost concentration — top category share
  const concentrationPct = topCatPct;

  // 4. Vendor dependency — single-vendor share
  const sortedVendors = [...vendorData].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const topVendor = sortedVendors[0];
  const topVendorPct = totalAmount > 0 && topVendor && topVendor.amount > 0
    ? Math.round((topVendor.amount / totalAmount) * 100)
    : 0;
  const vendorRisk = topVendorPct >= 60 ? "danger" : topVendorPct >= 40 ? "warning" : "safe";

  // Monthly trend — last two months comparison
  const recentMonths = monthlyData.slice(-2);
  const trendDelta =
    recentMonths.length === 2 && recentMonths[0].amount > 0
      ? Math.round(((recentMonths[1].amount - recentMonths[0].amount) / recentMonths[0].amount) * 100)
      : 0;

  return {
    topCat,
    topCatPct,
    outlierCount,
    avgUnitPrice,
    concentrationPct,
    topVendor,
    topVendorPct,
    vendorRisk,
    trendDelta,
    sortedCats,
    sortedVendors,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// KPI 미니 시각 — 전부 canonical 데이터 기반(가짜 추이 0). 시안 흰 카드 하단 요소.
// ---------------------------------------------------------------------------
function MiniSparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="h-6 mt-2" aria-hidden />;
  }
  const max = Math.max(...pts, 1);
  const w = 100;
  const h = 24;
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (pts.length - 1)) * w).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="24" preserveAspectRatio="none" className="mt-2" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
    </div>
  );
}

function DashMeter({ total, bad }: { total: number; bad: number }) {
  const n = Math.min(total, 12);
  if (n === 0) return <div className="h-2 mt-2" aria-hidden />;
  return (
    <div className="mt-2 flex items-center gap-1" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={`flex-1 h-1.5 rounded-full ${i < bad ? "bg-red-400" : "bg-emerald-400"}`} />
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");
  // §reports-filter-redesign — 기간 프리셋 active(커스텀 선택 시 null). segment↔custom 일관.
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // CSV Import modal state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Report data query
  const { data: reportData, isLoading, isError } = useQuery({
    queryKey: ["reports", "purchase", startDate, endDate, selectedCategory, selectedTeam, selectedVendor, selectedBudget],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedTeam !== "all") params.append("team", selectedTeam);
      if (selectedVendor !== "all") params.append("vendor", selectedVendor);
      if (selectedBudget !== "all") params.append("budgetId", selectedBudget);

      const response = await fetch(`/api/reports/purchase?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch report data");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // CSV Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await csrfFetch("/api/purchases/import-file", {
        method: "POST",
        headers: {
          "x-guest-key": session?.user?.id || "guest",
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Import failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import 성공",
        description: `${data.successRows || 0}개의 구매 내역이 성공적으로 import되었습니다.`,
      });
      setIsImportDialogOpen(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setSelectedFile(file);
      } else {
        toast({
          title: "파일 형식 오류",
          description: "CSV 또는 Excel 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  }, []);

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: "파일 선택 필요",
        description: "업로드할 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(selectedFile);
  };

  const downloadSampleTemplate = () => {
    const csvContent = `구매일,벤더,카테고리,품목명,카탈로그번호,단위,수량,단가,금액,통화
2025-01-15,Sigma-Aldrich,REAGENT,Reagent A,CAT-001,ea,10,50000,500000,KRW
2025-01-20,Thermo Fisher,EQUIPMENT,Centrifuge,CF-100,ea,1,2000000,2000000,KRW`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "구매내역_샘플.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Budget list query
  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      const data = await response.json();
      return data?.budgets || [];
    },
  });

  const budgets = budgetsData || [];

  // Extract report data
  const metrics = reportData?.metrics || {};
  const monthlyData: MonthlyItem[] = reportData?.monthlyData || [];
  const vendorData: VendorItem[] = reportData?.vendorData || [];
  const categoryData: CategoryItem[] = reportData?.categoryData || [];
  const details: DetailItem[] = reportData?.details || [];

  const totalAmount: number = metrics.totalAmount || 0;
  const itemCount: number = metrics.itemCount || 0;
  const avgPrice = itemCount > 0 ? Math.round(totalAmount / itemCount) : 0;
  const vendorCount: number = metrics.vendorCount || 0;
  // §reports-honesty P3 — 금액 미확정(회신 대기) 견적 건수. 합계에서 제외된 몫을 숨기지 않고 표기.
  const pendingQuoteCount: number = metrics.pendingQuoteCount || 0;
  const hasData = reportData != null;

  // Derived insights
  const insights = useMemo(
    () => deriveInsights(categoryData, vendorData, monthlyData, details, totalAmount),
    [categoryData, vendorData, monthlyData, details, totalAmount],
  );

  // KPI 스파크라인용 — 실 월별 데이터 파생(가짜 0). 누적 = 월별 running sum.
  const monthlyAmounts = monthlyData.map((m) => m.amount);
  const cumulativeSpend = monthlyData.reduce<number[]>((acc, m) => {
    acc.push((acc[acc.length - 1] ?? 0) + m.amount);
    return acc;
  }, []);
  const catTotal = categoryData.reduce((s, c) => s + (c.amount || 0), 0);
  const CAT_BAR_PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#0ea5e9", "#64748b"];

  // Budget usage helpers
  const budgetUsage = reportData?.budgetUsage;
  const budgetUsedPct =
    budgetUsage && budgetUsage.total > 0
      ? Math.round((budgetUsage.used / budgetUsage.total) * 100)
      : 0;
  const budgetOvershoot = budgetUsedPct > 100;

  // §reports-filter-redesign — 5필터 → 기간(주) + 필터 팝오버(2컨트롤) 접기.
  const VENDOR_LABELS: Record<string, string> = { sigma: "Sigma-Aldrich", thermo: "Thermo Fisher", eppendorf: "Eppendorf" };
  const filterDefs = [
    { key: "category", label: "카테고리", value: selectedCategory, set: setSelectedCategory, display: (v: string) => (PRODUCT_CATEGORIES as Record<string, string>)[v] ?? v },
    { key: "team", label: "팀", value: selectedTeam, set: setSelectedTeam, display: (v: string) => (v === "team1" ? "1팀" : v === "team2" ? "2팀" : v) },
    { key: "vendor", label: "벤더", value: selectedVendor, set: setSelectedVendor, display: (v: string) => VENDOR_LABELS[v] ?? v },
    { key: "budget", label: "예산", value: selectedBudget, set: setSelectedBudget, display: (v: string) => (Array.isArray(budgets) ? budgets.find((b: any) => b.id === v)?.name : null) ?? v },
  ] as const;
  const activeFilters = filterDefs.filter((f) => f.value !== "all");
  const activeFilterCount = activeFilters.length;
  const clearAllFilters = () => { setSelectedCategory("all"); setSelectedTeam("all"); setSelectedVendor("all"); setSelectedBudget("all"); };
  const REPORT_PRESETS: Array<{ id: string; label: string; days?: number; kind?: "quarter" | "year" }> = [
    { id: "7d", label: "최근 7일", days: 7 },
    { id: "30d", label: "최근 30일", days: 30 },
    { id: "quarter", label: "분기", kind: "quarter" },
    { id: "year", label: "올해", kind: "year" },
  ];
  const applyPreset = (p: (typeof REPORT_PRESETS)[number]) => {
    const now = new Date();
    let start = new Date(now);
    if (p.days) start.setDate(now.getDate() - p.days);
    else if (p.kind === "quarter") start.setMonth(now.getMonth() - 3);
    else if (p.kind === "year") start = new Date(now.getFullYear(), 0, 1);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setStartDate(iso(start)); setEndDate(iso(now)); setActivePreset(p.id);
  };

  // §mobile-reports — CSV 내보내기 단일 핸들러(데스크톱 버튼·모바일 다운로드 아이콘 공용).
  const handleExportCsv = () => {
    if (!details || details.length === 0) {
      toast({ title: "내보낼 데이터가 없습니다", variant: "destructive" });
      return;
    }
    const headers = ["날짜", "제품명", "벤더", "수량", "단가", "총액"];
    const rows = details.map((d: DetailItem) => [
      d.date || d.purchaseDate || "",
      d.productName || d.product || "",
      d.vendorName || d.vendor || "",
      String(d.quantity ?? ""),
      String(d.unitPrice ?? d.price ?? ""),
      String(d.totalAmount ?? d.amount ?? ""),
    ]);
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `labaxis-purchase-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV 파일이 다운로드되었습니다" });
  };

  // §mobile-reports — 필터 컨트롤 단일 정의(데스크톱 팝오버·모바일 팝오버 공용 — 컨트롤 중복 0).
  const filterControls = (
    <>
      <div className="space-y-1">
        <label htmlFor="category" className="text-xs font-medium uppercase tracking-wider text-slate-500">카테고리</label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger id="category" className="border-bs text-slate-700"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(PRODUCT_CATEGORIES).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="team" className="text-xs font-medium uppercase tracking-wider text-slate-500">팀 / 조직</label>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger id="team" className="border-bs text-slate-700"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="team1">1팀</SelectItem>
            <SelectItem value="team2">2팀</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="vendor" className="text-xs font-medium uppercase tracking-wider text-slate-500">벤더</label>
        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
          <SelectTrigger id="vendor" className="border-bs text-slate-700"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="sigma">Sigma-Aldrich</SelectItem>
            <SelectItem value="thermo">Thermo Fisher</SelectItem>
            <SelectItem value="eppendorf">Eppendorf</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="budget" className="text-xs font-medium uppercase tracking-wider text-slate-500">예산</label>
        <Select value={selectedBudget} onValueChange={setSelectedBudget}>
          <SelectTrigger id="budget" className="border-bs text-slate-700"><SelectValue placeholder="전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Array.isArray(budgets) && budgets.map((budget: any) => (<SelectItem key={budget.id} value={budget.id}>{budget.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      {activeFilterCount > 0 && (
        <button type="button" onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-slate-700">초기화</button>
      )}
    </>
  );


  return (
    <div className="w-full bg-canvas min-h-screen">
      {/* §dashboard-surface-unify — 회색 캔버스 full-width 외곽 + 콘텐츠 max-w-7xl 중앙(중앙 회색 컬럼 방지). */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* §mobile-reports — <768px 전용 뷰(핸드오프 6a/6c). 파생·필터·다운로드 전부 본 파일 canonical 재사용. */}
      <div className="md:hidden">
        <MobileReportView
          isLoading={isLoading}
          isError={isError}
          hasData={hasData}
          totalAmount={totalAmount}
          detailCount={details.length}
          pendingQuoteCount={pendingQuoteCount}
          insights={insights}
          monthlyData={monthlyData}
          categoryData={categoryData}
          vendorData={vendorData}
          presets={REPORT_PRESETS}
          activePreset={activePreset}
          onPreset={(id) => { const preset = REPORT_PRESETS.find((x) => x.id === id); if (preset) applyPreset(preset); }}
          startDate={startDate}
          endDate={endDate}
          activeFilterCount={activeFilterCount}
          filterContent={filterControls}
          onDownload={handleExportCsv}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["reports"] })}
        />
      </div>
      {/* 데스크톱(≥768px) 기존 뷰 — 무접촉(§mobile-reports 경계) */}
      <div className="hidden md:block space-y-5">
      {/* ================================================================
          HEADER
          ================================================================ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">구매 리포트</h2>
          <p className="text-sm text-slate-500">지출 현황, 카테고리별 분석, 공급사 의존도를 한눈에 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-bd bg-pn text-slate-600 hover:bg-el hover:text-slate-900">
                <CloudUpload className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">데이터 </span>가져오기
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-white border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-slate-900">구매 내역 CSV Import</DialogTitle>
                <DialogDescription className="text-slate-500">
                  CSV 또는 Excel 파일을 업로드하여 구매 내역을 import합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center h-64 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
                      : selectedFile
                      ? "border-blue-400 bg-blue-50"
                      : "border-bs bg-sh hover:border-slate-600"
                  }`}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <FileText className="h-10 w-10 text-blue-400 mb-3" />
                      <p className="text-sm font-semibold text-slate-900 mb-1">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">파일이 선택되었습니다. 아래 버튼을 클릭하여 업로드하세요.</p>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-10 w-10 text-slate-500 mb-3" />
                      <p className="text-sm font-semibold text-slate-900 mb-1">여기를 클릭하거나 파일을 드래그하세요</p>
                      <p className="text-xs text-slate-400">CSV, Excel 파일 지원</p>
                    </>
                  )}
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    양식이 필요하신가요? 샘플 파일 다운로드
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="border-bs text-slate-600"
                    onClick={() => {
                      setIsImportDialogOpen(false);
                      setSelectedFile(null);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || importMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {importMutation.isPending ? "업로드 중..." : "업로드"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            className="border-bd bg-pn text-slate-600 hover:bg-el hover:text-slate-900"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["reports"] })}
          >
            <RefreshCcw className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">갱신</span>
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white"
            onClick={handleExportCsv}
          >
            <FileDown className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">내보내기</span>
          </Button>
        </div>
      </div>

      {/* ================================================================
          FILTER BAR
          ================================================================ */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm relative">
        {/* §reports-filter-redesign — 기간(주 컨트롤) + 필터 팝오버 2컨트롤. 부모 relative(오버레이 튀어나옴 방지, 시안 가드). */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-el p-0.5">
            {REPORT_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => applyPreset(p)} className={cn("h-8 px-2.5 rounded-md text-xs font-medium transition-colors", activePreset === p.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                {p.label}
              </button>
            ))}
          </div>
          <DateRangePicker startDate={startDate} endDate={endDate} onDateChange={(start, end) => { setStartDate(start); setEndDate(end); setActivePreset(null); }} />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                <SlidersHorizontal className="h-4 w-4" />
                필터
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">{filterControls}</PopoverContent>
          </Popover>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {activeFilters.map((f) => (
              <button key={f.key} type="button" onClick={() => f.set("all")} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 h-7 text-[11px] font-medium text-slate-700 hover:bg-slate-200">
                {f.label}: {f.display(f.value)}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button type="button" onClick={clearAllFilters} className="ml-1 text-[11px] text-slate-400 hover:text-slate-600">전체 해제</button>
          </div>
        )}
      </div>

      {/* ================================================================
          LOADING SKELETON
          ================================================================ */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-pulse">
              <div className="h-3 w-20 bg-el rounded mb-3" />
              <div className="h-6 w-28 bg-el rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ================================================================
          EMPTY STATE
          ================================================================ */}
      {!hasData && !isLoading && (
        <div className="bg-pn border border-dashed border-bs rounded-lg min-h-[400px] flex items-center justify-center">
          <div className="text-center py-16">
            <BarChart2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">데이터가 없습니다</p>
            <p className="text-xs text-slate-500 mb-4">필터를 설정하거나 CSV 파일을 업로드하여 리포트를 생성하세요.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportDialogOpen(true)}
              className="border-bs text-slate-600 hover:bg-el"
            >
              <CloudUpload className="h-4 w-4 mr-1.5" />
              데이터 가져오기
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================
          MAIN CONTENT — only when data exists
          ================================================================ */}
      {hasData && !isLoading && (
        <>
          {/* ============================================================
              TOP ACTION BANNER — 가장 큰 리스크(벤더 의존도) 승격
              canonical: insights.topVendor / topVendorPct 파생. 위험 시에만 노출.
              ============================================================ */}
          {insights.topVendor && insights.vendorRisk !== "safe" && (
            <div
              className={`rounded-xl border shadow-sm ${
                insights.vendorRisk === "danger"
                  ? "border-red-200 bg-gradient-to-r from-red-50 to-white"
                  : "border-yellow-200 bg-gradient-to-r from-yellow-50 to-white"
              }`}
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <span
                  className={`w-10 h-10 rounded-xl flex-none grid place-items-center text-white ${
                    insights.vendorRisk === "danger" ? "bg-red-600" : "bg-yellow-500"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${
                      insights.vendorRisk === "danger" ? "text-red-700" : "text-yellow-700"
                    }`}
                  >
                    이번 기간 가장 큰 리스크
                  </p>
                  <p className="text-sm sm:text-[15px] font-extrabold tracking-tight text-slate-900 leading-snug">
                    <span className={insights.vendorRisk === "danger" ? "text-red-700" : "text-yellow-700"}>
                      {insights.topVendor.name}
                    </span>{" "}
                    단일 공급사에{" "}
                    <span className={insights.vendorRisk === "danger" ? "text-red-700" : "text-yellow-700"}>
                      {insights.topVendorPct}%
                    </span>{" "}
                    집중 — 공급망 다변화 검토가 필요합니다
                  </p>
                </div>
                <Link
                  href={`/app/search?q=${encodeURIComponent(
                    insights.topCat ? (PRODUCT_CATEGORIES[insights.topCat.name] || insights.topCat.name) : "",
                  )}`}
                  className="flex-none"
                >
                  <Button variant="outline" size="sm" className="border-bd bg-white text-slate-700 hover:bg-el hover:text-slate-900">
                    대체 공급사 탐색
                    <ArrowUpRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ============================================================
              TOP: KEY INSIGHTS — "이번 기간 핵심 인사이트"
              ============================================================ */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">이번 기간 핵심 인사이트</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* §reports-fidelity — 시안 흰 카드 + 코너칩 + 하단 미니 시각(실 canonical 데이터). 컬러배경 폐지. */}
              {/* Insight 1: 지출 변화 추이 — 실 월별 스파크라인 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-emerald-50 text-emerald-600">
                    {insights.trendDelta > 0 ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">전월 대비</span>
                </div>
                <p className={`text-2xl font-extrabold leading-none ${insights.trendDelta > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {insights.trendDelta > 0 ? "+" : ""}{insights.trendDelta}%
                </p>
                <p className="text-[11px] text-slate-500 mt-1">지출 변화 추이</p>
                <MiniSparkline values={monthlyAmounts} stroke={insights.trendDelta > 0 ? "#ef4444" : "#10b981"} />
                {monthlyAmounts.length >= 2 && (
                  <p className="text-[10px] text-slate-400 mt-1">최근 {monthlyAmounts.length}개월 월별 지출</p>
                )}
              </div>

              {/* Insight 2: 이상치 감지 — 실 거래건수 대비 이상치 메터 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-7 h-7 rounded-lg grid place-items-center ${insights.outlierCount > 0 ? "bg-yellow-50 text-yellow-600" : "bg-slate-100 text-slate-500"}`}>
                    {insights.outlierCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">{insights.outlierCount > 0 ? "검토" : "정상"}</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 leading-none">{insights.outlierCount}건</p>
                <p className="text-[11px] text-slate-500 mt-1">이상치 감지</p>
                <DashMeter total={details.length} bad={insights.outlierCount} />
                <p className="text-[10px] text-slate-400 mt-1">
                  {details.length > 0
                    ? insights.outlierCount > 0
                      ? `${details.length}건 중 ${insights.outlierCount}건 이상`
                      : `${details.length}건 모두 정상`
                    : "거래 내역 없음"}
                </p>
              </div>

              {/* Insight 3: 비용 집중 구간 — 실 카테고리 점유율 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-violet-50 text-violet-600">
                    <Layers className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">집중</span>
                </div>
                <p className="text-2xl font-extrabold text-violet-700 leading-none">{insights.concentrationPct}%</p>
                <p className="text-[11px] text-slate-500 mt-1">비용 집중 구간</p>
                <ShareBar pct={insights.concentrationPct} color="#8b5cf6" />
                <p className="text-[10px] text-slate-400 mt-1">
                  {insights.topCat
                    ? `${PRODUCT_CATEGORIES[insights.topCat.name] || insights.topCat.name} ${insights.concentrationPct}% · 기타 ${Math.max(0, 100 - insights.concentrationPct)}%`
                    : "카테고리 분포 균등"}
                </p>
              </div>

              {/* Insight 4: 총 지출액 — 실 월별 누적. 벤더 의존도는 상단 배너로 승격(중복 제거, README §중복주의) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-blue-50 text-blue-600">
                    <BarChart2 className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">이번 기간</span>
                </div>
                <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{formatCurrency(totalAmount, "KRW")}</p>
                {/* §reports-honesty P3 — 라벨 명확화: 금액 미확정 견적은 합계에 포함하지 않음(₩0 날조 제거). */}
                <p className="text-[11px] text-slate-500 mt-1">확정 지출액</p>
                <MiniSparkline values={cumulativeSpend} stroke="#3b82f6" />
                <p className="text-[10px] text-slate-400 mt-1">기간 누적 · {itemCount > 0 ? `${itemCount}건` : "0건"}</p>
                {pendingQuoteCount > 0 && (
                  <p className="text-[10px] text-yellow-700 mt-0.5">
                    회신 대기 {pendingQuoteCount}건 — 금액 미확정으로 합계 제외
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================
              MIDDLE: ANALYSIS BLOCKS
              ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Block 1: Category Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">카테고리별 분석</p>
                <Link href="/dashboard/purchases">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-700 hover:bg-el h-7 px-2">
                    카테고리 검토 →
                  </Button>
                </Link>
              </div>
              {/* §reports-fidelity — 시안: 가로 막대(이름·비중%·금액). 깨지던 파이 + 중복 리스트 폐지. */}
              {categoryData.length > 0 && categoryData.some((c) => c.amount > 0) ? (
                <div className="flex-1 flex flex-col justify-center gap-4 mt-1">
                  {insights.sortedCats.slice(0, 5).map((cat, i) => {
                    const pct = catTotal > 0 ? Math.round((cat.amount / catTotal) * 100) : 0;
                    return (
                      <div key={cat.name}>
                        <div className="flex items-center mb-1.5">
                          <span className="text-[13px] font-semibold text-slate-800">{PRODUCT_CATEGORIES[cat.name] || cat.name}</span>
                          <span className="ml-2 text-[11px] font-semibold text-slate-400 tabular-nums">{pct}%</span>
                          <span className="ml-auto text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(cat.amount, "KRW")}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CAT_BAR_PALETTE[i % CAT_BAR_PALETTE.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs">데이터 없음</div>
              )}
            </div>

            {/* Block 2: Vendor Dependency — 도넛(단일 의존도) + 순위. 의존도 강조는 상단 배너 1곳, 여기선 분포/순위로 보완 */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">공급사 의존도</p>
                <Link href="/app/search">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-700 hover:bg-el h-7 px-2">
                    벤더 비교 →
                  </Button>
                </Link>
              </div>
              {vendorData.length > 0 && vendorData.some((v) => v.amount > 0) ? (
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
                  {/* Donut — 최대 공급사 단일 의존 비중 */}
                  <div className="relative flex-none" style={{ width: 150, height: 150 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: insights.topVendor?.name || "최대 공급사", value: insights.topVendor?.amount || 0 },
                            { name: "기타 공급사", value: Math.max(0, vendorData.reduce((s, v) => s + (v.amount || 0), 0) - (insights.topVendor?.amount || 0)) },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          stroke="#ffffff"
                          strokeWidth={3}
                          startAngle={90}
                          endAngle={-270}
                          paddingAngle={1}
                        >
                          <Cell fill={insights.vendorRisk === "danger" ? "#dc2626" : insights.vendorRisk === "warning" ? "#eab308" : "#10b981"} />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#334155", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }}
                          formatter={(value: number) => formatCurrency(value, "KRW")}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={`text-2xl font-extrabold tabular-nums leading-none ${
                        insights.vendorRisk === "danger" ? "text-red-700" : insights.vendorRisk === "warning" ? "text-yellow-700" : "text-emerald-700"
                      }`}>
                        {insights.topVendorPct}%
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">단일 의존</span>
                    </div>
                  </div>
                  {/* Ranked list — 공급사별 비중 */}
                  <div className="flex-1 min-w-0 w-full space-y-2.5">
                    {insights.sortedVendors.slice(0, 4).map((v, i) => {
                      const totalVendor = vendorData.reduce((s, x) => s + (x.amount || 0), 0);
                      const pct = totalVendor > 0 ? Math.round((v.amount / totalVendor) * 100) : 0;
                      return (
                        <div key={v.name} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-sm flex-none ${i === 0 ? (insights.vendorRisk === "danger" ? "bg-red-500" : "bg-yellow-500") : "bg-slate-300"}`} />
                          <span className={`truncate ${i === 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>{v.name}</span>
                          <span className={`ml-auto font-mono font-semibold tabular-nums ${i === 0 ? (insights.vendorRisk === "danger" ? "text-red-700" : "text-yellow-700") : "text-slate-400"}`}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[150px] text-slate-500 text-xs">데이터 없음</div>
              )}
            </div>

          </div>{/* end 2-col grid */}

          {/* Block 3: Monthly Trend — Full width */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">월별 지출 추이</p>
                <Link href="/dashboard/purchases">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-700 hover:bg-el h-7 px-2">
                    구매내역 필터 →
                  </Button>
                </Link>
              </div>
              {monthlyData.length > 0 && monthlyData.some((m) => m.amount > 0) ? (
                <div className="flex-1 min-h-0" style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.8} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value: number) => `₩${(value / 10000).toLocaleString()}만`} />
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#334155", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }}
                        formatter={(value: number) => [formatCurrency(value, "KRW"), "월 지출"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-slate-500 text-xs">데이터 없음</div>
              )}
              {/* Trend explanation */}
              {monthlyData.length >= 2 && (
                <div className="mt-3 border-t border-bd pt-3 text-xs text-slate-400 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    최근 월 대비{" "}
                    <span className={insights.trendDelta > 0 ? "text-red-400 font-medium" : insights.trendDelta < 0 ? "text-emerald-400 font-medium" : "text-slate-600"}>
                      {insights.trendDelta > 0 ? "+" : ""}{insights.trendDelta}%
                    </span>
                    {" "}변동
                  </span>
                </div>
              )}
            </div>

            {/* 예산 대비 실적 제거 — 예산 관리 페이지에서 확인 */}

          {/* ============================================================
              BOTTOM: DETAIL TABLE
              ============================================================ */}
          {details.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-800">상세 내역</p>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{details.length}건</span>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="bg-el/50 hover:bg-el/50 border-b border-bs">
                      <TableHead className="text-xs font-medium text-slate-400">날짜</TableHead>
                      <TableHead className="text-xs font-medium text-slate-400">제품명</TableHead>
                      <TableHead className="text-xs font-medium text-slate-400">벤더</TableHead>
                      <TableHead className="text-xs font-medium text-slate-400 text-right">수량</TableHead>
                      <TableHead className="text-xs font-medium text-slate-400 text-right">단가</TableHead>
                      <TableHead className="text-xs font-medium text-slate-400 text-right">총액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((item: DetailItem, index: number) => {
                      const unitPrice = item.unitPrice ?? item.price ?? 0;
                      const isOutlier = unitPrice > insights.avgUnitPrice * 2 && insights.avgUnitPrice > 0;
                      // §reports-honesty P3 — 견적행 금액 정직 표기.
                      //   품목 단가가 스키마상 부재 → 견적 품목 금액은 구조적으로 미상.
                      //   pending(=Quote.totalAmount 미입력) 이면 ₩0 단정 대신 "미확정" + "회신 대기" 표기.
                      const rowAmount = item.totalAmount ?? item.amount ?? item.quoteTotalAmount ?? null;
                      const isPending = item.pending === true || rowAmount == null;
                      return (
                        <TableRow key={index} className="border-b border-bd/50 hover:bg-el/30">
                          <TableCell className="py-3 text-xs text-slate-600">
                            {formatDate(item.date || item.purchaseDate, { format: "date" })}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-slate-700">
                            <span>{item.productName || item.product || "-"}</span>
                            {isPending && (
                              <span className="ml-1.5 inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 align-middle">
                                회신 대기
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-slate-400">{item.vendorName || item.vendor || "-"}</TableCell>
                          <TableCell className="py-3 text-xs text-slate-600 text-right">{item.quantity ?? "-"}</TableCell>
                          <TableCell className={`py-3 text-xs text-right font-mono ${isOutlier ? "text-yellow-400" : "text-slate-600"}`}>
                            {isPending && unitPrice <= 0 ? (
                              <span className="text-slate-400">미확정</span>
                            ) : (
                              <>
                                {formatCurrency(unitPrice, "KRW")}
                                {isOutlier && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-right font-mono font-medium text-slate-900">
                            {isPending ? (
                              <span className="font-sans text-slate-400">미확정</span>
                            ) : (
                              formatCurrency(rowAmount ?? 0, "KRW")
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Fallback: data exists but all sections empty */}
          {hasData && !monthlyData?.length && !vendorData?.length && !categoryData?.length && !details?.length && (
            <div className="bg-pn border border-dashed border-bs rounded-lg min-h-[200px] flex items-center justify-center">
              <p className="text-xs text-slate-500">필터를 설정하여 상세 구매 분석 데이터를 조회하세요.</p>
            </div>
          )}
        </>
      )}
      </div>{/* end 데스크톱 뷰 */}
      </div>
    </div>
  );
}
