# §11.305-phase3a Commit Message Draft (production code @ts-nocheck 제거 + hidden bug 2건 fix)

```
chore(types): §11.305-phase3a #ts-nocheck-removal — compare/page.tsx @ts-nocheck 제거 + 노출된 hidden type error 7건 simple swap (release-prep P1 Phase 3a, hidden runtime bug 2건 동반 발견)

호영님 P1 release-prep Phase 3a (2026-05-25):
production code @ts-nocheck 잔여 제거 → hidden type error 노출 + 정합.
production code 영향 file: 1 file 만 (compare/page.tsx). types.ts 는
이미 처리됨 (history comment 만 남음, Phase 1 grep false-positive).

Phase 1 grep false-positive 정정: 43 file → 42 file (실제 @ts-nocheck
지시문 존재). production code (test 제외): 1 file 만.

@ts-nocheck 제거 후 tsc 평가 결과 — compare/page.tsx 에 7 hidden type
error 노출 + cascade fix 후 8건 → 모두 simple swap 으로 정합:

1~4. AnalyticsEvent enum 4 literal 누락 (lib/analytics.ts 정합):
   - "compare_export_csv" (line 383)
   - "compare_decision_option_committed" (line 609)
   - "compare_review_enter" (line 1354)
   - "compare_review_handoff" (line 1596)
   → analytics.ts AnalyticsEvent union 에 4 literal 추가 (type-safe enum)

5. DecisionOptionSet element type — null → undefined (line 470):
   - priceKRW / leadTimeDays / specMatchScore 가 number | undefined 기대
   - null → undefined swap (functionally 동일, type union 정합)

6. CompareDecisionContext required field 누락 (line 468):
   - compareMode + selectedDecisionItemId 추가
   - compareMode 는 현 file 정의 0 → empty string 보수
     (별도 batch 에서 sourcing-mode 연결 검토 필요)

🚨 7. Line 878 typo bug — hidden runtime bug:
   - 기존: moveProduct(index, products.length - 1) — number 인자
   - signature: (index, direction: "up" | "down")
   - line 875 "up" 정합으로 의도 추정: "한 칸 아래"
   - 기존 코드는 "마지막으로 jump" semantic (UI 의도와 다름)
   - Fix: moveProduct(index, "down")

🚨 8. Line 1228 setSelectedProductId 미정의 — hidden runtime bug:
   - 기존: setSelectedProductId(null) — setter 정의 0
   - JS 에서 ReferenceError 발생 가능 (rail 안 "비교 제외" 클릭 시
     rail close 안 됨 = no-op)
   - line 1146 패턴 정합 (setActiveCompareItemId)
   - Fix: setActiveCompareItemId(null)

9. AnalyticsEventProperties.note string?: 정합 (line 1601):
   - 기존: note: !!reviewNote — boolean
   - 기대: string | undefined
   - Fix: note: reviewNote || undefined

Fix (3 file 수정 + 1 NEW test):

- apps/web/src/app/_workbench/compare/page.tsx (5 부분):
  · line 1: @ts-nocheck 제거 + §11.305-phase3a trace
  · line 468-485: CompareDecisionContext required field + null→undefined
  · line 878: moveProduct(index, "down") typo fix
  · line 1228: setActiveCompareItemId(null) setter fix
  · line 1601: note string?: 정합

- apps/web/src/lib/analytics.ts (AnalyticsEvent union):
  · 4 string literal 추가 (compare_* trackEvent 정합)
  · §11.305-phase3a trace

- apps/web/src/__tests__/regression/ts-nocheck-removal-phase3a.test.ts
  (NEW, 14 it × 6 nested describe):
  · §11.305-phase3a trace marker (self-referential)
  · compare/page.tsx @ts-nocheck 0 (file 첫 부분)
  · AnalyticsEvent 4 literal 추가 검증
  · DecisionOptionSet null→undefined + CompareDecisionContext required
  · 🚨 hidden bug 2건 fix 검증 (moveProduct "down" / setActiveCompareItemId)
  · note 정합 (boolean → string)
  · canonical truth 보존 (trackEvent / toggleCompare / addProductToQuote
    / state 보존 / moveProduct signature 보존)

canonical truth 보존 (회귀 0):
- trackEvent 호출 위치 변경 0 (literal 만 type-safe)
- toggleCompare / addProductToQuote / clearCompare 호출 보존
- compareSessionId / activeCompareItemId / selectedDecisionItemId state 보존
- moveProduct signature 보존
- selectedProduct derived value 보존
- compareOptionSet useMemo 의존성 selectedDecisionItemId 추가

호영님 production effect:
1. moveProduct "down" 버튼이 실제로 한 칸 아래 이동
   (이전: products.length - 1 = 마지막으로 jump, UI 의도와 다른 동작)
2. rail 안 "비교 제외" 클릭 시 rail close 동작
   (이전: setSelectedProductId ReferenceError → no-op = rail 안 닫힘)
3. 4 trackEvent 호출이 type-safe enum (이전: any cast)
4. compareOptionSet 안전 (compareMode required field 정합)

Baseline 변화:
- tsc baseline: 100 → 100 (다른 file 영향 0)
- compare/page.tsx: 7 → 0 (모두 simple swap 으로 정리)

Out of Scope (별도 batch):
- compareMode = "" 보수 — 실제 sourcing-mode 와 연결 검토 (§11.305-phase3a-b
  후보, 별도 audit 필요)
- Phase 3b: ai test 5 file @ts-nocheck (3a 통과 + Vercel READY 후)
- Phase 3c: ai-pipeline test 36 file @ts-nocheck

Rollback path: git revert <SHA>
- compare/page.tsx + analytics.ts 복원
- sentinel test 삭제
- @ts-nocheck 복원으로 hidden bug 2건 재발 (단, type error 가려짐)

Lessons:
1. @ts-nocheck 제거 = hidden runtime bug 노출 가치 = release-prep P1
   가치 입증. moveProduct typo + setSelectedProductId 미정의 모두
   실제 UI 동작 영향.
2. Phase 1 grep false-positive — comment 안 텍스트가 매칭됨. 정확한
   evidence 수집 = file 첫 부분 검사 가 더 신뢰성 높음.
3. Risk 평가 "High" → 실제로는 모두 simple swap. 7건 분류 (4 enum +
   1 type union + 1 required field + 2 hidden bug + 1 type cast) 으로
   각각 즉시 fix.
4. 호영님 조건 정합 (단독 batch + tsc 먼저 평가 + 단순 swap으로
   안 끝나면 멈춤). 모든 건 simple swap 으로 끝남 → 진행 정합.
5. Karpathy minimum-diff — 3 file 수정 + 1 NEW test (14 it).
```

## Push

```bash
git add apps/web/src/app/_workbench/compare/page.tsx \
        apps/web/src/lib/analytics.ts \
        apps/web/src/__tests__/regression/ts-nocheck-removal-phase3a.test.ts \
        docs/commit-drafts/COMMIT_11.305-phase3a-ts-nocheck.md

git commit -F docs/commit-drafts/COMMIT_11.305-phase3a-ts-nocheck.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/_workbench/compare 정상 렌더:
   - "↓" 버튼 클릭 시 product 한 칸 아래 이동 (이전 bug fix)
   - rail 열린 상태에서 "비교 제외" 클릭 시 rail close (이전 bug fix)
   - 4 trackEvent 호출 정상 (export csv / decision committed / review enter / review handoff)
3. AnalyticsEvent type 추가 4 literal 정합

## 후속 batch (3a 통과 + Vercel READY 후)

| § | scope | 우선도 |
|---|---|---|
| §11.305-phase3b | ai test 5 file @ts-nocheck (governance/acceptance/operational 등) | release-prep P1 |
| §11.305-phase3c | ai-pipeline test 36 file @ts-nocheck (p1~p6 + s0~s6 batch) | release-prep P1 |
| §11.305-phase4 | MutationAuditEvent idempotent migration + 호영님 production push gate | release-prep P1 |
| §11.305-phase5 | RFQ handoff smoke (sourcing-d2-d3-wiring sandbox) | release-prep P1 |
| §11.305-phase6 | closeout + Batch 10 readiness gate | release-prep P1 |
