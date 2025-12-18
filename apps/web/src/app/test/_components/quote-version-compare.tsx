"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GitCompare, Save, Plus, Minus, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface QuoteVersion {
  id: string;
  title: string;
  version: number;
  isSnapshot: boolean;
  snapshotNote?: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    lineNumber: number;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    notes: string | null;
    product: {
      id: string;
      name: string;
      catalogNumber: string | null;
      brand: string | null;
      category: string;
    };
  }>;
}

interface QuoteVersionCompareProps {
  quoteId: string;
  onVersionCreated?: () => void;
}

export function QuoteVersionCompare({ quoteId, onVersionCreated }: QuoteVersionCompareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [snapshotNote, setSnapshotNote] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 버전 목록 조회
  const { data: versionsData, isLoading } = useQuery({
    queryKey: ["quote-versions", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json() as Promise<{ versions: QuoteVersion[] }>;
    },
    enabled: isOpen && !!quoteId,
  });

  const versions = versionsData?.versions || [];

  // 버전 생성 (스냅샷)
  const createVersionMutation = useMutation({
    mutationFn: async (note: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotNote: note }),
      });
      if (!response.ok) throw new Error("Failed to create version");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-versions", quoteId] });
      setSnapshotNote("");
      setIsCreatingSnapshot(false);
      toast({
        title: "버전 저장 완료",
        description: "리스트 버전이 저장되었습니다.",
      });
      onVersionCreated?.();
    },
    onError: () => {
      toast({
        title: "오류",
        description: "버전 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSnapshot = () => {
    if (!snapshotNote.trim()) {
      toast({
        title: "메모 필요",
        description: "스냅샷 메모를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    createVersionMutation.mutate(snapshotNote);
  };

  const version1 = versions.find((v) => v.id === selectedVersion1);
  const version2 = versions.find((v) => v.id === selectedVersion2);

  // 비교 데이터 생성
  const comparisonData = useMemo(() => {
    if (!version1 || !version2) return null;

    const items1 = version1.items || [];
    const items2 = version2.items || [];

    // 모든 제품 ID 수집
    const allProductIds = new Set([
      ...items1.map((item) => item.productId),
      ...items2.map((item) => item.productId),
    ]);

    const comparison: Array<{
      productId: string;
      productName: string;
      catalogNumber: string | null;
      brand: string | null;
      v1: {
        quantity: number;
        unitPrice: number | null;
        lineTotal: number | null;
        notes: string | null;
      } | null;
      v2: {
        quantity: number;
        unitPrice: number | null;
        lineTotal: number | null;
        notes: string | null;
      } | null;
      changes: {
        quantity: boolean;
        price: boolean;
        notes: boolean;
        added: boolean;
        removed: boolean;
      };
    }> = [];

    allProductIds.forEach((productId) => {
      const item1 = items1.find((item) => item.productId === productId);
      const item2 = items2.find((item) => item.productId === productId);

      const product = item1?.product || item2?.product;

      const changes = {
        quantity: item1?.quantity !== item2?.quantity,
        price: item1?.unitPrice !== item2?.unitPrice,
        notes: item1?.notes !== item2?.notes,
        added: !item1 && !!item2,
        removed: !!item1 && !item2,
      };

      comparison.push({
        productId: productId,
        productName: product?.name || "알 수 없음",
        catalogNumber: product?.catalogNumber || null,
        brand: product?.brand || null,
        v1: item1
          ? {
              quantity: item1.quantity,
              unitPrice: item1.unitPrice,
              lineTotal: item1.lineTotal,
              notes: item1.notes,
            }
          : null,
        v2: item2
          ? {
              quantity: item2.quantity,
              unitPrice: item2.unitPrice,
              lineTotal: item2.lineTotal,
              notes: item2.notes,
            }
          : null,
        changes,
      });
    });

    return comparison;
  }, [version1, version2]);

  const hasChanges = comparisonData?.some((item) =>
    Object.values(item.changes).some((changed) => changed)
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitCompare className="h-4 w-4" />
          버전 비교
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>리스트 버전 비교</DialogTitle>
          <DialogDescription>
            리스트의 버전을 비교하거나 새 버전을 저장할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 버전 저장 섹션 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">새 버전 저장</CardTitle>
              <CardDescription>현재 리스트 상태를 스냅샷으로 저장합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="snapshot-note">스냅샷 메모</Label>
                <Textarea
                  id="snapshot-note"
                  placeholder="예: RFQ 발송 전, 벤더 A 회신 후, 최종 확정 등"
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  rows={2}
                />
              </div>
              <Button
                onClick={handleCreateSnapshot}
                disabled={createVersionMutation.isPending || !snapshotNote.trim()}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                버전 저장
              </Button>
            </CardContent>
          </Card>

          {/* 버전 선택 및 비교 */}
          {versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">버전 비교</CardTitle>
                <CardDescription>두 버전을 선택하여 차이점을 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>버전 1</Label>
                    <Select
                      value={selectedVersion1 || ""}
                      onValueChange={setSelectedVersion1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="버전 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            v{version.version} - {format(new Date(version.createdAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                            {version.snapshotNote && ` (${version.snapshotNote})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>버전 2</Label>
                    <Select
                      value={selectedVersion2 || ""}
                      onValueChange={setSelectedVersion2}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="버전 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            v{version.version} - {format(new Date(version.createdAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                            {version.snapshotNote && ` (${version.snapshotNote})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 비교 결과 테이블 */}
                {version1 && version2 && comparisonData && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{version1.version}</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">v{version2.version}</Badge>
                      </div>
                      {hasChanges && (
                        <Badge variant="secondary">
                          {comparisonData.filter((item) =>
                            Object.values(item.changes).some((changed) => changed)
                          ).length}개 변경사항
                        </Badge>
                      )}
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">제품명</TableHead>
                            <TableHead className="w-[100px]">v{version1.version}</TableHead>
                            <TableHead className="w-[100px]">v{version2.version}</TableHead>
                            <TableHead className="w-[150px]">변경사항</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparisonData.map((item) => {
                            const hasChange = Object.values(item.changes).some((changed) => changed);
                            return (
                              <TableRow
                                key={item.productId}
                                className={hasChange ? "bg-yellow-50" : ""}
                              >
                                <TableCell>
                                  <div className="font-medium">{item.productName}</div>
                                  {item.catalogNumber && (
                                    <div className="text-xs text-slate-500">
                                      {item.catalogNumber}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.v1 ? (
                                    <div className="space-y-1">
                                      <div>수량: {item.v1.quantity}</div>
                                      <div>
                                        단가:{" "}
                                        {item.v1.unitPrice
                                          ? `₩${item.v1.unitPrice.toLocaleString()}`
                                          : "-"}
                                      </div>
                                      <div>
                                        합계:{" "}
                                        {item.v1.lineTotal
                                          ? `₩${item.v1.lineTotal.toLocaleString()}`
                                          : "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.v2 ? (
                                    <div className="space-y-1">
                                      <div>수량: {item.v2.quantity}</div>
                                      <div>
                                        단가:{" "}
                                        {item.v2.unitPrice
                                          ? `₩${item.v2.unitPrice.toLocaleString()}`
                                          : "-"}
                                      </div>
                                      <div>
                                        합계:{" "}
                                        {item.v2.lineTotal
                                          ? `₩${item.v2.lineTotal.toLocaleString()}`
                                          : "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {item.changes.added && (
                                      <Badge variant="default" className="bg-green-500">
                                        추가됨
                                      </Badge>
                                    )}
                                    {item.changes.removed && (
                                      <Badge variant="destructive">제거됨</Badge>
                                    )}
                                    {item.changes.quantity && (
                                      <Badge variant="outline">수량 변경</Badge>
                                    )}
                                    {item.changes.price && (
                                      <Badge variant="outline">가격 변경</Badge>
                                    )}
                                    {item.changes.notes && (
                                      <Badge variant="outline">비고 변경</Badge>
                                    )}
                                    {!hasChange && (
                                      <span className="text-xs text-slate-400">변경 없음</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="text-center py-8 text-slate-500">버전 목록을 불러오는 중...</div>
          )}

          {!isLoading && versions.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              저장된 버전이 없습니다. 새 버전을 저장해주세요.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


