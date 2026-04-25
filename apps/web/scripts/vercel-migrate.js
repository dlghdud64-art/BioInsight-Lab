// apps/web/scripts/vercel-migrate.js
//
// ──────────────────────────────────────────────────────────────────────
// γ-shell decision (ADR-002 §11.13, 2026-04-25)
// ──────────────────────────────────────────────────────────────────────
// Vercel build-time `prisma migrate deploy` is permanently retired.
//
// Why:
//   §11.9–§11.12 chain showed that Supabase pooler (both :5432 session
//   and :6543 transaction) is unreachable from Vercel build infra in
//   our deployment, even though the same DATABASE_URL works fine from
//   app runtime. The 90s execSync timeout (§11.11) safely caps the
//   hang, but the migrate step never actually applies anything to the
//   production DB — leaving a false sense of "migrations are auto-
//   applied on deploy" while in reality they are not.
//
//   Operator-shell migrate is more honest, more testable, and matches
//   the existing pilot-seed / smoke-write pattern that already lives
//   in apps/web/scripts/ and works against operator credentials.
//
// What this script now does:
//   Nothing. It only logs that it is intentionally a no-op so that
//   anyone reading Vercel build logs can find this comment and the
//   ADR entry. It exits 0 immediately. There is no DB connection,
//   no spawn, no execSync.
//
// How to run a migration now:
//   From operator shell, with apps/web/.env loaded:
//     pnpm -C apps/web prisma:migrate
//   Or:
//     cd apps/web && npx prisma migrate deploy
//
//   Procedure: code change committed first → operator runs migrate →
//   verify against /api/health or a smoke probe → push the commit so
//   Vercel rebuilds against the already-migrated schema.
//
//   Detailed steps + safety guards in docs/DEV_RUNBOOK.md §9.
//
// Why keep the script (instead of removing prebuild entirely):
//   The build log line is a discoverability anchor — anyone who
//   inherits this codebase and wonders "did Vercel just migrate my
//   DB?" lands on the no-op log and the ADR ref, not a deafening
//   silence. Cheap insurance against a future operator re-introducing
//   build-time migrate without reading the history.
// ──────────────────────────────────────────────────────────────────────

"use strict";

if (process.env.VERCEL === "1") {
  console.log(
    "[prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002 §11.13)."
  );
  console.log(
    "[prebuild] prisma migrate deploy is operator-shell only — see DEV_RUNBOOK §9."
  );
} else {
  console.log(
    "[prebuild] VERCEL env not detected — local/CI no-op."
  );
}

process.exit(0);
