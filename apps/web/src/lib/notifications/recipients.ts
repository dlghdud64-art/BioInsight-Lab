/**
 * 알림 수신자 해석 — 공통 헬퍼
 *
 * 도메인 trigger 배선(알림 고도화)에서 반복되는 "소유자 + 조직 OWNER/ADMIN 브로드캐스트"
 * 수신자 산출을 단일화한다. §11.250f-org / request/approve BUDGET_WARNING 패턴을 추출.
 *
 * 원칙:
 * - Set dedup (소유자가 곧 org admin 이어도 1회).
 * - graceful: org 멤버 조회 실패 시 소유자 단일 fallback(알림 누락 < 메인 mutation 보호).
 * - 순수 조회만 — canonical mutation 무관(알림은 상태전이의 projection).
 */

import { db } from "@/lib/db";

/**
 * 소유자 + 조직 OWNER/ADMIN 멤버를 dedup 한 알림 수신자 목록.
 *
 * @param ownerId 엔티티 소유자 userId (예: inventory.userId, order.userId)
 * @param organizationId 조직 ID (null 이면 소유자만)
 * @returns dispatchNotificationEvent recipients 형식 배열 (빈 배열 가능)
 */
export async function resolveOrgRecipients(
  ownerId: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<Array<{ userId: string }>> {
  const ids = new Set<string>();
  if (ownerId) ids.add(ownerId);

  if (organizationId) {
    try {
      const members = await db.organizationMember.findMany({
        where: {
          organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { userId: true },
      });
      for (const m of members as Array<{ userId: string }>) {
        if (m.userId) ids.add(m.userId);
      }
    } catch (err) {
      // graceful — 소유자 단일 fallback (알림 누락 허용, 메인 흐름 비차단)
      console.error(
        "[notifications/recipients] org 멤버 조회 실패 (owner fallback):",
        err,
      );
    }
  }

  return Array.from(ids).map((userId) => ({ userId }));
}
