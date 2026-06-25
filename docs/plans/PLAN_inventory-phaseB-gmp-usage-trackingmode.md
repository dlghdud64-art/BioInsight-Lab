# Implementation Plan: inventory Phase B — GMP UsageRecord + trackingMode

- **Status:** ⏳ Pending
- **Started:** 2026-06-25
- **Last Updated:** 2026-06-25
- **Estimated Completion:** TBD (Large, 5 phases, DB migration 포함)
- **Tracker:** `#inventory-phaseB-gmp-usage`

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스  2. 🧪 quality gate 실행  3. ⚠️ gate 전체 통과 확인  4. 📅 Last Updated 갱신  5. 📝 Notes 기록  6. ➡️ 다음 phase

⛔ quality gate 실패 / SoT 충돌 미해결 / dead button·no-op·placeholder success 도입 시 진행 금지.
⛔ **prod schema/DB 변경 = dry-run → 평이한 한국어 보고 → "진행" 후만 apply** (호영님 통제구조 / CLAUDE.md). sandbox는 schema write·migrate·db push 금지 — operator-shell 단독.

---

## 0. Truth Reconciliation

**Latest Truth Source (실측 2026-06-25, `apps/web/prisma/schema.prisma`):**
- `InventoryUsage`(L871) = **이미 존재하는 UsageRecord** — `inventoryId`·`userId`·`quantity`(Float)·`unit`·`type`("DISPATCH"|"USAGE")·`lotNumber?`·`destination?`(사용처)·`operator?`(담당자 표시명)·`usageDate`·`notes?`. 인덱스 inventoryId/userId/usageDate/type.
- `ProductInventory`(L829) = 제품/조직당 재고 1행. `expiryDate?` 보유. **`trackingMode` 필드 없음**(신규).
- `InventoryRestock`(L903) = lot 엔티티(lotNumber·expiryDate·receivingStatus). lot-entity Phase A SHIPPED(04ac4e55).

**Secondary References:**
- `PLAN_inventory-lot-entity.md`(Phase A, SHIPPED) · `PLAN_inventory-reorder-surface-unify.md`(reorder/dispose surface) · `PLAN_11.345-audit-trail-terminology-gmp.md`(GMP 감사 용어) · `PLAN_11.348-receiving-coa-vision-roadmap.md`.

**Conflicts Found:**
- C1 — "Phase B" 라벨이 단일 정의 아님(11.326-phaseB=smart-receiving / 11.345=gmp-audit / 11.348=roadmap). 호영님 표현 "GMP UsageRecord·trackingMode"는 **소비 추적** 트랙 → receiving과 분리. (호영님 2026-06-25 스코프 승인으로 해소)
- C2 — UsageRecord를 "신규 생성"으로 오인 금지: **InventoryUsage 이미 존재** → 신규 모델 만들지 말 것(중복 truth 금지). trackingMode로 **게이팅만** 추가.

**Chosen Source of Truth:**
- 재고 정책: `ProductInventory.trackingMode`(신규 enum) = tracking 정책 canonical.
- 사용 원장: `InventoryUsage` 행(기존) = 소비 canonical ledger. UI state/preview가 대체 금지.
- 호영님 2026-06-25 스코프 승인(제안 스코프대로).

**Environment Reality Check:**
- [x] repo/branch context: `apps/web`, main, www.labaxis.co.kr live
- [x] runnable(sandbox): vitest(sentinel readFileSync) / `npm run build`(타입) / prisma `validate`·`migrate diff --from-url`(read-only)
- [x] **execution blocker: prod migration apply = operator-shell 단독**(sandbox 금지). dry-run만 sandbox 가능.

**P0 Lock 결과 (2026-06-25, 실측):**
- canonical 차감 write = `apps/web/src/app/api/inventory/[id]/use/route.ts` — zod + `tx.inventoryUsage.create` + `createAuditLog`(`@/lib/audit`: AuditAction/AuditEntityType) + `lotNumber/destination/operator` **이미 optional 배선**(L18-20,88,110-119). GMP 게이트 = trackingMode 기반 필수 승격.
- legacy `apps/web/src/app/api/inventory/usage/route.ts` — `{inventoryId,quantity,unit,usageDate,notes}`만, lot/operator/destination·audit **없음**. GMP 품목은 `[id]/use`로만(P3 가드: legacy가 GMP 품목 차감 차단/우회 금지).
- canonical 차감 UI = `apps/web/src/components/inventory/UsageDialog.tsx` — lot 선택·destination preset/custom·operator 입력 **3필드 이미 수집**(L71-104, 현재 optional). GMP 분기 = 필수 표시 + 제출 가드.
- `ProductInventory`(schema L829): `currentQuantity Float @default(0)`·`autoReorderEnabled Boolean @default(false)` 보유, **`trackingMode` 부재 확정** → 추가 자리.
- enum 확정: `enum TrackingMode { QUANTITY LOT GMP_STRICT }` + `ProductInventory.trackingMode TrackingMode @default(QUANTITY)`.
- migration dry-run(operator-shell): `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel apps/web/prisma/schema.prisma`(read-only). sandbox = `prisma validate`만.

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
견적관리 redesign 완결 후 호영님 선택 트랙. release blocker 아님(기존 사용 차감 동작). GMP 추적은 규제 대응 가치이나 즉시성 P1 아님. Large + DB 게이트라 신중 진행.

---

## 2. Work Type

- [x] Feature
- [x] Migration / Rollout (DB 게이트)
- [x] Workflow / Ontology Wiring (사용 차감 게이팅)
- [ ] Bugfix · API Slimming · Billing · Mobile-only · Design-only

---

## 3. Overview

**Feature Description:**
재고 품목별 `trackingMode`(수량만/lot/GMP 엄격)를 도입하고, 기존 `InventoryUsage`(UsageRecord) 차감을 trackingMode 기반으로 게이팅한다. `GMP_STRICT` 품목은 차감 시 lotNumber·operator·destination 필수 + 감사 추적 → GMP 소비 traceability.

**Success Criteria:**
- [ ] `ProductInventory.trackingMode` enum 신규 + 기존 행 backward-compat default(QUANTITY) — 기존 동작 회귀 0
- [ ] `GMP_STRICT` 차감 시 lot/operator/destination 누락이면 **서버 거부**(가짜 성공 0)
- [ ] 차감 UI가 trackingMode 분기(GMP 필수입력 노출), same-canvas 유지
- [ ] GMP 차감이 감사 추적에 기록

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 신규 UsageRecord 모델(InventoryUsage 재사용 — 중복 truth 금지)
- [ ] receiving/COA 트랙(11.326/lot-entity 별개)
- [ ] trackingMode 자동 판정/추론(명시 설정만)
- [ ] FEFO 자동 강제·lot 자동 선택(별 트랙)
- [ ] 모바일 차감 폼(별 cluster)
- [ ] 발주(ENABLE_PURCHASING) 연동

**User-Facing Outcome:**
GMP 품목 차감 시 lot·담당자·사용처 필수 입력 → 누락 시 명확한 차단 메시지. 일반 품목은 기존 그대로(추가 마찰 0).

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas (차감은 기존 inventory surface 내 — 신규 페이지 금지)
- [x] canonical truth (trackingMode=정책, InventoryUsage=원장)
- [x] invalidation discipline (차감 후 재고/원장 재검증)

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant 재해석
- [x] dead button / no-op / **placeholder success**(GMP 검증 실패 시 가짜 성공 절대 금지)
- [x] preview가 actual truth 대체

**Canonical Truth Boundary:**
- Source of Truth: `ProductInventory.trackingMode`(정책) + `InventoryUsage` 행(소비 원장)
- Derived Projection: 잔여 재고 = restock 합 − usage 합(파생, 저장 금지 유지)
- Snapshot / Preview: 차감 폼 입력값(제출 전 = preview, 제출 후 InventoryUsage row가 truth)
- Persistence Path: 차감 API → InventoryUsage.create + 재고 파생 invalidate + audit write

**UI Surface Plan:**
- [x] Existing route section (inventory 차감 surface 내 분기)
- [ ] New page (❌ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| trackingMode = ProductInventory enum(QUANTITY/LOT/GMP_STRICT) | 품목별 정책 canonical, UI-state 대체 방지 | enum 추가 = migration 필요(DB 게이트) |
| 기존 InventoryUsage 재사용(신규 모델 0) | 중복 truth 금지, 기존 lot/operator/destination 필드 이미 보유 | 신규 필드 0 — 게이팅 로직만 |
| 기본값 QUANTITY(기존 행) | backward-compat, 명시 opt-in 전 동작 회귀 0 | GMP 효과는 명시 설정 후만 |
| 서버 검증 1차(클라 보조) | placeholder success 차단, canonical 보장 | 클라 UX는 보조 검증 병행 |

**Dependencies:**
- Required Before Starting: operator-shell migration 채널 확인(prod apply)
- External Packages: 없음
- Existing Models/Services Touched: `ProductInventory`·`InventoryUsage`(schema) / 차감 API route / 차감 UI 컴포넌트 / audit infra

**Integration Points:**
- 차감 server action/route (InventoryUsage.create)
- ProductInventory trackingMode read (정책 분기)
- audit write (GMP 차감)
- 재고 파생 invalidation (차감 후 잔여 재계산)

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수.
- schema/enum 변경 → sentinel(readFileSync schema.prisma trackingMode enum) + prisma validate
- 게이팅 로직 → 단위 테스트(GMP_STRICT 필수검증 통과/거부 매트릭스)
- API 차감 → 통합 테스트(누락 시 거부, 정상 시 InventoryUsage row + audit)
- migration → dry-run(`migrate diff --from-url` read-only) + rollback 검증
- 실행 불가 항목은 "실행 불가" 명시(prod apply 등)

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock
**Goal:** 차감 API/UI 정확 파일·enum 값·migration 명령·audit infra 잠금.
- Status: [x] Complete (2026-06-25 — Lock 결과 §0 기록)

**🔴 RED:** 차감 surface(컴포넌트/route) 위치 확정, trackingMode enum 값 확정(QUANTITY/LOT/GMP_STRICT), migration dry-run 명령 식별
**🟢 GREEN:** SoT 확인(InventoryUsage 재사용·ProductInventory 정책), runnable 명령 확인
**🔵 REFACTOR:** 스코프 축소(필수 3필드만 GMP 게이트)

**✋ Quality Gate:** 충돌 0·SoT 명시·DB 게이트 경로 문서화. **Rollback:** planning-only.

#### Phase 1: Contract & Failing Tests
**Goal:** trackingMode enum + 게이팅 계약 실패 가시화.
- Status: [x] Complete (2026-06-25 — 순수 계약 로직 + 단위 테스트)
  - 신규 `apps/web/src/lib/inventory/tracking-mode.ts`: `TrackingMode` TS 타입·`TRACKING_MODES`·`DEFAULT_TRACKING_MODE`·`requiredUsageFields`·`validateUsageForTrackingMode`(null/공백=누락, 가짜 충족 차단).
  - 신규 `__tests__/tracking-mode.test.ts`: QUANTITY 통과·LOT/GMP 게이팅·공백 거부 매트릭스.
  - sandbox vitest **실행 불가**(rollup native mismatch, npm install 금지) → operator 권위 게이트. plain-node 로직 sanity 6/6 pass.
  - schema enum/migration은 P2(DB 게이트)로 격리 — P1은 DB 무관 순수 로직.

**🔴 RED:** sentinel — schema trackingMode enum 부재(RED) + 게이팅 검증 함수 미존재(RED)
**🟢 GREEN:** 계약 스캐폴딩(enum 상수·검증 함수 시그니처)
**🔵 REFACTOR:** 네이밍/스코프 정리

**✋ Quality Gate:** 실패 테스트 real·기존 테스트 GREEN·typecheck 문서화. **Rollback:** 계약 스캐폴딩 revert.

#### Phase 2: Schema + Migration + Core Gating Logic ⚠️ DB 게이트
**Goal:** trackingMode enum/컬럼 추가 + GMP 필수검증 핵심 로직.
- Status: [ ] In Progress (2026-06-25 — schema 편집 완료, **migration apply는 호영님 "진행" + operator-shell 대기**)
  - schema 편집: `enum TrackingMode { QUANTITY LOT GMP_STRICT }` + `ProductInventory.trackingMode TrackingMode @default(QUANTITY)`(additive).
  - 핵심 게이팅 로직 = P1 `validateUsageForTrackingMode`(이미 land). P2는 schema/migration이 핵심.
  - sandbox `prisma validate`: TrackingMode 에러 0(20 errors는 기존 SDSDocument 환경성, 내 변경 무관). 권위 validate = operator-shell.
  - 신규 sentinel `__tests__/inventory/tracking-mode-schema-p2.test.ts`(enum+컬럼+TS↔schema drift guard).
  - **migration SQL(additive, 무손실):**
    ```sql
    CREATE TYPE "TrackingMode" AS ENUM ('QUANTITY', 'LOT', 'GMP_STRICT');
    ALTER TABLE "ProductInventory" ADD COLUMN "trackingMode" "TrackingMode" NOT NULL DEFAULT 'QUANTITY';
    ```
  - **dry-run(operator-shell, read-only):** `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
  - 🛑 파괴적 명령(`--force-reset`/`--accept-data-loss`/`migrate reset`/`db push`) 금지. `--shadow-database-url=<prod>` 절대 금지.

**🔴 RED:** 게이팅 단위 테스트(GMP_STRICT: lot/operator/destination 누락 → 거부 / 충족 → 통과)
**🟢 GREEN:** ① schema `TrackingMode` enum + `ProductInventory.trackingMode @default(QUANTITY)` 추가 ② **dry-run(`migrate diff --from-url` read-only) → 호영님 한국어 보고 → "진행" → operator-shell apply** ③ 검증 함수 구현(서버)
**🔵 REFACTOR:** DRY, 추측 코드 제거

**✋ Quality Gate:** 게이팅 테스트 GREEN·migration additive(nullable/default, 기존 행 회귀 0)·truth-boundary 무위반·**prod apply는 operator 단독 "진행" 후만**. **Rollback:** 컬럼 drop migration + 로직 revert(dry-run 보고 후).

#### Phase 3: API / UI Wiring
**Goal:** 차감 API 게이팅 적용 + 차감 UI trackingMode 분기 + audit.
- Status: [ ] In Progress (2026-06-25 — P3-server 완료, **P3-UI는 truth 정정 후 호영님 결정 대기**)

**⚠️ P0 truth 정정 (2026-06-25 실측):** P0이 canonical로 잠근 `[id]/use`+`UsageDialog.tsx`는 부분만 사실 —
  - `UsageDialog.tsx`(lot/operator/destination 수집) = **dead**(import 0, 미렌더). 편집 원복함.
  - 라이브 차감 UI 3곳 = ① 데스크탑 inline dialog(`inventory-content.tsx`/`inventory-main.tsx` → legacy `/api/inventory/usage`) ② `scan/page.tsx` → `[id]/use` ③ `GlobalQRScannerModal.tsx` → `[id]/use`. **셋 다 quantity+notes만 전송**(GMP 3필드 미수집).

**P3-server (완료):**
- `[id]/use/route.ts`: `validateUsageForTrackingMode(inventory.trackingMode, ...)` 게이팅(GMP 누락 422, 트랜잭션 전) + audit `trackingMode` 기록.
- legacy `usage/route.ts`: select `trackingMode` + 비-QUANTITY 차단(422, 우회·placeholder success 방지).
- 안전: 현재 GMP 품목 0건(전부 default QUANTITY) + trackingMode 설정 UI 없음 → 게이팅 **완전 latent**(현 동작 회귀 0). sentinel `__tests__/inventory/usage-gating-p3.test.ts`.

**P3-UI (호영님 결정 대기):** GMP 사용을 라이브 UI에서 캡처하려면 3surface가 lot/operator/destination 수집 필요. 옵션:
  (A) 3 UI 모두 GMP 필드 추가  (B) `UsageDialog.tsx`(리치)를 데스크탑 canonical로 wire + scan/QR 보강  (C) GMP 사용=scan 전용, 데스크탑은 안내 차단  (D) 서버 게이팅만 선반영(latent), UI 후속.

**🔴 RED:** 통합 테스트(API: GMP 누락 거부 / 정상 InventoryUsage row + audit)
**🟢 GREEN:** 차감 server action에 검증 wiring(거부 시 명확 메시지·가짜 성공 0), 차감 UI가 trackingMode 분기(GMP 필수필드 노출), audit write
**🔵 REFACTOR:** same-canvas 유지·중복 제거·loading/error/empty/disabled 상태

**✋ Quality Gate:** dead button/no-op/front-only success 0·상태별 UI 존재·same-canvas. **Rollback:** UI/API wiring revert(P2 로직 유지).

#### Phase 4: Rollout / Smoke / Rollback
**Goal:** 안전 릴리스 확인 + 복구 경로.
- Status: [ ] Pending

**🔴 RED:** rollout 실패 모드 식별(기존 행 default 동작·GMP 품목 차단 경로), smoke 정의
**🟢 GREEN:** smoke(QUANTITY 품목 기존대로 / GMP_STRICT 필수검증 차단·통과 / audit 기록), 모니터링 확인
**🔵 REFACTOR:** 임시 계측 제거·notes 확정

**✋ Quality Gate:** rollout 안전·rollback 문서화·잔여 blocker 격리. **Rollback:** trackingMode 컬럼 drop + 로직/UI revert(dry-run 보고 후 operator apply).

---

## 8. Optional Addenda

#### A. Workflow / Ontology Addendum (inventory 차감)
**Resolver Input:** inventory item + trackingMode + 입력(lot/operator/destination)
**Expected Output:** allowedAction(차감 가능/차단) + blockers[](누락 필드) + nextAction(필수입력 안내)
**Surface Rules:** inventory route 내 same-canvas 차감(폼/시트), dashboard ontology 강조 최소. chatbot/terminal 금지.
**Validation:**
- [ ] GMP 품목 차감 폼 필수필드 노출
- [ ] 누락 시 차단 메시지(가짜 성공 0)
- [ ] 일반 품목 기존 동선 무변경

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| prod migration 사고(2026-06-14 선례) | Low | High | dry-run `--from-url` read-only만, shadow-db 금지, operator-shell 단독 apply, 보고→"진행" 게이트 |
| 기존 차감 회귀 | Med | High | default QUANTITY backward-compat, 기존 행 동작 불변 sentinel |
| placeholder success(GMP 검증 우회) | Med | High | 서버 1차 검증, 통합 테스트 거부 경로 강제 |
| trackingMode UI-state가 truth 대체 | Low | Med | 정책=ProductInventory column, 폼은 preview only |
| sandbox schema 오염 | Low | High | sandbox schema write 금지, operator 단독 |

---

## 10. Rollback Strategy

- Phase 1 실패: 계약/테스트 스캐폴딩 revert
- Phase 2 실패: trackingMode 컬럼 drop migration(dry-run 보고→operator apply) + 검증 로직 revert
- Phase 3 실패: API/UI wiring revert(P2 schema/로직 유지)
- Phase 4 실패: 기존 행 default QUANTITY로 효과 무력화(명시 설정 전 무영향) + 필요 시 컬럼 drop

**Special Cases:** DB migration = additive(낮은 위험)이나 prod는 반드시 dry-run→보고→"진행". 컬럼 drop rollback도 동일 게이트.

---

## 11. Progress Tracking

- Overall completion: 40% (P0·P1 완료)
- Current phase: P2 대기 (⚠️ Schema + Migration + Core Gating — DB 게이트)
- Current blocker: 없음(P2 진입 시 operator-shell migration 채널 필요)
- Next validation step: P2 — schema TrackingMode enum + ProductInventory.trackingMode 컬럼 + dry-run 보고

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [ ] Phase 2 complete (⚠️ DB 게이트)
- [ ] Phase 3 complete
- [ ] Phase 4 complete

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-06-25] "Phase B" 라벨 모호 → 호영님 스코프 승인(GMP usage/trackingMode)으로 해소.

**Implementation Notes:**
- UsageRecord = 기존 InventoryUsage 재사용(신규 모델 0). trackingMode만 신규.
- DB 게이트(P2)는 sandbox 불가 — operator-shell dry-run→보고→"진행".
