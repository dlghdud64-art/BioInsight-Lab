refactor(dashboard): §11.308d-2 #quote-dispatch-summary-entry — 견적 발송 카드 가짜 발송 플로우 → 요약+워크벤치 진입 재설계 (호영님 P2 옵션 A, 2026-05-28)

호영님 P2 (§11.308d 후속 보류분) — 대시보드 빠른 액션 "견적 발송" 카드의
progressive disclosure 재정제.

근본 문제 (canonical truth 위반):
- 기존 펼친 카드는 in-card 에서 발송 플로우(공급사 선택→연락처→미리보기→전송)를
  시뮬레이션했으나, caller(dashboard/page.tsx)는 quoteDispatchReadiness 를
  전달하지 않음 → contactValid/previewReady 항상 false →
  "공급사에 전송" CTA 가 **사실상 영구 비활성(near-dead button)**.
- QUOTE_DISPATCH_STATE_MATRIX(공급사없음/연락처없음/정상입력 3행)는 실제 상태와
  무관한 **정적 spec 문서표(dev surface)**.
- "발송 후 새로고침에도 dispatch 이벤트 추적" 같은 **QA 메모형 문구** 노출.
- 대시보드 카드는 집계 count 만 보유 — 개별 견적의 발송 준비 상태를 알 수 없고,
  실제 발송 truth 는 견적 워크벤치(/dashboard/quotes)가 소유. 카드가 다른
  surface 의 발송 UI 를 흉내 → LabAxis 원칙(dead button 금지, truth 흉내 금지) 위반.

Fix (옵션 A — 요약 + 워크벤치 진입):

- apps/web/src/components/dashboard/operator-quick-actions.tsx:
  · 펼친 상태 재설계 → 발송 대기 요약 1줄 + 단일 "견적 워크벤치 열기" CTA
    (href=/dashboard/quotes?labaxisPilot=quote-dispatch, 항상 활성) + 접기.
  · count 0 시 정직한 empty("발송 대기 중인 견적이 없습니다") 표시.
  · 제거: QUOTE_DISPATCH_STEPS, QUOTE_DISPATCH_STATE_MATRIX,
    OperatorQuickActionsQuoteDispatchReadiness 타입/prop, canSendToSupplier/
    sendBlockReason 로직, 영구 비활 Send(aria-disabled/opacity), state-matrix,
    preview-tracking, contact-warning, step grid, QA 문구.
  · 보존: 4 카드 구조 + countKey + href + 진입 카드 amber 0(§11.308d) +
    progressive disclosure(isQuoteDispatchExpanded) + grid/min-h + TONE_MAP.
  · canonical truth: 카드 = count display-only, 발송 truth = 워크벤치 소유.

- 테스트 정합 (TDD — 구조 변경 반영):
  · __tests__/regression/operator-quick-actions-amber-removed-308d.test.ts:
    사라진 요소(dispatch step/alert-box yellow, state-matrix/preview-tracking/
    stage testid) 단언 제거 + 새 구조 가드(summary + primary-cta 존재,
    가짜 플로우 testid not.toMatch). amber/orange 0 + 4카드 + href + TONE_MAP 유지.
  · __tests__/dashboard/dashboard-quote-dispatch-card-evidence.test.ts:
    전면 재작성 — 요약 블록 + 워크벤치 진입 CTA + 항상 활성 CTA +
    in-card 발송 시뮬레이션 제거(canonical truth 가드) + 접기 보존.
  · __tests__/components/dashboard/operator-quick-actions-responsive.test.ts:
    quoteDispatchReadiness prop 보존 단언 → prop 제거 가드, 공급사 전송 button
    단언 → 워크벤치 진입 CTA 단언.

회귀 0 (보존):
- 4 카드(견적등록/발주전환/입고처리/재고점검) + count 뱃지 + 반응형 grid + min-h
- 진입 카드 신호등 색(§11.308d yellow) + 진입 카드 dead button 0
- order-dispatch-readiness.test.ts 의 canSendToSupplier 는 별개 lib(orders) 필드 — 무관(무변경)
- vendor-dispatch-workbench "공급사에 전송" aria-label — 다른 component(무관)

호영님 production effect:
1. 대시보드 견적 발송 카드: 영구 비활 "전송" 버튼·정적 spec표·QA문구 사라짐.
2. 펼치면 발송 대기 N건 요약 + "견적 워크벤치 열기" 1버튼 → 실제 발송 동선으로 직행.
3. dead button 0 / truth 흉내 0 (발송은 워크벤치가 책임).

Out of Scope (⚠️ 본 batch 미포함):
- 워크벤치(/dashboard/quotes) 발송 UX 자체 (별도)
- quote-dispatch-fixed-flow-264h5.test.ts obsolete 블록(primaryDispatchBadges) 정리 — §11.302d-6e 에서 기보고, 별도

검증 (sandbox, vitest 미설치 → 정적):
- 컴포넌트 제거 식별자 0 / 새 testid(summary, primary-cta) 존재 / amber·orange 0 / import 정상 / JSX 균형
- 제거 항목 참조 test 전수 grep → operator-quick-actions 관련 3 file 모두 정합 완료

Rollback path: git revert <SHA>
- 기존 in-card 발송 플로우 카드 복원 + 3 test 단언 복원

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/dashboard/operator-quick-actions.tsx `
  apps/web/src/__tests__/regression/operator-quick-actions-amber-removed-308d.test.ts `
  apps/web/src/__tests__/dashboard/dashboard-quote-dispatch-card-evidence.test.ts `
  apps/web/src/__tests__/components/dashboard/operator-quick-actions-responsive.test.ts `
  docs/commit-drafts/COMMIT_11.308d-2-quote-dispatch-summary-entry.md
git status
git commit -F docs/commit-drafts/COMMIT_11.308d-2-quote-dispatch-summary-entry.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. 대시보드 → "운영 바로가기" → 견적 발송 카드 클릭(펼침)
3. 펼친 상태: "발송 대기 N건 …" 요약 + "견적 워크벤치 열기" 버튼만 (정적 표/비활 Send 없음)
4. "견적 워크벤치 열기" → /dashboard/quotes 이동 확인
5. 발송 대기 0건 시 "발송 대기 중인 견적이 없습니다" 표시 확인
