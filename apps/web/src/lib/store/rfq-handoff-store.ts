/**
 * RFQ Handoff Store — cross-page handoff 전달
 *
 * 문제: 소싱 페이지에서 RFQ 제출 성공 후 router.push("/dashboard/quotes") 하면
 * React state 에 보관된 QuoteWorkqueueHandoff 가 소멸된다.
 * 견적관리 페이지가 handoff 데이터 없이 빈 상태로 시작.
 *
 * 해결: Zustand + sessionStorage 로 cross-page handoff 를 보존.
 * 견적관리 페이지 mount 시 consume → 읽고 즉시 clear (1-shot).
 *
 * 고정 규칙:
 * 1. canonical truth 변경 X — handoff 는 presentation hint 일 뿐.
 * 2. 1-shot: consume 한 번 하면 clear. 새로고침으로 재등장 안 됨.
 * 3. sessionStorage 만 사용 (같은 탭 세션 내에서만 유효).
 * 4. 5분 TTL — 오래된 handoff 는 자동 폐기.
 */

"use client";

import { create } from "zustand";
import type { QuoteWorkqueueHandoff } from "@/lib/ai/request-submission-engine";

const STORAGE_KEY = "labaxis:rfq-handoff";
const TTL_MS = 5 * 60 * 1000; // 5분

interface StoredHandoff {
  handoff: QuoteWorkqueueHandoff;
  storedAt: number;
}

function loadFromStorage(): QuoteWorkqueueHandoff | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredHandoff = JSON.parse(raw);
    if (Date.now() - parsed.storedAt > TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.handoff;
  } catch {
    return null;
  }
}

function saveToStorage(handoff: QuoteWorkqueueHandoff): void {
  try {
    if (typeof window === "undefined") return;
    const stored: StoredHandoff = { handoff, storedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // storage full — best effort
  }
}

function clearStorage(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

interface RfqHandoffState {
  /** 현재 pending handoff (소싱 페이지가 set, 견적관리가 consume) */
  pending: QuoteWorkqueueHandoff | null;

  /**
   * 소싱 페이지: 제출 성공 후 navigation 전에 호출.
   * sessionStorage 에 저장 → 다른 페이지에서 consume 가능.
   */
  setHandoff: (handoff: QuoteWorkqueueHandoff) => void;

  /**
   * 견적관리 페이지: mount 시 호출.
   * pending handoff 가 있으면 반환 + clear (1-shot).
   * 없으면 null.
   */
  consumeHandoff: () => QuoteWorkqueueHandoff | null;

  /** 수동 clear (예: 사용자가 handoff banner 닫았을 때) */
  clearHandoff: () => void;
}

export const useRfqHandoffStore = create<RfqHandoffState>((set, get) => ({
  pending: null,

  setHandoff: (handoff) => {
    saveToStorage(handoff);
    set({ pending: handoff });
  },

  consumeHandoff: () => {
    // 1. 메모리에 있으면 메모리 우선
    let handoff = get().pending;
    // 2. 없으면 sessionStorage 에서 hydrate (페이지 네비게이션 후)
    if (!handoff) {
      handoff = loadFromStorage();
    }
    if (handoff) {
      // 1-shot: clear
      clearStorage();
      set({ pending: null });
    }
    return handoff;
  },

  clearHandoff: () => {
    clearStorage();
    set({ pending: null });
  },
}));
