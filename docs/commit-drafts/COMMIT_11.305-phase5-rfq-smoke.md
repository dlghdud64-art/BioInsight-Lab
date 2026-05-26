# §11.305-phase5 Commit Message Draft (RFQ handoff smoke sentinel — sourcing-d2-d3-wiring 구조 정합)

```
test(rfq): §11.305-phase5 #rfq-handoff-smoke — sourcing-d2-d3-wiring 구조 정합 lock sentinel (release-prep P1 Phase 5, RFQ handoff smoke path 채택 + canonical truth + governance domain lock)

호영님 P1 release-prep Phase 5 (2026-05-25):
RFQ handoff smoke path 로 sourcing-d2-d3-wiring.test.ts 채택. 9 it ×
2 describe 구조가 D-2 (request seed adapter) + D-3 (governance lifecycle
events) 핵심 workflow handoff 의 canonical truth + governance domain
정합을 모두 covering.

Phase 5 evidence (sandbox 직접 분석):

D-2 describe (adaptComparisonHandoffToRequestSeed, 4 it):
  1. synthesize request handoff with one product id matching
  2. recommended vendor first in synthetic vendor list
  3. does NOT mutate canonical comparison handoff (canonical truth 보존)
  4. exclude vendors with null price

D-3 describe (request_submission lifecycle events, 5 it):
  1. emitRequestSubmissionExecuted publishes quote_chain event
  2. emitRequestSubmissionHandedOffToWorkqueue publishes handoff event
  3. invalidation request_submission_executed targets quote_review surface_only
  4. invalidation request_submission_handed_off_to_workqueue uses
     state_transition_check scope
  5. does NOT introduce new GovernanceDomain (contract drift 방지)

smart-sourcing-handoff-engine.ts (production helper, 9 export):
  - 5 sourcing API: buildQuoteComparisonHandoff / selectVendorInHandoff
    / canHandoffToRequestAssembly / executeHandoffToRequest /
    adaptComparisonHandoffToRequestSeed
  - 4 BOM API: buildBomParseHandoff / confirmBomItems /
    canRegisterToQueue / executeRegisterToQueue

Fix (1 file NEW):

- apps/web/src/__tests__/regression/rfq-handoff-smoke-phase5.test.ts
  (NEW, 9 it × 4 nested describe):
  · §11.305-phase5 trace marker (self-referential)
  · sourcing-d2-d3-wiring.test.ts 구조 보존:
    - D-2 describe + 4 핵심 it 보존
    - D-3 describe + 5 핵심 it 보존
    - 5 API import + 2 emit import 보존
  · smart-sourcing-handoff-engine.ts production API 보존:
    - sourcing 5 API export
    - BOM handoff 4 API export
  · canonical truth + governance domain lock:
    - QuoteComparisonHandoff type 사용
    - quote_chain domain lock (새 GovernanceDomain 도입 X)
    - invalidation rule scope (surface_only + state_transition_check)

Execution (호영님 위임 + Vercel CI 자동):
  sandbox vitest 인프라 한계 (Phase 1 partial complete — rollup binary
  미설치 + npm install 권한 제약) 으로 호영님 PowerShell 1회 실행 + Vercel
  CI 자동 실행:

  npm test -- sourcing-d2-d3-wiring.test.ts
  # 9 pass 기대

canonical truth 보존 (회귀 0):
- sourcing-d2-d3-wiring.test.ts 변경 0 (read-only sentinel)
- smart-sourcing-handoff-engine.ts 변경 0
- QuoteComparisonHandoff type 변경 0
- governance-event-bus emit 변경 0
- production code 사용처 (search/page.tsx / dispatch / approval) 변경 0

호영님 production effect:
- 향후 RFQ handoff API (adapt/build/select/execute) 또는 governance event
  emit 함수 수정 시 본 sentinel 이 fail → 호영님 검토 강제
- contract drift (새 GovernanceDomain 도입 / canonical truth mutation)
  자동 감지

Phase 5 closeout:
- Phase 5 = sentinel 추가 + 호영님 1회 실행 위임으로 완료
- Phase 6 (closeout + Batch 10 readiness gate) 진입 준비 완료

Out of Scope (별도 batch):
- Phase 6: release-prep P1 closeout + Batch 10 readiness gate
- §11.303b: backend includedSeats/additionalSeatPrice + per-seat billing
  + grandfather
- §11.305-phase3b/3c: ai test + ai-pipeline test @ts-nocheck (tracker
  #50/#63, release-prep 범위 아님)

Rollback path: git revert <SHA>
- sentinel test 1 file 삭제
- production / smoke test 영향 0
```

## Push

```bash
git add apps/web/src/__tests__/regression/rfq-handoff-smoke-phase5.test.ts \
        docs/commit-drafts/COMMIT_11.305-phase5-rfq-smoke.md

git commit -F docs/commit-drafts/COMMIT_11.305-phase5-rfq-smoke.md
git push origin main
```

## 호영님 환경 1회 smoke 실행 (push 후)

```powershell
# apps/web 디렉토리에서
npm test -- sourcing-d2-d3-wiring.test.ts
# 기대: 9 pass / 0 fail
# fail 시 → 결과 그대로 공유 부탁드립니다 (Phase 5b sandbox 보강)
```

Vercel CI 가 자동 실행하므로 호영님 실행 안 하셔도 build 결과로 확인 가능합니다.

## Production smoke

1. Vercel deployment SUCCESS 확인 (sentinel + 기존 smoke test 자동 pass)
2. labaxis.co.kr workbench → search → quote compare → handoff 흐름 정상
   (이 흐름이 RFQ handoff core path — 사용자 경험 영향 0)

## 후속 batch

| § | scope | 우선도 |
|---|---|---|
| §11.305-phase6 | release-prep P1 closeout + Batch 10 readiness gate | 마지막 |
| §11.303b | backend includedSeats/additionalSeatPrice + per-seat billing + grandfather | UI 후속 |
| §11.305-phase3b/3c | ai test + ai-pipeline test @ts-nocheck (tracker #50/#63) | release-prep 범위 아님 |
