"use client";

/**
 * §quotes-mobile-refine P3 #mobile-reminder-sheet — 개별 케이스 회신 리마인더 바텀 시트 (지시문 4a)
 *
 * 정본: docs/plans/PLAN_quotes-mobile-refine.md P3 + 호영님 지시문(2026-07-21) §2.
 *
 * canonical truth lock:
 *   - 대상 = deriveReminderTargets(미회신 공급사만 자동 필터, 회신 완료 제외) — P2 lib 파생.
 *   - 발송 = 기존 POST /api/quotes/[id]/vendor-requests + isReminder:true (경로 이원화 0 —
 *     batch-reminder-sheet 와 동일 계약). 서버가 재발송 거버넌스·리마인더 템플릿·24h rate-limit(429)·
 *     활동 로그(createActivityLog)를 보유(P0-G1) → "활동 로그에 기록됩니다" 문구는 실배선 사실 서술.
 *   - D+N 경과 배지 = createdAt 실값 파생(미상 시 생략, 가짜 경과일 0).
 *   - 압박 어휘 0 (이번 트랙 3 surface 한정 규칙 — 호영님 2026-07-21).
 *   - 색: warm warning = yellow 토큰(색상 표기 규약 07-20).
 *
 * 상태: 로딩(발송 중)·에러(사유 노출, 429 cooldown 안내)·빈(미회신 0곳 = CTA disabled + 사유 인라인).
 */

import { useEffect, useMemo, useState } from "react";
import { csrfFetch } from "@/lib/api-client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  deriveReminderTargets,
  toReminderVendorsPayload,
} from "@/lib/quote-management/reminder-targets";
import { quoteDisplayRef } from "@/lib/quote-management/quote-display-ref";

interface QuoteForReminder {
  id: string;
  title: string;
  quoteNumber?: string | null;
  items?: Array<{ product: { name: string } }>;
  vendorRequests?: Array<{
    vendorName?: string | null;
    vendorEmail?: string | null;
    respondedAt?: string | Date | null;
    status?: string | null;
    createdAt?: string | Date | null;
  }>;
}

export interface MobileReminderSheetProps {
  quote: QuoteForReminder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 마감 D-day 텍스트(케이스 요약용, page 파생 주입 — 중복 계산 0). null 이면 생략. */
  ddLabel?: string | null;
  /** 발송 성공 → page refetch. */
  onSuccess: () => void;
}

// 자동 생성 기본 문구 — 압박 어휘 0(요청 톤).
const DEFAULT_MESSAGE =
  "안녕하세요. 앞서 보내드린 견적 요청에 대한 회신을 기다리고 있습니다. 가능하신 시점에 회신 부탁드립니다.";

export function MobileReminderSheet({ quote, open, onOpenChange, ddLabel, onSuccess }: MobileReminderSheetProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [expiresInDays, setExpiresInDays] = useState(3);
  const [sending, setSending] = useState(false);

  // 시트 재오픈 시 초기화(이전 케이스 문구 잔존 방지).
  useEffect(() => {
    if (open) {
      setMessage(DEFAULT_MESSAGE);
      setExpiresInDays(3);
      setSending(false);
    }
  }, [open, quote?.id]);

  // 미회신 공급사만 — canonical 파생(P2). 회신 완료는 목록에서 제외(지시문 규칙).
  const targets = useMemo(() => deriveReminderTargets(quote?.vendorRequests), [quote]);
  const sendable = useMemo(() => toReminderVendorsPayload(targets), [targets]);

  if (!quote) return null;
  const itemName = quote.items?.[0]?.product?.name ?? quote.title;
  const ref = quoteDisplayRef(quote);

  const handleSend = async () => {
    if (sendable.length === 0 || sending) return;
    setSending(true);
    try {
      const res = await csrfFetch(`/api/quotes/${quote.id}/vendor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendors: sendable,
          message: message.trim() || undefined,
          expiresInDays,
          isReminder: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "리마인더 발송 실패" }));
        if (res.status === 429 || err.error === "RATE_LIMIT_EXCEEDED") {
          const hours = err.cooldownHours ?? 24;
          toast({
            title: "잠시 후 다시 시도해 주세요",
            description: `최근 ${hours}시간 이내 발송된 공급사입니다.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "리마인더 발송 실패", description: err.message || err.error, variant: "destructive" });
        }
        return;
      }
      toast({ title: `리마인더를 발송했습니다 · ${sendable.length}곳` });
      onOpenChange(false);
      onSuccess();
    } catch {
      toast({ title: "리마인더 발송 실패", description: "네트워크 상태를 확인해 주세요.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[88dvh] overflow-y-auto">
        {/* 그랩바 */}
        <div className="sticky top-0 bg-white pt-2.5 pb-1 rounded-t-2xl">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        </div>
        <div className="px-4 pb-6 space-y-4">
          {/* ① 헤더 */}
          <div>
            <SheetTitle className="flex items-center gap-1.5 text-[16px] font-extrabold text-slate-900">
              <Bell className="h-4 w-4 text-yellow-600" />회신 리마인더
            </SheetTitle>
            <p className="text-[12.5px] text-slate-500 mt-0.5">아직 회신하지 않은 공급사에게 보냅니다</p>
          </div>

          {/* ② 케이스 요약 */}
          <div className="rounded-[13px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-extrabold text-slate-900 line-clamp-1">{itemName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-semibold tracking-[.03em]">
                  {ref}
                  {ddLabel && <span className="tracking-normal"> · 마감 {ddLabel}</span>}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />회신 추적
              </span>
            </div>
          </div>

          {/* ③ 받는 공급사 — 미회신만 자동 필터 */}
          <div>
            <h3 className="text-[12.5px] font-extrabold text-slate-900">
              받는 공급사 <span className="text-slate-400 font-semibold">· 미회신 {targets.length}곳</span>
            </h3>
            {targets.length === 0 ? (
              <div className="mt-2 rounded-[11px] border border-slate-200 bg-white p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <p className="text-[12.5px] text-slate-600">모든 공급사가 회신을 완료했습니다.</p>
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {targets.map((t, i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-[11px] border border-slate-200 bg-white px-3 py-2.5">
                    <span className="h-8 w-8 shrink-0 rounded-full bg-slate-100 grid place-items-center text-[12px] font-bold text-slate-600">{t.initial}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-900 line-clamp-1">{t.name}</p>
                      <p className="text-[11px] text-slate-400">회신 0/1{!t.sendable && " · 이메일 미등록"}</p>
                    </div>
                    {/* D+N 경과 배지 — createdAt 실값에서만(가짜 경과일 0). warm warning = yellow. */}
                    {t.daysSince != null && t.daysSince > 0 && (
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 tabular-nums">
                        D+{t.daysSince}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ④ 전달 메시지 — 자동 생성 + 수정 가능 */}
          <div>
            <h3 className="text-[12.5px] font-extrabold text-slate-900">
              전달 메시지 <span className="text-slate-400 font-semibold">· 자동 생성</span>
            </h3>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[11px] border border-slate-200 bg-white p-3 text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              aria-label="전달 메시지"
            />
          </div>

          {/* ⑤ 재응답 기한 */}
          <div className="flex items-center justify-between">
            <h3 className="text-[12.5px] font-extrabold text-slate-900">재응답 기한</h3>
            <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
              <input
                type="number"
                min={1}
                max={30}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="w-16 h-10 rounded-[10px] border border-slate-200 text-center text-[14px] font-bold text-slate-900 tabular-nums"
                aria-label="재응답 기한(일)"
              />
              일
            </label>
          </div>

          {/* ⑥ 활동 로그 고지(실배선 — 서버 createActivityLog) + 발송 CTA */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-slate-400 text-center">발송 내역은 활동 로그에 기록됩니다</p>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendable.length === 0 || sending}
              className="w-full min-h-[48px] rounded-[12px] bg-yellow-600 text-white text-[14.5px] font-extrabold active:scale-[.99] disabled:bg-slate-100 disabled:text-slate-400 inline-flex items-center justify-center gap-1.5"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />발송 중…</>
              ) : sendable.length === 0 ? (
                targets.length === 0 ? "발송 대상 없음 · 전원 회신 완료" : "발송 가능 이메일 없음"
              ) : (
                <><Bell className="h-4 w-4" />리마인더 발송 · {sendable.length}곳</>
              )}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
