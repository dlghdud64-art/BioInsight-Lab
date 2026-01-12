"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Calendar, Filter, FileText, ChevronRight, Receipt } from "lucide-react";
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

export default function PurchasesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvText, setCsvText] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("month");

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

  // 구매 내역 리스트 조회
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases-list", guestKey, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
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
                          : "데이터 없음"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Purchase Import with Tabs */}
                <Card>
                  <CardHeader>
                    <CardTitle>구매내역 추가</CardTitle>
                    <CardDescription>
                      간편 입력, TSV 붙여넣기, CSV 업로드 중 선택하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Purchase History Table */}
                {purchasesData?.items && purchasesData.items.length > 0 && (
                  <Card className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gray-50/50 pb-3">
                      <CardTitle className="text-lg font-semibold">구매 내역</CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        최근 구매 내역을 확인하세요
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                주문 번호
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                날짜
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                벤더
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                품목
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                수량
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6">
                                상태
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 text-right">
                                금액
                              </TableHead>
                              <TableHead className="text-xs font-medium text-gray-500 uppercase py-3 px-6 w-12">
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {purchasesData.items.map((purchase: any, idx: number) => {
                              const statusBadge = getStatusBadge(purchase);
                              const orderNumber = purchase.id.slice(-8).toUpperCase();
                              return (
                                <TableRow
                                  key={purchase.id || `purchase-${idx}`}
                                  className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors cursor-pointer"
                                >
                                  <TableCell className="py-4 px-6">
                                    <span className="font-mono text-sm text-gray-600">
                                      {orderNumber}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <span className="text-sm text-gray-500">
                                      {format(new Date(purchase.purchasedAt), "yyyy.MM.dd")}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <span className="text-sm text-gray-900 font-medium">
                                      {purchase.vendorName || "Unknown"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <div className="flex flex-col">
                                      <span className="text-sm text-gray-900 font-medium">
                                        {purchase.itemName || "Unknown Item"}
                                      </span>
                                      {purchase.catalogNumber && (
                                        <span className="text-xs text-gray-400 font-mono mt-0.5">
                                          {purchase.catalogNumber}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4 px-6 text-right">
                                    <span className="text-sm text-gray-600">
                                      {purchase.qty} {purchase.unit || ""}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <Badge
                                      variant="outline"
                                      className={`${statusBadge.className} border-0 rounded-full px-3 py-1 text-xs font-medium`}
                                    >
                                      {statusBadge.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-4 px-6 text-right">
                                    <span className="font-bold text-gray-900">
                                      {formatCurrency(purchase.amount, purchase.currency)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 px-6">
                                    <div className="flex items-center gap-2 justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                        title="영수증 다운로드"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toast({
                                            title: "준비 중",
                                            description: "영수증 다운로드 기능은 곧 제공될 예정입니다.",
                                          });
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <ChevronRight className="h-4 w-4 text-gray-300" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
