/**
 * Outbound History — Server Persistence Layer
 *
 * 목적:
 *   dispatch-outbound-store 의 historyByPoId 를 Supabase 에 영속화하여
 *   브라우저 세션 종료 후에도 outbound execution lineage 유지.
 *
 * 고정 규칙:
 *   1. canonical truth 는 dispatch-outbound-store 의 latest pointer.
 *      본 테이블은 audit lineage 만 보관.
 *   2. PO 단위 저장/조회/삭제. broad global clear 금지.
 *   3. invalidation 이벤트에서 해당 PO 의 persisted history 를 hard-delete.
 *   4. Supabase 접근 불가 시 sessionStorage fallback 유지.
 */

import { db } from "@/lib/db";

/**
 * 특정 PO 의 outbound history 를 서버에 저장한다.
 * 기존 데이터를 삭제하고 새로 일괄 삽입 (replace 의미론).
 * 빈 배열이면 해당 PO 의 모든 history 를 제거한다.
 */
export async function persistOutboundHistoryServer(
  poId: string,
  history: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  try {
    await db.$transaction(async (tx: any) => {
      // 기존 history 삭제
      await tx.outboundHistory.deleteMany({
        where: { poId },
      });

      // 새 history 일괄 삽입
      if (history.length > 0) {
        await tx.outboundHistory.createMany({
          data: history.map((record, index) => ({
            poId,
            seqIndex: index,
            recordType: (record as any).type ?? (record as any).recordType ?? "unknown",
            payload: record as any,
          })),
        });
      }
    });
  } catch (e) {
    console.error("[outbound-history-server] persistOutboundHistoryServer 실패:", e);
  }
}

/**
 * 특정 PO 의 persisted outbound history 를 조회한다.
 * seqIndex 순으로 정렬. 없으면 빈 배열.
 */
export async function loadOutboundHistoryServer(
  poId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const records = await db.outboundHistory.findMany({
      where: { poId },
      orderBy: { seqIndex: "asc" },
    });
    return records.map((r: any) => r.payload as Record<string, unknown>);
  } catch (e) {
    console.error("[outbound-history-server] loadOutboundHistoryServer 실패:", e);
    return [];
  }
}

/**
 * 특정 PO 의 persisted outbound history 를 삭제한다.
 * reopen / invalidation 이벤트에서 호출.
 */
export async function clearOutboundHistoryServer(
  poId: string,
): Promise<void> {
  try {
    await db.outboundHistory.deleteMany({
      where: { poId },
    });
  } catch (e) {
    console.error("[outbound-history-server] clearOutboundHistoryServer 실패:", e);
  }
}
