// apps/web/scripts/vercel-migrate.js
//
// ──────────────────────────────────────────────────────────────────────
// 🚨 운영 룰 — 반드시 지킬 것 (2026-04 P2021 사고 재발방지)
// ──────────────────────────────────────────────────────────────────────
// Supabase 에서 `DROP SCHEMA public CASCADE` (또는 유사한 DB 전면 리셋) 를
// 실행했다면 반드시 Vercel "Redeploy" (권장: without build cache) 를 수행해서
// 이 스크립트를 재실행시켜야 한다.
//
// 이 스크립트는 빌드 타임에만 돌며, DB 를 리셋해도 이미 빌드된 서버리스
// 함수에는 자동으로 반영되지 않는다. Redeploy 를 누락하면 prod 에서
// P2021 (table missing) 으로 500 이 터진다.
//
// 증상 체크: /api/support/inquiry 가 P2021 → 503 "서비스 점검 중" 을 반환하면
// 이 룰을 어겼는지 먼저 의심할 것 (route.ts 의 스키마 드리프트 브랜치 참조).
// ──────────────────────────────────────────────────────────────────────
//
// Vercel 환경에서만 Prisma migrate deploy 를 실행한다.
// npm 의 표준 lifecycle hook 인 prebuild 로 등록되어 있으므로,
// Vercel 이 어떤 빌드 커맨드를 호출하든 (npm run build) 직전에 자동 실행된다.
//
// 로컬/CI 등 VERCEL 환경변수가 없는 환경에서는 no-op.
// → 로컬 pre-push hook 이 로컬 DB 에 migrate deploy 하려 실패하던 문제를 우회.
//
// Vercel 공식 시스템 환경변수: VERCEL=1 이 항상 세팅됨.
//   https://vercel.com/docs/environment-variables/system-environment-variables

"use strict";

const { execSync } = require("child_process");

const isVercel = process.env.VERCEL === "1";

if (!isVercel) {
  console.log(
    "[prebuild] VERCEL env not detected — skipping prisma migrate deploy"
  );
  process.exit(0);
}

// VERCEL_MIGRATE_SKIP=1: 마이그레이션 스텝을 건너뛴다.
// 사용 시나리오: DB 비밀번호 리셋 등 스키마 변경 없이 커넥션 스트링만 교체하는
// 긴급 배포 시 일시적으로 설정. 스키마 변경이 수반된 배포에선 절대 사용 금지.
if (process.env.VERCEL_MIGRATE_SKIP === "1") {
  console.log(
    "[prebuild] VERCEL_MIGRATE_SKIP=1 — skipping prisma migrate deploy (emergency bypass)"
  );
  process.exit(0);
}

console.log("[prebuild] VERCEL=1 detected — running prisma migrate deploy");

try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[prebuild] prisma migrate deploy completed successfully");
} catch (err) {
  console.error("[prebuild] prisma migrate deploy FAILED");
  console.error(err && err.message ? err.message : err);
  // migrate 실패 시 빌드를 중단시켜 테이블 없는 상태로 배포되는 사고를 막는다.
  process.exit(1);
}
