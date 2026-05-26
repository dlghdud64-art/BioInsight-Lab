# Implementation Plan: §11.306 모바일 UX consolidation (3 sub-batch)

- **Status:** 🔄 In Progress (§11.306a 진입)
- **Started:** 2026-05-26
- **Last Updated:** 2026-05-26
- **Estimated Completion:** 2026-05-26
- **Owner:** Claude (Cowork sandbox) → 호영님 (PowerShell push)

**CRITICAL INSTRUCTIONS** — phase 완료 후 매번:

1. ✅ Check off completed task checkboxes
2. 🧪 Run sentinel test (호영님 환경 위임 — Cowork sandbox vitest 부재)
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT merge a/b/c into one commit (호영님 Q2 = A: 각각 별도 commit)

---

## 0. Truth Reconciliation

**Latest Truth Source (sandbox 직접 audit, 2026-05-26):**

- `apps/web/src/app/dashboard/purchases/page.tsx` (1658 line) — 구매 운영 surface
  - line 146: `const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set())`
  - line 536-540: header CTA `Link href="/dashboard/quotes"` "견적 보관함"
  - line 786: 카드 본문 `<div className="flex items-start gap-4">` (horizontal flex)
  - line 814: `grid grid-cols-1 sm:grid-cols-2 gap-2.5` (이미 모바일 정합)
  - line 879: 우측 사이드 `${isExpanded ? "flex" : "hidden"} sm:flex flex-col items-end gap-2 flex-shrink-0 min-w-[160px]`
  - line 902-916: 모바일 toggle button `purchases-card-mobile-toggle` (sm:hidden, default collapsed)
- `apps/web/src/app/dashboard/inventory/inventory-content.tsx` (4522 line) — 재고 surface
  - line 1081 comment: "expired / out_of_stock → 위험 (bg-red-600 text-white)"
  - §11.302d 신호등 batch 완료 — 위험 배지 자체는 spec 정합
  - dot indicator 정확한 위치는 §11.306c Phase 0에서 식별 (현 grep으로 미특정)

**Secondary References:**

- §11.277c — 모바일 카드 2단계 접힘/펼침 (default collapsed) 도입 commit
- §11.284c — 견적 단계 본문 텍스트 제거 + 금액·공급사명 1줄
- §11.302d 시리즈 — 재고 신호등 통일 (amber → 신호등)
- §11.284d — 구매 운영 base status whitelist filter

**Conflicts Found:**

- 없음 (§11.302d / §11.277c spec 보존 + 모바일 사용성 보강만)

**Chosen Source of Truth:**

- sandbox 직접 audit (이 plan 작성 시점 grep 결과)
- §11.277c isExpanded 토글 패턴 보존 (state / aria / sm:hidden 분기 변경 0)
- §11.302d 위험 배지 본체 색상 (`bg-red-600 text-white`) 보존, dot만 제거

**Environment Reality Check:**

- [x] repo / branch context — main, HEAD `e9497bf1` (§11.303b-2 READY)
- [x] runnable commands — `git diff` / `vitest run` (호영님 환경 위임)
- [x] execution blockers — Cowork sandbox에서 vitest/next build 직접 실행 불가, sentinel 통과는 호영님 push 후 Vercel CI에 위임

---

## 1. Priority Fit

**Current Priority Category:**

- [x] **P1 immediate** — §11.306a (모바일 카드 펼침)
- [x] Post-release — §11.306b (header 견적 보관함 제거)
- [x] Post-release — §11.306c (재고 위험 dot 제거, §11.302d 연계)
- [ ] Release blocker — 해당 없음
- [ ] P2 / Deferred — 해당 없음

**Why This Priority:**

호영님이 매일 사용하는 핵심 surface(구매 운영). §11.277c 도입 이후 모바일 펼침 시 좌측 본문이 152px로 압축되는 구조적 문제 — 펼침 효용성 저하. release-prep P1 Phase 6 (closeout 체크리스트)보다 직접적 운영 영향 큼. b/c는 같은 batch에 묶지만 각각 별도 commit으로 rollback 단위 분리 (호영님 Q2 결정).

---

## 2. Work Type

- [x] Web (반응형 Tailwind)
- [x] Mobile (UX 정합)
- [x] Design Consistency (§11.302d 신호등 연계)
- [ ] Feature / Bugfix (단순 UI 정합)
- [ ] API Slimming / Workflow / Migration / Billing

---

## 3. Overview

**Feature Description:**

§11.306 모바일 UX consolidation 3 sub-batch:

- **§11.306a (P1):** 구매 운영 카드 펼침 시 모바일 1컬럼 세로 흐름 (md 이상 2컬럼 유지). 좌측 본문 + 우측 사이드 정보가 모바일에서 위→아래 stack, sm 이상에서 좌우 row.
- **§11.306b (P2):** 구매 운영 header 우측 "견적 보관함" Link 제거 — 하단 탭바 `/dashboard/quotes` 와 중복.
- **§11.306c (P2):** 재고 "위험" 배지 좌측 dot indicator 제거 (옵션 A — 호영님 확정). 배지 본체 색상으로 시각 충분.

**Success Criteria:**

- [ ] **§11.306a:** 모바일 (375~414px) 카드 펼침 시 위→아래 흐름, sm (640px+) 좌우 row, lg (1024px+) 변화 0
- [ ] **§11.306a:** 카드 접힘 (default) 상태 변화 0, 우측 사이드 hidden 유지
- [ ] **§11.306b:** header "견적 보관함" Button 0 occurrence + Link `/dashboard/quotes` import/wiring 정합
- [ ] **§11.306c:** "위험" 배지 안 dot element (rounded-full bg-* class) 0 occurrence, §11.302d 신호등 회귀 0

**Out of Scope (⚠️ 절대 구현하지 말 것):**

- [ ] §11.277c isExpanded state / toggle / sm:hidden 분기 변경 (보존)
- [ ] §11.302d 신호등 색상 토큰 변경 (보존)
- [ ] 견적 보관함 → 새로운 라우트 mapping (단순 제거만)
- [ ] 카드 collapse/expand 기본값 변경 (default collapsed 유지)
- [ ] §11.298e ActionMenu / Radix dropdown wiring 변경
- [ ] PO/Receiving handoff 로직 변경

**User-Facing Outcome:**

- §11.306a: 호영님 모바일에서 카드 "더 보기" 탭 → 본문 밑에 결정 보조정보 / 가격 / 견적 상세 link가 가독성 있게 stack. 152px 압축 끝.
- §11.306b: 구매 운영 진입 시 header CTA 1개("소싱")만 — 하단 탭바와 정합.
- §11.306c: 재고 위험 배지 시각 노이즈 감소 (배지 색상으로 충분).

---

## 4. Product Constraints

**Must Preserve:**

- [x] workbench / queue / rail / dock (purchases는 queue surface, 구조 변경 0)
- [x] same-canvas (page 추가 0)
- [x] canonical truth (resolver / engine / API 변경 0, UI surface only)
- [x] invalidation discipline (React Query 변경 0)

**Must Not Introduce:**

- [x] page-per-feature 회귀
- [x] chatbot/assistant reinterpretation of ontology
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**

- Source of Truth: `usePurchasesQuery` (server data) — 변경 0
- Derived Projection: `STATUS_MAP`, `DECISION_SUPPORT_STATUS_LABEL`, `BLOCKER_LABEL` — 변경 0
- Snapshot / Preview: 없음
- Persistence Path: 없음 (read-only UI surface)

**UI Surface Plan:**

- [x] Existing route section (purchases/page.tsx + inventory-content.tsx 안 inline)
- [ ] Inline expand / Right dock / Bottom sheet / Split panel / Settings panel / New page

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Tailwind responsive prefix only (`flex-col sm:flex-row`) | minimal diff, JS 변경 0 | 없음 |
| 각각 별도 commit (a/b/c) | rollback 단위 분리, 호영님 Q2 | commit history 3건 증가 (acceptable) |
| §11.306c dot 제거 = 옵션 A | 호영님 Q3 확정 — 배지 본체로 시각 충분 | 좀 더 강한 시선 유도가 필요하면 후속 §11.306c-2에서 outer ring 등 |
| sentinel test readFileSync + regex | Cowork sandbox vitest 부재 → CI에서 검증 | sandbox에서 즉시 실행 불가 |

**Dependencies:**

- Required Before Starting: §11.303b-2 READY ✅ (`e9497bf1` 확정)
- External Packages: 없음 (Tailwind class만)
- Existing Routes / Models / Services Touched: 없음 (UI only)

**Integration Points:**

- §11.306a: `purchases/page.tsx` 카드 영역 (line 786 + line 879)
- §11.306b: `purchases/page.tsx` header (line 536-540) + import cleanup (`FileText` 다른 사용처 확인)
- §11.306c: `inventory-content.tsx` 위험 배지 dot (Phase 0에서 정확한 위치 식별)

---

## 6. Global Test Strategy

각 phase는 strict Red-Green-Refactor.

**Test Strategy:**

- §11.306a: sentinel `purchases-card-expanded-mobile-1col-306a.test.ts` — line 786 + line 879 className regex
- §11.306b: sentinel `purchases-header-quotes-archive-removed-306b.test.ts` — "견적 보관함" literal 0 + `/dashboard/quotes` Link absence in header
- §11.306c: sentinel `inventory-risk-badge-dot-removed-306c.test.ts` — 위험 배지 안 `rounded-full bg-(red|rose)-*` element 0

**Execution Notes:**

- Cowork sandbox에 vitest 미설치 → sentinel test 작성은 가능, run은 호영님 환경 또는 Vercel CI 위임
- 모든 sentinel은 readFileSync + regex 패턴 (§11.298f / §11.303b-2 패턴 정합)
- 호영님 환경 push 후 Vercel build PASS = green 간주

---

## 7. Implementation Phases

### §11.306a — 구매 운영 카드 펼침 모바일 1컬럼 (P1)

#### Phase 0: Context & Truth Lock — ✅ Complete

- 카드 본문 line 786 `flex items-start gap-4` 식별
- 우측 사이드 line 879 `${isExpanded ? "flex" : "hidden"} sm:flex` + `min-w-[160px]` 식별
- 모바일 360px 펼침 시 좌측 = 360 - 160 - 16(gap) - 32(padding) = **152px** 압축 confirmed

#### Phase 1: Sentinel Test (RED)

- [ ] 새 file `apps/web/src/__tests__/regression/purchases-card-expanded-mobile-1col-306a.test.ts`
- [ ] regex assertion 1: line 786 컨테이너에 `flex-col sm:flex-row` 패턴 포함
- [ ] regex assertion 2: line 879 우측 사이드에 `w-full sm:w-auto` 패턴 포함
- [ ] regex assertion 3: §11.277c isExpanded state / aria-expanded / toggle button 보존
- [ ] regex assertion 4: collapsed default (`hidden` 분기) 보존

**✋ Quality Gate:** sentinel 작성 + 호영님 push 전까지 fail 예상 (현재 className 미정합)

**Rollback:** sentinel 파일만 revert

#### Phase 2: Minimal Diff Fix (GREEN)

- [ ] `purchases/page.tsx:786` swap
  - Before: `<div className="flex items-start gap-4">`
  - After: `<div className="flex flex-col sm:flex-row sm:items-start gap-4">`
- [ ] `purchases/page.tsx:879` swap
  - Before: `<div className={`${isExpanded ? "flex" : "hidden"} sm:flex flex-col items-end gap-2 flex-shrink-0 min-w-[160px]`}`
  - After: `<div className={`${isExpanded ? "flex" : "hidden"} sm:flex flex-col items-end gap-2 flex-shrink-0 w-full sm:w-auto sm:min-w-[160px]`}`

**✋ Quality Gate:**

- [ ] sentinel green (호영님 vitest 또는 Vercel CI)
- [ ] sm+ 데스크탑 시각 변화 0 (sm:items-start 보존)
- [ ] lg 변화 0
- [ ] 카드 collapsed 기본 상태 시각 변화 0

**Rollback:** 2 line revert

#### Phase 3: Smoke & Commit Draft

- [ ] `docs/commit-drafts/COMMIT_11.306a-purchases-card-mobile-1col.md` 작성
- [ ] present_files 카드 노출 → 호영님 push
- [ ] Vercel build PASS 확인
- [ ] 호영님 모바일 (실기기) 펼침 시 위→아래 흐름 확인

**✋ Quality Gate:**

- [ ] Vercel READY
- [ ] 호영님 production smoke OK
- [ ] §11.277c sentinel 회귀 0

**Rollback:** git revert <SHA>

---

### §11.306b — 구매 운영 header "견적 보관함" 제거 (P2)

#### Phase 0: Context & Truth Lock

- [ ] line 536-540 Link element confirmed
- [ ] `FileText` import 다른 사용처 grep (해당 import 유지 여부 결정)
- [ ] 하단 탭바 `/dashboard/quotes` wiring 보존 확인

#### Phase 1: Sentinel Test (RED)

- [ ] 새 file `apps/web/src/__tests__/regression/purchases-header-quotes-archive-removed-306b.test.ts`
- [ ] regex assertion 1: `purchases/page.tsx` header 영역에 "견적 보관함" 0 occurrence
- [ ] regex assertion 2: header 영역 `Link href="/dashboard/quotes"` absence (다른 위치는 보존)
- [ ] regex assertion 3: header "소싱" Link `/app/search` 보존

#### Phase 2: Minimal Diff Fix (GREEN)

- [ ] line 536-540 Link 블록 제거
- [ ] `FileText` import — 다른 사용처 있으면 보존, 없으면 제거

**✋ Quality Gate:**

- [ ] sentinel green
- [ ] header "소싱" CTA 1개만 남음
- [ ] 하단 탭바 `/dashboard/quotes` 동작 0 회귀

**Rollback:** ~5 line revert

#### Phase 3: Smoke & Commit Draft

- [ ] commit draft + present_files
- [ ] Vercel READY 확인
- [ ] 호영님 모바일 header 1 CTA 확인

---

### §11.306c — 재고 위험 배지 dot indicator 제거 (P2, §11.302d 연계)

#### Phase 0: Context & Truth Lock

- [ ] `inventory-content.tsx`에서 위험 배지 dot element 정확한 위치 식별
  - "위험" 텍스트 좌측 인접 element 중 `rounded-full bg-(red|rose)-*` 찾기
  - line 2076 / 2155 / 2453 후보 그리드 area 확인
- [ ] §11.302d 신호등 토큰 (bg-red-600 text-white) 영향 0 확인

#### Phase 1: Sentinel Test (RED)

- [ ] 새 file `apps/web/src/__tests__/regression/inventory-risk-badge-dot-removed-306c.test.ts`
- [ ] regex assertion 1: 위험 배지 element 안 dot (rounded-full bg-*-*) 0 occurrence
- [ ] regex assertion 2: 배지 본체 색상 `bg-red-600 text-white` 보존
- [ ] regex assertion 3: §11.302d sentinel 회귀 0 (다른 신호등 색상 보존)

#### Phase 2: Minimal Diff Fix (GREEN)

- [ ] 위험 배지 안 dot `<span>` element 제거
- [ ] 배지 본체 className 변경 0

**✋ Quality Gate:**

- [ ] sentinel green
- [ ] §11.302d 회귀 0
- [ ] 위험 배지 시각 그대로 (배지 색상만)

**Rollback:** 1-2 line revert

#### Phase 3: Smoke & Commit Draft

- [ ] commit draft + present_files
- [ ] Vercel READY 확인
- [ ] 호영님 재고 페이지 위험 배지 시각 확인

---

## 8. Optional Addenda

### A. Mobile Addendum (전체 적용)

**Must Include:**

- [x] viewport: 375~414px (iPhone SE~14 Pro Max)
- [x] sm breakpoint: 640px+ (iPad 세로)
- [x] md breakpoint: 768px+ (iPad 가로)
- [x] lg breakpoint: 1024px+ (desktop, 변화 0 보장)

**Validation:**

- [ ] §11.306a: 모바일 펼침 시 좌측 본문 폭 ≥ 280px (이전 152px → ~327px 회복, 360px viewport 기준)
- [ ] §11.306a/b/c: 데스크탑 시각 변화 0

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| §11.306a — sm:items-end가 모바일 stack 시 우측 align로 보임 | Med | Low | 모바일에서 items-stretch 또는 items-start로 재조정 가능 (Phase 2 visual check) |
| §11.306b — `FileText` import 제거 시 다른 사용처 깨짐 | Low | Med | Phase 0에서 grep 강제 |
| §11.306c — dot 위치 미식별 시 부정확한 제거 | Med | Med | Phase 0 grep 필수 (확정 전 진입 금지) |
| sentinel test 작성 미스 → false positive | Low | Low | 패턴 참조 (§11.298f, §11.303b-2) |
| Vercel build CRLF 재발 | Low | High | `.gitattributes` (§11.303-hotfix-c) 정합 — 차단됨 |

---

## 10. Rollback Strategy

- If §11.306a Phase 2 Fails: 2 line revert (line 786 + line 879)
- If §11.306b Phase 2 Fails: ~5 line revert (Link 블록)
- If §11.306c Phase 2 Fails: 1-2 line revert (dot span)

**Special Cases:** 없음 (DB / billing / rollout 변경 0)

---

## 11. Progress Tracking

- Overall completion: 5%
- Current phase: §11.306a Phase 1 (sentinel 작성)
- Current blocker: 없음
- Next validation step: §11.306a Phase 1 sentinel + Phase 2 swap

**Phase Checklist:**

- [x] §11.306a Phase 0 — Context & Truth Lock
- [ ] §11.306a Phase 1 — Sentinel Test (RED)
- [ ] §11.306a Phase 2 — Minimal Diff Fix (GREEN)
- [ ] §11.306a Phase 3 — Smoke & Commit Draft
- [ ] §11.306b Phase 0
- [ ] §11.306b Phase 1
- [ ] §11.306b Phase 2
- [ ] §11.306b Phase 3
- [ ] §11.306c Phase 0
- [ ] §11.306c Phase 1
- [ ] §11.306c Phase 2
- [ ] §11.306c Phase 3

---

## 12. Notes & Learnings

**Blockers Encountered:**

- (none yet)

**Implementation Notes:**

- §11.306a 진짜 root cause = horizontal flex + min-w[160px] 조합. CSS responsive prefix 2 swap으로 fix (JS 변경 0).
- §11.277c sentinel + §11.302d sentinel 정합 강제 — 회귀 0 보장.
- 호영님 Q2 결정 = 각각 별도 commit. plan은 하나, commit은 3개.
- sentinel test는 readFileSync + regex 패턴 (Cowork sandbox vitest 부재 환경 대응).
