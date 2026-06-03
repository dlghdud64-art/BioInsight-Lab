test(regression): §11.302d-6e #stale-sentinels-reconcile — amber/orange sweep 후속 옛 sentinel positive assertion 정정 (호영님 P2, 2026-05-28)

§11.302d-6a~6d3 (이미 push) amber/orange → 신호등 sweep 으로 source 색이
yellow/red/sky 로 바뀌었으나, sweep 이전에 작성된 옛 sentinel 들이 아직
amber/orange Tailwind class 를 **positive assert** 하여 vitest 실행 시 stale
fail 상태였음. source 색 자체는 정상 — 테스트만 옛 색을 단언.

영향 범위 (정정 전):
- Vercel 빌드(next build) 영향 0 (vitest 는 빌드 파이프라인 밖)
- vitest sentinel 묶음 실행 시에만 stale fail
- positive amber/orange Tailwind class 단언 → 정정 후 0

원칙:
- positive assertion 만 현재 source 색으로 정정 (테스트가 reality 를 따라감)
- .not.toMatch(/amber|orange/) 회귀 sentinel 은 보존 (정상)
- "amber" 키 / tone 의미값(tone:"amber", === "amber") / 타입 union /
  it 설명 라벨의 tone 명칭은 보존 (Tailwind class 아님)

Fix (12 test file):

- api/admin/operational-brief-floating-multi-surface.test.ts:
  · border-l-amber-500 → border-l-yellow-500 (popup.tsx CATEGORY_TONE_BORDER.amber)

- components/operational-brief/popup-card-priority-hierarchy-d4.test.ts:
  · border-l-amber-400 → border-l-yellow-400

- components/operational-brief/popup-category-color-and-urgent-badge-e1-e2.test.ts:
  · border-l-amber-500|border-amber-500 → yellow, text-amber-600 → text-yellow-600
  · tone:"amber" 키 단언은 보존 (source tone 키 amber 유지)

- dashboard/dashboard-quote-dispatch-card-evidence.test.ts:
  · 경고박스 border-amber-200/bg-amber-50/text-amber-800 →
    border-yellow-200/bg-yellow-100/text-yellow-800 (operator-quick-actions L302)
  · it 라벨 "amber contact warning" → "yellow"

- dashboard/inventory-mobile-badge-contrast-273d.test.ts:
  · 검토/임박 badge bg-amber-500 text-slate-900 → bg-yellow-100 text-yellow-700
  · 폐기 badge bg-orange-600 text-white → bg-red-600 text-white (위험 격상)
  · border-l 검토/임박 amber-500 → yellow-500, 폐기 orange-500 → red-500
  · it 라벨 색상 명칭 동기화

- dashboard/quotes/quote-table-readability.test.ts:
  · OP_STATUS bg-amber-(50|100) → bg-yellow-(50|100) (회신_대기)
  · dot bg-(amber|...)-500 → bg-(yellow|...)-500
  · priorityLevel high border-l amber-(400|500) → yellow-(400|500) (border-l-4 border-yellow-400)
  · describe/it 라벨 "높음 amber" → "높음 yellow"

- dashboard/quotes/quote-table-v2-phase-b.test.ts:
  · stage 색 bg-amber-500|bg-amber-400 → bg-yellow-500|bg-yellow-400

- dashboard/sourcing-mobile-search-258a.test.ts:
  · chip color text-(green|blue|amber)- → text-(green|blue|amber|yellow)- (alternation 보강)

- dashboard/system-insight-compact-252d3.test.ts:
  · gradient from-amber-700 to-amber-900 → from-yellow-700 to-yellow-900
    (executive-summary gradientMap.amber 값)

- dashboard/vendor-dispatch-workbench-aria-label-274.test.ts:
  · 발송 버튼 bg-amber-500 hover:bg-amber-600 → bg-yellow-500 hover:bg-yellow-600

- regression/budget-category-amber-removed-302d6a2.test.ts:
  · soft_limit STATUS_CONFIG orange 보존 단언 → red 격상 단언으로 교체
    (source 이미 bg-red-50/text-red-700/bg-red-500/border-red-200 — 호영님 옵션 A)
  · 주석 단언 "별도 의미 분석 필요" → "red 격상" + orange 0 회귀 가드 추가

회귀 0 (보존):
- .not.toMatch(/amber/) 회귀 sentinel 손대지 않음
- 6a~6d3 신규 sentinel(yellow/red/sky 단언)은 정상 — 무변경
- 각 정정 assertion 은 현재 source 의 실제 색과 1:1 검증 완료

⚠️ obsolete 테스트 1건 (6e 범위 밖, 별도 정리 권장):
- dashboard/quotes/quote-dispatch-fixed-flow-264h5.test.ts 의
  "shows supplier, contact, and preview badges" it 블록은 제거된 feature
  (primaryDispatchBadges + emerald 배지)를 참조 → amber 와 무관하게 이미
  obsolete fail. 본 batch 는 amber→yellow 토큰만 정리하고 주석으로 명시.
  → feature 정리 여부는 호영님 판단 (테스트 블록 제거 or 재작성).

검증 (sandbox, vitest 미설치 → 정적 분석):
- positive amber/orange Tailwind class 단언: 정정 전 ~22 → 정정 후 0
- 각 정정 문자열이 현재 source 에 실제 존재함을 grep 확인
- 잔여 amber/orange 문자열 = 키/tone 의미값/it 라벨 (Tailwind class 아님, 보존)

Rollback path: git revert <SHA>
- 옛 amber/orange 단언 복원 (단, source 와 불일치하여 다시 stale fail)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/__tests__/api/admin/operational-brief-floating-multi-surface.test.ts `
  apps/web/src/__tests__/components/operational-brief/popup-card-priority-hierarchy-d4.test.ts `
  apps/web/src/__tests__/components/operational-brief/popup-category-color-and-urgent-badge-e1-e2.test.ts `
  apps/web/src/__tests__/dashboard/dashboard-quote-dispatch-card-evidence.test.ts `
  apps/web/src/__tests__/dashboard/inventory-mobile-badge-contrast-273d.test.ts `
  apps/web/src/__tests__/dashboard/quotes/quote-dispatch-fixed-flow-264h5.test.ts `
  apps/web/src/__tests__/dashboard/quotes/quote-table-readability.test.ts `
  apps/web/src/__tests__/dashboard/quotes/quote-table-v2-phase-b.test.ts `
  apps/web/src/__tests__/dashboard/sourcing-mobile-search-258a.test.ts `
  apps/web/src/__tests__/dashboard/system-insight-compact-252d3.test.ts `
  apps/web/src/__tests__/dashboard/vendor-dispatch-workbench-aria-label-274.test.ts `
  apps/web/src/__tests__/regression/budget-category-amber-removed-302d6a2.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6e-stale-sentinels.md
git status
git commit -F docs/commit-drafts/COMMIT_11.302d-6e-stale-sentinels.md
git push origin main
```

## 검증 (호영님 환경, vitest 1회 권장)

```powershell
cd C:\Users\young\ai-biocompare\apps\web
npx vitest run src/__tests__/regression src/__tests__/dashboard src/__tests__/components/operational-brief src/__tests__/api/admin
```
- 정정 12 file green 회복 확인
- 264h5 "primaryDispatchBadges" 블록은 여전히 fail 예상 (obsolete, 별도 정리)
