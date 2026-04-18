"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import {
  useVendorPortalStore,
  type VendorRfq,
} from "@/lib/vendor-portal/vendor-portal-store";

interface QuoteSubmitFormProps {
  rfq: VendorRfq;
  onClose: () => void;
}

/**
 * QuoteSubmitForm
 *
 * 외부 공급사가 단가/납기/비고를 입력하여 제출하는 폼.
 * 제출 시 store.submitQuote → governance event 발행.
 *
 * - 제출 후에는 폼이 read-only 확인 화면으로 전환된다.
 * - 합계는 단가 입력에 따라 자동 계산된 preview value (canonical truth는 내부 engine).
 */
export function QuoteSubmitForm({ rfq, onClose }: QuoteSubmitFormProps) {
  const submitQuote = useVendorPortalStore((s) => s.submitQuote);
  const submission = useVendorPortalStore((s) =>
    s.getSubmissionFor(rfq.procurementCaseId, rfq.vendorId),
  );

  const [unitPrices, setUnitPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const item of rfq.items) init[item.itemId] = "";
    return init;
  });
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    return rfq.items.reduce((sum, item) => {
      const raw = unitPrices[item.itemId] ?? "";
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return sum;
      return sum + n * item.quantity;
    }, 0);
  }, [rfq.items, unitPrices]);

  const allFilled = rfq.items.every((item) => {
    const n = Number(unitPrices[item.itemId] ?? "");
    return Number.isFinite(n) && n > 0;
  }) && Number.isFinite(Number(leadTimeDays)) && Number(leadTimeDays) > 0;

  // ── 제출 완료 상태 ──────────────────────────────────────────
  if (rfq.status === "quote_received" && submission) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">제출 완료</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 px-4 py-3 text-xs text-slate-600">
          <Row label="RFQ" value={rfq.rfqNumber} />
          <Row
            label="제출 일시"
            value={new Date(submission.submittedAt).toLocaleString("ko-KR")}
          />
          <Row label="총액" value={`${submission.quotedTotal.toLocaleString()}원`} bold />
          <Row label="납기" value={`${submission.leadTimeDays}일`} />
          {submission.notes && <Row label="비고" value={submission.notes} multiline />}
          <p className="mt-2 rounded-md bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-800">
            제출이 완료되었습니다. 내부 검토 후 결과가 별도 안내됩니다.
          </p>
        </div>
      </div>
    );
  }

  // ── 폼 입력 상태 ──────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const result = submitQuote({
      procurementCaseId: rfq.procurementCaseId,
      vendorId: rfq.vendorId,
      unitPrices: rfq.items.map((item) => ({
        itemId: item.itemId,
        unitPrice: Number(unitPrices[item.itemId] ?? "0"),
      })),
      leadTimeDays: Number(leadTimeDays),
      notes: notes.trim(),
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "제출에 실패했습니다.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {rfq.rfqNumber}
          </p>
          <h3 className="text-sm font-semibold text-slate-900 truncate">{rfq.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* 품목별 단가 입력 */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            품목별 단가
          </p>
          <div className="space-y-2">
            {rfq.items.map((item) => {
              const raw = unitPrices[item.itemId] ?? "";
              const n = Number(raw);
              const lineTotal = Number.isFinite(n) && n > 0 ? n * item.quantity : 0;
              return (
                <div
                  key={item.itemId}
                  className="rounded-md border border-slate-200 px-3 py-2"
                >
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {item.productName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    수량 {item.quantity}{item.unit}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="단가 (원)"
                      value={raw}
                      onChange={(e) =>
                        setUnitPrices((p) => ({ ...p, [item.itemId]: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs tabular-nums focus:border-slate-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 tabular-nums w-20 text-right">
                      = {lineTotal.toLocaleString()}원
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 총액 미리보기 */}
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">제출 총액 (미리보기)</span>
            <span className="text-base font-bold tabular-nums text-slate-900">
              {previewTotal.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 납기일 */}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            납기 (영업일)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="예: 7"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums focus:border-slate-900 focus:outline-none"
          />
        </div>

        {/* 비고 */}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            비고
          </label>
          <textarea
            rows={3}
            placeholder="추가 안내사항이 있다면 입력해주세요."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 w-full resize-none rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!allFilled || submitting}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          견적 제출
        </button>
      </div>
    </div>
  );
}

// ── helper ───────────────────────────────────────────────────────────

function Row({
  label,
  value,
  bold = false,
  multiline = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={`flex ${multiline ? "flex-col" : "items-center justify-between"} gap-1`}>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-xs ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}
