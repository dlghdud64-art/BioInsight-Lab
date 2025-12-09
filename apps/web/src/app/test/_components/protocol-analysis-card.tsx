"use client";

import { TestCard } from "./test-card";
import { FileText } from "lucide-react";

interface ProtocolAnalysisCardProps {
  extractionResult?: {
    reagents?: Array<{
      name: string;
      quantity?: string;
      unit?: string;
      description?: string;
    }>;
    summary?: string;
    [key: string]: any;
  } | null;
}

export function ProtocolAnalysisCard({ extractionResult }: ProtocolAnalysisCardProps) {
  return (
    <TestCard
      title="프로토콜 필드 추출"
      subtitle="붙여넣은 텍스트에서 자동 추출된 제품 스펙을 확인합니다."
    >
      {extractionResult ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium">추출 결과</span>
          </div>
          {extractionResult.reagents && extractionResult.reagents.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2">추출된 시약:</p>
              <div className="space-y-1">
                {extractionResult.reagents.slice(0, 5).map((r, idx) => (
                  <div key={idx} className="text-xs p-2 bg-slate-50 rounded">
                    <div className="font-medium">{r.name}</div>
                    {r.quantity && (
                      <div className="text-muted-foreground">
                        예상 수량: {r.quantity} {r.unit || ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {extractionResult.summary && (
            <div>
              <p className="text-xs font-medium mb-1">요약:</p>
              <p className="text-xs text-muted-foreground">{extractionResult.summary}</p>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw JSON 보기
            </summary>
            <pre className="mt-2 p-2 bg-slate-100 rounded text-[10px] overflow-auto">
              {JSON.stringify(extractionResult, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          프로토콜 텍스트를 입력하고 "필드 추출 테스트"를 클릭하세요.
        </p>
      )}
    </TestCard>
  );
}

