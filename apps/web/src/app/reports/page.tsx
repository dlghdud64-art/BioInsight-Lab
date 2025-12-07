"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, TrendingUp, Package, Building2, DollarSign, Upload, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProjectName, setImportProjectName] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "vendor" | "category">("none");

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-reports", period, startDate, endDate, organizationId, vendorId, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period !== "custom") params.append("period", period);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (organizationId) params.append("organizationId", organizationId);
      if (vendorId) params.append("vendorId", vendorId);
      if (category) params.append("category", category);

      const response = await fetch(`/api/reports/purchase?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (organizationId) formData.append("organizationId", organizationId);
      if (importProjectName) formData.append("projectName", importProjectName);

      const response = await fetch("/api/purchases/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import 실패");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import 완료",
        description: `${data.imported}개 구매내역이 성공적으로 Import되었습니다.`,
      });
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportProjectName("");
      // 리포트 데이터 새로고침
      queryClient.invalidateQueries({ queryKey: ["purchase-reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/reports");
    return null;
  }

  const metrics = data?.metrics || {};
  const monthlyData = data?.monthlyData || [];
  const vendorData = data?.vendorData || [];
  const categoryData = data?.categoryData || [];
  const details = data?.details || [];
  const budgetUsage = data?.budgetUsage || [];

  // 예산 목록 조회
  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) return { budgets: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const budgets = budgetsData?.budgets || [];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">구매내역 리포트</h1>
            <p className="text-muted-foreground mt-1">
              기간/팀/벤더별 총 구매 금액과 예산 사용 상황을 확인합니다.
            </p>
          </div>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                CSV Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>구매내역 CSV Import</DialogTitle>
                <DialogDescription>
                  그룹웨어/ERP에서 다운로드한 실제 구매 데이터를 업로드하세요.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">CSV 파일</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    지원 형식: 날짜, 벤더, 제품, 수량, 단가, 총액, 통화 등
                  </p>
                </div>
                <div>
                  <Label htmlFor="project-name">프로젝트명 (선택)</Label>
                  <Input
                    id="project-name"
                    value={importProjectName}
                    onChange={(e) => setImportProjectName(e.target.value)}
                    placeholder="프로젝트/과제명"
                    className="mt-1"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-semibold mb-1">CSV 형식 예시:</p>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`날짜,벤더,제품,수량,단가,총액,통화
2024-01-15,벤더A,ELISA Kit,10,50000,500000,KRW
2024-01-20,벤더B,Filter,5,10000,50000,KRW`}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsImportDialogOpen(false);
                      setImportFile(null);
                      setImportProjectName("");
                    }}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      if (importFile) {
                        importMutation.mutate(importFile);
                      }
                    }}
                    disabled={!importFile || importMutation.isPending}
                    className="flex-1"
                  >
                    {importMutation.isPending ? "Import 중..." : "Import"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 필터 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>필터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>기간</Label>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">이번 달</SelectItem>
                    <SelectItem value="quarter">이번 분기</SelectItem>
                    <SelectItem value="year">이번 연도</SelectItem>
                    <SelectItem value="custom">커스텀</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <>
                  <div>
                    <Label>시작일</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>종료일</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 구매 금액</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₩{metrics.totalAmount?.toLocaleString() || 0}
              </div>
              {metrics.estimatedAmount !== undefined && metrics.actualAmount !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  예상: ₩{metrics.estimatedAmount.toLocaleString()} / 
                  실제: ₩{metrics.actualAmount.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">벤더 수</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.vendorCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">품목 수</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.itemCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">리스트 수</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.listCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* 예산 사용률 카드 */}
        {budgets.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>예산 사용률</CardTitle>
                <Link href="/dashboard/budget">
                  <Button variant="outline" size="sm">
                    예산 관리
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgets
                  .filter((b: any) => {
                    const now = new Date();
                    return new Date(b.periodStart) <= now && new Date(b.periodEnd) >= now;
                  })
                  .map((budget: any) => {
                    const usage = budget.usage || {};
                    const usageRate = usage.usageRate || 0;
                    const isOverBudget = usageRate > 100;
                    const isWarning = usageRate > 80 && usageRate <= 100;

                    return (
                      <div
                        key={budget.id}
                        className={`p-4 border rounded-lg ${
                          isOverBudget
                            ? "border-red-300 bg-red-50"
                            : isWarning
                            ? "border-orange-300 bg-orange-50"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-semibold">{budget.name}</div>
                            {budget.projectName && (
                              <div className="text-sm text-muted-foreground">
                                프로젝트: {budget.projectName}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">사용률</div>
                            <div className={`text-lg font-semibold ${isOverBudget ? "text-red-600" : ""}`}>
                              {usageRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                          <div>
                            <div className="text-muted-foreground">예산</div>
                            <div className="font-medium">
                              {budget.amount.toLocaleString()} {budget.currency}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">사용</div>
                            <div className="font-medium">
                              {usage.totalSpent?.toLocaleString() || 0} {budget.currency}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">잔여</div>
                            <div className={`font-medium ${usage.remaining < 0 ? "text-red-600" : ""}`}>
                              {usage.remaining?.toLocaleString() || budget.amount.toLocaleString()}{" "}
                              {budget.currency}
                            </div>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(usageRate, 100)}
                          className={isOverBudget ? "bg-red-200" : isWarning ? "bg-orange-200" : ""}
                        />
                      </div>
                    );
                  })}
                {budgets.filter((b: any) => {
                  const now = new Date();
                  return new Date(b.periodStart) <= now && new Date(b.periodEnd) >= now;
                }).length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    현재 활성화된 예산이 없습니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 예상 vs 실제 비교 */}
        {metrics.estimatedAmount !== undefined && metrics.actualAmount !== undefined && metrics.actualAmount > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>예상 vs 실제 구매액 비교</CardTitle>
              <CardDescription>
                BioInsight Lab에서 생성한 예상 구매액과 실제 구매액을 비교합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">예상 구매액</div>
                  <div className="text-2xl font-bold">₩{metrics.estimatedAmount.toLocaleString()}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">실제 구매액</div>
                  <div className="text-2xl font-bold">₩{metrics.actualAmount.toLocaleString()}</div>
                </div>
                <div className={`p-4 border rounded-lg ${
                  metrics.difference && metrics.difference > 0 
                    ? "bg-red-50 border-red-200" 
                    : metrics.difference && metrics.difference < 0
                    ? "bg-green-50 border-green-200"
                    : ""
                }`}>
                  <div className="text-sm text-muted-foreground mb-1">차이</div>
                  <div className={`text-2xl font-bold ${
                    metrics.difference && metrics.difference > 0 
                      ? "text-red-600" 
                      : metrics.difference && metrics.difference < 0
                      ? "text-green-600"
                      : ""
                  }`}>
                    {metrics.difference && metrics.difference > 0 ? "+" : ""}
                    ₩{metrics.difference?.toLocaleString() || 0}
                  </div>
                  {metrics.difference && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {metrics.difference > 0 
                        ? `예상보다 ${((metrics.difference / metrics.estimatedAmount) * 100).toFixed(1)}% 초과`
                        : `예상보다 ${((Math.abs(metrics.difference) / metrics.estimatedAmount) * 100).toFixed(1)}% 절감`
                      }
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>

        {/* 그래프 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>월별 구매 금액 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₩${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="amount" fill="#0088FE" name="구매 금액" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>벤더별 구매 비율</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={vendorData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {vendorData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₩${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 예산 사용률 */}
        {budgetUsage.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>예산 대비 사용률</CardTitle>
              <CardDescription>
                설정된 예산 대비 실제 사용 금액을 확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetUsage.map((budget: any) => (
                  <div key={budget.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{budget.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {budget.organization} {budget.projectName && `· ${budget.projectName}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(budget.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                          {new Date(budget.periodEnd).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {budget.usageRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          사용률
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">예산:</span>
                        <span className="font-semibold">₩{budget.budgetAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">사용:</span>
                        <span className="font-semibold">₩{budget.usedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">잔여:</span>
                        <span className={`font-semibold ${budget.remaining < 0 ? "text-red-600" : ""}`}>
                          ₩{budget.remaining.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              budget.usageRate >= 100
                                ? "bg-red-500"
                                : budget.usageRate >= 80
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(budget.usageRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 상세 테이블 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>구매내역 상세</CardTitle>
                <CardDescription>
                  필터링된 기간의 구매내역을 확인할 수 있습니다.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="group-by" className="text-sm">그룹핑:</Label>
                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                  <SelectTrigger id="group-by" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">그룹핑 없음</SelectItem>
                    <SelectItem value="vendor">벤더별</SelectItem>
                    <SelectItem value="category">카테고리별</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">로딩 중...</p>
            ) : details.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                해당 기간의 구매내역이 없습니다.
              </div>
            ) : groupBy === "none" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>조직</TableHead>
                      <TableHead>프로젝트</TableHead>
                      <TableHead>벤더</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead>제품명</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {new Date(item.date).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>{item.organization}</TableCell>
                        <TableCell>{item.project}</TableCell>
                        <TableCell>{item.vendor}</TableCell>
                        <TableCell>
                          {item.category && PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                            ? PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                            : item.category}
                        </TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ₩{item.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // 그룹핑 로직
                  const grouped = new Map<string, any[]>();
                  
                  details.forEach((item: any) => {
                    const key = groupBy === "vendor" 
                      ? (item.vendor || "미지정 벤더")
                      : (item.category || "미지정 카테고리");
                    
                    if (!grouped.has(key)) {
                      grouped.set(key, []);
                    }
                    grouped.get(key)!.push(item);
                  });

                  const groupedArray = Array.from(grouped.entries()).sort((a, b) => {
                    const aTotal = a[1].reduce((sum, d) => sum + (d.amount || 0), 0);
                    const bTotal = b[1].reduce((sum, d) => sum + (d.amount || 0), 0);
                    return bTotal - aTotal;
                  });

                  return groupedArray.map(([groupKey, items]) => {
                    const groupTotal = items.reduce((sum, d) => sum + (d.amount || 0), 0);
                    const itemCount = items.length;
                    const displayKey = groupBy === "category" && PRODUCT_CATEGORIES[groupKey as keyof typeof PRODUCT_CATEGORIES]
                      ? PRODUCT_CATEGORIES[groupKey as keyof typeof PRODUCT_CATEGORIES]
                      : groupKey;

                    return (
                      <div key={groupKey} className="border rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{displayKey}</h4>
                              <p className="text-sm text-muted-foreground">
                                {itemCount}개 품목
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">
                                ₩{groupTotal.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">그룹 합계</div>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>날짜</TableHead>
                                <TableHead>조직</TableHead>
                                <TableHead>프로젝트</TableHead>
                                {groupBy === "category" && <TableHead>벤더</TableHead>}
                                <TableHead>제품명</TableHead>
                                {groupBy === "vendor" && <TableHead>카테고리</TableHead>}
                                <TableHead className="text-right">금액</TableHead>
                                <TableHead>비고</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {new Date(item.date).toLocaleDateString("ko-KR")}
                                  </TableCell>
                                  <TableCell>{item.organization}</TableCell>
                                  <TableCell>{item.project}</TableCell>
                                  {groupBy === "category" && (
                                    <TableCell>{item.vendor}</TableCell>
                                  )}
                                  <TableCell>{item.productName}</TableCell>
                                  {groupBy === "vendor" && (
                                    <TableCell>
                                      {item.category && PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                                        ? PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                                        : item.category}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right font-semibold">
                                    ₩{item.amount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.notes}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


