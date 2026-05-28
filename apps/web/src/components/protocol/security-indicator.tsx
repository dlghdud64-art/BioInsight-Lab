"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Lock, AlertCircle } from "lucide-react";

export function SecurityIndicator() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100 transition-colors cursor-help font-semibold px-3 py-1.5"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5 text-green-600" />
            Zero Data Retention Mode
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="text-sm font-medium mb-1">데이터 보안 보장</p>
          <p className="text-xs">
            입력하신 데이터는 분석 후 즉시 파기되며, 서버에 저장되거나 AI 학습에 사용되지 않습니다.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SecurityAlert() {
  return (
    <Alert className="border-green-200 bg-green-50/50">
      <Lock className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-sm text-green-800">
        <span className="font-semibold">보안 모드 작동 중:</span> 데이터는 로컬에서 처리되며 분석 후 즉시 파기됩니다.
      </AlertDescription>
    </Alert>
  );
}

