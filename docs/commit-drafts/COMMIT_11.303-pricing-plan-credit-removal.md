# §11.303 Commit Message Draft (플랜 구조 개편 + Credit 제거 UI batch)

```
feat(pricing): §11.303 #pricing-plan-credit-removal — pricing/page.tsx LABOPS CREDIT 섹션 → "AI 기능" 섹션 교체 + plan-descriptor AI 등급별 features + CTA "R&D Operations 시작하기" (호영님 P1 Quartzy/Benchling 벤치마크)

호영님 P1 spec (2026-05-25):
Credit 모델은 사용자가 직관적으로 이해 못 함 (Quartzy "Shop Credit"
은 구매 할인 / Benchling 은 per-user 과금, 둘 다 기능 제한 Credit
미사용). LabAxis 플랜 페이지를 시장 표준 (등급별 AI 포함, 사용량
무제한) 으로 정합.

호영님 의사결정 (4 Q):
  Q1 = C (UI 먼저 land, backend defer §11.303b)
  Q2 = 보존 (labOpsCreditMonthly field UI hidden, field 자체는 보존)
  Q3 = 보존 + UI "무제한" 표기 안 함 (literal 불일치 = 표시광고법 +
       B2B 계약 위반 위험 방지)
  Q4 = audit (displayName 정합 — Lab Team / R&D Operations 그대로 확인)

§11.303 (본 batch) scope:
  - pricing/page.tsx LABOPS CREDIT 섹션 (~100 line) → "AI 기능" 섹션 교체
  - 카드 label "LabOps Credit N/월" 제거 + Enterprise "Credit" 단어 제거
  - LABOPS_CREDIT_USAGE_SCENARIOS import orphan cleanup
  - plan-descriptor features array AI 기능 등급별 명시:
    * team: "AI 견적 비교 / 문서 추출 / 운영 브리핑" 추가
    * business: "AI 견적 작성 보조" 추가
    * enterprise: "커스텀 AI 분석" 추가
  - 운영자 추가 단가 명시 (Lab Team ₩25,000/인, R&D Ops ₩20,000/인)
  - business.ctaLabel: "R&D 운영 플랜 상담" → "R&D Operations 시작하기"
  - 건수 한도 (RFQ/PO 30/80) 보존 — backend literal 정합 (Q3)
  - labOpsCreditMonthly / maxQuotesPerMonth / SCENARIOS const 보존 — §11.303b

Fix (2 file + 1 NEW test):

- apps/web/src/lib/billing/plan-descriptor.ts:
  · team.features array — AI 기능 등급별 명시 + 추가 운영자 단가
  · business.features array — AI 견적 작성 보조 + 추가 운영자 단가
  · enterprise.features array — 커스텀 AI 분석 추가
  · business.ctaLabel: "R&D 운영 플랜 상담" → "R&D Operations 시작하기"

- apps/web/src/app/pricing/page.tsx:
  · LABOPS CREDIT 섹션 (line 269-368, ~100 line) → "AI 기능" 섹션 교체
    - 섹션 헤더: "Lab Team 이상 플랜에서 AI 기능을 무제한으로 사용"
    - AI 등급별 5 항목 list (Lab Team+ / R&D Ops+ / Enterprise)
    - "항상 사용 가능한 핵심 운영" 섹션 (LABOPS_CREDIT_PROTECTED_SCENARIOS
      map 보존, descriptor const 변경 0)
    - pilot 무제한 footnote 제거
  · 카드 label helper (line 83-91) — LabOps Credit 4번째 항목 제거
  · Enterprise 라벨 "Credit" 단어 제거 ("좌석·운영량 모두 계약 기반")
  · LABOPS_CREDIT_USAGE_SCENARIOS import orphan cleanup

- apps/web/src/__tests__/regression/pricing-plan-credit-removal-303.test.ts
  (NEW, 18 it × 5 nested describe):
  · §11.303 trace (pricing + descriptor)
  · LABOPS CREDIT 섹션 → AI 기능 섹션 교체 검증 (5 it)
  · 카드 label LabOps Credit 제거 검증 (3 it)
  · plan-descriptor features + CTA 정합 검증 (5 it)
  · 회귀 0: Q2 labOpsCreditMonthly field 보존 + Q3 건수 한도 literal
    보존 + descriptor SCENARIOS const 보존 + displayName / ctaLabel
    보존 (5 it)

canonical truth 보존 (회귀 0, 호영님 Q1=C UI batch):
- labOpsCreditMonthly field schema + getPlanCreditQuota helper 보존
- LABOPS_CREDIT_USAGE_SCENARIOS / LABOPS_CREDIT_PROTECTED_SCENARIOS
  const 보존 — caller 전수 audit 후 §11.303b 에서 제거
- maxQuotesPerMonth limits (30/80) 보존 — backend enforce 그대로 +
  UI literal 정합 (Q3, literal 불일치 = 표시광고법 위험 방지)
- operatingVolume.monthlyRfq / monthlyPo / inventoryItems 변경 0
- approvalPolicy / Stripe price ID / canonical SubscriptionPlan 변경 0
- entitlement / billing logic 변경 0 (UI text swap only)
- /pricing page rendering / motion / Reveal animation 보존

호영님 production effect:
1. /pricing 페이지 진입 → LABOPS CREDIT 섹션 0
2. "AI 기능" 섹션 → 등급별 분기 (Lab Team+ AI 견적 비교 / R&D Ops+
   AI 견적 작성 보조 / Enterprise 커스텀 AI 분석)
3. 플랜 카드 label LabOps Credit 행 0 — 운영자 / RFQ / PO / 재고
   3 항목만 표시
4. R&D Operations 카드 CTA → "R&D Operations 시작하기" (셀프 결제
   전환율 정합, 이전 "상담")
5. 추가 운영자 단가 명시 (Lab Team ₩25,000/인, R&D Ops ₩20,000/인)
6. 건수 한도 (RFQ/PO 30/80) 그대로 표기 — backend enforce 정합

§11.303b 후속 (호영님 Q1=C 결정 정합, 별도 batch):
- labOpsCreditMonthly field caller 전수 audit → 안전 시 제거
  · getPlanCreditQuota helper / PlanDescriptor interface field /
    PLAN_DESCRIPTOR 4 entry 일괄 정합
- LABOPS_CREDIT_USAGE_SCENARIOS / PROTECTED_SCENARIOS const caller
  audit → 제거 또는 generic name (CORE_OPERATIONS_PROTECTED 등) rename
- maxQuotesPerMonth null 변경 (entitlement / billing 정합) + UI
  "무제한" 표기 동시 land (literal 일치 보장)
- customer 영향 검토 (기존 가입자 한도 변경 공지 필요 여부)

Out of Scope (§11.303 본 batch):
- backend entitlement / billing logic 변경 (§11.303b)
- /dashboard/settings/plans/page.tsx — PLAN_DESCRIPTOR import 으로 자동 정합
  (수동 변경 0)
- ENTERPRISE_INFO (lib/plans) — 별도 file, audit 후 필요 시 §11.303c

Rollback path: git revert <SHA>
- 2 file ~120 line 복원 + sentinel test 삭제
- LABOPS CREDIT 섹션 + Credit 라벨 + 이전 features array 회귀

Lessons:
1. literal 불일치 = 신뢰 + 법적 risk — UI "무제한" vs backend 30건
   enforce 는 표시광고법 + B2B 계약 위반 가능성. 호영님 Q3 결정으로
   현재 한도 그대로 표기 + backend 변경은 §11.303b 에서 동시 land.
2. Quartzy / Benchling 벤치마크 정합 — Credit 모델은 시장 표준 아님.
   AI 등급별 포함 (사용량 무제한) 이 정합.
3. UI batch vs backend batch 분리 (호영님 Q1=C) — caller audit 필요한
   field (labOpsCreditMonthly) 는 보존, UI 만 hidden. §11.303b 에서
   safely 제거.
4. orphan import cleanup — LABOPS_CREDIT_USAGE_SCENARIOS 가 새 "AI
   기능" 섹션에서 사용 안 됨 → import 만 제거 (descriptor const 자체
   는 §11.303b 후속).
5. Karpathy minimum-diff — 2 file ~120 line + 1 NEW test (18 it).
   spec 명확 + canonical truth 보호 + 호영님 의사결정 정합.
```

## Push

```bash
git add apps/web/src/lib/billing/plan-descriptor.ts \
        apps/web/src/app/pricing/page.tsx \
        apps/web/src/__tests__/regression/pricing-plan-credit-removal-303.test.ts \
        docs/commit-drafts/COMMIT_11.303-pricing-plan-credit-removal.md

git commit -F docs/commit-drafts/COMMIT_11.303-pricing-plan-credit-removal.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/pricing Cmd+Shift+R
2. 플랜 카드 4종 확인:
   - Starter: 변경 0 (Free, RFQ 5건 / PO 5건 / 50 품목)
   - Lab Team: "AI 견적 비교 / 문서 추출 / 운영 브리핑" 신규 + "운영자
     5명 (추가 ₩25,000/인)" 표기
   - R&D Operations: "AI 견적 작성 보조" 신규 + "운영자 15명 (추가
     ₩20,000/인)" 표기 + CTA "R&D Operations 시작하기"
   - Enterprise: "커스텀 AI 분석" 추가
3. 카드 label 영역 — "LabOps Credit N/월" 행 0 (운영자 / RFQ / PO /
   재고 3 항목만)
4. 하단 섹션 — "AI 기능" 섹션 (이전 LABOPS CREDIT) 노출
5. /dashboard/settings/plans 정합 확인 (PLAN_DESCRIPTOR import 자동
   정합)
6. backend enforce 확인 — RFQ 30건 / 80건 limit 그대로 (literal 일치)

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.303b | labOpsCreditMonthly field 제거 + maxQuotesPerMonth null + UI "무제한" 동시 land | backend caller audit 필요 |
| 새 P0/P1 | 호영님 다른 지시 | — |
