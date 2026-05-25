# §11.304 Commit Message Draft (플랜 티어명 등급화 + /pricing 히어로 제거 + 인원 구간 정합)

```
feat(pricing): §11.304 #plan-tier-naming — 티어명 Free/Basic/Pro/Enterprise 등급화 + /pricing 히어로 제거 + 인원 구간 5→3 / 15→10 정합 + 추가 1명당 단가 표기 (호영님 P1, 결제 직전 전환 직결)

호영님 P1 spec (2026-05-25):
기존 티어명 (Lab Team / R&D Operations) 은 "누가 쓰는가" 를 규정 →
"우리는 팀이 아닌데?" / "우리는 R&D가 아닌데?" 정체성 의문 → 결제
직전 이탈 요인. 글로벌 표준 위계 (Free < Basic < Pro < Enterprise)
으로 swap. 부제 권장형 ("N명 규모에 적합") 으로 사용자 유형 규정 제거.
대기업/스타트업/QC팀/R&D팀이든 자기 규모만 보고 선택 가능.

추가 spec (인원 구간 + 추가 과금):
- Basic 기본 5명 → 3명 (1→5 점프 완화, 2~3명 소규모 랩 진입 문턱 낮춤)
- Pro 기본 15명 → 10명 (Quartzy Pro 동등 인당 단가)
- Basic 추가 1명당 ₩35,000/월 (기본 ₩43,000 대비 저렴 → 확장 장려)
- Pro 추가 1명당 ₩28,000/월 (기본 ₩34,900 대비 저렴)
- 연간 할인율 10% 유지 (호영님 confirm)

/pricing 히어로 섹션 제거 배경:
/intro 페이지가 이미 충실한 랜딩 (히어로 + 제품 구조 + 역할별 변화 +
데이터 시각화 + CTA) → /pricing 상단 히어로는 역할 중복. 가격 보러
온 사용자에게 방해. 제품 설명은 상단 메뉴 "서비스 소개" (/intro) 으로
유도, /pricing 진입 시 plan cards 즉시 노출.

Fix (7 file 수정 + 1 NEW test):

- apps/web/src/lib/billing/plan-descriptor.ts (4 tier 등급화):
  · starter: label "Starter"→"Free" + tagline "1인 연구실..."→"도입 검토
    · 1인 사용에 적합" + ctaLabel "무료 파일럿 시작"→"무료로 시작"
  · team: label "Lab Team"→"Basic" + tagline "단일 연구실..."→"소규모
    운영 · 3명 규모에 적합" + seatsRecommended 5→3 + features "운영자
    5명 포함 (추가 ₩25,000/인)"→"운영자 3명 포함 (추가 1명당 ₩35,000/월)"
    + features 선두 "Starter 전체 +"→"Free 전체 +" + ctaLabel "Lab Team
    시작하기"→"Basic 시작하기" + recommendTag "추천: 단일 연구실 운영"→
    "가장 많이 선택"
  · business: label "R&D Operations"→"Pro" + tagline "R&D 센터..."→"다중
    운영 · 통제 기능 · 10명 규모에 적합" + seatsRecommended 15→10 +
    features "운영자 15명 포함 (추가 ₩20,000/인)"→"운영자 10명 포함
    (추가 1명당 ₩28,000/월)" + features 선두 "Lab Team 전체 +"→"Basic
    전체 +" + ctaLabel "R&D Operations 시작하기"→"Pro 시작하기" +
    recommendTag "추천: R&D 센터 운영"→"성장 단계 추천"
  · enterprise: tagline "기관 / 법인 — 승인 정책..."→"기관 · 계약형
    운영 · 좌석/운영량 협의" + features 선두 "R&D Operations 전체 +"→
    "Pro 전체 +"

- apps/web/src/app/pricing/page.tsx:
  · 히어로 섹션 제거 (line 187-219, ~32 line):
    - H1 "연구소 조달 운영 OS" 제거
    - 부제 "검색부터 승인까지..." 제거
    - 4단계 탭 (검색/비교/요청/승인) 제거
    - 상단 CTA "R&D Operations 시작하기" + "데모 보기" 제거
    - decision-status 칩 3개 제거
  · 월간/연간 토글 plan cards 직전 별도 section 으로 이동 +
    aria-label 추가
  · 비교 표 헤더 (line ~300): "Starter"→"Free" / "Lab Team"→"Basic"
    / "R&D Operations"→"Pro" 정합
  · featured 판정 regex /단일\s*연구실/→/가장\s*많이\s*선택/ 정합

- apps/web/src/lib/plans.ts:
  · PLAN_DISPLAY: FREE.displayName "Starter"→"Free" / TEAM "Team"→
    "Basic" / ORGANIZATION "Business"→"Pro" + tagline 권장형 swap +
    description 정합
  · getPlanDisplayName fallback "Starter"→"Free"
  · ENTERPRISE_INFO.tagline "기관 / 법인 — 계약 기반..."→"기관 · 계약형
    운영 · 좌석/운영량 협의" (plan-descriptor 정합)
  · ENTERPRISE_INFO.features 선두 "R&D Operations 전체 +"→"Pro 전체 +"

- apps/web/src/app/billing/page.tsx:
  · PLAN_LABELS: Starter→Free / Team→Basic / Business→Pro

- apps/web/src/app/dashboard/page.tsx:
  · PLAN_INTENT_LABELS: Starter→Free / Team→Basic / Business→Pro

- apps/web/src/app/dashboard/settings/plans/page.tsx:
  · PLAN_INTENT_LABELS: Starter→Free / Team→Basic / Business→Pro

- apps/web/src/app/dashboard/organizations/page.tsx:
  · PLAN_MAP: FREE→Free / TEAM→Basic / ORGANIZATION→Pro

- apps/web/src/app/dashboard/organizations/[id]/page.tsx:
  · planLabel ternary: "Starter"→"Free" (Pro/Basic 은 §11.303-hotfix-e
    호영님 직접 swap 시 이미 적용됨, Free 만 정합)

- apps/web/src/__tests__/regression/plan-tier-naming-304.test.ts
  (NEW, ~50 it × 8 nested describe):
  · §11.304 trace marker (self-referential)
  · plan-descriptor.ts 4 label / 4 tagline / seatsRecommended 3/10 /
    features 추가 단가 표기 / 4 ctaLabel / 2 recommendTag 정합
  · pricing/page.tsx 히어로 제거 (H1/부제/4단계 탭/상단 CTA/칩) +
    토글 보존 + featured regex + 비교 표 헤더 4 티어 정합
  · lib/plans.ts PLAN_DISPLAY + getPlanDisplayName fallback +
    ENTERPRISE_INFO.features 정합
  · 4 caller file PLAN_LABELS / PLAN_INTENT_LABELS / PLAN_MAP 정합
  · organizations/[id]/page.tsx planLabel ternary 정합

canonical truth 보존 (회귀 0):
- PLAN_DESCRIPTOR single source 위계 유지 (caller 가 descriptor.label
  참조)
- ENTERPRISE_INFO.tagline = PLAN_DESCRIPTOR.enterprise.tagline 정합
  (§11.303d audit 후 통합)
- 가격 (priceMonthlyKrw) / operatingVolume / labOpsCreditMonthly 변경 0
- approvalPolicy / ctaRoute / intent 변경 0
- 월간/연간 토글 + 10% 할인 보존
- featured 카드 dark navy 톤 보존 (regex 만 정합)
- plan cards 4 grid 구조 보존
- 비교 표 7 row 구조 보존

Backend out of scope (§11.303b 또는 별도):
- includedSeats backend field 5→3, 15→10 (Stripe metadata)
- additionalSeatPrice field 신규 (₩35,000 / ₩28,000)
- per-seat billing logic (Stripe quantity 기반 과금)
- maxQuotesPerMonth = null + UI "무제한" 표기 동시 land
- 기존 가입자 grandfather 정책 (5명 Basic → 3명 축소 시 보호)

호영님 production effect:
1. /pricing 진입 시 plan cards 즉시 노출 (히어로 제거)
2. 티어명 등급화로 결제 직전 정체성 의문 차단 (전환 직결)
3. 인원 구간 1→3→10 점프 자연스러움 (2~3명 소규모 랩 진입 문턱 낮춤)
4. 추가 1명당 단가 명시로 확장 시 cost 예측 가능 (NRR 정합)
5. 4 caller file (billing / dashboard / settings/plans / organizations)
   plan badge 등급명 동기화

Rollback path: git revert <SHA>
- 7 file 복원 (descriptor + pricing + plans + 4 caller)
- sentinel test 삭제
- 기존 티어명 + 히어로 + 5/15 seats 회귀

Lessons:
1. 티어명 = 등급 (사용자 유형 규정 X) — 글로벌 표준 위계 정합 →
   결제 직전 정체성 의문 차단.
2. 인원 구간 점프 완화 (1→3→10) — 진입층 (2~3명 랩) 이탈 차단.
3. 추가 단가는 기본 인당 단가보다 저렴 → 확장 장려, 건강한 NRR.
4. 페이지 역할 분리 (/intro = 제품 설명, /pricing = 가격만) — 중복
   제거로 사용자 의사결정 가속.
5. PLAN_DESCRIPTOR canonical + caller 4 file 정합 동시 land — drift
   재발 차단.
6. backend 분리 = §11.303b — UI literal 이 backend enforce 보다 먼저
   변경되면 표시광고법 위험. backend land 후 UI 만 변경 권장.
   (단, 이번 batch 는 UI 만 = 단가 표기만 변경, 실제 billing 로직 영향 0)
7. ENTERPRISE_INFO 가 PLAN_DESCRIPTOR 외 stale source 패턴 →
   §11.303d 후속 정합 보강.
```

## Push

```bash
git add apps/web/src/lib/billing/plan-descriptor.ts \
        apps/web/src/lib/plans.ts \
        apps/web/src/app/pricing/page.tsx \
        apps/web/src/app/billing/page.tsx \
        apps/web/src/app/dashboard/page.tsx \
        apps/web/src/app/dashboard/settings/plans/page.tsx \
        apps/web/src/app/dashboard/organizations/page.tsx \
        apps/web/src/app/dashboard/organizations/\[id\]/page.tsx \
        apps/web/src/__tests__/regression/plan-tier-naming-304.test.ts \
        docs/commit-drafts/COMMIT_11.304-plan-tier-naming.md

git commit -F docs/commit-drafts/COMMIT_11.304-plan-tier-naming.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인 (§11.303-hotfix-f READY 이후 첫 batch)
2. labaxis.co.kr/pricing 정상 렌더:
   - 히어로 없이 월간/연간 토글 + plan cards 즉시 노출
   - 4 카드 label: Free / Basic (featured) / Pro / Enterprise
   - Basic 카드: "운영자 3명 포함 (추가 1명당 ₩35,000/월)"
   - Pro 카드: "운영자 10명 포함 (추가 1명당 ₩28,000/월)"
   - 추천 배지: Basic "가장 많이 선택" / Pro "성장 단계 추천"
   - 비교 표 헤더: Free / Basic / Pro / Enterprise
3. labaxis.co.kr/dashboard plan badge 정합 (Free/Basic/Pro)
4. labaxis.co.kr/dashboard/settings/plans 정합
5. labaxis.co.kr/dashboard/organizations PLAN_MAP 정합
6. labaxis.co.kr/billing PLAN_LABELS 정합

## 후속 batch

| § | scope | 우선도 |
|---|---|---|
| §11.303b | backend includedSeats 5→3/15→10 + additionalSeatPrice 신규 + per-seat billing logic + maxQuotesPerMonth null | P1 (UI batch 이후 backend 정합) |
| §11.304b | 기존 가입자 grandfather 정책 (5명 Basic → 3명 축소 시 보호) | P1 (backend 동반) |
| release-prep P1 잔여 | Phase 2 enum drift (PLAN_release-prep-p1-cleanup.md) | P1 |
| Batch 10 soft_enforce | enforcement mode rollout | release-prep P1 완료 후 |
