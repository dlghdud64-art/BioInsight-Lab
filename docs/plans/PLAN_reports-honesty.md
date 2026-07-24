# Implementation Plan: 구매 리포트 정직성 — 견적 금액·벤더·프로젝트 (§reports-honesty)

- **Status:** 🚧 P0·P1 ✅ Complete (2026-07-24 · P1 `1e2dc56f`) — P2~P4 Pending
- **Started:** 2026-07-23
- **Last Updated:** 2026-07-23
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **정직성 원칙:** 없는 지출을 ₩0으로 날조 금지 · 미확정 금액은 "미확정" 표기 · canonical truth(실지출=PurchaseRecord)를 견적 projection 이 덮지 않게

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- bug-hunter 조사(2026-07-23) — 프로덕션 `/api/reports/purchase` payload 실측 + route.ts 코드 실측 + prisma schema 실측
- 스크린샷: 구매 리포트 상세 2건 전부 제품명/벤더 "-", ₩0 · 차트 "데이터 없음"

**Secondary References:**
- `apps/web/src/app/api/reports/purchase/route.ts` (338줄)
- `apps/web/prisma/schema.prisma` (Quote·QuoteItem·QuoteReply·QuoteVendor·PurchaseRecord)

**Conflicts Found:**
- 없음(단일 truth — API 응답·코드·스키마 상호 정합). 3결함 모두 schema-confirmed.

**Chosen Source of Truth:**
- **스키마 실측 확정 (결정적):** 견적 측에 **구조적 금액 필드 부재** —
  - `QuoteItem` = { quantity, notes, productId } — **가격 필드 없음** → route L144·280 `(item.unitPrice||0)*quantity` 는 구조적으로 **항상 0**
  - `QuoteReply` = 이메일 본문(bodyText/Html)만 — 실회신가는 **비구조(본문 텍스트)**, 구조 금액 아님
  - `Quote.totalAmount` (Int?) = 견적 측 **유일 구조 금액** — route 현재 **미사용**
  - `QuoteVendor.vendorName` = 실제 견적 발송 벤더(RFQ 수신처) · `Quote.vendor`(String?, AI 추출) = 보조
  - `Quote.description` = "리스트 설명/비고"(요청 메시지 원문) — route L278 이 이걸 `project` 로 오용
  - `PurchaseRecord` = 실구매(amount required) — **실지출 canonical**
- 결론: 견적은 신뢰 금액을 못 들며, 미확정 견적을 ₩0 지출로 합산하는 것은 **없는 지출 날조**. 실지출 = PurchaseRecord.

**Environment Reality Check:**
- [x] repo/branch: main HEAD(§mobile-logs 후속 종결 지점) · [x] F9 격리 vitest 가용 · [x] F10 build 가용
- [x] 프로덕션 실측 경로: sandbox(Claude in Chrome, admin 세션) `/dashboard/reports`

## 1. Priority Fit

**Current Priority Category:**
- [x] Post-release / P2 (리포트 = 보조 분석 서피스, 워크플로 비블로커)

**Why This Priority:**
- 리포트는 운영 워크플로(견적→발주→입고) 차단 아님. 단, **canonical-truth 위반(₩0 날조·벤더 오표기)** 은
  총괄 의사결정 지표 신뢰를 훼손 → 정직성 클래스로 우선 처리 가치 높음. 릴리스 블로커는 아님.

## 2. Work Type
- [x] Bugfix (report projection honesty) · [x] Design Consistency (미확정 표기) · [x] Web
- [ ] API Slimming/Migration/Billing/Mobile 해당 없음(스키마 변경 0)

## 3. Overview

**Feature Description:**
구매 리포트가 견적을 (a) ₩0 지출로 날조, (b) 실벤더 대신 카탈로그 첫벤더로 오표기, (c) 요청 메시지를
project 로 오용하는 3결함을 정직하게 교정. 스키마 변경 0 — projection 로직·표기만 교정.

**Success Criteria:**
- [ ] 견적 amount: `Quote.totalAmount` 있으면 사용, 없으면 **미확정**(0 아님) · 지출 합계(totalAmount/estimatedAmount)에서 **미확정 견적 제외**
- [ ] 실지출 메트릭 = PurchaseRecord 기반만(canonical) · 견적은 "예상/회신 대기"로 분리
- [ ] vendor = `Quote.vendors[0].vendorName`(QuoteVendor) → 없으면 `Quote.vendor`(AI) → 없으면 "-"
- [ ] project = 견적 식별자(견적번호/제목) 또는 "-" · description(메시지 원문) 노출 제거
- [ ] 상세행: 미확정 견적에 "회신 대기" 배지 + 금액 "미확정" 표기 · ₩0 표기 0
- [ ] baseline-delta 0 · reports 접촉 sentinel(mobile-reports-p1 등) GREEN 유지

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] QuoteReply 이메일 본문에서 금액 파싱/추출(비구조 → 별도 대형 트랙, 본 계획 밖)
- [ ] 스키마 변경(QuoteItem 가격 컬럼 추가 등) · 마이그레이션
- [ ] 새 페이지 · 리포트 차트 재설계

**User-Facing Outcome:**
- 총괄이 구매 리포트에서 "₩0·-·메시지원문" 대신 실벤더·미확정 표기를 봄. 실지출 지표가 견적 ₩0에
  오염되지 않아 신뢰 가능.

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth(실지출=PurchaseRecord) · [x] same-canvas(리포트 기존 서피스) · [x] 기존 필터/기간 로직

**Must Not Introduce:**
- [x] placeholder success(₩0 날조가 곧 이 위반 — 제거 대상) · [x] page-per-feature · [x] preview가 truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: PurchaseRecord(실지출) · Quote.totalAmount(견적 확정가, 있을 때만)
- Derived Projection: 리포트 metrics/details/monthly/vendor/category
- Snapshot/Preview: 견적 미확정 = projection 이 amount 를 단정하지 않음("미확정")
- Persistence Path: 없음(읽기 전용 리포트)

**UI Surface Plan:**
- [x] Existing route section(reports/page.tsx 상세 테이블 · 인사이트 카드) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 미확정 견적 = 지출 합계 제외 | 없는 지출 ₩0 날조 방지(정직성 핵심) | "총 지출" 이 견적 반영 안 함 — 단, 그게 정직(실지출만) |
| amount = totalAmount ?? 미확정 | 유일 구조 금액 사용, 없으면 단정 안 함 | totalAmount 미입력 견적은 금액 공백(정상) |
| vendor = QuoteVendor 우선 | 실제 RFQ 수신처 = 진실 | 다벤더 견적은 첫 벤더만(표시 한정 — 상세는 별도) |
| project 필드 정정 | description 은 project 아님(오용) | project 개념 부재 시 "-"(정직) |

**Dependencies:**
- Required Before: 없음(단일 route + 단일 page)
- External Packages: 없음
- Touched: `api/reports/purchase/route.ts` · `app/dashboard/reports/page.tsx`

**Integration Points:**
- API: `/api/reports/purchase` (GET) — quotes/purchaseRecords projection
- UI: reports 상세 테이블 · 인사이트 카드(총 지출/이상치)

## 6. Global Test Strategy
- 정적 sentinel(신규 `reports-honesty-p1.test.ts`) + F9 원문 + F10 build + mobile-reports-p1 GREEN 유지 + baseline-delta 0
- sentinel 계약: (a) route 가 `item.unitPrice` 미참조(부재 필드) · (b) `Quote.totalAmount` 참조 · (c) vendor
  파생이 `vendors`/`QuoteVendor` 참조 · (d) details project 가 `description` 직접 노출 안 함 ·
  (e) 미확정 견적이 totalAmount 합산 제외 · (f) UI "미확정"/"회신 대기" 표기 실재

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-24)
- Status: [x] Complete — operator 실측(코드 변경 0)
- **🔴 RED:** 스키마 3결함 재확인(가격필드 부재·QuoteVendor·description) — §0 확정분 잠금
- **🟢 GREEN:** route 실단가/벤더/프로젝트 계산 지점 라인 실측 · 미확정 판정 규칙 확정
- **🔵 REFACTOR:** 스코프 축소 — 이메일 본문 금액 파싱 **제외 확정**

#### P0 실측 ① — route.ts 수정 지점 라인 잠금 (`src/app/api/reports/purchase/route.ts`)
| 대상 | 라인 | 현행 |
| :--- | :--- | :--- |
| amount(견적 파생) | **L144** | `const amount = (item.unitPrice \|\| 0) * item.quantity` — 단가 미기록 견적 → 0 |
| amount(상세행) | **L281** | `amount: (item.unitPrice \|\| 0) * item.quantity` (details.push) |
| vendor(집계) | **L149** | `item.product?.vendors?.[0]?.vendor` — product 카탈로그 첫 벤더(견적 실벤더 아님) |
| vendor(상세행) | **L279** | 동일 파생 → `vendor?.name \|\| "-"` |
| project(상세행) | **L278** | `project: quote.description \|\| "-"` — 요청 메시지 원문 노출 |
| 지출 합산(견적) | **L145·146·162** | `estimatedAmount/totalAmount += amount` · `monthlyMap` |
| 지출 합산(실구매) | **L169·170·174·180·184** | `actualAmount/totalAmount += record.amount` · vendor/category/monthly Map |

#### P0 실측 ② — Quote 식별자 필드 (project 대체 후보) — **존재 확정**
- `quoteNumber String? @unique` — 견적번호(Q-YYYYMMDD-XXXX), **nullable**
- `title String` — 리스트 제목, **non-null 필수** → 폴백 안전
- ⇒ project 교정안: `quoteNumber ?? title`(둘 다 실재, "-" 폴백 불요). `description`은 project에서 분리.

#### P0 실측 ③ — 실벤더 관계 경로
- `QuoteVendor`: `quote.vendors[]` · **`vendorName String`(non-null)** · `email String?`
- `QuoteVendorRequest`: `quote.vendorRequests[]` · `vendorName String?`(nullable) · `vendorEmail` · `status` · `respondedAt`
- **현행 include(L78~92)**: `organization` + `items.product.vendors.vendor`만 — `quote.vendors` / `quote.vendorRequests` **미포함** ⇒ 실벤더 접근 불가가 구조적 원인.
- ⇒ 교정 시 include 추가 필요(overfetch 최소화: `vendors: { select: { vendorName: true } }` 수준).

#### P0 실측 ④ — sentinel 어서션 경계
| sentinel | 어서션 | 충돌 판정 |
| :--- | :--- | :--- |
| `mobile-reports-p1` | **37** | 충돌 후보 **1**(L55~58 KPI 값없음 `–`) — 대상이 **KPI**이고 상세행 amount/vendor/project는 **미pin** ⇒ P2~P3 충돌 **0** |
| `purchase.contract` | **19** | 전부 **집계 배열 shape pin**(`categoryData/vendorData/monthlyData` = `{name, amount}`, client `c.amount > 0`·`dataKey="amount"`) ⇒ **값 변경은 무해, shape 변경 시에만 충돌** |
- ⇒ P2~P3를 **details[] 필드 교정 + 집계 값 변화**로 한정하면 진화 불요. 집계 배열 **키 형태 변경 시에는 진화 판정 상신**(임의 진화 금지).

- **✋ Gate:** [x] truth 충돌 0 · [x] 수정 지점 라인 명기 · [x] 미확정 정의(단가 미기록 견적 ⇒ 0원 단정 금지, "미확정" 표기) · [x] Quote 식별자 실재 확인 · [x] sentinel 경계 계수
- **Rollback:** planning-only (코드 변경 0)

### Phase 1: Contract & RED — ✅ Complete (2026-07-24 · `1e2dc56f`)
- Status: [x] Complete
- **🔴 RED:** `reports-honesty-p1.test.ts` — §6 계약 6항 정적 sentinel(RED 실증)
- **🟢 GREEN:** 최소 scaffolding(테스트 파일) + 회귀 가드 4
- **🔵 REFACTOR:** testid/명명 정리

#### P1 F9 실측 (operator 원문 실행)
| 파일 | 결과 |
| :--- | :--- |
| `reports-honesty-p1` | **계약 6 전건 RED** / 회귀 가드 4 GREEN (6 failed \| 4 passed, 10) |
| `mobile-reports-p1` | **13 tests GREEN**(어서션 37) — 회귀 0 |
| `purchase.contract` | **4 tests GREEN**(어서션 19) — 집계 shape 무접촉 |
- 계수 표기: 계획서의 "37 / 19"는 **어서션(expect) 수**, 테스트(it) 수는 **13 / 4** — 동일 대상의 다른 단위.

#### P1 false-pass 방지 설계(P0 실측 반영 — P2 구현 시 준수)
- `totalAmount` 단순 매칭 **금지**: route 로컬 누산기/응답 필드(L132·146·170·312)가 이미 존재 ⇒ **`quote.totalAmount`** 로 정밀 pin.
- `vendorName` 단순 매칭 **금지**: PurchaseRecord `record.vendorName` **5건** 기존재 ⇒ **`quote.vendors`** 경로로 정밀 pin.
- (a)는 `item.unitPrice` **전건 제거**(L144·236·282) 요구 — L236(usedAmount)도 동일 구조적 0이므로 P2 스코프.

- **✋ Gate:** [x] RED 실증(계약 6 정확 계수) · [x] 기존 GREEN 유지(mobile-reports-p1 13 · purchase.contract 4) · [x] F10 불요(테스트 파일 단독)
- **Rollback:** 테스트 revert(`1e2dc56f` 단독)

### Phase 2: Core Logic (route.ts 3결함)
- Status: [ ] Pending
- **🔴 RED:** Phase 1 sentinel red 유지 확인
- **🟢 GREEN:** route.ts 교정 —
  - amount: `quote.totalAmount ?? null`(미확정) — `(item.unitPrice||0)*qty` 제거 · 미확정은 지출 합계(totalAmount/estimatedAmount/monthly/category) **제외**, count 로만 반영
  - vendor: `quote.vendors?.[0]?.vendorName ?? quote.vendor ?? "-"`(include 에 `vendors` 추가, `product.vendors` 벤더 매핑 제거)
  - details project: `quote.description` → 견적 식별자(번호/제목 필드 실측 후) 또는 "-" · 별도 `note` 로도 원문 노출 안 함
- **🔵 REFACTOR:** include 최소화(product.vendors 불요 시 제거 — overfetch 감소)
- **✋ Gate:** F9 sentinel 계약 GREEN 전환 · mobile-reports-p1 회귀 0 · truth-boundary(실지출 canonical) 위반 0 · overfetch 미증가
- **Rollback:** route.ts revert

### Phase 3: UI Surface (reports/page.tsx)
- Status: [ ] Pending
- **🔴 RED:** UI 계약 sentinel(미확정 표기·회신 대기 배지) red
- **🟢 GREEN:** 상세 테이블 — amount null ⇒ "미확정"(₩0 금지) · 미확정 행 "회신 대기" 배지 · vendor/project 정직 표기 · 인사이트 "총 지출" = 실지출(PurchaseRecord)만 라벨 명확화
- **🔵 REFACTOR:** same-canvas 유지 · 빈/미확정 상태 UI 정리
- **✋ Gate:** dead button/₩0 날조 0 · loading/empty/미확정 상태 존재 · 데스크톱/모바일 회귀 0
- **Rollback:** page.tsx revert

### Phase 4: Smoke & 종결
- Status: [ ] Pending
- **🔴 RED:** rollout 실패 모드(미확정 견적 다수 시 지표 공백) 식별 · smoke path 정의
- **🟢 GREEN:** sandbox 프로덕션 재실측 — RFQ-2606-70DK 벤더 실표기·"미확정" 표기·실지출 지표 견적 오염 0
- **🔵 REFACTOR:** 임시 계측 제거 · Notes 종결
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Optional Addenda
- **C. API Slimming(경미):** Phase 2 에서 `product.vendors` include 제거 시 overfetch 감소 — 부수 이득.

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| "총 지출" 공백화(미확정 다수) 사용자 혼란 | Med | Low | "실지출"/"예상(회신 대기 N건)" 라벨 분리 — 정직 표기가 혼란보다 우선 |
| 견적 식별자 필드 부재(project 대체 없음) | Med | Low | 실측 후 없으면 "-"(정직) · 견적번호 필드 있으면 사용 |
| 다벤더 견적 첫벤더만 표시 | Low | Low | 상세행은 대표 벤더 · 필요 시 "외 N" 표기(P3 판단) |
| mobile-reports-p1 sentinel 충돌 | Low | Med | Phase 1 에서 경계 실측 · 충돌 시 진화 판정 상신(임의 진화 금지) |

## 10. Rollback Strategy
- Phase 2 fail: route.ts revert · Phase 3 fail: page.tsx revert. 커밋 phase 분리. 마이그레이션 0.

## 11. Progress Tracking
- Overall: 0% · Current phase: Phase 0 대기 · Blocker: 없음 · Next: Phase 0 착수(수정 지점 라인 잠금)
- [ ] Phase 0 · [ ] Phase 1 · [ ] Phase 2 · [ ] Phase 3 · [ ] Phase 4

## 12. Notes & Learnings
- [2026-07-23] 계획 생성(호영님 "승인"). bug-hunter 조사 root cause 3결함 schema-confirmed 입력.
  결정적 truth: 견적 측 구조적 금액 필드 부재 → ₩0 는 계산 결과가 아니라 데이터 모델 공백. 정직한 수정 =
  미확정 표기 + 지출 합계 제외. 이메일 본문 금액 파싱은 스코프 밖(별도 대형 트랙).
