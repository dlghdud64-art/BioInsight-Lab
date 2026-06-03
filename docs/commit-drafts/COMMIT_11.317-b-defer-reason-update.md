chore(ai-pipeline-tests): §11.317-b #defer-reason-update — 34 files @ts-nocheck 사유 주석 갱신 (tracker #63 통합 defer 명시) (호영님 release-prep deferred, 2026-05-29)

호영님 release-prep deferred §11.317-b — ai-pipeline test @ts-nocheck 잔여 cleanup.

배경:
- 호영님 greedy 측정: 34 files greedy removal → 0/34 clean unlock
- 34 files 전부 진짜 implicit-any 타입 부채 (TS7005/7006/7034)
- "Prisma 타입 미생성 환경 bypass" 옛 사유 무효 (#48 prisma generate 완료 후에도 implicit-any 잔존)
- 주요 implicit-any 변수: adapters / eventId / baselineId / config / savedEnv / mockPrisma / s
- 주석 제거만으로 해결 불가 → individual type annotation 필요
- release-prep deferred scope = cleanup 우선순위, type annotation 작업(10-15h)은 scope 초과
- Option A 선택: 34 files 사유 주석 갱신만, tracker #63 통합 defer 명시

Fix (Option A — sed batch, 34 files 1 line swap):

- apps/web/src/lib/ai-pipeline/runtime/__tests__/ 34 files 사유 주석:
  · 옛: `// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass`
  · 신: `// @ts-nocheck — §11.317-b implicit-any type annotation 필요 (TS7005/7006/7034), tracker #63 통합 defer (호영님 greedy 0/34 측정, 2026-05-29)`

- 34 files list (sed 일괄, s0/s6 제외):
  · memory-repositories / persistence-bootstrap / prisma-repositories / slice-1f-persistence-cutover
  · p1: 2-distributed-lock / 3-recovery-path / closeout-validation / db-contention-validation
  · p2: 1 / 1b / 1c / 2a / 2b / 3 / 4a / 4b / 4c
  · p3: 1 / 2 / 3 / 3b / 4 / 5 / 6
  · p4: 1 / 2 / 3 / 4 / 5
  · p5: 1 / 2 / 3 / 4
  · p6: guardrail-lock

- docs/plans/PLAN_11.317-b-ai-pipeline-ts-nocheck.md:
  · Status: 🔄 In Progress → ✅ Complete
  · Option A 채택 closeout
  · v2 재설계 evidence (호영님 greedy 0/34 측정 + 7개 implicit-any 변수)

canonical 보존 (회귀 0):
- test assertion / 로직 / import 변경 0
- @ts-nocheck 주석 자체는 유지 (사유 line 만 swap)
- s0/s6 (tracker #63 별도 사유) 변경 0
- vitest run 영향 0 (runtime behavior 변화 없음)
- 호영님 로컬 tsc baseline 49 유지 (사유 주석만 변경, 타입 영향 0)

호영님 production effect (Option A):
- functional 변화 0 (test-only, 주석만 변경)
- @ts-nocheck 사유 명확화 → 추후 작업자(claude/cursor)가 진짜 부채임을 즉시 인지
- tracker #63 통합 명시 → release-prep cleanup 의 마지막 부채 컨테이너 단일화

Out of Scope (별도 작업):
- 34 files type annotation 실제 작업 (tracker #63 통합 점진적 정리, Opus 4.8 권장)
- shared type module 추출 (Option B 후보, 호영님 ROI 판단 후 결정)
- §11.317-c lib/ai 5 files 잔여 (tracker #63 카테고리 동일)
- s0/s6 2 files (tracker #63 사유 주석 이미 정확)

검증 (sandbox 정적 grep):
- "§11.317-b implicit-any" 매칭: 34 files ✓
- s0/s6 사유 주석 (tracker #63 ... TS2554/TS2345) 보존: 2 files ✓
- 옛 "Prisma 타입 미생성 환경 bypass" 잔존: 0 ✓
- working tree 변경: 35 files (34 test + PLAN 1)

Rollback path: git revert <SHA>
- 옛 "Prisma 타입 미생성 환경 bypass" 사유 복원 (sed reverse, 34 files)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/lib/ai-pipeline/runtime/__tests__/*.test.ts `
  docs/plans/PLAN_11.317-b-ai-pipeline-ts-nocheck.md `
  docs/commit-drafts/COMMIT_11.317-b-defer-reason-update.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-b-defer-reason-update.md
git push origin main
```

호영님 환경 임시 script 정리 (이미 안내 받음, 별도 수동 실행):
```powershell
Remove-Item C:\Users\young\ai-biocompare\apps\web\phase17b-*.ps1
```

## Production smoke
- N/A (test-only, runtime 변화 0)
- 호영님 로컬 vitest run = 회귀 0 (이미 push 전 측정으로 확인)

## Next (호영님 push 회신 후)

§11.317-b 완전 종결 → 호영님 다음 트랙:
- 호영님 새 spec §11.317 (재고 상세 우측 레일 2차 고도화) → 번호 충돌 매핑 §11.322 진입
- §11.317-c lib/ai 5 files = tracker #63 통합 (별도 batch 불필요, 점진적 정리)
- SMTP 자동발송 §11.314 Phase 2 (호영님 결정)
