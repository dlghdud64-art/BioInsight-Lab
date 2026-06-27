# Implementation Plan: §pricing-redesign — 요금제 재설계 (PO 제거·3정찰+Enterprise 문의·가격↓·연간 1mo free)

- **Status:** 🔄 In Progress (P1·P3 land · P2/P4 = pricing-enforce-p2 별도 plan에서 완료 · 잔여: 5소스 완전 일원화 P4)
- **Started:** 2026-06-27
- **Work Type:** Billing / Entitlement (+ Design)
- **Priority Fit:** P2 / post-release (CEO 승인 방향, P1 충돌 0)

⛔ phase별 quality gate 통과 후 다음 진행 · canonical(plans.ts SoT) 보호 · no-op/fake claim 금지.

## 0. Truth Reconciliation
- **★ 가격/엔타이틀먼트가 5개 소스에 분산(일원화 전)**: `lib/plans.ts`(PLAN_PRICES·PLAN_LIMITS) · `lib/billing/plan-descriptor.ts`(operatingVolume·features) · `app/pricing/page.tsx` · `app/dashboard/settings/plans/page.tsx` · `components/checkout/checkout-utils.ts`. → 가격 변경은 **5파일 원자적 동시**(부분 적용 = 화면별 가격 불일치). 일원화(plans.ts SoT)는 P4에서.
- **영향 sentinel 4+**: pricing-refresh-p1(Free 한도)·pricing-refresh-p2(enforce+orders)·plan-unlimited-quotes-po-303b(PO·descriptor·pricing 전반)·plan-descriptor.test·pricing-dashboard-settings.test. PO 제거는 plan-po-303b 전체 재작성 수준.
- **SoT**: `lib/plans.ts`(entitlement) → /pricing 일원화(현재 5소스 분산 해소). DB enum FREE/TEAM/ORGANIZATION + UI Free/Basic/Pro 매핑은 §11.304 완료(migration 불필요).
- **P3-UI 의존성**: land 확인(scan/QR/inline GMP + e2e p4) → Pro GMP dead-end 0. 블로커 해소.
- **결정(호영님 진행, 기본값)**: ① PO 제거 = pricing/entitlement 참조만(PO 앱 페이지 잔존, §6 재진입 별도) ② 라벨스캔 Free 10회 = **카운터 실구현(P2)**, 표기만 노출 금지(fake claim 회피) ③ grandfather 없음(파일럿 초기, 신 limit 직접).
- **Conflicts**: plans.ts ↔ /pricing 이중 하드코딩 → plans.ts 일원화. "PO 전면 제거" vs §6 재진입 → pricing/entitlement만.

## 1. 목표 (스펙 §2~4)
| | Free | Basic | Pro | Enterprise |
|---|---|---|---|---|
| 월간 | 0 | ₩89,000 | ₩259,000 | 문의 |
| 연간(월환산) | 0 | ₩81,583(×11/12) | ₩237,417 | 문의 |
| 사용자 | 1 | 3(+₩30k) | 10(+₩25k) | 협의 |
| maxItems | 50 | 500 | 2,000 | ∞ |
| trackingMode | QUANTITY | QUANTITY | +LOT/GMP_STRICT | 협의 |
| 라벨스캔 | 월 10 | ∞ | ∞ | ∞ |
연 합계 = 월간×11(1개월 무료). Basic 979,000 / Pro 2,849,000.

## 2. Phases
### Phase 1 — plans.ts entitlement 정합 — [x] (2026-06-27, land 대기)
- PLAN_PRICES TEAM 129k→89k·ORG 349k→259k. 연간 10%→1mo-free(×11/12, getAnnualTotalPrice=base×11).
- PLAN_DISPLAY priceDisplay/tagline 갱신(Pro "다부서·GMP").
- PLAN_LIMITS: maxPurchaseOrdersPerMonth **필드 제거** · maxItems(50/500/2000) · maxMembers(Basic 3·Pro 10) · maxLabelScansPerMonth(Free 10·이상 null) · allowedTrackingModes(Free/Basic=[QUANTITY]·Pro=[QUANTITY,LOT,GMP_STRICT]).
- sentinel 진화: pricing-refresh-p1/p2(가격·PO), plan-unlimited-quotes-po-303b(PO).
- ✋ Gate: 가격/연간 산식 정확 · PO 필드 orphan 0 · 기존 plan sentinel 진화 GREEN.

### Phase 2 — enforce-plan-limit 정합 — [ ]
- 라벨스캔 월 카운터(Free 10) enforce 신규 · maxItems/maxMembers enforce 정합 · PO enforce 참조 제거 · allowedTrackingModes 게이팅(Pro만 GMP_STRICT 설정).
- ✋ Gate: 카운터 정직(표기=enforce 일치) · 게이팅 dead-end 0(품위 안내).

### Phase 3 — /pricing 재설계 — [x] (2026-06-27)
> 4카드·1mo-free 토글·가격·PO한도 문구 제거는 P1/§11.304/§11.303b에서 선행 land. P3 추가분:
> 라벨스캔 훅(Free 월 10회/이상 무제한)·LOT-GMP 추적 행 + **Free RFQ/PO fake-claim 봉합**
> (RFQ 5→3 enforce 정합·PO 무제한 한도폐기 정합, descriptor·formatOperatingVolume·po-303b·plan-descriptor.test 동반 진화).
- 4카드(Free/Basic/Pro 정찰 + Enterprise 문의), PO 문구 전 제거→재고·추적 가치, 월/연 토글 1mo-free 뱃지, 라벨스캔 훅 강조, plans.ts import 일원화(하드코딩 제거).
- ✋ Gate: PO 문구 0 · Enterprise 정찰가 미표기·문의 CTA · 토글 산식 일치 · dead button 0.

### Phase 4 — smoke/rollback — [ ]
- Pro GMP e2e(P3-UI 의존성 게이트) · entitlement 전이(Free→Basic→Pro) · rollback 문서.

## 3. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| 라벨 카운터 신규 게이팅 복잡 | Med | Med | P2 분리·월 단위 단순 카운터·정직 표기 |
| plan sentinel 다수 충돌(가격·PO) | High | Med | P1에서 전수 진화(pricing-refresh·po-303b) |
| 가격↓ 기존 결제 영향 | Low | Med | 파일럿 초기 결제 고객 0 추정·grandfather 불요 |

## 4. Rollback
phase별 독립 — P1 plans.ts revert / P2 enforce revert / P3 pricing page revert. PO 앱 미변경(범위 밖).

## 5. Notes
- 2026-06-27: 승인. 3 결정 기본값(PO=pricing만/카운터 실구현/grandfather 없음).
- 2026-06-27 P1 실행(호영님 최종 확정값):
  - 가격 Basic 89,000 / Pro 259,000. 연간 = 1개월 무료(월×11, 월환산 round(월×11/12)).
  - maxItems = 표기(descriptor) 정합: Free 10 / Basic 50 / Pro 200(null→200). descriptor inventoryItems 50/500/2,000 → 10/50/200 (Pro 광고 2,000→200 다운그레이드 = 정직성 정합).
  - 사용자(maxMembers) 3 / 10. 라벨스캔 월 Free 10·이상 null(신규). allowedTrackingModes Free·Basic=[QUANTITY] / Pro=[QUANTITY,LOT,GMP_STRICT](신규).
  - PO 한도: maxPurchaseOrdersPerMonth field 폐기 + enforce-plan-limit "orders" kind 제거 + api/orders/route PO enforce 호출 제거(=plan-po-303b 재작성 수준). PO 발주 자체는 무제한.
  - touch 10파일: lib/plans.ts · lib/billing/plan-descriptor.ts · lib/billing/enforce-plan-limit.ts · app/api/orders/route.ts · app/pricing/page.tsx · app/dashboard/settings/plans/page.tsx + sentinel 4(pricing-refresh-p1 · plan-unlimited-quotes-po-303b · plan-descriptor.test · plan-tier-naming-304) + pricing-refresh-p2(orders enforce 폐기 동반).
  - operator-shell 권위 게이트: new regression 0 · pricing-refresh-p2 RED→GREEN · 표준 baseline 78 불변 · tsc EXIT 0. plan-descriptor.test recommendTag 1단언 stale → 진화 완료(touched 파일 GREEN화).
  - 사전 stale 3건 deferred(§pricing 무관, 별도 §11.30x-cleanup 배치): pricing-refinement-final(§11.201e, 좌석·티어명·credit 섹션 stale) · pricing-labops-credit-section(§11.303 credit 제거) · pricing-plan-credit-removal-303(§11.303).
- 남은 Phase: P2(라벨스캔 월 카운터 enforce + allowedTrackingModes 게이팅 실구현 — 현재 field만 land) · P3(/pricing 4카드 재설계, plans.ts import 일원화) · P4(GMP e2e·전이·rollback).
