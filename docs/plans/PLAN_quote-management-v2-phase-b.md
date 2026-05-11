# Implementation Plan: §11.227 quote-management-v2 Phase B (#9 #10 #13 #14)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-12
- **Last Updated:** 2026-05-12
- **Estimated Completion:** 2026-05-12 (3~4시간)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 v2 spec sheet (Phase B P1 — 4 항목 #9 #10 #13 #14)
- §11.226 + §11.226b 완전 land 직후 (production 7 cluster 누적)

**Audit 결과 — 이미 land 된 부분 (작업 분량 ↓):**
- #10a AI 요약 한 줄 = `signals.summary` 카드 노출 (line 473) ✅
- #10b 최근 활동 (긴급도) = RelativeTimeText + 긴급 뱃지 (§11.221) ✅
- D5 popup 카테고리 chip strip (탭 형태) ✅

**신규 작업 (Phase B):**
- #9 (medium): viewMode default `"card"` → `"table"` + sort by column header
- #10c (small): 공급사 응답 미니 타임라인 (vendorRequests sent → responded → compared)
- #13 (small): 카드 안 `signals.summary` 제거 (priorityAiRecommendation banner 1회만)
- #14 (small): popup 진입 시 quotes 페이지 = "quote" 카테고리 자동 선택

**Chosen Source of Truth:**
- v2 spec sheet (호영님 최근 spec)
- §11.220d popup model (변경 0)
- §11.226 + §11.226b cluster invariant 보존

**Environment Reality Check:**
- [x] repo / branch: ai-biocompare main, §11.226b production READY (commit `31c7b826`)
- [x] vitest runnable (130/130 baseline)
- [x] Chrome smoke runnable

---

## 1. Priority Fit

**Current Priority Category:** P1 immediate (호영님 운영 검증 시 시각 차별화 ↑)

---

## 2. Scope (4 항목, small-medium)

### #9 테이블 default + sort
- `useState<"card" | "table">("table")` swap (localStorage 우선 보존)
- 컬럼 헤더 클릭 → sort state (`{ key, direction }`) + tbody sort fn
- 정렬 아이콘 (ChevronUp / ChevronDown / dim) thead

### #10c 공급사 응답 미니 타임라인
- 카드 안 새 element — vendorRequests 의 sent → responded → compared 3 dot
- 색 분기: complete (emerald) / pending (slate) / waiting (amber)
- §11.221 readiness strip 아래 또는 옆 정합

### #13 카드 AI 메시지 hide
- QuoteCard line 473 `<p>{signals.summary}</p>` 제거 또는 priorityAiRecommendation 활성 시 hide
- 호영님 spec "특화 인사이트 없으면 카드 내 AI 메시지 영역 자체를 숨김"

### #14 popup default category = "quote"
- popup-context 외부에서 카테고리 prop 또는 page 진입 시 setSelectedCategory("quote") trigger
- D5 chip strip 보존 (카테고리 전환 path 유지)

---

## 3. Phase Breakdown (5 phase)

### Phase 0: Truth Lock ✅ 완료
- viewMode default + signals.summary 위치 audit
- popup-context category state audit
- vendorRequests data model 확인

### Phase 1: RED Tests (1시간)
- NEW `__tests__/dashboard/quotes/quote-table-v2-phase-b.test.ts` (~15 tests)
- #9 viewMode default "table" + sort state + thead 클릭 + tbody sort
- #10c 미니 타임라인 element + 3 stage 분기
- #13 카드 안 signals.summary 제거 sentinel
- #14 popup default category "quote" sentinel

### Phase 2: GREEN (1.5시간)
- page.tsx swap (viewMode default + sort + 카드 summary 제거 + 카테고리 prop)
- popup-context category default 분기 또는 page 진입 시 trigger

### Phase 3: Verify (30분)
- vitest cluster 130 → 145+ PASS
- tsc clean

### Phase 4: ADR + Commit + Chrome smoke (30분)
- ADR §11.227 entry
- commit + push
- Chrome smoke 3 viewport

---

## 4. Risk

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| #14 popup-context 변경 시 §11.220d / §11.226b 회귀 | Med | High | popup-context spec 변경 0, page 측 trigger 만 |
| #9 sort fn 의 column-by-column 분기 누락 | Med | Med | drift sentinel test (각 컬럼 별 sortable) |
| #13 카드 summary 제거 시 정보 손실 | Low | Med | priorityAiRecommendation banner 가 cover |
| #10c 미니 타임라인 vendorRequests data 부재 시 placeholder | Med | Low | graceful fallback (sent 0 시 hide) |

---

## 5. Rollback path
- `git revert <SHA>` — UI only, schema/migration/mutation 0

---

## 6. §11.142 lock 정합
- canonical truth (quote.responses / vendorRequests / popup-context.isOpen) 변경 0
- mutation 0
- same-canvas 보존
- page-per-feature 회귀 0

---

**Phase B cluster lineage:**
```
§11.221 → §11.222 → §11.223 → §11.224 → §11.225 → §11.226 → §11.226b → §11.227
```
