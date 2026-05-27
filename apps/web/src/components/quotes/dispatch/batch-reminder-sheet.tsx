"use client";

/**
 * §11.228 #quote-management-v2-phase-c1 — 호영님 v2 #20 일괄 처리 강화
 *
 * 일괄 리마인더 sheet. selectedQuotes 중 responseCount === 0 인 quote 만
 * filter → vendor-requests POST 재호출. 회신 받지 못한 공급사에 다시
 * 발송하는 follow-up 흐름. 일괄 처리 강화.
 *
 * canonical truth lock:
 *   - server endpoint 신설 0 — 기존 POST /api/quotes/[id]/vendor-requests 그대로.
 *   - resolveSuppliers / organizationVendors (§11.225 정합) 결과 사용.
 *   - Promise.allSettled (partial failure 수용) — all-or-nothing 0.
 *   - responseCount === 0 filter — client side preview 만, server resolve 가 truth.
 *   - 발송 후 onSuccess → page-level refetch + clearSelection + sheet close.
 *   - BatchDispatchSheet pattern 재사용 (§11.217 Phase 3 lineage).
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
import { Loader2, Bell, Mail, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveSuppliers } from "./resolve-suppliers";

// ── Types ──
interface ReminderQuote {
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

interface OrgVendor {
  id: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

interface BatchReminderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedQuotes: ReminderQuote[];
  /** 발송 완료 후 page-level refetch + clearSelection trigger */
  onSuccess: () => void;
  /**
   * §11.225 organizationVendorProducts lineage — 조직 거래처 (org_book source).
   * page-level useQuery `/api/organization-vendors` 응답 forward.
   */
  organizationVendors?: OrgVendor[];
}

// ── Per-quote reminder ──
type ReminderOutcome =
  | { quoteId: string; status: "success"; sent: number; failed: number }
  | { quoteId: string; status: "error"; message: string };

async function sendReminderForQuote(
  quote: ReminderQuote,
  message: string,
  expiresInDays: number,
  organizationVendors: OrgVendor[] = [],
): Promise<ReminderOutcome> {
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
        isReminder: true, // §11.228 — server-side hint (현재 server 가 무시해도 안전)
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "리마인더 발송 실패" }));
      // §11.228b — 429 rate-limit cooldown 명확 사용자 인지.
      //   server response { error: "RATE_LIMIT_EXCEEDED", cooldownHours, rateLimitedVendors }
      //   → 사용자에게 cooldown 사유 + 재시도 가능 시각 안내.
      if (response.status === 429 || error.error === "RATE_LIMIT_EXCEEDED") {
        const hours = error.cooldownHours ?? 24;
        return {
          quoteId: quote.id,
          status: "error",
          message: `최근 ${hours}시간 이내 발송된 공급사입니다. 잠시 후 다시 시도해주세요.`,
        };
      }
      return {
        quoteId: quote.id,
        status: "error",
        message: error.message || error.error || "리마인더 발송 실패",
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
export function BatchReminderSheet({
  open,
  onOpenChange,
  selectedQuotes,
  onSuccess,
  organizationVendors = [],
}: BatchReminderSheetProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(
    "안녕하세요. 견적 회신 기한이 다가오고 있어 다시 한 번 연락드립니다. 빠른 회신 부탁드립니다.",
  );
  const [expiresInDays] = useState(7);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // canonical filter: responseCount === 0 인 quote 만 리마인더 대상
  const { eligibleQuotes, alreadyRespondedQuotes } = useMemo(() => {
    const eligible: ReminderQuote[] = [];
    const responded: ReminderQuote[] = [];
    for (const q of selectedQuotes) {
      if ((q.responses?.length ?? 0) === 0) {
        eligible.push(q);
      } else {
        responded.push(q);
      }
    }
    return { eligibleQuotes: eligible, alreadyRespondedQuotes: responded };
  }, [selectedQuotes]);

  const eligibleCount = eligibleQuotes.length;
  const alreadyRespondedCount = alreadyRespondedQuotes.length;

  const handleSendReminders = async () => {
    if (eligibleCount === 0) return;

    setIsSending(true);
    setProgress({ done: 0, total: eligibleCount });

    // §11.228 — Promise.allSettled (partial failure 수용)
    const fetches = eligibleQuotes.map((quote) =>
      sendReminderForQuote(quote, message, expiresInDays, organizationVendors).then((outcome) => {
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

    setIsSending(false);

    if (failCount === 0) {
      toast({
        title: "리마인더 발송 완료",
        description: `${successCount}건 견적의 미응답 공급사에 리마인더가 발송되었습니다.`,
      });
    } else if (successCount === 0) {
      toast({
        variant: "destructive",
        title: "리마인더 발송 실패",
        description: failureMessages.slice(0, 3).join(" / "),
      });
    } else {
      toast({
        variant: "destructive",
        title: "일부 리마인더 발송 실패",
        description: `성공 ${successCount}건 · 실패 ${failCount}건. ${failureMessages[0] ?? ""}`,
      });
    }

    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            일괄 리마인더 발송
          </DialogTitle>
          <DialogDescription>
            회신을 받지 못한 견적 {eligibleCount}건에 리마인더를 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 통계 분리 */}
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-100 text-blue-800">
              <Bell className="h-3 w-3" />
              리마인더 대상 {eligibleCount}건
            </span>
            {alreadyRespondedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
                <CheckCircle2 className="h-3 w-3" />
                회신 수신 (제외) {alreadyRespondedCount}건
              </span>
            )}
          </div>

          {/* 대상 quote 미리보기 */}
          {eligibleCount > 0 ? (
            <div className="rounded-lg border border-bd bg-pn divide-y">
              {eligibleQuotes.slice(0, 5).map((q) => (
                <div key={q.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{q.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {q.items?.[0]?.product?.name ?? q.items?.[0]?.name ?? "—"}
                      {q.items.length > 1 ? ` 외 ${q.items.length - 1}건` : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 shrink-0">
                    <Mail className="h-3 w-3" />
                    미응답
                  </span>
                </div>
              ))}
              {eligibleCount > 5 && (
                <div className="px-3 py-2 text-[11px] text-slate-500 text-center">
                  외 {eligibleCount - 5}건
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">리마인더 대상이 없습니다</p>
                <p className="text-[11px] text-yellow-700 mt-0.5">
                  선택한 견적은 모두 이미 회신을 받았습니다.
                </p>
              </div>
            </div>
          )}

          {/* §11.228b — 발송 사유 + 추가 메시지 (운영자 컨텍스트 + Reminder 본문 보강).
              label/placeholder 보강 — "발송 사유 또는 추가 메시지" 명시화. */}
          {eligibleCount > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="reminder-message" className="text-xs font-medium text-slate-700">
                발송 사유 또는 추가 메시지 (선택)
              </label>
              <Textarea
                id="reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="text-sm"
                placeholder="예: 회신 기한이 임박했습니다. 빠른 답변 부탁드립니다."
              />
              <p className="text-[11px] text-slate-500 break-keep">
                입력한 메시지는 Reminder 메일 본문의 &quot;담당자 추가 메시지&quot; 섹션에 노출됩니다.
              </p>
            </div>
          )}

          {/* 진행 상황 */}
          {isSending && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="text-xs text-blue-800">
                리마인더 발송 중 ({progress.done}/{progress.total})
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            취소
          </Button>
          <Button
            onClick={handleSendReminders}
            disabled={eligibleCount === 0 || isSending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                발송 중
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-1" />
                {eligibleCount}건 리마인더 발송
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
