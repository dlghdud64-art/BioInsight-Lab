"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ShieldAlert,
  PackageCheck,
} from "lucide-react";
import {
  useVendorPortalStore,
  type VendorPoDocument,
} from "@/lib/vendor-portal/vendor-portal-store";

/**
 * VendorPoConfirmationPanel
 *
 * 공급사가 발송받은 PO를 확인/수락/이의제기하는 탭.
 * - 좌측: PO 리스트 (sent / acknowledged / disputed)
 * - 우측: 선택된 PO의 상세 + 확인/이의 액션 영역
 *
 * Mutation boundary:
 * - 본 패널은 vendor-portal-store의 external-facing PO 사본만 변경하며,
 *   canonical PO truth는 건드리지 않는다. governance event만 발행해
 *   내부 supplier-confirmation engine이 정식 전이를 하게 한다.
 */
export function VendorPoConfirmationPanel({ vendorId }: { vendorId: string }) {
  const pos = useVendorPortalStore((s) => s.pos);
  const acknowledgePo = useVendorPortalStore((s) => s.acknowledgePo);
  const disputePo = useVendorPortalStore((s) => s.disputePo);

  const myPos = useMemo(
    () => pos.filter((p) => p.vendorId === vendorId),
    [pos, vendorId],
  );

  const [activePoNumber, setActivePoNumber] = useState<string | null>(
    myPos[0]?.poNumber ?? null,
  );
  // 리스트가 바뀌어도 첫 번째 항목으로 fallback
  const active = useMemo(
    () => myPos.find((p) => p.poNumber === activePoNumber) ?? myPos[0] ?? null,
    [myPos, activePoNumber],
  );

  if (myPos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <PackageCheck className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          확인할 PO가 없습니다
        </p>
        <p className="mt-1 text-xs text-slate-500">
          새로운 발주서가 발송되면 이 탭에 표시됩니다.
        </p>
      </div>
    );
  }

  const pendingCount = myPos.filter((p) => p.status === "sent").length;
  const acknowledgedCount = myPos.filter((p) => p.status === "acknowledged").length;
  const disputedCount = myPos.filter((p) => p.status === "disputed").length;

  return (
    <div className="space-y-5">
      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">발주서 (PO) 확인</h2>
        <p className="mt-1 text-xs text-slate-500">
          발송된 발주서 내용을 확인하고, 수락 또는 이의를 제기할 수 있습니다.
        </p>
      </div>

      {/* ── 요약 카운터 ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile
          icon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
          label="확인 대기"
          value={pendingCount}
          accent="amber"
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          label="수락 완료"
          value={acknowledgedCount}
          accent="emerald"
        />
        <SummaryTile
          icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}
          label="이의 제기"
          value={disputedCount}
          accent="rose"
        />
      </div>

      {/* ── 본문 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2">
          {myPos.map((po) => (
            <PoListItem
              key={po.poNumber}
              po={po}
              active={active?.poNumber === po.poNumber}
              onClick={() => setActivePoNumber(po.poNumber)}
            />
          ))}
        </div>

        <div className="lg:col-span-3">
          {active ? (
            <PoDetailCard
              key={active.poNumber}
              po={active}
              onAcknowledge={() =>
                acknowledgePo({
                  procurementCaseId: active.procurementCaseId,
                  poNumber: active.poNumber,
                  vendorId: active.vendorId,
                })
              }
              onDispute={(reason) =>
                disputePo({
                  procurementCaseId: active.procurementCaseId,
                  poNumber: active.poNumber,
                  vendorId: active.vendorId,
                  reason,
                })
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Summary tile ───────────────────────────────────────────

function SummaryTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "amber" | "emerald" | "rose";
}) {
  const accentBorder =
    accent === "amber"
      ? "border-l-amber-500"
      : accent === "emerald"
        ? "border-l-emerald-500"
        : "border-l-rose-500";
  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-2 ${accentBorder} bg-white px-3 py-2.5 shadow-sm`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

// ── PO list item ───────────────────────────────────────────

function PoListItem({
  po,
  active,
  onClick,
}: {
  po: VendorPoDocument;
  active: boolean;
  onClick: () => void;
}) {
  const sentLabel = new Date(po.sentAt).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border bg-white px-3 py-2.5 text-left shadow-sm transition-colors ${
        active
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {po.poNumber}
        </span>
        <StatusBadge status={po.status} />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
        {po.title}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        발송 {sentLabel} · 품목 {po.items.length}건
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-700 tabular-nums">
        {po.totalAmount.toLocaleString()}원
      </p>
    </button>
  );
}

function StatusBadge({ status }: { status: VendorPoDocument["status"] }) {
  if (status === "acknowledged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" />
        수락 완료
      </span>
    );
  }
  if (status === "disputed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium text-rose-700">
        <ShieldAlert className="h-2.5 w-2.5" />
        이의 제기
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
      <Clock className="h-2.5 w-2.5" />
      확인 대기
    </span>
  );
}

// ── PO detail card ─────────────────────────────────────────

function PoDetailCard({
  po,
  onAcknowledge,
  onDispute,
}: {
  po: VendorPoDocument;
  onAcknowledge: () => { success: boolean; error?: string };
  onDispute: (reason: string) => { success: boolean; error?: string };
}) {
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const isPending = po.status === "sent";

  const handleAck = () => {
    setFeedback(null);
    const result = onAcknowledge();
    if (!result.success) {
      setFeedback(result.error ?? "처리에 실패했습니다.");
    }
  };

  const handleDispute = () => {
    setFeedback(null);
    const result = onDispute(disputeReason);
    if (!result.success) {
      setFeedback(result.error ?? "처리에 실패했습니다.");
      return;
    }
    setShowDisputeForm(false);
    setDisputeReason("");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {po.poNumber}
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900">{po.title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            발송일{" "}
            {new Date(po.sentAt).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
            {po.requestedDeliveryDate
              ? ` · 납품 요청 ${po.requestedDeliveryDate}`
              : null}
          </p>
        </div>
        <StatusBadge status={po.status} />
      </div>

      {/* 품목 테이블 — 외부 노출 안전 필드만 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">품목</th>
              <th className="px-3 py-2 text-right font-medium">수량</th>
              <th className="px-3 py-2 text-right font-medium">단가</th>
              <th className="px-3 py-2 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {po.items.map((item) => (
              <tr key={item.itemId}>
                <td className="px-3 py-2 text-slate-800">{item.productName}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {item.unitPrice.toLocaleString()}원
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                  {(item.quantity * item.unitPrice).toLocaleString()}원
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/60">
              <td colSpan={3} className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500">
                총액
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                {po.totalAmount.toLocaleString()}원
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 처리 상태 표시 */}
      {po.status === "acknowledged" && po.respondedAt ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">수락 완료</p>
            <p className="mt-0.5 text-emerald-700">
              {new Date(po.respondedAt).toLocaleString("ko-KR")}에 수락됨
            </p>
          </div>
        </div>
      ) : null}

      {po.status === "disputed" && po.respondedAt ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-800">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
          <div>
            <p className="font-medium">이의 제기됨</p>
            <p className="mt-0.5 text-rose-700">{po.disputeReason}</p>
            <p className="mt-0.5 text-[10px] text-rose-600">
              {new Date(po.respondedAt).toLocaleString("ko-KR")} · 내부 운영팀이 검토 중입니다.
            </p>
          </div>
        </div>
      ) : null}

      {/* 액션 영역 */}
      {isPending ? (
        <div className="mt-4 space-y-3">
          {feedback ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
              <span>{feedback}</span>
            </div>
          ) : null}

          {!showDisputeForm ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAck}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                PO 수락
              </button>
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                이의 제기
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <label className="text-[11px] font-medium text-slate-700">
                이의 사유
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                placeholder="예: 단가 상이 / 납기 불가 / 수량 불일치"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleDispute}
                  disabled={disputeReason.trim().length < 2}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  이의 제출
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisputeForm(false);
                    setDisputeReason("");
                    setFeedback(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
