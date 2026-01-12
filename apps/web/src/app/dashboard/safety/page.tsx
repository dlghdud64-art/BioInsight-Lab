"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  AlertTriangle,
  FileText,
  Search,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { getProductSafetyLevel } from "@/lib/utils/safety-visualization";

export default function SafetyManagerPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<"high-risk" | "no-msds" | "all">("high-risk");
  const [hazardCodeFilter, setHazardCodeFilter] = useState<string>("");

  // 안전 제품 조회
  const { data: safetyData, isLoading } = useQuery({
    queryKey: ["safety-products", filterType, hazardCodeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("filterType", filterType === "all" ? "" : filterType);
      if (hazardCodeFilter) {
        params.append("hazardCode", hazardCodeFilter);
      }

      const response = await fetch(`/api/products/safety?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch safety products");
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const products = safetyData?.products || [];
  const total = safetyData?.total || 0;

  // 위험 코드 목록 (일반적인 위험 코드)
  const commonHazardCodes = [
    "H300", "H301", "H302", "H310", "H311", "H314", "H315", "H317", "H318",
    "H330", "H331", "H332", "H334", "H335", "H336", "H340", "H341", "H350",
    "H351", "H360", "H361", "H370", "H371", "H372", "H373",
  ];

  const handleExport = () => {
    if (products.length === 0) {
      toast({
        title: "내보낼 데이터 없음",
        description: "내보낼 제품이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // CSV 형식으로 내보내기
    const headers = ["제품명", "카탈로그 번호", "위험 코드", "피크토그램", "MSDS URL", "보관 조건"];
    const rows = products.map((product: any) => [
      product.name,
      product.catalogNumber || "",
      (product.hazardCodes || []).join(", "),
      (product.pictograms || []).join(", "),
      product.msdsUrl || "없음",
      product.storageCondition || "",
    ]);

    const csv = [headers, ...rows]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `안전_제품_리스트_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-24">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            {/* 헤더 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Shield className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
                  </div>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900">
                    안전 관리
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-slate-600">
                  고위험 물질, MSDS 없는 품목, 규제 코드 포함 물질을 확인하고 관리합니다.
                </p>
              </div>
              <Button onClick={handleExport} variant="outline" size="sm" className="text-xs md:text-sm">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                CSV 내보내기
              </Button>
            </div>

            {/* 필터 및 통계 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">필터</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-xs md:text-sm font-medium mb-2 block">필터 타입</label>
                    <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                      <SelectTrigger className="text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high-risk">고위험군 (발암성, 독성, 인화성 등)</SelectItem>
                        <SelectItem value="no-msds">MSDS/SDS 없는 품목</SelectItem>
                        <SelectItem value="all">모든 안전 정보 포함 제품</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filterType === "all" && (
                    <div>
                      <label className="text-xs md:text-sm font-medium mb-2 block">위험 코드</label>
                      <Select value={hazardCodeFilter} onValueChange={setHazardCodeFilter}>
                        <SelectTrigger className="text-xs md:text-sm">
                          <SelectValue placeholder="위험 코드 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">전체</SelectItem>
                          {commonHazardCodes.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>총 {total}개 제품이 검색되었습니다.</span>
                </div>
              </CardContent>
            </Card>

            {/* 제품 리스트 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm md:text-base">제품 리스트</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  안전 정보가 포함된 제품 목록입니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs md:text-sm">
                    검색된 제품이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs md:text-sm">제품명</TableHead>
                          <TableHead className="text-xs md:text-sm">카탈로그 번호</TableHead>
                          <TableHead className="text-xs md:text-sm">위험 코드</TableHead>
                          <TableHead className="text-xs md:text-sm">피크토그램</TableHead>
                          <TableHead className="text-xs md:text-sm">MSDS</TableHead>
                          <TableHead className="text-xs md:text-sm">보관 조건</TableHead>
                            <TableHead className="text-xs md:text-sm">액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: any) => {
                          const safetyLevel = getProductSafetyLevel(product);
                          return (
                          <TableRow key={product.id} className={safetyLevel.bgColor}>
                            <TableCell className="text-xs md:text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/products/${product.id}`}
                                  className="hover:underline"
                                >
                                  {product.name}
                                </Link>
                                <Badge
                                  variant="outline"
                                  className={`${safetyLevel.color} ${safetyLevel.borderColor} text-[9px]`}
                                >
                                  {safetyLevel.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm font-mono">
                              {product.catalogNumber || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(product.hazardCodes || []).map((code: string, idx: number) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="bg-red-50 text-red-700 border-red-200 text-[10px]"
                                  >
                                    {code}
                                  </Badge>
                                ))}
                                {(!product.hazardCodes || product.hazardCodes.length === 0) && (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(product.pictograms || []).map((pictogram: string, idx: number) => {
                                  const pictogramLabels: Record<string, string> = {
                                    corrosive: "부식성",
                                    exclamation: "경고",
                                    flame: "인화성",
                                    skull: "독성",
                                    health: "건강 위험",
                                    environment: "환경 위험",
                                    explosive: "폭발성",
                                    oxidizer: "산화성",
                                  };
                                  return (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]"
                                    >
                                      {pictogramLabels[pictogram] || pictogram}
                                    </Badge>
                                  );
                                })}
                                {(!product.pictograms || product.pictograms.length === 0) && (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {product.msdsUrl ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                  있음
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                  없음
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                              {product.storageCondition || "-"}
                            </TableCell>
                            <TableCell>
                              <Link href={`/products/${product.id}`}>
                                <Button variant="ghost" size="sm" className="text-xs h-7">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  보기
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
      </div>
    </div>
  );
}

