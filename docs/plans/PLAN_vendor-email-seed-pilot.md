# Implementation Plan: #vendor-email-seed-pilot (B1 — id prefix 분기)

- **Status:** ✅ Complete (Phase 0~2 sandbox land, Phase 3 verify 호영님 push + DB seed update 후)
- **Started:** 2026-05-08
- **Last Updated:** 2026-05-08
- **Estimated Completion:** 2026-05-08 (~1.5h actual)

⛔ DO NOT modify Vendor / Quote / VendorRequest Prisma schema (B1 path = id prefix 분기, schema 변경 0)
⛔ DO NOT enable real SMTP send for pilot vendors (design intent — "no real outbound mail")
⛔ DO NOT use real vendor domain (RFC 2606 `.invalid` TLD only — labaxis.invalid)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/scripts/pilot/pilot.ts:237` — pilot vendor `email: null` (intentional placeholder, comment: "pilot tenant only, no real outbound mail").
- `apps/web/src/lib/email/sender.ts:33-70` — `sendEmail` 이 production 에서도 stub (console.log only, TODO: real SMTP integration).
- `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts:127-184` — vendor 별 VendorRequest record 생성 + sendEmail try/catch graceful.
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts:88` — `if (!vendor?.email) continue` — supplier_book source 가 email null 시 skip → preflight hardBlocked.
- §11.217 Phase 3 cluster + #supplier-resolution-quote-vendor-email cluster (commit f0ce2df1) — server forward chain 정합. 남은 issue = pilot vendor email null.

**Secondary References:**
- Schema: `Vendor.email: String?` (schema.prisma:305 — nullable).
- Pilot vendor ID convention: `vendor-pilot-thermofisher` (scripts/pilot/pilot.ts:234) — explicit ID, cuid auto-generation 과 충돌 0.

**Conflicts Found:**
- 충돌 0. design intent ("no real outbound mail") 보호 + Vendor.email seed 채워서 preflight 통과 가능.

**Chosen Source of Truth:**
- B1 path — `Vendor.id` prefix `vendor-pilot-` 분기 (`isVendorPilot(id)` helper).
- pilot vendor email = RFC 2606 `.invalid` placeholder (`pilot+<vendor-slug>@labaxis.invalid`) — preflight 통과 + SMTP 자동 fail (실제 도메인 0).
- `sendEmail` 호출 전 helper 로 분기 — pilot 이면 SMTP skip + audit-only.
- Schema 변경 0 / migration 0.

**Environment Reality Check:**
- [x] repo / branch context: main, working dir.
- [x] runnable commands: vitest run, tsc --noEmit, Chrome smoke.
- [x] execution blockers: production DB Vendor row 의 email update 는 호영님 host 측 (sandbox 측 production DB 권한 0).

---

## 1. Priority Fit

**Current Priority Category:**
- [x] **P2 / Deferred — operator productivity** (#supplier-resolution cluster 후속, batch dispatch flow 활성화)

**Why This Priority:**
- §11.217 Phase 3 batch dispatch UI + #supplier-resolution forward chain 모두 정합. 남은 layer = pilot vendor email null.
- Schema 변경 0, server logic 변경 minimal.
- Future-proof — 향후 sendEmail real SMTP 전환 시 pilot vendor 자동 보호.

---

## 2. Work Type

- [x] **Feature / Bugfix** (sendEmail 분기 + seed update)
- [x] **Web** (mobile 분기 0, server-only)

---

## 3. Overview

**Feature Description:**
pilot vendor 의 Vendor.email 을 RFC 2606 `.invalid` placeholder 로 채워 preflight 통과 가능하게 함. `sendEmail` helper 가 vendorId 받아 pilot prefix 인지 분기 — pilot 이면 SMTP skip + audit-only console.log + return success. design intent ("no real outbound mail") 그대로 보호 + batch dispatch UI flow 검증 가능.

**Success Criteria:**
- [ ] `isVendorPilot(id)` helper — `id.startsWith("vendor-pilot-")` 정확 매칭.
- [ ] `sendEmail({ to, vendorId })` 가 pilot vendor 면 SMTP skip + audit log + return.
- [ ] `vendor-requests/route.ts` 의 sendEmail call 에 vendor.id forward.
- [ ] `pilot.ts` 의 PILOT_VENDOR_CATALOG email 을 `pilot+<slug>@labaxis.invalid` 로 swap.
- [ ] vitest sweep — 새 test PASS + 기존 test 0 fail.
- [ ] tsc 0 new error.
- [ ] Chrome smoke — pilot quote 의 batch action bar "발송 가능 1건 / 보류 0건" 표시 + sheet open + 발송 button 활성화 + toast 성공.

**Out of Scope:**
- [ ] Vendor schema 변경 (B2 path — `dispatchMode` enum, 별도 트랙).
- [ ] real SMTP integration (sendEmail 자체 stub 그대로 유지).
- [ ] mobile dispatch flow.
- [ ] `#vendor-master-seed-from-search` (search → compare 의 vendor 자동 등록 — 별도 트랙).

**User-Facing Outcome:**
pilot quote 1건 선택 → action bar "발송 가능 1건" 표시 → "검토 시작" → sheet → "전체 발송" → toast "1건 발송 완료" (실제 SMTP skip + DB record 생성). KPI "발송 대기" → "회신 추적" 반영.

---

## 4. Product Constraints

**Must Preserve:**
- [x] design intent — "no real outbound mail" (pilot vendor SMTP skip 보장).
- [x] canonical truth — Vendor.email 채우지만 fake `.invalid` domain → real outbound 0 보장 다중화.
- [x] same-canvas — 견적 관리 surface 그대로.
- [x] dead-button 0 — pilot dispatch 도 정상 toast + DB record.

**Must Not Introduce:**
- [x] real vendor domain (`thermofisher.com` 등) — RFC 2606 `.invalid` 만.
- [x] schema migration / DB column 추가.
- [x] server-side feature flag / ENV 분기 (id prefix 가 source of truth).
- [x] sendEmail 의 production SMTP enablement (stub 그대로).

**Canonical Truth Boundary:**
- **Source of Truth:** Vendor.id (pilot prefix 분기) + Vendor.email (placeholder).
- **Derived Projection:** resolveSuppliers 의 ResolvedSupplier (UI 표시용, email 보유).
- **Snapshot / Preview:** sheet 안 supplier preview.
- **Persistence Path:** sendEmail 의 SMTP skip + VendorRequest record (DB) 그대로 생성.

**UI Surface Plan:**
- 변경 없음 (server + seed only). UI 효과는 Vendor.email 채워진 후 자연 활성화.

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **`isVendorPilot(id)` id prefix 분기** | Schema 변경 0, ID convention 활용. cuid()와 충돌 0. | 향후 user-input vendor 가 `vendor-pilot-*` prefix 안 쓰는 한 안전. |
| **`.invalid` TLD placeholder** | RFC 2606 가 정의한 fake domain — SMTP 자동 fail, 실제 발송 0. | 향후 real SMTP 전환 시에도 보호 (DNS resolve 0). |
| **`sendEmail` 에 vendorId optional param** | minimal-diff signature 확장. 기존 caller 영향 0 (param optional). | caller (vendor-requests route) 가 vendor.id forward 해야 함. |
| **seed update via pilot.ts source 변경** | re-run pilot seed script 시 자동 적용. idempotent (cuid 의 prefix 패턴 그대로). | production DB row update 는 호영님 host 측 직접 실행. |

**Dependencies:**
- Required Before Starting: #supplier-resolution-quote-vendor-email cluster close (commit f0ce2df1 land).
- External Packages: 0.
- Existing Routes / Models / Services Touched:
  - `apps/web/src/lib/email/sender.ts` (modified — vendorId param + pilot 분기).
  - `apps/web/src/lib/email/pilot-vendor.ts` (NEW — helper).
  - `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` (modified — vendor.id forward).
  - `apps/web/scripts/pilot/pilot.ts` (modified — PILOT_VENDOR_CATALOG email update).

**Integration Points:**
- new helper file (~30 line).
- 3 new test files (~50 line each).
- 3 modified files (sendEmail + route + seed).

---

## 6. Global Test Strategy

- **Phase 1 RED:** helper logic + route forward + seed pattern 검증 (source-level + light unit).
- **Phase 2 GREEN:** helper + sendEmail 분기 + route caller + seed swap.
- **Phase 3 verify:** sandbox vitest + tsc + production DB seed re-run 또는 raw SQL update + Chrome smoke.

---

## 7. Implementation Phases

### Phase 0 — Truth Lock + Plan ✅
**Goal:** audit + 호영님 승인 + plan 생성.
- Status: [x] Complete

---

### Phase 1 — RED test
**Goal:** 3 source-level + unit test 작성 (모두 fail).
- Status: [ ] Pending

**🔴 RED:**
- [ ] `apps/web/src/__tests__/lib/email/pilot-vendor.test.ts` (NEW) — `isVendorPilot` 동작 검증.
- [ ] `apps/web/src/__tests__/api/quotes/vendor-requests-pilot-dry-run.test.ts` (NEW) — source-level: route 가 vendor.id forward + sendEmail signature 변경.
- [ ] `apps/web/src/__tests__/scripts/pilot/pilot-vendor-email-seed.test.ts` (NEW) — PILOT_VENDOR_CATALOG email 의 `.invalid` 패턴.

**🟢 GREEN:** none (test fail).

**✋ Quality Gate:** test fail 정합.

**Rollback:** revert.

---

### Phase 2 — GREEN: helper + sendEmail 분기 + route forward + seed
**Goal:** 4 file 변경 → test PASS.
- Status: [ ] Pending

**🟢 GREEN:**
- [ ] `apps/web/src/lib/email/pilot-vendor.ts` (NEW) — `isVendorPilot(id)` + `PILOT_VENDOR_ID_PREFIX` constant.
- [ ] `apps/web/src/lib/email/sender.ts` — `sendEmail` 에 `vendorId?: string` optional param + pilot 분기 (SMTP skip + audit log).
- [ ] `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` — sendEmail call site 에 vendorId forward (vendor object 의 어디서 vendor.id 가져올지 — 현재 vendors zod schema 에 id 없음, 추가 필요).
- [ ] `apps/web/scripts/pilot/pilot.ts` — PILOT_VENDOR_CATALOG email 을 `pilot+thermofisher@labaxis.invalid` 등으로 swap.

**🔵 REFACTOR:** sendEmail signature 의 vendorId optional 명시 + caller diversity 정합 (resend / verification email 등 다른 caller 영향 0 확인).

**✋ Quality Gate:**
- [ ] vitest 새 test PASS + 기존 test 0 fail.
- [ ] tsc 0 new error on touched files.
- [ ] sendEmail 의 다른 caller (auth verification 등) 영향 0 (vendorId optional).

**Rollback:** `git revert`.

---

### Phase 3 — Production seed update + Chrome smoke + ADR
**Goal:** production DB 의 Vendor row email update + 호영님 host commit + push + Chrome smoke.
- Status: [ ] Pending

**🔴 RED:** Chrome smoke scenario — pilot quote 1건 선택 → action bar "발송 가능 1건" 표시 확인 + sheet open + 발송 → toast 성공.

**🟢 GREEN:**
- [ ] sandbox vitest sweep + tsc.
- [ ] 호영님 host commit + push + Vercel deploy.
- [ ] **Production seed update — host 측 결정:**
  - Path A — `npx tsx apps/web/scripts/pilot/pilot.ts` re-run (idempotent upsert).
  - Path B — raw SQL: `UPDATE "Vendor" SET email = 'pilot+thermofisher@labaxis.invalid' WHERE id = 'vendor-pilot-thermofisher';`.
- [ ] Chrome smoke — pilot quote dispatch full flow 검증.
- [ ] ADR entry append + plan Status: Complete.

**🔵 REFACTOR:** ADR 의 Out of Scope (B2 path / real SMTP / mobile / vendor-master-seed-from-search) 명시 + Lessons.

**✋ Quality Gate:**
- [ ] Chrome smoke "발송 가능 N건" 활성화 + 발송 toast 성공 + console error 0.
- [ ] vitest sweep + tsc.

**Rollback:** `git revert <SHA>` + production DB 의 Vendor.email = null 복구.

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **sendEmail signature 변경 — 다른 caller 영향** | Med | Med | vendorId optional param + 모든 caller grep 후 backward compat 확인. |
| **`vendors` zod schema 에 id 없어 forward 불가** | High | Med | route 의 sendEmail call 에서 quote.items[].product.vendors 에서 매칭하거나, vendors zod schema 에 id 추가. |
| **`.invalid` domain 의 SMTP 시도 성능** | Low | Low | sendEmail stub 이라 실제 SMTP 시도 0. 향후 real SMTP 전환 시에도 fast fail. |
| **production DB seed update 안전성** | Low | High | idempotent upsert (pilot.ts) 또는 single UPDATE WHERE id = ... 안전. backup 가능. |
| **다른 vendor (non-pilot) 가 `vendor-pilot-` prefix 충돌** | Very Low | High | cuid() 자동 생성은 random, prefix 충돌 0. user-input 시 explicit ID 차단 (route schema 검증). |

---

## 9. Rollback Strategy

- If Phase 1 fails: revert test files.
- If Phase 2 fails: revert helper + sendEmail + route + seed (4 files).
- If Phase 3 fails: revert production seed update (Vendor.email = null) + git revert.

**Special:** schema 변경 0, migration 0 → rollback 단순.

---

## 10. Progress Tracking

- **Overall completion:** 25% (Phase 0 complete, Phase 1 진입)
- **Current phase:** Phase 1 (RED test)

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (RED 7/11 fail 확인)
- [x] Phase 2 complete (GREEN — RED 17/17 PASS + 기존 supplier-resolution 9/9 = 26/26 + tsc 0 new error)
- [ ] Phase 3 complete (호영님 host commit + push + production seed update + Chrome smoke)

---

## 11. Notes & Learnings

**Architectural Decisions (from approval round):**
- B1 path — id prefix 분기 (호영님 승인).
- design intent ("no real outbound mail") 보호 + RFC 2606 `.invalid` placeholder.
- production DB seed update 방법 — Phase 3 진입 시 호영님 결정 (host 측 직접).
