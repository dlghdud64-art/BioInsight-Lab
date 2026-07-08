"use client";

/**
 * §11.334 P3 — 입고 퀵뷰 드로어 (시안: 입고 목록 웹 리디자인.html §quickview)
 *
 * 행클릭 → 우측 same-canvas 드로어. 진행 스텝 + 입고 요약 + 문서 상태 + 상태별 액션.
 * canonical 재고 truth 대체 0(전부 projection). 액션은 실 동작에 연결(no-op 0):
 *   상세 열기 = onDetail(라우트), coa/post/inspect = onAction(P4에서 모달, 현재 상세 라우트).
 */
import { useEffect } from "react";
import { X, ChevronRight, Check, AlertTriangle } from "lucide-react";
import type { ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";
import {
  resolveReceivingRowVisual,
  resolveReceivingStepCode,
  resolveReceivingStepStates,
  resolveReceivingDocState,
  type ReceivingRowTone,
  type ReceivingRowAction,
} from "@/lib/receiving/receiving-list-view-model";

const STEP_LABELS = ["입고", "검수", "문서", "반영"] as const;

const BADGE_TONE: Record<ReceivingRowTone, string> = {
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-[#fdf3ec] text-[#b45821] border-[#f3d4bf]",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const ACTION_LABEL: Record<Exclude<ReceivingRowAction, "none">, string> = {
  coa: "문서 확보",
  post: "재고 반영",
  inspect: "검수 시작",
};

const ACTION_BTN: Record<Exclude<ReceivingRowAction, "none">, string> = {
  coa: "bg-rose-600 hover:bg-rose-700 text-white",
  post: "bg-emerald-600 hover:bg-emerald-700 text-white",
  inspect: "bg-blue-600 hover:bg-blue-700 text-white",
};

export function ReceivingQuickviewDrawer({
  item,
  onClose,
  onDetail,
  onAction,
}: {
  item: ModuleLandingItem | null;
  onClose: () => void;
  onDetail: (item: ModuleLandingItem) => void;
  onAction: (action: Exclude<ReceivingRowAction, "none">, item: ModuleLandingItem) => void;
}) {
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visual = item ? resolveReceivingRowVisual(item.bucketKey) : null;
  const stepStates = item ? resolveReceivingStepStates(resolveReceivingStepCode(item.bucketKey)) : [];
  const docState = item ? resolveReceivingDocState(item.bucketKey) : "ok";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* scrim */}
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />

      {/* drawer */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-[456px] max-w-[94vw] h-full bg-white shadow-2xl flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-8"
        }`}
      >
        {item && visual && (
          <>
            {/* header */}
            <div className="flex items-start gap-3 px-5 py-5 border-b border-slate-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[11.5px] font-bold text-slate-400">{item.entityId}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold border ${BADGE_TONE[visual.tone]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {visual.badgeLabel}
                  </span>
                </div>
                <h2 className="text-[17px] font-extrabold text-slate-900 truncate">{item.title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="h-9 w-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-none"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* body — §receiving-quickview-compact(호영님 2026-07-08): flex-1 제거로 콘텐츠 높이만
                차지 → 액션 footer 가 콘텐츠 바로 밑에 붙음(시안 정합). 이전엔 flex-1 로 body 가 늘어나
                footer 를 드로어 맨 아래로 밀어 중간 빈 공간이 크게 남던 것 정정. */}
            <div className="overflow-y-auto px-5 py-5">
              {/* progress steps */}
              <div className="flex items-start mb-6">
                {STEP_LABELS.map((label, i) => {
                  const st = stepStates[i] ?? "idle";
                  const dotCls =
                    st === "done"
                      ? "bg-emerald-600 text-white"
                      : st === "cur"
                        ? "bg-blue-600 text-white ring-4 ring-blue-50"
                        : st === "alert"
                          ? "bg-rose-600 text-white ring-4 ring-rose-50"
                          : "bg-slate-100 text-slate-400";
                  const lblCls =
                    st === "done"
                      ? "text-slate-600"
                      : st === "cur"
                        ? "text-blue-700"
                        : st === "alert"
                          ? "text-rose-700"
                          : "text-slate-400";
                  const lineCls = i === 0 ? "hidden" : st === "done" || st === "cur" || st === "alert" ? "bg-emerald-200" : "bg-slate-200";
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1.5 relative">
                      <div className={`absolute top-3 -left-1/2 w-full h-0.5 ${lineCls}`} />
                      <div className={`relative z-10 h-6 w-6 rounded-full grid place-items-center text-[11px] font-extrabold ${dotCls}`}>
                        {i + 1}
                      </div>
                      <span className={`text-[10.5px] font-bold ${lblCls}`}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* summary */}
              <div className="mb-5">
                <div className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide mb-2.5">입고 요약</div>
                <div className="text-[13px]">
                  <div className="flex justify-between py-2 border-t border-slate-100 first:border-t-0">
                    <span className="text-slate-500">상태</span>
                    <span className="font-bold text-slate-900">{item.summary}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-slate-100">
                    <span className="text-slate-500">담당</span>
                    <span className="font-bold text-slate-700 font-mono">{item.currentOwnerName ?? "미배정"}</span>
                  </div>
                  {item.dueState.tone !== "normal" && (
                    <div className="flex justify-between py-2 border-t border-slate-100">
                      <span className="text-slate-500">기한</span>
                      <span className={`font-bold ${item.dueState.isOverdue ? "text-rose-700" : "text-[#b45821]"}`}>{item.dueState.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* doc state */}
              <div>
                <div className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide mb-2.5">문서 상태</div>
                <div className="flex flex-wrap gap-2">
                  {docState === "miss" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5" /> COA 미첨부
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="h-3.5 w-3.5" /> 문서 확보
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => onDetail(item)}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" /> 상세 열기
              </button>
              <span className="flex-1" />
              {visual.action !== "none" && (
                <button
                  type="button"
                  onClick={() => onAction(visual.action as Exclude<ReceivingRowAction, "none">, item)}
                  className={`inline-flex items-center justify-center h-10 px-5 rounded-xl text-[13.5px] font-extrabold ${ACTION_BTN[visual.action as Exclude<ReceivingRowAction, "none">]}`}
                >
                  {ACTION_LABEL[visual.action as Exclude<ReceivingRowAction, "none">]}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
