"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MainHeader } from "@/app/_components/main-header";
import {
  Brain,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Edit2,
  Trash2,
  Plus,
  Search,
  DollarSign,
  Package,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExtractedReagent {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  estimatedUsage?: number;
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
}

interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
}

interface ProductMatch {
  productId: string;
  productName: string;
  vendorName: string;
  price: number;
  currency: string;
}

interface ReagentWithMatch extends ExtractedReagent {
  id: string;
  matchedProduct?: ProductMatch;
  isMatching?: boolean;
}

export default function ProtocolBOMPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [protocolText, setProtocolText] = useState("");
  const [extractionResult, setExtractionResult] = useState<ProtocolExtractionResult | null>(null);
  const [reagents, setReagents] = useState<ReagentWithMatch[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [experimentRounds, setExperimentRounds] = useState(1);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [editingReagentId, setEditingReagentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 프로토콜 텍스트에서 시약 추출
  const extractMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "시약 추출에 실패했습니다.");
      }
      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractionResult(data);
      // reagents를 id를 가진 형태로 변환
      const reagentsWithId: ReagentWithMatch[] = data.reagents.map((r, idx) => ({
        ...r,
        id: `reagent-${idx}-${Date.now()}`,
      }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) {
        setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      }
      toast({
        title: "시약 추출 완료",
        description: `${data.reagents.length}개 항목이 추출되었습니다.`,
      });
      // 제품 매칭 시도
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => {
      toast({
        title: "시약 추출 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 각 시약에 대해 제품 검색 (미리보기)
  const matchProductsForReagents = async (reagentsToMatch: ReagentWithMatch[]) => {
    const updatedReagents = await Promise.all(
      reagentsToMatch.map(async (reagent) => {
        try {
          const response = await fetch(
            `/api/products/search?query=${encodeURIComponent(reagent.name)}&limit=1${
              reagent.category ? `&category=${reagent.category}` : ""
            }`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.products && data.products.length > 0) {
              const product = data.products[0];
              const vendor = product.vendors?.[0];
              return {
                ...reagent,
                matchedProduct: vendor
                  ? {
                      productId: product.id,
                      productName: product.name,
                      vendorName: vendor.vendor.name,
                      price: vendor.priceInKRW || 0,
                      currency: vendor.currency || "KRW",
                    }
                  : undefined,
                isMatching: true,
              };
            }
          }
        } catch (error) {
          console.error(`Failed to match product for ${reagent.name}:`, error);
        }
        return { ...reagent, isMatching: false };
      })
    );
    setReagents(updatedReagents);
  };

  // 시약 편집
  const handleEditReagent = (id: string, updates: Partial<ExtractedReagent>) => {
    setReagents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    setEditingReagentId(null);
  };

  // 시약 삭제
  const handleDeleteReagent = (id: string) => {
    setReagents((prev) => prev.filter((r) => r.id !== id));
    toast({
      title: "항목 삭제",
      description: "시약이 삭제되었습니다.",
    });
  };

  // 시약 추가
  const handleAddReagent = () => {
    const newReagent: ReagentWithMatch = {
      id: `reagent-new-${Date.now()}`,
      name: "",
      category: "REAGENT",
      quantity: "1",
      unit: "",
    };
    setReagents((prev) => [...prev, newReagent]);
    setEditingReagentId(newReagent.id);
  };

  // 예상 총액 계산
  const estimatedTotal = useMemo(() => {
    return reagents.reduce((sum, reagent) => {
      if (reagent.matchedProduct) {
        const quantity = reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
        const totalQuantity = Math.ceil(quantity * experimentRounds);
        return sum + reagent.matchedProduct.price * totalQuantity;
      }
      return sum;
    }, 0);
  }, [reagents, experimentRounds]);

  // 매칭된/매칭 안된 항목 수
  const matchedCount = reagents.filter((r) => r.matchedProduct).length;
  const unmatchedCount = reagents.length - matchedCount;

  // 카테고리별 필터링
  const filteredReagents = useMemo(() => {
    if (categoryFilter === "all") return reagents;
    return reagents.filter((r) => r.category === categoryFilter);
  }, [reagents, categoryFilter]);

  // 카테고리별 그룹핑
  const groupedReagents = useMemo(() => {
    const groups: Record<string, ReagentWithMatch[]> = {
      REAGENT: [],
      TOOL: [],
      EQUIPMENT: [],
      기타: [],
    };
    filteredReagents.forEach((r) => {
      const key = r.category || "기타";
      if (groups[key]) {
        groups[key].push(r);
      } else {
        groups["기타"].push(r);
      }
    });
    return groups;
  }, [filteredReagents]);

  // BOM 생성
  const bomMutation = useMutation({
    mutationFn: async () => {
      if (!bomTitle.trim()) {
        throw new Error("BOM 제목을 입력해주세요.");
      }
      if (reagents.length === 0) {
        throw new Error("최소 1개 이상의 시약이 필요합니다.");
      }

      const response = await fetch("/api/protocol/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bomTitle,
          reagents: reagents.map((r) => ({
            name: r.name,
            quantity: r.quantity,
            unit: r.unit,
            estimatedUsage: r.estimatedUsage,
            category: r.category,
            description: r.description,
          })),
          experimentRounds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "BOM 생성에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "BOM 생성 완료",
        description: data.message || "BOM이 성공적으로 생성되었습니다.",
      });
      setIsConfirmDialogOpen(false);
      router.push(`/test/quote`);
    },
    onError: (error: Error) => {
      toast({
        title: "BOM 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExtract = () => {
    if (!protocolText.trim()) {
      toast({
        title: "프로토콜 텍스트를 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    extractMutation.mutate(protocolText);
  };

  const handleCreateBOM = () => {
    if (!bomTitle.trim()) {
      toast({
        title: "BOM 제목을 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    if (reagents.length === 0) {
      toast({
        title: "시약이 없습니다",
        description: "최소 1개 이상의 시약이 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmCreateBOM = () => {
    bomMutation.mutate();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/protocol/bom");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Protocol → BOM 생성</h1>
          <p className="text-muted-foreground mt-2">
            실험 프로토콜 텍스트를 입력하면 필요한 시약/기구/장비를 자동으로 추출하고 BOM을 생성합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          {/* 좌측: 프로토콜 입력 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                프로토콜 텍스트 입력
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                PDF에서 복사한 프로토콜 텍스트를 붙여넣으세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="protocol-text" className="text-xs font-medium">
                  프로토콜 텍스트
                </Label>
                <Textarea
                  id="protocol-text"
                  value={protocolText}
                  onChange={(e) => setProtocolText(e.target.value)}
                  placeholder="프로토콜 또는 실험 절차 텍스트를 붙여넣으세요..."
                  rows={12}
                  className="text-sm font-mono"
                />
              </div>
              <Button
                onClick={handleExtract}
                disabled={!protocolText.trim() || extractMutation.isPending}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    시약 추출 실행
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 우측: 추출 결과 및 BOM 설정 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  추출 결과 및 BOM 설정
                </CardTitle>
                {reagents.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleAddReagent} className="text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    시약 추가
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extractionResult ? (
                <>
                  {/* 프로토콜 요약 */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {extractionResult.experimentType && (
                        <Badge variant="outline">{extractionResult.experimentType}</Badge>
                      )}
                      {extractionResult.sampleType && (
                        <Badge variant="outline">{extractionResult.sampleType}</Badge>
                      )}
                    </div>
                    {extractionResult.summary && (
                      <p className="text-xs text-slate-600 mt-2">{extractionResult.summary}</p>
                    )}
                  </div>

                  {/* 통계 및 필터 */}
                  {reagents.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-700">총 {reagents.length}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-slate-700">매칭 {matchedCount}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span className="text-slate-700">미매칭 {unmatchedCount}개</span>
                        </div>
                        {estimatedTotal > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-slate-500" />
                            <span className="text-slate-700 font-semibold">
                              예상 총액: ₩{estimatedTotal.toLocaleString("ko-KR")}
                            </span>
                          </div>
                        )}
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="REAGENT">시약</SelectItem>
                          <SelectItem value="TOOL">기구</SelectItem>
                          <SelectItem value="EQUIPMENT">장비</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 추출된 시약 리스트 */}
                  {reagents.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(groupedReagents).map(
                        ([category, categoryReagents]) =>
                          categoryReagents.length > 0 && (
                            <div key={category} className="space-y-2">
                              <Label className="text-xs font-semibold text-slate-700">
                                {category === "REAGENT" && "시약"}
                                {category === "TOOL" && "기구"}
                                {category === "EQUIPMENT" && "장비"}
                                {category === "기타" && "기타"} ({categoryReagents.length}개)
                              </Label>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-8">
                                      <TableHead className="w-12 text-[10px]">No.</TableHead>
                                      <TableHead className="text-[10px]">이름</TableHead>
                                      <TableHead className="w-20 text-[10px]">수량</TableHead>
                                      <TableHead className="w-32 text-[10px]">매칭 제품</TableHead>
                                      <TableHead className="w-24 text-right text-[10px]">예상 금액</TableHead>
                                      <TableHead className="w-16 text-[10px]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {categoryReagents.map((reagent, idx) => {
                                      const quantity =
                                        reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
                                      const totalQuantity = Math.ceil(quantity * experimentRounds);
                                      const estimatedAmount = reagent.matchedProduct
                                        ? reagent.matchedProduct.price * totalQuantity
                                        : 0;

                                      return (
                                        <TableRow key={reagent.id} className="h-10">
                                          <TableCell className="text-[11px]">{idx + 1}</TableCell>
                                          <TableCell className="text-[11px]">
                                            {editingReagentId === reagent.id ? (
                                              <div className="space-y-1">
                                                <Input
                                                  value={reagent.name}
                                                  onChange={(e) =>
                                                    handleEditReagent(reagent.id, { name: e.target.value })
                                                  }
                                                  className="h-6 text-xs"
                                                  onBlur={() => setEditingReagentId(null)}
                                                  autoFocus
                                                />
                                                <div className="flex gap-1">
                                                  <Input
                                                    value={reagent.quantity || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, {
                                                        quantity: e.target.value,
                                                      })
                                                    }
                                                    placeholder="수량"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Input
                                                    value={reagent.unit || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, { unit: e.target.value })
                                                    }
                                                    placeholder="단위"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Select
                                                    value={reagent.category || "REAGENT"}
                                                    onValueChange={(value: any) =>
                                                      handleEditReagent(reagent.id, { category: value })
                                                    }
                                                  >
                                                    <SelectTrigger className="h-5 text-xs w-20">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="REAGENT">시약</SelectItem>
                                                      <SelectItem value="TOOL">기구</SelectItem>
                                                      <SelectItem value="EQUIPMENT">장비</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="max-w-[200px]">
                                                <div className="truncate" title={reagent.name}>
                                                  {reagent.name}
                                                </div>
                                                {reagent.description && (
                                                  <div className="text-[10px] text-slate-500 truncate">
                                                    {reagent.description}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {totalQuantity}
                                            {reagent.unit && ` ${reagent.unit}`}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {reagent.matchedProduct ? (
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                  <span className="truncate max-w-[120px]" title={reagent.matchedProduct.productName}>
                                                    {reagent.matchedProduct.productName}
                                                  </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                  {reagent.matchedProduct.vendorName} · ₩
                                                  {reagent.matchedProduct.price.toLocaleString("ko-KR")}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 text-amber-600">
                                                <AlertCircle className="h-3 w-3" />
                                                <span className="text-[10px]">미매칭</span>
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right text-[11px] font-medium">
                                            {estimatedAmount > 0 ? (
                                              `₩${estimatedAmount.toLocaleString("ko-KR")}`
                                            ) : (
                                              <span className="text-slate-400">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                  <Edit2 className="h-3 w-3" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingReagentId(reagent.id)}>
                                                  <Edit2 className="h-3 w-3 mr-2" />
                                                  편집
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => handleDeleteReagent(reagent.id)}
                                                  className="text-destructive"
                                                >
                                                  <Trash2 className="h-3 w-3 mr-2" />
                                                  삭제
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      추출된 시약이 없습니다.
                    </div>
                  )}

                  {/* BOM 설정 */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bom-title" className="text-xs font-medium">
                        BOM 제목
                      </Label>
                      <Input
                        id="bom-title"
                        value={bomTitle}
                        onChange={(e) => setBomTitle(e.target.value)}
                        placeholder="예: ELISA 프로토콜 BOM"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experiment-rounds" className="text-xs font-medium">
                        실험 횟수
                      </Label>
                      <Input
                        id="experiment-rounds"
                        type="number"
                        min="1"
                        value={experimentRounds}
                        onChange={(e) => setExperimentRounds(parseInt(e.target.value) || 1)}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-slate-500">
                        수량은 실험 횟수에 따라 자동으로 계산됩니다. (현재: {experimentRounds}회)
                      </p>
                    </div>
                    <Button
                      onClick={handleCreateBOM}
                      disabled={!bomTitle.trim() || reagents.length === 0 || bomMutation.isPending}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {bomMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          BOM 생성 및 품목 리스트로 변환
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  프로토콜 텍스트를 입력하고 "시약 추출 실행"을 클릭해주세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 확인 다이얼로그 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>BOM 생성 확인</DialogTitle>
              <DialogDescription>
                추출된 {reagents.length}개 항목으로 BOM을 생성하고 품목 리스트로 변환합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">매칭된 항목</span>
                <span className="font-semibold text-green-600">{matchedCount}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">미매칭 항목</span>
                <span className="font-semibold text-amber-600">{unmatchedCount}개</span>
              </div>
              {estimatedTotal > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-slate-600">예상 총액</span>
                  <span className="font-bold text-slate-900">₩{estimatedTotal.toLocaleString("ko-KR")}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleConfirmCreateBOM} disabled={bomMutation.isPending}>
                {bomMutation.isPending ? "생성 중..." : "생성하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MainHeader } from "@/app/_components/main-header";
import {
  Brain,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Edit2,
  Trash2,
  Plus,
  Search,
  DollarSign,
  Package,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExtractedReagent {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  estimatedUsage?: number;
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
}

interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
}

interface ProductMatch {
  productId: string;
  productName: string;
  vendorName: string;
  price: number;
  currency: string;
}

interface ReagentWithMatch extends ExtractedReagent {
  id: string;
  matchedProduct?: ProductMatch;
  isMatching?: boolean;
}

export default function ProtocolBOMPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [protocolText, setProtocolText] = useState("");
  const [extractionResult, setExtractionResult] = useState<ProtocolExtractionResult | null>(null);
  const [reagents, setReagents] = useState<ReagentWithMatch[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [experimentRounds, setExperimentRounds] = useState(1);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [editingReagentId, setEditingReagentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 프로토콜 텍스트에서 시약 추출
  const extractMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "시약 추출에 실패했습니다.");
      }
      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractionResult(data);
      // reagents를 id를 가진 형태로 변환
      const reagentsWithId: ReagentWithMatch[] = data.reagents.map((r, idx) => ({
        ...r,
        id: `reagent-${idx}-${Date.now()}`,
      }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) {
        setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      }
      toast({
        title: "시약 추출 완료",
        description: `${data.reagents.length}개 항목이 추출되었습니다.`,
      });
      // 제품 매칭 시도
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => {
      toast({
        title: "시약 추출 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 각 시약에 대해 제품 검색 (미리보기)
  const matchProductsForReagents = async (reagentsToMatch: ReagentWithMatch[]) => {
    const updatedReagents = await Promise.all(
      reagentsToMatch.map(async (reagent) => {
        try {
          const response = await fetch(
            `/api/products/search?query=${encodeURIComponent(reagent.name)}&limit=1${
              reagent.category ? `&category=${reagent.category}` : ""
            }`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.products && data.products.length > 0) {
              const product = data.products[0];
              const vendor = product.vendors?.[0];
              return {
                ...reagent,
                matchedProduct: vendor
                  ? {
                      productId: product.id,
                      productName: product.name,
                      vendorName: vendor.vendor.name,
                      price: vendor.priceInKRW || 0,
                      currency: vendor.currency || "KRW",
                    }
                  : undefined,
                isMatching: true,
              };
            }
          }
        } catch (error) {
          console.error(`Failed to match product for ${reagent.name}:`, error);
        }
        return { ...reagent, isMatching: false };
      })
    );
    setReagents(updatedReagents);
  };

  // 시약 편집
  const handleEditReagent = (id: string, updates: Partial<ExtractedReagent>) => {
    setReagents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    setEditingReagentId(null);
  };

  // 시약 삭제
  const handleDeleteReagent = (id: string) => {
    setReagents((prev) => prev.filter((r) => r.id !== id));
    toast({
      title: "항목 삭제",
      description: "시약이 삭제되었습니다.",
    });
  };

  // 시약 추가
  const handleAddReagent = () => {
    const newReagent: ReagentWithMatch = {
      id: `reagent-new-${Date.now()}`,
      name: "",
      category: "REAGENT",
      quantity: "1",
      unit: "",
    };
    setReagents((prev) => [...prev, newReagent]);
    setEditingReagentId(newReagent.id);
  };

  // 예상 총액 계산
  const estimatedTotal = useMemo(() => {
    return reagents.reduce((sum, reagent) => {
      if (reagent.matchedProduct) {
        const quantity = reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
        const totalQuantity = Math.ceil(quantity * experimentRounds);
        return sum + reagent.matchedProduct.price * totalQuantity;
      }
      return sum;
    }, 0);
  }, [reagents, experimentRounds]);

  // 매칭된/매칭 안된 항목 수
  const matchedCount = reagents.filter((r) => r.matchedProduct).length;
  const unmatchedCount = reagents.length - matchedCount;

  // 카테고리별 필터링
  const filteredReagents = useMemo(() => {
    if (categoryFilter === "all") return reagents;
    return reagents.filter((r) => r.category === categoryFilter);
  }, [reagents, categoryFilter]);

  // 카테고리별 그룹핑
  const groupedReagents = useMemo(() => {
    const groups: Record<string, ReagentWithMatch[]> = {
      REAGENT: [],
      TOOL: [],
      EQUIPMENT: [],
      기타: [],
    };
    filteredReagents.forEach((r) => {
      const key = r.category || "기타";
      if (groups[key]) {
        groups[key].push(r);
      } else {
        groups["기타"].push(r);
      }
    });
    return groups;
  }, [filteredReagents]);

  // BOM 생성
  const bomMutation = useMutation({
    mutationFn: async () => {
      if (!bomTitle.trim()) {
        throw new Error("BOM 제목을 입력해주세요.");
      }
      if (reagents.length === 0) {
        throw new Error("최소 1개 이상의 시약이 필요합니다.");
      }

      const response = await fetch("/api/protocol/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bomTitle,
          reagents: reagents.map((r) => ({
            name: r.name,
            quantity: r.quantity,
            unit: r.unit,
            estimatedUsage: r.estimatedUsage,
            category: r.category,
            description: r.description,
          })),
          experimentRounds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "BOM 생성에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "BOM 생성 완료",
        description: data.message || "BOM이 성공적으로 생성되었습니다.",
      });
      setIsConfirmDialogOpen(false);
      router.push(`/test/quote`);
    },
    onError: (error: Error) => {
      toast({
        title: "BOM 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExtract = () => {
    if (!protocolText.trim()) {
      toast({
        title: "프로토콜 텍스트를 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    extractMutation.mutate(protocolText);
  };

  const handleCreateBOM = () => {
    if (!bomTitle.trim()) {
      toast({
        title: "BOM 제목을 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    if (reagents.length === 0) {
      toast({
        title: "시약이 없습니다",
        description: "최소 1개 이상의 시약이 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmCreateBOM = () => {
    bomMutation.mutate();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/protocol/bom");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Protocol → BOM 생성</h1>
          <p className="text-muted-foreground mt-2">
            실험 프로토콜 텍스트를 입력하면 필요한 시약/기구/장비를 자동으로 추출하고 BOM을 생성합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          {/* 좌측: 프로토콜 입력 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                프로토콜 텍스트 입력
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                PDF에서 복사한 프로토콜 텍스트를 붙여넣으세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="protocol-text" className="text-xs font-medium">
                  프로토콜 텍스트
                </Label>
                <Textarea
                  id="protocol-text"
                  value={protocolText}
                  onChange={(e) => setProtocolText(e.target.value)}
                  placeholder="프로토콜 또는 실험 절차 텍스트를 붙여넣으세요..."
                  rows={12}
                  className="text-sm font-mono"
                />
              </div>
              <Button
                onClick={handleExtract}
                disabled={!protocolText.trim() || extractMutation.isPending}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    시약 추출 실행
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 우측: 추출 결과 및 BOM 설정 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  추출 결과 및 BOM 설정
                </CardTitle>
                {reagents.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleAddReagent} className="text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    시약 추가
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extractionResult ? (
                <>
                  {/* 프로토콜 요약 */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {extractionResult.experimentType && (
                        <Badge variant="outline">{extractionResult.experimentType}</Badge>
                      )}
                      {extractionResult.sampleType && (
                        <Badge variant="outline">{extractionResult.sampleType}</Badge>
                      )}
                    </div>
                    {extractionResult.summary && (
                      <p className="text-xs text-slate-600 mt-2">{extractionResult.summary}</p>
                    )}
                  </div>

                  {/* 통계 및 필터 */}
                  {reagents.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-700">총 {reagents.length}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-slate-700">매칭 {matchedCount}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span className="text-slate-700">미매칭 {unmatchedCount}개</span>
                        </div>
                        {estimatedTotal > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-slate-500" />
                            <span className="text-slate-700 font-semibold">
                              예상 총액: ₩{estimatedTotal.toLocaleString("ko-KR")}
                            </span>
                          </div>
                        )}
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="REAGENT">시약</SelectItem>
                          <SelectItem value="TOOL">기구</SelectItem>
                          <SelectItem value="EQUIPMENT">장비</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 추출된 시약 리스트 */}
                  {reagents.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(groupedReagents).map(
                        ([category, categoryReagents]) =>
                          categoryReagents.length > 0 && (
                            <div key={category} className="space-y-2">
                              <Label className="text-xs font-semibold text-slate-700">
                                {category === "REAGENT" && "시약"}
                                {category === "TOOL" && "기구"}
                                {category === "EQUIPMENT" && "장비"}
                                {category === "기타" && "기타"} ({categoryReagents.length}개)
                              </Label>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-8">
                                      <TableHead className="w-12 text-[10px]">No.</TableHead>
                                      <TableHead className="text-[10px]">이름</TableHead>
                                      <TableHead className="w-20 text-[10px]">수량</TableHead>
                                      <TableHead className="w-32 text-[10px]">매칭 제품</TableHead>
                                      <TableHead className="w-24 text-right text-[10px]">예상 금액</TableHead>
                                      <TableHead className="w-16 text-[10px]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {categoryReagents.map((reagent, idx) => {
                                      const quantity =
                                        reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
                                      const totalQuantity = Math.ceil(quantity * experimentRounds);
                                      const estimatedAmount = reagent.matchedProduct
                                        ? reagent.matchedProduct.price * totalQuantity
                                        : 0;

                                      return (
                                        <TableRow key={reagent.id} className="h-10">
                                          <TableCell className="text-[11px]">{idx + 1}</TableCell>
                                          <TableCell className="text-[11px]">
                                            {editingReagentId === reagent.id ? (
                                              <div className="space-y-1">
                                                <Input
                                                  value={reagent.name}
                                                  onChange={(e) =>
                                                    handleEditReagent(reagent.id, { name: e.target.value })
                                                  }
                                                  className="h-6 text-xs"
                                                  onBlur={() => setEditingReagentId(null)}
                                                  autoFocus
                                                />
                                                <div className="flex gap-1">
                                                  <Input
                                                    value={reagent.quantity || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, {
                                                        quantity: e.target.value,
                                                      })
                                                    }
                                                    placeholder="수량"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Input
                                                    value={reagent.unit || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, { unit: e.target.value })
                                                    }
                                                    placeholder="단위"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Select
                                                    value={reagent.category || "REAGENT"}
                                                    onValueChange={(value: any) =>
                                                      handleEditReagent(reagent.id, { category: value })
                                                    }
                                                  >
                                                    <SelectTrigger className="h-5 text-xs w-20">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="REAGENT">시약</SelectItem>
                                                      <SelectItem value="TOOL">기구</SelectItem>
                                                      <SelectItem value="EQUIPMENT">장비</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="max-w-[200px]">
                                                <div className="truncate" title={reagent.name}>
                                                  {reagent.name}
                                                </div>
                                                {reagent.description && (
                                                  <div className="text-[10px] text-slate-500 truncate">
                                                    {reagent.description}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {totalQuantity}
                                            {reagent.unit && ` ${reagent.unit}`}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {reagent.matchedProduct ? (
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                  <span className="truncate max-w-[120px]" title={reagent.matchedProduct.productName}>
                                                    {reagent.matchedProduct.productName}
                                                  </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                  {reagent.matchedProduct.vendorName} · ₩
                                                  {reagent.matchedProduct.price.toLocaleString("ko-KR")}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 text-amber-600">
                                                <AlertCircle className="h-3 w-3" />
                                                <span className="text-[10px]">미매칭</span>
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right text-[11px] font-medium">
                                            {estimatedAmount > 0 ? (
                                              `₩${estimatedAmount.toLocaleString("ko-KR")}`
                                            ) : (
                                              <span className="text-slate-400">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                  <Edit2 className="h-3 w-3" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingReagentId(reagent.id)}>
                                                  <Edit2 className="h-3 w-3 mr-2" />
                                                  편집
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => handleDeleteReagent(reagent.id)}
                                                  className="text-destructive"
                                                >
                                                  <Trash2 className="h-3 w-3 mr-2" />
                                                  삭제
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      추출된 시약이 없습니다.
                    </div>
                  )}

                  {/* BOM 설정 */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bom-title" className="text-xs font-medium">
                        BOM 제목
                      </Label>
                      <Input
                        id="bom-title"
                        value={bomTitle}
                        onChange={(e) => setBomTitle(e.target.value)}
                        placeholder="예: ELISA 프로토콜 BOM"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experiment-rounds" className="text-xs font-medium">
                        실험 횟수
                      </Label>
                      <Input
                        id="experiment-rounds"
                        type="number"
                        min="1"
                        value={experimentRounds}
                        onChange={(e) => setExperimentRounds(parseInt(e.target.value) || 1)}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-slate-500">
                        수량은 실험 횟수에 따라 자동으로 계산됩니다. (현재: {experimentRounds}회)
                      </p>
                    </div>
                    <Button
                      onClick={handleCreateBOM}
                      disabled={!bomTitle.trim() || reagents.length === 0 || bomMutation.isPending}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {bomMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          BOM 생성 및 품목 리스트로 변환
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  프로토콜 텍스트를 입력하고 "시약 추출 실행"을 클릭해주세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 확인 다이얼로그 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>BOM 생성 확인</DialogTitle>
              <DialogDescription>
                추출된 {reagents.length}개 항목으로 BOM을 생성하고 품목 리스트로 변환합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">매칭된 항목</span>
                <span className="font-semibold text-green-600">{matchedCount}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">미매칭 항목</span>
                <span className="font-semibold text-amber-600">{unmatchedCount}개</span>
              </div>
              {estimatedTotal > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-slate-600">예상 총액</span>
                  <span className="font-bold text-slate-900">₩{estimatedTotal.toLocaleString("ko-KR")}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleConfirmCreateBOM} disabled={bomMutation.isPending}>
                {bomMutation.isPending ? "생성 중..." : "생성하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MainHeader } from "@/app/_components/main-header";
import {
  Brain,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Edit2,
  Trash2,
  Plus,
  Search,
  DollarSign,
  Package,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExtractedReagent {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  estimatedUsage?: number;
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
}

interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
}

interface ProductMatch {
  productId: string;
  productName: string;
  vendorName: string;
  price: number;
  currency: string;
}

interface ReagentWithMatch extends ExtractedReagent {
  id: string;
  matchedProduct?: ProductMatch;
  isMatching?: boolean;
}

export default function ProtocolBOMPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [protocolText, setProtocolText] = useState("");
  const [extractionResult, setExtractionResult] = useState<ProtocolExtractionResult | null>(null);
  const [reagents, setReagents] = useState<ReagentWithMatch[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [experimentRounds, setExperimentRounds] = useState(1);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [editingReagentId, setEditingReagentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 프로토콜 텍스트에서 시약 추출
  const extractMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "시약 추출에 실패했습니다.");
      }
      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractionResult(data);
      // reagents를 id를 가진 형태로 변환
      const reagentsWithId: ReagentWithMatch[] = data.reagents.map((r, idx) => ({
        ...r,
        id: `reagent-${idx}-${Date.now()}`,
      }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) {
        setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      }
      toast({
        title: "시약 추출 완료",
        description: `${data.reagents.length}개 항목이 추출되었습니다.`,
      });
      // 제품 매칭 시도
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => {
      toast({
        title: "시약 추출 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 각 시약에 대해 제품 검색 (미리보기)
  const matchProductsForReagents = async (reagentsToMatch: ReagentWithMatch[]) => {
    const updatedReagents = await Promise.all(
      reagentsToMatch.map(async (reagent) => {
        try {
          const response = await fetch(
            `/api/products/search?query=${encodeURIComponent(reagent.name)}&limit=1${
              reagent.category ? `&category=${reagent.category}` : ""
            }`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.products && data.products.length > 0) {
              const product = data.products[0];
              const vendor = product.vendors?.[0];
              return {
                ...reagent,
                matchedProduct: vendor
                  ? {
                      productId: product.id,
                      productName: product.name,
                      vendorName: vendor.vendor.name,
                      price: vendor.priceInKRW || 0,
                      currency: vendor.currency || "KRW",
                    }
                  : undefined,
                isMatching: true,
              };
            }
          }
        } catch (error) {
          console.error(`Failed to match product for ${reagent.name}:`, error);
        }
        return { ...reagent, isMatching: false };
      })
    );
    setReagents(updatedReagents);
  };

  // 시약 편집
  const handleEditReagent = (id: string, updates: Partial<ExtractedReagent>) => {
    setReagents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    setEditingReagentId(null);
  };

  // 시약 삭제
  const handleDeleteReagent = (id: string) => {
    setReagents((prev) => prev.filter((r) => r.id !== id));
    toast({
      title: "항목 삭제",
      description: "시약이 삭제되었습니다.",
    });
  };

  // 시약 추가
  const handleAddReagent = () => {
    const newReagent: ReagentWithMatch = {
      id: `reagent-new-${Date.now()}`,
      name: "",
      category: "REAGENT",
      quantity: "1",
      unit: "",
    };
    setReagents((prev) => [...prev, newReagent]);
    setEditingReagentId(newReagent.id);
  };

  // 예상 총액 계산
  const estimatedTotal = useMemo(() => {
    return reagents.reduce((sum, reagent) => {
      if (reagent.matchedProduct) {
        const quantity = reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
        const totalQuantity = Math.ceil(quantity * experimentRounds);
        return sum + reagent.matchedProduct.price * totalQuantity;
      }
      return sum;
    }, 0);
  }, [reagents, experimentRounds]);

  // 매칭된/매칭 안된 항목 수
  const matchedCount = reagents.filter((r) => r.matchedProduct).length;
  const unmatchedCount = reagents.length - matchedCount;

  // 카테고리별 필터링
  const filteredReagents = useMemo(() => {
    if (categoryFilter === "all") return reagents;
    return reagents.filter((r) => r.category === categoryFilter);
  }, [reagents, categoryFilter]);

  // 카테고리별 그룹핑
  const groupedReagents = useMemo(() => {
    const groups: Record<string, ReagentWithMatch[]> = {
      REAGENT: [],
      TOOL: [],
      EQUIPMENT: [],
      기타: [],
    };
    filteredReagents.forEach((r) => {
      const key = r.category || "기타";
      if (groups[key]) {
        groups[key].push(r);
      } else {
        groups["기타"].push(r);
      }
    });
    return groups;
  }, [filteredReagents]);

  // BOM 생성
  const bomMutation = useMutation({
    mutationFn: async () => {
      if (!bomTitle.trim()) {
        throw new Error("BOM 제목을 입력해주세요.");
      }
      if (reagents.length === 0) {
        throw new Error("최소 1개 이상의 시약이 필요합니다.");
      }

      const response = await fetch("/api/protocol/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bomTitle,
          reagents: reagents.map((r) => ({
            name: r.name,
            quantity: r.quantity,
            unit: r.unit,
            estimatedUsage: r.estimatedUsage,
            category: r.category,
            description: r.description,
          })),
          experimentRounds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "BOM 생성에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "BOM 생성 완료",
        description: data.message || "BOM이 성공적으로 생성되었습니다.",
      });
      setIsConfirmDialogOpen(false);
      router.push(`/test/quote`);
    },
    onError: (error: Error) => {
      toast({
        title: "BOM 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExtract = () => {
    if (!protocolText.trim()) {
      toast({
        title: "프로토콜 텍스트를 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    extractMutation.mutate(protocolText);
  };

  const handleCreateBOM = () => {
    if (!bomTitle.trim()) {
      toast({
        title: "BOM 제목을 입력해주세요",
        variant: "destructive",
      });
      return;
    }
    if (reagents.length === 0) {
      toast({
        title: "시약이 없습니다",
        description: "최소 1개 이상의 시약이 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmCreateBOM = () => {
    bomMutation.mutate();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/protocol/bom");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Protocol → BOM 생성</h1>
          <p className="text-muted-foreground mt-2">
            실험 프로토콜 텍스트를 입력하면 필요한 시약/기구/장비를 자동으로 추출하고 BOM을 생성합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          {/* 좌측: 프로토콜 입력 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                프로토콜 텍스트 입력
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                PDF에서 복사한 프로토콜 텍스트를 붙여넣으세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="protocol-text" className="text-xs font-medium">
                  프로토콜 텍스트
                </Label>
                <Textarea
                  id="protocol-text"
                  value={protocolText}
                  onChange={(e) => setProtocolText(e.target.value)}
                  placeholder="프로토콜 또는 실험 절차 텍스트를 붙여넣으세요..."
                  rows={12}
                  className="text-sm font-mono"
                />
              </div>
              <Button
                onClick={handleExtract}
                disabled={!protocolText.trim() || extractMutation.isPending}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    시약 추출 실행
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 우측: 추출 결과 및 BOM 설정 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  추출 결과 및 BOM 설정
                </CardTitle>
                {reagents.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleAddReagent} className="text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    시약 추가
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extractionResult ? (
                <>
                  {/* 프로토콜 요약 */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {extractionResult.experimentType && (
                        <Badge variant="outline">{extractionResult.experimentType}</Badge>
                      )}
                      {extractionResult.sampleType && (
                        <Badge variant="outline">{extractionResult.sampleType}</Badge>
                      )}
                    </div>
                    {extractionResult.summary && (
                      <p className="text-xs text-slate-600 mt-2">{extractionResult.summary}</p>
                    )}
                  </div>

                  {/* 통계 및 필터 */}
                  {reagents.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-700">총 {reagents.length}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-slate-700">매칭 {matchedCount}개</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span className="text-slate-700">미매칭 {unmatchedCount}개</span>
                        </div>
                        {estimatedTotal > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-slate-500" />
                            <span className="text-slate-700 font-semibold">
                              예상 총액: ₩{estimatedTotal.toLocaleString("ko-KR")}
                            </span>
                          </div>
                        )}
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="REAGENT">시약</SelectItem>
                          <SelectItem value="TOOL">기구</SelectItem>
                          <SelectItem value="EQUIPMENT">장비</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 추출된 시약 리스트 */}
                  {reagents.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(groupedReagents).map(
                        ([category, categoryReagents]) =>
                          categoryReagents.length > 0 && (
                            <div key={category} className="space-y-2">
                              <Label className="text-xs font-semibold text-slate-700">
                                {category === "REAGENT" && "시약"}
                                {category === "TOOL" && "기구"}
                                {category === "EQUIPMENT" && "장비"}
                                {category === "기타" && "기타"} ({categoryReagents.length}개)
                              </Label>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-8">
                                      <TableHead className="w-12 text-[10px]">No.</TableHead>
                                      <TableHead className="text-[10px]">이름</TableHead>
                                      <TableHead className="w-20 text-[10px]">수량</TableHead>
                                      <TableHead className="w-32 text-[10px]">매칭 제품</TableHead>
                                      <TableHead className="w-24 text-right text-[10px]">예상 금액</TableHead>
                                      <TableHead className="w-16 text-[10px]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {categoryReagents.map((reagent, idx) => {
                                      const quantity =
                                        reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
                                      const totalQuantity = Math.ceil(quantity * experimentRounds);
                                      const estimatedAmount = reagent.matchedProduct
                                        ? reagent.matchedProduct.price * totalQuantity
                                        : 0;

                                      return (
                                        <TableRow key={reagent.id} className="h-10">
                                          <TableCell className="text-[11px]">{idx + 1}</TableCell>
                                          <TableCell className="text-[11px]">
                                            {editingReagentId === reagent.id ? (
                                              <div className="space-y-1">
                                                <Input
                                                  value={reagent.name}
                                                  onChange={(e) =>
                                                    handleEditReagent(reagent.id, { name: e.target.value })
                                                  }
                                                  className="h-6 text-xs"
                                                  onBlur={() => setEditingReagentId(null)}
                                                  autoFocus
                                                />
                                                <div className="flex gap-1">
                                                  <Input
                                                    value={reagent.quantity || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, {
                                                        quantity: e.target.value,
                                                      })
                                                    }
                                                    placeholder="수량"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Input
                                                    value={reagent.unit || ""}
                                                    onChange={(e) =>
                                                      handleEditReagent(reagent.id, { unit: e.target.value })
                                                    }
                                                    placeholder="단위"
                                                    className="h-5 text-xs w-16"
                                                  />
                                                  <Select
                                                    value={reagent.category || "REAGENT"}
                                                    onValueChange={(value: any) =>
                                                      handleEditReagent(reagent.id, { category: value })
                                                    }
                                                  >
                                                    <SelectTrigger className="h-5 text-xs w-20">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="REAGENT">시약</SelectItem>
                                                      <SelectItem value="TOOL">기구</SelectItem>
                                                      <SelectItem value="EQUIPMENT">장비</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="max-w-[200px]">
                                                <div className="truncate" title={reagent.name}>
                                                  {reagent.name}
                                                </div>
                                                {reagent.description && (
                                                  <div className="text-[10px] text-slate-500 truncate">
                                                    {reagent.description}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {totalQuantity}
                                            {reagent.unit && ` ${reagent.unit}`}
                                          </TableCell>
                                          <TableCell className="text-[11px]">
                                            {reagent.matchedProduct ? (
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                  <span className="truncate max-w-[120px]" title={reagent.matchedProduct.productName}>
                                                    {reagent.matchedProduct.productName}
                                                  </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                  {reagent.matchedProduct.vendorName} · ₩
                                                  {reagent.matchedProduct.price.toLocaleString("ko-KR")}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 text-amber-600">
                                                <AlertCircle className="h-3 w-3" />
                                                <span className="text-[10px]">미매칭</span>
                                              </div>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right text-[11px] font-medium">
                                            {estimatedAmount > 0 ? (
                                              `₩${estimatedAmount.toLocaleString("ko-KR")}`
                                            ) : (
                                              <span className="text-slate-400">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                  <Edit2 className="h-3 w-3" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingReagentId(reagent.id)}>
                                                  <Edit2 className="h-3 w-3 mr-2" />
                                                  편집
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => handleDeleteReagent(reagent.id)}
                                                  className="text-destructive"
                                                >
                                                  <Trash2 className="h-3 w-3 mr-2" />
                                                  삭제
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      추출된 시약이 없습니다.
                    </div>
                  )}

                  {/* BOM 설정 */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="bom-title" className="text-xs font-medium">
                        BOM 제목
                      </Label>
                      <Input
                        id="bom-title"
                        value={bomTitle}
                        onChange={(e) => setBomTitle(e.target.value)}
                        placeholder="예: ELISA 프로토콜 BOM"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experiment-rounds" className="text-xs font-medium">
                        실험 횟수
                      </Label>
                      <Input
                        id="experiment-rounds"
                        type="number"
                        min="1"
                        value={experimentRounds}
                        onChange={(e) => setExperimentRounds(parseInt(e.target.value) || 1)}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-slate-500">
                        수량은 실험 횟수에 따라 자동으로 계산됩니다. (현재: {experimentRounds}회)
                      </p>
                    </div>
                    <Button
                      onClick={handleCreateBOM}
                      disabled={!bomTitle.trim() || reagents.length === 0 || bomMutation.isPending}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {bomMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          BOM 생성 및 품목 리스트로 변환
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  프로토콜 텍스트를 입력하고 "시약 추출 실행"을 클릭해주세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 확인 다이얼로그 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>BOM 생성 확인</DialogTitle>
              <DialogDescription>
                추출된 {reagents.length}개 항목으로 BOM을 생성하고 품목 리스트로 변환합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">매칭된 항목</span>
                <span className="font-semibold text-green-600">{matchedCount}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">미매칭 항목</span>
                <span className="font-semibold text-amber-600">{unmatchedCount}개</span>
              </div>
              {estimatedTotal > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-slate-600">예상 총액</span>
                  <span className="font-bold text-slate-900">₩{estimatedTotal.toLocaleString("ko-KR")}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleConfirmCreateBOM} disabled={bomMutation.isPending}>
                {bomMutation.isPending ? "생성 중..." : "생성하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
