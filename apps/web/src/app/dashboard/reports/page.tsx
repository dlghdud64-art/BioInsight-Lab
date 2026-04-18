"use client";

export const dynamic = 'force-dynamic';

import { csrfFetch } from "@/lib/api-client";
import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, Building2, CloudUpload, FileText, RefreshCcw, FileDown, BarChart2, Layers, ShieldAlert, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { DateRangePicker } from "@/components/ui/date-range-picker";

// ---------------------------------------------------------------------------
// Derived insight helpers — pure functions over report data
// ---------------------------------------------------------------------------

interface CategoryItem {
  name: string;
  value: number;
  color?: string;
  budget?: number;
}

interface VendorItem {
  vendor: string;
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
}

function deriveInsights(
  categoryData: CategoryItem[],
  vendorData: VendorItem[],
  monthlyData: MonthlyItem[],
  details: DetailItem[],
  totalAmount: number,
) {
  // 1. Spend change drivers — top growing category
  const sortedCats = [...categoryData].sort((a, b) => b.value - a.value);
  const topCat = sortedCats[0];
  const topCatPct = totalAmount > 0 && topCat && topCat.value > 0 ? Math.round((topCat.value / totalAmount) * 100) : 0;

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

  // CSV Import modal state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Report data query
  const { data: reportData, isLoading } = useQuery({
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
  const hasData = reportData != null;

  // Derived insights
  const insights = useMemo(
    () => deriveInsights(categoryData, vendorData, monthlyData, details, totalAmount),
    [categoryData, vendorData, monthlyData, details, totalAmount],
  );

  // Budget usage helpers
  const budgetUsage = reportData?.budgetUsage;
  const budgetUsedPct =
    budgetUsage && budgetUsage.total > 0
      ? Math.round((budgetUsage.used / budgetUsage.total) * 100)
      : 0;
  const budgetOvershoot = budgetUsedPct > 100;

  // Chart color palette
  const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="flex-1 space-y-5 bg-sh min-h-screen p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
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
                      ? "border-blue-500 bg-blue-950/20"
                      : selectedFile
                      ? "border-blue-400 bg-blue-950/10"
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
            onClick={() => {
              if (!details || details.length === 0) {
                toast({ title: "내보낼 데이터가 없습니다", variant: "destructive" });
                return;
              }
              // CSV 생성 + 다운로드
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
            }}
          >
            <FileDown className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">내보내기</span>
          </Button>
        </div>
      </div>

      {/* ================================================================
          FILTER BAR
          ================================================================ */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">기간</label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="category" className="text-xs font-medium uppercase tracking-wider text-slate-500">카테고리</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category" className="bg-el border-bs text-slate-700">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(PRODUCT_CATEGORIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="team" className="text-xs font-medium uppercase tracking-wider text-slate-500">팀 / 조직</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team" className="bg-el border-bs text-slate-700">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
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
              <SelectTrigger id="vendor" className="bg-el border-bs text-slate-700">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
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
              <SelectTrigger id="budget" className="bg-el border-bs text-slate-700">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Array.isArray(budgets) && budgets.map((budget: any) => (
                  <SelectItem key={budget.id} value={budget.id}>{budget.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
              TOP: KEY INSIGHTS — "이번 기간 핵심 인사이트"
              ============================================================ */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">이번 기간 핵심 인사이트</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Insight 1: Spend Change Driver */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-blue-700">지출 변화 추이</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-blue-900 leading-tight">
                    {insights.trendDelta > 0 ? "+" : ""}{insights.trendDelta}%
                    {insights.trendDelta > 0 && <ArrowUpRight className="inline h-5 w-5 text-red-500 ml-1" />}
                    {insights.trendDelta < 0 && <ArrowDownRight className="inline h-5 w-5 text-emerald-500 ml-1" />}
                  </p>
                  <p className="text-xs text-blue-600/70 mt-1.5 leading-relaxed">
                    {insights.topCat ? `전월 대비 지출 감소 (기저효과)` : "데이터 부족"}
                  </p>
                </div>
              </div>

              {/* Insight 2: Outlier Detection */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-semibold text-amber-700">이상치 감지</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-amber-900 leading-tight">
                    {insights.outlierCount}건
                  </p>
                  <p className="text-xs text-amber-600/70 mt-1.5 leading-relaxed">
                    평균 단가 대비 2배 이상 항목 건수
                  </p>
                </div>
              </div>

              {/* Insight 3: Cost Concentration */}
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-xs font-semibold text-violet-700">비용 집중 구간</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-violet-900 leading-tight">
                    {insights.concentrationPct}%
                  </p>
                  <p className="text-xs text-violet-600/70 mt-1.5 leading-relaxed">
                    {insights.topCat ? `${insights.topCat.name} 카테고리에 지출 집중` : "카테고리 분포 균등"}
                  </p>
                </div>
              </div>

              {/* Insight 4: Vendor Dependency */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">벤더 의존도</span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-900 leading-tight">
                    {insights.topVendorPct}%
                  </p>
                  <p className="text-xs text-emerald-600/70 mt-1.5 leading-relaxed">
                    {insights.topVendor?.vendor ? `${insights.topVendor.vendor} 단일 공급 비중` : "벤더 데이터 없음"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================
              AI 인사이트 자동 생성
              ============================================================ */}
          <AiInsightBlock
            insights={insights}
            totalAmount={totalAmount}
            categoryData={categoryData}
            vendorData={vendorData}
            monthlyData={monthlyData}
            details={details}
          />

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
              {categoryData.length > 0 && categoryData.some((c) => c.value > 0) ? (
                <div className="flex-1 min-h-0" style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData.filter((c) => c.value > 0)}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={3}
                        cursor="pointer"
                        paddingAngle={2}
                      >
                        {categoryData.map((_entry: CategoryItem, index: number) => (
                          <Cell key={`cell-${index}`} fill={_entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#334155", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }}
                        formatter={(value: number) => formatCurrency(value, "KRW")}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "12px" }}
                        formatter={(value: string) => <span className="text-slate-600 ml-1">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-slate-500 text-xs">데이터 없음</div>
              )}
              {/* Category budget comparison list */}
              {insights.sortedCats.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-bd pt-3">
                  {insights.sortedCats.slice(0, 4).map((cat) => {
                    const pct = totalAmount > 0 ? Math.round((cat.value / totalAmount) * 100) : 0;
                    return (
                      <div key={cat.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate mr-2">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-el rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-slate-400 w-16 text-right font-mono">{formatCurrency(cat.value, "KRW")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Block 2: Vendor Analysis */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">공급사별 분석</p>
                <Link href="/app/compare">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-700 hover:bg-el h-7 px-2">
                    벤더 비교 →
                  </Button>
                </Link>
              </div>
              {vendorData.length > 0 && vendorData.some((v) => v.amount > 0) ? (
                <div className="flex-1 min-h-0" style={{ height: Math.max(220, vendorData.filter((v) => v.amount > 0).length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorData.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} strokeOpacity={0.6} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value: number) => `₩${(value / 10000).toLocaleString()}만`} />
                      <YAxis type="category" dataKey="vendor" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }} width={80} />
                      <Tooltip
                        cursor={{ fill: "rgba(59,130,246,0.06)" }}
                        contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#334155", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }}
                        formatter={(value: number) => [formatCurrency(value, "KRW"), "구매 금액"]}
                      />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={20}>
                        {vendorData.slice(0, 8).map((_: VendorItem, index: number) => (
                          <Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-slate-500 text-xs">데이터 없음</div>
              )}
              {/* Vendor concentration warning */}
              {insights.topVendor && insights.vendorRisk !== "safe" && (
                <div className={`mt-3 rounded-lg px-3.5 py-2.5 flex items-start gap-2 text-xs ${
                  insights.vendorRisk === "danger" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {insights.topVendor.vendor}에 {insights.topVendorPct}% 집중 &mdash;
                    {insights.vendorRisk === "danger" ? " 공급망 다변화 검토 필요" : " 분산 검토 권장"}
                  </span>
                </div>
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
                      return (
                        <TableRow key={index} className="border-b border-bd/50 hover:bg-el/30">
                          <TableCell className="py-3 text-xs text-slate-600">
                            {formatDate(item.date || item.purchaseDate, { format: "date" })}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-slate-700">{item.productName || item.product || "-"}</TableCell>
                          <TableCell className="py-3 text-xs text-slate-400">{item.vendorName || item.vendor || "-"}</TableCell>
                          <TableCell className="py-3 text-xs text-slate-600 text-right">{item.quantity ?? "-"}</TableCell>
                          <TableCell className={`py-3 text-xs text-right font-mono ${isOutlier ? "text-amber-400" : "text-slate-600"}`}>
                            {formatCurrency(unitPrice, "KRW")}
                            {isOutlier && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-right font-mono font-medium text-slate-900">
                            {formatCurrency(item.totalAmount || item.amount || 0, "KRW")}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI Insight Block — 구매 데이터 기반 자동 분석 텍스트 생성
// ═══════════════════════════════════════════════════════════════

function AiInsightBlock({
  insights,
  totalAmount,
  categoryData,
  vendorData,
  monthlyData,
  details,
}: {
  insights: ReturnType<typeof deriveInsights>;
  totalAmount: number;
  categoryData: CategoryItem[];
  vendorData: VendorItem[];
  monthlyData: MonthlyItem[];
  details: DetailItem[];
}) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsight = useCallback(() => {
    setIsGenerating(true);
    // 실제 Gemini/OpenAI API 연결 시 이 부분을 교체
    // 현재는 deriveInsights 결과를 기반으로 결정론적 텍스트 생성
    setTimeout(() => {
      const lines: string[] = [];

      // 트렌드
      if (insights.trendDelta !== 0) {
        const dir = insights.trendDelta > 0 ? "증가" : "감소";
        lines.push(`이번 기간 총 지출은 전월 대비 ${Math.abs(insights.trendDelta)}% ${dir}했습니다.`);
      }

      // 카테고리 집중
      if (insights.topCat && insights.topCatPct >= 40) {
        lines.push(`${insights.topCat.name} 카테고리가 전체 지출의 ${insights.topCatPct}%를 차지하고 있어 비용 집중도가 높습니다. 대체 공급사나 대체 제품 검토를 권장합니다.`);
      }

      // 벤더 의존도
      if (insights.topVendor && insights.topVendorPct >= 50) {
        lines.push(`${insights.topVendor.vendor}에 대한 의존도가 ${insights.topVendorPct}%로 높습니다. 공급 리스크 분산을 위해 2~3개 벤더 병행 운영을 고려하세요.`);
      }

      // 이상치
      if (insights.outlierCount > 0) {
        lines.push(`평균 단가 대비 2배 이상인 항목이 ${insights.outlierCount}건 감지되었습니다. 해당 건의 단가 협상 또는 대체품 조달을 검토하세요.`);
      }

      // 총액
      if (totalAmount > 0) {
        lines.push(`분석 기간 총 구매액은 ${formatCurrency(totalAmount, "KRW")}이며, ${details.length}건의 거래가 포함되어 있습니다.`);
      }

      if (lines.length === 0) {
        lines.push("현재 데이터로는 특별한 이상 징후가 감지되지 않았습니다. 정상 운영 범위입니다.");
      }

      setAiText(lines.join("\n\n"));
      setIsGenerating(false);
    }, 1200);
  }, [insights, totalAmount, details.length]);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">AI 구매 분석 인사이트</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-100"
          onClick={generateInsight}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><RefreshCcw className="h-3 w-3 mr-1 animate-spin" />분석 중...</>
          ) : (
            <><Activity className="h-3 w-3 mr-1" />인사이트 생성</>
          )}
        </Button>
      </div>
      {aiText ? (
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {aiText}
        </div>
      ) : (
        <p className="text-xs text-blue-500">
          &quot;인사이트 생성&quot; 버튼을 클릭하면 현재 구매 데이터를 분석하여 핵심 권장 사항을 자동으로 생성합니다.
        </p>
      )}
    </div>
  );
}
