/**
 * §tenant-isolation-placeholder A3 — 호출자 조직 도출 (클라 입력 금지)
 *
 * 배경: work-queue 계열 라우트가 `organizationId` 를 **쿼리스트링/바디에서 받아
 * 그대로 where 에 넣고** 있었다. 삭제된 `safety/spend`·`products/safety` 와 같은
 * 형태이며, 조직 게이트(enforceAction)는 (a)≡(b) 항등이라 이를 거르지 못한다.
 *
 * 🛑 파라미터를 남기고 검증만 붙이는 방식은 채택하지 않는다(호영님 판정선).
 *   검증 누락이 곧 같은 구멍이 되기 때문이다. **입력을 없애고 세션에서 도출한다.**
 *
 * 다중 소속: 현재 데이터 모델상 사용자당 조직 1개가 사실상 전제다
 * (`api/ingestion` 이 이미 `organizationMembers[0]` 패턴을 쓴다). 여기서도 첫 멤버십을
 * 쓰되, 다중 소속이 실제로 생기면 조직 선택 UI 와 함께 재설계한다 — 그때까지
 * **클라가 조직을 지정하는 경로는 열지 않는다.**
 */
import { db } from "@/lib/db";

/** 호출자가 속한 조직 id 전부 */
export async function getCallerOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m: { organizationId: string }) => m.organizationId);
}

/**
 * 호출자의 조직 1개 (없으면 undefined).
 * 쿼리 함수들이 단일 `organizationId?` 만 받으므로 첫 멤버십을 쓴다.
 */
export async function getCallerOrganizationId(userId: string): Promise<string | undefined> {
  const ids = await getCallerOrganizationIds(userId);
  return ids[0];
}
