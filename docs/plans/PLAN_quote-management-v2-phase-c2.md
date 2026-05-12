# Implementation Plan: §11.229 Phase C2 — 공급사 DB UI 3 source grouping (#21)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-12
- **Last Updated:** 2026-05-12
- **Estimated Completion:** 2026-05-12

⛔ quality gate skip 0 / canonical truth 충돌 보류 시 진입 0 / dead button·no-op 도입 0

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx` (VendorRequestModal)
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` (4 priority source 합산)

**기존 land 확인 (audit 결과 — 3 경로 모두 백엔드 데이터/UI 흐름은 land 됨):**
- ✅ **등록된 공급사** — recent_rfq / org_book / supplier_book 3 source 통합 land
- ✅ **LabAxis 추천** — ai_recommended contactSource (quote.vendor 필드 기반) land
- ✅ **이메일 직접 입력** — showManualFallback state + manual email/name Input + addManualVendor 함수 + footer 링크 (line 419~463, 551~559)

**§11.229 신규 작업 (UX grouping 시각화):**
- resolvedSuppliers 통합 list → 3 section grouping
  - Section 1: 등록된 공급사 (recent_rfq / org_book / supplier_book — 3 source 합쳐서)
  - Section 2: LabAxis 추천 (ai_recommended 만)
  - Section 3: 이메일 직접 입력 (manual section 을 footer 링크 → main scroll 안 promote, always visible)

**Chosen Source of Truth:**
- resolveSuppliers (canonical) spec 변경 0
- contactSource enum (5 source) 변경 0
- UI grouping helper 만 추가 (`groupResolvedSuppliers`)

**Conflicts Found:**
- 없음

**Environment Reality Check:**
- [x] repo / branch context (HEAD = §11.228 land)
- [x] runnable commands (vitest / tsc)

## 1. Priority Fit

**Current Priority Category:**
- [x] P2 / Deferred (호영님 Phase C2 진입 명시 승인 — (c) section header grouping + 3 section 결정)

**Why This Priority:**
- 호영님 v2 spec sheet #21 — 발송 surface UX 강화. release blocker 아님. §11.228 land 후 자연스러운 다음 phase.

## 2. Work Type

- [x] Feature (UX grouping)
- [ ] Bugfix
- [x] Design Consistency
- [x] Web

## 3. Overview

**Feature Description:**
VendorRequestModal 안 resolvedSuppliers 통합 list 를 3 section (등록된 공급사 / LabAxis 추천 / 이메일 직접 입력) 으로 grouping 시각화. 같은 canonical 데이터, UI grouping 만 분리. 호영님 v2 spec "3 경로 modal" 정합.

**Success Criteria:**
- [ ] Section 1: 등록된 공급사 — recent_rfq + org_book + supplier_book 합쳐서 노출 + count badge
- [ ] Section 2: LabAxis 추천 — ai_recommended 만 노출 + count badge
- [ ] Section 3: 이메일 직접 입력 — manual form (email + 공급사명 + 추가 버튼) always-visible, footer 링크 제거
- [ ] resolveSuppliers spec / contactSource enum 변경 0
- [ ] Tabs component 도입 0 (단일 scroll list 안 grouping)
- [ ] vitest / tsc no new errors
- [ ] Chrome smoke (modal 열림 + 3 section 노출 + 직접 입력 form 즉시 노출)
- [ ] ADR-002 §11.229 entry append

**Out of Scope:**
- [x] Tabs component 도입 (호영님 (c) 결정 — 거부)
- [x] resolveSuppliers source 추가 / 변경
- [x] vendor-catalog 신규 schema
- [x] 모바일 RN VendorRequestModal 분기 (§11.229b 백로그)

**User-Facing Outcome:**
- 운영자가 VendorRequestModal 열면 3 section 으로 명확히 분리된 공급사 list 노출
- "이메일 직접 입력" form 이 footer 링크가 아니라 메인 영역 끝에 항상 노출 → 신규 거래처 발견성 ↑

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (단일 modal scroll list)
- [ ] canonical truth (resolveSuppliers / contactSource)
- [ ] invalidation discipline

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant reinterpretation
- [ ] dead button / no-op / placeholder success
- [ ] preview overriding actual truth
- [ ] Tabs derived projection (호영님 거부)

**Canonical Truth Boundary:**
- Source of Truth: `resolveSuppliers` output (4 priority source)
- Derived Projection: section grouping (UI only)
- Snapshot / Preview: addManualVendor 의 임시 supplier (mutation 전)
- Persistence Path: 기존 VendorRequestModal 의 dispatch flow 그대로

**UI Surface Plan:**
- [x] Existing route section (VendorRequestModal 안 list 재구성)
- [ ] New page

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 3 section single-scroll grouping | 호영님 (c) 결정 — same-canvas + canonical truth 보호 + spec "3 경로" 정합 | section 간 visual hierarchy 부담 ↑ — Tailwind border + label + count badge 로 정합 |
| `groupResolvedSuppliers` helper (UI only) | resolveSuppliers spec 변경 0 — UI derive 만 | helper 1 함수 추가 |
| manual form always-visible (footer 링크 제거) | discoverability 강화 — 호영님 v2 spec "3 경로" 의 한 경로 | manual section 항상 차지 → modal height 5~10% ↑ (수용 가능) |

**Dependencies:**
- Required Before Starting: §11.228 (land 완료 ✅)
- External Packages: 없음

**Integration Points:**
- `vendor-dispatch-workbench.tsx` — list 안 grouping + manual form 위치 이동
- `resolve-suppliers.ts` — 변경 0 (그러나 grouping helper 가 contactSource 매핑 사용)

## 6. Global Test Strategy

- Source-level grep sentinel
- 3 section label / count badge / manual form always-visible 검증
- resolveSuppliers / contactSource invariant 보존 (drift sentinel)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** audit 결과 + (c) 3 section 결정 lock.
- Status: [x] Complete

**Notes:** audit 결과 — 3 경로 모두 백엔드 land. UI grouping 만 신규.

### Phase 1: Failing Tests
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** `quote-vendor-modal-3-source-grouping.test.ts` 신설
- (a) 3 section label grep ("등록된 공급사" / "LabAxis 추천" / "이메일 직접 입력")
- (b) count badge grep (registered count / recommended count)
- (c) manual form always-visible (footer 링크 grep 부재 + main scroll 안 form 존재)
- (d) groupResolvedSuppliers helper grep
- (e) invariant 보존 — resolveSuppliers / contactSource enum (5 source) / addManualVendor

**🟢 GREEN:** test fail 확인
**🔵 REFACTOR:** test description + cluster trace marker

**✋ Quality Gate:** RED 실제 fail / 기존 cluster GREEN 유지

**Rollback:** test file revert

### Phase 2: Core Implementation
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🟢 GREEN:**
- `groupResolvedSuppliers` helper 추가 (resolve-suppliers.ts 또는 vendor-dispatch-workbench.tsx 모듈 scope) — { registered, recommended, manual } 분리
- vendor-dispatch-workbench.tsx — list 안 3 section 노출
  - Section 1: "등록된 공급사" + count badge — registered list (recent_rfq + org_book + supplier_book)
  - Section 2: "LabAxis 추천" + count badge — recommended list (ai_recommended)
  - Section 3: "이메일 직접 입력" — manual form (email + 공급사명 + 추가 버튼) always-visible
- footer "+ 후보에 없는 공급사 직접 추가" 링크 제거 (Section 3 가 대체)
- 빈 section 분기 (count === 0 시 빈 안내 또는 hide)

**🔵 REFACTOR:** Tailwind class 정합 + 한국어 라벨 일관성

**✋ Quality Gate:**
- Phase 1 test 통과
- canonical truth 변경 0
- dead button / no-op 0

**Rollback:** vendor-dispatch-workbench.tsx diff revert

### Phase 3: Verify + ADR
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🟢 GREEN:**
- vitest cluster GREEN (§11.229 + 전체 quotes cluster)
- tsc no new errors
- ADR-002 §11.229 entry append
- commit message draft
- Chrome smoke (modal 열림 + 3 section + manual form)

**✋ Quality Gate:** vitest / tsc / ADR / Chrome smoke 통과

**Rollback:** git revert SHA

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| section height 증가로 modal scroll 비대 | Low | Low | Tailwind max-h + overflow-y-auto 기존 그대로, manual form compact 디자인 |
| empty section ("LabAxis 추천 0건") UX 부담 | Med | Low | count === 0 시 hide 또는 "추천 없음" 회색 안내 |
| footer 링크 제거로 회귀 (사용자 기존 흐름) | Low | Low | Section 3 가 더 명확한 discoverability 제공 |

## 10. Rollback Strategy

- Phase 1 fail: test file revert
- Phase 2 fail: vendor-dispatch-workbench.tsx diff revert
- Phase 3 fail: git revert SHA (single commit)

## 11. Progress Tracking

- Overall completion: 10%
- Current phase: Phase 0 complete → Phase 1 RED 진입
- Current blocker: 없음

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock — 3 경로 백엔드 land 확인, (c) 3 section grouping 결정)
- [ ] Phase 1 complete (RED test)
- [ ] Phase 2 complete (3 section grouping + manual promote)
- [ ] Phase 3 complete (ADR + commit + Chrome smoke)

## 12. Notes & Learnings

**Implementation Notes:**
- 호영님 (c) section header grouping 결정 (Tabs 거부 — same-canvas + canonical truth 정합)
- 3 section default 선택 (호영님 v2 spec "3 경로" 정합)
- canonical truth 변경 0 — UI grouping helper 만 추가

---

**Cluster:** §11.229 (Phase C2 / quote-management v2 / #21 공급사 DB UI 3 source grouping)
**Lineage:** §11.217 → §11.225 → §11.226 → §11.227 → §11.228 → §11.229 (현재)
