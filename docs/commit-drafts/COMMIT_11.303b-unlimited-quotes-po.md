# §11.303b Commit Message Draft (Basic/Pro 견적·PO 무제한 + /pricing 히어로 제목 복원)

```
feat(pricing): §11.303b #plan-unlimited-quotes-po — Basic/Pro 견적·PO 무제한 (backend null + UI literal 동시) + /pricing 히어로 제목 복원 (호영님 P0)

호영님 P0 (2026-05-25):
§11.303 (Credit 제거) + §11.304 (티어 네이밍·인원) 후속 — UI 표기와
backend enforce 정합 동시 land. literal 불일치 0.
플랜 페이지가 production 에 "30건/80건 제한" 으로 노출 중인 상태 해소
+ §11.304 히어로 제거 후 휑한 상단 가벼운 제목으로 정리.

§11.303b 본 batch (b-1 P0 무제한 + 히어로 복원):

1. plans.ts PlanLimits 정합:
   - FREE.maxQuotesPerMonth 10 → 5 (호영님 spec)
   - TEAM(Basic).maxQuotesPerMonth 100 → null (무제한)
   - ORGANIZATION(Pro).maxQuotesPerMonth null 유지
   - 신규 field: maxPurchaseOrdersPerMonth (FREE 5, TEAM null,
     ORGANIZATION null)

2. plan-descriptor.ts operatingVolume null swap:
   - team.monthlyRfq 30 → null, monthlyPo 30 → null
   - business.monthlyRfq 80 → null, monthlyPo 80 → null
   - starter(Free) 5/5 유지, enterprise null 유지

3. plan-descriptor.ts features 무제한 swap:
   - team "견적 요청 (월 30건)" → "견적 요청 무제한", "PO 발행 (월 30건)"
     → "PO 발행 무제한"
   - business "견적 요청 (월 80건)" → "견적 요청 무제한", "PO 발행 (월 80건)"
     → "PO 발행 무제한"
   - starter(Free) "(월 5건)" 유지

4. pricing/page.tsx formatOperatingVolume 무제한 분기:
   - monthlyRfq/monthlyPo null 분기 → "견적·발주 무제한" 표기
   - seatsLine + rfqPoLine + itemsLine 3 line 구조 (각 line null 분기)
   - Enterprise (모두 null) → "좌석·운영량 모두 계약 기반" 보존

5. pricing/page.tsx 히어로 제목 복원:
   - "요금 안내" + "연구 구매 운영 규모에 맞는 플랜을 선택하세요"
   - text-2xl font-bold + text-sm text-text4 (대시보드 페이지 제목 체계)
   - 토글 spacing 정리 (pt-8 → pt-4)
   - 이전 무거운 히어로 (4단계 탭 / 데모 / 칩 / "연구소 조달 운영 OS") 복원 X

Enforce 분석 (sandbox 직접 grep):
   - maxQuotesPerMonth throw enforce 0건 발견 (read-only client 전달만)
   - billing/page.tsx + dashboard/settings/plans/page.tsx 이미 null safe
     ("=== null ? '무제한' : '${quotesLimit}건'" 패턴)
   - api/billing/route.ts + api/organizations/subscription/route.ts 도
     limits 그대로 전달 (null 통과)
   → field null swap 만으로 정합 완료, enforce logic 변경 불필요

Grandfather:
   - 견적/PO 무제한 = "늘려주는" 방향 → 기존 가입자 기능 박탈 0
   - 인원 축소 (b-3) 와 달리 즉시 안전한 변경

Fix (4 file 수정 + 1 NEW test):

- apps/web/src/lib/plans.ts:
  · PlanLimits interface 에 maxPurchaseOrdersPerMonth field 추가
  · FREE.maxQuotesPerMonth 10 → 5 + maxPurchaseOrdersPerMonth 5 신규
  · TEAM.maxQuotesPerMonth 100 → null + maxPurchaseOrdersPerMonth null 신규
  · ORGANIZATION.maxPurchaseOrdersPerMonth null 신규
  · grandfather 결정 대기 comment (b-3)

- apps/web/src/lib/billing/plan-descriptor.ts:
  · team operatingVolume.monthlyRfq/monthlyPo: 30 → null
  · business operatingVolume.monthlyRfq/monthlyPo: 80 → null
  · team features 2 line "월 30건" → "무제한"
  · business features 2 line "월 80건" → "무제한"

- apps/web/src/app/pricing/page.tsx:
  · formatOperatingVolume: 3 line null 분기 (seats / rfqPo / items)
  · 히어로 제목 복원 ("요금 안내" + 부제, 가벼운 스타일)
  · 토글 section spacing 정리 (pt-8 → pt-4)

- apps/web/src/__tests__/regression/plan-unlimited-quotes-po-303b.test.ts
  (NEW, 16 it × 5 nested describe):
  · §11.303b trace marker (self-referential)
  · plans.ts PlanLimits 정합 (interface + 3 tier value + 기존 stale 제거)
  · plan-descriptor operatingVolume null swap (team/business/starter)
  · plan-descriptor features 무제한 swap (team/business + 기존 stale 제거)
  · pricing formatOperatingVolume 무제한 분기 + 3 line 구조
  · 히어로 제목 복원 + 이전 무거운 요소 복원 0

canonical truth 보존 (회귀 0):
- starter(Free) 5/5 표기 유지 (호영님 spec)
- Enterprise null 모두 유지 (계약 기반)
- billing/page.tsx + dashboard/settings/plans/page.tsx 표시 logic 변경 0
  (이미 null safe)
- seatsRecommended 1/3/10/null 유지 (§11.304)
- 4 label / 4 tagline / 4 ctaLabel / 2 recommendTag 변경 0 (§11.304)
- 4 caller file plan map 변경 0 (§11.304)

호영님 production effect:
1. labaxis.co.kr/pricing:
   - 상단 "요금 안내" 제목 + 부제 정리 (휑한 상태 해소)
   - Basic 카드 "견적·발주 무제한" 표기 (이전 "RFQ 30건 / PO 30건")
   - Pro 카드 "견적·발주 무제한" 표기 (이전 "RFQ 80건 / PO 80건")
   - 기능 리스트 "견적 요청 무제한" / "PO 발행 무제한"
   - Free 카드 5건 유지
2. 정책(무제한) 과 화면(30건/80건) 불일치 해소 — 표시광고법 + B2B 계약
   리스크 차단
3. backend enforce 변경 0 (현재 throw 0건) → 기능 영향 0

Out of Scope (별도 sub-batch):
- b-2: labOpsCreditMonthly caller 제거 (dashboard/pricing/page.tsx 가
  stale "LabOps Credit N/월" 표시 중 — 별도 cleanup batch 필요)
- b-3: maxMembers 5→3 / null→10 grandfather 정책
  (production DB 가입자 수 확인 = 호영님 환경 위임 필수)
- b-4: additionalSeatPrice field 신규 (per-seat billing 결제 도입 시 defer)

Rollback path: git revert <SHA>
- 4 file 복원 + sentinel test 삭제
- 정책(30건/80건) 표시 회귀
- 히어로 제목 제거

Lessons:
1. UI literal + backend enforce 동시 deploy = canonical truth 유지.
   호영님 spec 정합.
2. enforce throw 0건 발견 = 현재 limits 가 "표시 전용" 임을 sandbox
   grep 으로 확인 → unnecessary 분기 추가 0.
3. 히어로 제목 복원 = 페이지 정체성 (요금 안내) 가벼운 정리, /intro 와
   역할 분리 유지.
4. Karpathy minimum-diff — 4 file 수정 + 1 NEW test (16 it).
```

## Push

```powershell
git add `
  apps/web/src/lib/plans.ts `
  apps/web/src/lib/billing/plan-descriptor.ts `
  apps/web/src/app/pricing/page.tsx `
  apps/web/src/__tests__/regression/plan-unlimited-quotes-po-303b.test.ts `
  docs/commit-drafts/COMMIT_11.303b-unlimited-quotes-po.md

git commit -F docs/commit-drafts/COMMIT_11.303b-unlimited-quotes-po.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/pricing:
   - 상단 "요금 안내" 제목 + "연구 구매 운영 규모에 맞는 플랜을 선택하세요"
   - Basic 카드: "견적·발주 무제한" + "견적 요청 무제한" / "PO 발행 무제한"
   - Pro 카드: 동일
   - Free 카드: "RFQ 5건 / PO 5건 (월)" + "견적 요청 (월 5건)" / "PO 발행 (월 5건)" 유지
   - Enterprise: "좌석·운영량 모두 계약 기반" 유지
3. labaxis.co.kr/billing + labaxis.co.kr/dashboard/settings/plans:
   - "무제한" 표시 정합 (이미 null safe — 자동 정합)

## 후속 batch

| § | scope | 우선도 |
|---|---|---|
| §11.303b-2 | labOpsCreditMonthly caller 제거 (dashboard/pricing 우선) | 다음 |
| §11.303b-3 | maxMembers grandfather 정책 (가입자 수 확인 gate) | 가입자 수 확인 후 |
| §11.303b-4 | additionalSeatPrice field 신규 (defer 가능) | per-seat billing 결제 도입 시 |
| §11.305-phase4/5 | release-prep P1 (sentinel push 대기) | 호영님 push 후 |
