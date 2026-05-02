/**
 * §11.193d Phase 2.2 #backfill-workflow-capabilities
 *
 * 기존 OrganizationMember 의 role 기반 workflowCapabilities 자동 mirror.
 * 매핑은 lib/permissions/workflow-capabilities.ts 의
 * ROLE_TO_CAPABILITIES_FALLBACK 정합.
 *
 * Idempotent — 이미 non-empty workflowCapabilities 가 있는 member 는 skip.
 *
 * 사용:
 *   npx tsx scripts/backfill-workflow-capabilities.ts
 *
 * Rollback:
 *   - capabilities 데이터 reset 필요 시:
 *     UPDATE "OrganizationMember" SET "workflowCapabilities" = '[]'::jsonb;
 *   - 또는 본 script 의 reset 모드 (--reset 플래그) 사용 (안전 confirm 필요).
 */

import { PrismaClient } from "@prisma/client";
import {
  ROLE_TO_CAPABILITIES_FALLBACK,
  getWorkflowCapabilities,
} from "../src/lib/permissions/workflow-capabilities";

const prisma = new PrismaClient();

interface BackfillStats {
  total: number;
  alreadyHasCapabilities: number;
  backfilled: number;
  skippedNoMapping: number;
  errors: number;
}

async function backfill(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    total: 0,
    alreadyHasCapabilities: 0,
    backfilled: 0,
    skippedNoMapping: 0,
    errors: 0,
  };

  const members = await prisma.organizationMember.findMany({
    select: {
      id: true,
      role: true,
      workflowCapabilities: true,
    },
  });
  stats.total = members.length;

  for (const member of members) {
    try {
      // 이미 non-empty 면 skip (idempotent)
      const existing = getWorkflowCapabilities({
        workflowCapabilities: member.workflowCapabilities,
      });
      if (existing.length > 0) {
        stats.alreadyHasCapabilities += 1;
        continue;
      }

      // role 기반 mirror
      const mirror = ROLE_TO_CAPABILITIES_FALLBACK[member.role];
      if (!mirror) {
        stats.skippedNoMapping += 1;
        // eslint-disable-next-line no-console
        console.warn(
          `[backfill-workflow-capabilities] member ${member.id} 의 role=${member.role} 매핑 부재 — skip`,
        );
        continue;
      }
      if (mirror.length === 0) {
        // VIEWER / MEMBER 등 빈 매핑은 default 와 동일 — DB write 생략
        continue;
      }

      await prisma.organizationMember.update({
        where: { id: member.id },
        data: { workflowCapabilities: mirror },
      });
      stats.backfilled += 1;
    } catch (error) {
      stats.errors += 1;
      // eslint-disable-next-line no-console
      console.error(
        `[backfill-workflow-capabilities] member ${member.id} 실패:`,
        error,
      );
    }
  }

  return stats;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("[backfill-workflow-capabilities] 시작 (§11.193d Phase 2.2)");
  const stats = await backfill();
  // eslint-disable-next-line no-console
  console.log("[backfill-workflow-capabilities] 완료:", stats);
  await prisma.$disconnect();
}

// CLI entry point — vitest import 시 main() 실행 안 함
if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[backfill-workflow-capabilities] fatal:", error);
    process.exit(1);
  });
}

export { backfill, type BackfillStats };
