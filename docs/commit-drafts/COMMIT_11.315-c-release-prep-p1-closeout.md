docs(plans): §11.315-c #release-prep-p1-closeout — task #51 종결 + plan 문서 정확 progress 마킹 (호영님 P1, 2026-05-29)

호영님 P1 — 오래 in_progress 상태였던 task #51 ("release-prep P1 잔여 처리 plan
수립 + 승인 대기") 종결 + PLAN_release-prep-p1-cleanup.md 의 실제 phase
진행 현황을 정확히 반영. docs-only commit (source/test 변경 0).

배경:
- #51 task = "plan 수립 + 승인" 자체 (수립/승인 단계는 이미 완료).
- 실제 phase 실행은 #52(Phase1) / #55(Phase2) / #56(Phase3a) / #57(Phase4) /
  #58(Phase5) task 로 분리되어 모두 completed.
- 그러나 Plan 문서 자체는 Status "🔄 In Progress" + Phase 0 만 체크된 상태로
  방치되어 현재 진척과 정합 0.

조사 결과 (정직 보고):
- Phase 0 ✅ Truth Lock + Evidence 3건
- Phase 1 ✅ (task #52) — vitest run + prisma generate baseline
- Phase 2 ✅ (task #55) — enum drift batch (ReceivingStatus/AiActionType/AuditEventType)
- Phase 3 ⏸ partial — 3a 완료(task #56, production 2 file),
  **3b/3c 미완료** (잔존 51건: PROD 3 + TEST 48, ai-pipeline runtime test 중심).
- Phase 4 ✅ (task #57) — MutationAuditEvent idempotent migration + production push gate 통과
- Phase 5 ✅ (task #58) — RFQ handoff smoke sentinel
- Phase 6 ⏸ 미실행 — Batch 10 readiness gate (enforcement rollout 시점 별도 trigger)

Fix (1 file, docs-only):

- docs/plans/PLAN_release-prep-p1-cleanup.md:
  · Status "🔄 In Progress" → "✅ Closed (Partial — Phase 1/2/4/5 Complete · Phase 3 partial · Phase 6 별도 trigger)"
  · Last Updated 2026-05-25 → 2026-05-29 + closeout marker (§11.315-c)
  · Phase 1/2/4/5 헤더 ✅ COMPLETE + task # 참조 추가
  · Phase 3 ⏸ PARTIAL — 3a ✅ / 3b/3c §11.317-b/c 후속 분리 + 잔존 51건 file 명시
  · Phase 6 ⏸ — Batch 10 enforcement trigger 시점 별도 실행 명시
  · §11 Progress Tracking: 14% → 71% / Current "Phase 1" → "✅ Closed (2026-05-29)"
  · §12 Notes & Learnings: Blockers (3b/3c 특수 영역 risk) + Implementation Notes +
    **Closeout Summary** + 잔여 후속 batch 권장 (§11.317-b/c, §11.318 Phase 6)

회귀 0 (보존):
- source/test 변경 0 (docs 만)
- 기존 phase 별 작업물(#52~#58)의 commit 손대지 않음
- Batch 10 enforcement 의사결정/시점은 본 closeout 영향 0

호영님 production effect:
- 없음 (docs 만)
- task list 정합성↑ — #51 in_progress → completed 로 종결 가능
- 후속 batch 트리거 명확화: §11.317-b/c (3b/3c @ts-nocheck), §11.318 (Phase 6 readiness)

Out of Scope (⚠️ 본 batch 미포함):
- 3b/3c @ts-nocheck 실제 제거 (별도 §11.317 cluster)
- Batch 10 readiness gate 실제 실행 (별도 §11.318)
- 다른 plan 문서 정합 검사 (PLAN_11.306 등은 본 closeout 영향 0)

⚠️ 호영님 task list 운영 안내:
- 본 commit push 후 #51 task 를 "completed" 로 수동 토글하시면 됩니다.
- in_progress 상태 task 가 #51 만 있었으므로 task list 모두 completed 상태로 정합.

검증 (sandbox 정적):
- PLAN_release-prep-p1-cleanup.md Status + Phase 1~6 + Progress + Notes 정합 확인
- 다른 file 변경 0 (`git diff --stat` docs/plans/ 1 file 만)

Rollback path: git revert <SHA>
- plan 문서 원상 복구 (Phase 진행 현황은 이미 #52~#58 commit 에 분산되어 있어 revert 영향 0)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_release-prep-p1-cleanup.md `
  docs/commit-drafts/COMMIT_11.315-c-release-prep-p1-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.315-c-release-prep-p1-closeout.md
git push origin main
```

## Production smoke
- 해당 없음 (docs-only). Vercel 빌드 통과만 확인.
