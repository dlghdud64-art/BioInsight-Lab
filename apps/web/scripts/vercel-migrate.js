// apps/web/scripts/vercel-migrate.js
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
