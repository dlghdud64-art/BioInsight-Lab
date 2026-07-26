"use client";

/**
 * §mobile-receiving-rcv-card Phase 3 (호영님 2026-07-26 핸드오프 §2 — 문서 첨부 시트 배선)
 *
 * 모바일 입고 리스트의 `첨부 ›` → 바텀 시트(그랩바). P2 까지는 상세 라우팅 폴백이었고,
 *   여기서 same-canvas 시트로 승격 = dead-surface(첨부 실행 표면 부재) 해소.
 *
 * 데스크탑 receiving-doc-attach-modal(센터 Dialog, doc-attach-v2 sentinel 잠금)은 무접촉 —
 *   폼팩터가 다른 모바일 전용 컴포넌트로 분리. 단 문서 모델·wiring 경로는 동일 store 액션 공유.
 *
 * 배선(정직):
 *   - 개별 `추가` = handleAttach → onAttach(store.attachReceivingDocument) 실 게이트 전이.
 *     필수세트(CoA+MSDS) 마지막 미첨부(remaining===1) 충족 시 labToast.success 1회(front-only 아님).
 *   - 첨부 성공 = 서버(store) 반영 → 상위 receivingBatches 갱신 → rb prop 재주입 → 완료 줄 전환·
 *     리스트 체크리스트 줄 소멸·KPI 감소(동일 파생). 프론트만의 성공 토스트 없음.
 *   - 실 파일 업로드/촬영은 입고 DB-backed 트랙(PLAN_receiving-doc-attach-dbbacked) 전까지
 *     정직-disabled 드롭존. 없는 기능을 있는 척하지 않음.
 */

import { useEffect } from "react";
import { FileText, CheckCircle2, Plus, AlertTriangle, Camera, X } from "lucide-react";
import type { ReceivingBatchContract } from "@/lib/review-queue/receiving-inbound-contract";
import { labToast } from "@/lib/toast/lab-toast";

type DocType = "coa" | "msds";

// 필수문서 세트 — deriveLineDocStatus(scenario-transition-runner)와 동일 기준.
const REQUIRED: { type: DocType; label: string; sub: string }[] = [
  { type: "coa", label: "성적서(CoA)", sub: "Lot별 시험성적서 — GMP 필수" },
  { type: "msds", label: "MSDS", sub: "물질안전보건자료" },
];

interface Props {
  open: boolean;
  /** 열림 상태일 때 live 배치(상위가 receivingBatches 에서 매 렌더 조회 → 첨부 후 자동 최신). */
  rb: ReceivingBatchContract | null;
  onClose: () => void;
  /** store.attachReceivingDocument — 실 게이트 전이 */
  onAttach: (
    receivingBatchId: string,
    lineId: string,
    docType: "coa" | "msds" | "validation" | "warranty",
    lotId?: string,
  ) => void;
}

export function MobileDocAttachSheet({ open, rb, onClose, onAttach }: Props) {
  // Esc 닫기(a11y).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 문서 미충족 라인만(complete/not_required 제외).
  const pendingLines =
    rb?.lineReceipts.filter(
      (l) => l.documentStatus === "missing" || l.documentStatus === "partial",
    ) ?? [];

  // 필수 미첨부 건수(라인 × 필수문서 중 lot 전수 미첨부).
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

  // 프리셋 컨텍스트(핸드오프 §2.1) — 누락 첫 라인.
  const presetLine = pendingLines[0];

  // 실 mutation 먼저 → 마지막 미첨부(remaining===1)면 필수세트 완료 토스트 1회.
  const handleAttach = (lineId: string, docType: DocType, lotId?: string) => {
    if (!rb) return;
    onAttach(rb.id, lineId, docType, lotId); // front-only 아님 — 게이트 전이.
    if (remaining === 1) {
      labToast.success(
        "문서 첨부 완료",
        `<b>${rb.receivingNumber}</b> 필수 문서(CoA·MSDS)가 모두 첨부되었습니다.`,
      );
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="문서 첨부"
        className={`relative w-full max-w-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 그랩바 */}
        <div className="flex-none pt-2.5 pb-1 grid place-items-center">
          <span className="h-1 w-9 rounded-full bg-slate-300" />
        </div>

        {/* 헤더 — 프리셋 컨텍스트(RCV · 라인명) */}
        <div className="flex items-start gap-3 px-5 pt-1 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex-none">
            <FileText className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-extrabold text-slate-900">문서 첨부</h2>
            <p className="text-[12px] text-slate-500 mt-0.5 truncate">
              <span className="font-mono">{rb?.receivingNumber ?? ""}</span>
              {presetLine && ` · ${presetLine.itemName}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="h-9 w-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 flex-none"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* 바디 */}
        <div className="px-5 py-4 overflow-y-auto overscroll-contain">
          {allDone ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-slate-600">모든 라인의 필수 문서가 첨부되었습니다.</p>
            </div>
          ) : (
            <>
              {/* 반영 차단 callout — yellow 토큰(§11.302, amber sentinel 준수) */}
              <div className="flex gap-2.5 p-3 rounded-xl bg-[#fef9c3] text-[#a16207] mb-4">
                <AlertTriangle className="h-[18px] w-[18px] flex-none mt-0.5" />
                <div>
                  <b className="text-[13px]">필수 문서 미첨부 · 재고 반영 차단</b>
                  <p className="text-[12px] mt-0.5 leading-relaxed">
                    CoA(시험성적서)가 없어 재고 반영이 막혀 있습니다. 첨부하면 차단 사유에서 자동으로
                    지워지고 재고 반영이 열립니다.
                  </p>
                </div>
              </div>

              {/* per-line/per-lot 실 첨부 */}
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
                            lots.every((lot) =>
                              type === "coa" ? lot.coaAttached : lot.msdsAttached,
                            );
                          return (
                            <div
                              key={type}
                              className={`rounded-xl border px-3 py-2.5 ${
                                attached
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "border-dashed border-[#93c5fd] bg-[#f5f9ff]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${
                                    attached ? "bg-emerald-100" : "bg-white border border-blue-200"
                                  }`}
                                >
                                  {attached ? (
                                    <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600" />
                                  ) : (
                                    <FileText className="h-[18px] w-[18px] text-blue-500" />
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
                                    className="inline-flex items-center gap-1 text-[12px] font-extrabold text-white bg-[#2563eb] px-3 min-h-[44px] rounded-[10px] active:scale-95 shrink-0"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    추가
                                  </button>
                                )}
                              </div>

                              {/* 정직-disabled 드롭존 — 실 업로드는 입고 DB 연동 후. 촬영/파일 모두 비활성. */}
                              {!attached && (
                                <div className="mt-2.5 flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled
                                    title="실 파일 업로드는 입고 DB 연동 후 제공됩니다"
                                    className="flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-[10px] border border-dashed border-[#93c5fd] bg-white text-[12px] font-bold text-slate-400 cursor-not-allowed"
                                  >
                                    <Camera className="h-4 w-4" />
                                    촬영 · 파일 선택 (DB 연동 후)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 푸터 — 완료 CTA 비활성 + 사유 인라인 */}
        <div className="flex-none flex items-center gap-2.5 px-5 py-3 border-t border-slate-100 bg-slate-50 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <span className="text-[11.5px] font-semibold text-slate-500">
            {allDone ? "필수 문서 확보 완료" : `필수 ${remaining}건 · 첨부 대기`}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={!allDone}
            className="min-h-[44px] px-5 rounded-[10px] text-[13px] font-extrabold text-white bg-emerald-600 active:scale-[0.98] disabled:bg-[#eef1f6] disabled:text-[#94a3b8]"
          >
            {allDone ? "첨부 완료" : `첨부 완료 · CoA 업로드 후 가능`}
          </button>
        </div>
      </div>
    </div>
  );
}
