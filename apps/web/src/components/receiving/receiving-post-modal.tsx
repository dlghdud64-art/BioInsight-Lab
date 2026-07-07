"use client";

/**
 * §11.334 P4 — 재고 반영 확인 모달 (시안: 입고 목록 웹 리디자인.html §mPost)
 *
 * same-canvas center 모달. 확인 콜아웃 + 반영 요약 + 재고 반영 버튼.
 * mutation = store.postToInventory(rb.id) (상세 페이지와 동일 경로, 부모가 호출).
 *   ⚠ approve(공급사 draft 승인)와 다른 레이어 — entityId=rb.id 정합.
 *   저장 위치 select 는 postToInventory 가 받지 않으므로 미노출(dead field 방지).
 */
import { useEffect } from "react";
import { Check, X } from "lucide-react";
import type { ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";

export function ReceivingPostModal({
  item,
  onClose,
  onConfirm,
}: {
  item: ModuleLandingItem | null;
  onClose: () => void;
  onConfirm: (item: ModuleLandingItem) => void;
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

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-8 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-3"
        }`}
      >
        {item && (
          <>
            <div className="flex items-start gap-3 px-5 py-5 border-b border-slate-200">
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-extrabold text-slate-900">재고 반영</h2>
                <p className="text-[12.5px] text-slate-500 mt-1 truncate">
                  <span className="font-mono">{item.entityId}</span> · {item.title}
                </p>
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

            <div className="px-5 py-5">
              <div className="flex gap-3 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 mb-4">
                <Check className="h-5 w-5 flex-none mt-0.5" />
                <div>
                  <b className="text-[13px]">반영 준비 완료</b>
                  <p className="text-[12px] mt-0.5 leading-relaxed">
                    검수와 필수 문서가 확인된 수령 품목을 재고에 반영합니다.
                  </p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-[13px]">
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-slate-500">대상</span>
                  <span className="font-bold text-slate-900 truncate ml-3">{item.title}</span>
                </div>
                <div className="flex justify-between px-3.5 py-2.5 border-t border-slate-100">
                  <span className="text-slate-500">상태 요약</span>
                  <span className="font-bold text-slate-700 truncate ml-3">{item.summary}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <span className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => onConfirm(item)}
                className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-[13.5px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                재고 반영
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
