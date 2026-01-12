"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Calendar, Filter, FileText, ChevronRight, Receipt, Plus, Search, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { CsvUploadTab } from "@/components/purchases/csv-upload-tab";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { getGuestKey } from "@/lib/guest-key";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ColumnDef } from "@tanstack/react-table";

export default function PurchasesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvText, setCsvText] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("month");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      const data = await response.json();
      return data.organizations || [];
    },
    enabled: !!session,
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "year":
        return { from: startOfYear(now), to: endOfYear(now) };
      case "all":
        return { from: new Date(2020, 0, 1), to: now };
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  };

  const { from, to } = getDateRange();

  const guestKey = getGuestKey();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["purchase-summary", guestKey, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(`/api/purchases/summary?${params}`, {
        headers: {
          "x-guest-key": guestKey,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch purchase summary");
      return response.json();
    },
    enabled: !!guestKey,
  });

  // TSV/CSV 파싱 함수
  const parseTsvToRows = (text: string): any[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("At least 2 lines required (header + data)");
    }

    // 헤더 파싱
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(delimiter).map((h) => h.trim());

    // 컬럼 매핑 (한글/영문 헤더 지원)
    const columnMap: Record<string, string> = {
      "구매일": "purchasedAt",
      "purchasedAt": "purchasedAt",
      "date": "purchasedAt",
      "벤더": "vendorName",
      "vendorName": "vendorName",
      "vendor": "vendorName",
      "카테고리": "category",
      "category": "category",
      "품목명": "itemName",
      "itemName": "itemName",
      "item": "itemName",
      "품목": "itemName",
      "수량": "qty",
      "qty": "qty",
      "quantity": "qty",
      "단가": "unitPrice",
      "unitPrice": "unitPrice",
      "price": "unitPrice",
      "금액": "amount",
      "amount": "amount",
      "total": "amount",
      "통화": "currency",
      "currency": "currency",
      "카탈로그번호": "catalogNumber",
      "catalogNumber": "catalogNumber",
      "catalog": "catalogNumber",
      "단위": "unit",
      "unit": "unit",
    };

    const mappedHeaders = headers.map((h) => columnMap[h] || h.toLowerCase());

    // 데이터 행 파싱
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim());
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, idx) => {
        const mappedKey = mappedHeaders[idx];
        const value = values[idx];

        if (mappedKey === "qty" || mappedKey === "unitPrice" || mappedKey === "amount") {
          row[mappedKey] = value ? parseInt(value.replace(/,/g, "")) : undefined;
        } else {
          row[mappedKey] = value || undefined;
        }
      });

      // 필수 필드 확인
      if (row.purchasedAt && row.vendorName && row.itemName && row.qty) {
        rows.push(row);
      }
    }

    return rows;
  };

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const response = await fetch("/api/purchases/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-key": guestKey,
        },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `${data.successRows} rows imported successfully. ${data.errorRows} errors.`,
      });
      setCsvText("");
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!csvText.trim()) {
      toast({
        title: "Error",
        description: "Please paste TSV/CSV data",
        variant: "destructive",
      });
      return;
    }

    try {
      const rows = parseTsvToRows(csvText);
      if (rows.length === 0) {
        throw new Error("No valid rows found");
      }
      importMutation.mutate(rows);
    } catch (error: any) {
      toast({
        title: "Parse error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number | null | undefined, currency: string = "KRW") => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0원";
    }
    const safeAmount = Number(amount);
    if (isNaN(safeAmount) || safeAmount < 0) {
      return "0원";
    }
    if (currency === "KRW") {
      return new Intl.NumberFormat('ko-KR').format(safeAmount) + '원';
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

  // 구매 내역 리스트 조회
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases-list", guestKey, dateRange, customDateRange],
    queryFn: async () => {
      const dateFrom = customDateRange?.from || from.toISOString();
      const dateTo = customDateRange?.to || to.toISOString();
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
      });
      const response = await fetch(`/api/purchases?${params}`, {
        headers: {
          "x-guest-key": guestKey,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch purchases");
      return response.json();
    },
    enabled: !!guestKey,
  });

  // 필터링된 구매 내역
  const filteredPurchases = useMemo(() => {
    if (!purchasesData?.items) return [];
    let filtered = purchasesData.items;

    // 검색 필터 (품목명)
    if (searchQuery) {
      filtered = filtered.filter((purchase: any) =>
        purchase.itemName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 공급사 필터
    if (selectedVendor !== "all") {
      filtered = filtered.filter((purchase: any) =>
        purchase.vendorName === selectedVendor
      );
    }

    return filtered;
  }, [purchasesData?.items, searchQuery, selectedVendor]);

  // 고유한 공급사 목록
  const uniqueVendors = useMemo(() => {
    if (!purchasesData?.items) return [];
    const vendors = new Set(purchasesData.items.map((p: any) => p.vendorName).filter(Boolean));
    return Array.from(vendors).sort();
  }, [purchasesData?.items]);

  // DataTable 컬럼 정의
  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: "purchasedAt",
      header: "거래일자",
      cell: ({ row }) => {
        const date = row.original.purchasedAt;
        return date ? format(new Date(date), "yyyy.MM.dd") : "-";
      },
    },
    {
      accessorKey: "itemName",
      header: "품목명",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{item.itemName || "-"}</span>
            {item.catalogNumber && (
              <span className="text-xs text-gray-400 font-mono">{item.catalogNumber}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "vendorName",
      header: "공급사",
      cell: ({ row }) => row.original.vendorName || "-",
    },
    {
      accessorKey: "qty",
      header: "수량",
      cell: ({ row }) => {
        const item = row.original;
        return `${item.qty || 0} ${item.unit || ""}`;
      },
    },
    {
      accessorKey: "unitPrice",
      header: "단가",
      cell: ({ row }) => {
        const unitPrice = row.original.unitPrice;
        return unitPrice ? formatCurrency(unitPrice, row.original.currency) : "-";
      },
    },
    {
      accessorKey: "amount",
      header: "총액",
      cell: ({ row }) => {
        const amount = row.original.amount;
        return <span className="font-bold">{formatCurrency(amount, row.original.currency)}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => {
        const statusBadge = getStatusBadge(row.original);
        return (
          <Badge
            variant="outline"
            className={`${statusBadge.className} border-0 rounded-full px-3 py-1 text-xs font-medium`}
          >
            {statusBadge.label}
          </Badge>
        );
      },
    },
  ], []);

  // 상태에 따른 뱃지 스타일 (가상의 상태 - 실제 데이터에 따라 조정 필요)
  const getStatusBadge = (purchase: any) => {
    // 실제 데이터에 status 필드가 없으므로, purchasedAt 기준으로 가상 상태 생성
    const daysAgo = Math.floor((Date.now() - new Date(purchase.purchasedAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo > 7) {
      return { label: "배송완료", className: "bg-green-100 text-green-700" };
    } else if (daysAgo > 3) {
      return { label: "배송중", className: "bg-blue-100 text-blue-700" };
    } else {
      return { label: "대기", className: "bg-yellow-100 text-yellow-700" };
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <div className="flex flex-1">
        <DashboardSidebar />
        <div className="flex-1">
          <PageHeader
            title="구매 내역"
            description="구매 영수증과 내역을 이곳에서 관리하세요."
            icon={Download}
          />
          <main className="container mx-auto p-6 space-y-6 pt-24">
            {/* Purchase Summary - Always visible with guest-key */}
            {guestKey && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">이번 달 총 지출</CardTitle>
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-gray-900">
                        {summaryLoading ? "..." : formatCurrency(summary?.summary?.currentMonthSpending || 0)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {summary?.summary?.currentMonthCount || 0}건의 구매
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">연간 누적</CardTitle>
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-extrabold text-gray-900">
                        {summaryLoading ? "..." : formatCurrency(summary?.summary?.yearToDate || 0)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        올해 총 구매 금액
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-sm font-medium text-gray-500">주요 벤더</CardTitle>
                      <Filter className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-gray-900">
                        {summaryLoading ? "..." : summary?.topVendors?.[0]?.vendorName || "-"}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {summary?.topVendors?.[0]
                          ? formatCurrency(summary.topVendors[0].totalAmount)
                          : "-"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Bar: [+ 내역 등록] 버튼 및 필터 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* 필터 바 */}
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* 검색창 */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="품명 검색"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {/* 기간 설정 */}
                    <DateRangePicker
                      startDate={customDateRange?.from}
                      endDate={customDateRange?.to}
                      onDateChange={(from, to) => setCustomDateRange({ from, to })}
                    />
                    {/* 공급사 필터 */}
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="공급사 필터" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 공급사</SelectItem>
                        {uniqueVendors.map((vendor) => (
                          <SelectItem key={vendor} value={vendor}>
                            {vendor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* [+ 내역 등록] 버튼 */}
                  <Button
                    onClick={() => setIsImportDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    내역 등록
                  </Button>
                </div>

                {/* Purchase History DataTable */}
                {purchasesLoading ? (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardContent className="flex items-center justify-center py-16">
                      <p className="text-gray-500">로딩 중...</p>
                    </CardContent>
                  </Card>
                ) : filteredPurchases.length > 0 ? (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gray-50/50 pb-3">
                      <CardTitle className="text-lg font-semibold">구매 내역</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        총 {filteredPurchases.length}건의 구매 내역
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <DataTable
                        columns={columns}
                        data={filteredPurchases}
                        searchKey="itemName"
                        searchPlaceholder="품명 검색"
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Package className="h-16 w-16 text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">아직 구매 내역이 없습니다.</h3>
                      <p className="text-sm text-gray-500 mb-6">첫 구매 내역을 등록해보세요.</p>
                      <Button
                        onClick={() => setIsImportDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        내역 추가하기
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Import Dialog (모달) */}
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>구매 내역 등록</DialogTitle>
                      <DialogDescription>
                        간편 입력, TSV 붙여넣기, CSV 업로드 중 선택하세요
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="csv-upload" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="simple-form">간편 입력</TabsTrigger>
                        <TabsTrigger value="tsv-paste">TSV 붙여넣기</TabsTrigger>
                        <TabsTrigger value="csv-upload">CSV 업로드</TabsTrigger>
                      </TabsList>

                      {/* Tab 1: Simple Form */}
                      <TabsContent value="simple-form" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="purchasedAt">구매일 *</Label>
                            <Input type="date" id="purchasedAt" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="vendorName">벤더 *</Label>
                            <Input id="vendorName" placeholder="Sigma-Aldrich" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="category">카테고리</Label>
                            <Select>
                              <SelectTrigger id="category">
                                <SelectValue placeholder="선택..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REAGENT">REAGENT</SelectItem>
                                <SelectItem value="EQUIPMENT">EQUIPMENT</SelectItem>
                                <SelectItem value="TOOL">TOOL</SelectItem>
                                <SelectItem value="RAW_MATERIAL">RAW_MATERIAL</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="itemName">품목명 *</Label>
                            <Input id="itemName" placeholder="Reagent A" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="qty">수량 *</Label>
                            <Input type="number" id="qty" placeholder="10" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="unitPrice">단가</Label>
                            <Input type="number" id="unitPrice" placeholder="50000" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="amount">금액 *</Label>
                            <Input type="number" id="amount" placeholder="500000" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="currency">통화</Label>
                            <Input id="currency" defaultValue="KRW" />
                          </div>
                        </div>
                        <Button className="w-full">
                          <Upload className="mr-2 h-4 w-4" />
                          추가
                        </Button>
                      </TabsContent>

                      {/* Tab 2: TSV Paste */}
                      <TabsContent value="tsv-paste" className="space-y-4">
                        <Textarea
                          placeholder="TSV 데이터를 붙여넣으세요...
예시:
구매일	벤더	카테고리	품목명	수량	단가	금액
2025-01-15	Sigma-Aldrich	REAGENT	Reagent A	10	50000	500000
2025-01-20	Thermo Fisher	EQUIPMENT	Centrifuge	1	2000000	2000000"
                          value={csvText}
                          onChange={(e) => setCsvText(e.target.value)}
                          rows={8}
                          className="font-mono text-sm"
                        />
                        <Button
                          onClick={handleImport}
                          disabled={!csvText.trim() || importMutation.isPending}
                          className="w-full"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {importMutation.isPending ? "처리 중..." : "가져오기"}
                        </Button>
                      </TabsContent>

                      {/* Tab 3: CSV Upload */}
                      <TabsContent value="csv-upload">
                        <CsvUploadTab
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
                            queryClient.invalidateQueries({ queryKey: ["purchases-list"] });
                            setIsImportDialogOpen(false);
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>


                {/* Top Vendors */}
                {summary?.topVendors && summary.topVendors.length > 0 && (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardHeader className="bg-gray-50/50 pb-3">
                      <CardTitle className="text-lg font-semibold">Top Vendors</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Vendors by total spending
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                Vendor
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                Purchases
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                Total Amount
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.topVendors?.map((vendor: any, idx: number) => (
                              <TableRow
                                key={vendor?.vendorName || `vendor-${idx}`}
                                className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                              >
                                <TableCell className="py-4 px-6 font-medium text-gray-900">
                                  {vendor?.vendorName || "-"}
                                </TableCell>
                                <TableCell className="py-4 px-6 text-right text-gray-600">
                                  {vendor?.count ?? 0}
                                </TableCell>
                                <TableCell className="py-4 px-6 text-right">
                                  <span className="font-bold text-gray-900">
                                    {formatCurrency(vendor?.totalAmount)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Categories */}
                {summary?.topCategories && summary.topCategories.length > 0 && (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <CardHeader className="bg-gray-50/50 pb-3">
                      <CardTitle className="text-lg font-semibold">Top Categories</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Categories by total spending
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                Category
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                Purchases
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                Total Amount
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.topCategories?.map((category: any, idx: number) => (
                              <TableRow
                                key={category?.category || `category-${idx}`}
                                className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                              >
                                <TableCell className="py-4 px-6 font-medium text-gray-900">
                                  {category?.category || "-"}
                                </TableCell>
                                <TableCell className="py-4 px-6 text-right text-gray-600">
                                  {category?.count ?? 0}
                                </TableCell>
                                <TableCell className="py-4 px-6 text-right">
                                  <span className="font-bold text-gray-900">
                                    {formatCurrency(category?.totalAmount)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
