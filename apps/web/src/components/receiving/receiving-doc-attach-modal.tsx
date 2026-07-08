"use client";

/**
 * #receiving-doc-attach-sheet (호영님 2026-07-06) — 문서 첨부 same-canvas 바텀시트.
 *
 * 시안 정합: Dialog → Sheet(bottom). 문서별 상태 체크리스트(미첨부 rose / 첨부됨 emerald) +
 *   진행률("필수 N건 남음") + "문서 첨부 완료" CTA(필수 충족 시에만 활성).
 *
 * 배선(정직):
 *   - "첨부" = store.attachReceivingDocument(실 게이트 전이). 필수세트(COA+MSDS) 충족 시
 *     documentStatus=complete → posting 게이트 실제 해제(fake success 0).
 *   - 촬영/파일 선택(실 파일 업로드)은 입고 상세가 데모(ops-store) 데이터라 실 저장 대상 부재 →
 *     정직-disabled. 실 파일 업로드는 입고 DB-backed 트랙(PLAN_receiving-doc-attach-dbbacked)에서.
 *
 * same-canvas overlay(Sheet) — 신규 페이지 금지.
 */

import { FileText, CheckCircle2, Plus, Camera, Upload, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ReceivingBatchContract } from "@/lib/review-queue/receiving-inbound-contract";
// §action-toast P3 — 필수세트 완료 시 success 토스트(앱 전역 단일 렌더러).
import { labToast } from "@/lib/toast/lab-toast";

type DocType = "coa" | "msds";

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
  //   reducer: onAttach(line,type)는 lotId 미전달 → 해당 라인 전체 lot 채움 → remaining 정확히 1 감소.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        <SheetHeader className="px-4 pt-3 pb-2 text-left space-y-0.5">
          <SheetTitle className="flex items-center gap-2 text-[17px]">
            <FileText className="h-[18px] w-[18px] text-blue-600" />
            문서 첨부
          </SheetTitle>
          <SheetDescription className="text-[13px] text-slate-500">
            {rb.receivingNumber} · 총 {rb.lineReceipts.length}개 라인 중 {pendingLines.length}건 미완
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {pendingLines.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-slate-600">모든 라인의 필수 문서가 첨부되었습니다.</p>
            </div>
          ) : (
            pendingLines.map((line) => {
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

                  {/* 문서별 상태 카드 */}
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
            })
          )}

          {pendingLines.length > 0 && (
            <>
              {/* 촬영/파일 선택 — 정직-disabled(실 파일 업로드는 입고 DB 연동 후) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-slate-400 cursor-not-allowed"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[12px] font-semibold">촬영</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-slate-400 cursor-not-allowed"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[12px] font-semibold">파일 선택</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center -mt-1.5">
                실 파일 업로드는 입고 DB 연동 후 제공됩니다. 지금은 &lsquo;추가&rsquo;로 문서 확인을 표시하세요.
              </p>

              {/* 진행률 */}
              {!allDone && (
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600 justify-center">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  필수 {remaining}건 남음
                </div>
              )}
            </>
          )}

          {/* 완료 CTA — 필수 충족 시에만 활성 */}
          <Button
            type="button"
            disabled={!allDone && pendingLines.length > 0}
            onClick={() => onOpenChange(false)}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:bg-slate-200 disabled:text-slate-400"
          >
            문서 첨부 완료
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
