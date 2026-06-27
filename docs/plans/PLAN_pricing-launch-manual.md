# Implementation Plan: §pricing-launch-manual — 수동 결제 즉시 출시 (트랙 1)

- **Status:** ✅ Complete (Batch A land) — **Batch B(P4 admin lifecycle·P5 수동 entitlement) 취소** (호영님 2026-06-27: 입금-수동-대기 운영 과함)
- **결정:** 도입 신청 = 리드 수집만(Batch A, land 6cd1b5cc). 활성화 = 영업 오프라인 협의 + **기존 billing settings canonical 경로 수동**(신규 admin 화면·인보이스/입금 lifecycle 미구축). 본 결제 경로는 트랙2 §billing-infrastructure(포트원 자동결제).
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Billing / Entitlement + Admin UI + Migration

**CRITICAL INSTRUCTIONS** (phase 완료마다): 체크박스·quality gate·Last Updated·Notes·다음.
⛔ entitlement 부여는 **canonical 경로(workspace.plan + subscription, plans.ts 값)** 그대로 — 별도 우회 로직 금지(canonical 보호).
⛔ 인프라 없는 약속 노출 금지: "30일 무료 체험·자동결제·정기결제" 미노출(트랙2 완성 후 §basic-trial-autopay 부활).
⛔ prod migration = §9.9 dry-run→보고→"진행" 게이트. sandbox commit/migrate 금지.

---

## 0. Truth Reconciliation
**Latest:** §pricing P1~P4+cleanup+copy-cleanup land(ba6c37d7). §pricing-prelaunch P1/P2/P4 land(e1175a8d, 가격 89k/259k·연간 79k/229k·약11%·미노출). 
**전환:** CEO 2026-06-27 두 트랙 — 트랙1 수동 결제 즉시 출시(본 plan) + 트랙2 §billing-infrastructure(포트원, 병행 백로그).
**인플라이트 재활용(★):** §pricing-prelaunch P3/P5(빌드됨·미push) = CTA "출시 알림 신청" + `LeadSignup`(이메일) + 인라인 폼 + `/api/leads` + sentinel 2 진화. → **본 트랙이 흡수**: CTA "도입 신청", `LeadSignup`→`EnrollmentRequest`(회사·플랜·주기·연락처·상태), `/api/leads`→`/api/enrollments`, 폼 필드 확장. LeadSignup migration은 **apply 안 함**(EnrollmentRequest로 대체).
**Chosen SoT:** 가격=PLAN_PRICES(+ANNUAL). entitlement=canonical workspace.plan+subscription(plans.ts 게이팅). 도입신청=EnrollmentRequest.
**Env:** sandbox vitest 불가 → 정적 replay + operator-shell 게이트.

## 1. Priority Fit
- [x] Release (즉시 출시). 결제 인프라(트랙2) 완성 전 수동 결제로 매출 개시. P1 충돌 0.

## 2. Work Type
- [x] Billing/Entitlement · [x] Admin UI(운영 화면) · [x] Migration

## 3. Overview
**기능:** Basic/Pro CTA "도입 신청" → 도입 신청 폼 → 내부 관리자 운영 화면(신청 접수→인보이스 발행→입금 확인→entitlement 수동 부여→상태 추적). 가격/연간/미노출 정책은 prelaunch(land)와 동일.

**Success Criteria:**
- [ ] Basic/Pro CTA "도입 신청" → 도입 신청 폼(회사·플랜·주기·연락처). Free 무료 시작·Enterprise 영업 문의 유지.
- [ ] `EnrollmentRequest` 모델 + 상태 lifecycle(requested→invoiced→payment_pending→active→expired/renewal).
- [ ] admin 운영 화면(/dashboard/admin/enrollments): 목록·인보이스 입력·입금 확인·entitlement 부여·상태.
- [ ] entitlement 수동 부여 = **canonical 경로**(workspace.plan + subscription, plans.ts plan + 기간). 우회 0.
- [ ] 만료 임박/갱신 대상 표시. 미노출(체험/자동결제) 유지. 신규 회귀 0.

**Out of Scope (⚠️ — 트랙2 §billing-infrastructure):**
- [ ] 포트원 빌링키·정기결제·자동전환·해지·환불 · "30일 체험" 노출 · 실 PG 청구 · 세금계산서 자동발행(인보이스는 수동 정보 입력 수준)

**User-Facing Outcome:** Basic/Pro 즉시 도입 신청 가능 → 내부 수동 결제/입금 확인 후 플랜 활성. Free 즉시 무료.

## 4. Product Constraints
**Must Preserve:** canonical entitlement(plans.ts·subscription)·workbench/admin 구조·미노출 정책·가격 SoT·dead button 0
**Must Not Introduce:** entitlement 우회 부여 · 인프라 없는 자동결제 노출 · page-per-feature(admin은 기존 admin surface 흡수)
**Canonical Truth Boundary:** SoT=workspace.plan+subscription(plans.ts). EnrollmentRequest=신청/운영 상태(entitlement 아님 — active 전환 시 canonical 부여). 부여 경로=기존 subscription 활성 경로 재사용.
**UI Surface Plan:** [x] 공개 도입신청 폼(/pricing 인라인 재활용) · [x] 기존 admin 영역 내 운영 화면(/dashboard/admin/enrollments) — 신규 top-level page 아님.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| EnrollmentRequest 모델(신청+운영 상태) | 수동 lifecycle 추적 | prod migration |
| entitlement = canonical subscription 활성 재사용 | canonical 보호·트랙2 전환 무충돌 | 기존 활성 경로 audit 필요 |
| prelaunch P3/P5 재활용(CTA/폼/route 변환) | 중복 0·최소 diff | LeadSignup→EnrollmentRequest 치환 |
| admin 운영 화면 = 기존 admin 흡수 | page-per-feature 회피 | admin IA 정합 |

**Touched(예상):** `prisma/schema.prisma`(EnrollmentRequest) · `app/api/enrollments/route.ts`(신청 POST, /api/leads 대체) · `app/api/admin/enrollments/*`(목록·상태·entitlement 부여) · `lib/billing/plan-descriptor.ts`(CTA "도입 신청") · `app/pricing/page.tsx`(폼 필드 확장·CTA) · admin 운영 화면 page · entitlement 부여 서비스(기존 subscription 활성 재사용) · sentinel.
**Dependencies:** 기존 subscription/workspace.plan 활성 경로 확인(P0). prelaunch 인플라이트 변환.

## 6. Global Test Strategy
- sentinel: CTA "도입 신청"·EnrollmentRequest 모델·신청 API·admin 운영 화면·entitlement canonical 부여(우회 0)·미노출 유지.
- entitlement 부여 = 단위(plans.ts plan 값 일치). migration dry-run 게이트. operator-shell baseline·tsc.

## 7. Implementation Phases
### P0 — Context & Truth Lock — [x] (2026-06-27)
> canonical entitlement 활성 경로 = `api/billing/route.ts` + `api/organizations/[id]/subscription` 의 `subscription.upsert`(plan+status+기간) + webhook(billingStatus). P5 수동 부여는 이 경로 재사용(우회 0). EnrollmentRequest=신청/운영 상태(entitlement 아님). prelaunch P3/P5 재활용: CTA→"도입 신청"·LeadSignup→EnrollmentRequest·/api/leads→/api/enrollments.

### P1 — 계약 & 실패 sentinel — [ ]
**🔴** CTA "도입 신청"·EnrollmentRequest·/api/enrollments·admin 운영 화면·entitlement canonical 부여 계약(RED)
**✋ Gate:** 실패테스트 real·기존 GREEN 유지

### P2 — EnrollmentRequest 모델 + migration — [ ]
**🟢** schema(company·planIntent·billingCycle·contact·status·invoice 정보·createdAt/updatedAt/activatedAt) → **migration dry-run 게이트**
**✋ Gate:** 파괴성 0·상태 enum/문자열 확정

### P3 — 공개 도입 신청 폼 + CTA — [ ]
**🟢** prelaunch 폼 재활용 → 회사·연락처·주기 필드 추가 · CTA descriptor "도입 신청" · /api/enrollments POST(LeadSignup→EnrollmentRequest)
**✋ Gate:** dead button 0·결제수단 0·신청 저장

### P4 — admin 운영 화면 — [ ]
**🟢** /dashboard/admin/enrollments: 목록(회사·플랜·주기·상태·신청일)·인보이스 정보 입력·입금 확인(상태 전환)·entitlement 부여 트리거·만료/갱신 표시. RBAC(admin only)
**✋ Gate:** 상태 lifecycle 정합·dead button 0·권한 게이트

### P5 — entitlement 수동 부여 (canonical) — [ ]
**🟢** 입금 확인 시 canonical 활성(workspace.plan + subscription, plans.ts plan + 기간) — 기존 활성 경로 재사용, 우회 0. P1 entitlement(trackingMode·재고·라벨스캔·멤버) 자동 적용
**✋ Gate:** canonical 경로·plans.ts 값 일치·우회 0·전이 정합

### P6 — Smoke / Rollback — [ ]
**🟢** 신청→인보이스→입금→활성 smoke · baseline · tsc · rollback
**✋ Gate:** lifecycle 정합·회귀 0  **Rollback:** phase 단독; entitlement 부여는 canonical revert 경로

## 8. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| entitlement 우회 부여(canonical 훼손) | Med | High | 기존 subscription 활성 경로 재사용·sentinel 강제 |
| EnrollmentRequest migration | Med | Med | dry-run→진행 게이트·신규 빈 테이블 |
| admin 운영 화면 dead button/no-op | Med | Med | 상태 전환 실배선·RBAC |
| 자동결제 카피 노출(전상법) | Low | High | 미노출 sentinel 유지 |
| 트랙2 전환 시 모델 충돌 | Low | Med | EnrollmentRequest=신청상태 / subscription=entitlement 분리 |

## 9. Rollback
- phase 독립. entitlement 부여(P5)는 canonical 비활성 경로로 revert. 모델(P2)은 빈 테이블 drop. CTA/폼(P3) revert.

## 10. Progress
- Overall: Batch A land(6cd1b5cc) · Batch B 취소 · 트랙 종료
- [x] P0 [x] P1 [x] P2(apply 6cd1b5cc) [x] P3 [~] P4 취소 [~] P5 취소(기존 billing settings 수동) [~] P6 취소
- **2026-06-27 결정:** Batch B 무거운 수동 입금 lifecycle 미구축. 도입 신청(EnrollmentRequest)은 리드로 적재 → 영업이 기존 billing settings(canonical subscription.upsert)로 수동 활성. 자동결제는 트랙2 포트원.

**Batch A Notes (2026-06-27):** prelaunch P3/P5 변환 — CTA "도입 신청"(descriptor) · `EnrollmentRequest` 모델(LeadSignup 대체, 미apply였음) · `/api/leads` → EnrollmentRequest insert(status=requested, 결제수단 0) · /pricing 인라인 도입신청 폼(회사·담당자·이메일·플랜·주기) · handlePlanSelect team/business→#notify. sentinel: pricing-prelaunch-cta-lead(도입신청/EnrollmentRequest)·plan-tier-naming-304(ctaLabel 도입 신청)·plan-descriptor.test(/신청/ 매칭). 정적 35/35 GREEN. **P2 EnrollmentRequest migration = §9.9 dry-run→진행 게이트(코드+migration 원자 land).** Batch B = P4 admin 운영 화면 + P5 entitlement canonical 부여.

## 11. Notes
- 2026-06-27: 생성. 트랙1(수동 즉시 출시). prelaunch P1/P2/P4 land 유지·P3/P5 흡수(LeadSignup→EnrollmentRequest, "출시 알림"→"도입 신청"). 트랙2 포트원 = §billing-infrastructure 백로그. entitlement는 canonical 경로 강제.
