# Implementation Plan: §pricing-prelaunch — 결제 인프라 전 "곧 출시 / 사전 예약" 모드

- **Status:** 🔄 In Progress (P0)
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Design Consistency (copy/CTA) + Billing(표시 정합, 결제 0)

**CRITICAL INSTRUCTIONS** (phase 완료마다): 체크박스·quality gate·Last Updated·Notes·다음.
⛔ 결제 0(PG 미연동) — 실 결제 플로우·결제수단 등록 금지.
⛔ **인프라 없는 약속 노출 금지(fake claim)**: "30일 무료 체험"·"자동 결제/전환"·"정기결제" 카피 0. → §billing-infrastructure 완성 후 §basic-trial-autopay 로 부활.

---

## 0. Truth Reconciliation
**Latest:** §pricing P1~P4+cleanup+copy-cleanup land(ba6c37d7). 가격 SoT=PLAN_PRICES(월 89k/259k). 연간=P4에서 ×11/12 파생(표시 81,583/237,417·"1개월 무료"). trialEligible(Basic) 데이터 플래그(노출 0). PO 카피 0(copy-cleanup).
**전제:** PG 미연동·정기결제/해지/환불 인프라 0 → 실 결제 불가. 방향: 가격·기능 노출 + 결제 대신 리드 수집("곧 출시/사전 예약"). CEO 승인.
**Conflicts:**
- **연간값 역전(★)**: P4 ×11/12 파생 → 신 스펙 **명시 절사값**: Basic 연환산 79,000(연 948,000)·Pro 229,000(연 2,748,000) + "약 11% 할인" + "출시 후 적용". "1개월 무료" 제거. → 연간 파생 산식 폐기, 명시 연간 상수 신설.
- 결제 CTA(시작하기) → 리드 수집(출시 알림 신청). 메인 플로우 결제 비활성.
- 전용 리드폼 부재(grep) — /support 문의만 존재.
**Chosen SoT:** 월 가격=PLAN_PRICES. **연간=명시 상수**(PLAN_PRICES_ANNUAL_MONTHLY {TEAM:79000, ORG:229000}). trial 노출=없음(billing-infra 후).
**Env:** sandbox vitest 불가 → 정적 replay + operator-shell 게이트.

## 1. Priority Fit
- [x] Post-release / 출시 전 정합. 결제 인프라(§billing-infrastructure)는 백로그 — prelaunch가 그 전 정직한 노출 상태 확정. P1 충돌 0.

## 2. Work Type
- [x] Design Consistency (CTA/copy) · [x] Billing (표시 정합, 결제 0)

## 3. Overview
**기능:** /pricing·settings 를 "곧 출시" 모드로 — 가격/기능 노출 유지, Basic/Pro CTA를 "출시 알림 신청"(리드)으로, 연간 토글은 명시 절사값+"출시 후 적용", 인프라 없는 약속(체험/자동결제) 전면 미노출.

**Success Criteria:**
- [ ] 연간 = 명시 79k/229k 표시 + "약 11% 할인" + "출시 후 적용" 라벨. "1개월 무료" 0.
- [ ] Basic/Pro CTA = "출시 알림 신청"(리드 수집). Free=유지(/dashboard). Enterprise=영업 문의.
- [ ] "30일 무료 체험"·"자동 결제/전환"·"정기결제" 카피 0(sentinel).
- [ ] PO/발주 카드 카피 0(재검증). 결제수단 등록 플로우 0.
- [ ] 신규 회귀 0.

**Out of Scope (⚠️):**
- [ ] 실 결제·정기결제·해지·환불(§billing-infrastructure) · trial autopay(§basic-trial-autopay) · 세금계산서/약관·법무

**User-Facing Outcome:** 가격·기능 보이되 "곧 출시", Basic/Pro는 출시 알림 신청(이메일만), 연간은 출시 후 적용 가격 미리보기.

## 4. Product Constraints
**Must Preserve:** 4카드·가격 표시·canonical(PLAN_PRICES)·PO 0·dead button 0
**Must Not Introduce:** 결제수단 등록 · fake 체험/자동결제/정기결제 노출 · dead "출시 알림" 버튼(리드 폼 미연결)
**UI Surface Plan:** [x] 기존 /pricing 카드·토글 CTA 수정 + 리드 수집 폼(신규 경량 or /support 재사용 — Q1).

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| 연간 명시 상수(79k/229k) | CEO 절사값·"약 11%"·체험혼동 제거 | P4 ×11/12 파생 폐기·sentinel 진화 |
| CTA → 출시 알림 신청(리드) | PG 미연동 정직 | 리드폼 의존(Q1) |
| 체험/자동결제/정기결제 미노출 | fake claim 0 | billing-infra 후 부활 |

**Touched(예상):** `lib/plans.ts`(연간 상수+함수) · `app/pricing/page.tsx`(토글 카피/라벨·CTA) · `lib/billing/plan-descriptor.ts`(ctaLabel/route Basic/Pro) · settings/plans · 리드폼(신규 or 재사용) · sentinel(신규 + P4/304 진화).
**Dependencies:** Q1(리드폼 방식)·Q2(토글 표시) 확정.

## 6. Global Test Strategy
- sentinel: 연간 명시값·"약 11% 할인"·"출시 후 적용"·"1개월 무료" 0 · CTA "출시 알림 신청" · 체험/자동결제/정기결제 0 · PO 0 · 리드폼 wiring(dead button 0).
- operator-shell: baseline·tsc.

## 7. Implementation Phases (확인 후 확정)

### Phase 0 — Context & Truth Lock — [ ]
**🔴** 연간 역전·CTA·리드폼 부재·미노출 목록 확정
**🟢** 연간 상수값(79k/229k)·"약 11% 할인" 검산·미노출 카피 목록·리드폼 방식(Q1) 확정
**✋ Gate:** 충돌·값·Q1/Q2 확정  **Rollback:** planning-only

### Phase 1 — 계약 & 실패 테스트 — [ ]
**🔴** sentinel(RED): 연간 79k/229k+"약 11% 할인"+"출시 후 적용"·"1개월 무료" 0 · CTA "출시 알림 신청" · 체험/자동결제/정기결제 0 · PO 0
**✋ Gate:** 실패테스트 real·기존 GREEN 유지

### Phase 2 — 연간 명시값 SoT — [ ]
**🟢** `PLAN_PRICES_ANNUAL_MONTHLY{TEAM:79000,ORG:229000}` + getAnnualMonthlyPrice/Total 명시값 반환(×11/12 폐기) · /pricing 토글 "약 11% 할인"+"출시 후 적용"(— "1개월 무료") · P4 sentinel(×11) 진화
**✋ Gate:** 연간 표시 79k/229k·할인 라벨·"1개월 무료" 0

### Phase 3 — CTA 리드 전환 — [ ]
**🟢** descriptor Basic/Pro ctaLabel "출시 알림 신청"·ctaRoute 리드폼 · Free 유지 · Enterprise 영업 문의 유지
**✋ Gate:** dead button 0·CTA 정합

### Phase 4 — 미노출 sweep — [ ]
**🟢** 체험/자동결제/정기결제 카피 0 강제(sentinel) · PO 0 재검증
**✋ Gate:** fake claim 0

### Phase 5 — 리드 수집 폼 (Q1) — [ ]
**🟢** (a) 신규 경량 폼(이메일만, 결제수단 0, lead 저장/알림) OR (b) /support 재사용 — Q1 확정 후
**✋ Gate:** 폼 동작·결제수단 0·dead button 0

### Phase 6 — Smoke / Rollback — [ ]
**🟢** 가격 표시·CTA·리드폼 smoke · baseline · tsc
**✋ Gate:** 회귀 0·rollback 문서  **Rollback:** phase 단독 revert

## 8. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| 연간값 역전이 P4 sentinel 깸 | High | Low | P4 sentinel 진화(×11→명시값) |
| "출시 알림" dead button(폼 미연결) | Med | Med | P5 폼 연결 전 CTA 노출 금지(게이트) |
| 체험/자동결제 카피 잔존 | Med | High | P4 sweep sentinel |
| 리드폼 방식 미정 | Med | Med | Q1 확정 게이트 |

## 9. Rollback
- phase 독립 revert. 연간(P2)·CTA(P3)·폼(P5) 각 단독. 값/카피 변경이라 무해.

## 10. Progress
- **2026-06-27 재구조화:** P1/P2/P4(가격·연간·미노출) = land(e1175a8d), 트랙1과 일치 유지. **P3/P5(출시 알림 신청 lead + LeadSignup)는 §pricing-launch-manual(트랙1)이 흡수 — push 보류, "도입 신청"+EnrollmentRequest로 재활용.** 이 문서 P3/P5/P6은 launch-manual에서 진행.
- Overall: P1/P2/P4 land · P3/P5 → launch-manual 흡수
- [x] P0 [x] P1 [x] P2 [x] P3 [x] P4 [~] P5(코드 완료·migration 게이트) [ ] P6

**P3/P5 Notes (2026-06-27):** Basic/Pro CTA "출시 알림 신청" → handlePlanSelect 가로채기(team/business → #notify 스크롤, 결제 resolver 미호출). /pricing 인라인 폼(이메일+plan select → /api/leads, 결제수단 0). 신규 LeadSignup 모델(migration). FAQ "결제 후 바로 활성화" fake 제거. 정적 24/24 GREEN. 진화: plan-descriptor.test ctaLabel · plan-tier-naming-304(Basic/Pro→출시 알림 신청). 신규 sentinel pricing-prelaunch-cta-lead. **migration = §9.9 dry-run→진행 게이트(CTA+폼은 migration apply 후 push — dead button 회피).**

**Notes:** 2026-06-27 Q1=(a)신규 경량 리드폼·Q2=(b)출시 후 적용 확정. P2(연간 명시 79k/229k·약11%·출시후적용, ×11/12 폐기)+P4(미노출 체험/자동결제/정기결제 0)+P1 sentinel land 준비. 정적 31/31 GREEN. 진화: pricing-refresh-p1(연간 명시값)·plan-tier-naming-304·pricing-label-scan-tracking-p3(약11%). 신규 sentinel pricing-prelaunch. **P3 CTA "출시 알림 신청" + P5 리드폼은 LeadSignup migration(§9.9 게이트) 동반 sub-batch — dead button 회피 위해 동시 land.**

## 11. Notes
- 2026-06-27: 생성. §pricing-billing-backend → §billing-infrastructure 백로그 주차. 연간 명시 절사값(79k/229k) = P4 ×11/12 역전. 체험/자동결제/정기결제 = §billing-infra 후 §basic-trial-autopay 부활. Q1(리드폼)·Q2(토글) 확정 대기.
- 기본 권고: Q1=(a) 신규 경량 리드폼(분리 추적), Q2=(b) "출시 후 적용" 라벨.
