/**
 * §invite-flow Phase 1 — 활성 조직 resolver ("선택의 거처" 읽기)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1 · §8A Workflow Addendum)
 *   정답지: docs/plans/inventory/org-scope-callers.md
 *
 * 왜 이 파일이 있는가 (실측 2026-08-31):
 *   사용자의 활성 조직을 담는 자리가 없어서 API 22곳이 `findFirst({ where: { userId } })` 로,
 *   UI 15곳이 `orgs[0]` 로 **각자** 첫 조직을 골랐다. 지금은 3a(가입 시 조직 자동 생성)로
 *   모두 조직 1개라 오선택이 잠재 상태지만, 초대 수락이 열리면(Phase 3) 2중 소속이 생기고
 *   39곳이 서로 다른 조직을 고를 수 있다. 그래서 수락보다 거처가 먼저다.
 *
 * 규칙 (우선순위 · 각 단계는 **멤버십 재검증**을 통과해야 한다):
 *   ① hint (요청이 명시한 organizationId) — 검증 실패 시 무시하고 ②로 (조용한 승격 금지)
 *   ② User.activeOrganizationId — 탈퇴한 조직을 가리킬 수 있다(FK 는 조직 삭제만 막는다)
 *   ③ createdAt asc 첫 멤버십 — api/team/route.ts:118 의 현행 규칙을 그대로 승계한다.
 *      🔑 이 승계가 "무변경 사용자 행동 변화 0" 의 근거다. 정렬 없는 findFirst 를 새로
 *         만들지 않는다 — 그러면 같은 사용자가 요청마다 다른 조직을 볼 수 있다.
 *   ④ 조직 0 → null. 403 이나 빈 상태 처리는 **호출자 몫**이다 (여기서 던지지 않는다 —
 *      조직 0 은 오류가 아니라 상태이고, 화면마다 다르게 말해야 한다).
 *
 * 🛑 이 함수는 canonical 을 **읽기만** 한다. 쓰기는 PATCH /api/me/active-organization 하나다.
 */
import { db } from "@/lib/db";

export interface ResolveActiveOrganizationArgs {
  userId: string;
  /** 요청이 명시한 조직(쿼리·body). 멤버십 검증을 통과할 때만 채택된다. */
  hint?: string | null;
}

/** 이 사용자가 그 조직의 멤버인가 — 모든 후보가 통과해야 하는 관문. */
async function isMember(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { organizationId: true },
  });
  return Boolean(membership);
}

/**
 * 활성 조직 id 를 돌려준다. 어느 단계에서 나왔든 **멤버십이 검증된 값**이다.
 * 조직이 하나도 없으면 null.
 */
export async function resolveActiveOrganizationId(
  args: ResolveActiveOrganizationArgs,
): Promise<string | null> {
  const { userId, hint } = args;

  // ① hint — 명시값이 있으면 우선하되, 검증 없이 신뢰하지 않는다.
  if (hint) {
    if (await isMember(userId, hint)) return hint;
    // 검증 실패는 조용히 무시한다(403 은 호출자가 판단). 남의 조직 id 를 넣어도
    // 자기 조직으로 떨어질 뿐 남의 데이터로 가지 않는다.
  }

  // ② 저장된 거처 — 탈퇴로 stale 이 될 수 있어 여기서도 검증한다.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { activeOrganizationId: true },
  });
  const stored = user?.activeOrganizationId ?? null;
  if (stored && (await isMember(userId, stored))) return stored;

  // ③ fallback — createdAt asc 첫 멤버십 (team route 현행 규칙 승계).
  const first = await db.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  // ④ 조직 0 → null.
  return first?.organizationId ?? null;
}
