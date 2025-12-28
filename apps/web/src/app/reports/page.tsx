"use client";

export const dynamic = 'force-dynamic';

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
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 필터 상태
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");

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

      const response = await fetch("/api/purchases/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Import 성공",
        description: "구매 내역이 성공적으로 import되었습니다.",
      });
      // 리포트 데이터 새로고침
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 인증 확인
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/reports");
  //   return null;
  // }

  // 예산 목록 조회
  const { data: budgets } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto py-4 md:py-8 px-3 md:px-4">
            <div className="max-w-7xl mx-auto">
        <PageHeader
          title="구매 리포트"
          description="기간/팀/벤더별 총 구매 금액과 예산 사용 상황을 확인합니다."
          icon={BarChart3}
          iconColor="text-green-600"
        />

      {/* 필터 */}
      <Card className="mb-4 md:mb-6 p-3 md:p-6">
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-sm md:text-lg">필터</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div>
              <Label htmlFor="startDate" className="text-xs md:text-sm">시작일</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs md:text-sm">종료일</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>
            <div>
              <Label htmlFor="category" className="text-xs md:text-sm">카테고리</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category" className="text-xs md:text-sm h-8 md:h-10">
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
            <div>
              <Label htmlFor="team" className="text-xs md:text-sm">팀/조직</Label>
              <Input
                id="team"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                placeholder="전체"
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>
            <div>
              <Label htmlFor="vendor" className="text-xs md:text-sm">벤더</Label>
              <Input
                id="vendor"
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                placeholder="전체"
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>
            <div>
              <Label htmlFor="budget" className="text-xs md:text-sm">예산</Label>
              <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                <SelectTrigger id="budget" className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {budgets?.map((budget: any) => (
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

      {/* KPI 카드 */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : reportData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <Card className="p-3 md:p-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                <CardTitle className="text-xs md:text-sm font-medium">총 구매 금액</CardTitle>
                <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="text-lg md:text-2xl font-bold break-words">
                  ₩{reportData.totalAmount?.toLocaleString("ko-KR") || 0}
                </div>
              </CardContent>
            </Card>
            <Card className="p-3 md:p-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                <CardTitle className="text-xs md:text-sm font-medium">총 구매 건수</CardTitle>
                <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="text-lg md:text-2xl font-bold">{reportData.totalCount || 0}</div>
              </CardContent>
            </Card>
            <Card className="p-3 md:p-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                <CardTitle className="text-xs md:text-sm font-medium">평균 단가</CardTitle>
                <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="text-lg md:text-2xl font-bold break-words">
                  ₩{reportData.averagePrice?.toLocaleString("ko-KR") || 0}
                </div>
              </CardContent>
            </Card>
            <Card className="p-3 md:p-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                <CardTitle className="text-xs md:text-sm font-medium">벤더 수</CardTitle>
                <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="text-lg md:text-2xl font-bold">{reportData.vendorCount || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* 예산 사용률 카드 */}
          {selectedBudget !== "all" && reportData.budgetUsage && (
            <Card className="mb-6">
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
                      ₩{reportData.budgetUsage.used?.toLocaleString("ko-KR") || 0} / ₩
                      {reportData.budgetUsage.total?.toLocaleString("ko-KR") || 0}
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
                    남은 예산: ₩
                    {(
                      (reportData.budgetUsage.total || 0) - (reportData.budgetUsage.used || 0)
                    ).toLocaleString("ko-KR")}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 예상 vs 실제 비교 */}
          {reportData.budgetComparison && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>예상 vs 실제</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.budgetComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="expected" fill="#8884d8" name="예상" />
                    <Bar dataKey="actual" fill="#82ca9d" name="실제" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 그래프 */}
          {reportData.chartData && reportData.chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>기간별 구매 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" fill="#8884d8" name="구매 금액" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 예산 사용률 */}
          {reportData.budgetUsageChart && reportData.budgetUsageChart.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>예산별 사용률</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.budgetUsageChart}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {reportData.budgetUsageChart.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || "#8884d8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 상세 테이블 */}
          {reportData.details && reportData.details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>상세 내역</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
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
                    {reportData.details.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(item.purchaseDate).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.vendorName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₩{item.unitPrice?.toLocaleString("ko-KR")}</TableCell>
                        <TableCell>₩{item.totalAmount?.toLocaleString("ko-KR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            데이터가 없습니다. 필터를 조정하거나 구매 내역을 import해주세요.
          </CardContent>
        </Card>
      )}

      {/* CSV Import Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="fixed bottom-8 right-8" size="lg">
            <Upload className="mr-2 h-4 w-4" />
            CSV Import
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>구매 내역 CSV Import</DialogTitle>
            <DialogDescription>
              CSV 파일을 업로드하여 구매 내역을 import합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importMutation.mutate(file);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
