"use client";

/**
 * §11.228 #quote-management-v2-phase-c1 — 호영님 v2 #20 일괄 처리 강화
 *
 * 일괄 상태 변경 sheet. selectedQuotes 의 status 를 N건 한꺼번에
 * PATCH /api/quotes/[id]/status 호출하여 변경. invalid transition 은 server
 * 가 reject 하고 client 는 partial failure 통계 노출.
 *
 * canonical truth lock:
 *   - server endpoint 신설 0 — 기존 PATCH /api/quotes/[id]/status 그대로.
 *   - ALLOWED_STATUS_TRANSITIONS server-side validate — UI 가 reject 사유 표시.
 *   - Promise.allSettled (partial failure 수용).
 *   - 상태 변경 후 onSuccess → page-level refetch + clearSelection + sheet close.
 *   - reason input UI 0 (out of scope — §11.228 spec).
 */

import { useState } from "react";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──
type TargetQuoteStatus = "COMPLETED" | "CANCELLED" | "PENDING";

interface StatusChangeQuote {
  id: string;
  title: string;
  status: string;
}

interface BatchStatusChangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedQuotes: StatusChangeQuote[];
  /** 상태 변경 완료 후 page-level refetch + clearSelection trigger */
  onSuccess: () => void;
}

// 상태 옵션 — 호영님 v2 spec: 완료 / 취소 / 대기 (재활성화)
const STATUS_OPTIONS: Array<{ value: TargetQuoteStatus; label: string; description: string }> = [
  {
    value: "COMPLETED",
    label: "완료",
    description: "비교·승인이 끝나 운영 마무리된 견적으로 표기",
  },
  {
    value: "CANCELLED",
    label: "취소",
    description: "더 진행하지 않을 견적으로 표기",
  },
  {
    value: "PENDING",
    label: "대기로 되돌리기",
    description: "취소된 견적을 다시 활성화",
  },
];

// ── Per-quote status change ──
type StatusChangeOutcome =
  | { quoteId: string; status: "success" }
  | { quoteId: string; status: "error"; message: string };

async function changeQuoteStatus(
  quote: StatusChangeQuote,
  targetStatus: TargetQuoteStatus,
): Promise<StatusChangeOutcome> {
  try {
    const response = await csrfFetch(`/api/quotes/${quote.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "상태 변경 실패" }));
      return {
        quoteId: quote.id,
        status: "error",
        message: error.message || error.error || "상태 변경 실패",
      };
    }

    return { quoteId: quote.id, status: "success" };
  } catch (err: unknown) {
    return {
      quoteId: quote.id,
      status: "error",
      message: err instanceof Error ? err.message : "네트워크 오류",
    };
  }
}

// ── Component ──
export function BatchStatusChangeSheet({
  open,
  onOpenChange,
  selectedQuotes,
  onSuccess,
}: BatchStatusChangeSheetProps) {
  const { toast } = useToast();
  const [targetStatus, setTargetStatus] = useState<TargetQuoteStatus>("COMPLETED");
  const [isChanging, setIsChanging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const totalCount = selectedQuotes.length;
  const targetLabel = STATUS_OPTIONS.find((o) => o.value === targetStatus)?.label ?? targetStatus;

  const handleChangeStatus = async () => {
    if (totalCount === 0) return;

    setIsChanging(true);
    setProgress({ done: 0, total: totalCount });

    // §11.228 — Promise.allSettled (partial failure 수용)
    // invalid transition 은 server 가 reject — UI 는 통계 표시
    const fetches = selectedQuotes.map((quote) =>
      changeQuoteStatus(quote, targetStatus).then((outcome) => {
        setProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
        return outcome;
      }),
    );

    const results = await Promise.allSettled(fetches);

    let successCount = 0;
    let failCount = 0;
    const failureMessages: string[] = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.status === "success") {
          successCount += 1;
        } else {
          failCount += 1;
          failureMessages.push(`${r.value.quoteId.slice(0, 8)}: ${r.value.message}`);
        }
      } else {
        failCount += 1;
        failureMessages.push(`unknown: ${r.reason}`);
      }
    }

    setIsChanging(false);

    if (failCount === 0) {
      toast({
        title: "상태 변경 완료",
        description: `${successCount}건 견적이 "${targetLabel}"(으)로 변경되었습니다.`,
      });
    } else if (successCount === 0) {
      toast({
        variant: "destructive",
        title: "상태 변경 실패",
        description: failureMessages.slice(0, 2).join(" / "),
      });
    } else {
      toast({
        variant: "destructive",
        title: "일부 상태 변경 실패",
        description: `성공 ${successCount}건 · 실패 ${failCount}건. ${failureMessages[0] ?? ""}`,
      });
    }

    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-violet-600" />
            견적 상태 일괄 변경
          </DialogTitle>
          <DialogDescription>
            선택한 견적 {totalCount}건의 상태를 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 변경할 상태 선택 — RadioGroup 부재로 native radio 사용 */}
          <div className="space-y-2" role="radiogroup" aria-label="변경할 상태">
            <p className="text-xs font-medium text-slate-700">변경할 상태</p>
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = targetStatus === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`status-${opt.value}`}
                  className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-violet-400 bg-violet-50/60"
                      : "border-bd hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    id={`status-${opt.value}`}
                    name="targetStatus"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setTargetStatus(opt.value)}
                    className="mt-0.5 h-4 w-4 accent-violet-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* invalid transition 안내 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">
              현재 상태에서 전환할 수 없는 견적은 서버가 차단합니다. 변경 후 성공/실패 결과가 표시됩니다.
            </p>
          </div>

          {/* 진행 상황 */}
          {isChanging && (
            <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-violet-600 animate-spin" />
              <span className="text-xs text-violet-800">
                상태 변경 중 ({progress.done}/{progress.total})
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isChanging}
          >
            취소
          </Button>
          <Button
            onClick={handleChangeStatus}
            disabled={totalCount === 0 || isChanging}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isChanging ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                변경 중
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                {totalCount}건 상태 변경
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
