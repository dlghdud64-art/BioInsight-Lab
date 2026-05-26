# §11.303b-2 Commit Message Draft (labOpsCreditMonthly caller 제거 + dashboard/pricing stale 정리 + field 완전 제거)

```
chore(billing): §11.303b-2 #credit-field-removal — labOpsCreditMonthly field 완전 제거 (dashboard/pricing stale 표시 정리 + plan-descriptor field/getter 제거 + test 정합)

호영님 §11.303b spec 정합 (2026-05-25):
§11.303 (UI Credit 표시 제거) + §11.303b-1 (견적/PO 무제한) 후속.
production code caller 0 확인 후 labOpsCreditMonthly field 자체를
schema 에서 완전 제거. §11.303 Q2 "보존" 결정 → §11.303b "caller 제거
후 field 정리" 으로 override.

§11.303b-2 evidence (sandbox 직접 audit):
1. production caller — dashboard/pricing/page.tsx 가 stale "LabOps Credit
   N/월" 표시 중 (§11.303 에서 /pricing 만 정리, dashboard 누락)
2. labOpsCreditMonthly 사용처 grep:
   - production: dashboard/pricing/page.tsx (단 1 file)
   - test: 3 file (assertion only)
3. dashboard/pricing/page.tsx 정리 후 production caller 0 → field 제거 안전

Fix (5 file):

- apps/web/src/app/dashboard/pricing/page.tsx:
  · formatOperatingVolume "Credit" 단어 제거 ("좌석·운영량 모두 계약 기반")
  · RFQ/PO null 분기 추가 (§11.303b 정합 — "견적·발주 무제한" 표기)
  · Credit display line 완전 제거 (`descriptor.labOpsCreditMonthly !== null
    ? "LabOps Credit ${...}/월" : "LabOps Credit 계약 기반"` → 삭제)
  · 3 line 구조 (seats / rfqPo / items) 정합

- apps/web/src/lib/billing/plan-descriptor.ts:
  · PlanDescriptor interface 의 labOpsCreditMonthly field 제거
  · 4 tier (starter/team/business/enterprise) value (100/1500/7500/null) 제거
  · getPlanCreditQuota getter 제거 (test 5 file 정합)

- apps/web/src/__tests__/lib/billing/plan-descriptor.test.ts:
  · import 에서 getPlanCreditQuota 제거
  · "labOpsCreditMonthly — 100/1500/7500/null" assertion 제거
  · "getPlanCreditQuota(intent) 반환" test 제거
  · 필수 필드 union 의 labOpsCreditMonthly toHaveProperty 제거

- apps/web/src/__tests__/marketing/pricing-page-redesign.test.ts:
  · "LabOps Credit 월 한도 표시" test 제거

- apps/web/src/__tests__/regression/pricing-plan-credit-removal-303.test.ts:
  · §11.303 Q2 "보존" / Q3 "30/80 보존" stale assertion 정합:
    - Q2 보존 → §11.303b-2 제거 override (labOpsCreditMonthly field 부재 검증)
    - Q3 보존 → §11.303b 무제한 override (월 30/80건 부재 + "무제한" 존재)
    - getPlanCreditQuota helper 부재 검증
  · §11.304 정합 추가:
    - 운영자 5명/15명 → 3명/10명 정합
    - "추가 운영자 ₩25,000/인" → "추가 1명당 ₩35,000/월" 정합
    - ctaLabel "R&D Operations 시작하기" → "Pro 시작하기"
    - enterprise tagline 새 정합
    - 4 label 등급화 (Free/Basic/Pro/Enterprise) — Starter/Lab Team/R&D
      Operations literal 제거

canonical truth 보존 (회귀 0):
- LABOPS_CREDIT_USAGE_SCENARIOS / PROTECTED_SCENARIOS const 보존
  (Credit 의미만 제거, 상수 자체는 추후 별도 정리 가능)
- 4 plan label / tagline / features (Credit 외) 변경 0
- pricing/page.tsx formatOperatingVolume (§11.303b) 변경 0
- dashboard/pricing/page.tsx Credit 외 logic 변경 0
- tsc baseline 0 → 0 (다른 file 영향 0)

호영님 production effect:
1. labaxis.co.kr/dashboard/pricing:
   - Basic 카드 "견적·발주 무제한" 표기 (이전 "RFQ 30건 / PO 30건" + "LabOps Credit 1,500/월")
   - Pro 카드 "견적·발주 무제한" 표기 (이전 "RFQ 80건 / PO 80건" + "LabOps Credit 7,500/월")
   - Free 카드 "RFQ 5건 / PO 5건 (월)" 유지 (Credit "LabOps Credit 100/월" 제거)
   - Enterprise "좌석·운영량 모두 계약 기반" (이전 "좌석·운영량·Credit 모두 계약 기반")
2. dashboard/pricing 과 /pricing (§11.303b) 정합 완성 — 양쪽 모두 Credit 표시 0
3. plan-descriptor schema 단순화 — 1 field + 1 getter 제거

§11.303b 시리즈 진행:
- §11.303b-1 ✅ Vercel READY (견적/PO 무제한 + 히어로 제목 복원)
- §11.303b-2 ✅ 본 batch (Credit field 완전 제거)
- §11.303b-3 ⏳ maxMembers grandfather (가입자 수 확인 gate, 호영님 환경 위임)
- §11.303b-4 ⏳ additionalSeatPrice field 신규 (per-seat billing 결제 도입 시 defer)

Out of Scope:
- LABOPS_CREDIT_USAGE_SCENARIOS / PROTECTED_SCENARIOS const 제거
  (Credit 의미 0, 상수 자체는 별도 cleanup)
- pricing-page-redesign.test.ts 와 다른 §11.303 history test 의 stale
  assertion 추가 정리 (현 batch 에서 build fail 차단 분만 정합)

Rollback path: git revert <SHA>
- 5 file 복원 (1 production code + 1 schema + 3 test)
- labOpsCreditMonthly field 복원 + Credit 표시 회귀
```

## Push

```powershell
git add `
  apps/web/src/app/dashboard/pricing/page.tsx `
  apps/web/src/lib/billing/plan-descriptor.ts `
  apps/web/src/__tests__/lib/billing/plan-descriptor.test.ts `
  apps/web/src/__tests__/marketing/pricing-page-redesign.test.ts `
  apps/web/src/__tests__/regression/pricing-plan-credit-removal-303.test.ts `
  docs/commit-drafts/COMMIT_11.303b-2-credit-cleanup.md

git commit -F docs/commit-drafts/COMMIT_11.303b-2-credit-cleanup.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/dashboard/pricing:
   - 모든 카드에 "LabOps Credit" 텍스트 0
   - Basic/Pro 카드 "견적·발주 무제한" 표기
   - Free 카드 "RFQ 5건 / PO 5건 (월)" 유지
3. labaxis.co.kr/pricing (§11.303b 정합 유지 검증)

## 후속 batch

| § | scope | 우선도 |
|---|---|---|
| §11.303b-3 | maxMembers 5→3, null→10 + grandfather 정책 (가입자 수 확인 gate) | 호영님 환경 위임 |
| §11.303b-4 | additionalSeatPrice field 신규 | per-seat billing 도입 시 defer |
| §11.305-phase5 | RFQ smoke sentinel push (sandbox 완료, 카드 노출) | 별도 push |
| §11.305-phase6 | release-prep P1 closeout | Phase 5 push 후 |
