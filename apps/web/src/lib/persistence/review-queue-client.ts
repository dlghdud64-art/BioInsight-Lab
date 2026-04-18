/**
 * Review Queue Draft — Client Persistence Bridge
 *
 * server-first + sessionStorage-fallback 이중 레이어.
 * use-review-queue.ts 의 sessionStorage 직접 호출을 대체.
 */

import type { ReviewQueueItem } from "@/lib/review-queue/types";
import { csrfFetch } from "@/lib/api-client";

const STORAGE_KEY = "labaxis_review_queue_draft";
const API_BASE = "/api/governance/review-queue-draft";

// ── sessionStorage local helpers ──

function loadLocal(): ReviewQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(items: ReviewQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — silent fail
  }
}

function clearLocal(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

// ── Server-first persistence ──

/**
 * review queue draft 저장 — server + sessionStorage 동시 기록.
 * 호출 빈도가 높으므로 sessionStorage 즉시 기록, 서버는 비동기.
 */
export async function persistReviewQueueDraft(
  items: ReadonlyArray<ReviewQueueItem>,
): Promise<void> {
  // 1. sessionStorage 즉시 기록 (동기)
  saveLocal(items as ReviewQueueItem[]);

  // 2. 서버에 비동기 기록
  try {
    await csrfFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch (e) {
    console.warn("[review-queue-client] 서버 저장 실패, sessionStorage fallback:", e);
  }
}

/**
 * review queue draft 로드 — server-first, sessionStorage fallback.
 */
export async function loadReviewQueueDraft(): Promise<ReviewQueueItem[]> {
  // 1. 서버에서 먼저 시도
  try {
    const res = await fetch(API_BASE);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        // 서버 데이터로 sessionStorage 도 갱신
        saveLocal(data.items as ReviewQueueItem[]);
        return data.items as ReviewQueueItem[];
      }
    }
  } catch (e) {
    console.warn("[review-queue-client] 서버 조회 실패, sessionStorage fallback:", e);
  }

  // 2. 서버 실패 시 sessionStorage fallback
  return loadLocal();
}

/**
 * review queue draft 삭제 — 양쪽 모두 제거.
 */
export async function clearReviewQueueDraft(): Promise<void> {
  clearLocal();

  try {
    await csrfFetch(API_BASE, { method: "DELETE" });
  } catch (e) {
    console.warn("[review-queue-client] 서버 삭제 실패:", e);
  }
}
