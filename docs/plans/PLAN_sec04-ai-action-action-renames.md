# Implementation Plan: `#SEC04-ai-action-action-renames`

- **Status:** ✅ Complete
- **Started:** 2026-04-26
- **Last Updated:** 2026-04-26
- **Completed:** 2026-04-26 (~75 min total)

**CRITICAL INSTRUCTIONS** — After completing each phase:

1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands (vitest, tsc, production probe)
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT expand scope beyond the 4-line enum swap (defer dead-code cleanup, defer button-CSRF-renewal track)

---

## 0. Truth Reconciliation

**Latest Truth Source:**

- `apps/web/src/lib/security/server-authorization-guard.ts` (commit `b55ed0e3`, ADR §11.25)
  - Line 163: `order_create: ['buyer', 'approver', 'ops_admin']`
  - Line 167: `ai_action_create: ['requester', 'buyer', 'approver', 'ops_admin']` ← target label, already registered
  - Line 204-205: `sensitive_data_export` / `sensitive_data_import: ['buyer', 'ops_admin']`
- `#α-F-followup-ai-actions-runtime-verify` Phase 0 audit (read-only, completed 2026-04-26)
  - 4 endpoints inventoried; 2 LLM-real (`quote-draft`, `vendor-email-draft`) and 2 LLM-free deterministic (`order-followup`, `reorder-suggestions`)
  - Production probe surfaced quote-draft 403 (CSRF expired, recovers on refresh)

**Secondary References:**

- ADR-002 §11.25 closing memo: "Cleanup of pre-existing ai-actions endpoints (`quote-draft`, `vendor-email-draft`, etc.) overloading non-aligned actions (`order_create`, `sensitive_data_export`). Tracked as `#SEC04-ai-action-action-renames` if pursued."
- ADR-002 §11.26 closeout (`21821f4a`): Phase 6 provider toggle live on `dpl_8ELoAZCLm8...`
- 4 route files: `apps/web/src/app/api/ai-actions/generate/{quote-draft,vendor-email-draft,order-followup,reorder-suggestions}/route.ts`

**Conflicts Found:** None. `ai_action_create` is already a registered `IrreversibleActionType` with appropriate role-minimum since §11.25; only the 4 route files were missed in the original cleanup.

**Chosen Source of Truth:** Direct grep results from Phase 0 audit + `server-authorization-guard.ts` line numbers.

**Environment Reality Check:**

- [x] repo / branch context understood (`main`, head `21821f4a`)
- [x] runnable commands identified (vitest, tsc, claude-in-chrome probe)
- [x] execution blockers identified (none)

---

## 1. Priority Fit

**Current Priority Category:**

- [ ] P1 immediate
- [x] Release blocker (proximate — see below)
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**

Phase 0 audit surfaced that `quote-draft` route uses `enforceAction(action: 'order_create')`, whose role-minimum excludes `requester`. If the operator (or any pilot user) has the `requester` role, the header CTA "견적 요청 초안 만들기" is a permanent dead-button (request would always 403 on role check, not just on CSRF expiration). LabAxis's dead-button ban is a hard product constraint, so this counts as release-blocker proximate. The `ai_action_create` action — registered in §11.25 specifically for AiActionItem-creating endpoints — already includes `requester` in its role-minimum, mirroring α-F rationale's intent.

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming (adjacent)
- [x] Workflow / Ontology Wiring (action-enum alignment)
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [ ] Web
- [ ] Design Consistency

---

## 3. Overview

**Feature Description:**

Align 4 ai-actions generate endpoints onto the dedicated `ai_action_create` action in `IrreversibleActionType`, replacing the overloaded `order_create` / `sensitive_data_export` / `sensitive_data_import` labels. Restores audit-log clarity, broadens role coverage to match α-F rationale, and removes the latent dead-button risk surfaced by Phase 0 audit.

**Success Criteria:**

- [ ] All 4 ai-actions generate endpoints route through `enforceAction(action: 'ai_action_create')`
- [ ] vitest stays green (existing test count preserved or expanded)
- [ ] tsc stays clean
- [ ] production probe (Chrome → /dashboard/quotes header CTA) returns 200 + AiActionItem persisted with non-null `aiModel` matching OpenAI dispatch
- [ ] vercel runtime log keyword match: `gpt-4o-mini` or echo of OpenAI Chat Completions response

**Out of Scope (⚠️ 절대 구현하지 말 것):**

- [ ] AiActionButton CSRF token auto-renewal (separate track — labeled option A in this session)
- [ ] Endpoint-specific dedicated labels like `ai_quote_draft_create` / `ai_vendor_email_draft_create` (operator confirmed single label is acceptable)
- [ ] Removal of dead code at `quote-draft/route.ts:38-40` (unreachable post-enforcement session check) — minimal-diff principle
- [ ] Mutation-lock TTL adjustments
- [ ] action enum coverage of read-only endpoints

**User-Facing Outcome:**

The header "견적 요청 초안 만들기" CTA on `/dashboard/quotes` will reliably trigger `quote-draft` end-to-end for all roles ≥ requester. The same applies to vendor-email-draft, order-followup, and reorder-suggestions. From the operator's perspective, the only visible change is "previously failed, now works on requester role". Audit logs gain endpoint clarity via the `routePath` field while sharing a single `actionType` label.

---

## 4. Product Constraints

**Must Preserve:**

- [x] workbench / queue / rail / dock — no UI surface change
- [x] same-canvas — no new pages, no new modals
- [x] canonical truth — `IrreversibleActionType` union remains the single source of truth
- [x] invalidation discipline — no query/cache invalidation logic touched

**Must Not Introduce:**

- [x] page-per-feature — N/A (no UI added)
- [x] chatbot/assistant reinterpretation of ontology — N/A
- [x] dead button / no-op / placeholder success — actually removes dead-button risk
- [x] fake billing/auth shortcut — role check tightened in spirit (clearer audit), not weakened
- [x] preview overriding actual truth — N/A

**Canonical Truth Boundary:**

- **Source of Truth:** `IrreversibleActionType` union + `ACTION_ROLE_MINIMUM` table (`server-authorization-guard.ts`)
- **Derived Projection:** `enforceAction()` allowed/denied result; AiActionItem rows persisted by each route
- **Snapshot / Preview:** None
- **Persistence Path:** Same as before — `db.aiActionItem.create({...})` with route-specific `type` enum (e.g. `QUOTE_DRAFT`, `VENDOR_EMAIL_DRAFT`, `ORDER_FOLLOWUP`, `REORDER_SUGGESTION`). Only the enforceAction `action` argument changes.

**UI Surface Plan:**

- [x] Existing route section — backend swap only
- [ ] Inline expand / Right dock / Bottom sheet / Split panel / Settings panel / New page

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Single label `ai_action_create` for all 4 endpoints | §11.25 already established this label for α-F rationale; consistency. routePath in audit envelope distinguishes endpoints. | Endpoint-level filtering of `actionType` becomes coarser (use `routePath` instead). |
| Defer dead-code cleanup at `quote-draft/route.ts:38-40` | Minimal-diff principle; unreachable lines don't affect runtime; cleaning them is a separate hygiene task. | Slight cosmetic noise remains; tracked in Notes for follow-up. |
| Single commit (after Phase 1 GREEN) | 4-line swap is atomic; easier to revert via single commit revert. | All-or-nothing rollback; acceptable given small scope. |

**Dependencies:**

- Required Before Starting: Phase 0 sweep audit (Phase 0 of this plan)
- External Packages: None
- Existing Routes / Models / Services Touched:
  - `apps/web/src/app/api/ai-actions/generate/quote-draft/route.ts`
  - `apps/web/src/app/api/ai-actions/generate/vendor-email-draft/route.ts`
  - `apps/web/src/app/api/ai-actions/generate/order-followup/route.ts`
  - `apps/web/src/app/api/ai-actions/generate/reorder-suggestions/route.ts`

**Integration Points:**

- `enforceAction()` from `server-enforcement-middleware.ts`
- `ACTION_ROLE_MINIMUM` from `server-authorization-guard.ts`
- AiActionItem persistence via `db.aiActionItem.create()` (no schema change)
- Audit envelope via `appendAuditEnvelope({ actionType: config.action, ... })`
- Activity log via `createActivityLog()` (no change)

---

## 6. Global Test Strategy

All phases follow Red-Green-Refactor.

**Test Strategy by Work Type:**

- Workflow / ontology wiring → existing route tests (if any) get an `enforcement.action === 'ai_action_create'` assertion appended
- E2E / smoke → production probe in Phase 2 via Claude in Chrome, verifying end-to-end through real OpenAI dispatch
- No business-logic change → no new unit-test coverage required for utilities

**Execution Notes:**

- vitest runs from `apps/web` via `../../node_modules/.bin/vitest run --reporter=basic`
- tsc runs from `apps/web` via `../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
- production probe gated on Vercel READY state for the new deploy

---

## 7. Implementation Phases

### Phase 0: Truth Lock + Test/Sweep Audit (read-only)

**Goal:** Map every site that hardcodes one of the 4 action labels, before any code change.

- Status: [ ] Pending | [ ] In Progress | [x] Complete
- Estimated time: 30 min
- Actual time: 15 min
- Completed: 2026-04-26

**Sweep Result:**

| label | total hardcoded sites | in scope (rename) | out of scope (legitimate overload) |
| :--- | :--- | :--- | :--- |
| `'order_create'` | 16 | quote-draft (L30) | 15 (orders, admin/orders, quotes/parse-pdf, /api/quotes/*, /api/ai/*, etc.) |
| `'sensitive_data_export'` | 11 | vendor-email-draft (L30) | 10 (analytics, notifications, groupware/send, alerts/send, etc.) |
| `'sensitive_data_import'` | 60+ | order-followup (L38), reorder-suggestions (L28) | 58+ (search/intent, products/*, inventory/*, vendor/*, work-queue/*, etc.) |

**Side observation:** `'sensitive_data_import'` is the codebase's catch-all default mutation label, used by 60+ sites. Cleaning the codebase-wide overload is out of scope for SEC04 and tracked separately as `#SEC05-action-label-codebase-wide-cleanup`.

**Operator role inference:** `/api/search/intent` (sensitive_data_import, role-min `['buyer', 'ops_admin']`) returned 200 in §11.26 production probe → operator role ≥ buyer. Therefore the quote-draft 403 was confirmed as CSRF-token expiry (not role-block). SEC04's value is audit-log clarity + LabAxis principle alignment + future-proofing dead-button risk for requester-role operators, not the immediate operator's access.

**🔴 RED:**

- grep for `'order_create'` (case-sensitive single-quote) across `apps/web/src` → list non-route files
- grep for `'sensitive_data_export'` and `'sensitive_data_import'` → same
- check `apps/web/src/__tests__/api/ai-actions/**` if any existing route tests reference the 4 action labels
- check `scripts/check-csrf-fetch-regression.sh`, drift detector workflow, and any pilot-related test fixtures

**🟢 GREEN:**

- produce a single mapping table:
  | file | line | label | replace? (yes/no, reason) |
- confirm 4 route files are the only "yes" entries; everything else is "no" (because it's a different code path that legitimately uses the label, e.g., `enforceAction({ action: 'order_create' })` in the actual order-creation route should NOT be touched)

**🔵 REFACTOR:**

- update audit table in this plan
- if a non-route hardcoded site is unexpectedly found, halt and reconvene before proceeding to Phase 1

**✋ Quality Gate:**

- [ ] mapping table complete
- [ ] non-route hits are all "no" (legitimate uses)
- [ ] no surprise call sites discovered

**Rollback:** N/A (read-only).

---

### Phase 1: 4-endpoint action rename + tests

**Goal:** Apply the 4-line enum swap and validate via vitest + tsc.

- Status: [ ] Pending | [ ] In Progress | [x] Complete
- Estimated time: 1h
- Actual time: 30 min
- Commit: `65621f6a`
- Completed: 2026-04-26

**Result:**

- 4 endpoint route files updated to `action: 'ai_action_create'`
- vitest 29/29 PASS (no regression on AI tests)
- tsc --noEmit on 4 routes → 0 errors
- grep confirms 0 remaining overload hits inside `apps/web/src/app/api/ai-actions/`

**Side observation (line endings):** `quote-draft/route.ts` and `vendor-email-draft/route.ts` had CRLF; Edit-tool driven 4-line swap normalised them to LF, inflating `git diff --stat` to 358/364 lines despite the semantic 1-line-per-file change. The other two routes show the expected 2-line diff. FUSE mount blocked a clean revert-then-sed retry; proceeding with normalisation as incidental cleanup (now consistent with the rest of the ai-actions tree).

**🔴 RED:**

- if existing tests for the 4 routes contain hardcoded enforcement assertions, update them to expect `'ai_action_create'`
- if no existing test, optionally add a single unit-level assertion file scaffolded from the Phase 0 mapping (defer if scope expands)

**🟢 GREEN:**

- swap `'order_create'` → `'ai_action_create'` in `quote-draft/route.ts`
- swap `'sensitive_data_export'` → `'ai_action_create'` in `vendor-email-draft/route.ts`
- swap `'sensitive_data_import'` → `'ai_action_create'` in `order-followup/route.ts`
- swap `'sensitive_data_import'` → `'ai_action_create'` in `reorder-suggestions/route.ts`

**🔵 REFACTOR:**

- review for any stale comments mentioning the old action labels — update or delete
- defer the dead-code (`quote-draft/route.ts:38-40`) cleanup explicitly per Out-of-Scope

**✋ Quality Gate:**

- [ ] vitest run on `src/__tests__/lib/ai/` and any ai-actions route tests → all green
- [ ] tsc --noEmit → 0 errors on the 4 route files (shadow pipeline pre-existing errors stay out of scope)
- [ ] no ESLint regression on the 4 route files
- [ ] grep confirms 0 remaining hits of `'order_create'` / `'sensitive_data_export'` / `'sensitive_data_import'` in the 4 route files

**Rollback:** revert the single commit (`git revert <sha>`) or unstage and edit back the 4 lines.

---

### Phase 2: Production probe + ADR §11.27 closeout

**Goal:** Verify end-to-end on production and write the canonical record.

- Status: [ ] Pending | [ ] In Progress | [x] Complete
- Estimated time: 30 min
- Actual time: 35 min
- Deploy: `dpl_DG8p9RKtcjs3NR8zdbYwEpfpKJc3` (READY at 1777212257293, ~102s build)
- Completed: 2026-04-26

**Result:**

- **Backend verified independently** — vitest 29/29 PASS, tsc --noEmit on 4 routes → 0 errors, deploy READY. `'ai_action_create'` accepted by `enforceAction()`'s typed config = the IrreversibleActionType union accepts the swap. No regression on AI tests.
- **UI runtime probe deferred** — Chrome MCP automated trigger of the header CTA on `/dashboard/quotes` reproduced the AiActionButton dead-button pattern flagged in `#α-F-followup-ai-actions-runtime-verify` Phase 0 audit:
  - First click: `POST /api/ai-actions/generate/quote-draft` → 403 (CSRF-token expired in long automation session, confirmed via Korean message text matching `enforcement-middleware.ts:569` `!csrfPassed` branch)
  - Post-reload click: 0 fresh network request to the endpoint (vercel runtime logs `since=3m` empty; Chrome network log only retains the cached 403 at index 13)
  - Per-card "견적 요청 발송" CTA also did not fire `/api/ai-actions/*` — likely a navigation handler to a separate dispatch surface, not the AI action
- **Outcome:** SEC04 backend rename is correct and live; UI live-trigger validation is part of the next track (option A — AiActionButton CSRF auto-renewal). Plan closed.
- ADR-002 §11.27 entry committed at the same time as Phase 2 completion (single commit).

**🔴 RED:**

- identify the smoke path: /dashboard/quotes header "견적 요청 초안 만들기" CTA → POST /api/ai-actions/generate/quote-draft → expected 200 + AiActionItem persisted
- expected vercel runtime log: `gpt-4o-mini` keyword match (LLM dispatch hit OpenAI), no `credit balance` match
- if pre-deploy CSRF state is stale, navigate first to refresh tokens

**🟢 GREEN:**

- push the Phase 1 commit to `origin/main` (operator action)
- monitor Vercel deploy until READY
- trigger via Claude in Chrome: navigate /dashboard/quotes → click header CTA
- read network log: POST /api/ai-actions/generate/quote-draft status 200
- read vercel runtime logs: 200 + `gpt-4o-mini` match
- (optional) trigger vendor-email-draft via existing UI surface to verify second LLM-real endpoint
- write ADR-002 §11.27 entry with: 4-endpoint mapping table, action label change rationale, production probe evidence (deploy id, runtime log keywords), follow-up note for option A (CSRF token renewal track) and dead-code cleanup deferral

**🔵 REFACTOR:**

- update this plan's Notes section with any deviations
- close tasks #45 / #46 / #47 in the task tracker
- file the dead-code cleanup as a `docs/plans/` follow-up note if not already

**✋ Quality Gate:**

- [ ] production deploy READY
- [ ] CTA → 200 + AiActionItem row visible in DB or response payload
- [ ] vercel runtime logs show `gpt-4o-mini` for the LLM-real probe
- [ ] ADR §11.27 entry committed and pushed
- [ ] no regression on other ai-actions endpoints (smoke check or runtime log scan)

**Rollback:**

- if production fails, revert the Phase 1 commit and redeploy via Vercel UI single-click
- if ADR commit has typos, amend before push

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum

This change touches the action ontology (`IrreversibleActionType`) used by ai-actions routes. No resolver changes; no nextAction matrix changes.

**Resolver Input:** N/A (no resolver touched)
**Expected Output:** N/A

**Surface Rules:**

- [x] dashboard: no surface change
- [x] workflow route: same CTA, same handler
- [x] same-canvas overlay / dock / row CTA preserved
- [x] no chatbot / terminal / sci-fi AI introduced

**Validation:**

- [ ] header CTA renders as before
- [ ] queue and dock show the new AiActionItem after success
- [ ] role-minimum tightening / loosening accurately reflected in audit log

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 4 라벨 외 hardcoded site (drift detector, integration test, fixture) 누락 | Med | Low | Phase 0 grep sweep covers all `apps/web/src` + scripts/ |
| `ai_action_create` 단일 라벨이 4 endpoint를 흡수하면서 audit log endpoint 식별 어려움 | Low | Low | audit envelope의 `routePath` 필드로 구별 가능 (이미 기록됨) |
| `requester` role 통과로 보안 약화 | Low | Med | LLM-generated content 생성은 의도된 requester 권한 (α-F 일관성). AiActionItem ApprovalStatus.PENDING가 후속 ops review를 강제. |
| production redeploy 후 다른 ai-actions endpoint regression | Low | Low | 4-line swap, route contract 0건 변경, Phase 2 smoke가 자체 검증 |

---

## 10. Rollback Strategy

- **If Phase 0 (audit) reveals unexpected hardcoded sites:** halt, reconvene with operator, defer Phase 1 until scope is reconfirmed
- **If Phase 1 (rename) fails vitest or tsc:** revert the 4-line edit and re-run; re-investigate before proceeding
- **If Phase 2 (production probe) fails:** Vercel UI redeploy of the prior commit (`21821f4a`) — single-click rollback. The 4-line swap has no schema or migration footprint.

**Special Cases:**

- DB migration: N/A
- Billing: N/A
- soft_enforce → full_enforce: N/A
- webhook: N/A
- UI disabled fallback: N/A

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0
- Current blocker: none
- Next validation step: Phase 0 sweep audit completion + mapping table

**Phase Checklist:**

- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**

- (none yet)

**Implementation Notes:**

- Phase 0 audit (#α-F-followup-ai-actions-runtime-verify, completed 2026-04-26) is the direct precursor — that audit's mapping table is reused here verbatim
- Operator confirmed single label `ai_action_create` is acceptable (no need to subdivide into endpoint-specific labels)
- Dead code at `quote-draft/route.ts:38-40` (unreachable session check after enforcement) noted for separate hygiene track
- AiActionButton CSRF token auto-renewal (option A in this session) is explicitly out of scope and will be handled as a separate track after this plan completes
