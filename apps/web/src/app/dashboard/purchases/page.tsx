"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Calendar, Filter, FileText } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { CsvUploadTab } from "@/components/purchases/csv-upload-tab";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
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

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["purchase-summary", selectedOrganization, dateRange],
    queryFn: async () => {
      if (!selectedOrganization) return null;
      const params = new URLSearchParams({
        organizationId: selectedOrganization,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(`/api/purchases/summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch purchase summary");
      return response.json();
    },
    enabled: !!selectedOrganization,
  });

  const importMutation = useMutation({
    mutationFn: async (data: { csvText: string; organizationId: string }) => {
      const response = await fetch("/api/purchases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import CSV");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `${data.successCount} rows imported successfully. ${data.errorCount} errors.`,
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
        description: "Please paste CSV data",
        variant: "destructive",
      });
      return;
    }
    if (!selectedOrganization) {
      toast({
        title: "Error",
        description: "Please select an organization",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate({ csvText, organizationId: selectedOrganization });
  };

  const formatCurrency = (amount: number, currency: string = "KRW") => {
    if (currency === "KRW") {
      return `₩${amount.toLocaleString()}`;
    }
    return `${currency} ${amount.toLocaleString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MainHeader />
      <div className="flex flex-1">
        <DashboardSidebar />
        <div className="flex-1">
          <PageHeader
            title="Purchase History"
            description="Import and track your purchase records"
            icon={Download}
          />
          <main className="container mx-auto p-6 space-y-6">
            {/* Organization Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Select Organization</CardTitle>
                <CardDescription>Choose the organization for purchase tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org: any) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedOrganization && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">This Month</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryLoading ? "..." : formatCurrency(summary?.summary?.currentMonthSpending || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryLoading ? "..." : formatCurrency(summary?.summary?.yearToDate || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Top Vendor</CardTitle>
                      <Filter className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {summaryLoading ? "..." : summary?.topVendors?.[0]?.vendorName || "N/A"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {summary?.topVendors?.[0]
                          ? formatCurrency(summary.topVendors[0].totalAmount)
                          : ""}
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

                {/* Top Vendors */}
                {summary?.topVendors && summary.topVendors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Vendors</CardTitle>
                      <CardDescription>Vendors by total spending</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Purchases</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.topVendors.map((vendor: any) => (
                            <TableRow key={vendor.vendorName}>
                              <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                              <TableCell className="text-right">{vendor.count}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(vendor.totalAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Top Categories */}
                {summary?.topCategories && summary.topCategories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Categories</CardTitle>
                      <CardDescription>Categories by total spending</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Purchases</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.topCategories.map((category: any) => (
                            <TableRow key={category.category}>
                              <TableCell className="font-medium">{category.category}</TableCell>
                              <TableCell className="text-right">{category.count}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(category.totalAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
