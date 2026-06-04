# Implementation Plan: §11.369-B Sibling Workbench 영문 라벨 한글화 (fast-follow)

- **Status:** ⏳ Pending (런칭 직후 1순위)
- **Started:** 2026-06-04
- **분기:** §11.369 G-2(정방향 8-workbench) 클리어 후속. reentry/예외/비-8-list surface 영문 라벨 sweep.

**CRITICAL**: §11.369 동일 정책 — **운영 화면 외부 노출 영문 → 한글(영문) 병기**, enum value/내부 key/타입/lib/ai 엔진/고유명사 보존. JSX 표시 라벨만.

---

## 0. Truth Reconciliation

**갭 출처:** §11.369 G-2 = 정방향 8-workbench만 한글화. host = `app/_workbench/search/page.tsx`가 sibling(reentry/reopen/detail + 비-8-list 정방향) 다수 import → **외부 도달**. 재진입·예외 흐름 진입 시 영문 노출.

**G-2 success criterion 재정의(정직 보고):**
- ✅ "정방향 8-workbench 영문 0" = G-2 클리어.
- ⚠️ reentry/예외/비-8-list = **알려진 갭** = §11.369-B. "영문 0 전체 달성" 아님.

**비차단 근거:** ① 예외 흐름(노출 빈도 낮음) ② 병기 패턴 동일·기계적 sweep ③ canonical truth 무관(회귀 위험 최소).

**Environment:** 코드 편집·grep / tsc·lint·test·build = Claude Code.

## 1. 대상 (~29 파일, `app/_workbench/_components/`)

### Tier 1 — 비-reentry 정방향 surface (노출 高, 우선)
- supplier-confirmation-workbench
- receiving-execution-workbench
- send-confirmation-workbench
- dispatch-preparation-workbench
- po-created-detail-workbench
- sourcing-result-review-workbench
- approval-workbench
- approval-handoff-gate
- compare-review-center-work-window
- quote-compare-review-workbench (shortlist 2건, minor)
- quote-management-workqueue

### Tier 2 — reentry / reopen (예외 흐름, 후순위)
- supplier-confirmation-reentry · receiving-execution-reentry · receiving-preparation-reentry
- send-confirmation-reentry · dispatch-preparation-reentry · po-sent-reentry-tracking
- po-conversion-reentry · po-created-reentry · approval-reentry
- reorder-decision-reentry · procurement-reentry-reopen · sourcing-search-reopen
- compare-reopen · request-reopen · request-submission-reopen
- quote-compare-reentry · quote-management-reentry · quote-normalization-reentry

## 2. 보존 (한글화 금지)
- enum value/내부 key/타입, lib/ai 엔진, class·prop.
- **고유/규격 용어**: `search-panel`(HPLC Grade·GMP·EP/USP·Cell Culture Tested·Analytical Grade = 산업 규격), `search-analysis-card`("…ELISA kit" 제품명).
- **오탐(코드 조각, 비-라벨)**: candidate-products-card·quote-panel 삼항/조건식, 각 파일 `: x === "..." ?` JSX ternary 단편, test-*(테스트 인프라).
- "Lot" = 기술 용어 유지(§11.369 선례).

## 3. 병기 매핑 (§11.369 계승 + 신규)
- 계승: Stock Release→재고 출고 / Reorder Decision→재주문 결정 / Supplier Confirmation→공급사 확인 / Receiving Execution→입고 실행 / Receiving Preparation→입고 준비 / Procurement Re-entry→조달 재진입 / Watch→관찰 / Acknowledgment→수령 확인 / Dispatch Preparation→발송 준비.
- 신규(확정 2026-06-04, 호영님 "권장 가자"): Compare→비교 / Request→요청 / Shortlist→후보 추림 / Approval→승인 / PO Conversion→발주 전환 / Quote Management→견적 관리 / Normalization→정규화 / **Vendor=Supplier→"공급사" 통일** / Send Confirmation→발송 확인 / Send-Critical→발송 필수 / Non-Critical→비필수 / Eligibility→적격 / Bias→편향 / Recipient→수신자 / Channel→채널 / Payload→페이로드 / Readiness→준비 / Lines→라인 / Candidates→후보 / Stale→경과 / Retained→유지 / Remap→재매핑 / Locked→잠금 / Editable→수정 가능 / Delta→변동 / Capture→기록 / Inbound→입고 예정.
- ✅ Vendor/Supplier 표기 = "공급사" 통일 확정.
- 신규(확정 2026-06-04, 호영님 승인 — sourcing-result-review 게이트): Sourcing→소싱 / (Sourcing) Result Review→결과 검토 / Triage→선별(분류는 category 혼동 회피) / Fit 등급 High·Medium·Low→적합도 高·中·低(영문 병기 유지, raw enum fitScore 값은 별도 트랙 보존) / Exact Match→정확 일치 / Equivalent→동등 / Substitute→대체 / Delta-First Compare→변동 우선 비교 / Reopen→재개(in-product 선례 popup L172) / Candidate Group→후보 그룹 / Blocked→차단.
- 보조(generic, 동일 게이트에서 적용 — 필요 시 호영님 veto): Query→검색어 / Filter→필터 / Baseline→기준선 / handoff→인계 / Items→품목 / Rationale→근거 / Package→패키지 / Review→검토 / Entry→진입 / chain→흐름 / Gate→게이트 / Preview→미리보기 / Blocker→차단 / Warning→경고 / Info→정보. ⚠️ raw enum 표시값(fitScore "high/medium/low")은 한글화 안 함(값 보존, 별도 트랙).
- ⚠️ **handoff 도메인 분기 확정**: 승인 도메인(approval-workbench·approval-handoff-gate)은 in-product 선례대로 handoff→"이관"(승인 이관). 그 외 일반 흐름은 handoff→"인계"(sourcing 등). Vendor/Supplier=공급사 통일과 동일하게 도메인별 고정.

## 4. Phases
- B-1: Tier 1 (정방향 surface, 노출順). 군별 병기 한글화 + sentinel.
- B-2: Tier 2 (reentry/reopen).
- B-마지막: Claude Code tsc/lint/test/build → push → Chrome 육안(전 surface 단독 영문 0).

## 5. Risk
| Risk | Mitigation |
| :-- | :-- |
| enum value/코드조각 오한글화 | 표시 라벨만, ternary/조건식 제외 |
| Vendor/Supplier 표기 분열 | 매핑 사전 통일 후 일괄 |
| 29파일 광범위 | Tier1 우선, 군별 분할 push |
| sentinel 다수 영향 | 군별 sentinel 동반 |

## 6. Rollback
- 파일군별(Phase별) 독립 revert.

## 7. Progress
- Overall ~36% · Tier 1: [x] supplier-confirmation [x] receiving-execution [x] send-confirmation [x] dispatch-preparation [x] po-created-detail [x] sourcing-result-review [x] approval-workbench [x] approval-handoff-gate / [ ] compare-review-center-work-window [ ] quote-compare-review [ ] quote-management-workqueue
- Tier 2: 미착수(18).
- 선결 게이트: ✅ 병기 매핑(Vendor/Supplier=공급사 통일 포함) 확정 완료.

**B Tier1-batch1 결과 (2026-06-04):**
- `supplier-confirmation-workbench.tsx`: 공급사 확인(Supplier Confirmation), 수량(Qty), 수령 확인(Acknowledgment) 근거, 입고 준비 준비도(Receiving Preparation Readiness), 발송 추적(Sent Tracking), 입고 준비 병기. FIELD_LABELS(한글) 보존.
- `receiving-execution-workbench.tsx`: 입고 실행(Receiving Execution), 재고 입고 준비도(Inventory Intake Readiness), 입고 준비/재고 입고 병기. "Lot"=기술 용어 유지. receiptStatus raw enum(full/partial) 표시 보존.
- ⏳ baseline = Claude Code 미실행.

**B Tier1-batch2 결과 (2026-06-04):**
- `send-confirmation-workbench.tsx`: 발송 확인(Send Confirmation), 최종 페이로드(Payload) 확인, PO 발송 상세(PO Sent Detail), 발송 준비(Dispatch Prep)로 병기. done 헤더 "발송 완료"·수신자/채널/발송됨·차단됨 Korean 보존. L55 ternary·canRecord* enum/handler 무변경.
- `dispatch-preparation-workbench.tsx`: 발송 준비(Dispatch Preparation) [헤더/저장/저장 완료], 발송 필수(Send-Critical), 비필수(Non-Critical), 발송 확인(Send Confirmation), PO 생성(PO Created)로 병기. done 헤더 "발송 준비 완료"·수신자/첨부/유효/미입력/필수/선택 Korean 보존. attachment type enum(po_document)·readiness 코드조각 무변경.
- 표시 영문 라벨 0 (잔여 grep 매칭 = 코드조각, 비-라벨). ⏳ baseline = Claude Code 미실행.

**B Tier1-batch3 결과 (2026-06-04):**
- `po-created-detail-workbench.tsx`: PO 생성(PO Created) [헤더/저장/저장 완료], 발송 준비 완료, 발송 필수(Send-Critical), 비필수(Non-Critical), 발송 준비(Dispatch Preparation) 병기. PO 헤더·결제 조건·배송지 등 기존 한글 보존. status raw enum·handler 무변경.
- `sourcing-result-review-workbench.tsx`: 6종 신규 매핑 + Reopen→재개 일괄 적용. 소싱 결과 검토(Sourcing Result Review), 선별(Triage), 적합도 高/中(High/Medium Fit), 정확 일치/동등/대체(Exact Match/Equivalent/Substitute), 차단(Blocked), 변동 우선 비교(Delta-First Compare), 비교/요청 재개(Compare/Request Reopen), 검색 재개(Search Reopen), 검색어/필터/기준선(Query/Filter/Baseline), 인계(handoff) 병기. DECISION_CONFIG 한글 라벨·enum key 보존. ⚠️ raw enum fitScore("high/medium/low") 표시값 = 미한글화(별도 트랙).
- 표시 영문 라벨 0 (잔여 = L133 ternary 코드조각, fitScore raw enum). ⏳ baseline = Claude Code 미실행.

**B Tier1-batch4 결과 (2026-06-04):**
- `approval-workbench.tsx`: 승인 워크벤치(Approval Workbench), 이관 패키지(Handoff Package), 공급사(Vendor)/품목(Items)/근거(Rationale), 발주 전환 진입(PO Conversion Entry)·비교 검토(Compare Review)·요청 재개(Request Reopen)·승인 흐름(chain) 병기. APPROVAL/RETURN/REJECT_REASONS 한글 라벨·enum code 보존. decisionMode ternary 무변경.
- `approval-handoff-gate.tsx`: 승인 이관 게이트(Approval Handoff Gate), 차단(Blocker)/경고(Warning)/정보(Info), 승인 페이로드 미리보기(Approval Payload Preview), 패키지 ID(Package ID), 승인 워크벤치(Approval Workbench) 병기. handoff→이관(승인 도메인 선례). preview row 라벨(선택 옵션·공급사 등) 기존 한글 보존. SEVERITY_CONFIG·gateStatus enum 무변경.
- 표시 영문 라벨 0 (잔여 = ternary 코드조각). ⏳ baseline = Claude Code 미실행.
