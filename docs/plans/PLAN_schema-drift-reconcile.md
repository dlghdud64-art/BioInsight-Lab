# Implementation Plan: schema drift 정식 migration화 (#schema-drift-reconcile)

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14
- **Estimated Completion:** —

**CRITICAL INSTRUCTIONS** — 각 phase 완료 후:
1. ✅ 체크박스 갱신  2. 🧪 quality gate 실행  3. ⚠️ gate 전부 통과 확인  4. 📅 Last Updated 갱신  5. 📝 Notes 기록  6. ➡️ 그 다음에만 다음 phase

⛔ quality gate 실패 / source-of-truth 충돌 미해결 / dead-button·no-op 도입 시 진행 금지.
⛔ 🛑 **shadow DB 는 sandbox throwaway 만**. `--shadow-database-url=<prod>` 절대 금지 (DEV_RUNBOOK §9.9 — 2026-06-14 prod wipe 원인).
⛔ 🛑 prod 변경은 operator-shell 단독 + dry-run→보고→"진행". sandbox 는 prod 무접촉(read-only도 operator-shell 권장).

---

## 0. Truth Reconciliation

**Latest Truth Source:** `apps/web/prisma/schema.prisma` (현재) = 진실.

**실측 drift (schema有 / migration無):**
- `enum VendorPartnershipTier`
- `model OrganizationVendor` (+ `OrganizationVendorProduct` — Phase 0에서 drift 여부 확정)
- `Vendor.partnershipTier`
- `OrganizationMember.workflowCapabilities`
- `User.deletedAt` 타입 변경 (`SET DATA TYPE TIMESTAMP(3)`)
- `Order_quoteId_key` 인덱스 변동 등
- 합 ~14 statement (2026-06-14 destructive migrate diff 출력 기준 — Phase 0에서 정식 재집계)

**현 prod 상태:** db push(2026-06-14 복구)로 prod 에 이 객체들 **이미 실재**. → 본 트랙은 "신규 생성"이 아니라 **기존 상태를 migration 파일로 baseline(문서화)**. prod 엔 DDL 미실행, `resolve --applied`로 기록만.

**Conflicts:** migration set != schema.prisma (14 누락). prod == schema.prisma (db push). 즉 prod 와 schema 는 일치, migration 파일만 뒤처짐.

**Chosen Source of Truth:** schema.prisma. migration 을 schema.prisma 에 맞춤.

**Environment Reality Check:**
- [ ] sandbox ephemeral Postgres(+pgvector) 기동 가능 여부 (Phase 1 — 안 되면 수기 SQL 폴백)
- [ ] operator-shell prod read-only / resolve 실행 (Phase 2)

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [x] P2 / Deferred (위생)

**Why:** prod·Vercel 배포 정상(db push 로 schema 정합). blocker 아님. 미처리 시 향후 `migrate dev`가 drift 재감지 + 히스토리 불완전. 오늘 인시던트의 마지막 매듭.

## 2. Work Type

- [x] Migration / Rollout (단, prod 엔 record-only baseline — 무DDL)

## 3. Overview

**Description:** db push 로만 prod 에 반영된 14 drift 항목을 정식 migration 파일로 만들어 schema↔migration↔prod 3자 정합. prod 적용은 `resolve --applied`(기록).

**Success Criteria:**
- [ ] 신규 migration `<ts>_schema_drift_reconcile/migration.sql` 이 14 drift 전부 포함
- [ ] sandbox throwaway 에 전 migration + 신규 적용 → introspect == schema.prisma (drift 0)
- [ ] operator-shell: `migrate status` up-to-date + `migrate diff --from-url`(read-only) empty
- [ ] sentinel GREEN (drift 항목이 migration 파일에 존재)

**Out of Scope (⚠️ 금지):**
- [ ] prod 에 신규 DDL 실행 (객체 이미 존재 — resolve 로 기록만)
- [ ] schema.prisma 모델 변경 (현재 정의 = 진실, 건드리지 않음)
- [ ] 14 외 항목 추가 정리

**User-Facing Outcome:** 없음 (내부 히스토리 위생). 향후 migration 작업 안정.

## 4. Product Constraints

**Canonical Truth Boundary:**
- Source of Truth: schema.prisma (현재) = prod 실제 스키마
- Derived: migration 파일(이번에 schema 에 맞춰 보강)
- Persistence: `_prisma_migrations`(resolve 로 신규 1행 추가)

**Must Not Introduce:** prod DDL 재실행, schema 변경, page/surface 영향(이 트랙은 DB 메타 전용 — UI 무관).

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| baseline migration (resolve --applied) | prod 이미 객체 보유 → DDL 재실행 시 "already exists" 실패 | fresh-DB 재현용 SQL 정확성은 throwaway 검증으로 담보 |
| shadow = sandbox throwaway pg | §9.9 가드 — prod shadow 금지 | pgvector 셋업 부담(폴백: 수기 SQL) |

**Touched:** `prisma/schema.prisma`(읽기만), `prisma/migrations/`(신규 1폴더), `_prisma_migrations`(operator resolve).

## 6. Test Strategy

- Migration → **throwaway introspect == schema.prisma** (drift 0) 가 핵심 검증.
- sentinel(readFileSync+regex): 14 drift 항목이 신규 migration.sql 에 존재.
- operator: `migrate status` / `migrate diff --from-url`(read-only) 게이트.
- 실행 불가 시 "실행 불가" 명시.

## 7. Implementation Phases

### Phase 0: Truth & Scope Lock — ✅ Complete (2026-06-14)
- Status: [x] Complete
- **drift 집합 LOCKED (sandbox read-only 전수 대조):**
  - 신규 테이블: `OrganizationVendor`, `OrganizationVendorProduct` (각 @@index·@relation FK 동반)
  - 신규 enum: `VendorPartnershipTier`
  - 컬럼 추가: `Vendor.partnershipTier`(VendorPartnershipTier, default GENERAL), `OrganizationMember.workflowCapabilities`(JSONB default '[]')
  - 타입 변경: `User.deletedAt` → TIMESTAMP(3)
  - 인덱스: `Order_quoteId_key` 변동
  - false positive 제거: RumMetric·CronExecutionLog 는 `CREATE TABLE IF NOT EXISTS` 로 migration 에 실재(drift 아님).
- **prod 실재:** db push(2026-06-14 복구) 로 prod==schema.prisma → 위 객체 prod 보유(복구 count 에서 partnershipTier 복원 확인). Phase 2 operator-shell 에서 formal 재확인.
- **✋ Gate:** drift 목록 완결 ✓, shadow=throwaway 잠금 ✓.

### Phase 1: drift migration SQL 생성 (prod read-only pg_dump 우선)
- Status: [ ] Pending
- **접근 정정:** pgvector throwaway shadow 대신 **prod read-only `pg_dump --schema-only`**(operator-shell) 로 2 신규 테이블+enum 의 정확한 DDL 추출 → shadow 불필요. db push 로 prod==schema.prisma 이므로 prod DDL = 정답 SQL. 컬럼 add/타입변경/인덱스는 schema 정의에서 수기(단순 ALTER).
- **🔴 RED:** sentinel 작성 — 신규 migration.sql 에 drift 항목 부재 = RED.
- **🟢 GREEN:** (operator-shell read-only) `pg_dump --schema-only -t '"OrganizationVendor"' -t '"OrganizationVendorProduct"'` + enum dump → SQL 회신. (sandbox) 그 DDL + 수기 ALTER(partnershipTier/workflowCapabilities/deletedAt/Order_quoteId_key) 를 `migrations/<ts>_schema_drift_reconcile/migration.sql` 로 조립.
- **🔵 검증:** 조립 SQL 의 각 객체가 schema.prisma 정의(컬럼·타입·FK·인덱스)와 1:1 일치하는지 대조. (DB 무접촉 검증 — pg_dump 가 prod 실DDL 이므로 정확성 담보)
- **✋ Gate:** sentinel GREEN, SQL↔schema 1:1 대조 완료, 구문 OK, prod write 0(read-only pg_dump 만). **Rollback:** migration 폴더 삭제.
- **폴백:** pg_dump 불가 시 sandbox `/tmp` ephemeral pg(+pgvector) shadow 로 `migrate diff` (🛑 prod 절대 아님).

### Phase 2: operator baseline + 검증 (prod, record-only)
- Status: [ ] Pending
- **🔴 RED:** rollout 실패모드 식별(중복 resolve, status 불일치).
- **🟢 GREEN:** operator-shell — 신규 migration 커밋 후 `prisma migrate resolve --applied <ts>_schema_drift_reconcile`(prod 객체 이미 보유 → **DDL 미실행, 기록만**). 이어 `migrate status`(up-to-date) + `migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`(read-only, empty 기대).
- **✋ Gate:** status up-to-date, diff empty, 데이터 무변경. dry-run→보고→"진행" 게이트. **Rollback:** `migrate resolve --rolled-back <ts>` + migration 폴더 제거.

## 8. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| sandbox pgvector shadow 기동 실패 | Med | Low | 수기 SQL 작성 + throwaway introspect 검증 폴백 |
| 신규 SQL 이 fresh-DB 재현 부정확 | Med | Med | throwaway introspect == schema.prisma 강제(Phase 1 gate) |
| resolve 중복/순서 오류 | Low | Low | 신규 1건만 resolve, status 로 확인 |
| 🛑 shadow=prod 오발사 | Low | **Critical** | §9.9 가드, shadow URL echo 확인, prod ref 면 즉시 중단 |

## 9. Rollback Strategy

- Phase 1 실패: migration 폴더 삭제 (repo only, prod 무관).
- Phase 2 실패: `migrate resolve --rolled-back <ts>` + 폴더 제거 → 이전 상태(_prisma_migrations 38행) 복귀. prod 객체/데이터 불변(애초에 DDL 미실행).

## 10. Progress Tracking

- Overall: 0%
- Current phase: Phase 0 대기
- Blocker: 없음
- Next: Phase 0 — drift 목록 정식 재집계

**Phase Checklist:**
- [ ] Phase 0
- [ ] Phase 1
- [ ] Phase 2

## 11. Notes & Learnings

- 2026-06-14: 본 drift 는 이전 세션들이 schema.prisma 만 수정하고 migration 미생성 → db push 로 prod 반영된 누적. 오늘 prod wipe 복구 시 db push 로 prod==schema 정합됨. 이 트랙은 migration 파일만 따라잡는 것.
- 핵심 제약(§9.9): prod·shared node_modules 무접촉, shadow=throwaway, prod 변경 operator-shell 단독.
