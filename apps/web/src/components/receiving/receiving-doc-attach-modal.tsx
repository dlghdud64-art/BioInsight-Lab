"use client";

/**
 * §receiving-doc-attach-v2 (호영님 2026-07-08, 입고 목록 웹 리디자인 v2.html §mDoc)
 *   문서 확보 모달 — 바텀 Sheet → same-canvas 센터 Dialog(receiving-post-modal 패턴 정합).
 *   v2 폼팩터: 통합 업로드 / 문서별 첨부 탭 + 드롭존(정직-disabled) + 필수 pill + 반영 차단 callout.
 *
 * ⚠ GMP 보존: 문서 모델은 라이브 per-line/per-lot(CoA·MSDS) 유지. v2 mock 의
 *   per-doc-type 간소화는 채택하지 않음(성적서 lot granularity 손실 방지).
 *
 * 배선(정직):
 *   - "추가" = handleAttach → onAttach(store.attachReceivingDocument) 실 게이트 전이.
 *     필수세트(CoA+MSDS) 충족 시 remaining===1 에서 labToast.success 1회(front-only 아님).
 *   - 파일 실업로드(드롭존)는 입고 DB-backed 트랙 전까지 정직-disabled.
 *   - 기본 탭 = 문서별 첨부(실 액션 우선, no-op default 회피). 통합 업로드는 드롭존 시각.
 */

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, Plus, AlertTriangle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceivingBatchContract } from "@/lib/review-queue/receiving-inbound-contract";
// §action-toast P3 — 필수세트 완료 시 success 토스트(앱 전역 단일 렌더러).
import { labToast } from "@/lib/toast/lab-toast";

type DocType = "coa" | "msds";
type DocTab = "unified" | "byDoc";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rb: ReceivingBatchContract;
  /** store.attachReceivingDocument 로 wiring — 실제 첨부(게이트 전이) */
  onAttach: (lineId: string, docType: DocType, lotId?: string) => void;
}

// 필수문서 세트 — deriveLineDocStatus(scenario-transition-runner)와 동일 기준.
const REQUIRED: { type: DocType; label: string; sub: string }[] = [
  { type: "coa", label: "성적서 (CoA)", sub: "Lot별 시험성적서 — GMP 필수" },
  { type: "msds", label: "MSDS", sub: "물질안전보건자료" },
];

export function ReceivingDocAttachModal({ open, onOpenChange, rb, onAttach }: Props) {
  // 기본 탭 = 문서별 첨부(실 액션 우선 — 통합 업로드는 정직-disabled 드롭존이라 default 회피).
  const [tab, setTab] = useState<DocTab>("byDoc");

  // Esc 닫기(기존 Sheet 제공 동작 보존 — a11y 회귀 0).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // 문서 미충족 라인만(complete/not_required 제외).
  const pendingLines = rb.lineReceipts.filter(
    (l) => l.documentStatus === "missing" || l.documentStatus === "partial",
  );

  // 필수 미첨부 건수(진행률) — pending 라인 × 필수문서 중 미첨부.
  const remaining = pendingLines.reduce((acc, line) => {
    const lots = line.lotRecords;
    return (
      acc +
      REQUIRED.filter(({ type }) => {
        const attached =
          lots.length > 0 &&
          lots.every((lot) => (type === "coa" ? lot.coaAttached : lot.msdsAttached));
        return !attached;
      }).length
    );
  }, 0);
  const allDone = remaining === 0;

  // §action-toast P3 — 실 첨부(store.attachReceivingDocument) 후, 이번 첨부가 마지막 미첨부(remaining===1)면
  //   필수세트 완료 → success 토스트 1회. 개별 첨부는 인라인 카드(rose→emerald)로 피드백(토스트 스팸 0).
  const handleAttach = (lineId: string, docType: DocType, lotId?: string) => {
    onAttach(lineId, docType, lotId); // 실 mutation(게이트 전이) — front-only 아님.
    if (remaining === 1) {
      labToast.success(
        "문서 첨부 완료",
        `<b>${rb.receivingNumber}</b> 필수 문서(CoA·MSDS)가 모두 첨부되었습니다.`,
      );
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/45" onClick={() => onOpenChange(false)} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="문서 확보"
        className={`relative w-full max-w-[580px] max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-3"
        }`}
      >
        {/* ── header ── */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex-none">
            <FileText className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-extrabold text-slate-900">문서 확보</h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">
              <span className="font-mono">{rb.receivingNumber}</span> · 총 {rb.lineReceipts.length}개 라인 중 {pendingLines.length}건 미완
            </p>
          </div>
          {/* segmented tabs (sm+) */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-lg bg-slate-100 p-1 flex-none">
            <button
              type="button"
              onClick={() => setTab("unified")}
              aria-pressed={tab === "unified"}
              className={`px-3 h-8 rounded-md text-[12px] font-bold transition-colors ${
                tab === "unified" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              통합 업로드
            </button>
            <button
              type="button"
              onClick={() => setTab("byDoc")}
              aria-pressed={tab === "byDoc"}
              className={`px-3 h-8 rounded-md text-[12px] font-bold transition-colors ${
                tab === "byDoc" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              문서별 첨부
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="닫기"
            className="h-9 w-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-none"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── body ── */}
        <div className="px-5 py-4 overflow-y-auto">
          {allDone ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-slate-600">모든 라인의 필수 문서가 첨부되었습니다.</p>
            </div>
          ) : (
            <>
              {/* 반영 차단 callout — §11.302 주의색(muted amber) */}
              <div className="flex gap-3 p-3.5 rounded-xl bg-[#fdf3ec] text-[#b45821] mb-4">
                <AlertTriangle className="h-[18px] w-[18px] flex-none mt-0.5" />
                <div>
                  <b className="text-[13px]">필수 문서 미첨부 · 재고 반영 차단</b>
                  <p className="text-[12px] mt-0.5 leading-relaxed">
                    CoA(시험성적서)가 없어 재고 반영이 막혀 있습니다. 첨부 후 반영이 가능해집니다.
                  </p>
                </div>
              </div>

              {tab === "unified" ? (
                /* 통합 업로드 — 드롭존 정직-disabled(실 업로드는 입고 DB 연동 후) */
                <div>
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-slate-400">
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    <b className="block text-[13px] text-slate-500">파일 업로드는 입고 DB 연동 후 제공됩니다</b>
                    <span className="text-[11.5px]">지금은 &lsquo;문서별 첨부&rsquo;에서 문서 확인을 표시하세요</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("byDoc")}
                    className="mt-3 w-full h-10 rounded-xl border border-blue-300 text-blue-600 text-[13px] font-bold hover:bg-blue-50"
                  >
                    문서별 첨부로 이동
                  </button>
                </div>
              ) : (
                /* 문서별 첨부 — per-line/per-lot 실 첨부 */
                <div className="space-y-4">
                  {pendingLines.map((line) => {
                    const lots = line.lotRecords;
                    return (
                      <div key={line.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-5 min-w-5 px-1 rounded grid place-items-center bg-slate-100 text-slate-600 text-[11px] font-bold font-mono">
                            {line.lineNumber}
                          </span>
                          <span className="text-[13px] font-semibold text-slate-900 truncate">
                            {line.itemName}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {REQUIRED.map(({ type, label, sub }) => {
                            const attached =
                              lots.length > 0 &&
                              lots.every((lot) => (type === "coa" ? lot.coaAttached : lot.msdsAttached));
                            return (
                              <div
                                key={type}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                                  attached
                                    ? "bg-emerald-50 border-emerald-200"
                                    : "bg-rose-50 border-rose-200"
                                }`}
                              >
                                <div
                                  className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${
                                    attached ? "bg-emerald-100" : "bg-white border border-rose-200"
                                  }`}
                                >
                                  {attached ? (
                                    <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600" />
                                  ) : (
                                    <FileText className="h-[18px] w-[18px] text-rose-500" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[13px] font-bold text-slate-900">{label}</p>
                                    <span className="text-[10px] font-semibold text-rose-600 bg-white border border-rose-200 rounded px-1 py-px">
                                      필수
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    {attached ? "첨부 완료" : sub}
                                  </p>
                                </div>
                                {attached ? (
                                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    첨부됨
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAttach(line.id, type)}
                                    className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-600 bg-white border border-blue-300 px-2.5 h-8 rounded-lg active:scale-95 hover:bg-blue-50 shrink-0"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    추가
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── footer ── */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-[11.5px] font-semibold text-slate-500">
            {allDone ? "필수 문서 확보 완료" : `필수 ${remaining}건 · 첨부 대기`}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>
          <Button
            type="button"
            disabled={!allDone}
            onClick={() => onOpenChange(false)}
            className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:bg-slate-200 disabled:text-slate-400"
          >
            문서 첨부 완료
          </Button>
        </div>
      </div>
    </div>
  );
}
