# Implementation Plan: Prisma Enum Drift + MutationAuditEvent Migration

- **Status:** 🔄 In Progress
- **Started:** 2026-04-18
- **Last Updated:** 2026-04-18
- **Estimated Completion:** 2026-04-20

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT touch Prisma schema 의미 — enum drift 는 DB ↔ schema 동기화만

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/prisma/schema.prisma` (main branch, HEAD=a506bb60) — 35 enums, 90 models
- `apps/web/prisma/migrations/` (main branch) — 4 migrations:
  - `0_init/migration.sql` (35 `CREATE TYPE`, 89 `CREATE TABLE`)
  - `20260417120000_add_workspace_organization_id_nullable/`
  - `20260417120100_workspace_organization_id_unique_not_null/`
  - `20260418120000_add_stripe_event_dedupe/`
- `docs/plans/PLAN_test-runner-and-prisma-stabilization.md` — enum drift + MutationAuditEvent smoke를 별도 plan으로 명시 위임

**Secondary References:**
- `apps/web/src/lib/audit/durable-mutation-audit.ts` (runtime 사용처)
- `apps/web/src/lib/audit/__tests__/durable-mutation-audit-contract.mjs`
- `apps/web/src/lib/audit/AUDIT_OPERATIONAL_RULES.md`
- 0_init enum values (35개): UserRole, OrganizationRole, TeamRole, PurchaseRequestStatus, SubscriptionPlan, ProductCategory, QuoteStatus, ReceivingStatus, InspectionResult, ImportJobStatus, WorkspacePlan, WorkspaceMemberRole, BillingStatus, InvoiceStatus, ActivityType, AuditEventType, InboundEmailStatus, VendorRequestStatus, OrderStatus, AuditAction, AuditEntityType, IngestionSourceType, DocumentType, VerificationStatus, IngestionTaskType, IngestionAuditAction, AiActionType, AiActionStatus, AiActionPriority, TaskStatus, ApprovalStatus, CanaryStage, ProcessingPath, FallbackReason, StabilizationLockTarget

**Conflicts Found (Phase 0 완료 후 업데이트):**
- ❌ **schema ↔ migrations drift: 0건** — 2026-04-18 샌드박스 파이썬 diff 결과:
  - schema 35 enums × 모든 값 = 0_init 35 CREATE TYPE 값과 **완전 일치**
  - schema 90 models = 0_init 89 CREATE TABLE + `20260418120000_add_stripe_event_dedupe`의 `StripeEvent` 1개 = **누적 90개 완전 일치**
  - `MutationAuditEvent` 는 `apps/web/prisma/migrations/0_init/migration.sql:1705` 에 이미 CREATE TABLE 되어 있음 (초기 가정이 틀렸음)
  - 후속 3 migration에 `ALTER TYPE ADD VALUE` 0건 (필요 없음 — drift 없음)
- 🟡 **남은 불확실성:** live Supabase DB ↔ migration trail 정합성 — 샌드박스에서 확인 불가(binaries.prisma.sh 403), 사장님 로컬 introspection으로만 확정 가능.

**Chosen Source of Truth:**
- **`schema.prisma` = intent (what we want)**
- **`migrations/*` 누적 합계 = DB reality baseline (what has actually been deployed)**
- live DB 실체는 사장님 로컬 `prisma db pull` / Supabase introspection으로만 확인 가능 (샌드박스에서는 binaries.prisma.sh 403). 본 plan은 schema ↔ migrations 누적합 기준 drift를 우선 제거하고, live DB 반영은 Vercel `prisma migrate deploy` 로 해결한다.

**Environment Reality Check:**
- [x] repo: `/sessions/happy-epic-rubin/worktree/labaxis`, branch: `main`, HEAD: `a506bb60`
- [x] runnable commands identified:
  - Grep/Read: enum value 추출 가능
  - `npx prisma validate` / `npx prisma migrate diff`: **샌드박스 실행 불가** (binaries.prisma.sh 403)
  - `npm test`: 샌드박스 검증 가능
  - `prisma migrate deploy`: Vercel build step에서 자동 실행
- [x] execution blockers identified:
  - sandbox에서 prisma engine 다운로드 차단 → migration SQL은 사람이 수기 작성 + schema와 대조
  - live DB 접근 불가 → 사장님 로컬에서 `prisma db pull` 또는 Supabase dashboard 확인 필요

---

## 1. Priority Fit

**Current Priority Category:**
- [x] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- LabAxis P1 목록에 `enum drift 반영` 과 `MutationAuditEvent migration + smoke run` 이 나란히 명시되어 있음.
- 두 작업 모두 **schema ↔ migration 한 쌍의 완결**이 목적이므로 하나의 PR/migration batch로 묶는 편이 rollback/검증 단위가 작음.
- Vercel 빌드가 막 복구된 상태(a506bb60)라 다음 release-prep 작업은 migration 쌍을 맞추는 것이 가장 안전한 다음 단계.

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [x] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [ ] Web
- [ ] Design Consistency

---

## 3. Overview

**Feature Description:**
`apps/web/prisma/schema.prisma`의 enum/model 정의와 `apps/web/prisma/migrations/` 누적 SQL 사이의 drift를 제거한다. 구체적으로 (a) schema에 정의됐지만 CREATE TYPE/ADD VALUE가 빠진 enum 값, (b) schema에 정의됐지만 CREATE TABLE이 없는 `MutationAuditEvent` 모델을 같은 migration batch로 반영한다.

**Success Criteria:**
- [x] 샌드박스에서 "schema.prisma에 있으나 migrations 누적에 없는 enum 값" 목록이 0건 **(Phase 0 확정: 0건)**
- [x] `MutationAuditEvent` 테이블 CREATE + 인덱스가 migration SQL로 존재 **(0_init 안에 이미 존재)**
- [ ] 사장님 로컬 `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel apps/web/prisma/schema.prisma --script` 결과가 **비어 있음** (live DB vs migrations 정합 확인)
- [ ] 비어있지 않다면 그 diff를 새 migration으로 반영
- [ ] `durable-mutation-audit-contract.mjs` 테스트가 실제 DB에 기록/조회 smoke 1회 성공 (사장님 로컬)
- [ ] `PLAN_test-runner-and-prisma-stabilization.md` 의 "별도 plan" 항목 2개가 closeout 가능 상태

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 새 enum 도입 / 새 모델 추가 (drift 반영만, 의미 변경 금지)
- [ ] MutationAuditEvent schema 컬럼 추가/변경 (기존 schema.prisma 정의 그대로 migration으로 옮김)
- [ ] page-per-feature UI 생성 (audit viewer 같은 신규 surface 금지)
- [ ] ontology/chatbot 재해석
- [ ] `prisma db push` 사용 (production 규범 migration flow 유지)

**User-Facing Outcome:**
- 사용자가 직접 체감할 UI 변화는 없음. 대신 **mutation audit 경로가 canonical truth로 persistent**해지고, enum-기반 쿼리(`where: { status: ADDED_VALUE }` 등)가 prod DB에서 더 이상 500을 던지지 않는다.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (UI 변경 없음)
- [x] same-canvas (UI 변경 없음)
- [x] canonical truth (MutationAuditEvent 테이블 = append-only canonical)
- [x] invalidation discipline (이 plan은 캐시 invalidate 대상 아님)

**Must Not Introduce:**
- [ ] page-per-feature (audit 뷰어 신설 금지)
- [ ] chatbot/assistant reinterpretation of ontology (해당 없음)
- [ ] dead button / no-op / placeholder success
- [ ] fake billing/auth shortcut
- [ ] preview overriding actual truth (audit는 truth 그 자체 — snapshot/preview 없음)

**Canonical Truth Boundary:**
- **Source of Truth:** `MutationAuditEvent` 행 (append-only, idempotency key = `auditEventKey`)
- **Derived Projection:** (해당 plan에서는 생성 안 함 — 후속 plan에서 조회 뷰 설계)
- **Snapshot / Preview:** 없음
- **Persistence Path:** `apps/web/src/lib/audit/durable-mutation-audit.ts` → Prisma `mutationAuditEvent.create`

**UI Surface Plan:**
- [x] UI 변경 없음 (migration + server runtime만 건드림)
- [ ] Inline expand
- [ ] Right dock
- [ ] Bottom sheet
- [ ] Split panel
- [ ] Existing route section
- [ ] Settings panel
- [ ] New page (⚠️ only with explicit justification)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| enum drift + MutationAuditEvent을 하나의 migration batch로 묶음 | rollback/검증 단위 축소, PR 1개 | migration file 1개가 상대적으로 커짐 |
| migration SQL 수기 작성 (샌드박스에서 prisma engine 403) | 샌드박스 실행 불가 우회, schema.prisma ↔ migration 대조 검증은 Grep 기반 | 사장님 로컬에서 `prisma migrate diff --from-migrations --to-schema-datamodel --script` 으로 한 번 더 검증 필요 |
| ALTER TYPE ADD VALUE 우선, DROP VALUE 금지 | Postgres enum은 DROP VALUE가 위험(사용처 남아있으면 실패) — 혹시 schema가 0_init 대비 값을 제거했다면 별도 플랜으로 분리 | drift 방향이 "schema가 더 많다"에만 한정됨 |
| MutationAuditEvent indexes 6개를 schema와 1:1 매칭 | 기존 runtime(`durable-mutation-audit.ts`)이 해당 인덱스 전제 쿼리 사용 | 인덱스 추가로 write 오버헤드는 있지만 append-only라 수용 가능 |

**Dependencies:**
- Required Before Starting:
  - [x] Vercel 빌드 복구 (a506bb60) — 완료
  - [x] `PLAN_test-runner-and-prisma-stabilization.md` Phase 2 (prisma generate 안정화) — 완료
- External Packages: 없음
- Existing Routes / Models / Services Touched:
  - schema.prisma (read/edit 금지, drift 검증만)
  - prisma/migrations/ (신규 migration 1개 추가)
  - `apps/web/src/lib/audit/durable-mutation-audit.ts` (코드 변경 없음, smoke 대상)

**Integration Points:**
- `prisma migrate deploy` (Vercel build step)
- `durable-mutation-audit.ts` (smoke path)
- `durable-mutation-audit-contract.mjs` (contract test)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

**Test Strategy by Work Type:**
- Migration / rollout → smoke + rollback verification required
- Contract tests (durable-mutation-audit-contract) → migration 후 GREEN
- Unit tests → 본 plan 범위 아님 (코드 변경 없음)

**Execution Notes:**
- 샌드박스: `prisma validate` **실행 불가** (binaries 403). `grep` 기반으로 drift 검증.
- 사장님 로컬: `npx prisma migrate diff --from-migrations apps/web/prisma/migrations --to-schema-datamodel apps/web/prisma/schema.prisma --script` 로 재검증 필요.
- Vercel: build log에서 `prisma migrate deploy` 성공 여부 확인.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock ✅
**Goal:** schema ↔ migrations drift 목록 확정, migration 파일 이름/순서 설계.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-18)

**🔴 RED:** schema 35 enums × 각 enum 값을 0_init 값과 1:1 비교. model 90 vs cumulative CREATE TABLE diff 확인.
**🟢 GREEN:**
- Python 기반 diff → **enum drift 0건, model drift 0건**
- `MutationAuditEvent` 는 `0_init/migration.sql:1705` 에 이미 존재 (초기 가정 뒤집힘)
- schema ↔ migrations 누적 정합성 확정
**🔵 REFACTOR:** "Phase 2 migration SQL 작성" 필요성 사라짐 → scope 축소. live DB ↔ migrations 정합 검증(Phase 1)과 smoke(Phase 3)만 남김.

**✋ Quality Gate:**
- [x] drift 목록이 파일 기반 근거(Python diff script 출력)와 함께 notes에 기록됨
- [x] schema ↔ migrations 누적 정합성 = 0 drift 확정
- [x] Phase 0 결과가 Chosen Source of Truth와 모순 없음
- [x] 남은 불확실성은 "live DB vs migrations" 하나로 좁혀짐 → Phase 1으로 위임

**Rollback:** planning-only; no code change.

---

### Phase 1: Live DB vs Migrations 정합 검증 (사장님 로컬) ✅
**Goal:** 샌드박스에서 확인 불가한 "live Supabase DB vs migration trail" 정합성을 사장님 로컬에서 한 번에 확정.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-18)
- 결과: 양방향 `prisma migrate diff` 모두 empty (148 B, `-- This is an empty migration.` 한 줄). schema ↔ migrations ↔ live DB **3-way 동기화** 확정.

**🔴 RED:** 사장님 로컬에서:
```bash
cd apps/web
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/live_db_drift.sql
wc -l /tmp/live_db_drift.sql   # 0 또는 최소 byte 이면 GREEN
```
그리고 반대 방향도 1회:
```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-url "$DATABASE_URL" \
  --script > /tmp/migrations_vs_live.sql
```

**🟢 GREEN:**
- 두 출력 모두 비어있음(또는 comment-only) → live DB와 migrations가 완전 일치, 추가 작업 없음 → Phase 2 skip 가능
- 출력이 있으면 → 그 SQL이 Phase 2의 입력이 됨

**🔵 REFACTOR:** 두 출력이 서로 다르면(비대칭) 원인 분석 후 본 plan에 notes 추가.

**✋ Quality Gate:**
- [ ] `live_db_drift.sql` 바이트 수 0 (또는 내용 notes에 기록)
- [ ] `migrations_vs_live.sql` 바이트 수 0 (또는 내용 notes에 기록)
- [ ] 본 phase에서 production code 변경 없음

**Rollback:** 문서만 추가, 코드 미변경 — 되돌릴 것 없음.

---

### Phase 2: Conditional — Reconciliation Migration (Phase 1이 drift 발견한 경우에만) ⏭️ N/A
**Goal:** Phase 1이 live DB와 migrations 사이의 drift를 드러낸 경우, 최소 diff migration 1개로 정합화.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete | [x] **N/A (Phase 1 GREEN으로 확정, migration 불필요)**

**🔴 RED:** Phase 1의 `live_db_drift.sql` / `migrations_vs_live.sql` 내용을 읽고 drift 방향 결정:
- live DB가 schema 대비 결핍 → 결핍분을 roll-forward migration으로
- live DB가 schema 대비 overshoot(수기 변경 존재) → schema 변경 없이 migration으로 동일 상태 재현
**🟢 GREEN:**
- `apps/web/prisma/migrations/20260418130000_live_db_reconciliation/migration.sql` 생성
- idempotent 원칙 (`IF NOT EXISTS` / `IF EXISTS`) 고수
- enum DROP VALUE는 **이 plan에서 금지** (별도 plan)
**🔵 REFACTOR:** SQL 주석 정리, 파일 내 순서(enum-먼저, table-다음, index-마지막).

**✋ Quality Gate:**
- [ ] 사장님 로컬 `migrate diff --from-url $DATABASE_URL --to-schema-datamodel` 재실행 결과가 **비어 있음**
- [ ] 반대 방향 `migrate diff --from-migrations --to-url` 결과도 **비어 있음**
- [ ] SQL이 idempotent
- [ ] schema.prisma 변경 없음 (의미 변경 금지)

**Rollback:** migration 파일 삭제(`git rm -r apps/web/prisma/migrations/20260418130000_*`).

---

### Phase 3: MutationAuditEvent Smoke Run
**Goal:** `MutationAuditEvent` 테이블이 live DB에 이미 존재함을 확인하고, 실제 mutation 경로 1회에서 row가 기록되는 것을 smoke.
- Status: [ ] Pending | [x] In Progress | [ ] Complete
- 2026-04-18: Contract test 59/59 GREEN (샌드박스, `docs/BATCH8_ROUTE_COVERAGE_MATRIX.md` 라벨 drift 7건 최소 diff로 정리). 남은 단계는 사장님 로컬/Supabase 에서 실 row 1개 이상 확인.

**🔴 RED:** 사장님 로컬 또는 Supabase dashboard에서:
```sql
SELECT COUNT(*) FROM "MutationAuditEvent";   -- 0 일 수도 있음 (smoke 이전)
```
**🟢 GREEN:**
- `durable-mutation-audit-contract.mjs` 실행 → GREEN
- staging/production에서 mutation audit을 유발하는 경로 1개 실행 (e.g. purchase_request approve)
- 다시 `SELECT COUNT(*)` → 1 이상 증가 확인
- 또는 `SELECT action, result, occurredAt FROM "MutationAuditEvent" ORDER BY occurredAt DESC LIMIT 5;` 로 최근 row 확인

**🔵 REFACTOR:** 필요 시 `durable-mutation-audit.ts` 내부 invariant 재점검 (단, schema 변경 금지).

**✋ Quality Gate:**
- [ ] contract test GREEN 증거 확보 (stdout 요약 또는 스크린샷)
- [ ] 실제 row 1개 이상 기록 증거 확보
- [ ] 기록된 row가 schema.prisma 컬럼 정의와 모순 없음 (예: `auditEventKey` unique, `occurredAt` ISO 타임스탬프)

**Rollback:** smoke 실패 시 audit 호출부 side-effect만 feature flag로 임시 OFF, 원인 플랜 별도 분기. schema/migration 변경 없음.

---

### Phase 4: Closeout
**Goal:** 관련 P1 아이템 2개(#48 + stabilization plan 위임분) closeout.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 여전히 pending 상태로 남은 tracker 아이템 확인.
**🟢 GREEN:**
- tracker `#48 Prisma enum drift 반영` → completed
- `PLAN_test-runner-and-prisma-stabilization.md` 내 `enum drift 반영` / `MutationAuditEvent migration + smoke run` 체크박스 업데이트
- 본 plan Status → ✅ Complete
**🔵 REFACTOR:** notes 섹션에 Phase 0~3 결과 최종 기록, 다음 P1 순서 제안(`#47 Test-only @ts-nocheck 잔여 제거`).

**✋ Quality Gate:**
- [ ] tracker 업데이트 완료
- [ ] stabilization plan 체크박스 업데이트
- [ ] 이 plan의 Status + Last Updated 갱신
- [ ] 다음 P1 진입 경로 제안

**Rollback:** 문서만 변경 — 되돌릴 것 없음.

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum
- 해당 없음 (workflow surface 변경 없음)

### B. Billing / Entitlement Addendum
- 해당 없음

### C. API Slimming Addendum
- 해당 없음

### D. Mobile Addendum
- 해당 없음

### E. Migration / Rollout Addendum (적용)
**Rollout Mode:** 단일 migration, soft_enforce 필요 없음 (append-only 테이블 + 기존 enum 값 추가).

**Rollout Order:**
1. schema.prisma 변경 금지 (이미 intent 상태)
2. migration SQL 추가 → PR → main push
3. Vercel `prisma migrate deploy`
4. smoke

**Rollback Gate:**
- enum ADD VALUE는 Postgres 레벨에서 하위호환
- MutationAuditEvent DROP은 append-only + 신규 테이블이라 역방향 데이터 손실 위험 없음 (첫 배포 시점에 한함)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 샌드박스에서 `prisma validate` 불가 → drift 오인 | Med | Med | 사장님 로컬 `migrate diff` Phase 3에서 재검증 (QG 의존) |
| schema가 0_init보다 enum 값을 **제거**했을 경우 (reverse drift) | Low | High | Phase 0에서 발견 시 본 plan 범위 밖으로 분리 |
| Vercel `migrate deploy` 가 다른 원인으로 실패 | Low | High | Phase 3 Vercel build log 확인, 필요 시 `prisma migrate resolve` 런북 활용 |
| MutationAuditEvent 인덱스 6개 추가로 write p95 증가 | Low | Low | append-only + 현재 트래픽 기준 무시 가능, 후속 모니터링 |
| live DB에 이미 수기로 반영된 값이 있어 ADD VALUE 충돌 | Low | Med | `IF NOT EXISTS` 로 idempotent 처리 |

**Risk Categories:** Migration / Contract Drift / Canonical Truth.

---

## 10. Rollback Strategy

- If Phase 0 Fails: 계획만 조정, 코드 변경 없음.
- If Phase 1 Fails: RED 증거 확보 실패 시 drift 정의 재확인, migration 작성 보류.
- If Phase 2 Fails: migration SQL 파일 삭제 (`git rm -r`), 재작성.
- If Phase 3 Fails:
  - 로컬 diff 불일치 → Phase 2 복귀
  - Vercel migrate deploy 실패 → `prisma migrate resolve --rolled-back <migration>` 런북 적용
- If Phase 4 Fails: audit 호출부 flag로 일시 OFF + 원인 플랜 분기.

**Special Cases:** enum DROP VALUE는 본 plan에서 **절대 수행하지 않음** (데이터 마이그레이션 별도 plan).

---

## 11. Progress Tracking

- Overall completion: 85%
- Current phase: Phase 3 (Contract 59/59 GREEN, 실 row 확인만 남음)
- Current blocker: 없음 — sandbox 가능한 것은 모두 GREEN
- Next validation step: 사장님 Supabase dashboard 또는 `psql $DATABASE_URL -c 'SELECT count(*), max("occurredAt") FROM "MutationAuditEvent";'` 한 번

**Phase Checklist:**
- [x] Phase 0 complete (2026-04-18)
- [x] Phase 1 complete (2026-04-18)
- [x] Phase 2 N/A (2026-04-18)
- [ ] Phase 3 complete (contract 52/59, matrix fix + real-write smoke 남음)
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-04-18] 샌드박스 `prisma validate` 불가 (binaries.prisma.sh 403) → Python 기반 정적 diff 로 우회. live DB 대비 검증은 사장님 로컬 의존.
- [2026-04-18] Contract test Section 6 fail 7건 — `docs/BATCH8_ROUTE_COVERAGE_MATRIX.md` Audit 열이 `yes` 그대로. 실제 wiring은 Section 3(52/52) 전원 PASS. → 문서 drift, migration drift 아님.

**Phase 1 Drift Report (2026-04-18, 사장님 로컬):**
```
migrate diff --from-url $DATABASE_URL --to-schema-datamodel ...   → 148 B (empty)
migrate diff --from-migrations ... --to-url $DATABASE_URL ...     → 148 B (empty)
```
3-way 동기화 확정: schema ↔ migrations ↔ live DB.

**Phase 3 Contract Test Report (2026-04-18, sandbox):**
```
1차 실행: 통과 52 / 실패 7 — Section 6 Route Coverage Matrix 문서 라벨 stale
matrix 최소 diff 수정 (6 route row + 변경 이력 섹션)
2차 실행: 통과 59 / 실패 0  ✓
```

**Implementation Notes:**
- [2026-04-18] Phase 0 결과: schema ↔ migrations 누적 drift = **0건** (enum 0건, model 0건). 초기 가정(model 1건 drift)은 `grep -c "^CREATE TABLE"` 의 anchor 제약에서 온 false positive였음. 실제로는 `MutationAuditEvent` 가 `0_init/migration.sql:1705` 에 이미 존재.
- [2026-04-18] 당초 4 phase 중 Phase 2 "migration SQL 작성"은 Phase 1 결과가 GREEN이면 완전 스킵 가능. scope 축소.
- [2026-04-18] `PLAN_test-runner-and-prisma-stabilization.md` 에서 해당 두 아이템을 명시적으로 이 plan에 위임한 기록 있음 → closeout 경로 확보.
- [2026-04-18] 가장 중요한 남은 변수는 **live DB vs migrations 정합** (사장님 로컬에서 한 번에 확인). Vercel 빌드는 이미 READY(`27f406f6`)이므로 prod migrate deploy도 이미 정상 통과한 상태.

**Phase 0 Drift Report (2026-04-18, sandbox):**
```
schema_enum_count=35 init_enum_count=35 alter_add_count=0
Enums in schema but NOT in DB baseline: (none)
Enums in DB but NOT in schema: (none)
Per-enum value drift: (no per-value drift)
schema_models=90 db_tables_cumulative=90 dropped=0
in schema but not in DB: (none)
in DB but not in schema: (none)
```
