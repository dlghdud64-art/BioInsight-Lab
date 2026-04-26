# ADR-002: Pilot Tenant Seed for #P01 Internal Pilot Operation

- Status: **ACCEPTED** — Phase 1~4 code landed, Phase 5 validated on smoke DB (§11.1 deviation), Phase 6 canonical record (this doc).
- Date opened: 2026-04-23
- Owner: 호영 (총괄관리자)
- Operator: Claude (labaxis-delivery-planner + labaxis-bug-hunter governance)
- Related: ADR-001 (isolated WRITE DB), this session's #26 S07/S08/S01-S03 closeouts, `docs/decisions/ADR-001-provisioning-checklist.md`

---

## 1. Context

A live read-only probe of the `/search`, `/dashboard/*`, and public route tree on `bio-insight-lab-web.vercel.app` with an ADMIN session confirmed four pilot blockers:

- **B0-1** `/api/products/search` returns zero results for every query (including the single character `a`). The product catalog is empty.
- **B0-2** The ADMIN user (호영, `dlghdud64@gmail.com`) has zero OrganizationMember / WorkspaceMember rows. `/api/organizations/mine` returns `{organization:null}`, `/api/workspaces/mine` returns 403.
- **B0-3** `/api/cart` returns 500 `INTERNAL_ERROR`. Tracked separately as `#P03`; out of ADR-002 scope.
- **B1-1** `/dashboard/inventory` and `/dashboard/purchases` render realistic-looking items (Gibco FBS, PCR 튜브, etc.) while every DB-backed endpoint is empty — hard-coded UI mock on top of a silent empty canonical truth. Tracked as `#P02`; must be addressed after the seed lands so pilot users do not see mock data layered over real seed.

Host context: production is in pre-launch / demo state, running an internal pilot with 호영 + team as users. The Supabase project is `xhidynwpkqeaojuudhsw` (aws-1-ap-northeast-1, Tokyo region). Real external users are not onboarded yet, so seeding the production DB with a clearly-scoped pilot tenant is acceptable behind a paranoid opt-in.

The goal of ADR-002 is to unblock B0-1 and B0-2 with a minimal, idempotent, revertible seed — without modifying canonical user data and without polluting future real-production state.

---

## 2. Non-goals

- `/api/cart` 500 (`#P03`) — separate bug-hunter track.
- Removal of hard-coded mock on `/dashboard/inventory` and `/dashboard/purchases` (`#P02`) — must run after the seed so real data visibly replaces the mock.
- Legacy dormant surface cleanup (`/compare`, `/quotes`, `/inventory` top-level) (`#P06`).
- Real-launch product catalog seed — pilot cleanup must run first, then real seed in its own track.
- Subscription / plan enforcement verification — out of scope, unblocked later with a different tenant.
- CSRF rollout advancement, Sentry sunset triggers, and other post-launch monitoring tracks.
- Mobile app seeding.

---

## 3. Decision drivers

| # | Driver | Rationale |
|---|---|---|
| D1 | Canonical truth protection | Pilot rows must be scoped to sentinel identifiers; cleanup must remove every row without reaching canonical user data. |
| D2 | Owner seamless entry | 호영 already has a Google-OAuth'd User row; pilot seed must attach membership to that existing cuid instead of creating a throwaway user. |
| D3 | Real-launch handoff | Pilot cleanup removes every pilot row on demand so real product / real org data can replace it without drift. |
| D4 | ADR-001 infra reuse | Guard / sentinel patterns translate directly; the difference is target (production vs smoke) and inversion of project-ref allow logic. |
| D5 | Pilot UX consistency | Seed catalog must cover common internal pilot queries (Ethanol, PBS, DMEM, FBS, antibody, cell-culture consumables, HPLC column). |

---

## 4. Options considered

| Option | Summary | Outcome |
|---|---|---|
| A. Localhost Postgres tenant | Seed pilot into a local DB and run the pilot there. | Rejected — pilot must live at the production URL so 호영's existing OAuth session works. |
| B. Dedicated Supabase pilot project | Spin up a third Supabase project. | Rejected — Supabase free-plan 2-project limit already consumed by production + smoke (ADR-001 §11.1). |
| C. Production-DB pilot tenant behind an opt-in | Seed pilot rows into production DB with sentinel identifiers; guard requires an explicit opt-in token. | **ACCEPTED** — matches host context (pilot = internal users = production surface) and reuses ADR-001 sentinel discipline with inverted project-ref semantics. |

---

## 5. Operating constraints (invariants enforced by code)

1. **Opt-in token required.** `PILOT_REQUIRES_EXPLICIT_OPT_IN` must equal `"YES-SEED-PRODUCTION-PILOT-2026"` verbatim. Case, whitespace, every character matches. Rotating this token requires a Changelog entry.
2. **Env namespace isolation.** Pilot uses `DATABASE_URL_PILOT` and `ALLOWED_PILOT_DB_SENTINELS`. ADR-001 smoke uses `DATABASE_URL_SMOKE` and `ALLOWED_SMOKE_DB_SENTINELS`. Pilot guard and smoke guard live in different directories and do not import each other. Mixing env names is impossible by construction.
3. **Inverted allow-list semantics.** Pilot guard *requires* the production project-ref to be in the allow list; smoke guard refuses to run if the production project-ref appears. Each guard's test matrix locks the direction.
4. **Canonical user protection.** `pilot-seed.ts` only calls `tx.user.findUnique`; no create / update / upsert / delete of the user row. `pilot-cleanup.ts` has no `user` surface in its Prisma type — any regression that tries to add one fails typecheck. The `PILOT_OWNER_PROTECTION` string is printed at every cleanup run so the guarantee is visible in operator output.
5. **Exact-key deletes only.** Membership rows are keyed on the compound `@@unique` (`userId_organizationId`, `workspaceId_userId`). Everything else is keyed on the primary `id`. No `deleteMany`, no `LIKE`, no filter-based delete — enforced by the `PilotCleanupOperation` discriminated union in `pilot.ts`.
6. **Dry-run default for cleanup.** `pilot-cleanup.ts` exits without mutating unless `--apply` is passed. Probes run unconditionally so the operator can review presence before committing to delete.
7. **Checked-in `.env` untouched.** All env values live in shell exports or gitignored ephemeral files. The committed `.env` continues to point at production for web app startup, never at pilot-override values.

---

## 6. Architecture

```
apps/web/scripts/pilot/
  pilot.ts              pure identifiers + buildPilotCleanupPlan(ownerUserId?)
  guard.ts              checkPilotDatabaseTarget(env) / assertPilotDatabaseTarget()
  pilot-seed.ts         prisma.$transaction upsert chain; guard-gated entry
  pilot-cleanup.ts      probe-then-delete loop; dry-run default; guard-gated
  smoke-user-bootstrap.ts   (untracked, §11.3) one-off helper for smoke-DB deviation

apps/web/src/__tests__/scripts/
  pilot-guard.test.ts       13 cases — opt-in / allow-list / URL / fail-closed
  pilot-cleanup.test.ts     19 cases — plan shape / scoping / dry-run / apply partial
```

Seed flow: guard → dynamic `PrismaClient` bound to `DATABASE_URL_PILOT` → `$transaction(async tx => { findUnique user → upsert org → upsert workspace → upsert orgMember → upsert wsMember → 15× upsert product })` with a 30 s transaction timeout.

Cleanup flow: guard → dynamic PrismaClient → `buildPilotCleanupPlan(ownerUserIdOverride)` → for each op run `findUnique`; if present and mode is `apply`, call `delete` with the same exact key. Never calls `deleteMany`. Order: `workspaceMember → organizationMember → workspace → organization → 15× product`.

---

## 7. Acceptance criteria (ADR-002 is CLOSED only when all six pass)

1. Four pilot scripts + two tests land on `origin/main`.  ✅ (172297a2 · 5027e3c9 · 315c1445 · 75588fd8 · d2194359)
2. All pilot unit tests PASS (32 / 32). Typecheck on the pilot tree is clean.  ✅
3. Guard rejects every failure mode covered by `pilot-guard.test.ts`.  ✅ (13 / 13)
4. Cleanup never enumerates a `user` surface (typecheck + runtime assertion).  ✅
5. Runtime seed succeeds against at least one DB (production or smoke), producing the documented summary output.  ✅ (smoke DB, §11.1 deviation)
6. Runtime cleanup dry-run reports every row as `present=true` after seed.  ✅ (19 / 19)

---

## 8. Rollout path

```
Phase 1  pilot.ts                     commit 172297a2  CLOSED
Phase 2  guard.ts + guard test        commit 5027e3c9  CLOSED
Phase 3  pilot-seed.ts                commit 315c1445  CLOSED
Phase 4  pilot-cleanup.ts + test      commit 75588fd8  CLOSED
Phase 5  operator runtime (smoke)     commit d2194359  CLOSED — §11.1 deviation
Phase 6  this ADR-002 document        (current commit) CLOSED
```

After Phase 6, pilot can run against production any time the operator has the production `DATABASE_URL_PILOT` and the opt-in token. Without those two values, the guard aborts.

---

## 9. Rollback path

- `pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts --apply` with the same env vars — removes every pilot row in one pass (19 deletes, exact keys).
- Canonical user row is never touched, so rollback is reversible: re-seeding is idempotent.
- Git rollback: pilot tree is isolated under `apps/web/scripts/pilot/` + two test files. Reverting the five commits removes every pilot script without affecting app code.

---

## 10. LabAxis principle fit

| Principle | Fit |
|---|---|
| 연구 구매 운영 OS | ✓ enables pilot operation |
| same-canvas (workbench / queue / rail / dock) | N/A (infra) |
| canonical truth 보호 | ✓ sentinel + owner protection + exact-key deletes |
| preview / snapshot / projection 보호 | ✓ `update: {}` on every upsert avoids overwriting live fields |
| dead button / no-op / fake success 금지 | ✓ seed supplies real rows that `#P02` uses to retire UI mocks |
| page-per-feature / duplicate surface 금지 | N/A |
| ontology = workflow route deterministic next-step | N/A |

---

## 11. Deviations from the plan

### 11.1 Smoke-DB validation path for Phase 5

- **Plan:** run pilot-seed and pilot-cleanup dry-run against production (`xhidynwpkqeaojuudhsw`).
- **Actual:** production connection string was not available at Phase 5 time. Operator validated end-to-end flow against the smoke DB (`qbyzsrtxzlctjvbfcscs`) instead, setting `ALLOWED_PILOT_DB_SENTINELS=qbyzsrtxzlctjvbfcscs` for the run.
- **Constraint alignment:** smoke DB and production DB have different project-refs, so §5.2 env namespace isolation is intact. Pilot rows created in smoke live alongside ADR-001 sentinel rows (`org-smoke-isolated`, etc.) without id collision — §5.1 sentinel scoping is intact. Opt-in token was still required and matched.
- **Follow-up (originally open):** production run remains open. When the operator obtains the production connection string (Supabase console → `xhidynwpkqeaojuudhsw` → Settings → Database → Connection string), set `ALLOWED_PILOT_DB_SENTINELS=xhidynwpkqeaojuudhsw` and re-run Phase 5 — no `PILOT_OWNER_USER_ID_OVERRIDE` is required because the production cuid `cmo4mcbih00003ut3ozub29tc` is the committed default in `pilot.ts`.
- **Closed 2026-04-24 (post-commit a65069fd):** production seed PASS. Operator ran `pilot-seed.ts` against production (`xhidynwpkqeaojuudhsw`, aws-1-ap-northeast-1) with `ALLOWED_PILOT_DB_SENTINELS=xhidynwpkqeaojuudhsw` and no `PILOT_OWNER_USER_ID_OVERRIDE`. Results:
  - `org-pilot-internal` + `workspace-pilot-internal` upserted.
  - 2 membership rows (OrganizationMember + WorkspaceMember, both ADMIN, owner `cmo4mcbih00003ut3ozub29tc`).
  - 15 products upserted (REAGENT × 8, TOOL × 5, EQUIPMENT × 1, RAW_MATERIAL × 0 — per committed catalog).
  - `pilot-cleanup.ts` dry-run: 19/19 rows present=true.
- Operational note surfaced during the run: Supabase transaction pooler (`:6543`) is incompatible with Prisma `$transaction`. Recorded separately as §11.7.

### 11.2 `PILOT_OWNER_USER_ID_OVERRIDE` added at Phase 5 commit d2194359

- **Why:** the smoke DB already has a `dlghdud64@gmail.com` User row, but under a different cuid (`cmo9qsod80000riylvq0tdj42`) than production (`cmo4mcbih00003ut3ozub29tc`). The pilot guard rejects a user-not-found error when the hard-coded cuid is used against smoke.
- **What changed:**
  - `pilot.ts` — `buildPilotCleanupPlan(ownerUserId?: string)` takes an optional parameter defaulting to `PILOT_OWNER_USER_ID`.
  - `pilot-seed.ts` — `resolvedOwnerId = process.env.PILOT_OWNER_USER_ID_OVERRIDE ?? PILOT_OWNER_USER_ID` is used for the two membership upserts.
  - `pilot-cleanup.ts` — reads `PILOT_OWNER_USER_ID_OVERRIDE` and forwards to `runCleanup` as the third argument.
- **Constraint alignment:** the override is applied only to membership rows (the exact row that changes identity per DB). Organization / Workspace / Product identifiers remain hard-coded. Canonical user protection is preserved — the seed still never creates a user row; only the probe key changes.
- **Follow-up:** production runs should NOT set `PILOT_OWNER_USER_ID_OVERRIDE`. The committed default targets the production cuid directly.

### 11.3 Untracked helper `smoke-user-bootstrap.ts`

- Present in `apps/web/scripts/pilot/smoke-user-bootstrap.ts` in the operator's working tree, intentionally not committed (docstring `"intentionally NOT committed to main"`).
- Purpose: upsert `dlghdud64@gmail.com` into smoke DB so the pilot guard can probe the user.
- Lifecycle: delete after each smoke-DB deviation run, or move into ADR-001 sentinel track if the bootstrap step becomes recurring.

### 11.4 Pilot rows coexist with ADR-001 sentinel in smoke DB

- Smoke DB now has both `org-smoke-isolated` (ADR-001 sentinel) and `org-pilot-internal` (ADR-002 pilot). Namespaces do not collide; each track's cleanup touches only its own identifiers.
- Current smoke DB state after Phase 5: 19 pilot rows remain because only dry-run ran. Removing them requires `pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts --apply` with the same smoke-DB env values.
- Recommendation: if pilot rows are no longer needed for smoke validation, apply cleanup before the next `#26 S01/S02/S03` run so write-chain smoke operates on a clean sentinel-only state.

### 11.5 Local sandbox copy truncation (operator incident, not a deployed defect)

- During Phase 6 preparation the operator's sandbox working tree showed truncated copies of `pilot.ts`, `pilot-cleanup.ts`, and `pilot-seed.ts` (missing the closing `isDirectRun` block and final `}` / closing parens). `git show HEAD` returned the correct files, so the truncation was confined to the local file system.
- Mitigation: `git checkout HEAD -- <files>` restored the correct contents. `origin/main` and the deployed code were never affected. This deviation is recorded for traceability; it did not change committed state.

### 11.6 Production project-ref typo drift — corrected 2026-04-24

- **Discovery:** when the operator pasted the production connection string to unblock the pilot-seed run, the URL resolved to `postgres.xhidynwpkqeaojuudhsw@aws-1-ap-northeast-1.pooler.supabase.com` (Tokyo). This mismatched the `xhidynwpkqeaqjuudhsw` ref that had been committed in 6 doc/test locations since ADR-001 Phase 1.
- **Ground truth:** real ops env files (`apps/web/CURRENT_STATUS.md`, `CONNECTION_ISSUE_SUMMARY.md`, `NETWORK_DIAGNOSIS.md`, `IPV6_ISSUE_SOLUTION.md`) have always carried the correct `o` variant. The drift was confined to governance docs and pilot-script comments/constants.
- **Scope of correction (10 sites / 6 files):**
  - `docs/decisions/ADR-002-pilot-tenant-seed.md` — §Context, §11.1 × 2
  - `docs/decisions/ADR-001-provisioning-checklist.md` — §4 table, §4.1 env export, §6 constraint alignment
  - `apps/web/src/__tests__/scripts/pilot-guard.test.ts` — `PROD_REF` constant
  - `apps/web/scripts/pilot/pilot.ts` — governance comment §3
  - `apps/web/scripts/pilot/pilot-seed.ts` — Usage example
  - `apps/web/scripts/pilot/guard.ts` — env contract comment
- **Runtime impact:** none. The guard parses the ref out of `DATABASE_URL_PILOT` at runtime and matches against `ALLOWED_PILOT_DB_SENTINELS`, both of which are operator-supplied env. No code path ever read the typo'd ref from these files.
- **Also recorded:** ADR-001 §4 now carries `PRODUCTION_PROJECT_REGION = ap-northeast-1`, which was previously implicit.
- **Constraint alignment:** §5.1 (production ref ≠ test ref) still holds (`xhidynwpkqeaojuudhsw` ≠ `qbyzsrtxzlctjvbfcscs`). §5.2 env namespace isolation unaffected. Opt-in token unchanged.
- **Follow-up:** §11.1 "production run open" will be closed in a separate deviation entry when the seed actually runs against production with the corrected env. — **Closed 2026-04-24** per the §11.1 closeout block above.

### 11.7 Transaction vs Session pooler port constraint for Prisma `$transaction`

Opened 2026-04-24 after the production seed run.

- **Symptom:** when `DATABASE_URL_PILOT` targeted Supabase transaction pooler (port `:6543`), `pilot-seed.ts` hung and eventually failed. Switching the same URL to session pooler (port `:5432`) made the seed complete in seconds.
- **Root cause:** Supabase Supavisor transaction mode pools connections at the statement level — multiple statements from a single logical transaction can be dispatched to different backend connections, which breaks the session-scoped locks Prisma `$transaction([...])` requires. Prisma needs a sticky connection for the duration of the transaction; only session mode (port `:5432`) guarantees this.
- **Why smoke (§11.1) did not surface this:** the smoke DB connection string operator used was already `:5432` session pooler, so the constraint was satisfied invisibly.
- **Operational rule (going forward):**
  - `DATABASE_URL_PILOT` **must** use port `:5432` (session pooler) because `pilot-seed.ts` wraps all writes in `prisma.$transaction`.
  - `pilot-cleanup.ts` does sequential `findUnique` + `delete` without `$transaction`, so it would technically survive transaction pooler — but we pin the same URL/port for both to avoid the next operator mis-routing either script. Port `:5432` for both.
  - App runtime (stateless API routes in `apps/web/src`) continues to target transaction pooler (`:6543`) — no change, that path does not use `$transaction` across statements the way maintenance scripts do.
- **Enforcement surfaces added by this deviation:**
  - `apps/web/scripts/pilot/pilot-seed.ts` — `NOTE` in the Usage docblock.
  - `apps/web/scripts/pilot/pilot-cleanup.ts` — cross-ref `NOTE` in the Usage docblock.
  - `docs/DEV_RUNBOOK.md §8` — `DATABASE_URL_PILOT` row now warns about the port.
- **Not enforced in code (deliberate):** the guard (`assertPilotDatabaseTarget`) parses project-ref only; it does not inspect the port. Adding a port check would couple the guard to Supabase's current Supavisor port conventions (subject to change) and block the smoke DB path where the port varies. The documentation surface above is the authoritative control.
- **Constraint alignment:** no change to §5 constraints. Opt-in token, allow-list, guard semantics all identical.

### 11.8 `#P02` Phase A mock removal — runtime-verified 2026-04-25

Scope: `apps/web/src/app/dashboard/inventory/inventory-content.tsx` mock fallback removal (commit `5f282a07`). Verified against production deployment of `bio-insight-lab-web.vercel.app` using Claude in Chrome.

- **Source-level PASS (pre-verification):** `npx tsc --noEmit` zero errors on the modified file; vitest inventory-adjacent suite (review-queue + work-queue, 6 files) 150/150 PASS.
- **Runtime probe (2026-04-25 via `/dashboard/inventory`):**
  - Mock products (Gibco FBS / Falcon / DMEM / Trypsin-EDTA / Pipette tips) **no longer rendered** anywhere in the page ✓
  - Empty state copy renders the new string — "등록된 재고가 없습니다. 첫 재고를 추가해 운영을 시작하세요." ✓
  - Empty state CTA button ("재고 추가하기") renders in both responsive variants (mobile `md:hidden` + desktop table-cell) ✓
  - Desktop CTA click opens the real `<AddInventoryModal>` dialog ("새 재고 등록", product search textbox, close button) ✓
  - Header "품목 추가" CTA opens the same dialog (comparison control) ✓
- **Probe artifact — recorded as an operating lesson, not a defect:** an initial reading labelled the empty state CTA as a dead button. Root cause: Chrome MCP `find` tool returned the `md:hidden` mobile variant of the button as well as the desktop variant; the first click target landed on the desktop-hidden element (rect 0×0 — `display:none` via Tailwind responsive class), producing a no-op. Direct DOM inspection via `javascript_tool` showed both button instances, with the desktop-visible one (116×36 @ (688, 647)) wired correctly to `setIsDialogOpen(true)`. Not a code defect; a probe methodology gap.
- **Operational rule for future Chrome probes (LabAxis):** before interpreting a click as a dead button, verify the target element's `getBoundingClientRect()` and `display` via `javascript_tool`; `find` can surface elements with zero rect when they are hidden by responsive utility classes. Committed as habit only, not as a doc file.
- **Follow-up tracks opened (independent, not blocking §11.8 closeout):**
  - `#P02-button-type` (LOW): shadcn Button rendered with `type="submit"` across the inventory surface. Currently inert because none of the buttons sit inside a `<form>`, but a latent foot-gun if any of these surfaces get wrapped in a form later. Remediation: either fix shadcn Button default or pass `type="button"` at call sites.
  - `#P01-followup`: Operator commits `ceda4063` .. `2c225f91` landed Vercel build server workarounds (session pooler unreachable → transaction pooler `:6543` for build-time, `SKIP_PRISMA_MIGRATE` env, non-fatal migrate). This partially revises §11.7 — session-pooler rule applies to operator-shell maintenance scripts only, not to Vercel build-time. Recorded in §11.9.

### 11.9 Vercel build server reachability — §11.7 scope clarification

Opened and CLOSED 2026-04-25. Triggered by the post-DB-password-reset redeploy sequence (commits `ceda4063` through `2c225f91` on 2026-04-25).

- **Symptom:** after rotating the Supabase DB password and updating `DATABASE_URL` in Vercel environment variables, the Vercel build step failed at `prisma migrate deploy` with `P1000 Authentication failed`. The password itself was correct (the same credentials worked from the operator's local shell moments earlier). Changing the connection string port from `:5432` (session pooler, which §11.7 had mandated) to `:6543` (transaction pooler) resolved the auth timeout.
- **Root cause:** Supabase session pooler (`aws-1-ap-northeast-1.pooler.supabase.com:5432`) is **not reachable from Vercel build infrastructure** (us-east-1 / Washington D.C. build machines in our deployments). The transaction pooler (`:6543`) is reachable and accepts the same credentials. §11.7 assumed the session pooler was the canonical path, which held for operator-shell maintenance scripts but not for Vercel build-time execution.
- **§11.7 scope clarification (authoritative):**
  - **Operator-shell maintenance scripts** (`pilot-seed.ts`, `pilot-cleanup.ts`, any future `tsx scripts/...` that uses `prisma.$transaction`) → **session pooler `:5432` required**. Unchanged from §11.7.
  - **Vercel build-time** (`prisma migrate deploy` via `apps/web/scripts/vercel-migrate.js`) → **transaction pooler `:6543` required**. New constraint.
  - **App runtime** (Next.js serverless functions under `apps/web/src/app/api/**`) → **transaction pooler `:6543`**. Unchanged.
  - Net effect: session pooler (`:5432`) is used in exactly one place — the operator's local shell during pilot seed/cleanup — and transaction pooler (`:6543`) everywhere else.
- **Why Prisma `migrate deploy` survives transaction pooler:** `prisma migrate deploy` applies each migration file's statements in its own implicit transaction at the Postgres level rather than via the Prisma client `$transaction([...])` batching. Supavisor transaction mode tolerates statement-level transactions (it only breaks multi-statement client-level `$transaction`). The pilot seed path, which bundles multiple Prisma calls into a single `$transaction`, is the case that requires session pooling.
- **`SKIP_PRISMA_MIGRATE` emergency bypass (apps/web/scripts/vercel-migrate.js):** added in commit `c99dd785`, renamed from `VERCEL_MIGRATE_SKIP` in `e7a01c18` (to avoid Vercel's reserved `VERCEL_` env namespace). Semantics:
  - `SKIP_PRISMA_MIGRATE=1` at build time → migrate step exits 0 immediately without running. Intended for password-reset-only deploys where no schema change is pending.
  - Absent / any other value → normal migrate path.
  - Must be unset (or removed from Vercel env vars) before any schema-change deploy.
- **Non-fatal migrate (commit `16e6ef5d`):** `vercel-migrate.js` now wraps `npx prisma migrate deploy` in try/catch. On failure it logs a WARNING and exits 0 rather than failing the build. The inline comment explicitly flags this as a 2026-04-24 emergency mitigation for the password-reset incident and marks it for restoration (`process.exit(1)`) once DB connectivity is stable. **This is a temporary safety valve** — leaving it in place long-term defeats the prebuild migration guarantee.
- **Empty-commit redeploy pattern (observed):** five of the eight remediation commits (`ceda4063`, `d423ef24`, `2959efa0`, `026d21a4`, `2c225f91`) are `git commit --allow-empty` used solely to trigger Vercel redeploys while iterating on env var changes. This is fine as an operational pattern but creates noisy git history. A follow-up cleanup could squash them if git history curation is pursued.
- **Vercel project identity (corrected 2026-04-25, see §11.10 closeout):** `.vercel/project.json` records `projectId: prj_9myxP5rmQ6QupPjp7vi6dtBF1qug` (project name `web`), **but the production domain `bio-insight-lab-web.vercel.app` is actually owned by a different Vercel project — `prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim` (project name `bio-insight-lab-web`)**. Confirmed via Vercel MCP `list_projects` + `list_deployments` during §11.10 probe. The earlier reading in this paragraph (that `prj_sJ6yIg...` was an env-var grouping id) was wrong — that string is a real production project root. `.vercel/project.json` is therefore stale and points at an unused/legacy project. Drift parked as `#P01-followup-correction`: either resync `.vercel/project.json` to the live project, or delete the legacy `web` project entirely. No runtime impact while the drift exists because Vercel deployments are triggered by GitHub push regardless of `.vercel/project.json`.
- **Restoration checklist (when DB connectivity is fully confirmed stable):**
  1. Unset `SKIP_PRISMA_MIGRATE` in Vercel production env vars.
  2. Restore `process.exit(1)` in the catch block of `vercel-migrate.js` (remove the 2026-04-24 emergency override).
  3. Run a canary schema-changing migration to verify the normal path.
- **Not landed (deliberate):** `.env.example` / `DEV_RUNBOOK` were left with port conventions consolidated in DEV_RUNBOOK.md §8–§9; no second source of truth introduced.

### 11.10 `#P02` Phase B-β runtime-verified 2026-04-25 + Vercel deploy queue incident

Scope: `apps/web/src/app/dashboard/purchases/page.tsx` rewrite (commit `b214386a`). Verified against production deployment of `bio-insight-lab-web.vercel.app` using Claude in Chrome.

- **Source-level PASS (pre-verification):** `npx tsc --noEmit` zero errors on the rewritten file; vitest smoke (pilot-guard + pilot-cleanup + smoke-guard, 43 tests) 43/43 PASS — no regression in adjacent test surfaces.
- **Vercel deploy incident (resolved):** `b214386a` push triggered a build that sat in QUEUED state for ~50 minutes because the prior `2259b9c1` (#P01-followup) build was BUILDING for over an hour, blocking the queue. `2259b9c1` is a docs-only commit but `vercel-migrate.js` still ran `prisma migrate deploy` synchronously, and the connection string at that point was the session-pooler URL that Vercel build infra cannot reach (§11.9). Without the `execSync` `timeout` option, the migrate step held the build until OS-level kill. Operator killed the queued/blocked builds via Vercel UI and re-enabled the deploy by setting `SKIP_PRISMA_MIGRATE=1` in production env vars. `b214386a` then completed in ~1 minute. **This is direct field validation of §11.9's restoration-checklist warning** — the `execSync` timeout is now a known gap, not theoretical.
- **Runtime probe (2026-04-25 via `/dashboard/purchases`):**
  - Old mock signatures (`일괄 발주 전환`, `PCR 튜브`, `GibcoKR`, `Thermo Fisher`, `AI 추천 완료`, `회신 3/3`, `외부 승인`, `막힘 확인`, `발주 Readiness`, `Western Blot Transfer`, etc.) — **0 found** ✓
  - New β signatures (`내 견적 보관함을 상태별로`, `검토 대기 / 확정됨 / 구매 완료 / 거부됨`, `보유한 견적이 없습니다`, `장바구니에서 견적을 만들어 시작하세요.`, `장바구니 열기`) — **all rendered** ✓
  - `/api/quotes/my` HTTP 200 with `{success: true, data: {quotes: [], stats: {total/PENDING/COMPLETED/REJECTED/PURCHASED/expired = 0}}}` — pilot tenant has zero quotes, exactly the expected canonical state ✓
  - KPI cards (4): all rendering `0건`, all wired to `setStatusFilter` toggle ✓
  - Tabs (5): `전체 / 검토 대기 / 확정됨 / 구매 완료 / 거부됨`, all counts `0` ✓
  - Empty state UI: heading + sub-message + single CTA "장바구니 열기" ✓
- **Dead-button audit (3 CTAs, all PASS):**
  - Header "장바구니" → `<a href="/dashboard/cart">` 106×40 visible ✓
  - Header "견적 보관함" → `<a href="/dashboard/quotes">` 128×40 visible ✓
  - Empty-state "장바구니 열기" → `<a href="/dashboard/cart">` 136×36 visible ✓
  - All buttons resolve to real Next.js Link navigation. No `md:hidden` artifact this time (the §11.8 probe lesson worked: rect-checked before interpretation).
- **Vercel project identity correction (companion to §11.9):** Vercel MCP `list_projects` confirmed two projects exist on the team — `web` (`prj_9myxP5rmQ6QupPjp7vi6dtBF1qug`, the one in `.vercel/project.json`) and `bio-insight-lab-web` (`prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim`, the actual production-domain owner). My §11.9 reading that `prj_sJ6yIg...` was an env-var grouping id is now corrected in §11.9 itself; the drift between `.vercel/project.json` and the live project is real and parked as `#P01-followup-correction`. **RESOLVED 2026-04-25** — operator-local `apps/web/.vercel/project.json` resync'd to `prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim` / `bio-insight-lab-web` / `createdAt: 1765128766508`. Build settings (`installCommand`, `buildCommand`, `outputDirectory`, `nodeVersion: 24.x`) verified identical to live project, left unchanged. **Important:** `.vercel/` is in `.gitignore`, so the project.json fix is **operator-local only** — not committed to git. Anyone else running `vercel link` will re-create the file; this ADR entry is the canonical record of which project to link. **Legacy `web` project (`prj_9myxP5rmQ6QupPjp7vi6dtBF1qug`) DELETED via Vercel UI 2026-04-25.** Verified via `mcp__vercel__list_projects` — only `bio-insight-lab-web` (`prj_sJ6yIg...`) remains as a LabAxis surface, eliminating any future mis-edit risk on a stale project.
- **API behaviour delta:** before this build, `/api/quotes/my` returned `500 INTERNAL_ERROR`. After `b214386a` deployed it returned `200 OK`. The 500 was in the stale deployment code path, not in the route's logic itself — verified that the new build serves correctly with the same DB and same auth path.
- **Follow-up tracks confirmed (still parked):**
  - `#P02 Phase B-α` — queue-composer endpoint + AI recommendation. Now has a clear hand-off point: Phase B-β rendered the canonical Quote inbox; α layer can compose multi-supplier reply state on top. **Plan written 2026-04-25**: `docs/plans/PLAN_phase-b-alpha-purchase-conversion.md`. Audit concluded ~80% of the old mock ontology is composable from existing models (`/api/work-queue`, `/api/ai-actions`, `Quote.replies/vendors/vendorRequests`, `ontology-next-action-resolver.ts`). Recommended path: Option α-1 (server-side composer endpoint). **LANDED + production-verified 2026-04-25** — see §11.15 closeout below.
  - `#P01-followup-correction` — `.vercel/project.json` drift. New track opened today.
  - `#P02-button-type` — shadcn Button default `type="submit"` (still LOW; not a Phase B blocker).
  - `vercel-migrate.js` `execSync` timeout option — **promoted from "nice to have" to "real incident lesson"** by today's queue block. Should land before the next migration-bearing schema change. **CLOSED in §11.11.**

### 11.11 `vercel-migrate.js` execSync timeout — landed 2026-04-25

Direct follow-up to §11.10's queue-block incident.

- **Root cause recap (§11.10):** `execSync("npx prisma migrate deploy", { stdio, env })` had no `timeout` option. When migrate hits an unreachable pooler the child process spins on TCP retries until the OS reaps it. The non-fatal try/catch wrapper around execSync only fires *after* the child returns — so the queue-block window equals "however long it takes the OS to give up on the connection," which observed up to ~1 hour on Vercel build infra.
- **Change (single-file commit):** add `timeout: 90_000` + `killSignal: "SIGKILL"` to the `execSync` options. Catch block now distinguishes timeout vs other failures and emits a §11.9 reachability hint when the failure is a timeout/SIGKILL.
- **Why 90 s:** healthy migrate runs against the transaction pooler complete in ~5–15 s. 90 s leaves ~6× headroom for cold-start + first-statement latency, while keeping any single hang at well under the GitHub-Vercel webhook re-trigger window. Easier to extend than to shrink later.
- **Restoration sequence (now 4 items, was 3):**
  1. ~~Unset `SKIP_PRISMA_MIGRATE`~~ — *still pending; do this first when DB connectivity is confirmed stable.*
  2. ~~Restore `process.exit(1)` in catch~~ — *still pending; the non-fatal escape hatch should be removed only after timeout proves itself in production.*
  3. Run a canary schema-change migration to verify the normal path.
  4. **DONE 2026-04-25:** `execSync` timeout + SIGKILL (this section).
- **Why land timeout before items 1–3:** even if `SKIP_PRISMA_MIGRATE` is unset and `process.exit(1)` is restored, an unbounded execSync hang would still eat the full Vercel build window and prevent rollback. The timeout is the prerequisite that makes the rest of the restoration safe.
- **Operational note:** the timeout fires whether the failure is "auth", "pooler unreachable", "schema validation", or "connection refused" — anything that prevents the child from exiting. After timeout the build still proceeds (non-fatal exit(0)) so the deploy still ships, but with a clear `[prebuild] prisma migrate deploy TIMED OUT` log line for postmortem.
- **Not landed (deliberate):** no per-migration test runner, no separate `prisma migrate status` precheck — both add complexity without removing the timeout requirement. The timeout is the single load-bearing fix.
- **Field validation 2026-04-25 (deploy `dpl_66GXg92pDNd3te5EsfZf3kCgQMk9`, commit `33172f3d`):** with `SKIP_PRISMA_MIGRATE` removed from production env vars, the prebuild step ran `prisma migrate deploy` against the canonical DATABASE_URL. The child timed out at exactly ~89 s with `[prebuild] prisma migrate deploy TIMED OUT after 90s — continuing build (non-fatal)` + the §11.9 reachability hint. Build immediately continued (`> next build` → `✓ Compiled successfully`), deployment reached READY in 5 m 14 s total (vs. the 1 h+ hang in §11.10). **Timeout fix verified end-to-end.** Next finding routed to §11.12.

### 11.12 Transaction pooler `:6543` is NOT reachable from Vercel build infra — §11.9 hypothesis falsified

Opened 2026-04-25 by the §11.11 field validation.

- **Symptom:** the §11.11 verification deploy hit `[prebuild] prisma migrate deploy TIMED OUT after 90s` even though the Datasource log line confirms the URL was on transaction pooler `:6543` (`Datasource "db": PostgreSQL ... at "aws-1-ap-northeast-1.pooler.supabase.com:6543"`). The same DB credentials work from the operator's local shell. The symptom is identical to §11.9's session-pooler unreachability — neither pooler responds inside the 90 s window from Vercel's iad1 build machines.
- **What §11.9 was wrong about:** §11.9 closed with the operating rule "Vercel build-time uses `:6543` (transaction pooler), which is reachable." The first half (port choice) is still correct because the session pooler is definitively blocked; the second half (reachability) is now refuted. Until §11.12 is closed, **neither pooler is known to be reachable from Vercel build infra**.
- **Hypotheses to investigate (none confirmed yet):**
  1. **DATABASE_URL credential drift in Vercel env** — the password component may not match the post-rotation value. Should be the first check; quickest to rule in/out by triggering a deploy with a deliberately wrong password and comparing logs.
  2. **Supabase egress / IP allow-list restriction** — Supabase pooler may be filtering by source IP or by region. Vercel build is in iad1; production runtime is in iad1 too but uses pgbouncer-style short-lived connections. Build machines may use a different egress pool.
  3. **IPv4/IPv6 routing mismatch** — Supabase pooler is IPv4 only on free plan; Node 22 on Vercel may resolve to IPv6 by default and time out.
  4. **Schema-level lock** — unlikely (migrate runs in its own connection), but worth ruling out by checking `pg_locks` after a deploy.
- **Diagnostic plan (recommended order):**
  1. Confirm Vercel `DATABASE_URL` value (host/port/credentials) against operator-shell-known-good string. Operator has direct UI access; this is a 30-second check.
  2. If credentials match: try the **direct (non-pooler) connection** URL `db.<ref>.supabase.co:5432` for one canary build. Direct connection is a different network path; success/failure narrows hypothesis 2 vs 3.
  3. If still unreachable: enable Supabase Network Restrictions log for an outbound trace; or try `pgcli`/`psql` from a one-off Vercel build script that prints `getent hosts` + first packet result.
- **Operational mitigation while §11.12 is open:** set `SKIP_PRISMA_MIGRATE=1` again. The §11.11 timeout safely handles the hang, but every deploy wastes ~90 s on a migrate that does not apply. Schema-change deploys remain blocked until §11.12 is closed (the prebuild migrate step does not actually modify the DB right now).
- **Net effect on §11.9 / §9.2:** the restoration checklist's items 1 (`SKIP_PRISMA_MIGRATE` unset) and 3 (canary schema migration) are **gated by §11.12** — they cannot be safely completed until DB connectivity is restored. Item 2 (`process.exit(1)` restoration) remains gated on items 1 + 3.
- **Not in scope for §11.12:** changing the migrate strategy (e.g., moving migrations out of prebuild and into a manual operator-shell step) is a structural redesign, not a diagnostic. Park as `#P01-followup-migrate-strategy` if §11.12 ends up unfixable from the connection-string side.
- **Field validation 2026-04-25 (β fix attempt with `DIRECT_URL` retargeted to `:6543` transaction pooler):** deploy `dpl_FoFtRWTnCRzrRZGagE2KDJ4DZwmC` ran prisma migrate deploy against DATABASE_URL=`...:6543` + DIRECT_URL=`...:6543` (both transaction pooler). Result: `[prebuild] prisma migrate deploy TIMED OUT after 90s` — same outcome as `:5432`. **Both pooler ports are unreachable from Vercel build infra.** §11.9's "transaction pooler is reachable" rule is now fully refuted, not just narrowed. App runtime continues to use the same DATABASE_URL successfully (verified via `/api/quotes/my` 200 OK), so the issue is specifically the **build container's outbound egress**, not the credentials or the host. Hypotheses 1 (credential drift) and 2/3 (network) cannot be discriminated further from the build side alone — diagnosis would require Supabase / Vercel support tickets to inspect egress IP allow-listing or logging the actual TCP failure mode. This pushed §11.12 over the threshold from "diagnostic" to "structural redesign needed", routed to §11.13.

### 11.13 γ-shell — Vercel build-time `prisma migrate deploy` retired permanently

Opened and CLOSED 2026-04-25. The structural follow-up §11.12 anticipated.

- **Decision:** Vercel build-time `prisma migrate deploy` is **permanently retired**. All schema migrations are now operator-shell only. The `vercel-migrate.js` prebuild hook is reduced to a no-op log line; `directUrl` removed from `schema.prisma`; `DIRECT_URL` env vars no longer needed.
- **Why now:** §11.9 → §11.10 → §11.11 → §11.12 already documented that build-infra reachability of the Supabase pooler is unreliable in our deployment. The β fix (`:6543` for both URLs) failed identically to the earlier `:5432` run. Continuing to chase reachability inside the build window costs operator time on every deploy and produces a false positive — the build log says "TIMED OUT, continuing build" but the actual production schema is whatever it was before the rotation event in §11.9. We have been running for the entire `#P02` track on a build pipeline that does not, in fact, migrate.
- **What lands in this commit:**
  - `apps/web/prisma/schema.prisma` — `directUrl = env("DIRECT_URL")` removed from the `db` datasource. Inline comment cross-references this section.
  - `apps/web/scripts/vercel-migrate.js` — full rewrite: no `execSync`, no `try/catch`, no DB connection. Only emits a `[prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002 §11.13)` log line and exits 0. Comment block carries the full rationale + the operator-shell migrate command, so anyone reading the build log lands on the canonical reference.
  - `apps/web/package.json` — `prebuild` script unchanged (still calls `vercel-migrate.js`); the script itself is now the no-op. Decision rationale: keeping the prebuild log line is a discoverability anchor against a future operator re-introducing build-time migrate without reading the history.
  - `docs/DEV_RUNBOOK.md §9` — fully rewritten. Old §9.1 (non-fatal migrate) and §9.2 (4-item restoration checklist) marked OBSOLETE; new §9 documents operator-shell migrate procedure, safety checks, and the order of operations (migrate first, push second).
- **Operator-shell migrate procedure (DEV_RUNBOOK §9 canonical):**
  1. Implement schema change in `apps/web/prisma/schema.prisma` and commit locally.
  2. Generate the migration locally: `pnpm -C apps/web prisma migrate dev --name <change>` (against operator-local dev DB).
  3. Verify the generated SQL in `apps/web/prisma/migrations/<ts>_<name>/migration.sql`. Commit migration files.
  4. Apply to production DB from operator shell: `pnpm -C apps/web prisma:migrate` (which is `prisma migrate deploy`). DATABASE_URL points at production via operator-local `.env`.
  5. Smoke-probe the affected route (`/api/health` or specific endpoint) to confirm schema change is live.
  6. **Then** push the commit. Vercel rebuilds against an already-migrated schema; the no-op prebuild logs the "schema migrations are operator-shell" reminder and proceeds.
- **What this resolves:**
  - §9.2 restoration items 1, 2, 3 are now **moot** (no migrate step exists in build → no SKIP_PRISMA_MIGRATE needed → no `process.exit(1)` to restore → no canary). Item 4 (`execSync` timeout) was the load-bearing safety net while the bad pattern existed; it is now obsolete but harmless to leave in the no-op script (already removed in this commit since the script is a rewrite).
  - §11.12 "credential drift / network restriction / IPv4-IPv6" diagnostic is **deferred indefinitely** — only relevant if we ever want to re-enable build-time migrate, which §11.13 explicitly rules out.
  - `SKIP_PRISMA_MIGRATE` and `DIRECT_URL` Vercel env vars are now removable — they have no effect after this commit lands.
- **Why this is the safer end state, not a regression:**
  - The previous "Vercel auto-migrates on every deploy" model was always a false promise once §11.9 fired, but it stayed in place because §11.11's timeout made the build *succeed* — masking the failure.
  - Operator-shell migrate is the same pattern already used and validated for `pilot-seed.ts` (§11.1), `pilot-cleanup.ts` (§11.4), and `#26 S01/S02/S03` smoke writes — three systems we already trust.
  - Code → migrate → verify → push is the order Prisma's official docs recommend for production.
- **Operational reminder enforced in the script:**
  - The build log will now consistently emit `[prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002 §11.13)` on every Vercel deploy. If this line stops appearing, someone has changed the prebuild path — investigate before merging.
- **Vercel env cleanup (operator action, optional but recommended):** remove `SKIP_PRISMA_MIGRATE` and `DIRECT_URL` from production env vars. Both are no-ops after §11.13 lands. Removing them keeps the env surface aligned with the new no-op script.
- **Out of scope (deliberate):**
  - Migrating to a different deployment platform — this is purely a build-pipeline simplification, not a Vercel exit.
  - Adding a separate migrate-only CI job (e.g., GitHub Actions on schema-change paths) — that is a future workflow polish, not required for the canonical truth correction here. Track as `#P01-followup-migrate-ci` if pursued.
  - Diagnosing the underlying Vercel-build → Supabase-pooler unreachability — academic now that we don't depend on it. The §11.12 diagnostic plan is preserved in case it ever becomes interesting again.

### 11.14 DATABASE_URL env corruption incident — 2026-04-25 (post-§11.13 cleanup)

Operator incident, not a deployed defect.

- **Trigger:** during the §11.13 / §11.10 follow-up cleanup, operator removed `DIRECT_URL` and `SKIP_PRISMA_MIGRATE` from Vercel env vars (recommended action). Side-effect: `DATABASE_URL` value also got mutated — likely an accidental edit in the same form, or a paste/save quirk in the Vercel UI.
- **Symptom:** every Prisma route returned 500 with `Error parsing connection string: invalid port number in database URL`. `/api/health` reported `db: "failed"`. Fully production-down for canonical-truth-backed surfaces (`/api/health`, `/api/cart`, `/api/inventory`, `/api/quotes/my`, `/api/work-queue`, `/api/work-queue/purchase-conversion`, `/api/products/search`, `/api/organizations/mine` — all 500). Static / auth-only routes still served.
- **Detection:** Phase B-α α-C runtime probe via Claude in Chrome flagged `/api/work-queue/purchase-conversion` 500. Cross-probe of `/api/quotes/my` (β endpoint, unrelated to α-C code) was also 500, ruling out α-C as the cause. `/api/health` confirmed it was the `DATABASE_URL` env itself, not the schema or the prisma client.
- **Resolution:** operator re-entered the canonical `DATABASE_URL` value in Vercel UI (host / port `:6543` / userspec / password / `?pgbouncer=true&connection_limit=1&sslmode=require`) and redeployed. Build `dpl_2Vo4Y8mok79MVVozKgXJX7E9dMvV` READY in ~3m 47s. All probed routes back to 200 OK; `/api/health` reported `db: "connected"`.
- **Why this is operator-territory, not code-territory:** lambda code reads `DATABASE_URL` directly via Prisma's datasource binding. There is no application-side validation of the env (and adding one would either be redundant with Prisma's own parser or wouldn't help — Prisma fails clearly the first time it tries to use the URL). The runbook fix is the right level.
- **Operational lesson (added to DEV_RUNBOOK §9 implicitly):** any edit to a Prisma-bound env var (`DATABASE_URL`, `DIRECT_URL` if it returns) should be followed by a 3-second probe of `/api/health` after redeploy. The endpoint already exposes `db`, `hasDbUrl`, `hasDirectUrl`, `dbUrlPrefix` — designed for this exact check.
- **Not in scope for §11.14:** rebuilding `/api/health` to also validate the URL format up-front (would catch this faster) — minor improvement, parked as `#P01-followup-health-precheck` if pursued.

### 11.15 `#P02` Phase B-α — full implementation landed and production-verified 2026-04-25

Closeout of the §11.10 follow-up + plan §0 `docs/plans/PLAN_phase-b-alpha-purchase-conversion.md`.

- **Phases delivered (all in this session):**
  - **α-A** — `apps/web/src/lib/ontology/purchase-conversion-resolver.ts` (commit `5e56f682`). Pure deterministic resolver, 432 lines, 27 explicit tests / 37 with `it.each` expansion. 37/37 PASS. Public types match the UI's old `PurchaseExecutionItem` shape so α-C is mechanical.
  - **α-B** — `apps/web/src/app/api/work-queue/purchase-conversion/route.ts` (commit `36c627f9`). 187-line endpoint with 2 batched Prisma queries (Quote + AiActionItem), N+1 explicitly asserted via `mock.calls.length === 1`. 10 integration tests. 10/10 PASS.
  - **α-C** — `apps/web/src/app/dashboard/purchases/page.tsx` rewire (commit `3f55e63e`). 482→618 lines. UI swaps from `/api/quotes/my` (Phase B-β) to `/api/work-queue/purchase-conversion`. Restores conversion-queue UX (status / blocker / nextAction / AI options) on top of the canonical-truth resolver.
- **Production verification (2026-04-25 deploy `dpl_2Vo4Y8mok79MVVozKgXJX7E9dMvV`, post §11.14 recovery):**
  - `/api/work-queue/purchase-conversion` → 200 OK, body shape matches resolver: `{success: true, data: {items: [], stats: {total, review_required, ready_for_po, hold, confirmed, expired}}}`. Empty `items` is correct because the pilot tenant has zero quotes today.
  - SSR HTML render check: 7/7 α-C signatures present (헤더 카피, 5 탭, empty state). 0 mock signatures. 0 dead-button candidates ("일괄 발주 전환", "선택안 확정" both intentionally hidden until α-D).
  - β regression check: `/api/quotes/my` still 200, `/api/inventory` still 200 — Phase B-α did not break Phase B-β or any other surface.
- **LabAxis principle alignment (verified end-to-end):**
  - canonical truth: every UI field traces to a documented branch in `resolvePurchaseConversion()`. No mock fallback. Empty state surfaces honestly.
  - chatbot/assistant 재해석 금지: resolver is rule-based; AI rec status / aiOptions decoded from existing `AiActionItem` rows, no LLM call introduced.
  - dead button ban: bulk-PO + selected-option mutations intentionally NOT rendered. Header CTA hidden, rail has no inline mutation buttons. All shipped CTAs are real Next.js Link nav.
  - same-canvas + page-per-feature ban: same `/dashboard/purchases` route; no new pages.
- **Out of scope (still parked):**
  - **α-D** — bulk-PO conversion + `Quote.selectedReplyId` schema migration. Requires §11.13 operator-shell migrate procedure (DEV_RUNBOOK §9.2). Open whenever the pilot tenant accumulates enough quotes to make per-row mutations valuable; until then the read-only conversion queue is sufficient.
  - **α-F** — LLM-generated rationale strings for `aiOptions[].rationale[]`. Resolver currently emits rule-based strings ("회신 완료" / "회신 대기"). Add via `/api/ai-actions/generate` if the operational value is proven.
  - Per-supplier price / leadDays / moq ingestion. Resolver already accepts the fields; populating requires a new schema column or parsing `Quote.replies[].bodyText` — both out of v0 scope.
- **Net state of `#P02` track:**
  - Phase A (inventory mock removal) — CLOSED §11.8
  - Phase B-β (purchases mock removal, /api/quotes/my fallback) — CLOSED §11.10
  - Phase B-α (conversion-queue ontology restored on canonical truth) — CLOSED §11.15 (this entry)
  - α-D / α-F — open follow-ups, not blocking core value
  - `#P02-button-type` — CLOSED commit `acf725d0`
  - `#P02-legacy` — CLOSED commit `26133295`
  - `#P02-api-500` (suspected during Phase B-β probe) — moot; root cause was always stale build cache

### 11.16 `#P02-e2e-blocker` — sourcing → quote fake-success + dead path 정상화 2026-04-26

Direct successor to §11.15. Today's `#P02-e2e` probe (operator option B: Phase 1.1 + 1.2 single-shot, real Quote creation) hit a textbook LabAxis fake-success pattern at the *very first* user-facing step of the sourcing → quote chain — which §11.10 / §11.15 had never exercised because their probes started downstream (queue, then conversion-queue).

- **Trigger (production runtime probe before the fix):**
  - `/app/search?q=Trypsin` → "견적 담기" click on Trypsin-EDTA 100ml.
  - Toast renders `"견적함에 성공적으로 담겼습니다."` (success).
  - Footer counter: `견적 0 후보없음` — unchanged.
  - Network: zero API calls after the click.
  - Console WARNING: `"No vendor found for product product-pilot-trypsin-100ml"` (chunk `8403-9ec5409dae0238f6.js:349`).
- **Two LabAxis principles violated at once:**
  - *Dead button / no-op:* `addProductToQuote` in `apps/web/src/app/test/_components/test-flow-provider.tsx:356-359` did `console.warn(...); return;` whenever `product.vendors?.[0]` was undefined.
  - *Fake success:* `apps/web/src/app/test/_components/sourcing-result-row.tsx:260,301` wrappers did `() => { onToggleRequest(); toast.success(...); }` — the toast fired regardless of whether `onToggleRequest` mutated state.
- **Root cause across data and code:**
  - **Data:** pilot tenant catalog (`apps/web/scripts/pilot/pilot.ts:110-191`) ships 15 products with **zero ProductVendor rows by design** — the catalog deliberately omits vendor fields and parks vendor backfill for "subsequent phase #P02" (pilot.ts §92-94 comment). Every "견적 담기" click in the pilot tenant therefore hits the no-vendor branch.
  - **Code:** the no-vendor branch is the only path that *should* exist for pilot products in their current state ("견적 필요" badge is the canonical ontology label for vendor-unknown products). The bug is treating that ontology state as an error and silently bailing while the UI lies about success.
- **Truth reconciliation against §11.10 / §11.15:**
  - §11.10 verified `/dashboard/purchases` shows the canonical `/api/quotes/my` empty state. *Did not* exercise the *write* path that creates a Quote.
  - §11.15 verified `/api/work-queue/purchase-conversion` returns the canonical empty payload. *Did not* exercise the upstream `addProductToQuote` → `createQuote` chain.
  - Both prior closeouts are correct *for what they tested*. §11.16 covers the upstream surface they did not.
- **Fix landed (commit `f230d817`):**
  - **NEW** `apps/web/src/lib/quote/add-product-to-quote.ts` (170 lines, pure composer). Contract: `vendor-unknown is a first-class success that produces a real candidacy row (vendorId="", unitPrice=0)`. Only `ok:false` case is `missing-product-id`. Result type discriminates `added | vendor-pending | merged`.
  - **NEW** `apps/web/src/lib/quote/resolve-add-to-quote-toast.ts` (74 lines). Single source of truth for toast copy; exhaustive switch on the result mode. `ADD_TO_QUOTE_TOAST` const exposes 4 strings (`added` / `vendorPending` / `merged` / `missingProductId`).
  - **NEW tests:** `__tests__/lib/quote/add-product-to-quote.test.ts` (8 cases — all branches + multi-product preservation) and `__tests__/lib/quote/resolve-add-to-quote-toast.test.ts` (5 cases — intent per mode + 3-way distinct copy + failure mode never says `"성공"`). 13/13 PASS via `vitest run`.
  - **CHANGED** `test-flow-provider.tsx`: `addProductToQuote` delegates to the pure composer, returns `ComputeAddToQuoteResult`, commits `nextItems` via `setQuoteItems`. Interface signature changed `void → ComputeAddToQuoteResult`; `TestFlowProvider` dummy default updated to return `{ ok:false, reason:"missing-product-id" }`.
  - **CHANGED** `sourcing-result-row.tsx`: 4 onClick sites stripped of unconditional `toast.success` / `toast.info` calls. Wrapping `onToggleRequest` is now the toast authority (it sees the result mode).
  - **CHANGED** `test/search/page.tsx`: 3 `onToggleRequest` wrappers (row, rail, request-review-window) import the toast resolver, branch on result mode for adds, separate `removed` toast for the toggle-off path.
- **Production verification (deploy `dpl_FXHdWJYiw9EkwaHJ2eT7YrR7QfUs`, READY in 110 s):**
  - `/api/cart` → 200 OK with `totalItems: 0` baseline. `#P03` regression check — still healthy.
  - `/app/search?q=Trypsin&_cb=1` (cache-bust) → "견적 담기" click → toast renders `"견적 후보에 추가했어요. 가격은 견적 요청 후 확정됩니다."` (info intent). Footer counter `견적 0 → 1`. Status bar `"견적 후보 1 / 요청서 생성으로 이어갈 수 있습니다"`. Button state transitions `견적 담기 → ✓ 견적 후보`. Console WARNING `"No vendor found"` no longer emitted.
  - `/app/quote` (workbench) → vendor-pending row preserved end-to-end: `"⚠ 검토 필요 1건 / 가격 미확인 1"` header + `"📄 벤더 미지정"` group label (= `request-assembly.ts:74` fallback) + `Trypsin-EDTA 100ml / 가격 미확인` (= `PriceDisplay` `"가격 문의"` for `unitPrice=0`) + `"⚠ 1건 가격 미확인 — 공급사에 문의 필요"` next-action callout. No fake `₩0` rendered anywhere. Three request-strategy cards (간단 확인 / 표준 견적 [선택됨] / 확장 검토) plus auto-generated title (`Trypsin-EDTA 100ml 견적 요청`) and message wired correctly.
  - "임시저장" → toast `"임시저장 완료 / 폼 데이터가 로컬에 저장되었습니다."`; no API call (= local form scratch only, by design — no Quote DB row yet).
- **Out of scope (deliberate, separated into followups):**
  - **`#P02-followup-quote-403` (NEW, OPENED 2026-04-26):** clicking "1건 전송 준비 완료 →" calls `POST /api/quotes` and returns **403 Forbidden**. This is `enforceAction({ action: 'quote_request_create' }).deny()` in `route.ts:25-34`, gated *before* `createQuote` body executes. Unrelated to the fake-success fix in §11.16. Phase 1.3 (conversion-queue table render of a freshly-created Quote) cannot be verified until 403 is resolved. Action: enforcement policy / RBAC review for `quote_request_create` on the pilot owner.
  - **`#P02-followup-pilot-vendor-catalog` (NEW, OPENED 2026-04-26):** the 15-product pilot catalog still has zero `ProductVendor` rows. After §11.16, every pilot product click takes the vendor-pending path — *correct* operationally, but the "vendor-present" path in the same chain has no test fixture in production. Backfill all 15 products' vendors in one pass when ready (per-product gas: vendor name, priceInKRW, currency, stockStatus, leadTime, catalogNumber). This was deliberately deferred from option C in today's plan because partial backfill (Trypsin only) creates inconsistency.
  - **`#P02-followup-compare-fake-success` (NEW, OPENED 2026-04-26):** `apps/web/src/app/test/compare/page.tsx` has 7 sites with the same `addProductToQuote(...) ; toast({...})` pattern (L647, L838, L1196, L1348, L1551, L1580, L1581). Today's commit only fixes the sourcing inlet; compare flow's writes remain optimistic-toast. Same fix pattern (= switch each onClick to consume the result and call `resolveAddToQuoteToast`). Tracked but not blocking.
- **LabAxis principle alignment (verified end-to-end):**
  - canonical truth: `quoteItems` (client preview) and Quote DB rows (server truth) cleanly separated. `addProductToQuote` only mutates client preview; nothing pretends to have written DB.
  - chatbot/assistant 재해석 금지: pure composer is rule-based; AI rec status decoded elsewhere. No LLM call introduced in this fix.
  - dead button ban: silent return removed; every click produces an observable mutation **or** an honest error toast.
  - same-canvas + page-per-feature ban: zero new pages; entirely within `/app/search` + `/app/quote`.
- **Net state of `#P02` track after §11.16:**
  - Phase A (inventory) — CLOSED §11.8
  - Phase B-β (purchases mock removal) — CLOSED §11.10
  - Phase B-α (conversion-queue ontology) — CLOSED §11.15
  - **`#P02-e2e-blocker` (sourcing inlet fake-success) — CLOSED §11.16 (this entry)**
  - **`#P02-followup-quote-403`** — OPENED §11.16, blocks Phase 1.3 verification only
  - **`#P02-followup-pilot-vendor-catalog`** — OPENED §11.16, no user-visible blocker after §11.16
  - **`#P02-followup-compare-fake-success`** — OPENED §11.16, latent same-pattern in compare flow
  - α-D / α-F — open follow-ups, not blocking core value

### 11.17 `#P01-followup-migrate-ci` — drift-detector tried and dropped 2026-04-26

Direct field validation that the §11.13 generic-CI-unreachable result generalises beyond Vercel build infra. Tried, learnt, dropped — recorded so the next person doesn't re-attempt the same shape.

- **Goal:** add a GitHub Actions workflow that runs `prisma migrate status` (read-only metadata query) on every push touching `apps/web/prisma/**`, to catch the §11.13 weak spot — operator pushes code + migration files but forgets the operator-shell `pnpm prisma:migrate` step, leaving production schema-drifted from the deployed code.
- **Constraint preserved by design:** workflow runs `migrate status` ONLY, never `migrate deploy`. ADR-002 §11.13's "operator 단독 실행" rule for write paths stays intact.
- **Attempts (all on commit chain `0b4130ee → 48703b05 → af0317eb → 1212e6c8`):**
  - **Run #1** (commit `0b4130e`, `npx prisma generate` from `cwd: apps/web`): `npx` could not resolve a workspace-local prisma binary in the npm-managed repo and silently fetched the global latest (`prisma@7.8.0`). Prisma 7 removed `datasource.url` → P1012 schema validation against our `prisma.schema` (5.22.0). Failed in 26s.
  - **Run #2** (commit `48703b0`, `pnpm exec prisma generate` from `cwd: apps/web`): pnpm could not resolve the workspace and reported `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "prisma" not found`. Failed in 12s.
  - **Run #3** (commit `af0317e`, `pnpm --filter web exec prisma generate` from repo root): pnpm explicitly warned `WARN The "workspaces" field in package.json is not supported by pnpm. Create a "pnpm-workspace.yaml" file instead.` — confirmed the repo is npm-managed (root + `apps/web` both have `package-lock.json`, no `pnpm-workspace.yaml`). Failed in 15s.
  - **Run #4** (commit `1212e6c8`, pivoted to `npm ci` + `npx --no-install prisma migrate status`):
    - `npm ci` succeeded in 34s including the `apps/web/package.json` postinstall hook (`node scripts/dedupe-react.js && prisma generate`).
    - `Read-only schema drift check` step started, printed `Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-ap-northeast-1.pooler.supabase.com:6543"`, and **hung for 8m 37s** before the job-level `timeout-minutes: 10` killed it.
    - **This is the §11.9 / §11.12 unreachability reproducing on a different generic-CI surface.** GitHub Actions runners can't reach the Supabase pooler `:6543` from this deployment, same way Vercel build infra couldn't. The discovery generalises §11.13 from "Vercel build infra-specific" to "any externally hosted CI runner under the same Supabase project's network policy."
- **Why this kills the workflow's premise (not just an env tweak):**
  - The whole point of an automated drift detector is to query production from outside operator shell. If no externally hosted runner can reach production DB on the current network policy, the detector has no surface to operate on.
  - Mitigations evaluated and rejected:
    - *Supabase IP allow-list for GitHub Actions runners:* GitHub Actions runner IP pool is large, churning, and not pin-able cheaply — wider attack surface for marginal gain.
    - *Self-hosted GitHub Actions runner in operator shell:* defeats the purpose — that's just operator-shell with extra YAML.
    - *Switch to Supabase direct connection (`db.<ref>.supabase.co:5432`):* untested but would face the same network policy. §11.12 already field-validated that both pooler ports are unreachable from Vercel; expecting GitHub Actions to differ has no evidence.
    - *Git-side drift signal (no DB connection):* a workflow that compares `apps/web/prisma/migrations/**` git history against, say, the previous CI run's snapshot would catch "operator added a migration but forgot to push the schema" but not "operator pushed both but forgot to apply" — the actual §11.13 weak spot. Different problem.
- **Decision (2026-04-26):** drop the trk. Revert the workflow file and the four follow-up commits in a single revert commit. The §11.13 status quo (operator-shell-only migrate, with the operator's discipline as the safety net) remains the canonical procedure. The §11.13 weak spot ("operator forgets the migrate step") is now downgraded from "automatable safety net candidate" to "operator-discipline accountability" — same as before this trk opened, but now with explicit field validation that no external automation can fix it under the current Supabase network policy.
- **What stays preserved:**
  - DEV_RUNBOOK §9.2 (operator-shell migrate procedure) — unchanged.
  - §11.13 "Vercel build-time migrate retired" — reinforced.
  - **ADR §11.17 itself**, so the next person who proposes "let's add CI drift detection" reads run #4 first and does not repeat 4 commits + 1 hour of debug to re-derive the same conclusion.
- **Out of scope (still open):**
  - `#P01-followup-migrate-ci` — closed as "won't fix for the §11.13 reasons documented here."
  - `#SEC02` (git history password purge), `#P02-followup-quote-403`, `#P02-followup-pilot-vendor-catalog` — independent of §11.17.

### 11.18 `#P02-followup-quote-403` — CLOSED via NEXT_PUBLIC_APP_URL env addition 2026-04-26

Direct successor to §11.16. The §11.16 Phase 1.3 verification (conversion-queue display of a freshly-created Quote) was blocked because every `POST /api/quotes` returned 403. Spike + fix landed as an env-only change.

- **Symptom:** every `POST /api/quotes` returned `{"error":"현재 요청은 유효한 작업 세션에서 시작되지 않았습니다.","correlationId":"corr_..."}` with status 403, regardless of operator role or quote payload. ADMIN role passed `ACTION_ROLE_MINIMUM[quote_request_create] = ['requester','buyer','ops_admin']` cleanly, so the deny was not in `enforceAction`'s authorization branch.
- **Root cause (read-only audit, no code):**
  - The 403 message text traces to `apps/web/src/lib/security/csrf-contract.ts:151-152` — the governance message for `origin_mismatch` and `missing_origin`. CSRF gate rejection, not authorization rejection.
  - `getTrustedOrigins()` in the same file (L109-131) reads `process.env.NEXT_PUBLIC_APP_URL` and `process.env.LABAXIS_TRUSTED_ORIGINS`, plus three hardcoded localhost entries. With both env vars unset in production, the trusted origins list reduced to `['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']`.
  - Production Origin header `https://bio-insight-lab-web.vercel.app` matched none of the localhost entries, so `isTrustedOrigin()` returned false → `origin_mismatch` violation.
  - `LABAXIS_CSRF_MODE` was set to a value that escalates `origin_mismatch` on `protection: 'required'` routes to a 403 block (consistent with `full_enforce`). `/api/quotes` is `protection: 'required', highRisk: false` (default config; not in `HIGH_RISK_ROUTE_PATTERNS` of `csrf-route-registry.ts`), so `full_enforce` would block it while `soft_enforce` would not. The empirical block tells us mode = `full_enforce`.
  - Net: every production browser-origin mutation was blocked, not just `POST /api/quotes`. The narrow §11.16 symptom was a generalizable misconfiguration.
- **Fix (env-only, no code change):**
  - Added `NEXT_PUBLIC_APP_URL = https://bio-insight-lab-web.vercel.app` (canonical production host, no trailing slash) to Vercel project env vars (Production scope).
  - Triggered redeploy `dpl_DmVgbZH4Pa6DgVSz42eauxtfAMHT` (commit `c5d9961c`, ~3.8 min build) — `NEXT_PUBLIC_*` prefix requires a fresh build because Next.js inlines them at build time.
  - No code change. The CSRF infrastructure is correct; the env was incomplete.
- **Production verification:**
  - `/api/cart` → 200 OK (regression check, still healthy).
  - **First raw fetch** (no CSRF token): `POST /api/quotes` → **403** with `{"error":"보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.","correlationId":"..."}`. The message text now traces to `csrf-contract.ts:148-153` `missing_token` / `token_mismatch` — confirming origin check now passes and the gate has advanced to the token check, exactly the expected next layer.
  - **Cookie token bootstrap**: `GET /api/security/csrf-token` → 200 with `csrfToken`. Cookie `labaxis-csrf` = `bb3181be9e22...` (12-char prefix logged; full value sensitive).
  - **Second fetch with `x-labaxis-csrf-token` header attached**: `POST /api/quotes` → **201 CREATED**. Quote row persisted in production DB:
    ```
    id:             cmofbcxj30003usrss33mupfl
    userId:         cmo4mcbih00003ut3ozub29tc  (호영, ADMIN — pilot owner)
    organizationId: org-pilot-internal          (pilot tenant)
    title:          NEXT_PUBLIC_APP_URL + token spike test
    status:         PENDING
    vendor:         null                        (vendor-pending preserved end to end)
    items:          1                           (Trypsin-EDTA 100ml)
    quoteNumber:    null                        ← see followup below
    ```
- **Why production UI clicks work after this fix without further changes:**
  - `apps/web/src/lib/api-client.ts` exports `csrfFetch()` — a `fetch` drop-in that auto-bootstraps and attaches `x-labaxis-csrf-token` for `POST/PUT/PATCH/DELETE`. The sourcing → quote chain (`test-flow-provider.tsx`'s `generateShareLinkMutation`) already routes through `csrfFetch`, so the token attachment is automatic for real user flows.
  - Spike raw `fetch` had to manually replicate the cookie-read + header-attach pattern; that's why the 1st spike fetch hit `missing_token` and the 2nd passed.
- **New followup OPENED — `#P02-followup-quote-number-missing` (2026-04-26):**
  - `createQuote()` in `apps/web/src/lib/api/quotes.ts` does not assign a `quoteNumber` — newly created Quote rows persist with `quoteNumber: null`.
  - `/api/work-queue/purchase-conversion/route.ts:66` filters `where: { userId, quoteNumber: { not: null } }`, so quotes with null quoteNumber are excluded from the conversion queue.
  - Verified: the spike-created quote `cmofbcxj30003usrss33mupfl` is not visible in the conversion-queue stats (`stats.total = 0`).
  - Independent of §11.18: the 403 fix is complete; the queue-display issue is a separate code-side bug in either `createQuote` (should auto-assign a quoteNumber) or in the conversion-queue filter (should accept newly created quotes via a different signal). Tracked as `#P02-followup-quote-number-missing`.
- **Cleanup deferral:** the spike Quote `cmofbcxj30003usrss33mupfl` remains in production DB, scoped to `org-pilot-internal`. Operator can leave it (no user impact) or run a targeted `DELETE FROM "Quote" WHERE id = 'cmofbcxj30003usrss33mupfl';` from operator shell. Not blocking.
- **What stays preserved:**
  - `LABAXIS_CSRF_MODE = full_enforce` is the correct production posture. The fix did not weaken security policy; it added the missing trusted-origin entry that the policy expected.
  - `LABAXIS_TRUSTED_ORIGINS` remains optional — only needed if operator starts using preview/branch alias URLs (`*-git-main-*` etc.) for production-equivalent traffic. Canonical `bio-insight-lab-web.vercel.app` covers most cases.
  - csrfFetch wrapper unchanged.

---

## 12. Changelog

- 2026-04-23 — ADR-002 opened and Phase 1 (identifiers) landed at 172297a2.
- 2026-04-23 — Phase 2 (guard + test) landed at 5027e3c9. Opt-in token fixed to `YES-SEED-PRODUCTION-PILOT-2026` (Q4 approved).
- 2026-04-23 — Phase 3 (pilot-seed) landed at 315c1445.
- 2026-04-23 — Phase 4 (pilot-cleanup + test) landed at 75588fd8.
- 2026-04-23 — Phase 5 ran against smoke DB (§11.1 deviation). Commit d2194359 added `PILOT_OWNER_USER_ID_OVERRIDE` (§11.2). Seed PASS, cleanup dry-run 19/19.
- 2026-04-23 — Phase 6 canonical decision doc (this file). Status ACCEPTED.
- 2026-04-24 — §11.6 opened: production project-ref typo (q→o) corrected across 10 sites / 6 files. ADR-001 §4 also records `PRODUCTION_PROJECT_REGION = ap-northeast-1`. No runtime impact. Pilot-seed production run still pending with corrected env.
- 2026-04-24 — §11.1 CLOSED: production seed PASS. Org / workspace / 2 memberships / 15 products upserted against `xhidynwpkqeaojuudhsw`; cleanup dry-run 19/19 present=true. §11.7 OPENED: transaction pooler (`:6543`) is incompatible with Prisma `$transaction` — `DATABASE_URL_PILOT` must use session pooler (`:5432`). Enforcement via Usage docblock notes in `pilot-seed.ts` / `pilot-cleanup.ts` + `DEV_RUNBOOK.md §8` row warning.
- 2026-04-25 — §11.8 OPENED and CLOSED: `#P02` Phase A (commit `5f282a07`, inventory mock fallback removal) runtime-verified on production via Claude in Chrome probe. 5 checks PASS. Initial "dead button" reading was a probe artifact (`md:hidden` mobile CTA variant returned by Chrome find tool; not a code defect). Follow-up tracks `#P02-button-type` (shadcn Button default type=submit) and `#P01-followup` (Vercel build-server pooler revision) opened, both non-blocking.
- 2026-04-25 — §11.9 OPENED and CLOSED: Vercel build-server reachability revision of §11.7. Session pooler (`:5432`) is unreachable from Vercel build infrastructure; transaction pooler (`:6543`) is required for `prisma migrate deploy`. §11.7 scope now restricted to operator-shell maintenance scripts. Records `SKIP_PRISMA_MIGRATE` emergency bypass + non-fatal migrate safety valve (commits `c99dd785`, `e7a01c18`, `16e6ef5d`) as temporary mitigations with restoration checklist. `.vercel/project.json` projectId unchanged. Empty-commit redeploy pattern noted.
- 2026-04-25 — §11.10 OPENED and CLOSED: `#P02` Phase B-β (commit `b214386a`, purchases mock removal + `/api/quotes/my` wiring) runtime-verified on production via Claude in Chrome probe. 0 mock signatures, 13/18 new β signatures rendered, `/api/quotes/my` 200 OK with stats schema matching `QuotesMyResponse`, dead-button audit 3/3 PASS (no `md:hidden` artifact). Vercel deploy-queue incident: prior `2259b9c1` build sat in BUILDING for ~1 h holding the queue; resolved by killing the build and setting `SKIP_PRISMA_MIGRATE=1` — direct field validation of §11.9's `execSync` timeout warning. `.vercel/project.json` drift correction: production domain is owned by `prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim` (`bio-insight-lab-web`), not by the `prj_9myxP5rmQ6QupPjp7vi6dtBF1qug` (`web`) recorded in `.vercel/project.json` — earlier §11.9 reading corrected; drift parked as `#P01-followup-correction`.
- 2026-04-25 — §11.11 OPENED and CLOSED: `vercel-migrate.js` `execSync` now has `timeout: 90_000` + `killSignal: "SIGKILL"`, and the catch block distinguishes timeout (with §11.9 reachability hint) from other failures. Direct follow-up to §11.10's 1-hour queue block — the unbounded execSync was the prerequisite for restoration items 1–3 (unset `SKIP_PRISMA_MIGRATE`, restore `process.exit(1)`, canary migration), so it lands first. Restoration now 4 items, item 4 DONE.
- 2026-04-25 — §11.11 field-validated by deploy `dpl_66GXg92pDNd3te5EsfZf3kCgQMk9` (commit `33172f3d`) — timeout fired at ~89 s with the documented `[prebuild] prisma migrate deploy TIMED OUT` log + §11.9 hint, build continued and READY in 5 m 14 s vs the 1 h+ §11.10 hang. **§11.12 OPENED** by the same deploy: timeout fired even though Datasource was on transaction pooler `:6543`, refuting §11.9's reachability claim. §11.12 captures the diagnostic plan (credential check / direct connection / IP allow-list / IPv4-IPv6 routing). §9.2 restoration items 1 + 3 are gated on §11.12; mitigation is to re-set `SKIP_PRISMA_MIGRATE=1` until reachability is restored.
- 2026-04-25 — `#P01-followup-correction` CLOSED: operator-local `apps/web/.vercel/project.json` resync'd from the legacy `web` (`prj_9myxP5rmQ6QupPjp7vi6dtBF1qug`) project to the live production project `bio-insight-lab-web` (`prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim`). 3 fields changed (`projectId`, `projectName`, `settings.createdAt`); other build settings verified identical to live project via `mcp__vercel__get_project`. **Note:** `.vercel/` is in `.gitignore` (root + `apps/web/.gitignore`) so this file change is **operator-local only** — not committed to repo. The fix lives wherever someone has run `vercel link`. The ADR entry below is the canonical record. Legacy `web` project deletion landed in a separate operator action — see the 2026-04-25 entry below.
- 2026-04-25 — §11.12 field-validated as **fully refuted**: deploy `dpl_FoFtRWTnCRzrRZGagE2KDJ4DZwmC` ran with both `DATABASE_URL` and `DIRECT_URL` on transaction pooler `:6543`, identical timeout result. Both pooler ports are unreachable from Vercel build infra in this deployment. **§11.13 OPENED and CLOSED:** Vercel build-time `prisma migrate deploy` permanently retired (γ-shell). `apps/web/prisma/schema.prisma` `directUrl` removed; `apps/web/scripts/vercel-migrate.js` rewritten to no-op log; DEV_RUNBOOK §9 fully rewritten as operator-shell migrate procedure. §9.2 restoration items 1–3 are now moot (no build-time migrate to restore). Vercel env vars `SKIP_PRISMA_MIGRATE` and `DIRECT_URL` are removable.
- 2026-04-25 — `#P02-legacy` CLOSED: deleted 3 dead inventory files (`inventory-main.tsx`, `inventory-content.tsx.full`, `inventory-content.tsx.full2`) totalling 11,580 lines. Method note: FUSE mount denied unlink, used `git update-index --force-remove` to mark deletion in git index without touching working tree. `#P02-button-type` CLOSED: shadcn Button now defaults to `type="button"` (single-file change in `apps/web/src/components/ui/button.tsx`). All 6 forms in `apps/web/src` were verified to already pass `type="submit"` explicitly, so the change has zero behaviour delta but removes the latent foot-gun for any future form-wrap.
- 2026-04-25 — `#P02 Phase B-α` plan opened: `docs/plans/PLAN_phase-b-alpha-purchase-conversion.md`. Audit found that ~80% of the conversion-queue ontology is composable from existing models. Recommended Option α-1 (server-side composer endpoint), 5-phase implementation (resolver → endpoint → UI rewire → optional bulk-PO → closeout doc). Awaiting GO from operator before implementation starts.
- 2026-04-25 — `#P02 Phase B-α` α-A (resolver, commit `5e56f682`, 37/37 tests PASS) → α-B (endpoint, commit `36c627f9`, 10/10 tests PASS, no N+1 verified) → α-C (UI rewire, commit `3f55e63e`, 482→618 lines) all landed in single session. Production runtime probe confirmed: `/api/work-queue/purchase-conversion` returns 200 with the documented response shape; SSR HTML carries 7/7 α-C signatures and 0 mock signatures; dead-button audit 0; β regression 0. **§11.15 OPENED and CLOSED.**
- 2026-04-25 — §11.14 OPENED and CLOSED: DATABASE_URL env corruption incident during operator's §11.13 cleanup. All Prisma routes returned 500 with `Error parsing connection string: invalid port number`. Detected by Phase B-α α-C runtime probe; ruled out as α-C regression by cross-probing β endpoint (also 500). Resolved by re-entering canonical `DATABASE_URL` value in Vercel UI + redeploy (`dpl_2Vo4Y8mok79MVVozKgXJX7E9dMvV`). Operational lesson: probe `/api/health` after any Prisma-bound env edit.
- 2026-04-25 — `#P01-followup-health-precheck` CLOSED: `/api/health` now performs a structural URL pre-check (commit `42f83fef`, `apps/web/src/lib/health/validate-database-url.ts` + 16 unit tests). New `db: "url-malformed"` branch returns immediately with `urlIssue` reason when `DATABASE_URL` is structurally broken (the §11.14 class), distinguishing it from `db: "failed"` (URL valid but DB unreachable). Adds `urlOk` boolean to all branches for grep-based triage. Direct successor to §11.14.
- 2026-04-25 — Legacy `web` Vercel project (`prj_9myxP5rmQ6QupPjp7vi6dtBF1qug`) DELETED via Vercel UI by operator. Verified via `mcp__vercel__list_projects` — only `bio-insight-lab-web` (`prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim`) remains as a LabAxis surface. Together with the §11.10 `.vercel/project.json` resync (`#P01-followup-correction`) this fully closes the project drift opened in §11.9 / §11.10 and removes the surface area for env mis-edit on a wrong project.
- 2026-04-26 — `#P03` CLOSED: `/api/cart` GET aligned with live `ProductVendor` schema. Old code used `where: { isActive: true }` and `select: { inStock: true }` neither of which exist on `ProductVendor`. Replaced with `select: { priceInKRW, stockStatus }` and derived response `inStock` as `stockStatus !== "OUT_OF_STOCK"` (fail-open). Cart route returns 200 with empty cart for the pilot owner; verified pre-§11.16 deploy. Commit `efc4ed42`.
- 2026-04-26 — **§11.16 OPENED and CLOSED:** `#P02-e2e-blocker` — sourcing → quote inlet fake-success + dead path normalised (commit `f230d817`). Pure composer + result-driven toast resolver replace the silent `return` + unconditional `toast.success` pattern. 13/13 vitest pass; production probe on deploy `dpl_FXHdWJYiw9EkwaHJ2eT7YrR7QfUs` confirms vendor-pending now produces a real candidacy row, the toast tells the truth, and the workbench preserves "검토 필요 / 가격 미확인 / 벤더 미지정" all the way to `/app/quote/request`. Three new followups OPENED in §11.16: `#P02-followup-quote-403` (POST /api/quotes 403 from `enforceAction` deny — blocks Phase 1.3 verification only), `#P02-followup-pilot-vendor-catalog` (15-product vendor backfill), `#P02-followup-compare-fake-success` (7 same-pattern sites in compare/page.tsx).
- 2026-04-26 — `#P02-followup-compare-fake-success` CLOSED (commit `c4f526fb`). 6 callsites in `apps/web/src/app/test/compare/page.tsx` switched to `resolveAddToQuoteToast` from §11.16. shadcn `useToast` `default | destructive` variant maps cleanly onto the 3-success / 1-error result modes. Bulk-add CTA (L1365) aggregates per-product result tallies into a single honest summary toast instead of one optimistic line per product. tsc on changed surface: 0 errors. `compare` flow's same-shape fake-success risk closed.
- 2026-04-26 — **§11.17 OPENED and CLOSED:** `#P01-followup-migrate-ci` — drift-detector trk attempted and dropped. 4 commits (`0b4130e → 48703b0 → af0317e → 1212e6c8`) iterated through `npx prisma` → `pnpm exec` → `pnpm --filter web exec` → `npm ci + npx --no-install`. Run #4 finally got past install/postinstall but `prisma migrate status` hung on Supabase pooler `:6543` connection for 8m 37s before timeout-minutes: 10 killed it. **Field-validated that the §11.9 / §11.12 generic-CI-unreachable result generalises to GitHub Actions runners**, not just Vercel build infra. The whole drift-detector premise (query production DB from external CI) has no surface under the current Supabase network policy. Reverted to status quo. §11.13 operator-shell-only migrate stays canonical; the "operator forgets to migrate" weak spot is now explicitly an operator-discipline accountability item, not an automatable safety net.
- 2026-04-26 — **§11.18 OPENED and CLOSED:** `#P02-followup-quote-403` — env-only fix, no code change. Read-only audit traced the 403 to `csrf-contract.ts:151-152` (`origin_mismatch` / `missing_origin`) caused by missing `NEXT_PUBLIC_APP_URL` env var: production trusted origins reduced to localhost-only, so every production browser-origin mutation was blocked under `full_enforce`. Operator added `NEXT_PUBLIC_APP_URL = https://bio-insight-lab-web.vercel.app` and redeployed (`dpl_DmVgbZH4Pa6DgVSz42eauxtfAMHT`). Production probe: `POST /api/quotes` 403 → 201 CREATED, Quote `cmofbcxj30003usrss33mupfl` persisted in `org-pilot-internal` with `vendor: null` (vendor-pending preserved). New followup `#P02-followup-quote-number-missing` OPENED — `createQuote()` does not assign `quoteNumber`, and the conversion-queue endpoint filters `quoteNumber: { not: null }`, so newly created quotes are invisible in the queue.
