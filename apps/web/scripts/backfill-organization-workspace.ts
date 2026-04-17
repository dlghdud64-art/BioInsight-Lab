/**
 * Organization ↔ Workspace 1:1 bootstrap 백필 스크립트 (옵션 B)
 *
 * 설계 근거: docs/architecture/organization-workspace-bootstrap.md §3.5
 *
 * 이 스크립트는 Phase 1 마이그레이션(nullable organizationId 추가)이 적용된 직후,
 * Phase 2 마이그레이션(NOT NULL + @unique 승격) 실행 전에 1회만 실행한다.
 *
 * 동작 요약
 * ---------
 *   1) Workspace 에 organizationId 가 설정돼 있지만 Organization 이 없는 고아 레코드 확인 (경고만)
 *   2) Organization 전체 스캔 → 아직 Workspace 가 연결되지 않은 Organization 목록 추출
 *   3) 각 Organization 마다:
 *        - Workspace 신규 생성 (name = 조직명, slug = 충돌 회피, plan = FREE)
 *        - organizationId 를 해당 Organization 으로 연결
 *        - OrganizationMember 중 role 이 ADMIN / OWNER 인 사용자를 WorkspaceMember(ADMIN) 로 복제
 *        - 그 외 멤버(VIEWER 등)는 복제하지 않는다 (결제 플로우는 Admin/Owner 만 진입하므로)
 *   4) 실행 결과를 JSON 로그 파일에 저장 (롤백 스크립트 참조용)
 *
 * 안전 가드
 * ---------
 *   --dry-run: 실제 DB 변경 없이 수행 예정 작업만 출력
 *   트랜잭션: Organization 하나당 하나의 트랜잭션으로 묶어 부분 실패 시 해당 건만 롤백
 *   중복 방지: 동일 organizationId 에 이미 Workspace 가 있으면 skip
 *
 * 실행 방법
 * ---------
 *   cd apps/web
 *   # 예행 실행
 *   npx tsx scripts/backfill-organization-workspace.ts --dry-run
 *   # 실제 실행
 *   npx tsx scripts/backfill-organization-workspace.ts
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { randomBytes } from "node:crypto";

// .env.local → .env 순으로 로드
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");

const prisma = new PrismaClient({
  log: ["error"],
  datasources: process.env.DIRECT_URL
    ? { db: { url: process.env.DIRECT_URL } }
    : undefined,
});

// ── slug 유틸 (lib/workspace/slug.ts 의 런타임 의존성을 스크립트로 인라인) ──
const SLUG_BASE_MAX = 40;
const SLUG_FINAL_MAX = 50;

function normalizeSlugBase(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, SLUG_BASE_MAX);
  return cleaned.length >= 2 ? cleaned : "";
}

async function generateUniqueWorkspaceSlug(
  tx: Prisma.TransactionClient,
  organizationName: string,
): Promise<string> {
  const fallbackBase = () => `org-${randomBytes(4).toString("hex")}`;
  const base = normalizeSlugBase(organizationName) || fallbackBase();

  if (!(await tx.workspace.findUnique({ where: { slug: base } }))) {
    return base;
  }
  for (let n = 2; n <= 20; n++) {
    const candidate = `${base}-${n}`.slice(0, SLUG_FINAL_MAX);
    if (!(await tx.workspace.findUnique({ where: { slug: candidate } }))) {
      return candidate;
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomBytes(4).toString("hex")}`.slice(0, SLUG_FINAL_MAX);
    if (!(await tx.workspace.findUnique({ where: { slug: candidate } }))) {
      return candidate;
    }
  }
  return fallbackBase();
}

// ── 실행 로그 타입 ───────────────────────────────────────
type BackfillLogEntry = {
  organizationId: string;
  organizationName: string;
  action: "created" | "skipped_already_linked" | "dry_run_would_create" | "failed";
  workspaceId?: string;
  workspaceSlug?: string;
  adminMemberUserIds?: string[];
  error?: string;
};

async function main() {
  const startedAt = new Date();
  console.log(`[backfill-organization-workspace] start at ${startedAt.toISOString()}`);
  console.log(`[backfill-organization-workspace] mode: ${DRY_RUN ? "DRY-RUN" : "APPLY"}\n`);

  // 0) 사전 점검: organizationId 가 걸려 있지만 대응 Organization 이 없는 고아 Workspace
  const orphanWorkspaces = await prisma.$queryRaw<Array<{ id: string; slug: string; organizationId: string | null }>>`
    SELECT w.id, w.slug, w."organizationId"
    FROM "Workspace" w
    LEFT JOIN "Organization" o ON o.id = w."organizationId"
    WHERE w."organizationId" IS NOT NULL AND o.id IS NULL
  `;
  if (orphanWorkspaces.length > 0) {
    console.warn(
      `[경고] 고아 Workspace ${orphanWorkspaces.length} 건 — organizationId 가 유효하지 않습니다.`,
    );
    orphanWorkspaces.forEach((w) =>
      console.warn(`   - ws=${w.id} slug=${w.slug} dangling_org=${w.organizationId}`),
    );
    console.warn(
      "   이 건은 백필에서 건드리지 않습니다. 수동으로 organizationId 를 NULL 로 내리거나 삭제해야 합니다.\n",
    );
  }

  // 1) 연결된 Workspace 가 있는 Organization 조회 → 제외 대상
  const linked = await prisma.workspace.findMany({
    where: { organizationId: { not: null } },
    select: { organizationId: true },
  });
  const linkedOrgIds = new Set(linked.map((w) => w.organizationId!).filter(Boolean));

  // 2) 전체 Organization 조회
  const allOrganizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      members: {
        where: { role: { in: ["ADMIN", "OWNER"] } },
        select: { userId: true, role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const targets = allOrganizations.filter((o) => !linkedOrgIds.has(o.id));

  console.log(`[stats] Organization 총 ${allOrganizations.length} 건`);
  console.log(`[stats] 이미 Workspace 연결된 Organization: ${linkedOrgIds.size} 건`);
  console.log(`[stats] 백필 대상 Organization: ${targets.length} 건\n`);

  const logEntries: BackfillLogEntry[] = [];

  for (const org of targets) {
    const adminUserIds = org.members.map((m) => m.userId);

    if (adminUserIds.length === 0) {
      console.warn(
        `[경고] Organization ${org.id} (${org.name}) 에 ADMIN/OWNER 멤버가 없습니다. Workspace 는 생성하되 멤버 복제는 skip.`,
      );
    }

    if (DRY_RUN) {
      const plannedSlug = normalizeSlugBase(org.name) || `org-<random>`;
      console.log(
        `[dry-run] Organization ${org.id} (${org.name}) → Workspace 생성 예정 (slug≈${plannedSlug}, members=${adminUserIds.length})`,
      );
      logEntries.push({
        organizationId: org.id,
        organizationName: org.name,
        action: "dry_run_would_create",
        adminMemberUserIds: adminUserIds,
      });
      continue;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 경쟁 조건 방지: 트랜잭션 안에서 재확인
        const alreadyLinked = await tx.workspace.findFirst({
          where: { organizationId: org.id },
          select: { id: true, slug: true },
        });
        if (alreadyLinked) {
          return { action: "skipped_already_linked" as const, workspace: alreadyLinked };
        }

        const slug = await generateUniqueWorkspaceSlug(tx, org.name);
        const workspace = await tx.workspace.create({
          data: {
            name: org.name,
            slug,
            plan: "FREE",
            organizationId: org.id,
            members: {
              create: adminUserIds.map((userId) => ({
                userId,
                role: "ADMIN" as const,
              })),
            },
          },
          select: { id: true, slug: true },
        });
        return { action: "created" as const, workspace };
      });

      logEntries.push({
        organizationId: org.id,
        organizationName: org.name,
        action: result.action,
        workspaceId: result.workspace.id,
        workspaceSlug: result.workspace.slug,
        adminMemberUserIds: adminUserIds,
      });

      console.log(
        `[${result.action}] org=${org.id} name="${org.name}" ws=${result.workspace.id} slug=${result.workspace.slug}`,
      );
    } catch (err: any) {
      const message = err?.message?.slice(0, 200) ?? String(err);
      console.error(`[실패] Organization ${org.id} (${org.name}) — ${message}`);
      logEntries.push({
        organizationId: org.id,
        organizationName: org.name,
        action: "failed",
        error: message,
      });
    }
  }

  // 3) 결과 로그 파일 저장 (롤백/감사용)
  const finishedAt = new Date();
  const logPath = path.resolve(
    __dirname,
    `../../../docs/reports/backfill-organization-workspace-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`,
  );
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(
      logPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          dryRun: DRY_RUN,
          orphanWorkspaces,
          summary: {
            totalOrganizations: allOrganizations.length,
            alreadyLinked: linkedOrgIds.size,
            processed: targets.length,
            created: logEntries.filter((e) => e.action === "created").length,
            dryRunPlanned: logEntries.filter((e) => e.action === "dry_run_would_create").length,
            skipped: logEntries.filter((e) => e.action === "skipped_already_linked").length,
            failed: logEntries.filter((e) => e.action === "failed").length,
          },
          entries: logEntries,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`\n[완료] 로그 저장: ${logPath}`);
  } catch (err: any) {
    console.warn(`[경고] 로그 파일 저장 실패: ${err?.message}`);
  }

  // 4) 최종 요약
  const createdCount = logEntries.filter((e) => e.action === "created").length;
  const plannedCount = logEntries.filter((e) => e.action === "dry_run_would_create").length;
  const failedCount = logEntries.filter((e) => e.action === "failed").length;
  console.log("\n========== 요약 ==========");
  console.log(`대상 Organization : ${targets.length} 건`);
  console.log(`생성된 Workspace  : ${createdCount} 건${DRY_RUN ? " (dry-run: 미실행)" : ""}`);
  if (DRY_RUN) console.log(`dry-run 예정      : ${plannedCount} 건`);
  console.log(`실패              : ${failedCount} 건`);
  console.log("==========================\n");

  if (failedCount > 0) {
    console.error("실패 건이 있습니다. Phase 2 마이그레이션 실행 전 반드시 해결하세요.");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("[backfill-organization-workspace] 예외 종료:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
