/**
 * §org-create-limit — 조직 소유권 데이터 불변식: **OWNER 0인 조직 = 0**.
 *
 * 왜 코드가 아니라 데이터를 재는가:
 *   `POST /api/organizations` 의 생성 한도는 `role: "OWNER"` 멤버십만 계수한다.
 *   OWNER 가 없는 조직이 있으면 그 소유자는 계수 0 이 되어 **한도가 오히려 풀린다** —
 *   조이는 게이트가 푸는 방향으로 뒤집힌다.
 *
 *   이 안전은 코드가 보증하지 않는다. OWNER 배선은 §team-org-role-model Phase 2
 *   (2026-08-12) 이후이고, 그 이전 생성분은 ADMIN 이다. 2026-08-29 prod 실측이
 *   OWNER 4 · ADMIN 0 인 것은 백필(`scripts/add-owner-role.mjs`)이 이미 돌았기 때문이며,
 *   **백업 복원 · 다른 환경 · 수동 삽입 어느 쪽도 되살린다.**
 *   그래서 주석이 아니라 발화하는 단언으로 세운다.
 *
 * 위반 시 복구: `scripts/add-owner-role.mjs` (조직별 최초 ADMIN → OWNER 승격).
 *
 * SELECT 만 한다. §migration-order-drift-guard 의 probe 관용을 따른다.
 */

import type { RawQueryClient } from "./migration-drift";

export type OwnerInvariantProbe =
  | { ok: true; reachable: true; ownerlessCount: number; clean: boolean }
  | { ok: false; reachable: false; error: string };

/** 순수 판정 — 행 수만 보고 불변식 성립 여부를 낸다. */
export function evaluateOwnerInvariant(ownerlessCount: number): boolean {
  return ownerlessCount === 0;
}

export async function probeOwnerlessOrganizations(
  client: RawQueryClient
): Promise<OwnerInvariantProbe> {
  try {
    const rows = await client.$queryRawUnsafe<{ n: number | bigint }[]>(
      `SELECT COUNT(*)::int AS n FROM "Organization" o
       WHERE NOT EXISTS (
         SELECT 1 FROM "OrganizationMember" m
         WHERE m."organizationId" = o.id AND m.role = 'OWNER'
       )`
    );
    const ownerlessCount = Number(rows?.[0]?.n ?? 0);
    return {
      ok: true,
      reachable: true,
      ownerlessCount,
      clean: evaluateOwnerInvariant(ownerlessCount),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
