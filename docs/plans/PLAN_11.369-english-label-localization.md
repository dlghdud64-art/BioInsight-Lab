# Implementation Plan: §11.369 G-2 영문 라벨 한글화 (런칭 게이트)

- **Status:** ⏳ Pending
- **Started:** 2026-06-04
- **호영님 P1 (G-2 런칭 게이트). 외부 공개 전 클리어 3종 중 G-3·§0 완료 → G-2 마지막.**

**CRITICAL**: phase 완료마다 체크박스·Last Updated / quality gate(Claude Code tsc·lint·test) / **UI 노출 영문 라벨만 한글화, 내부 식별자·타입·엔진명·고유명사 보존** / 미해소 충돌로 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 현 배포(G-3·§0 완료). 미커밋 잔여 = §11.326 RED·compare/page noise(차단됨).

**현 상태 (Phase 0 진단):**
- UI 영문 라벨 후보 3종:
  - **고유명사 (보존)**: LabAxis, Sigma-Aldrich, Thermo Fisher.
  - **role enum (정책 결정)**: ADMIN·VIEWER·APPROVER·REQUESTER.
  - **기능/워크벤치 라벨 (한글화 대상)**: Supplier Confirmation·Stock Release·Receiving Preparation/Execution·Reorder Decision·Compare/Search/Request Reopen·Send-Critical Bridge·Quarantine·Loading… 등.
- governance/workbench 영문 = **73파일 분산**. 단 **다수 `lib/ai/*.ts` 엔진 = 내부 식별자(노출 0) → 보존.** 실 UI 노출 = `app/_workbench/_components/*.tsx` + `components/approval/*workbench.tsx`.

**Conflicts / Phase 0 게이트:**
- 라벨 소스 = 단일 상수(`governance-grammar-registry` 등)에서 와 컴포넌트가 참조 vs 컴포넌트 하드코딩 — **작업 규모를 가름(확정 필요).**
- 정책: role enum 한글화 여부 + 고유명사 보존 + 기능 라벨 한글화 = 호영님 결정.

**Chosen Source of Truth:** UI 노출 라벨만 한글화. lib/ai 엔진·타입·식별자·고유명사 보존.

**Environment:** 코드 편집·grep / tsc·test = Claude Code.

## 1. Priority Fit
- [x] P1 런칭 게이트(외부 공개 전 마지막). G-3·§0 완료.

## 2. Work Type
- [x] Design Consistency [x] i18n/라벨 [x] 다중 surface 횡단(large)

## 3. Overview

**Feature:** UI 노출 영문 raw 라벨(워크벤치·헤더·버튼·배지)을 한글화. 내부 엔진/타입/식별자·고유명사 보존.

**Success Criteria:**
- [ ] UI 노출 영문 기능 라벨 0 (한글화). 고유명사·내부 식별자 보존.
- [ ] role enum 표기 = 호영님 정책값(한글화 or 영문 관례 유지) 일관.
- [ ] "Loading…" 등 시스템 텍스트 한글화.
- [ ] lib/ai 엔진/타입 변경 0(회귀).

**Out of Scope (⚠️):**
- [ ] lib/ai 엔진 내부 식별자·타입·governance grammar key(노출 0).
- [ ] 고유명사(브랜드/제품).
- [ ] §11.367 D-9 등 별도 트랙.

## 4. Product Constraints
- Must Preserve: [ ] 내부 식별자/타입 [ ] 고유명사 [ ] governance grammar key(내부) [ ] 라벨↔로직 매핑
- Must Not: [ ] 엔진 로직 변경 [ ] 식별자 한글화(매핑 깨짐) [ ] 고유명사 번역
- **Canonical Truth Boundary:** UI 표시 라벨 = projection(한글화). 내부 key/enum/타입 = 보존.

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| UI 노출분만(workbench 컴포넌트) | 내부 엔진 보존, 매핑 안전 | UI/내부 분리 식별 필요 |
| 라벨 소스 단일화 확인 | 단일 상수면 1곳 수정 | 하드코딩이면 컴포넌트별 |

**Touched (UI 노출):** `app/_workbench/_components/*workbench.tsx`(다수), `components/approval/*governance-workbench.tsx`. + 라벨 상수(governance-grammar-registry — UI 노출 여부 확인).

## 6. Test Strategy
- sentinel: UI 노출 영문 기능 라벨 0(workbench 컴포넌트 JSX text) + 고유명사·enum 보존 + lib/ai import/타입 보존.
- ⚠️ 실행 = Claude Code.

## 7. Phases

### Phase 0: 라벨 소스 + UI/내부 분리 + 정책 (게이트)
- [ ] governance-grammar-registry 등 라벨 소스가 UI 노출인지 내부 key인지 확정.
- [ ] workbench 컴포넌트 JSX 영문 라벨 전수(UI 노출) vs lib/ai 엔진(내부) 분리 목록.
- [ ] **정책 결정(호영님)**: role enum 한글화 여부 / 고유명사 보존 범위 / 기능 라벨 한글화 확정.
- [ ] 라벨↔로직 매핑(enum value로 분기하는 코드) 영향 확인 — 표시만 한글화, value 보존.
- ✋ Gate: 소스·정책·보존 경계 확정. **Rollback:** planning-only.

### Phase 1~N: 소스군별 한글화 (UI 노출)
- 소스 단일 상수면 → 그 상수 한글화(표시 필드만, key 보존) + sentinel.
- 하드코딩이면 → workbench 컴포넌트군별(supplier-confirmation / stock-release / receiving / reorder-decision …) JSX 라벨 한글화.
- 각 phase: 해당 군 영문 라벨 0 + 매핑 보존 sentinel.

### Phase 마지막: Smoke
- Claude Code tsc/lint/test/build → push → Chrome: UI 영문 기능 라벨 0, 기능 동작 보존.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 식별자/enum value 한글화 → 로직 분기 깨짐 | High | High | 표시 라벨만, value 보존. 매핑 코드 확인 |
| 73파일 광범위 | High | Med | UI 노출분(workbench)만, lib/ai 보존. 군별 분할 |
| 고유명사 번역 | Low | Med | 보존 목록 명시 |
| 라벨↔테스트 sentinel 다수 영향 | Med | Med | 군별 sentinel 동반 |

## 10. Rollback
- 소스군별(Phase별) 독립 revert.

## 11. Progress
- Overall 40% · Current: Phase 2 reorder-decision·receiving-preparation 병기 한글화 완료 · Next: Phase 3 procurement-reentry / po-sent-tracking 군
- Checklist: [x] P0 [x] P1(stock-release·stock-release-reentry) [x] P2(reorder-decision·receiving-preparation) [ ] P3 …

**Phase 2 결과 (2026-06-04):**
- `reorder-decision-workbench.tsx`: 재주문 결정(Reorder Decision), 관찰(Watch), 커버리지(Coverage), 재고 출고(Stock Release) 근거, 출고 가능(Releasable), 보류(Hold), 조달 재진입(Procurement Re-entry) 병기. DECISION_LABELS `watch_only.label` "Watch"→"관찰"(projection 라벨, enum key `watch_only` 보존). enum value(`coverageRiskStatus` 등) 표시 보존.
- `receiving-preparation-workbench.tsx`: 입고 준비(Receiving Preparation), 수량(Qty), 공급사 확인(Supplier Confirmation), 입고 실행(Receiving Execution) 병기. "Lot 추적" = 기술 용어 Lot 유지.
- 보존: class·prop·lib/ai import/타입·enum key. ⏳ baseline = Claude Code 미실행.

**Phase 1 결과 (2026-06-04):**
- `stock-release-workbench.tsx` / `stock-release-reentry-workbench.tsx` 실 UI 영문 라벨 병기 한글화.
  - 제목/첫 등장 병기: 출고 가능 재고(Available Stock Release), 재고 출고(Stock Release), 격리(Quarantine), 출고 가능(Releasable), 보류(Hold), 적격(Eligibility), 재주문 결정(Reorder Decision), 재고 출고 재진입(Stock Release Re-entry), 재주문 결정 재진입(Reorder Decision Re-entry). 본문 반복 = 한글.
  - 보존: enum value(`releaseEligibilityStatus` "ready" 등) 표시값, class, prop, lib/ai import/타입. raw enum 표시("ready")는 별도 트랙(값 보존).
- ⏳ baseline(tsc/lint/test) = Claude Code 미실행. push 전 검증 필요.

**Phase 0 결론 (2026-06-04):**
- `components/approval/*governance-workbench` = **이미 한글 완료**(품질/안전/준법). 보존.
- **대상 = `_workbench/_components` 8 workbench**(stock-release·stock-release-reentry·reorder-decision·receiving-preparation·procurement-reentry·po-sent-tracking·po-created-v2·inventory-intake) — 한영 혼용 실 UI 영문(예 "Available Stock Release", "Stock Release 저장").
- lib/ai 엔진/타입/식별자 = 내부(보존). 고유명사(LabAxis/브랜드) 보존.
- **정책(호영님)**: ① 운영 화면(외부 노출) → 한글화 필수 ② **"한글(영문) 병기"**(제목/첫 등장 병기, 본문 반복 한글).

**병기 매핑:**
- Stock Release→재고 출고(Stock Release) / Supplier Confirmation→공급사 확인(Supplier Confirmation) / Receiving Preparation→입고 준비(Receiving Preparation) / Receiving Execution→입고 실행(Receiving Execution) / Reorder Decision→재주문 결정(Reorder Decision) / PO Sent→발주 발송 / Inventory Intake→재고 입고.
- ⚠️ enum value/내부 key/타입 = 보존(표시 라벨만). role enum(ADMIN 등) = Phase 후반 별도 판단.

## 12. Notes
- [2026-06-04] G-2 = governance/workbench 영문 라벨 73파일 분산. **다수 lib/ai 엔진=내부(보존), UI 노출=workbench 컴포넌트만 대상.** 소스 아키텍처(단일 상수 vs 하드코딩) Phase 0 확정이 규모 가름.
- 정책 게이트 = role enum 한글화 여부 + 고유명사 보존 + 기능 라벨 한글화(호영님).
- 런칭 게이트 마지막(G-3·§0 완료). 외부 공개 전 클리어.