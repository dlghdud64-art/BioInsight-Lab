/**
 * §org-create-limit — 조직 소유권 데이터 불변식: **OWNER 0인 조직 = 0**.
 *
 * 왜 코드가 아니라 데이터를 재는가:
 *   `POST /api/organizations` 의 생성 한도는 `role: "OWNER"` 멤버십만 계수한다.
 *   OWNER 가 없는 조직이 있으면 그 소유자는 계수 0 이 되어 **한도가 오히려 풀린다** —
 *   조이는 게이트가 푸는 방향으로 뒤집힌다.
 *
 *   이 안전은 코드가 보증하지 않는다. OWNER 배선은 §team-org-role-model Phase 2
 *   (2026-08-12) 이후이고, 그 이전 생성분은 ADMIN 이다.
 *   그래서 주석이 아니라 발화하는 단언으로 세운다.
 *
 * ✅ 이 불변식이 실제로 잡았다 (2026-08-30). 원 헤더는 "2026-08-29 prod 실측이
 *   OWNER 4 · ADMIN 0 이라 백필이 이미 돌았다" 고 적었으나 그 실측은 **tvkl 테스트 DB**
 *   였다(§2b 사례 5). 실 prod 는 ADMIN 1 · ownerless 2 — 데이터가 보증한다던 안전이
 *   **처음부터 없었고**, 이 프로브가 prod 에서 발화해 그것을 드러냈다.
 *   🔑 데이터를 재는 판단이 옳았음이 여기서 실증된다. 코드만 봤으면 못 봤다.
 *
 * 🛑 복구 경로 — 자동 도구 없음. 데이터 정정은 **operator-shell 수기 처리**다.
 *   구 `scripts/add-owner-role.mjs` 는 2026-08-30 폐기·삭제했다. 네 가지가 오늘 세운
 *   조항을 정면으로 어긴다:
 *     ① 인자 없는 `new PrismaClient()` — `.env`(테스트 DB)로 간다. §2c 사고의 구조 원인 그 자체.
 *     ② `ALTER TYPE ... ADD VALUE` DDL 동반 — 데이터 정정 도구가 스키마를 건드린다.
 *     ③ 전 조직 루프 — 대상 지정 없이 "최초 ADMIN" 을 일괄 승격한다.
 *     ④ 감사 기록 0 — 누가 왜 승격했는지 안 남는다.
 *   재작성한다면 대상 1건 지정 · ref 출력 선행 · AuditLog(PERMISSION_CHANGED) 필수.
 *   2026-08-30 T1 승격은 그 형태로 수기 처리했다(1행 UPDATE + 감사 1행).
 *
 * 📌 **알려진 잔여 (2026-08-30 기준): `ownerlessCount === 1`.**
 *   `org-bioinsight-lab` — `prisma/seed.ts:443` 데모 시드 조직. 시드가
 *   `organizationMember` 를 아예 만들지 않아 멤버 0 이다(생성 라우트 결함 아님 ·
 *   수기 id · Account/Session 0 으로 실증). 처분은 데모·파일럿 표면의 참조 전수 후
 *   판정 예정이며, seed.ts 자체 수정은 별 슬라이스다.
 *   🛑 사유 없는 1 을 남기지 않는다 — 사유가 안 붙은 경보는 노이즈로 늙고,
 *     노이즈가 된 경보는 §approver-axis (다) 에서 내린 앰버와 같은 부류가 된다.
 *     이 값이 **2 이상이면 새 위반**이다. 1 이어도 사유가 위와 다르면 새 위반이다.
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
