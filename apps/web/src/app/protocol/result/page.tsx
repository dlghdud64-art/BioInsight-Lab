"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MainHeader } from "@/app/_components/main-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuoteDraftStore } from "@/lib/store/quote-draft-store";
import {
  FileText,
  Upload,
  Sparkles,
  Loader2,
  ShoppingCart,
  RefreshCw,
  Edit3,
  Trash2,
  Plus,
  Check,
  X,
  FileCheck,
  Brain,
  Package,
  AlertCircle,
} from "lucide-react";

interface ExtractedItem {
  id: string;
  item_name: string;
  catalog_number: string | null;
  spec: string | null;
  quantity: string | null;
  estimated_price: number | null;
  unit?: string | null;
  isEditing?: boolean;
}

// 새 API (/api/analyze/pdf) 응답 타입
interface AnalyzedItemFromAPI {
  name: string;
  catalog_number: string | null;
  specification: string | null;
  quantity: string;
  estimated_price: number;
}

interface APIAnalysisData {
  title: string;
  summary: string;
  items: AnalyzedItemFromAPI[];
}

interface APIResponse {
  success: boolean;
  data?: APIAnalysisData;
  error?: string;
  mode?: 'live' | 'mock';
  raw_text?: string;
}

// 내부 사용 타입 (변환 후)
interface AnalysisResult {
  success: boolean;
  analysis_title: string;
  summary: string;
  extracted_items: ExtractedItem[];
  raw_text?: string;
  error?: string;
  mode?: 'live' | 'mock';
}

export default function ProtocolResultPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quote Draft Store 연동
  const { addItem: addToQuote, setTitle: setQuoteTitle, reset: resetQuote } = useQuoteDraftStore();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [showRawText, setShowRawText] = useState(false);

  // PDF 분석 mutation - 새 API (/api/analyze/pdf) 사용
  const analyzeMutation = useMutation({
    mutationFn: async (file: File): Promise<AnalysisResult> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze/pdf", {
        method: "POST",
        body: formData,
      });

      const apiResponse: APIResponse = await response.json();

      // API 응답을 내부 형식으로 변환
      if (apiResponse.success && apiResponse.data) {
        return {
          success: true,
          analysis_title: apiResponse.data.title,
          summary: apiResponse.data.summary,
          extracted_items: apiResponse.data.items.map((item, idx) => ({
            id: `item-${idx}-${Date.now()}`,
            item_name: item.name,
            catalog_number: item.catalog_number,
            spec: item.specification,
            quantity: item.quantity,
            estimated_price: item.estimated_price,
            unit: null,
            isEditing: false,
          })),
          raw_text: apiResponse.raw_text,
          mode: apiResponse.mode,
        };
      }

      // 실패 시
      return {
        success: false,
        analysis_title: file.name.replace('.pdf', ''),
        summary: apiResponse.error || '분석에 실패했습니다.',
        extracted_items: [],
        error: apiResponse.error,
        mode: apiResponse.mode,
      };
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      setItems(data.extracted_items);

      if (data.success) {
        const modeLabel = data.mode === 'mock' ? ' (Demo 모드)' : '';
        toast({
          title: `분석 완료${modeLabel}`,
          description: `${data.extracted_items.length}개 항목이 추출되었습니다.`,
        });
      } else {
        toast({
          title: "분석 부분 실패",
          description: data.error || "일부 항목을 인식하지 못했습니다.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "분석 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 파일 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setAnalysisResult(null);
      setItems([]);
      analyzeMutation.mutate(droppedFile);
    } else {
      toast({
        title: "파일 형식 오류",
        description: "PDF 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
    }
  }, [analyzeMutation, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "파일 형식 오류",
          description: "PDF 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setAnalysisResult(null);
      setItems([]);
      analyzeMutation.mutate(selectedFile);
    }
  };

  // 아이템 수정
  const handleEditItem = (id: string, field: keyof ExtractedItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleEditMode = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isEditing: !item.isEditing } : item
      )
    );
  };

  // 아이템 삭제
  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: "항목 삭제됨",
      description: "목록에서 제거되었습니다.",
    });
  };

  // 아이템 추가
  const handleAddItem = () => {
    const newItem: ExtractedItem = {
      id: `item-new-${Date.now()}`,
      item_name: "",
      catalog_number: null,
      spec: null,
      quantity: "1",
      estimated_price: null,
      unit: "EA",
      isEditing: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // 전체 장바구니 담기
  const handleAddAllToCart = async () => {
    if (items.length === 0) {
      toast({
        title: "항목이 없습니다",
        description: "장바구니에 담을 항목이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // Quote Draft Store에 아이템 추가
    resetQuote(); // 기존 항목 초기화
    setQuoteTitle(analysisResult?.analysis_title || "AI 분석 견적서");

    items.forEach((item) => {
      const qty = parseInt(item.quantity || "1") || 1;
      addToQuote({
        id: item.id,
        productId: `ai-${item.id}`, // AI 추출 제품은 별도 ID
        productName: item.item_name,
        brand: item.catalog_number || undefined,
        quantity: qty,
        unitPrice: item.estimated_price || undefined,
        currency: "KRW",
        lineTotal: item.estimated_price ? item.estimated_price * qty : undefined,
        notes: item.spec || undefined,
      });
    });

    toast({
      title: "장바구니에 추가됨",
      description: `${items.length}개 항목이 장바구니에 추가되었습니다.`,
    });

    // 견적 페이지로 이동
    router.push("/test/quote");
  };

  // 다시 올리기
  const handleReupload = () => {
    setFile(null);
    setAnalysisResult(null);
    setItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 예상 총액 계산
  const totalEstimatedPrice = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity || "1") || 1;
    return sum + (item.estimated_price || 0) * qty;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <MainHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
                AI 문서 분석
                <Sparkles className="h-5 w-5 text-blue-500" />
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                PDF를 업로드하면 AI가 자동으로 시약/소모품 목록을 추출합니다
              </p>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 - 분석 전/후 분기 */}
        {!analysisResult ? (
          /* 업로드 영역 */
          <div className="max-w-2xl mx-auto">
            {/* Glassmorphism 업로드 카드 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300
                backdrop-blur-xl bg-white/70 shadow-xl
                ${isDragging
                  ? "border-blue-500 bg-blue-50/80 scale-[1.02]"
                  : "border-slate-200 hover:border-blue-400 hover:bg-white/80"
                }
              `}
            >
              {/* 배경 장식 */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />

              {analyzeMutation.isPending ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                    <div className="relative p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full">
                      <Loader2 className="h-10 w-10 text-white animate-spin" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-800">AI가 문서를 분석하고 있습니다...</p>
                    <p className="text-sm text-slate-500 mt-1">잠시만 기다려주세요</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-full inline-block transition-all ${isDragging ? "bg-blue-100" : "bg-slate-100"}`}>
                    <Upload className={`h-10 w-10 ${isDragging ? "text-blue-600" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {isDragging ? "파일을 놓아주세요" : "PDF 파일을 드래그하여 업로드"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">또는 클릭하여 파일 선택 (최대 20MB)</p>
                  </div>
                  <label htmlFor="pdf-upload">
                    <Button
                      type="button"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg cursor-pointer"
                      asChild
                    >
                      <span>
                        <FileText className="h-4 w-4 mr-2" />
                        파일 선택
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 분석 결과 화면 */
          <div className="space-y-6">
            {/* 상단: 분석 요약 카드 (Glassmorphism) */}
            <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl p-6">
              {/* 배경 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/10 pointer-events-none" />

              <div className="relative flex items-start gap-4">
                {/* 아이콘 박스 */}
                <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <FileCheck className="h-8 w-8 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 truncate">
                      {analysisResult.analysis_title}
                    </h2>
                    {analysisResult.success ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        분석 완료
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        부분 분석
                      </Badge>
                    )}
                    {analysisResult.mode === 'mock' && (
                      <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Demo 모드
                      </Badge>
                    )}
                  </div>

                  {/* 3줄 요약 */}
                  <div className="text-sm text-slate-600 space-y-1">
                    {analysisResult.summary.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>

                  {/* 통계 */}
                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200/50">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{items.length}</span>개 항목
                      </span>
                    </div>
                    {totalEstimatedPrice > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          예상 총액:{" "}
                          <span className="font-semibold text-slate-900">
                            ₩{totalEstimatedPrice.toLocaleString()}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 중단: 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* 좌측: AI 인식 내용 요약 / 원본 미리보기 */}
              <div className="lg:col-span-2">
                <div className="sticky top-24 space-y-4">
                  <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" />
                        원본 텍스트
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRawText(!showRawText)}
                        className="text-xs"
                      >
                        {showRawText ? "접기" : "펼치기"}
                      </Button>
                    </div>

                    {showRawText && analysisResult.raw_text && (
                      <div className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-600 whitespace-pre-wrap">
                        {analysisResult.raw_text}
                      </div>
                    )}

                    {!showRawText && (
                      <p className="text-sm text-slate-500">
                        AI가 추출한 텍스트를 확인하려면 "펼치기"를 클릭하세요.
                      </p>
                    )}
                  </div>

                  {/* 파일 정보 */}
                  {file && (
                    <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-4">
                      <h3 className="font-semibold text-slate-800 mb-2">업로드된 파일</h3>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <FileText className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 추출된 시약 리스트 (Editable Card List) */}
              <div className="lg:col-span-3">
                <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      추출된 항목
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      항목 추가
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">추출된 항목이 없습니다.</p>
                      <p className="text-xs mt-1">직접 항목을 추가해주세요.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className="group relative rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          {/* 아이템 헤더 */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-medium flex items-center justify-center">
                                {index + 1}
                              </span>
                              {item.isEditing ? (
                                <Input
                                  value={item.item_name}
                                  onChange={(e) => handleEditItem(item.id, "item_name", e.target.value)}
                                  placeholder="제품명"
                                  className="text-sm font-semibold h-8"
                                />
                              ) : (
                                <h4 className="font-semibold text-slate-900 truncate">
                                  {item.item_name || "(제품명 없음)"}
                                </h4>
                              )}
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEditMode(item.id)}
                                className="h-7 w-7 p-0"
                              >
                                {item.isEditing ? (
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Edit3 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id)}
                                className="h-7 w-7 p-0 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* 태그형 스펙 뱃지들 */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Catalog Number */}
                            {item.isEditing ? (
                              <Input
                                value={item.catalog_number || ""}
                                onChange={(e) => handleEditItem(item.id, "catalog_number", e.target.value || null)}
                                placeholder="Cat. No."
                                className="w-28 h-7 text-xs"
                              />
                            ) : item.catalog_number ? (
                              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {item.catalog_number}
                              </Badge>
                            ) : null}

                            {/* Spec */}
                            {item.isEditing ? (
                              <Input
                                value={item.spec || ""}
                                onChange={(e) => handleEditItem(item.id, "spec", e.target.value || null)}
                                placeholder="규격 (예: 500mL)"
                                className="w-32 h-7 text-xs"
                              />
                            ) : item.spec ? (
                              <Badge variant="outline" className="text-xs">
                                {item.spec}
                              </Badge>
                            ) : null}

                            {/* Quantity */}
                            {item.isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={item.quantity || ""}
                                  onChange={(e) => handleEditItem(item.id, "quantity", e.target.value || null)}
                                  placeholder="수량"
                                  className="w-16 h-7 text-xs"
                                />
                                <Input
                                  value={item.unit || ""}
                                  onChange={(e) => handleEditItem(item.id, "unit", e.target.value || null)}
                                  placeholder="단위"
                                  className="w-16 h-7 text-xs"
                                />
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                                {item.quantity || "1"} {item.unit || "EA"}
                              </Badge>
                            )}
                          </div>

                          {/* 가격 */}
                          <div className="flex items-center justify-between">
                            {item.isEditing ? (
                              <Input
                                type="number"
                                value={item.estimated_price || ""}
                                onChange={(e) => handleEditItem(item.id, "estimated_price", parseInt(e.target.value) || null)}
                                placeholder="예상 가격"
                                className="w-32 h-7 text-xs"
                              />
                            ) : item.estimated_price ? (
                              <span className="text-sm font-semibold text-slate-900">
                                ₩{item.estimated_price.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">가격 미정</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div className="flex items-center justify-center gap-4 pt-6">
              {/* Secondary: 다시 올리기 */}
              <Button
                variant="outline"
                size="lg"
                onClick={handleReupload}
                className="border-2 px-6"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                다시 올리기
              </Button>

              {/* Primary: 전체 장바구니 담기 */}
              <Button
                size="lg"
                onClick={handleAddAllToCart}
                disabled={items.length === 0}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg px-8"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                전체 장바구니 담기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
