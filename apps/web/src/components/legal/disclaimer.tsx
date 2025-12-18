/**
 * 면책 고지 문구 컴포넌트
 * PRD 15.6 문구/면책(Disclaimer) 기본 세트 기반
 */

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type DisclaimerType = "datasheet" | "safety" | "price" | "rfq";

interface DisclaimerProps {
  type: DisclaimerType;
  className?: string;
}

const disclaimerTexts: Record<DisclaimerType, string> = {
  datasheet:
    "AI 번역/요약은 참고용입니다. 규격·안전·규제 관련 최종 판단은 원문 및 공식 문서를 확인하세요.",
  safety:
    "안전·규제 정보는 참고용이며, 취급/보관/폐기 지침은 SDS/MSDS 원문을 우선 확인하세요.",
  price:
    "가격/납기/재고 정보는 제공 시점/벤더 정책에 따라 달라질 수 있습니다.",
  rfq:
    "BioInsight Lab은 견적요청 준비 및 회신 정리를 돕는 도구입니다. 계약/거래는 사용자와 벤더 간에 이루어집니다.",
};

export function Disclaimer({ type, className }: DisclaimerProps) {
  return (
    <Alert variant="default" className={`bg-amber-50 border-amber-200 ${className || ""}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-xs text-amber-800">
        {disclaimerTexts[type]}
      </AlertDescription>
    </Alert>
  );
}









