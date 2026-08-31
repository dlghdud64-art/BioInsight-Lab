"use client";

/**
 * §scan-recognition-upgrade P1·P3 — 인식 필드 확인 화면 공통 컴포넌트.
 *
 * 역할: 인식 결과의 표시·명시 확인·확정 요청까지만.
 *   · 마크 파생 = deriveFieldMarks 단일 소스(P3) — 내부에서 label-commit-gate
 *     (호영님 5규칙)를 호출해 승계. Lot·유효기간은 신뢰도 무관 명시 확인 후에만
 *     확정 가능. 자동 확정 경로 0(마운트 effect 확정 금지).
 *   · mutation 0 — 자체 fetch 없음. 확정은 부모 onConfirm 콜백(inspect PATCH 배선)에 위임.
 *   · 색: 확신 = blue · 불확실 = yellow `확인 필요`(§11.302 · amber 0) · 불일치 경고 = red.
 *   · 원본 병기(P3): bbox 있으면 하이라이트 오버레이, **없으면 원본 전체**
 *     (Gemini 는 bbox 를 안 준다 — 하이라이트를 지어내지 않는다).
 *   · 인식 실패 필드 = 빈 입력(수동 입력 폴백) — 지어내지 않는다.
 *
 * RecognizedFieldInput — 3 surface 공용 필드 셀(단품 폼·다품목 수량 셀·COA 확인).
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { deriveFieldMarks } from "@/lib/ocr/recognized-field-marks";
import type { CoaFields, CoaLineResult } from "@/lib/ocr/coa-recognize";

/* ── 공용 필드 입력 셀 ────────────────────────────────────────── */

export interface RecognizedFieldInputProps {
  id?: string;
  /** 라벨 — compact 모드에서는 미노출 */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** 불확실(yellow `확인 필요`) 마크 — 호출부가 마크 파생 결과를 바인딩 */
  needsConfirm: boolean;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  /** 테이블 셀용 컴팩트 렌더(라벨·체크 없음) */
  compact?: boolean;
  testId?: string;
  /** 명시 확인 체크박스(COA 확인 화면용) — 미전달 시 미노출 */
  confirmed?: boolean;
  onConfirmedChange?: (confirmed: boolean) => void;
  mono?: boolean;
}

export function RecognizedFieldInput({
  id,
  label,
  value,
  onChange,
  needsConfirm,
  placeholder,
  type = "text",
  min,
  compact,
  testId,
  confirmed,
  onConfirmedChange,
  mono,
}: RecognizedFieldInputProps) {
  const tone = needsConfirm
    ? "border-yellow-200 bg-yellow-50/40"
    : "border-blue-200 bg-blue-50/40";
  if (compact) {
    return (
      <input
        id={id}
        data-testid={testId}
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-16 h-8 rounded-md border px-2 text-xs text-right tabular-nums ${needsConfirm ? tone : "border-slate-200"}`}
      />
    );
  }
  return (
    <div className={`rounded-lg border p-2 ${tone}`} data-testid={testId}>
      <span className="text-[11px] font-semibold text-slate-500">
        {label}
        {needsConfirm && (
          <span className="ml-1 text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
            확인 필요
          </span>
        )}
      </span>
      <input
        id={id}
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full h-8 rounded-md border border-slate-200 px-2 text-[12.5px] bg-white ${mono ? "font-mono" : ""}`}
      />
      {onConfirmedChange && (
        <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={!!confirmed}
            onChange={(e) => onConfirmedChange(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          원본과 대조해 확인함
        </label>
      )}
    </div>
  );
}

/* ── 원본 병기 (P3) ───────────────────────────────────────────── */

export interface RecognizedBbox {
  /** 0~1 비율 좌표 (좌상단 x·y, 폭 w, 높이 h) */
  x: number;
  y: number;
  w: number;
  h: number;
}

function SourceImage({ imageUrl, bbox }: { imageUrl: string; bbox: RecognizedBbox | null }) {
  // bbox 가 없으면(현행 Gemini) 원본 전체 병기 — 하이라이트를 지어내지 않는다.
  if (bbox == null) {
    return (
      <div data-surface="recognized-source-full" className="rounded-lg border border-slate-200 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="인식 원본 문서" className="w-full max-h-48 object-contain bg-slate-50" />
        <p className="text-[10px] text-slate-400 px-2 py-1">원본 전체 · 값과 대조해 확인해 주세요</p>
      </div>
    );
  }
  return (
    <div data-surface="recognized-source-highlight" className="relative rounded-lg border border-slate-200 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="인식 원본 문서" className="w-full max-h-48 object-contain bg-slate-50" />
      <div
        className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none"
        style={{
          left: `${bbox.x * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.w * 100}%`,
          height: `${bbox.h * 100}%`,
        }}
      />
    </div>
  );
}

/* ── COA 확인 화면 ────────────────────────────────────────────── */

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
  imageUrl,
  bbox,
  onConfirm,
  onDismiss,
}: {
  fields: CoaFields;
  confidence: "high" | "medium" | "low";
  /** 대상 라인 후보 + 대조 결과 — 자동 선택 0 (단일 라인만 기본 선택) */
  lines: RecognizedLineOption[];
  busy?: boolean;
  /** 원본 병기 — OcrJob.imageUrl (없으면 미노출) */
  imageUrl?: string | null;
  /** 필드 영역 좌표 — 있을 때만 하이라이트(지어내기 0) */
  bbox?: RecognizedBbox | null;
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

  // 마크 파생 단일 소스 — label-commit-gate 는 deriveFieldMarks 내부에서 승계.
  const derived = useMemo(
    () =>
      deriveFieldMarks({
        fields: { lot, expiry },
        confidence,
        confirmed: { lot: lotChecked, expiry: expiryChecked },
      }),
    [confidence, lot, expiry, lotChecked, expiryChecked],
  );

  const hasValue = lot.trim() !== "" || expiry.trim() !== "";
  const canConfirm = derived.canCommit && hasValue && itemId != null;
  const mismatchLines = lines.filter((l) => l.match === "mismatch");
  const confident = confidence === "high";

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

      {imageUrl && <SourceImage imageUrl={imageUrl} bbox={bbox ?? null} />}

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
        <RecognizedFieldInput
          label="Lot 번호"
          value={lot}
          onChange={setLot}
          needsConfirm={derived.marks.lot === "needs-confirm"}
          placeholder="인식 실패 · 직접 입력"
          confirmed={lotChecked}
          onConfirmedChange={setLotChecked}
          mono
        />
        <RecognizedFieldInput
          label="유효기간"
          value={expiry}
          onChange={setExpiry}
          needsConfirm={derived.marks.expiry === "needs-confirm"}
          placeholder="YYYY-MM-DD · 직접 입력"
          confirmed={expiryChecked}
          onConfirmedChange={setExpiryChecked}
          mono
        />
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
