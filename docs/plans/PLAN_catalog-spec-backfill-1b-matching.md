# Implementation Plan: #catalog-spec-backfill ①-b — 견적 파싱 item↔Product 매칭 신뢰도

- **Status:** ⏳ Pending (Phase 0 진입 대기)
- **Started:** 2026-06-11
- **Last Updated:** 2026-06-11
- **승인:** 호영님 2026-06-11 (계획 문서 생성)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스 갱신
2. 🧪 quality gate validation 실행
3. ⚠️ 모든 gate 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 반영
6. ➡️ 통과 후에만 다음 phase

⛔ quality gate 실패·미해결 truth 충돌 상태로 진행 금지
⛔ dead button / no-op / placeholder success / **오매칭 자동 적재** 금지

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `PLAN_catalog-spec-backfill.md` (A0~A3 완료, 2026-06-11 / commit 5b2f1c3d). §스코프 분할: "①-b(파싱 item→Product 매칭 후 카탈로그 승격 CTA)는 **매칭 신뢰도 설계 선행**으로 후속 분리 (오매칭 적재 = canonical 오염 차단)."

**Secondary References:**
- `lib/catalog/procurement-ref.ts` — `matchRefToProduct` 매칭 규율 패턴(exact만 auto-link, 그외 candidate, fuzzy auto 승격 금지).
- `lib/ocr/gemini-quote-parser.ts` — 실파서 출력 `ParsedQuoteLineItem`.
- `app/api/products/[id]/specification/route.ts` — ② spec PATCH(zod·enforceAction·서버측 ADMIN/SUPPLIER 게이트, A3 기성).
- `components/quotes/ai-quote-parse-modal.tsx` — ①-a 파싱 결과 surface(규격 배지 `:317`, `handleRegister` `:121`).

**Conflicts Found:**
- procurement-ref 매칭키 = 제조사(mfrtNm)+모델(modelNm) exact. **견적 파싱 출력엔 제조사·모델 필드 부재** — `ParsedQuoteLineItem` = `productName · catalogNumber · specification · quantity · unit · unitPrice · totalPrice · leadTimeDays · notes`. → 동일 매처 재사용 불가, 매칭키 재정의 필요.

**Chosen Source of Truth:**
- canonical = `db.product`. 파싱결과 = projection(truth 아님).
- 견적 매칭키: **catalogNumber = 유일 강신호**(→ Product.catalogNumber|modelNumber exact). productName = 약신호(candidate). **specification은 매칭키 금지 — 승격 페이로드**.
- 적재 정책: §11.348 동형 — 파싱→제안→**사람 승인**→적재. 자동 적재 0.

**Environment Reality Check:**
- [ ] repo/branch: main, baseline c5db33e0
- [ ] runnable: vitest(호영님 env 확정), next build
- [ ] execution blockers: 샌드박스 vitest 미실행(절단 버그) — Windows Grep/Read 무결 확인 후 호영님 env vitest 확정

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- spec-backfill ②(spec 편집 surface) 라이브 후속 enhancement. 견적 회신으로 카탈로그 spec을 채우는 경로의 마지막 조각.
- release blocker 아님. 가치 핵심 = **canonical 오염 차단**(오매칭이 잘못된 Product.specification을 덮는 것 방지)이 곧 설계 본체.

---

## 2. Work Type

- [x] Feature
- [x] Workflow / Ontology Wiring (파싱 모달 CTA)
- [ ] API Slimming / Migration / Billing
- [x] Web (모달은 web; 모바일 파싱 surface 부재 = 본 batch 밖)

---

## 3. Overview

**Feature Description:**
AI 견적 파싱 결과의 각 line item을 canonical `db.product`에 **신뢰도 등급제로 매칭**하고, 매칭된 경우에만 해당 Product에 파싱 spec을 승격(PATCH)하는 CTA를 제공한다. 핵심은 기능이 아니라 **게이트** — 약신호(제조사·모델 부재)에서 over-match가 canonical을 오염시키지 못하게 막는 것.

**매칭 3-tier (설계 골자):**
- **exact** — `norm(catalogNumber)` == `Product.catalogNumber` 또는 `Product.modelNumber`, **단일** 일치 → 고신뢰. 승격 CTA 활성(사람 1-click 승인).
- **candidate** — productName fuzzy 일치 / catalogNumber 복수 Product 일치 → 후보 목록 제시, **사람 선택 강제**, auto 0.
- **none** — 무일치 → CTA 미노출(오적재 차단).
- 승격 = 선택 Product에 `specification` PATCH(기성 ② 엔드포인트, provenance "출처=견적서").

**Success Criteria:**
- [ ] `matchQuoteItemToProduct()` 순수함수 — exact/candidate/none tier 정확, auto-merge는 catalog exact 단일일치만
- [ ] 모달 item별 매칭 상태 배지 + tier별 CTA(exact=승격, candidate=선택, none=무)
- [ ] 승격 시 ② spec PATCH 호출(서버 권한 검증 통과) + provenance 표기
- [ ] 오매칭 자동 적재 0 — sentinel로 단언

**Out of Scope (⚠️ 절대 구현 X):**
- [ ] 신규 제품 생성(파싱 item → 새 Product INSERT) — 별도 트랙
- [ ] 모바일 파싱 surface
- [ ] specification을 매칭키로 사용
- [ ] 제조사/모델 필드를 파서 프롬프트에 신규 추가(파서 스키마 변경) — 본 batch는 가용필드만 사용
- [ ] catalogNumber norm을 공백/대소문자 이상으로 느슨화

**User-Facing Outcome:**
- 견적 파싱 모달에서 각 품목이 어느 카탈로그 Product와 매칭됐는지 배지로 보이고, 확실한 건 1-click으로 규격을 카탈로그에 채워넣고, 애매한 건 직접 고르고, 모르는 건 조용히 넘어간다.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas (기존 `ai-quote-parse-modal` 흡수, 새 surface 0)
- [x] canonical truth (`db.product` write는 ② PATCH 경로만)
- [x] invalidation discipline

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant 재해석
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] **preview(파싱결과)가 actual truth(Product.specification) 덮기 — 사람 승인 없이 금지**

**Canonical Truth Boundary:**
- Source of Truth: `db.product` (canonical)
- Derived Projection: `matchQuoteItemToProduct()` 결과(tier·후보) = projection, truth 아님
- Snapshot / Preview: 파싱된 `ParsedQuoteLineItem` = preview, 적재 전까지 truth 무영향
- Persistence Path: 사람 승인 → `PATCH /api/products/[id]/specification`(서버 게이트) → `Product.specification`

**UI Surface Plan:**
- [x] Existing route section (`ai-quote-parse-modal` review step 내 흡수)
- [ ] Inline expand / Right dock / Bottom sheet / Split panel / Settings panel
- [ ] New page (⚠️ 불가 — 정당화 없음)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 신규 순수함수 `matchQuoteItemToProduct()`(procurement-ref 매처 별도) | 견적 가용필드(catalog+name)가 procurement(제조사+모델)와 달라 매칭키 상이 | 매처 2개 공존 — norm 규율은 공유(동형 엄격도) |
| catalogNumber exact **단일일치만** auto | 약신호 환경에서 over-match = canonical 오염; 복수일치는 동일 catalog 여러 Product = 모호 | 일부 정당 매칭도 사람 거침(보수적 = 의도) |
| 승격 = 기성 ② PATCH 재사용 | 서버 권한 게이트·zod 검증 기성, 신규 write 경로 0 | PATCH 단건 — 다건 승격은 순차 호출 |
| specification = 매칭키 아님 | 규격은 적재 대상이지 동일성 판별자 아님; 같은 제품 다른 포장규격 다수 | name+catalog만으로 매칭 |

**Dependencies:**
- Required Before Starting: 없음(② PATCH·파서·모달 전부 기성)
- External Packages: 없음
- Touched: `lib/catalog/` 신규 매처 / `components/quotes/ai-quote-parse-modal.tsx`(review step) / 매칭 대상 Product 조회 경로(검색/카탈로그 query 재사용) / sentinel test

**Integration Points:**
- 매칭 대상 Product 후보 fetch(기존 product search/query 재사용 — overfetch 금지, select 제한)
- `PATCH /api/products/[id]/specification`
- 모달 review step 렌더 + CTA wiring

---

## 6. Global Test Strategy

All phases Red-Green-Refactor.
- 매칭 순수로직(tier 판정·norm·복수일치 처리) → **unit 필수**.
- 모달 CTA → component/smoke(승격 호출·candidate 선택·none 무CTA).
- canonical 가드 → sentinel: 자동 적재 0, spec 매칭키 미사용, norm 느슨화 0.
- **샌드박스 vitest 미실행 시 "실행 불가" 명시** — Windows Grep/Read 무결 확인 후 호영님 env 확정.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** 매칭 가용필드·정규화 규칙·spec PATCH 계약·모달 surface를 구현 전 확정.
- Status: [x] Complete (2026-06-11)

**실측 결과 (lock):**
- `ParsedQuoteLineItem` = productName·catalogNumber·specification·quantity·unit·unitPrice·totalPrice·leadTimeDays·notes. **제조사·모델 부재 확정.**
- `Product`(schema.prisma:261) 매칭 가용필드 전부 존재: name·nameEn·brand·modelNumber·catalogNumber·manufacturer·specification. → 매칭키 = `catalogNumber` exact(→ Product.catalogNumber|modelNumber), name fuzzy. spec=payload.
- ② PATCH `/api/products/[id]/specification` 계약: 입력 `{ specification: string|null, .trim().max(200) }` **단일필드** / auth=session+role(ADMIN|SUPPLIER) 서버 게이트 + `enforceAction('sensitive_data_import')`. **provenance 필드 미수용.**
- 후보 fetch 경로: `lib/api/products.ts` `searchProducts` + `/api/products/search` 재사용 가능.

**⚠️ 정정 (계획 대비):** §3/§7 P3의 PATCH payload `{ specification, provenance: "quote" }` → 현 ② 엔드포인트는 `specification`만 수용. **결정 필요(P3 진입 전):** (a) 엔드포인트 무변경 + provenance는 UI 표기/audit 레벨만(scope 최소, 권장) / (b) ② route에 provenance 옵션 추가(scope↑). **현재 (a)로 가정** — Notes 참조.

**✋ Quality Gate:** ✅ 미해결 충돌 0(provenance 정정은 Notes 등재·(a) 가정), false 가정 0, 매칭키·게이트·PATCH 계약 문서화.
**Rollback:** planning-only, 코드 변경 0.

### Phase 1: Contract & Failing Tests
**Goal:** 매칭 동작을 계약으로 고정, 실패 가시화.
- Status: [x] Complete (2026-06-11) — RED 작성. vitest 실행=호영님 env(샌드박스 절단 버그).

**산출:**
- `src/lib/catalog/quote-product-match.ts` (74줄) — 타입(`QuoteMatchInput`·`QuoteProductTarget`·`QuoteMatchTier`·`QuoteMatchResult`·`SpecPromotionCheck`) + `normMatchKey`(procurement-ref 동형) + `SPEC_MAX_LEN=200` + **stub** `matchQuoteItemToProduct`(항상 none) / `clampSpecForPromotion`(항상 거부).
- `src/__tests__/regression/quote-product-match-phase1.test.ts` (155줄, 5 describe / 15 it).
- **RED 대상(stub fail 예상):** tier 5건(exact/modelNumber/복수=candidate/name fuzzy/none) + clamp 정상·too_long 2건. **GREEN sentinel(이미 통과):** auto-merge 가드 3건, norm 엄격도 2건, canonical boundary 1건, SPEC_MAX_LEN·빈clamp. = Phase 2 GREEN 후 전건 통과 예상.
- provenance = **(a) 확정** — ② 엔드포인트 무변경, 표기/audit만.

**🔴 RED:** `matchQuoteItemToProduct()` 실패 테스트 작성 —
- catalog exact 단일일치 → `exact`
- catalog 복수 Product 일치 → `candidate`(auto 아님)
- name fuzzy만 → `candidate`
- 무일치 → `none`
- **auto-merge 금지 가드:** exact 외 tier에서 auto 적재 분기 0
- **spec 매칭키 미사용 단언:** specification 값 변경이 tier 판정에 영향 0
**🟢 GREEN:** 함수 시그니처·타입 scaffolding(`QuoteMatchTier` union 등).
**🔵 REFACTOR:** 네이밍·scope 정리.

**✋ Quality Gate:** 실패 테스트 real, 기존 테스트 무회귀, lint/typecheck 문서화(또는 실행불가 명시).
**Rollback:** 계약/테스트 scaffolding revert.

### Phase 2: Core Matching Logic
**Goal:** 매칭 순수로직 최소 동작.
- Status: [x] Complete (2026-06-11) — GREEN 구현. 샌드박스 로직 미러 16/16 PASS. vitest 확정=호영님 env.

**산출:**
- `quote-product-match.ts` stub 2개 → 실구현: `matchQuoteItemToProduct`(catalog exact 단일=exact / 복수=candidate / 무일치→name fuzzy=candidate / 무→none, spec 미사용) + `clampSpecForPromotion`(empty/too_long 거부, 절단 0, 200 경계 포함).
- `quote-product-match-phase2.test.ts` (2 describe / 6 it) — exact>fuzzy 우선, 폴백 순서, 다건 fuzzy, model 스캔, clamp 200 경계.
- 검증: 샌드박스 node 미러 16건(P1 RED 대상 + P2 edge) 전건 PASS → 호영님 env vitest에서 P1 6 RED→GREEN 전환 + P2 6건 예상.

**🔴 RED:** tier 판정 unit 테스트(Phase 1 빨강 → 초록 최소선).
**🟢 GREEN:** `matchQuoteItemToProduct()` 구현 —
- norm = 소문자 + 공백압축(procurement-ref `norm` 동형, 그 이상 금지)
- catalog exact: `norm(catalogNumber)` == `norm(p.catalogNumber)` || `norm(p.modelNumber)`; 일치 Product **개수 분기**(1=exact, 2+=candidate 목록)
- name candidate: catalog 무일치 시 `norm(p.name).includes(norm(productName))` (또는 역방향) → candidate
- 반환: `{ tier, matches: ProductMatch[] }` (exact=1건, candidate=N건, none=0건)
**🔵 REFACTOR:** DRY(norm 공유), 추측성 코드 제거.

**✋ Quality Gate:** core 테스트 통과, truth-boundary 무침범(이 레이어 DB write 0), overfetch/N+1 없음.
**Rollback:** 매처 모듈 Phase 1로 revert.

### Phase 3a: 매칭 라우트 + 배지 (read-only, canonical write 0)
**Goal:** 견적 item↔Product 매칭을 서버 batch로 실행, 모달에 tier 배지 표시. **쓰기 0.**
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** match 라우트 sentinel + 모달 배지 —
- 라우트: auth 게이트 / db write 분기 0 / `matchQuoteItemToProduct` 소비 / select 제한 / batch 단일 쿼리(item별 개별 쿼리 0)
- 모달: review 진입 시 매칭 호출 / tier별 배지(exact/candidate/none) / 매칭 실패가 파싱 등록 흐름 무손상(graceful)
**🟢 GREEN:**
- `POST /api/quotes/match-products` — body `{ items: [{productName, catalogNumber}] }`, auth 필수, 후보 Product **1쿼리** batch fetch(catalogNumber·modelNumber in + name contains, take 상한, select id·name·catalogNumber·modelNumber), item별 `matchQuoteItemToProduct` 실행, `{ results: [{lineIndex, tier, matches}] }` 반환. **canonical write 0.**
- 모달: review step item row에 tier 배지(exact=emerald "카탈로그 일치" / candidate=yellow "후보 N" / none=무). ①-a 규격 배지 옆 배치.
**🔵 REFACTOR:** 배지 톤 §11.302 정합, 375px 무잘림.

**✋ Quality Gate:** canonical write 0(읽기 전용), N+1 0(batch 1쿼리), 배지 정확, 파싱 등록 흐름 회귀 0.
**Rollback:** 라우트·배지 revert(매처 lib 잔류). 쓰기 없어 canonical 무영향.

### Phase 3b: 승격 CTA + PATCH (canonical write)
**Goal:** 매칭된 item을 사람 승인으로 Product.specification에 승격.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 모달 component 테스트 —
- exact item → 승격 CTA 노출 + 클릭 시 spec PATCH 호출
- candidate item → 후보 picker, 선택 전 승격 불가(auto 0)
- none item → CTA 미노출
- 권한 없으면 CTA 미노출(`canPromoteSpec` prop 게이트) — dead button 0
- dead-end 0(실패 toast), 다건 순차 상태, fake success 0
**🟢 GREEN:**
- 모달 `canPromoteSpec?: boolean` prop(부모서 ADMIN|SUPPLIER 주입) — false면 배지만, CTA 무
- exact 승격 = `clampSpecForPromotion(item.specification)` 통과분만 `PATCH /api/products/[id]/specification` `{ specification }` (provenance=(a) UI 표기/audit만, payload 무)
- candidate = picker 선택 → 동일 PATCH
- 다건 = 순차(item별 진행/완료/실패 상태)
**🔵 REFACTOR:** UI 단순화, same-canvas 유지, ①-a 배지와 일관.

**✋ Quality Gate:** dead button·front-only success 0, 권한 없을 때 CTA 0(서버 403 의존 금지), loading/error/empty 존재, 375px 무잘림.
**Rollback:** CTA wiring revert(3a 배지·매처 잔류). 미승인분 canonical 무손상.

### Phase 4: Smoke / Rollback / Rollout
**Goal:** 안전 출시·복구 보장.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** rollout 실패모드 식별 / smoke 경로 정의(오매칭 차단 포함).
**🟢 GREEN:**
- smoke: exact 견적 → 승격 → Product.specification 반영 확인 / **candidate에서 auto 적재 0 확인**(오염 차단 핵심 smoke) / none 무CTA
- flag 필요 여부 판정(모달 내 부가 CTA라 flag 불요 가능 — P3 측정 후 결정)
**🔵 REFACTOR:** 임시 계측 제거, notes 확정.

**✋ Quality Gate:** rollout 안전, rollback 문서화, 잔여 blocker 격리.
**Rollback:** CTA hide(모달 조건부 렌더 off) + 매처 read 제거. DB write는 사람 승인 PATCH뿐 → 미승인 시 canonical 무손상.

---

## 8. Addenda

### A. Workflow / Ontology Addendum (적용 — 파싱 모달 CTA)
**Resolver Input:** 파싱 line item / 매칭 대상 Product 후보 / tier 판정.
**Expected Output:** tier별 allowedActions(exact=승격 / candidate=선택후승격 / none=없음).
**Surface Rules:** 기존 모달 review step 흡수, 배지로 tier 구분. chatbot/terminal/AI 패널 금지.
**Validation:**
- [ ] tier 배지 정확
- [ ] candidate 선택 전 승격 차단
- [ ] none 무CTA(dead-end 아님 — 의도된 무액션)
- [ ] 승격 후 Product 일관 표시

### C. API Slimming Addendum (적용 — Product 후보 fetch)
**Waste Type 경계:** item별 매칭 후보 조회가 N+1 유발 금지.
**Minimal Diff:** 후보 조회 1회 batch(파싱 item 전체의 catalog/name으로 후보 Product set 1쿼리) + select 필드 제한(id·name·catalogNumber·modelNumber). item별 개별 쿼리 금지.

*(B. Billing / D. Mobile — 해당 없음, skip. 모바일 파싱 surface 부재 = Out of Scope.)*

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 약신호 over-match(제조사·모델 부재) → canonical 오염 | High | High | catalog exact **단일일치만** auto; 그외 사람 게이트 강제; sentinel 단언 |
| catalogNumber 표기 흔들림(vendorSku vs Cat#) | Med | Med | norm은 공백/대소문자까지만(procurement-ref 동형), 느슨화 금지 — 놓침 < 오매칭 |
| 후보 fetch N+1 | Med | Med | batch 1쿼리 + select 제한(§8-C) |
| 다건 승격 부분 실패 | Med | Med | 순차 + item별 상태 표시, fake success 0, 실패 toast |
| 샌드박스 vitest 절단 → 통과 오판 | Med | Med | Windows Grep/Read 무결 확인 후 호영님 env vitest 확정 |

**Risk Categories:** Canonical Truth(주) / No-op / Contract Drift / Quality.

---

## 10. Rollback Strategy

- Phase 1 실패: 계약/테스트 scaffolding revert.
- Phase 2 실패: 매처 모듈 revert.
- Phase 3 실패: 모달 CTA wiring revert(매처 잔류, CTA hide).
- Phase 4 실패: (flag 도입 시) flag off / 미도입 시 P3 wiring revert.
- **공통 안전판:** canonical write = 사람 승인 PATCH뿐 → 어느 단계 롤백도 미승인분 Product 무손상.

### P3b rollback 확정 (2026-06-12, 호영님 P4 지시)

- **전체 rollback**: route 신규 삭제(`quotes/[id]/match-products`) + 모달 patch 1~7 revert
  + 모달 구 `/api/quotes/match-products` path 복귀 → P3a read-only 배지 상태 복원.
  스키마 변경 0 → DB rollback 불요.
- **부분 rollback**: 모달 picker만 비활성(배지 read-only) + route 잔존 무해(read-only,
  quote-access 가드 유지).

---

## 11. Progress Tracking

- Overall completion: 90% (Phase 0~3 complete — P3a read-only + P3b quote-scoped wiring)
- Current phase: Phase 4 — 수동 smoke (호영님 브라우저 확인 대기)
- Current blocker: 없음
- Next validation step: smoke 5경로(아래 §11.1) 호영님 수동 수행 → 결과 회신 → push 승인

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (sentinel 15, RED 6 → GREEN)
- [x] Phase 2 complete (edge 6 GREEN, catalog 72 무회귀)
- [x] Phase 3 complete (P3a 18 + P3b 13 GREEN, 124/124 무회귀, tsc clean — 2026-06-12)
- [ ] Phase 4 complete (수동 smoke 5경로 — e2e 미보유, "수동 검증" 표기)

### §11.1 P4 수동 smoke 체크리스트 (호영님 P4 지시 2026-06-12, e2e 미보유 → 수동)

목적: ① 봉합(끊긴 등록) + 게이트 + dead-end 0 의 런타임 확인.

1. **exact 자동** — 견적서 파싱→review. catalogNumber 일치 품목 = "카탈로그 일치"
   배지(자동). 등록→성공(done). 판정: vendor-reply 생성 + 400 미발생.
2. **candidate picker** — 애매 품목 "후보 N · 선택" 배지 클릭→bottom Sheet 후보
   노출→선택→배지 "선택됨"(emerald) 전환. 등록→성공. 판정: 선택 quoteItemId 가
   payload 에 실림.
3. **none-only 차단** — 매칭 0 견적 등록 시도→"매칭된 품목이 없습니다" error step.
   판정: 빈 items 로 vendor-replies 호출 안 됨(400 사전 차단).
4. **혼합** — exact+candidate선택+none 혼재. 판정: none 라인만 제외, 나머지 등록.
   부분 등록 정상.
5. **quote-access 403** — 타 조직/비소유 quoteId 로 match-products 직접 호출.
   판정: 403(런타임), 타 조직 quoteItem 미노출.

판정 기준: smoke 1·2·3 통과 = ① 봉합 확정(끊긴 등록 살아남). e2e 자동화 없음 →
"수동 검증" 표기.

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (없음)

**Implementation Notes:**
- [2026-06-12 P3b] 클로드코드 자체수리 3건(호영님 수용): ① P3a sentinel 2건 supersede
  (구 path → quote-scoped path / none 미노출 → "매칭 없음" 정직 노출 — no-op/silent-fail
  제거 방향, 등록 가드와 짝). ② P3b sentinel `/s` flag → `[\s\S]`(tsc es2017 TS1501).
  ③ route `li` implicit any → select 명시 타입(TS7006).
- [2026-06-12 P3b] 구 /api/quotes/match-products(전 카탈로그)는 P3c까지 잔존 —
  BOM 전용 products/batch-match 분리 시 deprecate 판단.
- [2026-06-11 Phase 0] ② PATCH는 `specification` 단일필드만 수용(provenance 미지원). **(a) 엔드포인트 무변경 + provenance는 UI 표기/audit 레벨만 = 현 가정**(scope 최소, canonical write 경로 무변경). P3 진입 시 호영님 확정. (b) route 확장은 scope↑라 비권장.
- [2026-06-11 Phase 0] spec max 200자 제약 — 파싱 spec이 200 초과 시 truncate/거부 정책 P1 계약에 포함(조용한 절단 금지).
- 파서 출력에 제조사·모델 부재 = procurement-ref 매처 재사용 불가, 견적 전용 매처 신설(매칭키 = catalog exact + name fuzzy).
- specification은 적재 페이로드지 매칭키 아님 — 같은 제품 다포장규격 다수.
- 모바일 파싱 surface·신규 제품 생성·파서 스키마 변경 = 의도적 defer.
- 보수적 매칭(놓침 허용, 오매칭 불허)이 설계 철학 — canonical 오염 비용 >> 매칭 누락 비용.
