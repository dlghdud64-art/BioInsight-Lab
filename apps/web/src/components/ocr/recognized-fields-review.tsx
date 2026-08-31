"use client";

/**
 * §scan-recognition-upgrade P1 — 인식 필드 확인 화면 (P3 공통화 1차본).
 *
 * 역할: COA 인식 결과의 표시·명시 확인·확정 요청까지만.
 *   · 확정 게이트 = evaluateLabelCommitGate (호영님 5규칙) — Lot·유효기간은
 *     신뢰도 무관 명시 확인 체크 후에만 확정 가능. 자동 확정 경로 0.
 *   · mutation 0 — 자체 fetch 없음. 확정은 부모 onConfirm 콜백(inspect PATCH 배선)에 위임.
 *   · 색: 확신 = blue · 불확실 = yellow `확인 필요`(§11.302 · amber 0) · 불일치 경고 = red.
 *   · 인식 실패 필드 = 빈 입력(수동 입력 폴백) — 지어내지 않는다.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { evaluateLabelCommitGate } from "@/lib/ocr/label-commit-gate";
import type { CoaFields, CoaLineResult } from "@/lib/ocr/coa-recognize";

export interface RecognizedLineOption {
  itemId: string;
  name: string;
  match: CoaLineResult["match"];
}

export interface RecognizedConfirmInput {
  itemId: string;
  lot: string | null;
  expiry: string | null;
}

export function RecognizedFieldsReview({
  fields,
  confidence,
  lines,
  busy,
  onConfirm,
  onDismiss,
}: {
  fields: CoaFields;
  confidence: "high" | "medium" | "low";
  /** 대상 라인 후보 + 대조 결과 — 자동 선택 0 (단일 라인만 기본 선택) */
  lines: RecognizedLineOption[];
  busy?: boolean;
  onConfirm: (input: RecognizedConfirmInput) => void;
  onDismiss: () => void;
}) {
  const [lot, setLot] = useState(fields.lot ?? "");
  const [expiry, setExpiry] = useState(fields.expiry ?? "");
  const [lotChecked, setLotChecked] = useState(false);
  const [expiryChecked, setExpiryChecked] = useState(false);
  const [itemId, setItemId] = useState<string | null>(
    lines.length === 1 ? lines[0].itemId : null,
  );

  const gate = useMemo(
    () =>
      evaluateLabelCommitGate({
        confidence,
        present: { lot: lot.trim() !== "", expiry: expiry.trim() !== "" },
        criticalConfirmed: { lot: lotChecked, expiry: expiryChecked },
        verified: { lot: false, expiry: false },
        reviewed: lotChecked || expiryChecked,
      }),
    [confidence, lot, expiry, lotChecked, expiryChecked],
  );

  const hasValue = lot.trim() !== "" || expiry.trim() !== "";
  const canConfirm = gate.canCommit && hasValue && itemId != null;
  const mismatchLines = lines.filter((l) => l.match === "mismatch");

  const confident = confidence === "high";
  const fieldTone = (present: boolean, checked: boolean) =>
    !present
      ? "border-slate-200"
      : checked
        ? "border-blue-200 bg-blue-50/40"
        : "border-yellow-200 bg-yellow-50/40";

  return (
    <div className="mt-2.5 border border-slate-200 bg-white rounded-[10px] p-4 space-y-3" data-surface="recognized-fields-review">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-bold text-slate-900">인식 결과 확인</p>
        <span
          className={`text-[10.5px] font-bold border px-2 py-0.5 rounded-full ${
            confident
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-yellow-50 border-yellow-200 text-yellow-700"
          }`}
        >
          {confident ? "인식 확신" : "확인 필요"}
        </span>
      </div>

      {mismatchLines.length > 0 && (
        <p className="text-[11.5px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          품목 대조 불일치 경고 · {mismatchLines.map((l) => l.name).join(", ")} · 차단이 아니라 확인 대상입니다
        </p>
      )}

      {lines.length > 1 && (
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500">적용할 라인 선택</span>
          <select
            value={itemId ?? ""}
            onChange={(e) => setItemId(e.target.value || null)}
            className="mt-1 w-full h-9 rounded-lg border border-slate-200 px-2 text-[12.5px]"
          >
            <option value="">라인을 선택해 주세요</option>
            {lines.map((l) => (
              <option key={l.itemId} value={l.itemId}>
                {l.name}
                {l.match === "ok" ? " · 대조 일치" : l.match === "mismatch" ? " · 불일치 확인" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg border p-2 ${fieldTone(lot.trim() !== "", lotChecked)}`}>
          <span className="text-[11px] font-semibold text-slate-500">Lot 번호</span>
          <input
            value={lot}
            onChange={(e) => { setLot(e.target.value); }}
            placeholder="인식 실패 · 직접 입력"
            className="mt-1 w-full h-8 rounded-md border border-slate-200 px-2 text-[12.5px] font-mono bg-white"
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <input type="checkbox" checked={lotChecked} onChange={(e) => setLotChecked(e.target.checked)} className="h-3.5 w-3.5" />
            원본과 대조해 확인함
          </label>
        </div>
        <div className={`rounded-lg border p-2 ${fieldTone(expiry.trim() !== "", expiryChecked)}`}>
          <span className="text-[11px] font-semibold text-slate-500">유효기간</span>
          <input
            value={expiry}
            onChange={(e) => { setExpiry(e.target.value); }}
            placeholder="YYYY-MM-DD · 직접 입력"
            className="mt-1 w-full h-8 rounded-md border border-slate-200 px-2 text-[12.5px] font-mono bg-white"
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <input type="checkbox" checked={expiryChecked} onChange={(e) => setExpiryChecked(e.target.checked)} className="h-3.5 w-3.5" />
            원본과 대조해 확인함
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="flex-1 text-[10.5px] text-slate-400">
          확정 시 선택 라인의 Lot·유효기간이 저장되고 `COA 인식` 근거가 남습니다
        </p>
        <button
          onClick={onDismiss}
          disabled={busy}
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-600"
        >
          나중에
        </button>
        <button
          onClick={() => {
            if (!canConfirm || itemId == null) return;
            onConfirm({ itemId, lot: lot.trim() || null, expiry: expiry.trim() || null });
          }}
          disabled={!canConfirm || busy}
          aria-disabled={!canConfirm || busy}
          className="h-8 px-3.5 rounded-lg bg-blue-600 text-white text-[11.5px] font-bold disabled:bg-slate-200 disabled:text-slate-400 inline-flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          확인하고 확정
        </button>
      </div>
    </div>
  );
}
