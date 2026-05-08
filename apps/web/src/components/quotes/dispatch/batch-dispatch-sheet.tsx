"use client";

/**
 * §11.217 Phase 3 — BatchDispatchSheet
 *
 * 견적 일괄 발송 review sheet. selectedQuotes 의 N quote summary +
 * auto-resolved supplier (read-only) + 공통 message + "전체 발송" CTA.
 *
 * canonical truth lock:
 *   - server endpoint 신설 0 — 기존 POST /api/quotes/[id]/vendor-requests 그대로.
 *   - resolveSuppliers / getQuoteDispatchPreflight (canonical helper) 결과 사용.
 *   - Promise.allSettled (partial failure 수용) — all-or-nothing 0.
 *   - hardBlock quote 별도 표시 + 단일 dispatch 분기 안내 (page-per-feature 회피).
 *   - 발송 후 onSuccess → page-level refetch + clearSelection + sheet close.
 *   - per-quote message 부재 (out of scope) — 공통 message 만.
 */

import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Mail, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveSuppliers } from "./resolve-suppliers";

// ── Types ──
interface BatchQuote {
  id: string;
  title: string;
  items: Array<{
    id: string;
    product: { id: string; name: string };
    quantity: number;
    name?: string | null;
  }>;
  responses?: Array<unknown>;
  status: string;
  createdAt: string;
}

interface PreflightResult {
  hardBlocked: boolean;
  summary: string;
  blockers: string[];
}

interface OrgVendor {
  id: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

interface BatchDispatchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedQuotes: BatchQuote[];
  /** page-level helper — getQuoteDispatchPreflight(q) — canonical truth */
  getPreflight: (quote: BatchQuote) => PreflightResult;
  /** 발송 완료 후 page-level refetch + clearSelection trigger */
  onSuccess: () => void;
  /**
   * #user-supplier-registration Phase 5 — 조직 거래처 (org_book source).
   * page-level useQuery `/api/organization-vendors` 응답 forward.
   * 미전달 시 빈 array fallback (backward compat).
   */
  organizationVendors?: OrgVendor[];
}

// ── Per-quote dispatch ──
type DispatchOutcome =
  | { quoteId: string; status: "success"; sent: number; failed: number }
  | { quoteId: string; status: "error"; message: string };

async function dispatchSingleQuote(
  quote: BatchQuote,
  message: string,
  expiresInDays: number,
  organizationVendors: OrgVendor[] = [],
): Promise<DispatchOutcome> {
  // #user-supplier-registration Phase 5 — org_book source forward.
  const suppliers = resolveSuppliers({ quote: quote as never, organizationVendors });
  const includedSuppliers = suppliers.filter((s) => s.included && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email));

  if (includedSuppliers.length === 0) {
    return {
      quoteId: quote.id,
      status: "error",
      message: "연락 가능한 공급사 후보 없음",
    };
  }

  const vendors = includedSuppliers.map((s) => ({
    email: s.email,
    name: s.vendorName,
  }));

  try {
    const response = await csrfFetch(`/api/quotes/${quote.id}/vendor-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendors,
        message: message.trim() || undefined,
        expiresInDays,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "발송 실패" }));
      return {
        quoteId: quote.id,
        status: "error",
        message: error.message || error.error || "발송 실패",
      };
    }

    const result = await response.json();
    return {
      quoteId: quote.id,
      status: "success",
      sent: result.summary?.emailsSent ?? result.createdRequests?.length ?? 0,
      failed: result.summary?.emailsFailed ?? 0,
    };
  } catch (err: unknown) {
    return {
      quoteId: quote.id,
      status: "error",
      message: err instanceof Error ? err.message : "네트워크 오류",
    };
  }
}

// ── Component ──
export function BatchDispatchSheet({
  open,
  onOpenChange,
  selectedQuotes,
  getPreflight,
  onSuccess,
  organizationVendors = [],
}: BatchDispatchSheetProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [expiresInDays] = useState(14);
  const [isDispatching, setIsDispatching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // canonical truth: preflight 으로 dispatchable / hardBlock 분류
  const { dispatchableQuotes, hardBlockQuotes } = useMemo(() => {
    const dispatchable: Array<{ quote: BatchQuote; preflight: PreflightResult }> = [];
    const hardBlock: Array<{ quote: BatchQuote; preflight: PreflightResult }> = [];
    for (const q of selectedQuotes) {
      const p = getPreflight(q);
      if (p.hardBlocked) hardBlock.push({ quote: q, preflight: p });
      else dispatchable.push({ quote: q, preflight: p });
    }
    return { dispatchableQuotes: dispatchable, hardBlockQuotes: hardBlock };
  }, [selectedQuotes, getPreflight]);

  const dispatchableCount = dispatchableQuotes.length;
  const hardBlockCount = hardBlockQuotes.length;

  const handleDispatch = async () => {
    if (dispatchableCount === 0) return;

    setIsDispatching(true);
    setProgress({ done: 0, total: dispatchableCount });

    // §11.217 Phase 3 — Promise.allSettled (partial failure 수용).
    // dispatchable quote 만 fetch 발송, hardBlock 은 client-side 제외.
    // #user-supplier-registration Phase 5 — organizationVendors forward
    //   to dispatchSingleQuote → resolveSuppliers org_book source 활성화.
    const fetches = dispatchableQuotes.map(({ quote }) =>
      dispatchSingleQuote(quote, message, expiresInDays, organizationVendors).then((outcome) => {
        setProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
        return outcome;
      }),
    );

    const results = await Promise.allSettled(fetches);

    // 결과 합산
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

    setIsDispatching(false);

    // toast 합산
    if (failCount === 0 && hardBlockCount === 0) {
      toast({
        title: "일괄 발송 완료",
        description: `${successCount}건 견적 요청이 발송되었습니다.`,
      });
    } else {
      toast({
        title: failCount > 0 ? "일괄 발송 부분 완료" : "일괄 발송 완료 (보류 포함)",
        description: `완료 ${successCount}건${failCount > 0 ? ` · 실패 ${failCount}건` : ""}${hardBlockCount > 0 ? ` · 제외 ${hardBlockCount}건` : ""}`,
        variant: failCount > 0 ? "destructive" : "default",
      });
    }

    // §11.217 Phase 3 — onSuccess: page-level refetch + clearSelection + sheet close.
    onSuccess();
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-slate-200 p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Send className="h-4 w-4 text-violet-600" />
              </div>
              일괄 발송 검토 — {selectedQuotes.length}건
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              발송 가능 {dispatchableCount}건
              {hardBlockCount > 0 && ` · 보류 ${hardBlockCount}건`}
              {" · 공급사는 자동 추정된 결과를 사용합니다."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* 본문 — 발송 가능 + 보류 quote 분리 */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
          {/* 발송 가능 quote 목록 */}
          {dispatchableQuotes.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                발송 가능 ({dispatchableQuotes.length}건)
              </h4>
              <ul className="space-y-1.5">
                {dispatchableQuotes.map(({ quote, preflight }) => {
                  const firstItem = quote.items[0];
                  const firstItemName = firstItem?.product?.name ?? firstItem?.name ?? null;
                  const moreCount = Math.max(0, quote.items.length - 1);
                  const display = firstItemName
                    ? moreCount > 0
                      ? `${firstItemName} 외 ${moreCount}건`
                      : firstItemName
                    : quote.title;
                  return (
                    <li
                      key={quote.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-emerald-100 bg-emerald-50/40"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mail className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-sm text-slate-900 truncate">{display}</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-medium shrink-0">
                        {preflight.summary}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* 보류 quote 목록 (hardBlock — 제외 사유 표시) */}
          {hardBlockQuotes.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                보류 — 단일 발송으로 처리 ({hardBlockQuotes.length}건)
              </h4>
              <ul className="space-y-1.5">
                {hardBlockQuotes.map(({ quote, preflight }) => {
                  const firstItem = quote.items[0];
                  const firstItemName = firstItem?.product?.name ?? firstItem?.name ?? null;
                  const display = firstItemName ?? quote.title;
                  return (
                    <li
                      key={quote.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-amber-100 bg-amber-50/40"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-slate-700 truncate">{display}</span>
                      </div>
                      <span className="text-[11px] text-amber-700 shrink-0 truncate max-w-[40%]" title={preflight.summary}>
                        {preflight.summary}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                보류 견적은 카드를 직접 열어 단일 발송으로 처리해 주세요.
              </p>
            </section>
          )}

          {/* 공통 message Textarea */}
          <section>
            <label htmlFor="batch-dispatch-message" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
              공통 메시지 (선택)
            </label>
            <Textarea
              id="batch-dispatch-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 납기 마감일이나 추가 안내사항이 있으면 입력해 주세요. 모든 견적에 동일하게 적용됩니다."
              rows={3}
              disabled={isDispatching}
              className="text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              공급사별 다른 메시지가 필요하면 단일 발송으로 진행해 주세요.
            </p>
          </section>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className="text-[11px] text-slate-500">
            {isDispatching
              ? `발송 중… ${progress.done}/${progress.total}`
              : `발송 가능 ${dispatchableCount}건 — 보류 ${hardBlockCount}건 제외`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isDispatching}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDispatch}
              disabled={isDispatching || dispatchableCount === 0}
              className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white disabled:bg-violet-200 disabled:text-violet-400"
              title={dispatchableCount === 0 ? "발송 가능한 견적이 없습니다." : `${dispatchableCount}건 견적 일괄 발송`}
            >
              {isDispatching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  발송 중…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  전체 발송 ({dispatchableCount}건)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
