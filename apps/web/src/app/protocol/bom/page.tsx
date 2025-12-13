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
  Upload,
  Clipboard,
  FlaskConical,
  Sparkles,
  FileCheck,
  X,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ExperimentCondition {
  temperature?: {
    value: number;
    unit: string;
    duration?: number;
    description?: string;
  }[];
  time?: {
    value: number;
    unit: string;
    step?: string;
  }[];
  concentration?: {
    reagent: string;
    value: number;
    unit: string;
  }[];
  pH?: {
    value: number;
    description?: string;
  }[];
  other?: {
    key: string;
    value: string;
    description?: string;
  }[];
}

interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
  conditions?: ExperimentCondition;
}

interface ProductMatch {
  productId: string;
  productName: string;
  vendorName: string;
  price: number;
  currency: string;
  isHighRisk?: boolean; // 고위험군 여부
  hazardCodes?: string[]; // 위험 코드
  safetyNote?: string; // 안전 정보
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // PDF 업로드 활성화 여부 (기본값: true)
  const [pdfUploadEnabled, setPdfUploadEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // PDF 업로드 활성화 여부 확인
  useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      const data = await res.json();
      // 환경 변수에 따라 활성화 여부 결정 (기본값: true)
      setPdfUploadEnabled(data.pdfUploadEnabled ?? true);
      return data;
    },
  });

  // 파일 검증 및 설정
  const handleFile = (file: File | null) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "파일 형식 오류",
        description: "PDF 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "파일 크기는 10MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setPdfFile(file);
    setExtractionResult(null);
    setReagents([]);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // PDF 파일에서 시약 추출
  const extractFromFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/protocol/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "PDF 분석에 실패했습니다.");
      }

      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractionResult(data);
      const reagentsWithId: ReagentWithMatch[] = data.reagents.map((r, idx) => ({
        ...r,
        id: `reagent-${idx}-${Date.now()}`,
      }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) {
        setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      }
      toast({
        title: "PDF 분석 완료",
        description: `${data.reagents.length}개 항목이 추출되었습니다.`,
      });
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => {
      toast({
        title: "PDF 분석 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
              
              // 안전 정보 확인 (고위험군 여부)
              const isHighRisk = 
                (product.hazardCodes && Array.isArray(product.hazardCodes) && product.hazardCodes.length > 0) ||
                (product.pictograms && Array.isArray(product.pictograms) && 
                 product.pictograms.some((p: string) => ["skull", "flame", "corrosive"].includes(p)));
              
              return {
                ...reagent,
                matchedProduct: vendor
                  ? {
                      productId: product.id,
                      productName: product.name,
                      vendorName: vendor.vendor.name,
                      price: vendor.priceInKRW || 0,
                      currency: vendor.currency || "KRW",
                      isHighRisk,
                      hazardCodes: product.hazardCodes || [],
                      safetyNote: product.safetyNote || undefined,
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
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
          <div className="text-center py-8 md:py-12">
            <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin mx-auto mb-3 md:mb-4" />
            <p className="text-xs md:text-sm text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 인증 체크 제거 - 로그인 없이도 프로토콜 분석 사용 가능
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/protocol/bom");
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-7xl">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
              <FlaskConical className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg md:text-3xl font-bold text-slate-900 flex items-center gap-1.5 md:gap-2 flex-wrap">
                Protocol → BOM 생성
                <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </h1>
            </div>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-2 ml-8 md:ml-11">
            실험 프로토콜 텍스트를 입력하면 필요한 시약/기구/장비를 자동으로 추출하고 BOM을 생성합니다.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr,1.5fr]">
          {/* 좌측: 프로토콜 입력 */}
          <Card className="p-3 md:p-6">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-xs md:text-sm font-semibold text-slate-900 flex items-center gap-1.5 md:gap-2">
                <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
                프로토콜 입력
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs text-slate-500">
                PDF 파일을 업로드하거나 텍스트를 붙여넣어 프로토콜을 분석합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-3 md:space-y-4">
              <Tabs defaultValue={pdfUploadEnabled ? "upload" : "paste"} className="w-full">
                <TabsList className="grid w-full" style={{ gridTemplateColumns: pdfUploadEnabled ? "1fr 1fr" : "1fr" }}>
                  {pdfUploadEnabled && (
                    <TabsTrigger value="upload" className="flex items-center gap-2 text-xs">
                      <Upload className="h-3 w-3" />
                      PDF 업로드
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="paste" className="flex items-center gap-2 text-xs">
                    <Clipboard className="h-3 w-3" />
                    텍스트 붙여넣기
                  </TabsTrigger>
                </TabsList>

                {/* PDF 업로드 탭 */}
                {pdfUploadEnabled && (
                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-slate-700">
                        프로토콜 PDF 파일 업로드
                      </Label>
                      
                      {/* 드래그 앤 드롭 영역 */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
                          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
                          ${isDragging 
                            ? "border-blue-500 bg-blue-50" 
                            : pdfFile 
                            ? "border-green-500 bg-green-50" 
                            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
                          }
                        `}
                      >
                        <input
                          id="protocol-file"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        
                        {pdfFile ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center">
                              <div className="p-3 bg-green-100 rounded-full">
                                <FileCheck className="h-8 w-8 text-green-600" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-900">{pdfFile.name}</p>
                              <p className="text-xs text-slate-500">
                                {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPdfFile(null);
                                const input = document.getElementById("protocol-file") as HTMLInputElement;
                                if (input) input.value = "";
                              }}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              <X className="h-3 w-3 mr-1" />
                              파일 제거
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center">
                              <div className={`p-3 rounded-full ${isDragging ? "bg-blue-100" : "bg-slate-200"}`}>
                                <Upload className={`h-8 w-8 ${isDragging ? "text-blue-600" : "text-slate-500"}`} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-700">
                                {isDragging ? "파일을 놓아주세요" : "PDF 파일을 드래그하거나 클릭하여 업로드"}
                              </p>
                              <p className="text-xs text-slate-500">
                                최대 10MB까지 업로드 가능
                              </p>
                            </div>
                            <label htmlFor="protocol-file">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                                asChild
                              >
                                <span>파일 선택</span>
                              </Button>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => {
                        if (pdfFile) {
                          extractFromFileMutation.mutate(pdfFile);
                        }
                      }}
                      disabled={!pdfFile || extractFromFileMutation.isPending}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800"
                      size="lg"
                    >
                      {extractFromFileMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          PDF 분석 중...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          시약 추출 실행
                        </>
                      )}
                    </Button>
                  </TabsContent>
                )}

                {/* 텍스트 붙여넣기 탭 */}
                <TabsContent value="paste" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="protocol-text" className="text-xs font-medium">
                      프로토콜 텍스트
                    </Label>
                    <Textarea
                      id="protocol-text"
                      value={protocolText}
                      onChange={(e) => {
                        setProtocolText(e.target.value);
                        setExtractionResult(null);
                        setReagents([]);
                      }}
                      placeholder="예: 1. 세포 배양액 준비: DMEM 배지에 10% FBS와 1% 페니실린-스트렙토마이신을 첨가합니다. 2. 세포 시딩: 96-well plate에 1×10⁴ cells/well로 시딩합니다. 3. 배양: 37°C, 5% CO₂ 조건에서 24시간 배양합니다."
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
                </TabsContent>
              </Tabs>
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

                  {/* 실험 조건 표시 */}
                  {extractionResult.conditions && (
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-blue-600" />
                          실험 조건
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {extractionResult.conditions.temperature && extractionResult.conditions.temperature.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">온도</div>
                            <div className="space-y-1">
                              {extractionResult.conditions.temperature.map((temp: any, idx: number) => (
                                <div key={idx} className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">
                                    {(temp as any).range || `${temp.value}${temp.unit}`}
                                  </span>
                                  {temp.duration && (
                                    <span className="text-slate-500">({temp.duration}분)</span>
                                  )}
                                  {temp.description && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {temp.description}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {extractionResult.conditions.time && extractionResult.conditions.time.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">시간</div>
                            <div className="space-y-1">
                              {extractionResult.conditions.time.map((time: any, idx: number) => (
                                <div key={idx} className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">
                                    {(time as any).original || `${time.value} ${time.unit}`}
                                  </span>
                                  {time.step && (
                                    <span className="text-slate-500">({time.step})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {extractionResult.conditions.concentration && extractionResult.conditions.concentration.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">농도</div>
                            <div className="space-y-1">
                              {extractionResult.conditions.concentration.map((conc: any, idx: number) => (
                                <div key={idx} className="text-xs text-slate-600">
                                  <span className="font-medium">{conc.reagent}:</span>{" "}
                                  <span>{(conc as any).original || `${conc.value} ${conc.unit}`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {extractionResult.conditions.pH && extractionResult.conditions.pH.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">pH</div>
                            <div className="space-y-1">
                              {extractionResult.conditions.pH.map((pH: any, idx: number) => (
                                <div key={idx} className="text-xs text-slate-600">
                                  <span className="font-medium">
                                    pH {(pH as any).range || pH.value}
                                  </span>
                                  {pH.description && (
                                    <span className="text-slate-500 ml-2">({pH.description})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {extractionResult.conditions.other && extractionResult.conditions.other.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">기타 조건</div>
                            <div className="space-y-1">
                              {extractionResult.conditions.other.map((other, idx) => (
                                <div key={idx} className="text-xs text-slate-600">
                                  <span className="font-medium">{other.key}:</span>{" "}
                                  <span>{other.value}</span>
                                  {other.description && (
                                    <span className="text-slate-500 ml-2">({other.description})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

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
                        {reagents.filter((r) => r.matchedProduct?.isHighRisk).length > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                            <span className="text-slate-700 font-semibold text-red-600">
                              고위험 {reagents.filter((r) => r.matchedProduct?.isHighRisk).length}개
                            </span>
                          </div>
                        )}
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

                  {/* BOM 설정 및 액션 */}
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
                    
                    {/* 액션 버튼들 */}
                    <div className="space-y-2">
                      {reagents.length > 0 && (
                        <Button
                          onClick={() => {
                            // 추출된 시약들을 검색어로 변환하여 검색 페이지로 이동
                            const searchQueries = reagents
                              .map((r) => r.name)
                              .filter(Boolean)
                              .slice(0, 5); // 최대 5개만
                            const queryString = searchQueries.join(" OR ");
                            const params = new URLSearchParams({
                              q: queryString,
                              ...(extractionResult?.experimentType && { 
                                category: extractionResult.experimentType.includes("ELISA") ? "REAGENT" : "" 
                              }),
                            });
                            router.push(`/test/search?${params.toString()}`);
                          }}
                          className="w-full bg-blue-600 text-white hover:bg-blue-700"
                          variant="default"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          추출된 시약으로 제품 검색하기
                        </Button>
                      )}
                      
                      <Button
                        onClick={handleCreateBOM}
                        disabled={!bomTitle.trim() || reagents.length === 0 || bomMutation.isPending}
                        className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        variant="default"
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