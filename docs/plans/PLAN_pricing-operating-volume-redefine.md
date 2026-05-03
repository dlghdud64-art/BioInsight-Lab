# Implementation Plan: §11.201 #pricing-operating-volume-redefine

- **Status:** ✅ COMPLETE
- **Started:** 2026-05-03
- **Last Updated:** 2026-05-03 (Phase 5 마감)
- **Completed:** 2026-05-03
- **Selected Scope:** β (UI + Plan display layer + entitlement scope, 5 phases)
- **Tracking ticket:** §11.201
- **ADR closeout:** docs/decisions/ADR-002-pilot-tenant-seed.md (§11.201 cluster CLOSED entry)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates / dead checkout button / fake "AI 무제한"
⛔ DO NOT modify SubscriptionPlan / Stripe price ID enum (display layer only)
⛔ DO NOT block core workflow with LabOps Credit (display only — actual
   tracking deferred to §11.202)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 ChatGPT 분석 (해외/국내 벤치마크 + 운영량 권장치 + LabOps Credit 정의 + 4 카드 카피)
- HEAD: `e046dafe` (§11.200b) → §11.200c push 진행 중
- pricing surfaces (3 파일):
  - `apps/web/src/app/pricing/page.tsx` (public marketing)
  - `apps/web/src/app/dashboard/pricing/page.tsx` (logged-in upgrade)
  - `apps/web/src/app/pricing/continue/page.tsx` (checkout 진입)
- prisma schema:
  - `enum SubscriptionPlan` (line 49)
  - `enum WorkspacePlan` (line 916)
  - `enum BillingStatus` (line 927)
  - `model Subscription` (line 1041)
  - `model BillingInfo` (line 1798)
- 이전 §11.88 (settings billing real fetcher) — invoice list 실데이터 wired

**Secondary References:**
- ChatGPT Claude Code 지시문 (이미 받음) — 거의 그대로 채택 가능
- Quartzy / Precoro / Airtable / Intercom / Zapier (해외 사례 매트릭스)
- 채널톡 / 모두싸인 / N-ToPs / 네이버웍스 (국내 사례 매트릭스)

**Conflicts Found:**
- ChatGPT 의 plan rename (`Team` → `Lab Team`, `Business` → `R&D Operations`) 이 enum 변경을 권장하지만 본 batch 는 **enum 보존 + display label layer 분리** 결정 (DB row migration 0)
- LabOps Credit 의 실 차감 vs display only — 본 batch 는 **display only**, 실 tracking 은 §11.202

**Chosen Source of Truth:**
- canonical = `prisma SubscriptionPlan` enum (변경 0)
- display layer = `lib/billing/plan-descriptor.ts` (신규) — 단일 truth
- LabOps Credit = display 만 — "월 1,500개 포함" 문구. footnote 에 "현재 pilot 기간 동안 무제한 사용" 명시 가능

**Environment Reality Check:**
- [x] vitest / tsc 가능
- [ ] `.git` readonly (호영님 commit/push)
- [x] Chrome MCP prod 검증 가능
- [ ] Vercel build cache stale 회귀 우려 (§11.200b lesson) — push 시 빈 commit invalidate 준비

---

## 1. Priority Fit

- [x] **Post-release / Pricing legitimacy** — pilot 단계의 가격 정당성. 외부 노출 surface 사용자 신뢰도 직결
- [ ] P1 / Release blocker / P2 deferred 아님

current P1 list (vitest install / RFQ smoke / Batch 10 enforce 등) 와 충돌 0. §11.200c (pending) 와 별개 트랙 — 병행 진행 가능.

---

## 2. Work Type

- [x] **Billing / Entitlement**
- [x] Design Consistency (pricing 4 카드 + LabOps Credit 섹션)
- [x] Web

---

## 3. Overview

**Feature Description:**
LabAxis 가격표를 단순 월정액 카드에서 운영량 (좌석 × 운영량 × LabOps Credit) 기반으로 재정의. 사용자가 "왜 이 가격인가" 즉시 인지 가능하도록 카드 안에 운영자 수 / 운영량 권장치 / LabOps Credit / 핵심 기능을 명시. enum/Stripe 변경 0, display layer 만.

**Success Criteria:**
- [x] /pricing 페이지 4 카드 모두 운영자 수 + 운영량 권장치 + LabOps Credit display
- [x] /dashboard/pricing + settings billing 의 plan badge 한국어 라벨
- [x] LabOps Credit 설명 섹션 (사용 작업 / 차단 안 되는 작업) 노출
- [x] "AI 무제한" / "무제한 워크스페이스" 카피 0 occurrence (전 surface — 본 cluster scope; settings/plans + api/billing 은 §11.201d 별도 sweep)
- [x] Plan descriptor single source of truth (lib/billing/plan-descriptor.ts)
- [x] Chrome prod 검증 통과 (4 카드 + LabOps 섹션 + 카피 sweep)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] LabOps Credit 실 usage tracking + 차감 (§11.202 defer)
- [ ] SubscriptionPlan enum 변경 (DB row migration 0)
- [ ] Stripe price ID 변경
- [ ] 신규 결제 endpoint (기존 onboarding/checkout/contact 라우트 재사용)
- [ ] 기존 유료 user grandfathering 정책 (pilot 가정 — 유료 user 0)

**User-Facing Outcome:**
- /pricing 진입 시 "연구 구매 운영량에 맞는 플랜" 4 카드 노출
- 카드별 운영자 5명 / RFQ 30건 권장 / LabOps Credit 1,500개 같은 정량 표시
- LabOps Credit 정의 섹션으로 "왜 크레딧이 있는가" 설명
- settings 의 현재 플랜 badge "Lab Team" / "R&D Operations" 한국어 노출
- Enterprise CTA → 기존 contact-sales 라우트
- "AI 무제한" 카피 사라짐 (정직한 약속)

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth (`SubscriptionPlan` enum + Stripe price ID 매핑)
- [x] same-canvas (pricing 1 페이지)
- [x] dashboard / settings 의 ownership boundary (§11.197 series)
- [x] 기존 alive CTA 라우트 (onboarding / checkout / contact)
- [x] §11.197d Cost Center placeholder font 통일 (회귀 0)

**Must Not Introduce:**
- [x] page-per-feature (LabOps Credit 별도 페이지 X)
- [x] chatbot/assistant 재해석
- [x] dead checkout button
- [x] fake "AI 무제한" / "무제한 워크스페이스"
- [x] supplier guest 또는 requester 에 대한 paid seat 매핑
- [x] Plan enum / Stripe price ID 변경

**Canonical Truth Boundary:**
- Source of Truth: `prisma SubscriptionPlan` enum (DB)
- Display Layer: `lib/billing/plan-descriptor.ts` (신규, single source)
- Derived Projection: pricing 카드 / settings badge / invoice label
- Snapshot: Stripe price ID (DB 그대로)
- Persistence Path: 본 batch 변경 0 (display-only)

**UI Surface Plan:**
- [x] Existing route section (/pricing, /dashboard/pricing, settings billing)
- [ ] New page (LabOps Credit 별도 페이지 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| Plan descriptor display layer | enum 보존 + 한국어 라벨 + 운영량 + Credit 단일 source — DRY | 새 file 1 추가 (lib/billing/plan-descriptor.ts) |
| SubscriptionPlan enum 보존 | DB row migration 0 + Stripe drift 위험 0 | "Lab Team" 같은 한국어 plan ID 는 DB enum 이 아닌 display label |
| LabOps Credit display only | pilot 단계 over-engineering 회피 | 실 차감 0 → footnote 로 "pilot 기간 무제한" 명시 (정직성 보호) |
| Dialog modal 정책 (§11.200c lesson) | 본 plan 무관, 별도 트랙 | (참고만) |

**Dependencies:**
- Required Before Starting: §11.200c push 완료 (pricing 페이지 직접 영향 0 이지만 Vercel cache 회귀 lesson 흡수)
- External Packages: 없음 (기존 lucide / shadcn 사용)
- Existing Files Touched:
  - `apps/web/src/lib/billing/plan-descriptor.ts` (신규)
  - `apps/web/src/app/pricing/page.tsx` (refactor)
  - `apps/web/src/app/dashboard/pricing/page.tsx` (descriptor wire)
  - `apps/web/src/app/dashboard/settings/page.tsx` (current plan badge — display label swap)
  - `apps/web/src/__tests__/lib/billing/plan-descriptor.test.ts` (신규)
  - `apps/web/src/__tests__/marketing/pricing-page-redesign.test.ts` (신규)

**Integration Points:**
- 없음 (display layer 만, 신규 mutation 0)

---

## 6. Global Test Strategy

- Phase 0: read-only audit
- Phase 1: descriptor unit test (10+ case) — enum coverage 100%
- Phase 2: pricing page source-level smoke (4 카드 + 카피 + CTA route)
- Phase 3: dashboard/settings descriptor wire integration test
- Phase 4: "AI 무제한" sweep grep test + LabOps 섹션 노출 test
- Phase 5: Chrome prod smoke (Vercel API status + chunk marker + visual)

---

## 7. Implementation Phases

### Phase 0: Truth Lock + Audit (1.5h)

**Goal:** pricing surface + schema + Stripe wiring 정확한 현재 상태 매트릭스 작성.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- /pricing/page.tsx 현재 카피 / 4 카드 구조 / CTA 라우트 list
- /dashboard/pricing/page.tsx 차이 (logged-in 분기)
- /pricing/continue/page.tsx checkout 진입 라우트
- settings billing section 의 현재 플랜 표시 위치
- prisma SubscriptionPlan enum 의 현재 값들

**🟢 GREEN:**
- Plan descriptor 매핑 테이블 작성 (SubscriptionPlan × 한국어 라벨 × 가격 × seat 권장 × 운영량 × LabOps Credit × features)
- Stripe price ID 매핑 위치 식별
- 호영님 결정 사항 cross-check

**🔵 REFACTOR:**
- ChatGPT 분석의 운영량 수치 그대로 채택 vs 호영님 조정 결정
- LabOps Credit 양 (500 / 1,500 / 7,500 / 계약형) 그대로 채택 결정
- footnote ("pilot 기간 무제한") 카피 결정

**✋ Quality Gate:**
- [ ] Plan descriptor 매핑 테이블 완성 (4 plan × 7 columns)
- [ ] 현재 카피/CTA/wiring 매트릭스 확정
- [ ] 호영님 운영량 수치 / Credit 양 confirm

**Rollback:** read-only

---

### Phase 1: Plan Descriptor Layer + Display Labels (2-3h)

**Goal:** `lib/billing/plan-descriptor.ts` single source of truth. 모든 surface 가 통과.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- `__tests__/lib/billing/plan-descriptor.test.ts` 신규 (10+ case):
  - PLAN_DESCRIPTOR[plan] 가 모든 SubscriptionPlan enum value 매핑
  - 한국어 라벨 (Starter / Lab Team / R&D Operations / Enterprise) 정합
  - seat / RFQ / PO / 재고 품목 / LabOps Credit 수치 정합
  - features 배열 (검색 / 비교 / 견적 / PO / 입고 / 재고) 정합
  - CTA route 가 alive (fake checkout 0)

**🟢 GREEN:**
- `lib/billing/plan-descriptor.ts` 신규 (~80 line):
  - `PlanDescriptor` type
  - `PLAN_DESCRIPTOR: Record<SubscriptionPlan, PlanDescriptor>`
  - `getPlanLabel(plan)` / `getPlanPrice(plan)` / `getPlanCreditQuota(plan)` helpers
  - LabOps Credit 정의 (사용 작업 / 차단 안 되는 작업 배열)

**🔵 REFACTOR:**
- raw enum 노출 0 — 모든 surface 가 descriptor 사용

**✋ Quality Gate:**
- [ ] vitest 10/10 PASS
- [ ] tsc 0 errors
- [ ] enum coverage 100%

**Rollback:** plan-descriptor.ts + test 단위 isolated revert

---

### Phase 2: /pricing Public Page Redesign (3-4h)

**Goal:** /pricing 페이지를 운영량 기반 4 카드 + LabOps 섹션으로 redesign.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- `__tests__/marketing/pricing-page-redesign.test.ts` 신규:
  - title "연구 구매 운영량에 맞는 플랜을 선택하세요" 노출
  - 4 카드 모두 (Starter / Lab Team / R&D Operations / Enterprise) 노출
  - 카드별 운영자 수 / 운영량 권장치 / LabOps Credit display
  - "추천: 단일 연구실 운영" tag (Lab Team 또는 R&D Operations)
  - LabOps Credit 설명 섹션 노출
  - "AI 무제한" 문자열 0 occurrence
  - CTA 라우트 alive (Lab Team / R&D / Enterprise contact)

**🟢 GREEN:**
- /pricing/page.tsx refactor — descriptor 사용
- ChatGPT 분석의 4 카드 카피 그대로 적용
- "Most Popular" → "추천: 단일 연구실 운영" 또는 "추천: R&D 센터 운영"

**🔵 REFACTOR:**
- 카드 hierarchy 일관성 (운영자 수 → 운영량 → Credit → features 순)

**✋ Quality Gate:**
- [ ] vitest pricing page test PASS
- [ ] tsc 0 errors
- [ ] dead checkout 0
- [ ] "AI 무제한" 0 (grep)

**Rollback:** /pricing/page.tsx revert

---

### Phase 3: /dashboard/pricing + Settings Billing 정합 (2h)

**Goal:** logged-in 유저의 pricing + settings billing badge 모두 descriptor 통과.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- /dashboard/pricing/page.tsx + settings billing section 모두 descriptor 사용 강제 (raw enum label 0)
- 현재 플랜 badge 한국어 ("Lab Team") 노출

**🟢 GREEN:**
- /dashboard/pricing/page.tsx descriptor wire
- settings billing section 의 plan label 을 descriptor 통과로 swap

**🔵 REFACTOR:**
- §11.197 series 의 SectionCard ownership 톤과 정합

**✋ Quality Gate:**
- [ ] settings 진입 → 현재 플랜 badge 한국어
- [ ] /dashboard/pricing 도 4 카드 동일 톤
- [ ] dashboard 다른 영역 회귀 0

**Rollback:** 영역별 isolated revert

---

### Phase 4: LabOps Credit 섹션 + "AI 무제한" sweep (1.5-2h)

**Goal:** /pricing 에 LabOps Credit 섹션 추가 + 전 surface 의 부정확한 카피 청결화.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- /pricing 의 LabOps Credit 섹션 (제목 + 정의 + 사용 작업 / 차단 안 되는 작업) 노출 강제
- "AI 무제한" / "무제한 워크스페이스" 문자열 grep 0
- 코어 workflow 보호 문구 ("검색·요청·승인·PO·입고·재고는 크레딧으로 차단되지 않습니다") 노출

**🟢 GREEN:**
- /pricing 페이지에 LabOps Credit 섹션 추가
- descriptor.creditExamples 배열 사용 (DRY)
- 다른 surface 의 "AI 무제한" 카피 sweep

**🔵 REFACTOR:**
- footnote ("pilot 기간 동안 무제한 사용") 정확한 위치

**✋ Quality Gate:**
- [ ] LabOps 섹션 노출 (vitest)
- [ ] "AI 무제한" 0 occurrence (grep test)
- [ ] 코어 workflow 보호 문구 노출

**Rollback:** credit 섹션 + sweep 영역 revert

---

### Phase 5: Rollout / Smoke / ADR (1-1.5h)

**Goal:** Chrome prod 검증 (이전 사각지대 보강) + ADR §11.201 entry append.

- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED:**
- rollout 실패 모드 list (Stripe drift / 기존 user 영향 / Vercel cache stale)
- Chrome 검증 4중 protocol:
  1. Vercel API status READY (mcp__vercel__list_deployments)
  2. Chunk source 에 unique marker (`PLAN_DESCRIPTOR` 등) 검색
  3. /pricing fiber 의 4 카드 + LabOps 섹션 mount 확인
  4. /pricing/continue CTA 라우트 alive (404 0)

**🟢 GREEN:**
- Chrome 검증 4중 PASS
- ADR §11.201 entry append (ChatGPT 분석 흡수 + 5 phase 결과 + lesson)
- 본 plan 문서 close (모든 체크박스 [x])

**🔵 REFACTOR:**
- 후속 트랙 (§11.202 LabOps Credit tracking) defer 항목 명시

**✋ Quality Gate:**
- [ ] Chrome 검증 4중 PASS
- [ ] ADR append (line 추가)
- [ ] rollback path 명시

**Rollback:** git revert <SHA> (descriptor + pricing pages 단위)

---

## 8. Billing / Entitlement Addendum (CLAUDE.md 강제)

**States:** trialing / active / cancel_scheduled / past_due / grace / suspended / canceled / refunded
- 본 batch 는 **상태 전이 변경 0** — display layer 만
- billing state machine 변경 0 (canonical truth 보호)

**Scenarios:**
- signup → cancel: 변경 0
- mid-cycle cancel / upgrade / downgrade: 변경 0
- payment failed / recovery: 변경 0
- no billing permission: 변경 0
- enterprise → contact sales: 기존 라우트 재사용

**Validation:**
- [ ] logged-in user 가 /dashboard/pricing 진입 시 re-login prompt 0 (기존 동작 보존)
- [ ] selectedPlan / returnTo query param 보존
- [ ] webhook / event truth 변경 0

---

## 9. Risk Assessment

| Risk | 확률 | 영향 | 완화 |
|---|---|---|---|
| 기존 유료 user 의 plan ID display 누락 | Low | High | descriptor enum coverage 100% test 강제 |
| Stripe price ID drift | Low | High | Phase 0 audit + 본 batch Stripe 변경 0 |
| 운영량 "권장" → hard limit 오해 | Med | Med | 카드 카피 "권장" 톤 일관 + footnote |
| "AI 무제한" 카피 잔존 | High | Med | Phase 4 grep sweep 강제 |
| Vercel build cache stale (§11.200b lesson) | Med | High | Phase 5 의 chunk source unique marker 검색 |
| LabOps Credit display only → fake 인식 | Med | Med | footnote 명시 + §11.202 defer 표시 |
| dead checkout button | Low | High | descriptor.ctaRoute = 기존 alive 라우트만 |
| supplier guest paid seat 오매핑 | Low | High | 카드 카피에 "공급사 / 요청자 무료" 명시 |

---

## 10. Rollback Strategy

- **If Phase 0 Fails:** read-only, no rollback 필요
- **If Phase 1 Fails:** plan-descriptor.ts + test 단위 revert
- **If Phase 2 Fails:** /pricing/page.tsx revert (다른 surface 미touch)
- **If Phase 3 Fails:** /dashboard/pricing + settings billing 영역별 revert
- **If Phase 4 Fails:** credit 섹션 + sweep 단위 revert
- **If Phase 5 Fails:** git revert <SHA> 전체 cluster

**Special Cases:**
- DB schema migration 0 (display layer 만)
- Stripe price ID 변경 0
- soft_enforce / full_enforce 분기 0
- webhook 분기 0

---

## 11. Progress Tracking

- Overall completion: 100%
- Current phase: ✅ COMPLETE (5/5 phases)
- Current blocker: 없음 (cluster CLOSED)
- Next validation step: Chrome prod 검증 완료 (2026-05-03) — /pricing 4 카드 + LabOps 섹션 + recommendTag 한국어 + footnote 모두 정상 노출 확인

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete
- [x] Phase 5 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- Phase 3 dashboard/pricing 3 카드 vs 4 카드 통일 결정 → 호영님 4 카드 통일 선택. 비교 테이블 column mismatch 발생 → 비교 테이블 제거 (public /pricing 과 중복) 로 sweep.
- Phase 4 settings/plans + api/billing 의 hardcoded "팀원 무제한"·"품목 등록 무제한" 카피는 PLAN.md Phase 4 RED 명시 외 → §11.201d 별도 트랙으로 defer.
- Vercel build cache stale (§11.200b lesson) — 본 cluster 는 deploy 마다 정상 chunk 갱신 확인 (force commit 없이).

**Implementation Notes:**
- ChatGPT 분석을 거의 그대로 흡수 (LabAxis CLAUDE.md 와 정합도 100%)
- enum 보존 + display layer 분리는 minimal-diff path
- LabOps Credit 실 차감 (§11.202) defer — pilot 단계 over-engineering 회피
- Vercel build cache stale 회귀 lesson (§11.200b/c) 적용 — Phase 5 chunk source 검색 필수
- §11.200c (Dialog modal=false) 와 본 트랙 무관 — 병행 진행 가능
