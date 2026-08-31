"use client";

/**
 * §receiving-list-redesign P2·P3 — 입고 케이스 리스트 (시각 truth: 입고 관리 리스트 리디자인 (단독).html 1a)
 *
 * 케이스 1건 = 1행 + 인라인 펼침(재고관리 LOT 펼침과 동일 문법). 우측 슬라이드 패널 폐기.
 * 데이터 = canonical ReceivingDraft 파생(receiving-desktop-view-model 순수함수) —
 *   UI state 가 truth 를 들지 않는다. 모든 mutation 은 부모 콜백(API 배선)으로 위임.
 *
 * 색: §11.302 신호등 — 주의 = yellow(시안의 amber hex 는 amber 금지 조항에 따라 yellow 토큰으로
 *   치환, 구조·의미 무변경) · 보류/위험 = red · 정상 = emerald · CTA = blue(시안 #2563eb).
 * CTA 문구 = caseCtaLabel() 단일 계약 (접힌 행·펼침·일괄 처리 모달 동일).
 * COA 첨부 = 행 펼침 안 인라인 드롭존(버튼 재클릭 시 접힘) — 첨부 즉시 canonical 커밋.
 * COA 인식(§scan-recognition-upgrade P1) = 첨부 후 인식 → RecognizedFieldsReview 확인 →
 *   사람 확정 시에만 부모 콜백(inspect PATCH)으로 저장. 인식 응답 자체는 저장 0.
 *   `COA 인식` 배지 truth = canonical lotSource("coa_ocr") — UI state 로 들지 않는다.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  caseCtaLabel,
  type ReceivingCaseList as CaseListData,
  type ReceivingCaseRow,
  type ReceivingCaseTone,
} from "@/lib/ops-console/receiving-desktop-view-model";
import type { CoaRecognitionResponse } from "@/lib/ocr/coa-recognize";
import {
  RecognizedFieldsReview,
  type RecognizedConfirmInput,
} from "@/components/ocr/recognized-fields-review";

export type CaseFilterKey = "action" | "all" | "done";

const STATUS_PILL: Record<ReceivingCaseTone, string> = {
  done: "bg-emerald-50 border-emerald-200 text-emerald-700",
  ready: "bg-blue-50 border-blue-200 text-blue-700",
  attention: "bg-yellow-50 border-yellow-200 text-yellow-700",
  muted: "bg-slate-100 border-slate-200 text-slate-500",
};

const LINE_PILL: Record<string, string> = {
  passed: "bg-emerald-50 border-emerald-200 text-emerald-700",
  waiting: "bg-yellow-50 border-yellow-200 text-yellow-700",
  hold: "bg-red-50 border-red-200 text-red-700",
};

function fmtDate(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 파이프라인 4카드 — 0 단계는 회색 정직 표기, 조치 필요만 yellow 보더(1+건) */
function PipelineCards({ list }: { list: CaseListData }) {
  const p = list.pipeline;
  const base = "bg-white rounded-[13px] px-4 py-3 border";
  const zeroNum = "text-slate-400";
  const cards = [
    { key: "waiting", label: "입고 대기", count: p.waiting.count, caption: p.waiting.caption },
    { key: "inspecting", label: "검수 대기", count: p.inspecting.count, caption: p.inspecting.caption },
    null, // 조치 필요 — 아래 별도 렌더
    { key: "posted", label: "재고 반영 완료", count: p.posted.count, caption: p.posted.caption },
  ] as const;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.slice(0, 2).map((c) => c && (
        <div key={c.key} className={`${base} border-slate-200`}>
          <p className="text-[11.5px] text-slate-500">{c.label}</p>
          <p className={`text-xl font-extrabold mt-0.5 ${c.count === 0 ? zeroNum : "text-slate-900"}`}>{c.count}</p>
          <p className="text-[10.5px] text-slate-400 mt-0.5">{c.caption}</p>
        </div>
      ))}
      <div className={`${base} ${p.action.count > 0 ? "border-yellow-200" : "border-slate-200"}`}>
        <p className={`text-[11.5px] ${p.action.count > 0 ? "text-yellow-700" : "text-slate-500"}`}>조치 필요</p>
        <p className={`text-xl font-extrabold mt-0.5 ${p.action.count === 0 ? zeroNum : "text-yellow-700"}`}>
          {p.action.count}
          {p.action.remainingActions > 0 && (
            <span className="ml-2 align-[3px] text-[11px] font-semibold bg-yellow-50 text-yellow-700 rounded-full px-2 py-0.5">
              남은 조치 {p.action.remainingActions}건
            </span>
          )}
        </p>
        <p className={`text-[10.5px] mt-0.5 ${p.action.count > 0 ? "text-yellow-700" : "text-slate-400"}`}>
          {p.action.caption}
        </p>
      </div>
      {cards[3] && (
        <div className={`${base} border-slate-200`}>
          <p className="text-[11.5px] text-slate-500">{cards[3].label}</p>
          <p className={`text-xl font-extrabold mt-0.5 ${cards[3].count === 0 ? zeroNum : "text-slate-900"}`}>{cards[3].count}</p>
          <p className="text-[10.5px] text-slate-400 mt-0.5">{cards[3].caption}</p>
        </div>
      )}
    </div>
  );
}

/** 미니 스텝퍼 — ① 입고 ② 검수·문서 ③ 반영 */
function MiniStepper({ step, done }: { step: 1 | 2 | 3; done: boolean }) {
  const seg = (active: boolean) => `flex-1 h-0.5 ${active ? "bg-emerald-600" : "bg-slate-200"}`;
  return (
    <div className="hidden lg:flex items-center gap-1.5 w-[230px] flex-none text-[10.5px]">
      <span className="text-emerald-700 font-bold">✓ 입고</span>
      <span className={seg(step >= 2)} />
      <span className={step === 2 ? "text-blue-700 font-bold" : done || step === 3 ? "text-emerald-700 font-bold" : "text-slate-400"}>② 검수·문서</span>
      <span className={seg(step >= 3)} />
      <span className={done ? "text-emerald-700 font-bold" : step === 3 ? "text-blue-700 font-bold" : "text-slate-400"}>③ 반영</span>
    </div>
  );
}

function CaseRowView({
  row,
  expanded,
  onToggle,
  onCta,
  onAttachDocument,
  onRecognizeCoa,
  onConfirmCoa,
}: {
  row: ReceivingCaseRow;
  expanded: boolean;
  onToggle: () => void;
  onCta: (row: ReceivingCaseRow) => void;
  onAttachDocument: (row: ReceivingCaseRow, docType: "coa" | "invoice", file: File) => Promise<void>;
  /** 인식만(저장 0) — jobId 없으면(감사 로그 불가) null 반환 = 기존 업로드 흐름 유지 */
  onRecognizeCoa: (row: ReceivingCaseRow, file: File) => Promise<CoaRecognitionResponse | null>;
  /** 사람 확정 시에만 — inspect PATCH 배선(부모) */
  onConfirmCoa: (
    row: ReceivingCaseRow,
    input: RecognizedConfirmInput & { jobId: string },
  ) => Promise<boolean>;
}) {
  const cta = caseCtaLabel(row);
  const [dropOpen, setDropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recog, setRecog] = useState<CoaRecognitionResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const needsCoa = row.actions.some((a) => a.kind === "doc" && a.label === "COA 확보");

  const handleFile = async (file: File | undefined | null) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      await onAttachDocument(row, "coa", file);
      // 인식 호출 — 응답은 표시용(저장 0). 실패/감사 불가 시 기존 흐름(접힘)으로.
      const recognition = await onRecognizeCoa(row, file);
      if (recognition) {
        setRecog(recognition);
      } else {
        setDropOpen(false); // 확정 시 드롭존 접힘 (핸드오프 §2)
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmCoa = async (input: RecognizedConfirmInput) => {
    if (!recog?.jobId || confirming) return;
    setConfirming(true);
    try {
      const ok = await onConfirmCoa(row, { ...input, jobId: recog.jobId });
      if (ok) {
        setRecog(null);
        setDropOpen(false);
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden">
      {/* ── 접힌 행 (클릭 = 인라인 펼침) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="w-full px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/60 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">{row.displayNumber}</span>
            <span className={`text-[10.5px] font-bold border px-2 py-0.5 rounded-full ${STATUS_PILL[row.statusTone]}`}>{row.statusLabel}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </div>
          <p className="text-[14.5px] font-bold text-slate-900 mt-1 truncate">
            {row.vendorName ?? "공급사 미지정"} · {row.lineCount}개 라인{row.lineSummary ? ` (${row.lineSummary})` : ""}
          </p>
          {(row.actions.length > 0 || row.holdChips.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {row.actions.map((a, i) => (
                <span key={`a-${i}`} className="inline-flex items-center text-[11px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-0.5 rounded-full">
                  {a.label}
                </span>
              ))}
              {row.holdChips.map((c, i) => (
                <span key={`h-${i}`} className="inline-flex items-center text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-none text-[11.5px] text-slate-400">
          회신 {fmtDate(row.submittedAt)}
        </div>
        {cta && (
          <button
            onClick={(e) => { e.stopPropagation(); onCta(row); }}
            className="flex-none h-9 px-4 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-bold"
          >
            {cta}
          </button>
        )}
      </div>

      {/* ── 인라인 펼침 ── */}
      {expanded && (
        <div className="border-t border-slate-100">
          {/* 헤더: PO 링크 + 회신일 + 미니 스텝퍼 */}
          <div className="px-5 py-3 flex items-center gap-4 bg-slate-50/50">
            <p className="flex-1 min-w-0 text-[12.5px] text-slate-600 truncate">
              {row.orderId ? (
                <Link href={`/dashboard/purchase-orders/${row.orderId}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline font-mono">{row.displayNumber}</Link>
              ) : (
                <span className="font-mono">{row.displayNumber}</span>
              )}
              {" · 회신 "}{fmtDate(row.submittedAt)}
            </p>
            <MiniStepper step={row.step} done={row.isDone} />
          </div>

          {/* 라인별 행 — 상태 pill + 품목 + 사유 */}
          {row.lines.map((l) => (
            <div key={l.itemId} className={`px-5 py-3 border-t border-slate-100 flex items-center gap-3 ${l.judgment === "waiting" ? "bg-yellow-50/40" : ""}`}>
              <span className={`flex-none text-[10.5px] font-bold border px-2 py-0.5 rounded-full ${LINE_PILL[l.judgment]}`}>{l.judgmentLabel}</span>
              <p className="flex-1 min-w-0 text-[13px] font-bold text-slate-900 truncate">
                {l.itemName}{" "}
                <span className={`text-[11.5px] font-medium ${l.judgment === "hold" ? "text-red-700" : l.judgment === "waiting" ? "text-yellow-700" : "text-slate-400"}`}>
                  {l.reason || l.quantityLabel}
                  {!l.reason && l.lotNumber && (
                    <>
                      {" · "}
                      <span className="font-mono font-semibold bg-blue-50 text-blue-700 px-1 rounded">{l.lotNumber}</span>
                    </>
                  )}
                </span>
                {/* 배지 truth = canonical lotSource — 확정(inspect PATCH) 후 refetch 로만 나타난다 */}
                {l.lotSource === "coa_ocr" && (
                  <span className="ml-1.5 align-[1px] inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                    COA 인식
                  </span>
                )}
              </p>
            </div>
          ))}

          {/* COA 인라인 드롭존 — 필수 조치에 COA 확보가 있을 때만 */}
          {needsCoa && (
            <div className="px-5 py-3 border-t border-slate-100 bg-yellow-50/40">
              <button
                onClick={() => setDropOpen((v) => !v)}
                className="h-8 px-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-[11.5px] font-bold inline-flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                {dropOpen ? "COA 첨부 접기" : "COA 첨부"}
              </button>
              {dropOpen && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void handleFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className="mt-2.5 border-[1.5px] border-dashed border-slate-300 bg-white rounded-[10px] p-4 text-center cursor-pointer hover:border-blue-300"
                >
                  {uploading ? (
                    <p className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 첨부 중</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-600">COA 파일을 끌어다 놓거나 클릭해 첨부</p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">첨부 즉시 입고 건 문서로 저장됩니다</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
              )}
              {recog && (
                <RecognizedFieldsReview
                  fields={recog.fields}
                  confidence={recog.confidence}
                  lines={recog.perLine.map((p) => ({
                    itemId: p.itemId,
                    name: row.lines.find((l) => l.itemId === p.itemId)?.itemName ?? p.itemId,
                    match: p.match,
                  }))}
                  busy={confirming}
                  onConfirm={(input) => { void handleConfirmCoa(input); }}
                  onDismiss={() => { setRecog(null); setDropOpen(false); }}
                />
              )}
            </div>
          )}

          {/* 푸터: 활성 조건 캡션 + 상세 페이지 열기 + 주 CTA */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
            <p className="flex-1 text-[11.5px] text-slate-400">{row.footerCaption}</p>
            <Link href={`/dashboard/receiving/${row.id}`} className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
              상세 페이지 열기 <ExternalLink className="h-3 w-3" />
            </Link>
            {cta && (
              <button onClick={() => onCta(row)} className="h-9 px-4 rounded-[10px] bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-bold flex-none">
                {cta}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReceivingCaseListView({
  list,
  onCta,
  onAttachDocument,
  onRecognizeCoa,
  onConfirmCoa,
}: {
  list: CaseListData;
  onCta: (row: ReceivingCaseRow) => void;
  onAttachDocument: (row: ReceivingCaseRow, docType: "coa" | "invoice", file: File) => Promise<void>;
  onRecognizeCoa: (row: ReceivingCaseRow, file: File) => Promise<CoaRecognitionResponse | null>;
  onConfirmCoa: (
    row: ReceivingCaseRow,
    input: RecognizedConfirmInput & { jobId: string },
  ) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<CaseFilterKey>("action");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.rows.filter((r) => {
      if (filter === "action" && !(r.status === "PENDING_REVIEW" && r.remainingActionCount > 0)) return false;
      if (filter === "all" && r.isDone) return false;
      if (filter === "done" && !r.isDone) return false;
      return q === "" || r.searchText.includes(q);
    });
  }, [list.rows, filter, query]);

  const chips: { key: CaseFilterKey; label: string; count: number }[] = [
    { key: "action", label: "조치 필요", count: list.filterCounts.actionNeeded },
    { key: "all", label: "전체", count: list.filterCounts.all },
    { key: "done", label: "완료", count: list.filterCounts.done },
  ];

  return (
    <div className="space-y-3">
      <PipelineCards list={list} />

      {/* 필터 칩 + 검색 — 항상 가로 인라인 (§11.311 #6) */}
      <div className="flex flex-row items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`h-9 px-3.5 rounded-full text-xs font-bold border ${
              filter === c.key
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 font-medium"
            }`}
          >
            {c.label} {c.count}
          </button>
        ))}
        <span className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="입고 번호, 품목 검색"
            className="w-[220px] h-9 border border-slate-200 bg-white rounded-[10px] pl-8 pr-3 text-[12.5px] text-slate-900 outline-none focus:border-blue-300"
          />
        </div>
      </div>

      {/* 케이스 행: 1건 = 1행 */}
      {visible.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4">
          <p className="text-[12.5px] text-slate-500">
            {query.trim() !== ""
              ? "검색 결과가 없습니다"
              : filter === "action"
                ? "남은 조치가 있는 입고 건이 없습니다"
                : filter === "done"
                  ? "반영 완료된 입고 건이 없습니다"
                  : "처리 중인 입고 건이 없습니다"}
          </p>
        </div>
      ) : (
        visible.map((row) => (
          <CaseRowView
            key={row.id}
            row={row}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId((v) => (v === row.id ? null : row.id))}
            onCta={onCta}
            onAttachDocument={onAttachDocument}
            onRecognizeCoa={onRecognizeCoa}
            onConfirmCoa={onConfirmCoa}
          />
        ))
      )}
    </div>
  );
}
