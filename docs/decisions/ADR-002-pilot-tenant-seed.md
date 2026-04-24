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
  - `#P01-followup`: Operator commits `ceda4063` .. `2c225f91` landed Vercel build server workarounds (session pooler unreachable → transaction pooler `:6543` for build-time, `SKIP_PRISMA_MIGRATE` env, non-fatal migrate). This partially revises §11.7 — session-pooler rule applies to operator-shell maintenance scripts only, not to Vercel build-time. To be recorded in §11.9 once the workaround stabilises.

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
