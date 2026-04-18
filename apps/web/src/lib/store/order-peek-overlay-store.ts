/**
 * Order Candidate Peek — Overlay Store
 *
 * 책임:
 * - `/dashboard/orders` (발주 전환 큐) 의 entry-level peek drawer 를 열고 닫는 단일 overlay store.
 * - peek drawer 는 read-only summary 만 보여주고, 본격 검토/처리는 워크벤치(/dashboard/orders) 로 hand-off.
 *
 * 고정 규칙:
 * 1. 본 store 는 canonical truth 를 보유하지 않는다. payload 는 호출자가 zip 한 hint 일 뿐이며,
 *    실제 데이터는 useOrderQueueStore / 서버가 source of truth 다.
 * 2. peek 는 1-shot UI 다. terminal action 을 노출하지 않는다 — "워크벤치 열기" 만 결선 경로.
 * 3. ESC / overlay click 으로 닫히면 자동으로 payload 가 비워져 다음 호출의 잔류물이 새지 않는다.
 * 4. overlay 한 개만 열릴 수 있다 (single-instance).
 *
 * 호출 방법 2가지:
 *
 * A. payload 기반 (호출자가 hint 구성):
 * ```ts
 * useOrderPeekOverlayStore.getState().open({
 *   title: "발주 전환 후보",
 *   subtitle: "검토 필요",
 *   summaryLines: ["Thermo Fisher FBS 외 2건 — ₩1,224,000"],
 *   candidateCount: 2,
 * });
 * ```
 *
 * B. ID 기반 (최소 인자 — drawer 내부에서 domain store 참조):
 * ```ts
 * useOrderPeekOverlayStore.getState().openById("poc-001", "Thermo Fisher FBS 외 2건");
 * ```
 *
 * ID 기반 호출은 내부적으로 activeCaseId 만 저장하며,
 * drawer 컴포넌트가 해당 ID 로 useOrderQueueStore.orders 에서 최신 데이터를 find 하여 렌더링한다.
 * (Gemini 지시문의 "ID-based Data Fetching" 패턴 align)
 */

"use client";

import { create } from "zustand";

export interface OrderPeekPayload {
  /** 헤더 1행 — 보통 host context */
  title: string;
  /** 헤더 2행 — 상태 또는 next-action 한 줄 요약 */
  subtitle?: string | null;
  /** 본문 요약 라인 (최대 5줄 권장) — 너무 길면 host 가 잘라서 전달 */
  summaryLines?: string[];
  /** 후보 개수 — 헤더 chip 에 표시 */
  candidateCount?: number | null;
  /** 워크벤치 진입 시 deep-link 를 덮어쓸 수 있다. 기본값 = /dashboard/orders */
  workbenchHref?: string;
}

interface OrderPeekOverlayState {
  isOpen: boolean;
  payload: OrderPeekPayload | null;
  /** ID 기반 호출 시 저장. drawer 내부에서 domain store 로 최신 데이터 lookup. */
  activeCaseId: string | null;

  // ── Open ──
  /** payload 기반 — 호출자가 hint 를 직접 구성 */
  open: (payload: OrderPeekPayload) => void;
  /** ID 기반 — drawer 내부에서 domain store 참조로 최신 데이터 렌더. */
  openById: (caseId: string, title?: string) => void;
  /** 닫기 — payload + activeCaseId 모두 초기화 */
  close: () => void;
}

export const useOrderPeekOverlayStore = create<OrderPeekOverlayState>((set) => ({
  isOpen: false,
  payload: null,
  activeCaseId: null,

  open: (payload) => set({ isOpen: true, payload, activeCaseId: null }),

  openById: (caseId, title) =>
    set({
      isOpen: true,
      activeCaseId: caseId,
      payload: {
        title: title ?? "발주 전환 후보 상세",
        subtitle: null,
        summaryLines: [],
        candidateCount: null,
        workbenchHref: `/dashboard/orders`,
      },
    }),

  close: () => set({ isOpen: false, payload: null, activeCaseId: null }),
}));
