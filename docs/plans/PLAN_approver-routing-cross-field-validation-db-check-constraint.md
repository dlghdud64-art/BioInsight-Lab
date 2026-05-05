# Implementation Plan: #approver-routing-cross-field-validation-db-check-constraint

- **Status:** 🔄 In Progress
- **Started:** 2026-05-05
- **Estimated Completion:** 2026-05-05

⛔ DO NOT modify schema.prisma (Prisma 가 PostgreSQL CHECK constraint 표준 syntax 지원 0 — migration SQL 만으로 추가)
⛔ DO NOT block backward compat (모든 기존 row 가 default low=1M ≤ high=10M 정합 — 위반 0)
⛔ DO NOT remove application-layer validation (form / zod refine / runtime — defense in depth 4-layer lock)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 직전 #approver-routing-cross-field-validation-runtime-current-vs-pending — 3 layer (form / zod refine / runtime) defense in depth
- DB level constraint 0 → 직접 SQL 또는 raw Prisma update 우회 가능 (Prisma client 외 path)
- PostgreSQL CHECK constraint 가 마지막 lock — DB 자체가 invalid row 거부

**Conflicts Found:**
- application-layer 만으로 충분? — 99% 정상 동작. 단 Prisma raw / 직접 SQL update 시 우회. compliance / security 정합 위해 DB level lock 필요.
- prisma schema.prisma 는 CHECK constraint 표준 syntax 0 (custom comment + migration SQL 패턴).

**Chosen Source of Truth:**
- migration SQL 만 추가 — `ALTER TABLE "Workspace" ADD CONSTRAINT workspace_approval_threshold_low_le_high CHECK ("approvalLowThresholdKrw" <= "approvalThresholdKrw")`
- schema.prisma 변경 0 (Prisma 가 CHECK 자동 generate 0 — migration 으로만 enforce, prisma client 가 violation 시 P2002 또는 비슷한 error 반환)
- 모든 기존 row backward compat (default 1M ≤ 10M, 위반 0)

**Environment Reality Check:**
- vitest @ apps/web (host) — source-level grep migration SQL
- prisma migrate deploy (host) — DB constraint 추가
- 호영님 host 직접 DB 또는 SQL 으로 직접 violation 시도 → CHECK constraint 거부 검증

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — 직전 runtime validation 의 마지막 lock (DB level)

## 2. Work Type
- [x] Schema (CHECK constraint — migration SQL only)

## 3. Overview

PostgreSQL CHECK constraint 추가로 4-layer defense in depth 완성:
1. Form-level (UI toast)
2. zod refine (request body 둘 다 명시 시)
3. Runtime cross-field (PATCH route, partial update DB 합성)
4. **DB CHECK constraint (본 batch)** — 마지막 lock

**Success Criteria:**
- [ ] migration SQL — `ALTER TABLE Workspace ADD CONSTRAINT ... CHECK (approvalLowThresholdKrw <= approvalThresholdKrw)`
- [ ] constraint name 명시 (workspace_approval_threshold_low_le_high)
- [ ] 모든 기존 row 정합 (default 1M ≤ 10M, migration 적용 시 violation 0)
- [ ] schema.prisma 변경 0 (Prisma 표준 syntax 0)
- [ ] application-layer validation 그대로 유지

**Out of Scope:**
- prisma schema CHECK 자동 generate (Prisma 미지원)
- multi-column constraint (예: low ≥ 0 — 이미 zod min(0))
- 다른 model 의 CHECK constraint

## 4. Product Constraints

**Must Preserve:**
- [x] application-layer validation (form / zod / runtime 3 layer)
- [x] backward compat (default rows 정합)
- [x] schema.prisma 표준 (Prisma generate 가 CHECK 인식 0 — comment 만)

**Must Not Introduce:**
- [x] schema.prisma syntax 변경 (Prisma migration drift 위험)
- [x] 기존 row violation (data migration 0 보장)

**Canonical Truth Boundary:**
- DB CHECK = 마지막 lock (직접 SQL / Prisma raw update 차단)
- application-layer = 1차 차단 (UX + 정합)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| migration SQL only | Prisma CHECK syntax 0 | schema.prisma 가 constraint 추적 0 (코멘트 추가로 lock) |
| named constraint | error message + rollback 정합 | constraint 이름 collision 위험 (workspace_approval_threshold_low_le_high — unique) |
| application-layer 보존 | 4 layer lock 정합 | DB lock 만으로는 user-facing message 0 |

**Dependencies:**
- 직전 multi-tier matrix (land)
- 직전 zod refine + runtime cross-field (land)

**Integration Points:**
- `apps/web/prisma/migrations/.../migration.sql` (NEW)
- `apps/web/prisma/schema.prisma` — Workspace 모델 코멘트 추가 (CHECK constraint 명시 — 코드 reader 정합)

## 6. Global Test Strategy

- vitest source-level grep — migration SQL 의 ALTER TABLE ADD CONSTRAINT + CHECK + constraint name
- 호영님 host SQL 직접 violation 시도 → CHECK 거부 검증

## 7. Implementation Phases (1 phase, 1-2h)

### Phase 1: Migration + ADR (1-2h)
- 🔴 RED:
  - `schema/workspace-approval-threshold-check-constraint.test.ts` — migration SQL 의 ALTER TABLE ADD CONSTRAINT + CHECK + constraint name
- 🟢 GREEN:
  - `prisma/migrations/.../migration.sql` (NEW) — ALTER TABLE Workspace ADD CONSTRAINT
  - schema.prisma 의 Workspace 모델 코멘트 추가 (CHECK constraint 명시)
- ADR-002 entry CLOSED

✋ **Quality Gate:** vitest pass + regression 0
**Rollback:** migration revert SQL 제공 (`ALTER TABLE Workspace DROP CONSTRAINT workspace_approval_threshold_low_le_high`)

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 기존 row violation → migration fail | Low | High | default 1M ≤ 10M, 모든 기존 row 정합 검증 (host pre-check) |
| 향후 multi-tier 임계치 추가 시 constraint 재정의 | Med | Low | constraint name 명확 + ADR 명시 |
| application-layer fail → DB error fallback (UX 약화) | Low | Med | application-layer 정합 우선 (3 layer 보존) |

## 10. Rollback Strategy

- migration revert SQL: `ALTER TABLE "Workspace" DROP CONSTRAINT "workspace_approval_threshold_low_le_high"`
- git revert <sha>

## 11. Progress Tracking

- **Overall completion:** 0%
- **Current phase:** Phase 1
- **Next validation:** vitest + 호영님 host migrate deploy

## 12. Notes & Learnings

(빈 섹션 — phase 진행 시 채움)
