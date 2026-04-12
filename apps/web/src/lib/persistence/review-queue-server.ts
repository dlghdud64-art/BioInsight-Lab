/**
 * Review Queue Draft — Server Persistence Layer
 *
 * 목적:
 *   Step 1 Review Queue draft 를 DB 에 영속화하여
 *   브라우저 세션 종료 후에도 유실되지 않게 한다.
 *
 * 고정 규칙:
 *   1. canonical truth 는 클라이언트 React state.
 *      본 레이어는 draft snapshot 만 보관.
 *   2. userId 기준 upsert — 유저당 하나의 draft.
 *   3. 빈 배열이면 row 삭제 (storage 오염 방지).
 */

import { db } from "@/lib/db";

/**
 * 특정 유저의 review queue draft 를 서버에 저장한다.
 * 빈 배열이면 기존 draft 를 삭제한다.
 */
export async function persistReviewQueueDraftServer(
  userId: string,
  items: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  try {
    if (items.length === 0) {
      await db.reviewQueueDraft.deleteMany({ where: { userId } });
      return;
    }

    await db.reviewQueueDraft.upsert({
      where: { userId },
      create: { userId, payload: items as any },
      update: { payload: items as any },
    });
  } catch (e) {
    console.error("[review-queue-server] persistReviewQueueDraftServer 실패:", e);
  }
}

/**
 * 특정 유저의 persisted review queue draft 를 조회한다.
 * 없으면 빈 배열.
 */
export async function loadReviewQueueDraftServer(
  userId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const draft = await db.reviewQueueDraft.findUnique({
      where: { userId },
    });
    if (!draft || !draft.payload) return [];
    const payload = draft.payload as unknown;
    if (!Array.isArray(payload)) return [];
    return payload as Record<string, unknown>[];
  } catch (e) {
    console.error("[review-queue-server] loadReviewQueueDraftServer 실패:", e);
    return [];
  }
}

/**
 * 특정 유저의 persisted review queue draft 를 삭제한다.
 */
export async function clearReviewQueueDraftServer(
  userId: string,
): Promise<void> {
  try {
    await db.reviewQueueDraft.deleteMany({ where: { userId } });
  } catch (e) {
    console.error("[review-queue-server] clearReviewQueueDraftServer 실패:", e);
  }
}
