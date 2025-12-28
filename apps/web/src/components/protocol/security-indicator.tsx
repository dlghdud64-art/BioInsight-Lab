"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck } from "lucide-react";

export function SecurityIndicator() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors cursor-help"
          >
            <ShieldCheck className="h-3 w-3 mr-1.5" />
            Zero Data Retention Mode
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">
            입력하신 데이터는 분석 후 즉시 파기되며, 서버에 저장되거나 AI 학습에 사용되지 않습니다.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

