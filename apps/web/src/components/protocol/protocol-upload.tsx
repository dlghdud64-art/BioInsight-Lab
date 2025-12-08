"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, Search, Clipboard, ShoppingCart, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

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

interface ProtocolUploadProps {
  onBOMCreated?: (bomItems: Array<{
    name: string;
    quantity: number;
    estimatedUsage?: number;
    category?: string;
    description?: string;
  }>) => void;
}

export function ProtocolUpload({ onBOMCreated }: ProtocolUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState<ProtocolExtractionResult | null>(null);
  const [experimentRounds, setExperimentRounds] = useState<number>(1); // 실험 회차

  // 환경 설정 확인
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      return res.json() as Promise<{ pdfMode: string; pdfUploadEnabled: boolean }>;
    },
  });

  const pdfUploadEnabled = config?.pdfUploadEnabled ?? false;

  // PDF 업로드 모드
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
        throw new Error(error.error || "프로토콜 분석에 실패했습니다.");
      }

      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractedData(data);
    },
  });

  // 텍스트 붙여넣기 모드
  const extractFromTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "프로토콜 분석에 실패했습니다.");
      }

      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractedData(data);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedData(null);
    }
  };

  const handleExtractFromFile = () => {
    if (!file) return;
    extractFromFileMutation.mutate(file);
  };

  const handleExtractFromText = () => {
    if (!text.trim()) {
      alert("텍스트를 입력해주세요.");
      return;
    }
    extractFromTextMutation.mutate(text);
  };

  const handleSearchReagent = (reagentName: string) => {
    router.push(`/search?q=${encodeURIComponent(reagentName)}`);
  };

  const handleSearchAll = () => {
    if (!extractedData) return;
    // 첫 번째 시약으로 검색하거나, 모든 시약명을 조합
    const searchQuery = extractedData.reagents
      .map((r) => r.name)
      .slice(0, 3)
      .join(" ");
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleCreateQuoteList = async () => {
    if (!extractedData || extractedData.reagents.length === 0) {
      alert("추출된 시약이 없습니다.");
      return;
    }

    try {
      const response = await fetch("/api/protocol/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `프로토콜 BOM - ${extractedData.experimentType || "실험"} (${experimentRounds}회)`,
          reagents: extractedData.reagents,
          experimentRounds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "BOM 생성에 실패했습니다.");
      }

      const data = await response.json();
      
      // BOM 생성 성공 시 품목 리스트 페이지로 이동
      if (data.quote?.id) {
        router.push(`/compare/quote/${data.quote.id}`);
      } else {
        alert(data.message || "BOM이 생성되었습니다.");
      }

      // 콜백 호출
      if (onBOMCreated && data.quote?.items) {
        onBOMCreated(
          data.quote.items.map((item: any) => ({
            name: item.product?.name || "",
            quantity: item.quantity,
            estimatedUsage: item.quantity,
            category: item.product?.category,
            description: item.notes,
          }))
        );
      }
    } catch (error: any) {
      console.error("Failed to create BOM:", error);
      alert(error.message || "BOM 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            데이터시트에서 불러오기
          </CardTitle>
          <CardDescription>
            실험 프로토콜 PDF를 업로드하거나 텍스트를 붙여넣어 필요한 시약을 자동으로 추출합니다.
            {!pdfUploadEnabled && (
              <span className="block mt-1 text-xs text-amber-600">
                보안 환경: 텍스트 붙여넣기 모드만 사용 가능합니다.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue={pdfUploadEnabled ? "upload" : "paste"} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: pdfUploadEnabled ? "1fr 1fr" : "1fr" }}>
              {pdfUploadEnabled && (
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  파일 업로드
                </TabsTrigger>
              )}
              <TabsTrigger value="paste" className="flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                텍스트 붙여넣기
              </TabsTrigger>
            </TabsList>

            {/* 파일 업로드 탭 */}
            {pdfUploadEnabled && (
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="protocol-file">프로토콜 PDF 파일</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Input
                      id="protocol-file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {file && (
                      <div className="text-sm text-muted-foreground">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleExtractFromFile}
                  disabled={!file || extractFromFileMutation.isPending}
                  className="w-full"
                >
                  {extractFromFileMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      프로토콜 분석하기
                    </>
                  )}
                </Button>

                {extractFromFileMutation.isError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    {extractFromFileMutation.error instanceof Error
                      ? extractFromFileMutation.error.message
                      : "분석 중 오류가 발생했습니다."}
                  </div>
                )}
              </TabsContent>
            )}

            {/* 텍스트 붙여넣기 탭 */}
            <TabsContent value="paste" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="protocol-text">프로토콜 텍스트 붙여넣기</Label>
                <CardDescription className="text-xs mt-1 mb-2">
                  데이터시트 PDF에서 필요한 부분을 복사하여 붙여넣으세요. 파일은 서버로 전송되지 않습니다.
                </CardDescription>
                <Textarea
                  id="protocol-text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setExtractedData(null);
                  }}
                  placeholder="예: Materials and Methods&#10;Human IL-6 ELISA Kit (BioLab, Cat. No. BL-IL6-001)&#10;96-well plate format, sensitivity: 2 pg/mL&#10;Serum and plasma samples..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  {text.length}자 입력됨
                </div>
              </div>

              <Button
                onClick={handleExtractFromText}
                disabled={!text.trim() || extractFromTextMutation.isPending}
                className="w-full"
              >
                {extractFromTextMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Clipboard className="h-4 w-4 mr-2" />
                    프로토콜 분석하기
                  </>
                )}
              </Button>

              {extractFromTextMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {extractFromTextMutation.error instanceof Error
                    ? extractFromTextMutation.error.message
                    : "분석 중 오류가 발생했습니다."}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>추출된 정보</CardTitle>
            <CardDescription>
              {extractedData.summary}
              {extractedData.experimentType && (
                <span className="ml-2">
                  · 실험 유형: {extractedData.experimentType}
                </span>
              )}
              {extractedData.sampleType && (
                <span className="ml-2">· 샘플: {extractedData.sampleType}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 실험 회차 입력 */}
            <div className="p-4 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-4">
                <Label htmlFor="experiment-rounds" className="whitespace-nowrap">
                  실험 회차:
                </Label>
                <Input
                  id="experiment-rounds"
                  type="number"
                  min="1"
                  value={experimentRounds}
                  onChange={(e) => setExperimentRounds(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  회차 수에 따라 예상 수량이 자동 계산됩니다.
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">필요한 시약 ({extractedData.reagents.length}개)</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSearchAll}>
                    <Search className="h-4 w-4 mr-2" />
                    모두 검색
                  </Button>
                  <Button size="sm" onClick={handleCreateQuoteList}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    품목 리스트 만들기
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {extractedData.reagents.map((reagent, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{reagent.name}</h4>
                          {reagent.category && (
                            <Badge variant="outline" className="text-xs">
                              {PRODUCT_CATEGORIES[reagent.category]}
                            </Badge>
                          )}
                        </div>
                        {reagent.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {reagent.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {reagent.quantity && (
                            <span>
                              수량: {reagent.quantity} {reagent.unit || ""}
                            </span>
                          )}
                          {reagent.estimatedUsage && (
                            <span className="font-medium text-slate-900">
                              추천 주문량: {Math.ceil(reagent.estimatedUsage * experimentRounds)} {reagent.unit || "개"} ({experimentRounds}회 기준)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSearchReagent(reagent.name)}
                      >
                        <Search className="h-4 w-4 mr-1" />
                        검색
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}