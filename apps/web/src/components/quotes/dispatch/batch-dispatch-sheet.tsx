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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Mail, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { labToast } from "@/lib/toast/lab-toast";
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
  // §quote-management P4-dispatch — 응답 기한 operator 선택(서버 expiresAt=now+선택일 → s2 마감·computePriority 반영).
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [isDispatching, setIsDispatching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  // §3-batch(호영님 견적 고도화 2026-07-13) — 배치 발송 확인 관문. "전체 발송" 클릭이
  //   중간 확인 없이 allSettled 팬아웃 → 오발송 방지 위해 확인 AlertDialog 경유.
  //   단일 경로 yellow/green 이분기 복제 아님 — 배치 구성 요약형(발송 가능 N · 보류 M 제외).
  const [confirmOpen, setConfirmOpen] = useState(false);

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

    // §action-toast P3(호영님 2026-07-08) — 결과 토스트(실 집계 분기). 전건 성공=success·자동 닫힘,
    //   실패/제외 있으면 partial(수동)+액션. Before 회색 결과 박스 대체.
    onSuccess();
    setMessage("");
    if (failCount === 0 && hardBlockCount === 0) {
      labToast.success("일괄 발송 완료", `<b>${successCount}건</b> 견적 요청이 발송되었습니다.`);
      onOpenChange(false);
    } else {
      labToast.partial(
        failCount > 0 ? "일괄 발송 부분 완료" : "일괄 발송 완료 (보류 포함)",
        `<b>${successCount}건 발송</b>${failCount > 0 ? ` · 실패 ${failCount}건` : ""}${hardBlockCount > 0 ? ` · 제외 ${hardBlockCount}건` : ""}`,
        {
          actions:
            failCount > 0
              ? [{ label: "다시 시도", primary: true, onClick: () => { void handleDispatch(); } }]
              : [{ label: `제외 ${hardBlockCount}건 보기`, primary: true, keepOpen: true }],
        },
      );
      // partial(실패/제외)은 sheet 유지 → 제외·실패 건 preflight 노출("제외 N건 보기"). 전건 성공만 자동 닫힘.
    }
  };

  return (
    <>
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
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
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
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-yellow-100 bg-yellow-50/40"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-slate-700 truncate">{display}</span>
                      </div>
                      <span className="text-[11px] text-yellow-700 shrink-0 truncate max-w-[40%]" title={preflight.summary}>
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

          {/* §quote-management P4-dispatch — 응답 기한(expiresInDays) operator 선택.
              expiresAt = now + 선택일 → s2 마감/우선순위(computePriority)에 그대로 반영(P4-core-A 읽음). */}
          <section>
            <label htmlFor="batch-dispatch-window" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
              응답 기한
            </label>
            <select
              id="batch-dispatch-window"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              disabled={isDispatching}
              className="h-9 min-h-[44px] sm:min-h-0 w-full sm:w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50"
            >
              <option value={3}>3일 이내</option>
              <option value={5}>5일 이내</option>
              <option value={7}>7일 이내</option>
              <option value={14}>14일 이내</option>
              <option value={30}>30일 이내</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              공급사 회신 마감일이 됩니다. 회신 추적·우선순위에 반영됩니다.
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
              onClick={() => setConfirmOpen(true)}
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

    {/* §3-batch — 배치 발송 확인 관문. 발송 가능분만 발송(보류 자동 제외, front-only success 0). */}
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent data-testid="batch-dispatch-confirm-modal" className="bg-white border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle>{dispatchableCount}건 견적을 발송할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            선택한 공급사에게 실제 이메일이 발송됩니다. 발송 후 취소할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div
          data-testid="batch-dispatch-confirm-summary"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        >
          <span className="font-medium text-slate-900">발송 가능 {dispatchableCount}건</span>
          {hardBlockCount > 0 && (
            <span className="text-slate-600">
              {" · "}보류 {hardBlockCount}건 제외
            </span>
          )}
          {hardBlockCount > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              보류 견적은 발송 대상에서 빠집니다. 사유는 위 목록에서 확인해 주세요.
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDispatching}>다시 검토</AlertDialogCancel>
          <Button
            type="button"
            disabled={isDispatching || dispatchableCount === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-400"
            onClick={() => {
              setConfirmOpen(false);
              void handleDispatch();
            }}
          >
            <Send className="mr-2 h-4 w-4" />
            확인 · {dispatchableCount}건 지금 발송
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
