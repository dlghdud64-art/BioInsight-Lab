# Implementation Plan: §11.61 Purchases Right Rail Inline Action Wiring

- **Status:** ✅ Complete (Phase 0+1 통합 commit, Phase 2 배포 대기)
- **Started:** 2026-04-28
- **Last Updated:** 2026-04-28
- **Estimated Completion:** 2026-04-29

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
⛔ DO NOT introduce page-per-feature regression

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/app/dashboard/purchases/page.tsx` (833 lines, current working tree at commit `3bac31fd`)
- 호영님 발화: "검토, 회신 확인, 발주 전환을 어떻게 한다는건지 모르겠네" (이전 turn)
- §11.39 ADR — `/dashboard/quotes/[quoteId]` page-per-feature 제거
- §11.22 ADR — `/api/work-queue/purchase-conversion/bulk-po` bulk endpoint
- §11.60 ADR — quotes cluster dead capability 5건

**Chosen Source of Truth:**
- prisma schema의 QuoteStatus enum (Phase 0 확정)
- `/dashboard/quotes/page.tsx` 의 caller 패턴 (alive endpoint inventory)

---

## 1. Priority Fit

- [x] **Post-release** — workflow route 핵심 약속 위반 해소

---

## 2. Work Type

- [x] Workflow / Ontology Wiring
- [x] Web
- [x] API Slimming (부분 — dead capability alive 전환)

---

## 3. Overview

`/dashboard/purchases` right rail 에 stage-aware inline action 3개 추가. 헤더 약속 ("검토 / 회신 확인 / 발주 전환을 한 화면에서") 이 surface 와 일치하도록.

**Out of Scope:**
- 새 page 추가
- 새 endpoint 신규 (가능하면)
- `/dashboard/quotes` 모든 action 복제
- Order 운영 surface 신규 (#order-operator-surface 별도)

---

## 4. Product Constraints

**Must Preserve:**
- workbench / queue / rail / dock
- same-canvas (page navigation 0)
- canonical truth (Quote.status backend 결정)

**Must Not Introduce:**
- page-per-feature
- dead button / no-op / front-only success
- preview overriding actual truth

**UI Surface:** Inline expand (right rail 안)

---

## 5. Architecture & Dependencies

| Decision | Rationale |
| :--- | :--- |
| right rail 안 stage-aware action 1개 | LabAxis workflow route 원칙 + same-canvas |
| 기존 alive endpoint 재사용 | minimal-diff |
| optimistic update 안 함 | front-only success 회귀 차단 |
| "견적 상세" 는 secondary 유지 | deep dive 보존 |

**Touched files (예상):**
- `apps/web/src/app/dashboard/purchases/page.tsx` — right rail 영역
- `apps/web/src/lib/purchases/rail-action-resolver.ts` (신규)
- `apps/web/src/__tests__/lib/purchases/rail-action-resolver.test.ts` (신규)

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending

**Tasks:**
- [ ] Quote.status enum (prisma schema) 확정
- [ ] `/dashboard/quotes/page.tsx` 에서 stage별 어떤 mutation/endpoint 호출하는지 grep
- [ ] `/api/quotes/[id]/status` route body schema 확인
- [ ] `/api/work-queue/purchase-conversion/bulk-po` single-item 호출 가능 여부
- [ ] §11.60 dead candidate 와 교차 — 본 트랙이 alive 시킬 endpoint 식별

**✋ Quality Gate:**
- [ ] stage 전이 graph 확정
- [ ] stage별 endpoint 매핑 확정
- [ ] §11.22 utility 재사용 path 확정

---

### Phase 1: Contract & Failing Tests
- Status: [ ] Pending

**Tasks:**
- [ ] 🔴 RED: `lib/purchases/rail-action-resolver.ts` (신규) + test 4~5 case (각 stage별)
- [ ] 🟢 GREEN: resolver 최소 구현
- [ ] 🔵 REFACTOR: type / naming

**✋ Quality Gate:**
- [ ] vitest 4~5/4~5 PASS
- [ ] resolver pure function

---

### Phase 2: API / Route / UI Wiring
- Status: [ ] Pending

**Tasks:**
- [ ] right rail 안 `<RailActionZone>` inline JSX
- [ ] `useMutation` + onSuccess invalidate
- [ ] 회신 등록 case → quote-intake-dock open trigger
- [ ] "견적 상세 페이지 열기" secondary 유지
- [ ] loading / error / disabled state

**✋ Quality Gate:**
- [ ] 실제 endpoint POST/PATCH 발생
- [ ] 응답 후에만 success toast (front-only success 0)
- [ ] queryInvalidate 후 row stage 갱신
- [ ] disabled during mutation
- [ ] error toast on failure (§11.52 패턴)

---

### Phase 3: Smoke / Rollout / ADR Closeout
- Status: [ ] Pending

**Tasks:**
- [ ] /tmp index plumbing commit
- [ ] 호영님 push
- [ ] Vercel build 결과 확인
- [ ] Claude in Chrome 또는 manual smoke
- [ ] ADR §11.61 entry
- [ ] §11.60 advisory script 다음 run에서 alive endpoint 자동 dead list 제거 확인

**✋ Quality Gate:**
- [ ] prod smoke PASS
- [ ] ADR entry
- [ ] rollback path 명확

---

## 8. Workflow / Ontology Addendum

**Resolver Input:**
- current route: `/dashboard/purchases`
- selection: selected Quote (selectedItem)
- stage: Quote.status
- blockers: backend signals (F-3 Block 등)

**Expected Output:**
- review_required → "선택안 확정"
- responded → "회신 등록"
- ready_for_po → "발주 전환"
- completed → null
- cancelled → null

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| stage 전이 graph 가설과 다름 | Med | Med | Phase 0 audit |
| dead candidate endpoint 가 실제로 broken | Low | High | Phase 2 mutation error toast로 surface |
| 호영님 prod 데이터 stage 다양성 부족 | High | Low | review_required 우선 wired, 나머지 데이터 누적 후 |
| line ending CRLF/LF | Med | Low | perl normalize |

---

## 10. Rollback

- Phase 0 fail: planning-only
- Phase 1 fail: resolver + test 2 file 삭제
- Phase 2 fail: page.tsx 1 chunk revert
- Phase 3 fail: git revert HEAD

---

## 11. Progress Tracking

- Overall: 5%
- Current phase: 0 (in progress)
- Blocker: none

**Phase Checklist:**
- [ ] Phase 0
- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3

---

## 12. Notes & Learnings

(Phase 진행하며 갱신)
