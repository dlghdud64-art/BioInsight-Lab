"use client";

export const dynamic = 'force-dynamic';

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Package, Building2, DollarSign, FileSpreadsheet, Download, CloudUpload, FileText, RefreshCcw, FileDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 필터 상태
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");

  // CSV Import 모달 상태
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 리포트 데이터 조회
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

  // CSV Import
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/purchases/import-file", {
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

  // 드래그 앤 드롭 핸들러
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

  // 예산 목록 조회
  const { data: budgetsData, isLoading: isLoadingBudgets } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      const data = await response.json();
      return data?.budgets || [];
    },
  });

  const budgets = budgetsData || [];

  // 리포트 데이터 구조 변환
  const metrics = reportData?.metrics || {};
  const monthlyData = reportData?.monthlyData || [];
  const vendorData = reportData?.vendorData || [];
  const categoryData = reportData?.categoryData || [];
  const details = reportData?.details || [];

  const totalAmount = metrics.totalAmount || 0;
  const itemCount = metrics.itemCount || 0;
  const avgPrice = itemCount > 0 ? totalAmount / itemCount : 0;
  const vendorCount = metrics.vendorCount || 0;
  const hasData = reportData != null;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">구매 리포트</h2>
          <p className="text-muted-foreground mt-1 text-sm">월별 지출 현황과 예산 사용량을 상세히 분석합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50">
                <CloudUpload className="h-4 w-4 mr-2" />
                데이터 가져오기
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>구매 내역 CSV Import</DialogTitle>
                  <DialogDescription>
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
                        ? "border-blue-300 bg-blue-50/50"
                        : "border-gray-300 bg-gray-50 hover:border-gray-400"
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
                        <FileText className="h-12 w-12 text-blue-600 mb-4" />
                        <p className="text-lg font-semibold text-gray-900 mb-2">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          파일이 선택되었습니다. 아래 버튼을 클릭하여 업로드하세요.
                        </p>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg font-semibold text-gray-900 mb-2">
                          여기를 클릭하거나 파일을 드래그하세요
                        </p>
                        <p className="text-sm text-gray-500">
                          CSV, Excel 파일 지원
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={downloadSampleTemplate}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      양식이 필요하신가요? 샘플 파일 다운로드
                    </button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
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
                    >
                      {importMutation.isPending ? "업로드 중..." : "업로드"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50" onClick={() => queryClient.invalidateQueries({ queryKey: ["reports"] })}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            데이터 갱신
          </Button>
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
            <FileDown className="h-4 w-4 mr-2" />
            리포트 내보내기
          </Button>
        </div>
      </div>

      {/* 2. 상단 KPI 통계 (전진 배치) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-slate-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-100 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">총 구매 금액</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-2xl md:text-3xl font-bold break-words ${totalAmount === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                {formatCurrency(totalAmount)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/30 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">총 구매 건수</CardTitle>
              <Package className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-2xl md:text-3xl font-bold break-words ${itemCount === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                {itemCount}건
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">평균 단가</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-2xl md:text-3xl font-bold break-words ${avgPrice === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                {formatCurrency(avgPrice)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-100 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/20 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate min-w-0">벤더 수</CardTitle>
              <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-2xl md:text-3xl font-bold break-words ${vendorCount === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                {vendorCount}개
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. 압축된 한 줄 필터 바 */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">기간 선택</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onDateChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="category" className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">카테고리</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(PRODUCT_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="team" className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">팀 / 조직</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="team">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="team1">1팀</SelectItem>
                  <SelectItem value="team2">2팀</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="vendor" className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">벤더</label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger id="vendor">
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
            <div className="space-y-1.5">
              <label htmlFor="budget" className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">예산</label>
              <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                <SelectTrigger id="budget">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Array.isArray(budgets) && budgets.map((budget: any) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 메인 분석 영역 */}
      {!hasData && !isLoading ? (
        <Card className="min-h-[400px] border-dashed border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <FileSpreadsheet className="h-16 w-16 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  데이터가 없습니다
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  필터를 설정하여 상세 구매 분석 데이터를 조회하거나, CSV 파일을 업로드하여 리포트를 생성해보세요.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsImportDialogOpen(true)}
                  className="border-slate-200 hover:bg-slate-50"
                >
                  <CloudUpload className="h-4 w-4 mr-2" />
                  데이터 가져오기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasData ? (
        <>
          {/* 예산 사용률 카드 */}
          {selectedBudget !== "all" && reportData?.budgetUsage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  예산 사용률
                  <Link href="/dashboard/budget">
                    <Button variant="outline" size="sm">
                      예산 관리
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>사용 금액</span>
                    <span>
                      {formatCurrency(reportData.budgetUsage.used)} / {formatCurrency(reportData.budgetUsage.total)}
                    </span>
                  </div>
                  <Progress
                    value={
                      reportData.budgetUsage.total
                        ? (reportData.budgetUsage.used / reportData.budgetUsage.total) * 100
                        : 0
                    }
                  />
                  <div className="text-xs text-muted-foreground">
                    남은 예산: {formatCurrency(
                      (reportData.budgetUsage.total || 0) - (reportData.budgetUsage.used || 0)
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 월별 구매 추이 차트 */}
          {monthlyData && monthlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>기간별 구매 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="amount"
                      fill="#3b82f6"
                      name="구매 금액"
                      barSize={40}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 벤더별 구매 현황 */}
          {vendorData && vendorData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>벤더별 구매 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vendorData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="vendor" />
                    <YAxis />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="amount"
                      fill="#10b981"
                      name="구매 금액"
                      barSize={40}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 카테고리별 구매 현황 (파이 차트) */}
          {categoryData && categoryData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>카테고리별 구매 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || "#8884d8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 상세 테이블 */}
          {details && details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>상세 내역</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>제품명</TableHead>
                      <TableHead>벤더</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>단가</TableHead>
                      <TableHead>총액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {formatDate(item.date || item.purchaseDate, { format: "date" })}
                        </TableCell>
                        <TableCell>{item.productName || item.product || "-"}</TableCell>
                        <TableCell>{item.vendorName || item.vendor || "-"}</TableCell>
                        <TableCell>{item.quantity || "-"}</TableCell>
                        <TableCell>{formatCurrency(item.unitPrice || item.price || 0)}</TableCell>
                        <TableCell>{formatCurrency(item.totalAmount || item.amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 데이터 없음 시 안내 (hasData이지만 차트/테이블 데이터 없음) */}
          {hasData && !monthlyData?.length && !vendorData?.length && !categoryData?.length && !details?.length && (
            <Card className="min-h-[300px] border-dashed border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  필터를 설정하여 상세 구매 분석 데이터를 조회하세요.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

