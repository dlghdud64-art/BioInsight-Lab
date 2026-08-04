/**
 * apps/web/scripts/smoke/migration-drift.ts
 *
 * §migration-order-drift-guard — operator 1명령 drift 검사 (v2, 직접 쿼리).
 *
 *   npm run smoke:migration --prefix apps/web   (또는 apps/web 에서 npm run smoke:migration)
 *   — 런너 중립 package.json 스크립트. operator 셸은 npm 설치본이라 pnpm exec 는
 *     tsx 미해석(P4 실측) — 직접 실행 시 `npx tsx scripts/smoke/migration-drift.ts`.
 *
 * v1(.cjs)은 `prisma migrate status` CLI 래퍼였으나 P4 prod 실증(2026-08-04)에서
 * CLI가 operator 환경 5432에서도 90s hang(exit null) → FALSE STOP. 이 버전은
 * 런타임 health probe와 **동일 모듈**을 재사용한다 — 계산 이원화 0:
 *   - manifest: scripts/generate-migration-manifest.cjs 의 generateManifest()
 *     (현재 워크트리 실시간 스캔 — deploy-tree-state 계약)
 *   - 대조:     src/lib/health/migration-drift.ts 의 computeMigrationDrift()
 *   - DB:       @prisma/client 직접 SELECT (P4 실증 경로, hang 없음)
 *
 * 절차:
 *   1. .env/.env.local 에서 DIRECT_URL(우선)/DATABASE_URL 로드
 *   2. 선검증: 비어있지 않음 + `:5432` (6543 transaction pooler 는 즉시 STOP,
 *      DEV_RUNBOOK §9.2) — 위반 exit 2
 *   3. 마스킹 echo → 읽기전용 SELECT (30s timeout, 미도달 exit 3 — clean 위장 없음)
 *   4. drift 출력: pending[]/unknown[] 이름 전체(operator 전용 — health 는 count 만)
 *      + unfinished/rolledBack. clean → exit 0, drift → exit 1.
 *
 * SELECT 만 — migrate 실행·resolve·쓰기 0 (ADR-002 §11.13 정합).
 * ⚠️ 현재 워크트리 기준 — origin/main HEAD 일치 확인(§9.10-1)과 함께 사용.
 */

import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

import {
  computeMigrationDrift,
  type AppliedMigrationRow,
} from "../../src/lib/health/migration-drift";

// tsx CJS 모드(package.json "type" 없음) — import.meta 대신 __filename.
const require_ = createRequire(__filename);
const { generateManifest } = require_("../generate-migration-manifest.cjs") as {
  generateManifest: (dir: string) => { migrations: string[]; generatedAt: string };
};

const webRoot = path.join(__dirname, "..", "..");

function loadUrl(): { key: string; file: string; url: string } | null {
  for (const file of [".env", ".env.local"]) {
    const p = path.join(webRoot, file);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const key of ["DIRECT_URL", "DATABASE_URL"]) {
      const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (m) {
        const v = m[1].trim().replace(/^"|"$/g, "");
        if (v) return { key, file, url: v };
      }
    }
  }
  return null;
}

async function main(): Promise<number> {
  const found = loadUrl();
  if (!found) {
    console.error("[migration-drift] STOP: .env/.env.local 에서 DIRECT_URL/DATABASE_URL 미발견");
    return 2;
  }
  const hostPort = (found.url.match(/@([^/@]+)\//) || [])[1] || "(파싱 실패)";
  if (!/:5432$/.test(hostPort)) {
    console.error(
      `[migration-drift] STOP: ${found.key}(${found.file}) 가 :5432 session pooler 아님 → ${hostPort} (§9.2)`,
    );
    return 2;
  }
  console.log(`[migration-drift] target: ***@${hostPort} (${found.key}, ${found.file})`);

  const manifest = generateManifest(path.join(webRoot, "prisma", "migrations"));
  console.log(`[migration-drift] manifest: ${manifest.migrations.length} migrations (워크트리 실시간)`);

  const prisma = new PrismaClient({
    datasources: { db: { url: found.url } },
  });
  let rows: AppliedMigrationRow[];
  try {
    rows = (await Promise.race([
      prisma.$queryRawUnsafe(
        `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT_30S")), 30_000),
      ),
    ])) as AppliedMigrationRow[];
  } catch (err) {
    // false-ok 차단 — 미도달은 clean 과 절대 혼동하지 않는다.
    console.error(
      `[migration-drift] STOP: DB 미도달/쿼리 실패 (drift 0 아님) — ${err instanceof Error ? err.message : String(err)}`,
    );
    return 3;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  const drift = computeMigrationDrift(manifest, rows);
  console.log(
    `[migration-drift] applied ${drift.appliedCount} · unfinished ${drift.unfinishedCount} · rolledBack ${drift.rolledBackCount}`,
  );
  if (drift.pending.length) console.log(`[migration-drift] pending (repo에 있고 미적용):\n  - ${drift.pending.join("\n  - ")}`);
  if (drift.unknown.length) console.log(`[migration-drift] unknown (적용됐고 repo에 없음):\n  - ${drift.unknown.join("\n  - ")}`);

  if (drift.clean) {
    console.log("[migration-drift] OK — drift 0. (§9.10-1 HEAD 일치 확인 병행했는지 재확인)");
    return 0;
  }
  console.error("[migration-drift] STOP — drift 존재. 해소 전 push/deploy 금지 (§9.10).");
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("[migration-drift] STOP: 예기치 못한 오류 —", err);
    process.exit(3);
  },
);
