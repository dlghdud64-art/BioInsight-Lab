# Implementation Plan: Supabase Store Cleanup (#supabase-store-stale-errors)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-03
- **Last Updated:** 2026-05-03
- **Estimated Completion:** 2026-05-03 (3-4h)
- **Selected Scope:** Option **C** (Quick Silence, 2 phases)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce silent fake success / fake fallback array
⛔ DO NOT cause §11.199-class store state stuck regression

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- HEAD `6f90868b` (§11.193d Phase 3 cleanup) — 모든 prod 회수 deploy 됨.
- Chrome MCP 검증 (호영님 Pilot Internal Org 계정): dashboard / settings / organizations 정상 진입. console 에 다수 supabase errors 잔존 (`[budget-store] / [order-queue-store] Supabase 조회 실패, public.budgets / public.order_queue table 부재`).
- `lib/supabase.ts`: env 있으면 client 생성, 없으면 noop. supabase Postgres alive 하지만 Prisma 가 다른 table 이름 사용 → table not found.
- `prisma/schema.prisma`: `model Budget` (line 853), `model Order` (line 1514). Prisma = canonical.
- §11.199b lesson: store initial `isFetching=true` 가 dashboard P0 stuck 원인 → page.tsx 에서 store 의존 회수.

**Secondary References:**
- `lib/store/budget-store.ts` (409 line, supabase 5+ sites at line 14, 230, 270, 275, 352, 372, 395)
- `lib/store/order-queue-store.ts` (381 line)
- 15 caller files (executive-summary-section / action-ledger / command-palette / budget/page / fast-track-store 등)
- `__tests__/lib/supabase-noop.test.ts` (이미 wired noop test)

**Conflicts Found:**
- store 가 supabase realtime channel + auth + table query 까지 사용 — single noop 으로 가릴 수 없음.
- §11.199b 가 dashboard 에서 store 회수했지만 다른 caller 는 미처리.
- 호영님 메인 계정에 Pilot Internal Org 1개 존재 — Prisma `/api/budgets` 응답 정상 가능 (호영님 수동 확인 필요).

**Chosen Source of Truth:**
- **Prisma Budget / Order = canonical** (long-term). Supabase store = legacy.
- 본 batch 는 **console silence 만** — canonical migration 은 §11.199c (defer).

**Environment Reality Check:**
- [x] vitest / tsc 가능
- [ ] `.git` readonly (호영님 commit/push)
- [x] Chrome MCP prod 검증 가능

---

## 1. Priority Fit

- [x] **Post-release / Stabilization**
- [ ] P1 / Release blocker / P2 deferred 아님

console 정합 + store state 안정화. §11.199b 의 dashboard P0 회복 후 cluster cleanup.

---

## 2. Work Type

- [x] Bugfix (console error silence)
- [x] API Slimming (Phase 1 의 try-catch wrap = error path slim)
- [ ] Feature / Migration / Billing / Mobile / Workflow

---

## 3. Overview

**Feature Description:**
budget-store + order-queue-store 의 supabase table query 가 dead table (`public.budgets` / `public.order_queue`) 로 인해 console errors 발생. graceful try-catch wrap + dead-table-specific silence 로 console 청결화. canonical migration (Prisma /api swap) 은 별도 트랙 defer.

**Success Criteria:**
- [ ] dashboard 진입 시 console errors 0 (`[budget-store]` / `[order-queue-store]` patterns)
- [ ] store 의 동작 보존 (initial isFetching state + fallback empty array)
- [ ] §11.199 회귀 0 (dashboard stuck 재발 안 함)
- [ ] vitest + tsc PASS

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] supabase 호출 → Prisma `/api/budgets` swap (§11.199c 트랙)
- [ ] store 자체 dead-code 회수 (caller 검증 필요, 별도 트랙)
- [ ] silent fake success (data 있는 척 array fallback) — graceful empty 만

**User-Facing Outcome:**
- DevTools console 깨끗해짐 (에러 다수 → 0)
- prod 동작 변경 0 (이미 graceful degrade 였음, error log 만 silent)

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth (Prisma) 보호 — supabase 가 truth 로 활동 못 하도록
- [x] workbench/queue/rail/dock — store 회수 0 (Phase 1 한정)
- [x] §11.199b dashboard 회수 정합 — page.tsx 의 store 의존 0 유지
- [x] invalidation discipline — store 의 internal state machine 변경 0

**Must Not Introduce:**
- [x] silent fake success — store 가 데이터 있는 척 0
- [x] fake fallback array — 실제 데이터 없으면 빈 array + UI 의 empty state 발화
- [x] page-per-feature
- [x] §11.199-class store state stuck (initial isFetching=true → false reset 명시)

**Canonical Truth Boundary:**
- Source of Truth: Prisma `Budget` / `Order` (이미 alive — `/api/budgets` / `/api/orders`)
- Derived Projection: `/api/budgets` 응답 (이미 caller 들이 sometimes 사용)
- Snapshot/Preview: store internal state (`isFetching` / `data`) — 본 batch 변경 0
- Persistence: Prisma `db.budget.*` / `db.order.*` (이미 wired)

**UI Surface Plan:**
- [x] Existing route section (변경 없음, 본 batch 는 internal store cleanup)
- [ ] New page

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Try-catch wrap + dead-table-specific silence | console clean + store 동작 보존 + canonical truth 보호 (silent fake success 0) | long-term migration 미루는 것 (§11.199c defer) |
| `error.code === '42P01'` (Postgres "undefined_table") 또는 message 패턴 매칭 시 silence | dead table 만 silence — 다른 supabase error (auth fail / network / RLS) 는 여전히 console.warn 유지 | error code 표준화 의존 |
| store internal state machine 변경 0 | §11.199 회귀 차단 | dashboard P0 회복 정합 보존 |

**Dependencies:**
- Required Before Starting: §11.199b deploy 완료 (확인 — dashboard 정상 진입)
- External Packages: 없음
- Existing Files Touched:
  - `lib/store/budget-store.ts` (try-catch wrap)
  - `lib/store/order-queue-store.ts` (try-catch wrap)
  - 가능 시 helper 추출 `lib/store/supabase-error-helpers.ts` (DRY)

**Integration Points:**
- store 의 `fetch*` async functions 안의 supabase 호출
- store 의 realtime channel subscribe (channel 도 fail 가능)

---

## 6. Global Test Strategy

- Phase 0: read-only audit (no test)
- Phase 1: source-level smoke (try-catch wiring 강제) + caller 회귀 0 확인 (vitest)

**Execution Notes:**
- vitest + tsc 가능
- Chrome prod 검증 가능 (deploy 후)

---

## 7. Implementation Phases

### Phase 0: Truth Lock + Supabase Site Audit (1h)

**Goal:** budget-store + order-queue-store 의 supabase 호출 site 정확히 list + caller 영향 매트릭스.

- Status: [ ] Pending | [x] In Progress | [ ] Complete

**🔴 RED:** supabase site 6+ 식별 (budget-store), order-queue-store similar. caller 15 file 영향 추정.

**🟢 GREEN:**
- supabase 호출 site list 작성 (file:line)
- 각 site 의 error path (현재 console.error 위치)
- realtime channel subscribe 위치
- caller 가 store 의 어떤 method 호출하는지 (영향 매트릭스)

**🔵 REFACTOR:** Phase 1 의 try-catch wrap 위치 + dead-table silence 패턴 결정.

**✋ Quality Gate:**
- [ ] supabase site 모든 위치 list (file:line:method)
- [ ] caller 영향 매트릭스 (15 caller × store method)
- [ ] dead-table error code/message 패턴 식별 (Postgres 42P01 또는 supabase 응답 형식)

**Rollback:** read-only, code 변경 0

---

### Phase 1: Graceful Try-Catch Wrap + Console 정합 (1.5-2h)

**Goal:** supabase 호출 site 모두 try-catch 보호 + dead-table silence + 다른 error 는 console.warn 유지.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- `__tests__/lib/store/supabase-error-helpers.test.ts` 신규
- helper `isSupabaseDeadTableError(error)` 가 42P01 + "Could not find the table" 패턴 매칭
- `logSupabaseSilently(error, label)` 가 dead-table → silent, 다른 → console.warn(label, error.message)
- failing test 작성 (helper 부재 시 fail)

**🟢 GREEN:**
- `lib/store/supabase-error-helpers.ts` 신규 (~50 line)
- budget-store.ts 의 supabase 호출 6+ site 모두 try-catch wrap + helper 호출
- order-queue-store.ts 동일 패턴 적용
- store internal state (`isFetching`) 는 finally 블록에서 reset 강제 (§11.199 회귀 차단)

**🔵 REFACTOR:**
- helper 추출 정합 (DRY)
- 주석 ("§11.199 lesson — store state stuck 차단" / "canonical truth: Prisma /api/budgets, supabase 는 legacy")

**✋ Quality Gate:**
- [ ] vitest PASS (helper test + 기존 store test 회귀 0)
- [ ] tsc 0 errors
- [ ] Chrome prod 검증: dashboard / budget page / inbox 진입 시 console errors 0
- [ ] §11.199 회귀 0 (dashboard 정상 진입 + 카드 reveal)
- [ ] silent fake success 0 (data 못 가져오면 store 의 fallback empty 유지)

**Rollback:** git revert <SHA> (3 file 단위 isolated)

---

## 8. (Optional Addenda 미적용)

본 batch 는 ontology / billing / migration / mobile 영역 무관.

---

## 9. Risk Assessment

| Risk | 확률 | 영향 | 완화 |
| :--- | :--- | :--- | :--- |
| try-catch wrap 시 store state 가 §11.199 stuck 회귀 | Med | High | initial state 변경 0 + finally 에서 isFetching=false reset 강제 |
| supabase realtime channel error 가 또 console pollution | Med | Low | channel subscribe 도 try-catch wrap. error 시 silent unsub |
| dead-table error code 가 42P01 외 다른 값 | Low | Low | Phase 0 에서 actual error response 캡처 + 패턴 매칭 정합 |
| §11.199c (Prisma migration) 트랙 defer 가 잊혀짐 | Low | Low | ADR 에 명시 + Out of scope 트랙 표시 |

---

## 10. Rollback Strategy

- **If Phase 0 Fails:** read-only, no rollback 필요
- **If Phase 1 Fails:** git revert <SHA> (3 file: 2 store + 1 helper). store 동작 변경 0 → 회귀 영향 0

**Special Cases:**
- §11.199 회귀 시: dashboard 진입 stuck 발생 → 즉시 revert
- 다른 caller 에서 try-catch 가 swallow 한 error 가 critical → console.warn 으로 surface

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0
- Current blocker: 없음
- Next validation step: Phase 0 audit 결과 보고

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (TBD)

**Implementation Notes:**
- §11.199b 의 dashboard 회수 정합 보존 — page.tsx 의 store 의존 0 유지
- canonical migration (Supabase → Prisma) 은 §11.199c 별도 트랙
- 본 batch 는 console silence 만 — long-term store dead-code 회수는 caller 검증 필요 (medium scope)
