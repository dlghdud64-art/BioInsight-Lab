/**
 * WorkbenchFullOverlay — §po-seed-cutoff 2차 (2026-09-24 · 호영님 판정) · **시드 마지막 소비자 차단**
 *
 * 🛑 이 오버레이는 발주 발송 워크벤치를 Dialog 안에 그렸고, 데이터를 `useDispatchWorkbenchData`
 *    (ops-console 시드 그래프 + seed-data VENDOR_MAP)에서 읽었다. 발주 목록·상세·발송을 끊은 뒤
 *    이것이 **시드 그래프를 살려두는 마지막 읽기 경로**로 남았다.
 *
 * 앞선 보고에서 「시드 id 를 넘기던 표면이 비었으니 실무상 시드 내용은 뜨지 않는다」 고 적었는데,
 * 호영님이 기각했다 — 그건 앞서 기각된 「플래그로 꺼져 있으니 괜찮다」 와 같은 모양이다.
 * 오늘 입력이 없을 뿐 읽기 경로는 살아 있다.
 *
 * 지금: 상세·발송 페이지와 같은 처리 — 시드를 읽지 않고 화면이 자기 상태를 사실대로 말한다.
 *   「찾을 수 없음」 이라고 하지 않는다(찾아본 적이 없다). 실제 발주 조회는 별개 기능 개발이다
 *   (발주는 §purchasing-flag-retired (2026-09-25 · 호영님 판정) 로 제품에서 사라졌다).
 * 계약: __tests__/regression/po-seed-cutoff.test.ts
 */

"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowRight } from "lucide-react";
import { useOverlayChromeStore } from "@/lib/store/overlay-chrome-store";

// ══════════════════════════════════════════════
// Route parsing
// ══════════════════════════════════════════════

function extractPoIdFromRoute(routePath: string | null): string | null {
  if (!routePath) return null;
  // /dashboard/purchase-orders/[poId]/dispatch
  const dispatchMatch = routePath.match(/\/dashboard\/purchase-orders\/([^/]+)\/dispatch/);
  if (dispatchMatch) return dispatchMatch[1];
  // /dashboard/purchase-orders/[poId]
  const poMatch = routePath.match(/\/dashboard\/purchase-orders\/([^/]+)/);
  if (poMatch) return poMatch[1];
  return null;
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function WorkbenchFullOverlay() {
  const isOpen = useOverlayChromeStore((s) => s.isOpen);
  const widthMode = useOverlayChromeStore((s) => s.widthMode);
  const overlayRoutePath = useOverlayChromeStore((s) => s.overlayRoutePath);
  const closeOverlay = useOverlayChromeStore((s) => s.closeOverlay);

  const shouldShow = isOpen && widthMode === "workbench";
  const poId = useMemo(() => extractPoIdFromRoute(overlayRoutePath), [overlayRoutePath]);

  const handleOpenChange = (next: boolean) => {
    if (!next) closeOverlay();
  };

  if (!shouldShow) return null;

  return (
    <DialogPrimitive.Root open={shouldShow} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <DialogPrimitive.Overlay className="absolute inset-0 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          <DialogPrimitive.Content className="relative z-[80] flex flex-col w-[95vw] max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            {/* ── Header bar ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                발송 워크벤치
              </span>
              <DialogPrimitive.Close className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
                <span className="sr-only">닫기</span>
              </DialogPrimitive.Close>
            </div>

            {/* ── Body — 미연결 안내(상세·발송 페이지와 같은 문구 축) ── */}
            <div className="p-5">
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
                <p className="text-[13px] font-bold text-gray-500">발주 발송 데이터 없음</p>
                <p className="mt-0.5 text-xs text-gray-500 break-keep">
                  이 화면은 아직 실제 발주에 연결되지 않았습니다. 진행 중인 입고는 입고 관리에서 볼 수 있습니다.
                </p>
                <Link
                  href="/dashboard/receiving"
                  onClick={closeOverlay}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  입고 관리로 이동 <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <DialogPrimitive.Title className="sr-only">발송 워크벤치</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              발주 {poId ?? ""} 발송 워크벤치 · 실제 발주 데이터에 연결되지 않음
            </DialogPrimitive.Description>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
