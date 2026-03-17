"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Search, Copy, CheckCircle2, Clock, XCircle, Ban, Loader2, Mail } from "lucide-react";
import { downloadVendorResponsesCSV } from "@/lib/export/vendor-responses-csv";
import { PriceDisplay } from "@/components/products/price-display";

interface VendorResponsesPanelProps {
  quoteId: string;
}

type StatusFilter = "ALL" | "SENT" | "RESPONDED" | "EXPIRED" | "CANCELLED";

export function VendorResponsesPanel({ quoteId }: VendorResponsesPanelProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch vendor requests with responses
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vendor-requests", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`);
      if (!response.ok) {
        throw new Error("Failed to fetch vendor requests");
      }
      return response.json();
    },
    enabled: !!quoteId,
  });

  // Get quote items for comparison table
  const { data: quoteData } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch quote");
      }
      return response.json();
    },
    enabled: !!quoteId,
  });

  const vendorRequests = data?.vendorRequests || [];
  const quoteItems = quoteData?.quote?.items || [];

  // Use snapshot items for comparison (first vendor request's snapshot as reference)
  // All vendor requests for the same quote should have identical snapshots
  const snapshotItems = vendorRequests.length > 0 && vendorRequests[0].snapshot
    ? (vendorRequests[0].snapshot as any).items
    : quoteItems.map((item: any) => ({
        quoteItemId: item.id,
        lineNumber: item.lineNumber,
        productName: item.name,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unit: item.unit,
      }));

  // Filter vendor requests
  const filteredVendors = useMemo(() => {
    let filtered = vendorRequests;

    // Status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((v: any) => v.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((v: any) =>
        v.vendorEmail.toLowerCase().includes(query) ||
        (v.vendorName && v.vendorName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [vendorRequests, statusFilter, searchQuery]);

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/vendor/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "링크 복사 완료",
        description: "벤더 회신 링크가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "링크를 복사할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    if (vendorRequests.length === 0 || snapshotItems.length === 0) {
      toast({
        title: "내보내기 불가",
        description: "내보낼 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // Use snapshot items for CSV export (frozen at request time)
    const exportItems = snapshotItems.map((item: any) => ({
      id: item.quoteItemId,
      lineNumber: item.lineNumber,
      name: item.productName,
      catalogNumber: item.catalogNumber,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const snapshot = vendorRequests[0].snapshot as any;

    downloadVendorResponsesCSV({
      quoteId: quoteId,
      quoteTitle: snapshot.title || "견적 요청",
      items: exportItems,
      vendorRequests: vendorRequests,
    });

    toast({
      title: "CSV 내보내기 완료",
      description: "파일이 다운로드되었습니다.",
    });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);

    if (status === "RESPONDED") {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          회신완료
        </Badge>
      );
    }

    if (status === "EXPIRED" || expires < now) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          만료
        </Badge>
      );
    }

    if (status === "CANCELLED") {
      return (
        <Badge variant="secondary">
          <Ban className="h-3 w-3 mr-1" />
          취소
        </Badge>
      );
    }

    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        대기중
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="py-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">회신 데이터를 불러오는 중...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="py-12">
          <div className="text-center text-destructive">
            <XCircle className="h-12 w-12 mx-auto mb-4" />
            <p>회신 데이터를 불러올 수 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">벤더 회신</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                벤더별 견적 회신을 비교하고 CSV로 내보낼 수 있습니다.
              </CardDescription>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={vendorRequests.length === 0}
              variant="default"
              size="sm"
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              CSV 내보내기
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Status filter buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "전체" },
                { value: "SENT", label: "대기" },
                { value: "RESPONDED", label: "회신" },
                { value: "EXPIRED", label: "만료" },
                { value: "CANCELLED", label: "취소" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value as StatusFilter)}
                  className="text-xs h-7"
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 sm:max-w-xs">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="벤더 이메일/이름 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Requests List */}
      {filteredVendors.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-sm font-medium text-slate-600">
              {vendorRequests.length === 0
                ? "아직 벤더에게 견적 요청을 보내지 않았습니다."
                : "검색 결과가 없습니다."}
            </p>
            {vendorRequests.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                "견적 요청 보내기" 버튼을 클릭하여 벤더에게 견적을 요청하세요.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Vendor Requests Summary Table */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">
                벤더 요청 현황 ({filteredVendors.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">벤더명/이메일</TableHead>
                      <TableHead className="text-xs">상태</TableHead>
                      <TableHead className="text-xs">만료일</TableHead>
                      <TableHead className="text-xs">회신일</TableHead>
                      <TableHead className="text-xs text-right">동작</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((vendor: any) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="text-xs">
                          <div>
                            {vendor.vendorName && (
                              <div className="font-medium text-slate-900">{vendor.vendorName}</div>
                            )}
                            <div className="text-slate-500">{vendor.vendorEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getStatusBadge(vendor.status, vendor.expiresAt)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(vendor.expiresAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {vendor.respondedAt
                            ? new Date(vendor.respondedAt).toLocaleDateString("ko-KR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(vendor.token)}
                            className="h-7 text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            링크 복사
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Responses Comparison Table */}
          {snapshotItems.length > 0 && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-900">회신 비교</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  품목별 벤더 회신을 비교합니다. (요청 당시 기준)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sticky left-0 bg-white z-10" rowSpan={2}>
                          No.
                        </TableHead>
                        <TableHead className="text-xs sticky left-12 bg-white z-10" rowSpan={2}>
                          제품명
                        </TableHead>
                        <TableHead className="text-xs" rowSpan={2}>
                          Cat No.
                        </TableHead>
                        <TableHead className="text-xs text-right" rowSpan={2}>
                          요청수량
                        </TableHead>
                        {filteredVendors.map((vendor: any) => (
                          <TableHead
                            key={vendor.id}
                            className="text-xs text-center border-l border-slate-200"
                            colSpan={3}
                          >
                            {vendor.vendorName || vendor.vendorEmail}
                          </TableHead>
                        ))}
                      </TableRow>
                      <TableRow>
                        {filteredVendors.map((vendor: any) => (
                          <React.Fragment key={vendor.id}>
                            <TableHead className="text-xs text-right border-l border-slate-200">
                              단가
                            </TableHead>
                            <TableHead className="text-xs text-center">납기(일)</TableHead>
                            <TableHead className="text-xs text-center">MOQ</TableHead>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshotItems.map((item: any, index: number) => (
                        <TableRow key={item.quoteItemId}>
                          <TableCell className="text-xs font-medium sticky left-0 bg-white">
                            {item.lineNumber || index + 1}
                          </TableCell>
                          <TableCell className="text-xs sticky left-12 bg-white">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {item.catalogNumber || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {item.quantity} {item.unit || "ea"}
                          </TableCell>
                          {filteredVendors.map((vendor: any) => {
                            const response = vendor.responseItems.find(
                              (r: any) => r.quoteItemId === item.quoteItemId
                            );

                            const isWaiting = vendor.status !== "RESPONDED";

                            return (
                              <React.Fragment key={vendor.id}>
                                <TableCell
                                  className={`text-xs text-right border-l border-slate-200 ${
                                    isWaiting ? "text-slate-400" : ""
                                  }`}
                                >
                                  {response?.unitPrice ? (
                                    <PriceDisplay
                                      price={response.unitPrice}
                                      currency={response.currency || "KRW"}
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell
                                  className={`text-xs text-center ${isWaiting ? "text-slate-400" : ""}`}
                                >
                                  {response?.leadTimeDays || "—"}
                                </TableCell>
                                <TableCell
                                  className={`text-xs text-center ${isWaiting ? "text-slate-400" : ""}`}
                                >
                                  {response?.moq || "—"}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
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
    </div>
  );
}
