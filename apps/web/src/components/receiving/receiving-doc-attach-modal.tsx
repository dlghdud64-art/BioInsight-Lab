"use client";

/**
 * §inbound-quarantine-temp-exclude (P3) — 문서 해소(첨부) 모달.
 *
 * "문서 해소" CTA(rcv-resolve-docs)의 실 첨부 진입점. 기존 dead button(canExecute:false)을
 * 실제 store 액션(attachReceivingDocument)에 연결한다. 필수세트(COA+MSDS) 충족 시
 * documentStatus가 complete로 전이되어 posting 게이트가 실제로 풀린다(fake success 0).
 *
 * same-canvas overlay(Dialog) — 신규 페이지 금지.입고 게이트에서 제외된 상태 정보는 노출하지 않는다.
 */

import { FileCheck2, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ReceivingBatchContract } from "@/lib/review-queue/receiving-inbound-contract";

type DocType = "coa" | "msds";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rb: ReceivingBatchContract;
  /** store.attachReceivingDocument 로 wiring — 실제 첨부(플래그 전이) */
  onAttach: (lineId: string, docType: DocType, lotId?: string) => void;
}

// 필수문서 세트 — deriveLineDocStatus(scenario-transition-runner)와 동일 기준.
const REQUIRED: { type: DocType; label: string }[] = [
  { type: "coa", label: "COA" },
  { type: "msds", label: "MSDS" },
];

export function ReceivingDocAttachModal({ open, onOpenChange, rb, onAttach }: Props) {
  // 문서 미충족 라인만(complete/not_required 제외).
  const pendingLines = rb.lineReceipts.filter(
    (l) => l.documentStatus === "missing" || l.documentStatus === "partial",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            문서 첨부 — {rb.receivingNumber}
          </DialogTitle>
          <DialogDescription>
            필수 문서(COA·MSDS)를 첨부하면 검수·재고 반영을 진행할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {pendingLines.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            모든 라인의 필수 문서가 첨부되었습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
            {pendingLines.map((line) => {
              const lots = line.lotRecords;
              return (
                <div
                  key={line.id}
                  className="border border-slate-200 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-5 min-w-5 px-1 rounded grid place-items-center bg-slate-100 text-slate-600 text-[11px] font-bold font-mono">
                      {line.lineNumber}
                    </span>
                    <span className="text-[13px] font-semibold text-slate-900 truncate">
                      {line.itemName}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REQUIRED.map(({ type, label }) => {
                      const attached =
                        lots.length > 0 &&
                        lots.every((lot) =>
                          type === "coa" ? lot.coaAttached : lot.msdsAttached,
                        );
                      return attached ? (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 h-8 rounded-md"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          {label} 첨부됨
                        </span>
                      ) : (
                        <button
                          key={type}
                          type="button"
                          onClick={() => onAttach(line.id, type)}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 h-8 rounded-md active:scale-95 hover:bg-blue-100"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {label} 첨부
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
