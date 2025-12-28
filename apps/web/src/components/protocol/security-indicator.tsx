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
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors cursor-help"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-green-600" />
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
      <span className="text-xs text-slate-600">
        연구 데이터 보호 모드: 입력된 내용은 분석 후 즉시 파기됩니다.
      </span>
    </div>
  );
}

