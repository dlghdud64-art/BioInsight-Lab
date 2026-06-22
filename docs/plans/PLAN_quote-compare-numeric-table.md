# Implementation Plan: §10 견적 비교 숫자 세부표 (총액 기반 v1)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-22
- **Last Updated:** 2026-06-22

⛔ quality gate 실패 시 다음 phase 금지 · dead button/no-op/placeholder success 금지 · canonical truth 보호

## 0. Truth Reconciliation
- **Latest Truth Source:** page.tsx Quote 모델 — `responses[]: { vendor:{name}; totalPrice?: number; createdAt }`. 공급사별 **총액만 canonical**.
- **Conflicts:** §10 시안 세부표는 단가·납기·최소주문(moq) 컬럼 요구 → 이 필드는 데이터 모델에 **없음**. AI 추정 = §11.318 환각 위반.
- **Chosen Source of Truth:** canonical = `min(responses[].totalPrice>0)` per quote. 단가/납기/moq = 미수집(honest placeholder), 날조 금지.
- **Env:** sandbox edit only; operator vitest+build+push.

## 1. Priority Fit
- [x] P1 인접 (견적 워크플로 핵심, dead button 봉합 연장). 호영님 2026-06-22 "숫자 세부표 가자" + 범위 A 선택.

## 2. Work Type
- [x] Feature (route enrich + UI wiring)

## 3. Overview
총액 canonical 만으로 순위 카드(예상총액·순위·점수·1순위 추천 리본) + 세부표 + 협상포인트. 환각 0, 마이그레이션 0.

**Out of Scope:** 단가/납기/moq 컬럼 채우기(데이터 모델 부재), prod DB 마이그레이션(B 트랙).

## 4. Product Constraints
- Source of Truth: `quote.responses[].totalPrice`
- Derived: rank(총액 asc) / score(가격 정규화 0~100) / recommended(rank===1)
- Surface: 기존 `aiCompareOpen` Dialog same-canvas 유지 (신규 페이지 0)
- Must not: 숫자 날조, dead button, page-per-feature

## 5. Phases
- [x] **P1 계약+실패테스트:** payload에 quote별 canonical `totalPrice` 추가 + `aiCompareResult` row shape 확장(totalPrice/rank/score/recommended) + sentinel(실패 먼저)
- [x] **P2 결정론 enrich:** route에서 총액→순위→점수→추천 (날조 0, totalPrice 없으면 rank null·"견적 확인 필요")
- [x] **P3 모달 렌더:** 순위 카드 top3 + 세부표(총액/순위/점수, 단가·납기·moq=미수집) + 협상포인트
- [ ] **P4 smoke + rollback**

## 6. Rollback
- route enrich revert → 직전 정성 v1 (이미 배포된 dead-button 봉합)로 복귀
- 프론트 payload/모달 revert → 기존 정성 표
- feature flag 불필요 (모달 내부 한정, 동일 surface)

## 7. Notes
- [2026-06-22] canonical = totalPrice only. 점수는 단일축(가격)이므로 "가격 점수"로 표기, "종합점수" 오인 방지.

---

## 8. 확장 — 시안 CompareModal 풀 빌드 (호영님 2026-06-22, 시안 소스 수령)
시안 소스(quote-modals.jsx CompareModal + quote-modals.css)를 정본으로 대시보드 비교 모달 풀 빌드.
- [x] route 리치 shape: vendors/recommendedIdx/recommendation/ranks/rows/totalRow/negotiationPoints/note (결정론 총액·순위·점수 + Gemini 정성)
- [x] 모달 layout: 네이비 AI 종합추천 + 순위 카드 3(종합점수·총액·이유·AI 추천 리본) + 세부표(단가·납기·최소주문+예상총액, 행별 ✓, ★추천 열 accent) + 납기 주석 + AI 협상 포인트
- [x] state 리치 shape 교체 + DialogContent max-w-3xl + sentinel 갱신
- [x] **Phase 2 — per-RFQ 피봇 + 데이터 와이어링(B1)**: QuoteVendorResponseItem(unitPrice/leadTimeDays/moq) → quotes GET include → payload → route. 현재 단가/납기/moq는 "미수집"(canonical 부재, 환각 0).
- [ ] **권한 없음(role) in-modal 상태**: 현재 perm-gate(setPermGate)로 사전 차단 중. 시안 role 패널 in-modal 채택 여부 결정 후.
- [ ] "추천 공급사로 발주 준비" 풋터 CTA: 발주 전환 wiring 확정 후(dead button 방지로 현재 보류).
