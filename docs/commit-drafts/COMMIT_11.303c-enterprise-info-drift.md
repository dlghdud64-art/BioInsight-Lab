# §11.303c Commit Message Draft (ENTERPRISE_INFO drift 정리)

```
fix(plans): §11.303c #enterprise-info-drift — ENTERPRISE_INFO.features (lib/plans.ts) PLAN_DESCRIPTOR.enterprise.features (plan-descriptor.ts) 정합 + "커스텀 AI 분석" 결락 보강

§11.303 (UI batch) audit 후속 발견:
/pricing 페이지 = PLAN_DESCRIPTOR.enterprise.features (§11.303 정합)
/dashboard/settings/plans 페이지 = ENTERPRISE_INFO.features (stale)
→ 같은 Enterprise 라벨이 두 source 다른 텍스트 표시. canonical truth
violation. ENTERPRISE_INFO 정합으로 drift 차단.

ENTERPRISE_INFO.features swap (6 → 6 항목):
  "Business 전체 기능" → "R&D Operations 전체 +" (§11.303 spec 정합)
  "ERP API 연동" → 제거 (§11.303 spec 외)
  "SSO 지원" → "SSO / SAML / 감사 통제" (확장)
  "무제한 데이터 저장" → 제거 (§11.303 spec 외)
  "전담 매니저 및 SLA" → "전담 온보딩 매니저" + "기관 SLA / 보안 검토 지원" 분리
  "조직 맞춤 구축 지원" → "전용 좌석 / 운영량 협의" 정합
  (신규) "커스텀 AI 분석" — §11.303 AI 등급 spec 결락 보강

ENTERPRISE_INFO.tagline 정합:
  "기관 도입" → "기관 / 법인 — 계약 기반 좌석·운영량"
  (PLAN_DESCRIPTOR.enterprise.tagline 과 통일)

Fix (1 file ~8 line swap + 1 NEW test):

- apps/web/src/lib/plans.ts (ENTERPRISE_INFO line 95-109):
  · tagline: "기관 도입" → "기관 / 법인 — 계약 기반 좌석·운영량"
  · features array: 6 → 6 항목 §11.303 spec 정합 swap
  · §11.303c trace comment 추가

- apps/web/src/__tests__/regression/enterprise-info-traffic-light-303c.test.ts
  (NEW, 10 it × 3 nested describe):
  · §11.303c trace
  · ENTERPRISE_INFO.features 6 항목 정합 + stale 제거 + tagline 검증 (7 it)
  · PLAN_DESCRIPTOR.enterprise vs ENTERPRISE_INFO drift 차단 검증 (1 it)
  · 회귀 0: displayName / priceDisplay / contactEmail / PlanLimits 보존 (2 it)

canonical truth 보존 (회귀 0):
- ENTERPRISE_INFO displayName / priceDisplay / contactEmail 변경 0
- ENTERPRISE_INFO export const 자체는 그대로 (settings/plans/page.tsx import)
- PlanLimits interface / maxQuotesPerMonth field 변경 0 (§11.303b 후속)
- canonical SubscriptionPlan enum 변경 0
- PLAN_DESCRIPTOR.enterprise (plan-descriptor.ts) 변경 0 (§11.303 정합)
- settings/plans/page.tsx 의 ENTERPRISE_INFO.features map 자동 정합 (변경 0)

호영님 production effect:
1. /dashboard/settings/plans Enterprise 카드 — features 6 항목 §11.303
   spec 정합 (이전 "Business 전체 기능" 등 stale 라벨 제거)
2. /pricing 페이지 Enterprise 카드 — 변경 0 (PLAN_DESCRIPTOR.enterprise
   그대로)
3. 두 페이지 Enterprise 카드 features 동일 (drift 차단)
4. "커스텀 AI 분석" 신규 노출 — §11.303 AI 등급 spec 완성

§11.303 시리즈 진행 (3/3 UI batch 종결):
- §11.303 ✅ pricing/page.tsx + plan-descriptor.ts (UI batch 본체)
- §11.303c ✅ ENTERPRISE_INFO drift (본 batch)
- §11.303b ⏳ backend (labOpsCreditMonthly field 제거 + maxQuotesPerMonth
  null + UI "무제한" 동시 land) — caller 전수 audit 필요, 별도 batch

향후 단일화 (§11.303d 후보):
- ENTERPRISE_INFO → PLAN_DESCRIPTOR.enterprise 통합 (single source)
- settings/plans/page.tsx 의 import 변경 + ENTERPRISE_INFO 제거
- caller audit + Type 정합 필요

Out of Scope:
- ENTERPRISE_INFO export const 자체 제거 (§11.303d 후보)
- FEATURE_COMPARISON 11 item array 의 AI 기능 행 추가 (별도 batch)
- backend entitlement / billing logic 변경 (§11.303b)

Rollback path: git revert <SHA>
- 1 file ~8 line 복원 + sentinel test 삭제
- Enterprise features drift 회귀

Lessons:
1. drift 발견 = audit 가치 입증. UI text batch 후 추가 surface (별도
   source) 자동 정합 안 됨 — 같은 라벨이 두 source 면 모두 sync.
2. canonical truth single source — 같은 도메인 (Enterprise plan) 의
   features 가 두 file 에 분산. 향후 단일화 권장 (§11.303d).
3. spec audit 시 surface 확장 — /pricing 외 /dashboard/settings/plans
   같은 추가 surface 도 grep audit 필수.
4. Karpathy minimum-diff — 1 file ~8 line + 1 NEW test (10 it).
```

## Push

```bash
git add apps/web/src/lib/plans.ts \
        apps/web/src/__tests__/regression/enterprise-info-traffic-light-303c.test.ts \
        docs/commit-drafts/COMMIT_11.303c-enterprise-info-drift.md

git commit -F docs/commit-drafts/COMMIT_11.303c-enterprise-info-drift.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/settings/plans Cmd+Shift+R
2. Enterprise 카드 features 확인:
   - "R&D Operations 전체 +" (이전 "Business 전체 기능")
   - "전용 좌석 / 운영량 협의"
   - "SSO / SAML / 감사 통제"
   - "전담 온보딩 매니저"
   - "기관 SLA / 보안 검토 지원"
   - "커스텀 AI 분석" (신규)
3. labaxis.co.kr/pricing Enterprise 카드 — 변경 0 (PLAN_DESCRIPTOR 그대로)
4. 두 페이지 Enterprise 카드 features 일치 확인

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.303b | backend (labOpsCreditMonthly field 제거 + maxQuotesPerMonth null + UI "무제한" 동시 land) | caller 전수 audit + entitlement/billing critical |
| §11.303d | ENTERPRISE_INFO → PLAN_DESCRIPTOR.enterprise 통합 (single source) | caller audit 필요 |
| 새 P0/P1 | 호영님 다른 지시 | — |
