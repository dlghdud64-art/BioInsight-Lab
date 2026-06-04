"use client";

/**
 * §11.82 #dashboard-operational-intelligence-redesign Phase 1
 *
 * §11.368 §0 — "운영 리포트" button + modal (AI 마케팅 라벨/✨ 제거, 결정형).
 * dashboard/page.tsx 헤더 우측에 배치되어 클릭 시 dialog 가 열리며
 * /api/analytics/ai-insight POST 호출 → 한국어 운영 분석 결과 표시.
 *
 * Endpoint:
 *   POST /api/analytics/ai-insight
 *   - 인증 + 조직 권한 확인
 *   - PurchaseRecord 60일 데이터를 Anthropic/Gemini 로 분석
 *   - returns { summary, dataPoints, analyzedAt }
 *   - 이미 /dashboard/analytics 페이지에서 사용 중 (alive endpoint)
 *
 * UX:
 *   - button 클릭 → dialog 열림 + 자동 mutate
 *   - loading 중: spinner + "운영 데이터 분석 중..."
 *   - success: AI summary + 분석 데이터 건수 + 시각
 *   - error: rose tone + 다시 시도 button
 *   - 재실행 button (재분석 가능)
 *
 * LabAxis 원칙:
 *   - dead button 0 — endpoint 검증 완료
 *   - fake success 0 — error 명시
 *   - mock 0 — real Anthropic/Gemini 호출
 *   - marketing decorative 0 — "REAL-TIME STATS LOCKED" 같은 표현 없음
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
// §11.368 §0 — ✨ Sparkles(AI 마케팅 데코) 제거 → FileText(기능 아이콘).
import { FileText, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { csrfFetch } from "@/lib/api-client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface AIInsightResponse {
  summary: string;
  dataPoints: number;
  analyzedAt?: string;
  error?: string;
}

/**
 * §11.243 #4 — 호영님 P0: 온보딩 모드(데이터 0건) 시 AI 리포트 비활성화.
 *   disabled prop 추가 — 운영 데이터가 없을 때 button + dialog 진입 차단,
 *   tooltip 으로 "운영 데이터가 쌓이면 AI 리포트를 생성할 수 있습니다" 안내.
 *   canonical truth lock: mutation 호출 자체를 차단하여 0 데이터 분석 방지.
 */
interface AIInsightDialogProps {
  disabled?: boolean;
  disabledReason?: string;
}

export function AIInsightDialog({
  disabled = false,
  disabledReason = "운영 데이터가 쌓이면 AI 리포트를 생성할 수 있습니다",
}: AIInsightDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<AIInsightResponse | null>(null);

  const mutation = useMutation<AIInsightResponse, Error, void>({
    mutationFn: async () => {
      const res = await csrfFetch("/api/analytics/ai-insight", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "리포트 생성에 실패했습니다");
      }
      return body as AIInsightResponse;
    },
    onSuccess: (data) => {
      setInsight(data);
    },
  });

  const handleOpen = (next: boolean) => {
    // §11.243 #4 — disabled 시 dialog open 차단 (mutation 호출 방지)
    if (disabled && next) return;
    setOpen(next);
    if (next && !insight && !mutation.isPending) {
      mutation.mutate();
    }
  };

  const handleRetry = () => {
    mutation.mutate();
  };

  const analyzedAtLabel = insight?.analyzedAt
    ? format(new Date(insight.analyzedAt), "yyyy-MM-dd HH:mm", { locale: ko })
    : null;

  /* §11.230c (b)-2 — Tooltip wrapper swap (disabled 시만 노출).
     enhanced Tooltip 의 focus 즉시 노출 + ESC 닫기 + aria-describedby chain
     으로 키보드 사용자에게 disabled 사유 명확 전달. enabled 시 wrapper 만 통과. */
  const button = (
    <Button
      size="sm"
      disabled={disabled}
      className={
        disabled
          ? "h-8 text-xs gap-1.5 bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          : "h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
      }
      onClick={() => handleOpen(true)}
    >
      {/* §11.368 §0 — AI 마케팅 라벨/그라데이션 제거 → 기능 라벨(운영 리포트). */}
      <FileText className="h-3.5 w-3.5" />
      운영 리포트
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {disabled ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <DialogContent className="max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* §11.368 §0 — Sparkles 제거, "AI 인사이트" → 기능 라벨. */}
            <FileText className="h-4 w-4 text-blue-600" />
            운영 리포트
          </DialogTitle>
          <DialogDescription className="text-xs break-keep">
            {/* §11.368 §0 — "조치 권고"(AI 결정 주체) → "조치 후보"(operator review 종착). */}
            최근 60일 구매 데이터를 분석하여 운영 패턴, 이상 징후, 조치 후보를 한국어로 요약합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {mutation.isPending ? (
            <div className="py-12 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400 mx-auto mb-3" />
              <p className="text-sm text-slate-700 font-medium">운영 데이터 분석 중...</p>
              <p className="text-[11px] text-slate-400 mt-1 break-keep">
                {/* §11.368 §0 — AI 주체 "검토"(operator 역할) → 기능 "분석". */}
                최근 구매 흐름을 분석하고 있습니다.
              </p>
            </div>
          ) : mutation.isError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-700">분석 실패</p>
                  <p className="text-xs text-rose-600 mt-0.5 break-keep">
                    {mutation.error?.message || "리포트 생성을 완료하지 못했습니다."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 h-8 text-xs gap-1.5"
                    onClick={handleRetry}
                  >
                    <RefreshCw className="h-3 w-3" />
                    다시 시도
                  </Button>
                </div>
              </div>
            </div>
          ) : insight ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-keep">
                  {insight.summary}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>분석 데이터 {insight.dataPoints.toLocaleString("ko-KR")}건</span>
                {analyzedAtLabel && <span>분석 시각: {analyzedAtLabel}</span>}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleRetry}
                  disabled={mutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" />
                  재분석
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">분석을 시작하려면 다이얼로그를 다시 열어주세요.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
