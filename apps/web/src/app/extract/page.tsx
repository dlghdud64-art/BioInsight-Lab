"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SecurityIndicator } from "@/components/protocol/security-indicator";
import { ExtractionResultItem } from "@/components/protocol/extraction-result-item";
import { FileText, Loader2, GitCompare, AlertCircle } from "lucide-react";
import { useCompareStore } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";

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
  const { addProduct } = useCompareStore();
  const { toast } = useToast();

  const handleExtract = async () => {
    if (!protocolText.trim()) {
      toast({
        title: "오류",
        description: "프로토콜 텍스트를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExtracting(true);
      const response = await fetch("/api/protocol/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: protocolText }),
      });

      if (!response.ok) throw new Error("Extraction failed");

      const data = await response.json();
      setExtractionResult(data);
    } catch (error) {
      console.error("Extraction error:", error);
      toast({
        title: "오류",
        description: "프로토콜 분석에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSendToCompare = () => {
    if (!extractionResult || extractionResult.items.length === 0) return;

    // TODO: 실제 제품 ID로 매핑 필요
    extractionResult.items.forEach((item) => {
      // 임시로 item.id 사용 (실제로는 검색 후 매핑 필요)
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
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            프로토콜 분석
          </h1>
          <p className="text-sm text-slate-600">
            실험 프로토콜 텍스트를 입력하면 필요한 시약과 장비를 자동으로 추출합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: 입력 */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-900">프로토콜 텍스트</h2>
                <SecurityIndicator />
              </div>
              <Textarea
                value={protocolText}
                onChange={(e) => setProtocolText(e.target.value)}
                placeholder="실험 프로토콜 텍스트를 붙여넣으세요...

예:
1. Add 5ml of PBS buffer to the cell culture.
2. Incubate at 37°C for 30 minutes.
3. Add trypsin-EDTA solution..."
                rows={16}
                className="text-sm font-mono resize-none"
              />
              <Button
                onClick={handleExtract}
                disabled={!protocolText.trim() || isExtracting}
                className="w-full mt-4"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Analyze Protocol
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Panel: 결과 */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-4">추출 결과</h2>

              {hasLowConfidenceItems && (
                <Alert className="mb-4 border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-sm text-orange-800">
                    일부 품목의 신뢰도가 낮습니다. 결과를 확인하고 필요시 수정해주세요.
                  </AlertDescription>
                </Alert>
              )}

              {extractionResult ? (
                <div className="space-y-3">
                  {extractionResult.items.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {extractionResult.items.map((item) => (
                          <ExtractionResultItem key={item.id} item={item} />
                        ))}
                      </div>
                      <Button
                        onClick={handleSendToCompare}
                        className="w-full"
                        variant="default"
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
                <div className="text-center py-12 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium mb-1">
                    프로토콜을 입력하고 분석을 시작하세요
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    입력하신 텍스트에서 필요한 시약과 장비를 자동으로 추출합니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

