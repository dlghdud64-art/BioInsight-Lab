# Implementation Plan: 완성도 분모 — 카테고리 조건부화 (§completeness-category-denominator)

- **Status:** ⏳ Pending
- **Started:** 2026-07-26
- **Last Updated:** 2026-07-26
- **CEO 결정 교체 승인:** 2026-07-26 (분모 8 고정 → 카테고리 조건부)

**CRITICAL**: 각 phase 완료 후 체크박스·Last Updated 갱신, quality gate 전항 통과 확인, 실패 시 stop.
⛔ dead button / no-op / placeholder success 금지 · ⛔ 미해결 truth 충돌 상태로 다음 phase 금지

---

## 0. Truth Reconciliation

**Latest Truth Source**
- DB 실측(2026-07-25): 314종 · TOOL 136 / REAGENT 122 / CONSUMABLE 55 / EQUIPMENT 1 · has_sds **0** · has_cas **0**
- 라이브 스모크(2026-07-26): TOOL "자동스탬프"(완성도 25%) 체크리스트에 `SDS/MSDS · SDS 요청` 노출 = **범주 오류**

**Secondary References**
- `lib/product-detail/completeness.ts` — `COMPLETENESS_FIELDS` 8필드, `computeCompleteness`
- `__tests__/regression/product-detail-completeness-pd-b.test.ts` — 분모 8 고정 **잠금 sentinel**
- `__tests__/regression/product-detail-refinement.test.ts` — 계약 48건(분모 무변경 전제)

**Conflicts Found**
1. **CEO 결정 교체.** PD-B(2026-06-20) `분모 8 고정 — 필드 골라 조작 금지`. 본 트랙은 이걸 교체한다.
   - 구 정직론: "모든 제품 동일 잣대(8)". 부풀리기(쉬운 필드만 골라 %↑) 방지가 목적.
   - 신 정직론: "제품 성격별 잣대". 핀셋에 SDS 를 요구하지 않는다.
   - **승인됨(호영님, 2026-07-26).** 교체 사유·안티-부풀리기 가드는 §5.
2. **category enum 불일치(코드베이스).** `datasheet-extractor`=3값 / `smart-sourcing`=3값(다름) /
   `safety-settings VALID_CATEGORIES`=**5값**(`REAGENT·TOOL·EQUIPMENT·RAW_MATERIAL·CONSUMABLE`). DB=4종.
   → **canonical = safety-settings 의 5값.** 매트릭스는 5값 + **null/미상 폴백** 으로 정의.

**Chosen Source of Truth**
- 적용성 판정 = `category`(DB canonical). 제품별 토글 불가 → 부풀리기 악용 차단.
- 필드 정의 = `COMPLETENESS_FIELDS`(불변, 8필드 그대로 유지). 바뀌는 건 **분모 계산**뿐.

**Environment Reality Check**
- [x] repo mount · vitest · F10 실행 가능
- [x] computeCompleteness 실소비처 = `page.tsx` 1곳 (merge-gate 의 `missingLabels` 는 별개 필드, 무관)

---

## 1. Priority Fit
- [x] **Post-release 정합 수정** (release blocker 아님 — 오표기지만 데이터 위험 아님)
- **Why:** D7 과 같은 범주 오류(비해당 필드를 미완성 경고). 표시 계층만으론 못 고침 = 분모 재정의.
  전 TOOL 136종 + CONSUMABLE 55종 = **191종(61%)** 이 부당한 미완성 플래그를 받고 있다.

## 2. Work Type
- [x] Bugfix (범주 오류) · [x] Business Logic (분모 파생) · [x] Design Consistency

---

## 3. Overview

**Feature Description**
완성도 % 분모를 **제품 카테고리에 적용 가능한 필드 수**로 바꾼다. 8필드 정의·isEmpty 정직성은
유지하고, `total` 만 `applicableFields(category).length` 로 파생한다.

**Success Criteria**
- [ ] TOOL 제품에 `SDS/MSDS`·`규제 규격` 체크리스트 행 **미노출**
- [ ] 분모가 카테고리별로 파생(TOOL 5, REAGENT 8 등) — 하드코딩 8 제거
- [ ] **안티-부풀리기 가드:** 분모는 **최소 5**(universal 필드) 밑으로 못 내려감
- [ ] null/미상 category → **8필드 전부 적용**(보수적 폴백, 부풀리기 0)
- [ ] `COMPLETENESS_FIELDS` 8필드 정의·순서 **불변**
- [ ] pd-b sentinel 교체, refinement 48 계약 무회귀

**Out of Scope (⚠️ 금지)**
- [ ] 필드 추가/삭제 (정의는 8개 그대로)
- [ ] category 값 자체 수정/정규화 (enum 통일은 별도 트랙)
- [ ] % 계산식 변경 (known/total × 100 유지)
- [ ] 새 페이지/관리 화면

**User-Facing Outcome**
- 핀셋 상세: 완성도가 해당 필드 기준으로 재계산(예 25%→더 높게), SDS 행 소멸
- 시약 상세: 변화 없음(8필드 모두 적용)

---

## 4. Product Constraints

**Canonical Truth Boundary**
- **Source of Truth:** `Product.category` + 각 필드값 (DB)
- **Derived:** `applicableFields(category)` → 적용 필드 집합. `computeCompleteness` 가 소비.
- **불변:** `COMPLETENESS_FIELDS` 배열(8개 · 순서 · key · label)
- **Persistence:** 없음(순수 계산 변경, DB 무기록)

**UI Surface Plan**
- [x] Existing route (`/products/[id]` 완성도 — 계산 로직만, 렌더 구조 무변경)

**Must Not Introduce**
- [ ] 부풀리기 재개방(가드로 차단) · [ ] category 위조로 분모 게이밍 · [ ] dead branch

---

## 5. Architecture & Decisions

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| **universal 5 + conditional 3** 분리 | 카탈로그·규격·등급·제조사·사용용도는 전 품목 적용. SDS·규제규격·보관조건만 카테고리 의존 | 매트릭스 유지비 |
| 분모 **최소 5 하한** | 부풀리기 방지(구 정직론 계승). 어떤 카테고리도 5 미만 불가 | REAGENT=8, TOOL=5 편차 존재 |
| null/미상 → **8 전부** | 미분류를 관대하게 처리하면 부풀리기 경로. 보수적으로 전 필드 요구 | 미상 제품은 낮은 % |
| `COMPLETENESS_FIELDS` 에 `appliesTo` 메타 추가 | 필드 정의 옆에 적용성. 별도 매트릭스 파일 분산 방지 | 배열 shape 변경(pd-b sentinel 갱신 필요) |

**적용성 매트릭스 (초안 — Phase 0 에서 호영님 최종 확인)**

| 필드 | REAGENT | TOOL | EQUIPMENT | CONSUMABLE | RAW_MATERIAL | null |
| :--- | :--: | :--: | :--: | :--: | :--: | :--: |
| catalogNumber · specification · grade · manufacturer · usageDescription (**universal 5**) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| storageCondition | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| regulatoryCompliance | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| msdsUrl (SDS) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **분모** | **8** | **5** | **5** | **6** | **8** | **8** |

**Dependencies**
- Touched: `lib/product-detail/completeness.ts` · `pd-b.test.ts`(sentinel 교체) · `page.tsx`(category 전달 확인)
- computeCompleteness 소비처 = page.tsx 1곳 (실측 완료)

---

## 6. Global Test Strategy
- 분모 파생 로직 → **unit test 필수**(카테고리별 total, 하한 5, null 폴백)
- pd-b sentinel → **교체**(`total = COMPLETENESS_FIELDS.length` → `total = applicableFields.length` + 하한 단언)
- refinement 48 계약 → **무회귀**(분모 무관 계약이므로 전건 유지 확인)
- 라이브 스모크 → TOOL 제품 SDS 행 소멸 + REAGENT 무변화

---

## 7. Phases

### Phase 0: Truth Lock
**Goal:** 적용성 매트릭스 확정 · sentinel 교체 범위 확정
- Status: [ ] Pending
- [ ] 매트릭스(§5) 호영님 최종 확인 — 특히 CONSUMABLE 의 storageCondition(냉장 소모품 있나?)
- [ ] pd-b sentinel 교체 항목 목록화
- [ ] category 가 page.tsx 에서 computeCompleteness 로 전달되는지 실측

**✋ Gate:** 매트릭스 확정 · 소비처 1곳 재확인 · 폴백 규칙 문서화
**Rollback:** planning-only

### Phase 1: Contract (RED)
**Goal:** 분모 파생을 실패 테스트로 고정
- Status: [ ] Pending
- [ ] `applicableFields(category)` 계약: TOOL→5, REAGENT→8, null→8
- [ ] 하한 계약: 어떤 입력도 total ≥ 5
- [ ] universal 5 는 전 카테고리 분모 포함
- [ ] pd-b 교체본 작성(구 `length` 단언 → 파생 단언)

**✋ Gate:** RED 실재 · refinement 48 무영향 확인 · 부정단언은 `*_CODE`(주석제거본)
**Rollback:** 계약 revert

### Phase 2: Core Logic (GREEN)
**Goal:** 분모 파생 구현
- Status: [ ] Pending
- [ ] `COMPLETENESS_FIELDS` 각 필드에 `appliesTo?: Category[]`(universal 은 생략=전체)
- [ ] `applicableFields(category)` 파생 함수 + 하한 5 가드
- [ ] `computeCompleteness(product)` 가 `product.category` 로 분모 산출
- [ ] null/미상 → 8 폴백

**✋ Gate:** unit 전건 GREEN · known/total 식 불변 · 하한 가드 동작 · 순수함수 유지
**Rollback:** completeness.ts revert(분모 8 복귀)

### Phase 3: Wiring & Smoke
**Goal:** 실제 반영 확인
- Status: [ ] Pending
- [ ] page.tsx 가 category 를 넘기는지 확인(이미 product 객체 통째 전달이면 무변경)
- [ ] F10 build
- [ ] 스모크: TOOL "자동스탬프" SDS 행 소멸 · REAGENT 1종 8필드 유지 · null category 1종 8 유지

**✋ Gate:** dead button 0 · TOOL 오표기 해소 · REAGENT 무회귀 · 100% 숨김 보존
**Rollback:** Phase 2 revert

---

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 분모 조건부화가 **부풀리기 재개방**으로 오인/악용 | Med | High | 하한 5 가드 + category=DB canonical(제품별 토글 불가) + null→8. 커밋 주석에 안티-부풀리기 명시 |
| category 미상 제품이 관대하게 처리됨 | Low | Med | null→8(보수적). 미상은 오히려 낮은 % |
| CONSUMABLE 냉장품에 storageCondition 빠지면 정보 누락 | Med | Med | Phase 0 매트릭스 확인 항목. 불확실하면 CONSUMABLE 에 storageCondition ✅ |
| pd-b sentinel 교체가 다른 트랙 가정을 깸 | Low | Med | pd-b 는 완성도 전용. refinement 48 무영향 확인을 Phase 1 gate 에 포함 |
| enum 불일치로 예상 못한 category 값 유입 | Med | Low | switch default → 8(폴백). 미정의 값도 안전측 |

## 10. Rollback
- Phase 1: 계약 revert
- Phase 2: `total = COMPLETENESS_FIELDS.length` 복귀(분모 8) — 완전 무해 복원
- Phase 3: 로직 revert. **DB 무변경이므로 전 phase 코드 revert 로 100% 원복**

## 11. Progress
- Overall: **0%**
- Current phase: **Phase 0 — 매트릭스 확정**
- Blocker: CONSUMABLE storageCondition 여부(호영님 확인 1건)
- Next: 적용성 매트릭스 최종 확정

**Checklist:** [ ] P0 [ ] P1 [ ] P2 [ ] P3

## 12. Notes & Learnings

**Origin:** §product-detail-refinement Phase 4 스모크 → D7 철회 → TOOL SDS 범주 오류 발견 → 본 트랙.

**승계 교훈(직전 트랙):**
- 부정 단언은 **주석 제거본(`*_CODE`)** 에 (자기함정 4회 방지)
- 문자열 근접도 대신 **구조 검사**(배열 스코프·개수)
- **완성도 목록 = 사용자가 채울 수 있는 결손만**(D7 철회의 핵심 원칙 — 본 트랙이 그 원칙을 분모까지 확장)
- 은폐 0 책임은 히어로 키팩트(위험도)가 이미 담당 — 완성도는 "채울 수 있는 것"에 집중
