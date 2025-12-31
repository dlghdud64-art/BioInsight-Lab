"use client";

export const dynamic = 'force-dynamic';

import { useState, useCallback } from "react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SecurityIndicator, SecurityAlert } from "@/components/protocol/security-indicator";
import { ExtractionResultItem } from "@/components/protocol/extraction-result-item";
import { BOMSkeleton } from "@/components/protocol/bom-skeleton";
import { FileText, Loader2, GitCompare, AlertCircle, Upload, Sparkles, Zap } from "lucide-react";
import { useCompareStore } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";

interface ExtractionItem {
  id: string;
  name: string;
  category?: string;
  quantity?: string;
  unit?: string;
  confidence?: "high" | "medium" | "low";
  evidence?: string;
}

interface ExtractionResult {
  items: ExtractionItem[];
  summary?: string;
}

export default function ExtractPage() {
  const [protocolText, setProtocolText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const { addProduct } = useCompareStore();
  const { toast } = useToast();

  // PDF 파일에서 텍스트 추출
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/protocol/extract-pdf-text", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "PDF에서 텍스트를 추출할 수 없습니다.");
    }

    const data = await response.json();
    return data.text || "";
  };

  const handleExtract = async () => {
    let textToExtract = protocolText;

    // PDF 파일이 있으면 먼저 텍스트 추출
    if (pdfFile) {
      try {
        setIsExtracting(true);
        const extractedText = await extractTextFromPDF(pdfFile);
        textToExtract = extractedText;
        setProtocolText(extractedText); // 추출된 텍스트를 입력창에 표시
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : "PDF에서 텍스트를 추출하는 중 오류가 발생했습니다.";
        
        toast({
          title: "PDF 추출 실패",
          description: errorMessage,
          variant: "destructive",
        });
        setIsExtracting(false);
        return;
      }
    }

    // Input validation
    if (!textToExtract.trim()) {
      toast({
        title: "입력 오류",
        description: "프로토콜 텍스트를 입력하거나 PDF 파일을 업로드해주세요.",
        variant: "destructive",
      });
      setIsExtracting(false);
      return;
    }

    if (textToExtract.length < 10) {
      toast({
        title: "입력 오류",
        description: "프로토콜 텍스트는 최소 10자 이상이어야 합니다.",
        variant: "destructive",
      });
      setIsExtracting(false);
      return;
    }

    if (textToExtract.length > 50000) {
      toast({
        title: "입력 오류",
        description: "프로토콜 텍스트는 최대 50,000자까지 입력 가능합니다.",
        variant: "destructive",
      });
      setIsExtracting(false);
      return;
    }

    try {
      setExtractionResult(null); // Clear previous results

      const data = await api.post<ExtractionResult>("/api/protocol/extract", { text: textToExtract }, {
        skipErrorToast: true, // We'll show custom toast
      });

      // Validate response format
      if (!data || !Array.isArray(data.items)) {
        throw new Error("서버 응답 형식이 올바르지 않습니다.");
      }

      setExtractionResult(data);
      setPdfFile(null); // Clear PDF file after successful extraction

      // Show success toast
      toast({
        title: "분석 완료",
        description: `${data.items.length}개의 품목이 추출되었습니다.`,
      });
    } catch (error) {
      // User-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : "프로토콜 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      
      toast({
        title: "분석 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // 드래그 앤 드롭 핸들러
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

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === "application/pdf");
    
    if (pdfFile) {
      if (pdfFile.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "PDF 파일은 10MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }
      setPdfFile(pdfFile);
      setProtocolText(""); // 텍스트 입력 초기화
    } else if (files.length > 0) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PDF 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "PDF 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "PDF 파일은 10MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }
      setPdfFile(file);
      setProtocolText(""); // 텍스트 입력 초기화
    }
  }, [toast]);

  const handleSendToCompare = () => {
    if (!extractionResult || extractionResult.items.length === 0) return;

    extractionResult.items.forEach((item) => {
      addProduct(item.id);
    });

    toast({
      title: "비교함에 추가됨",
      description: `${extractionResult.items.length}개 품목이 비교함에 추가되었습니다.`,
    });
  };

  const hasLowConfidenceItems = extractionResult?.items.some(
    (item) => item.confidence === "low"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Protocol → BOM 생성
            </h1>
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 px-3 py-1">
              <Image 
                src="/brand/Bio-Insight.png" 
                alt="AI Icon" 
                width={18} 
                height={18} 
                className="mr-1.5 h-4 w-4"
              />
              AI Powered
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            실험 프로토콜 텍스트 또는 PDF를 업로드하면 AI가 필요한 시약과 장비를 자동으로 추출합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Panel: 입력 */}
          <div className="space-y-4">
            <SecurityAlert />
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg rounded-xl p-6 relative overflow-hidden flex flex-col min-h-[600px]">
              {/* Glassmorphism 효과를 위한 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-900">프로토콜 입력</h2>
                  <SecurityIndicator />
                </div>

                {/* PDF 업로드 영역 */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative mb-4 border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300
                    ${isDragging 
                      ? "border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/20 scale-[1.02]" 
                      : pdfFile 
                      ? "border-green-500 bg-green-50/50" 
                      : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50"
                    }
                  `}
                >
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isExtracting}
                  />
                  
                  {pdfFile ? (
                    <div className="space-y-2">
                      <FileText className="h-10 w-10 mx-auto text-green-600" />
                      <p className="text-sm font-medium text-slate-900">{pdfFile.name}</p>
                      <p className="text-xs text-slate-500">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPdfFile(null);
                          const input = document.getElementById("pdf-upload") as HTMLInputElement;
                          if (input) input.value = "";
                        }}
                        className="mt-2"
                      >
                        파일 제거
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className={`h-12 w-12 mx-auto mb-3 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">
                        PDF 파일 업로드
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        파일을 드래그하거나 클릭하여 선택하세요
                      </p>
                      <label htmlFor="pdf-upload">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="cursor-pointer"
                          disabled={isExtracting}
                        >
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            파일 선택
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white/80 px-2 text-slate-500">또는</span>
                  </div>
                </div>

                <Textarea
                  value={protocolText}
                  onChange={(e) => setProtocolText(e.target.value)}
                  disabled={isExtracting || !!pdfFile}
                  placeholder="실험 프로토콜 텍스트를 붙여넣으세요...

예:
1. Add 5ml of PBS buffer to the cell culture.
2. Incubate at 37°C for 30 minutes.
3. Add trypsin-EDTA solution..."
                  className="flex-1 min-h-[300px] text-sm font-mono resize-y bg-white/50 backdrop-blur-sm border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                />
                
                <Button
                  onClick={handleExtract}
                  disabled={(!protocolText.trim() && !pdfFile) || isExtracting}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI 분석 중...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      시약 추출 실행
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel: 결과 */}
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg rounded-xl p-6 relative overflow-hidden flex flex-col min-h-[600px]">
              {/* Glassmorphism 효과를 위한 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col flex-1">
                <h2 className="font-semibold text-slate-900 mb-4">추출 결과</h2>

                {hasLowConfidenceItems && (
                  <Alert className="mb-4 border-orange-200 bg-orange-50/80 backdrop-blur-sm">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-sm text-orange-800">
                      일부 품목의 신뢰도가 낮습니다. 결과를 확인하고 필요시 수정해주세요.
                    </AlertDescription>
                  </Alert>
                )}

                {extractionResult ? (
                  <div className="flex flex-col flex-1 space-y-4">
                    {extractionResult.items.length > 0 ? (
                      <>
                        <div className="space-y-3 flex-1">
                          {extractionResult.items.map((item) => (
                            <ExtractionResultItem key={item.id} item={item} />
                          ))}
                        </div>
                        <Button
                          onClick={handleSendToCompare}
                          className="w-full mt-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <GitCompare className="h-4 w-4 mr-2" />
                          Send to Compare ({extractionResult.items.length}개)
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <p className="text-sm">추출된 품목이 없습니다.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative flex-1">
                    {/* Skeleton UI 배경 */}
                    <BOMSkeleton />
                    
                    {/* Empty State 메시지 */}
                    <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[500px] text-center px-6">
                      <div className="mb-6 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse" />
                        <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-xl">
                          <Image 
                            src="/brand/Bio-Insight.png" 
                            alt="AI Icon" 
                            width={80} 
                            height={80} 
                            className="h-20 w-20"
                          />
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        AI가 분석할 준비가 되었습니다
                      </h3>
                      <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-4">
                        PDF를 업로드하거나 프로토콜 텍스트를 입력하면 AI가 시약 이름, 용량, 카탈로그 번호를 자동으로 추출하여 엑셀 표로 정리합니다.
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <FileText className="h-4 w-4" />
                        <span>결과는 아래와 같은 형식으로 표시됩니다</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

