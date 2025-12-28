"use client";

import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { AlertCircle, Info } from "lucide-react";

interface ExtractionResultItemProps {
  item: {
    id: string;
    name: string;
    category?: string;
    quantity?: string;
    unit?: string;
    confidence?: "high" | "medium" | "low";
    evidence?: string; // AI 추출 근거 문구
  };
}

export function ExtractionResultItem({ item }: ExtractionResultItemProps) {
  const isLowConfidence = item.confidence === "low";

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: Name + Category */}
          <div className="flex items-start gap-2">
            <h4 className="font-semibold text-sm text-slate-900 flex-1">
              {item.name}
            </h4>
            {item.category && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {item.category}
              </Badge>
            )}
          </div>

          {/* Bottom: Quantity/Unit */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {item.quantity && (
              <span>
                수량: <span className="font-medium">{item.quantity} {item.unit || ""}</span>
              </span>
            )}
            {item.confidence && (
              <Badge
                variant={isLowConfidence ? "secondary" : "outline"}
                className={`text-xs ${
                  isLowConfidence
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                신뢰도: {item.confidence === "high" ? "높음" : item.confidence === "medium" ? "보통" : "낮음"}
              </Badge>
            )}
          </div>
        </div>

        {/* Right: Icons */}
        <div className="flex items-start gap-1.5 flex-shrink-0">
          {isLowConfidence && (
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
          )}
          {item.evidence && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <button 
                  className="text-slate-400 hover:text-blue-600 transition-colors mt-0.5"
                  title="출처 보기"
                >
                  <Info className="h-4 w-4" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <div className="font-semibold text-sm text-slate-900">
                      AI 추출 근거
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 italic leading-relaxed bg-slate-50 p-3 rounded border-l-2 border-blue-500">
                    "{item.evidence}"
                  </div>
                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                    💡 원문에서 이 부분을 참고하여 추출했습니다.
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
      </div>
    </div>
  );
}

