// apps/web/scripts/smoke/migration-drift.cjs
//
// §migration-order-drift-guard — operator 1명령 drift 검사.
//
//   node apps/web/scripts/smoke/migration-drift.cjs
//
// 무엇을 하나:
//   1. apps/web/.env 에서 DIRECT_URL(우선) / DATABASE_URL 로드
//   2. 선검증: 비어있지 않음 + session pooler `:5432` (transaction pooler
//      6543 은 advisory-lock 미지원 → hang/실패, DEV_RUNBOOK §9.2) — 위반 시 즉시 exit 2
//   3. 마스킹 echo (host:port 만) 후 `prisma migrate status` 를 90s timeout 으로 실행
//   4. Prisma 의 종료코드 전달 — 0 = 현재 트리 기준 drift 0, 비0 = pending /
//      DB 미도달 / failed migration → STOP
//
// drift 계산을 재구현하지 않는다 — `migrate status` 가 pending("have not yet
// been applied")과 로컬 부재("are not found locally")를 네이티브로 보고한다
// (단일 소스, 이중 유지보수 0).
//
// ⚠️ 이 검사는 "현재 워크트리" 기준이다 — 0801 사고(부분 시야 deploy)의
//    교훈: 워크트리가 origin/main HEAD 와 다르면 status 가 통과해도
//    main 기준 drift 가 존재할 수 있다. 반드시 DEV_RUNBOOK §9.10 의
//    HEAD 일치 확인과 함께 사용할 것. (배포 후 자동 감시는 /api/health
//    의 migrations 필드 — manifest 기반, 트리 상태와 무관.)
//
// SELECT/status 조회만 — migrate 실행·resolve·쓰기 0 (ADR-002 §11.13 정합).

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const webRoot = path.join(__dirname, "..", "..");

function loadUrl() {
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

const found = loadUrl();
if (!found) {
  console.error("[migration-drift] STOP: .env/.env.local 에서 DIRECT_URL/DATABASE_URL 을 찾지 못함");
  process.exit(2);
}

const hostPort = (found.url.match(/@([^/@]+)\//) || [])[1] || "(파싱 실패)";
if (!/:5432$/.test(hostPort)) {
  console.error(
    `[migration-drift] STOP: ${found.key}(${found.file}) 가 :5432 session pooler 가 아님 → ${hostPort}\n` +
      "  transaction pooler(6543) 는 advisory-lock 미지원 (DEV_RUNBOOK §9.2). DIRECT_URL(:5432) 로 실행할 것.",
  );
  process.exit(2);
}

console.log(`[migration-drift] target: ***@${hostPort} (${found.key}, ${found.file})`);
console.log("[migration-drift] prisma migrate status (timeout 90s, 읽기전용) ...");

const res = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "status"],
  {
    cwd: webRoot,
    env: { ...process.env, DATABASE_URL: found.url },
    encoding: "utf8",
    timeout: 90_000,
    shell: false,
  },
);

if (res.error && res.error.code === "ETIMEDOUT") {
  console.error("[migration-drift] STOP: migrate status 90s timeout — DB 미도달로 간주 (drift 0 아님)");
  process.exit(3);
}
process.stdout.write(res.stdout || "");
process.stderr.write(res.stderr || "");

if (res.status === 0) {
  console.log("[migration-drift] OK — 현재 워크트리 기준 drift 0. (§9.10: HEAD 일치 확인을 함께 했는지 재확인)");
} else {
  console.error(`[migration-drift] STOP — migrate status exit ${res.status}: pending/로컬 부재/failed migration. 해소 전 push 금지.`);
}
process.exit(res.status ?? 3);
