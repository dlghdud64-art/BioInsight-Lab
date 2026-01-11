"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertTriangle,
  DollarSign,
  FileText,
  TrendingUp,
  Link as LinkIcon,
  Search,
  Loader2,
  Calendar,
  X,
  Download,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastAction } from "@/components/ui/toast";
import { useSearchParams } from "next/navigation";

function SafetySpendPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [period, setPeriod] = useState<string>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isUnmappedDialogOpen, setIsUnmappedDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [confirmMatch, setConfirmMatch] = useState<{ open: boolean; productId?: string }>({
    open: false,
  });
  const [isExporting, setIsExporting] = useState<{ format: string | null }>({ format: null });

  // 조직 목록 조회
  const { data: organizationsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations.find(
    (org: any) => org.id === selectedOrgId || (!selectedOrgId && org.id)
  ) || organizations[0];

  // Safety Spend 데이터 조회
  const { data: spendData, isLoading } = useQuery({
    queryKey: ["safety-spend", currentOrg?.id, period, startDate, endDate],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const params = new URLSearchParams({
        organizationId: currentOrg.id,
        period,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const response = await fetch(`/api/safety/spend/summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch safety spend data");
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  // Unmapped 데이터 조회
  const { data: unmappedData, isLoading: unmappedLoading } = useQuery({
    queryKey: ["unmapped-records", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { records: [], total: 0 };
      const params = new URLSearchParams({
        organizationId: currentOrg.id,
        limit: "100",
      });
      const response = await fetch(`/api/safety/spend/unmapped?${params}`);
      if (!response.ok) return { records: [], total: 0 };
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  // 제품 검색
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["product-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { products: [] };
      const response = await fetch(
        `/api/products/search?query=${encodeURIComponent(searchQuery)}&limit=10`
      );
      if (!response.ok) return { products: [] };
      return response.json();
    },
    enabled: searchQuery.trim().length > 0,
  });

  // 제품 매칭
  const matchMutation = useMutation({
    mutationFn: async ({ recordId, productId }: { recordId: string; productId: string }) => {
      const response = await fetch(`/api/safety/spend/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: recordId, productId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to match product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-records", currentOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ["safety-spend", currentOrg?.id] });
      setIsUnmappedDialogOpen(false);
      setSelectedRecord(null);
      setSearchQuery("");
      toast({
        title: "매칭 완료",
        description: "제품이 성공적으로 연결되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "매칭 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const kpi = {
    totalAmount: spendData?.totalAmount || 0,
    hazardousAmount: spendData?.hazardousAmount || 0,
    missingSdsAmount: spendData?.missingSdsAmount || 0,
    hazardousRatio: spendData?.hazardousSharePct || 0,
  };

  const unmapped = {
    count: spendData?.unmappedCount || 0,
    amount: spendData?.unmappedAmount || 0,
  };
  const unmappedRecords = unmappedData?.records || [];

  const formatCurrency = (amount: number | null | undefined, currency: string = "KRW") => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0원";
    }
    const safeAmount = Number(amount);
    if (isNaN(safeAmount) || safeAmount < 0) {
      return "0원";
    }
    if (currency === "KRW") {
      return `₩${safeAmount.toLocaleString("ko-KR")}`;
    }
    try {
      return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: currency,
      }).format(safeAmount);
    } catch (error) {
      return `${currency} ${safeAmount.toLocaleString("ko-KR")}`;
    }
  };

  const handleMatch = (recordId: string, productId: string) => {
    setConfirmMatch({ open: true, productId });
  };

  const confirmMatchAction = () => {
    if (selectedRecord && confirmMatch.productId) {
      matchMutation.mutate({
        recordId: selectedRecord.id,
        productId: confirmMatch.productId,
      });
      setConfirmMatch({ open: false });
    }
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (!currentOrg?.id) {
      toast({
        title: "오류",
        description: "워크스페이스를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    // PDF는 준비중
    if (format === "pdf") {
      toast({
        title: "준비중",
        description: "PDF 다운로드는 곧 제공될 예정입니다.",
        variant: "default",
      });
      return;
    }

    setIsExporting({ format });

    try {
      const params = new URLSearchParams({
        format,
        organizationId: currentOrg.id,
        period,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`/api/safety/spend/export?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "다운로드에 실패했습니다.");
      }

      // CSV 다운로드
      if (format === "csv" || format === "xlsx") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const filename = `safety_spend_report_${new Date().toISOString().split("T")[0]}.${format === "xlsx" ? "xlsx" : "csv"}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "다운로드 완료",
          description: `${format.toUpperCase()} 파일이 다운로드되었습니다.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "다운로드 실패",
        description: error.message || "다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
        action: (
          <ToastAction altText="재시도" onClick={() => handleExport(format)}>
            재시도
          </ToastAction>
        ),
      });
    } finally {
      setIsExporting({ format: null });
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <Skeleton className="h-8 w-64 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <PageHeader
                  title="위험물/규제 구매 예산"
                  description="위험물 구매 현황 및 SDS 관리 상태를 확인합니다."
                  icon={AlertTriangle}
                  iconColor="text-red-600"
                />
                {currentOrg && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={isExporting.format !== null}
                        variant="outline"
                      >
                        {isExporting.format ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            내보내는 중...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            리포트 내보내기
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleExport("csv")}
                        disabled={isExporting.format !== null}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        CSV 다운로드
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport("xlsx")}
                        disabled={isExporting.format !== null}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        XLSX 다운로드
                        <Badge variant="secondary" className="ml-2 text-xs">
                          준비중
                        </Badge>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport("pdf")}
                        disabled={isExporting.format !== null}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF 다운로드
                        <Badge variant="secondary" className="ml-2 text-xs">
                          준비중
                        </Badge>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        SDS 없는 품목, 위험물 지출 비중, Hazard Code별 지출을 포함합니다.
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* 워크스페이스 선택 */}
              {organizations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">워크스페이스 선택</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkspaceSwitcher
                      currentOrganizationId={selectedOrgId}
                      onOrganizationChange={setSelectedOrgId}
                      showActions={false}
                    />
                  </CardContent>
                </Card>
              )}

              {currentOrg && (
                <>
                  {/* 기간 필터 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">기간 선택</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        <Select value={period} onValueChange={setPeriod}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month">이번 달</SelectItem>
                            <SelectItem value="30days">최근 30일</SelectItem>
                            <SelectItem value="quarter">분기</SelectItem>
                            <SelectItem value="custom">직접 선택</SelectItem>
                          </SelectContent>
                        </Select>
                        {period === "custom" && (
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-[160px]"
                            />
                            <span className="self-center text-muted-foreground">~</span>
                            <Input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-[160px]"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* KPI 카드 */}
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            총 구매액
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(kpi.totalAmount)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            위험물 구매액
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(kpi.hazardousAmount)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-yellow-600" />
                            SDS 없음 구매액
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-yellow-600">
                            {formatCurrency(kpi.missingSdsAmount)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            위험물 비중
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {kpi.hazardousRatio.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Unmapped 요약 카드 */}
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            매칭 필요 {unmapped.count}건 / {formatCurrency(unmapped.amount)}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            제품 정보가 연결되지 않은 구매 내역입니다.
                          </p>
                        </div>
                        <Button
                          onClick={() => setIsUnmappedDialogOpen(true)}
                          disabled={unmapped.count === 0}
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          매칭하기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 차트/테이블 섹션 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 월별 통계 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">월별 통계</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <Skeleton className="h-64" />
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>월</TableHead>
                                <TableHead>총액</TableHead>
                                <TableHead>위험물</TableHead>
                                <TableHead>SDS 없음</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {spendData?.byMonth && spendData.byMonth.length > 0 ? (
                                spendData.byMonth.map((month: any) => (
                                  <TableRow key={month.month}>
                                    <TableCell className="font-medium">{month.month}</TableCell>
                                    <TableCell>{formatCurrency(month.total)}</TableCell>
                                    <TableCell className="text-red-600">
                                      {formatCurrency(month.hazardous)}
                                    </TableCell>
                                    <TableCell className="text-yellow-600">
                                      {formatCurrency(month.missingSds)}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    데이터가 없습니다.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Hazard Codes */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Top 위험 코드</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <Skeleton className="h-64" />
                        ) : (
                          <div className="space-y-2">
                            {spendData?.topHazardCodes?.map((item: any, index: number) => (
                              <div
                                key={item.code}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">{index + 1}</Badge>
                                  <span className="font-mono text-sm">{item.code}</span>
                                </div>
                                <span className="font-medium">
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                            ))}
                            {(!spendData?.topHazardCodes ||
                              spendData.topHazardCodes.length === 0) && (
                              <p className="text-center text-muted-foreground py-8">
                                데이터가 없습니다.
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top Vendors */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Top 벤더</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-64" />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>순위</TableHead>
                              <TableHead>벤더명</TableHead>
                              <TableHead>구매액</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {spendData?.topVendors?.map((vendor: any, index: number) => (
                              <TableRow key={vendor.name}>
                                <TableCell>
                                  <Badge variant="outline">{index + 1}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">{vendor.name}</TableCell>
                                <TableCell>{formatCurrency(vendor.amount)}</TableCell>
                              </TableRow>
                            ))}
                            {(!spendData?.topVendors || spendData.topVendors.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                  데이터가 없습니다.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unmapped 매칭 다이얼로그 */}
      <Dialog open={isUnmappedDialogOpen} onOpenChange={setIsUnmappedDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>제품 매칭</DialogTitle>
            <DialogDescription>
              구매 내역과 제품을 연결하여 안전 정보를 추적할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {unmappedLoading ? (
            <div className="py-8">
              <Skeleton className="h-64" />
            </div>
          ) : unmappedRecords.length === 0 ? (
            <div className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">매칭 필요 항목이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* 구매 내역 리스트 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold mb-3">구매 내역</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {unmappedRecords.map((record: any) => (
                    <Card
                      key={record.id}
                      className={`cursor-pointer transition-colors ${
                        selectedRecord?.id === record.id ? "border-blue-500 bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{record.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.purchaseDate).toLocaleDateString("ko-KR")} ·{" "}
                            {record.vendor}
                          </p>
                          {record.catalogNumber && (
                            <p className="text-xs text-muted-foreground">
                              Cat.No: {record.catalogNumber}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-blue-600">
                            {formatCurrency(record.amount, record.currency)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* 제품 검색 및 매칭 */}
              <div className="space-y-4">
                {selectedRecord ? (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold mb-2">제품 검색</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="제품명 또는 카탈로그 번호 검색..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {searchLoading ? (
                      <div className="py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {searchResults?.products?.map((product: any) => (
                          <Card key={product.id} className="cursor-pointer hover:bg-slate-50">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{product.name}</p>
                                  {product.catalogNumber && (
                                    <p className="text-xs text-muted-foreground">
                                      Cat.No: {product.catalogNumber}
                                    </p>
                                  )}
                                  {product.brand && (
                                    <p className="text-xs text-muted-foreground">
                                      브랜드: {product.brand}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleMatch(selectedRecord.id, product.id)}
                                  disabled={matchMutation.isPending}
                                >
                                  {matchMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "연결"
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {searchQuery && (!searchResults?.products || searchResults.products.length === 0) && (
                          <p className="text-center text-muted-foreground py-8">
                            검색 결과가 없습니다.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">구매 내역을 선택해주세요.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 매칭 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmMatch.open}
        onOpenChange={(open) => setConfirmMatch({ open, productId: confirmMatch.productId })}
        title="제품 연결 확인"
        description="이 구매 내역을 선택한 제품과 연결하시겠습니까?"
        confirmText="연결"
        onConfirm={confirmMatchAction}
      />
    </div>
  );
}

export default function SafetySpendPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SafetySpendPageContent />
    </Suspense>
  );
}

