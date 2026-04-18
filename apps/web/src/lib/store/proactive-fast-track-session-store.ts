/**
 * Proactive Fast-Track Session Store — Copilot Intercept presentation state.
 *
 * 왜 별도 store 인가:
 * - useFastTrackStore 는 canonical computed view (recommendation · input · log).
 * - 본 store 는 "이 세션에서 사용자가 이미 본 / 닫은 proactive 제안" 집합만
 *   보관한다. canonical truth 도 아니고 audit trail 도 아닌 순수 UX state 라서
 *   fast-track-store 에 섞으면 책임 경계가 흐려진다.
 * - 세션 종료와 함께 증발하므로 persistence 없음.
 *
 * 정합성:
 * - 기록 단위는 FastTrackRecommendationObject.objectId (evaluation fingerprint).
 *   drift 재평가로 objectId 가 새로 부여되면 자동으로 다시 "unseen" 상태가 되어
 *   proactive modal 이 legit 하게 재노출된다.
 * - Batch 1 의 loggedRecommendationObjectIds 와 동일한 디자인 원칙을 공유한다.
 */
"use client";

import { create } from "zustand";

interface ProactiveSessionState {
  /** entry intercept modal 이 이번 세션에서 이미 표시되었는지 (라이프사이클 guard) */
  entryModalShownThisSession: boolean;
  /** 사용자가 proactive 경로에서 dismiss / accept 한 recommendationObjectId 집합 */
  dismissedObjectIds: Set<string>;
  /** action intercept modal 이 이번 세션에서 표시된 횟수 (analytics 용, UX 로직은 아님) */
  interceptShownCount: number;

  /** entry modal 을 열어도 되는지 판정 (아직 한 번도 안 보였을 때 true) */
  canShowEntryModal: () => boolean;
  /** entry modal 을 "이번 세션에 표시했음" 으로 마킹 */
  markEntryModalShown: () => void;

  /** 여러 objectId 를 한 번에 dismissed 로 추가 (bulk accept / bulk dismiss 양쪽에서 사용) */
  addDismissed: (objectIds: readonly string[]) => void;

  /** intercept modal 표시 카운터 증가 */
  incrementInterceptShown: () => void;

  /** 테스트/로그아웃 경로 */
  reset: () => void;
}

export const useProactiveFastTrackSessionStore = create<ProactiveSessionState>((set, get) => ({
  entryModalShownThisSession: false,
  dismissedObjectIds: new Set<string>(),
  interceptShownCount: 0,

  canShowEntryModal: () => !get().entryModalShownThisSession,

  markEntryModalShown: () => set({ entryModalShownThisSession: true }),

  addDismissed: (objectIds) => {
    if (objectIds.length === 0) return;
    set((state) => {
      const next = new Set(state.dismissedObjectIds);
      objectIds.forEach((id) => next.add(id));
      return { dismissedObjectIds: next };
    });
  },

  incrementInterceptShown: () =>
    set((state) => ({ interceptShownCount: state.interceptShownCount + 1 })),

  reset: () =>
    set({
      entryModalShownThisSession: false,
      dismissedObjectIds: new Set<string>(),
      interceptShownCount: 0,
    }),
}));
