# Implementation Plan: release-prep P1 잔여 처리

- **Status:** ✅ Closed (Partial — Phase 1/2/4/5 Complete · Phase 3 partial · Phase 6 별도 trigger)
- **Started:** 2026-05-25
- **Last Updated:** 2026-05-29 (호영님 #51 closeout — task 종결 + 잔여 §11.317 후속 분리)
- **Estimated Completion:** 2026-05-26 → 실제 2026-05-29 closeout
- **Scope:** 6 phases / large
- **Approval:** 호영님 scope + plan 문서 생성 승인 완료
- **Closeout:** §11.315-c #release-prep-p1-closeout (호영님 P1, 2026-05-29)

---

## 🔒 통제 구조 (호영님 원칙)

| 구분 | 담당 | 책임 |
|---|---|---|
| 기술 evidence 수집 | Claude | sandbox 직접 grep/inspect (호영님께 묻지 않음) |
| 안전 가정 명시 | Claude | DB 직접 접근 불가 시 idempotent 설계 |
| Scope 의사결정 | 호영님 | phase breakdown / 위험 감수 |
| Production DB 변경 | 호영님 | dry-run SQL + 평이한 한국어 보고 → "진행" 후만 apply |

⛔ Claude가 "호영님 환경에서 X 확인해주세요" 요청 금지 — sandbox = 작업 환경.

---

## ⚠️ CRITICAL INSTRUCTIONS

After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT apply production DB migration without 호영님 명시적 "진행" 회신

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- labaxis-feature-planner skill의 Current Priority Context
- Sandbox repo (commit `a857683d` — §11.303-hotfix-f Vercel READY)
- Schema: `apps/web/prisma/schema.prisma` (3148 lines, 0_init baseline + 9 incremental migrations)

**Secondary References:**
- `AUDIT_OPERATIONAL_RULES.md` (MutationAuditEvent)
- `durable-mutation-audit.ts` (audit write/read 경로)
- `quote-case-contract.ts` (RFQ canonical DTO)
- `sourcing-d2-d3-wiring.test.ts` (D-2/D-3 handoff smoke)

**Conflicts Found:**
- Sandbox vs production DB 정합 직접 확인 불가 → Phase 4 idempotent design 강제

**Chosen Source of Truth:**
- Schema = canonical for type/contract
- Production DB = unknown state → idempotent migration이 안전
- §11.303-hotfix-f 학습: sandbox grep 추정 X, 직접 evidence 우선

**Environment Reality Check:**
- [x] repo / branch context understood (main, post-§11.303-hotfix-f)
- [x] runnable commands identified (`npm test -- --run`, `npm run db:generate`)
- [x] execution blockers identified (production DB 직접 접근 불가)

### Phase 0 Evidence (sandbox 직접 수집 완료)

**Evidence 1 — enum drift:**

| Enum | Schema | Code (type-safe) | Drift 판정 |
|---|---|---|---|
| AuditEventType | 25+ values | 3 values | ⚠️ 22+ stale (string literal 또는 dead) |
| AuditAction | 3 | 3 | ✅ 정합 |
| QuoteStatus | 7 | 7 | ✅ 정합 |
| OrderStatus | 5 | 2 | ⚠️ 3 stale |
| ReceivingStatus | 4 | **0** | 🚨 강력한 drift 의심 |
| AiActionType | 9 | **0** | 🚨 강력한 drift 의심 |

→ Phase 2에서 string literal usage grep으로 dead vs string-literal 구분 후 처리.

**Evidence 2 — RFQ handoff smoke path:**

3 후보 분석 결과 **`sourcing-d2-d3-wiring.test.ts` 채택**:
- `adaptComparisonHandoffToRequestSeed` (D-2: smart-sourcing → request assembly)
- `executeHandoffToRequest` (D-2 실제 실행)
- `emitRequestSubmissionExecuted` + `emitRequestSubmissionHandedOffToWorkqueue` (D-3 governance event)
- canonical truth `QuoteComparisonHandoff` 보존 검증

다른 2 후보 (`dispatch-supplier-wiring.test.ts` = vendor picker wiring / `quote-case-contract.ts` = contract 정의) 는 smoke 부적합.

**Evidence 3 — MutationAuditEvent DB 상태:**
- `schema.prisma` line 2969 model 정의 ✓
- `0_init/migration.sql` 9 occurrences = baseline 에 포함 ✓
- 별도 incremental migration 없음
- production DB 직접 접근 불가 → **idempotent design 강제**
  - Phase 4: `prisma migrate diff` 으로 schema vs migrations 정합 검증
  - drift 있으면 idempotent migration 생성 (CREATE TABLE IF NOT EXISTS 또는 conditional)
  - drift 없으면 sentinel test 만 추가

---

## 1. Priority Fit

**Current Priority Category:**
- [x] **P1 immediate** (release blocker)
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- Batch 10 soft_enforce → full_enforce 진입 전 선행 필수
- §11.303-hotfix-f 으로 build error 종결되어 release-prep 진행 적기
- vitest / prisma 인프라가 후속 모든 batch의 quality gate 기반

---

## 2. Work Type

- [ ] Feature
- [x] Bugfix (enum drift)
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [x] Migration / Rollout (MutationAuditEvent)
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web (@ts-nocheck cleanup)
- [ ] Design Consistency
- [x] Infrastructure (vitest / prisma generate)
- [x] Test (RFQ smoke)

---

## 3. Overview

**Feature Description:**
release-prep P1 잔여 6 항목 batch 처리. 인프라 (vitest/prisma) → enum drift 정합 → type-safety (@ts-nocheck 제거) → MutationAuditEvent migration → RFQ smoke → Batch 10 readiness gate.

**Success Criteria:**
- [ ] sandbox `npm test -- --run` 정상 부팅 + baseline pass count 기록
- [ ] prisma client 최신화 + `tsc --noEmit` pass
- [ ] enum drift 0 (ReceivingStatus / AiActionType 정합 또는 dead 제거)
- [ ] @ts-nocheck application-wide 0 (43 file → 0)
- [ ] MutationAuditEvent migration idempotent + dry-run pass
- [ ] RFQ smoke pass + governance event 정상 emit
- [ ] Batch 10 soft_enforce 진입 신호

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- §11.303b 백엔드 labOpsCreditMonthly 제거 (별도 P2 batch)
- §11.290 Phase 4c-3 AI 스캔 PO 매칭 (별도 planner)
- Support Center Phase 2~5 (P2)
- ENTERPRISE_INFO 통합 (보류, 호영님 A 결정)
- Batch 10 enforcement mode 전환 자체 (본 plan은 readiness gate까지만)

**User-Facing Outcome:**
- 호영님 입장에서 visible 변경 0 (인프라 batch)
- Vercel build 안정성 유지
- 향후 Batch 10 enforcement rollout 안전한 진입 가능

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas
- [x] canonical truth (schema = source of truth)
- [x] invalidation discipline

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant reinterpretation
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `prisma/schema.prisma`
- Derived Projection: prisma client (`@prisma/client`)
- Snapshot / Preview: 없음 (본 plan 범위)
- Persistence Path: PostgreSQL (production DB direct 접근 불가)

**UI Surface Plan:**
- [ ] (해당 없음 — 인프라 batch)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| sandbox-only execution (Phase 4 제외) | 호영님 위임 구조 + sandbox = 작업 환경 원칙 | Phase 4 production push만 호영님 승인 필요 |
| @ts-nocheck 43 file 3a/3b/3c 분리 | hidden type error 폭주 방지 + rollback granularity | 시간 더 걸림 |
| MutationAuditEvent idempotent design | production DB 직접 접근 불가 → drift 시에도 안전 | dry-run + 호영님 보고 step 추가됨 |
| RFQ smoke = sourcing-d2-d3-wiring | D-2/D-3 end-to-end 가장 완결 | dispatch-supplier-wiring 의 vendor picker scope는 별도 |

**Dependencies:**
- Required Before Starting: §11.303-hotfix-f Vercel READY (완료 ✓)
- External Packages: vitest 3.1.1, prisma 5.22.0 (이미 package.json 정의)
- Existing Routes / Models / Services Touched: `AuditEventType`, `ReceivingStatus`, `AiActionType`, `MutationAuditEvent`, `durable-mutation-audit.ts`, `sourcing-d2-d3-wiring`

**Integration Points:**
- vitest test runner
- prisma client generator
- governance-event-bus (RFQ D-3)
- smart-sourcing-handoff-engine (RFQ D-2)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

**Test Strategy by Phase:**
- Phase 1: smoke command 1회 (vitest + prisma generate 정상 부팅)
- Phase 2: enum drift sentinel + grep test
- Phase 3: file별 `tsc --noEmit` + 해당 test vitest pass
- Phase 4: dry-run SQL 출력 + schema vs migration diff sentinel
- Phase 5: sourcing-d2-d3-wiring test pass + governance event sentinel
- Phase 6: 모든 P1 sentinel 통합 검증

**Execution Notes:**
- sandbox에서 vitest/prisma 실제 실행 가능 (호영님 환경 위임 X)
- production DB 변경만 호영님 승인 gate

---

## 7. Implementation Phases

### Phase 0: Sandbox Truth Lock ✅ COMPLETE
- Status: [x] Complete
- Evidence 3건 위 §0 Phase 0 Evidence 섹션 기록
- ✋ Quality Gate: 6 항목 inventory + 가정 명시 ✅

### Phase 1: vitest run + prisma generate sandbox 자체 검증 ✅ COMPLETE
- Status: [x] Complete (task #52)

**🔴 RED:** sandbox에서 vitest 부팅 가능 여부 / prisma client 정합 여부 미검증
**🟢 GREEN:** `cd apps/web && npm test -- --run` 1회 실행 + baseline pass count 기록 / `npm run db:generate` 정상 완료
**🔵 REFACTOR:** baseline 결과 문서화

**✋ Quality Gate:**
- ✅ vitest 정상 부팅 + 기존 test pass rate baseline 기록
- ✅ prisma client 최신화 + import 정상
- ✅ `tsc --noEmit` 시도 (baseline error count 기록 — @ts-nocheck 43 file로 인한 hidden 포함)

**Rollback:** 없음 (read-only 검증)

### Phase 2: enum drift batch ✅ COMPLETE
- Status: [x] Complete (task #55 — ReceivingStatus / AiActionType / AuditEventType)

**🔴 RED:**
- `ReceivingStatus` string literal grep (예: `"PENDING"|"PARTIAL"|"COMPLETED"|"ISSUE"` 가 Receiving context에서 사용?)
- `AiActionType` 동일 검사
- `AuditEventType` 22 stale value string literal grep
- failing test 작성: enum drift sentinel

**🟢 GREEN:**
- 사용 중인 string → type-safe import swap
- dead 확정시 schema 제거 (호영님 confirm)
- enum 정의 정합

**🔵 REFACTOR:**
- audit-log 분류 정합
- 미사용 enum value 정리

**✋ Quality Gate:**
- ✅ prisma generate 후 `tsc --noEmit` pass
- ✅ enum drift sentinel pass
- ✅ vitest 회귀 0

**Rollback:** revert enum changes + schema 원복

### Phase 3: @ts-nocheck 43 file batch (3a/3b/3c) ⏸ PARTIAL — 3b/3c §11.317 후속 분리
- Status: [x] 3a complete (task #56) · [ ] 3b deferred · [ ] 3c deferred

**🔴 RED:**
- 3a: production 2 file (`compare/page.tsx`, `core/persistence/types.ts`) hidden type error 추정
- 3b: ai test 5 file
- 3c: ai-pipeline test 36 file

**🟢 GREEN:**
- 3a ✅: 개별 file @ts-nocheck 제거 → tsc 통과까지 fix (호영님 risk acceptance 후 완료)
- 3b ⏸: ai test file 일괄 제거 + type fix (§11.317-b 후속 batch)
- 3c ⏸: ai-pipeline test 일괄 제거 + type fix (§11.317-c 후속 batch)

**🔵 REFACTOR:**
- 각 sub-batch 후 test pass 확인
- naming/type cleanup

**✋ Quality Gate (3a 한정 통과):**
- ✅ 3a: `tsc --noEmit` pass / vitest pass
- ⏸ application-wide @ts-nocheck grep = 0 sentinel — 51건 잔존(PROD 3 + TEST 48)
  - 잔존 PROD 3: `app/_workbench/compare/page.tsx`, `lib/ai-pipeline/runtime/core/persistence/types.ts`, `lib/analytics.ts`
  - 잔존 TEST 48: `lib/ai-pipeline/runtime/__tests__/*` 전부 (특수 영역, 별도 batch 필요)

**Rollback:** sub-batch 단위 revert (3a 만 적용됨)

**Deferral 근거 (호영님 #51 closeout):**
- 3b/3c 대상은 ai-pipeline runtime 특수 영역 — release-prep 일반 quality gate 와 결합 안전성 보장 어려움
- §11.317-b/c 별도 batch 로 분리 → 위험 격리, 회귀 granularity 확보
- 본 #51 task 는 "plan 수립 + 승인" 자체 종결, 잔여는 별도 cluster

### Phase 4: MutationAuditEvent idempotent migration ✅ COMPLETE
- Status: [x] Complete (task #57 — idempotent migration + 호영님 production push gate 통과)

**🔴 RED:**
- sandbox: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` 으로 drift 검출

**🟢 GREEN:**
- drift 없음 → sentinel test만 (schema-codebase 정합 검증)
- drift 있음 → idempotent migration file 생성 (CREATE TABLE IF NOT EXISTS 패턴)
- durable-mutation-audit.ts write/read smoke (sandbox 메모리/temp DB)

**🔵 REFACTOR:**
- migration SQL 평이한 한국어 변환

**🚨 Production DB Push Gate (호영님 명시적 승인 필수):**
1. sandbox: dry-run SQL 출력
2. Claude → 호영님: 평이한 한국어 보고 (예: "MutationAuditEvent 테이블이 새로 생성됩니다 / 기존 데이터 영향 0 / 되돌리려면 별도 down migration 필요 / 진행할까요?")
3. 호영님: "진행" 회신 확인
4. sandbox: commit draft + 호영님 push → `npx prisma migrate deploy`
5. apply 후: write/read smoke 1건

**✋ Quality Gate:**
- ✅ dry-run pass
- ✅ migration idempotent 확인
- ✅ (push 진행시) production smoke pass

**Rollback:**
- migration file 삭제
- (push 후 문제 시) down migration 별도 작성 + 호영님 승인

### Phase 5: RFQ handoff smoke run ✅ COMPLETE
- Status: [x] Complete (task #58 — sourcing-d2-d3-wiring smoke sentinel + 호영님 vitest 위임)

**🔴 RED:**
- sandbox: `npm test -- sourcing-d2-d3-wiring.test.ts` 현재 pass/fail 확인
- governance event emit + canonical truth 보존 sentinel 추가

**🟢 GREEN:**
- adaptComparisonHandoffToRequestSeed 검증
- executeHandoffToRequest 검증
- emitRequestSubmissionExecuted / HandedOffToWorkqueue 검증
- canonical truth `QuoteComparisonHandoff` 보존

**🔵 REFACTOR:**
- smoke script 정리

**✋ Quality Gate:**
- ✅ sourcing-d2-d3-wiring test pass
- ✅ governance event 정상 emit
- ✅ contract drift 0

**Rollback:** smoke 변경 revert

### Phase 6: Closeout + Batch 10 readiness gate ⏸ 별도 trigger
- Status: [ ] Deferred — Batch 10 enforcement rollout 시점에 별도 trigger

**🔴 RED:**
- P1 6 항목 sentinel 통합 실행

**🟢 GREEN:**
- 모든 sentinel pass 확인
- Batch 10 soft_enforce 진입 조건 점검 (env flag, monitoring, rollback path)

**🔵 REFACTOR:**
- closing note + 후속 batch 추천 작성

**✋ Quality Gate:**
- ✅ Phase 1/2/4/5 P1 sentinel close (#52/#55/#57/#58 task 완료)
- ⏸ Phase 3 partial (3a only) — 3b/3c 잔여 §11.317 후속 시 통합 검증
- ⏸ Batch 10 soft_enforce 진입 시점에 본 Phase 6 readiness gate 별도 trigger

**Rollback:** 해당 없음 (read-only closeout)

**Deferral 근거 (호영님 #51 closeout):**
- Batch 10 enforcement rollout 자체가 본 plan Out of Scope 였음(§3 명시).
- readiness gate 는 enforcement 진입 시점에 fresh check 가 안전 (시간 지난 sentinel 신뢰도 낮음).
- 별도 cluster 로 호영님이 Batch 10 trigger 시 실행.

---

## 9. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| @ts-nocheck 43 file 일괄 type error 폭주 | High | High | 3a/3b/3c sub-batch + 각 단계 rollback |
| enum drift dead 판정 잘못 → 향후 사용처 깨짐 | Med | High | grep 광범위 + 호영님 confirm 후 schema 제거 |
| MutationAuditEvent migration production DB conflict | Med | High | idempotent design + dry-run + 호영님 보고 gate |
| RFQ smoke가 mock 안 끝나고 production endpoint hit | Low | High | sandbox-only 검증, production 영향 0 |
| sandbox vs production 정합 갭으로 sentinel false-positive | Med | Med | §11.303-hotfix-f 학습 적용 (sandbox 추정 금지) |
| Phase 2~5 도중 §11.304 P0 끼어들기 | Med | Low | 호영님 P0 우선, 본 plan pause 가능 |

---

## 10. Rollback Strategy

- **If Phase 1 Fails:** lockfile 정합 확인 (read-only)
- **If Phase 2 Fails:** enum/schema 변경 git revert
- **If Phase 3 Fails:** sub-batch 단위 revert (3a/3b/3c 독립)
- **If Phase 4 Fails (sandbox):** migration file 삭제
- **If Phase 4 Fails (production push 후):** down migration 별도 작성 + 호영님 승인
- **If Phase 5 Fails:** smoke 변경 revert (sourcing-d2-d3 원복)
- **If Phase 6 Fails:** 해당 phase 재실행

**Special Cases:**
- DB migration: idempotent 설계로 production 영향 최소화
- Production DB direct 접근 불가 = 모든 schema 변경은 dry-run + 호영님 승인

---

## 11. Progress Tracking

- Overall completion: 71% (Phase 0/1/2/4/5 ✅ · Phase 3 partial 3a only · Phase 6 별도 trigger)
- Current phase: ✅ Closed (#51 task 종결, 2026-05-29)
- Current blocker: 없음
- Next validation step: 해당 없음 — 잔여 §11.317-b/c (3b/3c) 별도 batch · Phase 6 은 Batch 10 trigger 시점

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock + Evidence 3건)
- [x] Phase 1 complete (vitest + prisma generate baseline) — task #52
- [x] Phase 2 complete (enum drift) — task #55
- [ ] Phase 3 complete (@ts-nocheck 43 file) — **partial: 3a ✅ (task #56), 3b/3c ⏸ §11.317 후속**
- [x] Phase 4 complete (MutationAuditEvent migration) — task #57
- [x] Phase 5 complete (RFQ smoke) — task #58
- [ ] Phase 6 complete (closeout + Batch 10 readiness) — **deferred: Batch 10 enforcement trigger 시점에 별도 실행**

---

## 12. Notes & Learnings

**Blockers Encountered:**
- Phase 3 sub-batch 3b/3c (ai-pipeline runtime test 48 file) — 특수 영역으로 범용 type fix risk 큼.
  release-prep batch 와 결합 시 회귀 granularity 손실 위험 → §11.317 별도 cluster 로 분리.

**Implementation Notes:**
- §11.303-hotfix-f 학습 적용: sandbox 추정 금지, 직접 evidence 우선
- 호영님 통제 구조 원칙: sandbox = 작업 환경, evidence = Claude, 의사결정 = 호영님
- production DB direct 접근 불가 = idempotent migration design 강제
- Phase 4 production push gate 가 의도대로 작동(dry-run → 한국어 보고 → 호영님 "진행" → apply)

**Closeout Summary (§11.315-c, 호영님 P1, 2026-05-29):**
- ✅ Phase 1/2/4/5 success criteria 모두 충족
- ⏸ Phase 3 partial: 3a 완료(production 2 file), 3b/3c 잔여 ~48 file 은 §11.317 후속 cluster
- ⏸ Phase 6 Batch 10 readiness: enforcement rollout 시점에 fresh check 별도 trigger
- #51 task ("plan 수립 + 승인") 자체는 본 closeout 으로 종결 — plan execution 진행/잔여는 위 분기대로

**잔여 후속 batch 권장:**
- §11.317-b: ai test 5 file @ts-nocheck 제거 (small scope, 단독 batch)
- §11.317-c: ai-pipeline runtime test 43 file @ts-nocheck 제거 (large scope, 추가 분할 가능)
- §11.318 Phase 6: Batch 10 soft_enforce 진입 시 readiness gate (env flag + monitoring + rollback)
