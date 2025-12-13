"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { PriceDisplay } from "@/components/products/price-display";
import Link from "next/link";

interface SharedListViewProps {
  publicId: string;
}

export function SharedListView({ publicId }: SharedListViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-list", publicId],
    queryFn: async () => {
      const response = await fetch(`/api/shared-lists/${publicId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("공유 링크를 찾을 수 없습니다.");
        }
        if (response.status === 410) {
          throw new Error("이 공유 링크는 만료되었거나 비활성화되었습니다.");
        }
        throw new Error("공유 링크를 불러오는데 실패했습니다.");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>오류</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const snapshot = data.snapshot as any;
  const items = snapshot?.items || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-4 md:mb-6 space-y-2">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold truncate">{data.title || snapshot?.title}</h1>
              {data.description && (
                <p className="text-xs md:text-sm text-muted-foreground mt-1 break-words">{data.description}</p>
              )}
            </div>
            <Link
              href="/"
              className="text-xs md:text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3 md:h-4 md:w-4" />
              BioInsight Lab
            </Link>
          </div>

          {snapshot?.createdBy && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>작성자: {snapshot.createdBy.name || snapshot.createdBy.email}</span>
              {snapshot.createdAt && (
                <span>
                  생성일: {new Date(snapshot.createdAt).toLocaleDateString("ko-KR")}
                </span>
              )}
              <span>조회 수: {data.viewCount}</span>
            </div>
          )}
        </div>

        {/* 비교 정보 요약 */}
        {snapshot?.comparisonSummary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>비교 정보 요약</CardTitle>
              <CardDescription>
                {snapshot.comparisonSummary.hasAlternatives
                  ? "대체 후보 및 다른 벤더 가격 정보가 포함된 품목이 있습니다."
                  : "품목 리스트 요약 정보입니다."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">총 품목</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {snapshot.comparisonSummary.totalItems}개
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">총 금액</div>
                  <div className="text-lg font-semibold text-slate-900">
                    ₩{snapshot.comparisonSummary.totalAmount?.toLocaleString() || 0}
                  </div>
                </div>
                {snapshot.comparisonSummary.vendors && snapshot.comparisonSummary.vendors.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">포함된 벤더</div>
                    <div className="text-sm font-medium text-slate-900">
                      {snapshot.comparisonSummary.vendors.length}개
                    </div>
                    <div className="text-xs text-slate-600 mt-1 truncate">
                      {snapshot.comparisonSummary.vendors.join(", ")}
                    </div>
                  </div>
                )}
              </div>
              {snapshot.comparisonSummary.hasAlternatives && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-xs text-blue-800">
                      💡 이 리스트에는 대체 후보 제품 및 다른 벤더 가격 정보가 포함되어 있습니다. 아래 "대체 후보 및 비교 정보" 섹션에서 확인하세요.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 품목 리스트 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>품목 리스트</CardTitle>
            <CardDescription>
              총 {items.length}개 품목
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                품목이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No.</TableHead>
                      <TableHead>제품명</TableHead>
                      <TableHead>벤더</TableHead>
                      <TableHead>카탈로그 번호</TableHead>
                      <TableHead>규격/용량</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.lineNumber || index + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            {item.productBrand && (
                              <div className="text-xs text-muted-foreground">
                                {item.productBrand}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.vendorName || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {item.catalogNumber || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.specification || "-"}
                        </TableCell>
                        <TableCell>
                          {item.grade ? (
                            <Badge variant="outline" className="text-xs">
                              {item.grade}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unitPrice ? (
                            <PriceDisplay
                              price={item.unitPrice}
                              currency={item.currency || "KRW"}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.lineTotal ? (
                            <PriceDisplay
                              price={item.lineTotal}
                              currency={item.currency || "KRW"}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {item.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 대체 후보 정보 */}
        {items.some((item: any) => 
          (item.alternativeVendors && item.alternativeVendors.length > 0) ||
          (item.alternativeProducts && item.alternativeProducts.length > 0)
        ) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>대체 후보 및 비교 정보</CardTitle>
              <CardDescription>
                각 품목에 대한 대체 벤더 및 대체 제품 정보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item: any, index: number) => {
                  const hasAlternatives = 
                    (item.alternativeVendors && item.alternativeVendors.length > 0) ||
                    (item.alternativeProducts && item.alternativeProducts.length > 0);
                  
                  if (!hasAlternatives) return null;

                  return (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="font-semibold text-sm">
                        {item.lineNumber || index + 1}. {item.productName}
                      </div>
                      
                      {/* 다른 벤더 가격 */}
                      {item.alternativeVendors && item.alternativeVendors.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            다른 벤더 가격:
                          </div>
                          <div className="space-y-1">
                            {item.alternativeVendors.map((alt: any, idx: number) => (
                              <div key={idx} className="text-xs flex items-center justify-between">
                                <span>{alt.vendorName}</span>
                                <span className="font-medium">
                                  ₩{alt.price?.toLocaleString() || 0} ({alt.currency || "KRW"})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 대체 제품 */}
                      {item.alternativeProducts && item.alternativeProducts.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            대체 제품 후보:
                          </div>
                          <div className="space-y-2">
                            {item.alternativeProducts.map((alt: any, idx: number) => (
                              <div key={idx} className="text-xs p-2 bg-slate-50 rounded">
                                <div className="font-medium">{alt.productName}</div>
                                {alt.productBrand && (
                                  <div className="text-muted-foreground">{alt.productBrand}</div>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-muted-foreground">
                                    ₩{alt.price?.toLocaleString() || 0} ({alt.currency || "KRW"})
                                  </span>
                                  {alt.reason && (
                                    <span className="text-muted-foreground text-[10px]">
                                      추천 이유: {alt.reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 푸터 */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Powered by BioInsight Lab</p>
        </div>
      </div>
    </div>
  );
}