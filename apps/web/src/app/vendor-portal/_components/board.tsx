"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {
  useVendorPortalStore,
  type VendorRfq,
} from "@/lib/vendor-portal/vendor-portal-store";
import { emitVendorQuoteAcknowledged } from "@/lib/vendor-portal/vendor-portal-events";
import { QuoteSubmitForm } from "./quote-submit-form";

/**
 * VendorPortalBoard
 *
 * URL ?vendorId=v1 기반 필터링 → 해당 공급사 RFQ만 표시.
 * 카드 클릭 시 우측에 견적 제출 폼이 슬라이드.
 */
export function VendorPortalBoard() {
  const params = useSearchParams();
  const vendorId = params.get("vendorId") ?? "";

  const rfqs = useVendorPortalStore((s) => s.rfqs);
  const submissions = useVendorPortalStore((s) => s.submissions);

  const myRfqs = useMemo<VendorRfq[]>(
    () => (vendorId ? rfqs.filter((r) => r.vendorId === vendorId) : []),
    [rfqs, vendorId],
  );

  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const activeRfq = activeCaseId
    ? myRfqs.find((r) => r.procurementCaseId === activeCaseId) ?? null
    : null;

  const handleOpenRfq = (rfq: VendorRfq) => {
    setActiveCaseId(rfq.procurementCaseId);
    // RFQ 카드 최초 진입 시 acknowledged event 1회 emit (dedupe)
    if (rfq.status === "request_for_quote" && !acknowledgedIds.has(rfq.procurementCaseId)) {
      emitVendorQuoteAcknowledged({
        procurementCaseId: rfq.procurementCaseId,
        vendorId: rfq.vendorId,
        vendorName: rfq.vendorName,
      });
      setAcknowledgedIds((prev) => {
        const next = new Set(prev);
        next.add(rfq.procurementCaseId);
        return next;
      });
    }
  };

  // ── Empty / unauthorized 컨텍스트 ────────────────────────────
  if (!vendorId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              공급사 ID가 지정되지 않았습니다
            </p>
            <p className="mt-1 text-xs text-amber-800">
              본 포털은 공급사별 전용 링크로 접근해야 합니다. 발송된 초대 메일의
              링크를 다시 확인해주세요. 예: <code className="rounded bg-white/60 px-1 py-0.5">/vendor-portal?vendorId=v1</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (myRfqs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          현재 진행 중인 RFQ가 없습니다
        </p>
        <p className="mt-1 text-xs text-slate-500">
          새로운 견적 요청이 도착하면 이 페이지에 표시됩니다.
        </p>
      </div>
    );
  }

  const pendingCount = myRfqs.filter((r) => r.status === "request_for_quote").length;
  const submittedCount = myRfqs.filter((r) => r.status === "quote_received").length;

  return (
    <div className="space-y-5">
      {/* ── 헤더 ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">견적 요청 (RFQ)</h1>
        <p className="mt-1 text-xs text-slate-500">
          요청 단가/납기를 입력하여 제출해주세요. 제출 후에는 내부 검토 단계로 전달됩니다.
        </p>
      </div>

      {/* ── 요약 카운터 ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile
          icon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
          label="제출 대기"
          value={pendingCount}
          accent="amber"
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          label="제출 완료"
          value={submittedCount}
          accent="emerald"
        />
        <SummaryTile
          icon={<ClipboardList className="h-3.5 w-3.5 text-slate-500" />}
          label="총 RFQ"
          value={myRfqs.length}
          accent="slate"
        />
      </div>

      {/* ── 본문: 좌측 RFQ 리스트 / 우측 폼 ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-2">
          {myRfqs.map((rfq) => {
            const submitted = submissions.find(
              (s) => s.procurementCaseId === rfq.procurementCaseId && s.vendorId === vendorId,
            );
            const isActive = activeCaseId === rfq.procurementCaseId;
            return (
              <RfqCard
                key={rfq.procurementCaseId}
                rfq={rfq}
                submittedTotal={submitted?.quotedTotal ?? null}
                active={isActive}
                onClick={() => handleOpenRfq(rfq)}
              />
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {activeRfq ? (
            <QuoteSubmitForm
              key={activeRfq.procurementCaseId}
              rfq={activeRfq}
              onClose={() => setActiveCaseId(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
              <p className="text-xs text-slate-500">
                좌측 RFQ를 선택하면 견적 제출 폼이 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Summary Tile ─────────────────────────────────────────────────────

function SummaryTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "amber" | "emerald" | "slate";
}) {
  const accentBorder =
    accent === "amber"
      ? "border-l-amber-500"
      : accent === "emerald"
        ? "border-l-emerald-500"
        : "border-l-slate-300";
  return (
    <div className={`rounded-lg border border-slate-200 border-l-2 ${accentBorder} bg-white px-3 py-2.5 shadow-sm`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

// ── RFQ Card ─────────────────────────────────────────────────────────

function RfqCard({
  rfq,
  submittedTotal,
  active,
  onClick,
}: {
  rfq: VendorRfq;
  submittedTotal: number | null;
  active: boolean;
  onClick: () => void;
}) {
  const isSubmitted = rfq.status === "quote_received";
  const dueLabel = rfq.responseDueAt
    ? new Date(rfq.responseDueAt).toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      })
    : "마감 미지정";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition-colors ${
        active
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {rfq.rfqNumber}
            </span>
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                <CheckCircle2 className="h-2.5 w-2.5" />
                제출 완료
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                <Clock className="h-2.5 w-2.5" />
                응답 대기
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
            {rfq.title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            품목 {rfq.items.length}건 · 마감 {dueLabel}
          </p>
          {isSubmitted && submittedTotal !== null && (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">
              제출 총액 {submittedTotal.toLocaleString()}원
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
      </div>
    </button>
  );
}
