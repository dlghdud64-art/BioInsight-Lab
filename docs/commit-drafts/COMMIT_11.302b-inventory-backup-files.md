# §11.302b Commit Message Draft (inventory-content backup file 삭제)

```
chore(cleanup): §11.302b #inventory-backup-files — inventory-content.tsx.full + .full2 dead backup file 삭제 (호영님 권장순서 OK)

배경 (§11.302a 후속):
§11.297 family v6 (재고 batch — InventoryTable + inventory-main +
inventory-content 13 dropdown 모두 plain swap) 진행 중 임시 backup
으로 생성됐던 inventory-content.tsx 의 sibling file 2개 잔존:
  - apps/web/src/app/dashboard/inventory/inventory-content.tsx.full
  - apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2

§11.298f grep audit 에서 이 backup file 들이 dead import (Radix
DropdownMenu) 를 보유한 것이 확인됨. 본 batch (§11.302b) 에서 정리.

사용처 0 검증 (grep audit):
  Active code import 0 — extension .full / .full2 는 TS/Next/webpack
  resolve 대상 아님. 단지 git tracked dead asset.

historical mention (보존):
  docs/decisions/ADR-002-pilot-tenant-seed.md:1810 — historical record
  docs/commit-drafts/COMMIT_11.302a / COMMIT_11.298f — 자체 mention

Fix (2 file rm + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx.full:
  · 파일 삭제 (git rm)

- apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2:
  · 파일 삭제 (git rm)

- apps/web/src/__tests__/regression/inventory-backup-files-302b.test.ts
  (NEW, 5 it):
  · §11.302b trace (self-referential)
  · .full 파일 부재 (existsSync false)
  · .full2 파일 부재 (existsSync false)
  · active production file (inventory-content.tsx) 보존 — 회귀 0
  · ADR-002 historical mention 보존 — 히스토리 기록

canonical truth 보존 (회귀 0):
- active production inventory-content.tsx (§11.297d-f plain swap
  적용된 file) 변경 0
- 호영님 production effect 0 — backup file 은 build/runtime 0 영향
- ADR-002 historical context 보존 — 왜 이 backup 이 있었는지 기록

호영님 production effect:
1. 화면 변경 0 (build 영향 0, .full extension 은 resolve 대상 아님)
2. git tracked file 2 개 감소 — repo clean
3. 다음 grep audit 시 dead Radix import 매치 0 (호영님 검증 환경 정합)
4. §11.298f sentinel test 의 backup file exclusion 의존성 제거 가능
   (다음 batch §11.302c 후보)

Out of Scope (별도 batch):
- §11.302c — §11.298f sentinel test 의 backup file 매치 제거 후
  단순화 (현재 sentinel 은 backup file 존재 가정으로 작성됨)
- 다른 backup/임시 file audit (.bak, .orig, .new 등 grep 후 일괄
  정리) — preemptive cleanup 별도 cluster

Rollback path: git revert <SHA>
- 2 file 복원 + sentinel test 삭제
- git history 에 backup file content 보존 (revert 시 그대로 복귀)

Lessons:
1. backup file (.full / .full2) 은 TS/Next resolve 대상 아니지만
   git tracked → grep audit 에서 false-positive 유발. 임시 backup
   은 batch 종료 시 즉시 정리 필요.
2. §11.297 family 같은 큰 batch 에서 임시 backup 생성 시 commit
   message 에 "임시, 다음 batch 에서 정리" 명시 + cleanup task
   생성 패턴 권장.
3. ADR historical record 보존 — backup file 자체는 삭제하되 왜
   존재했는지 ADR 에 남김 (audit trail).
4. self-referential sentinel — test 자체에 § trace marker 포함하여
   commit draft 부재 시에도 추적 가능.
5. Karpathy minimum-diff — 2 file rm + 1 NEW test (5 it).
```

## Push (호영님 환경)

```bash
# 1. Sandbox 가 작성한 sentinel test stage
git add apps/web/src/__tests__/regression/inventory-backup-files-302b.test.ts \
        docs/commit-drafts/COMMIT_11.302b-inventory-backup-files.md

# 2. 호영님 환경에서 backup file 삭제 (sandbox 0)
git rm apps/web/src/app/dashboard/inventory/inventory-content.tsx.full
git rm apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2

# 3. Commit + push
git commit -F docs/commit-drafts/COMMIT_11.302b-inventory-backup-files.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory Cmd+Shift+R — 화면 변경 0
2. 재고 페이지의 모든 action (row CTA / utility / card / issue
   alert / filter) 정상 작동 확인 (§11.297 family ActionMenu 보존)
3. `ls apps/web/src/app/dashboard/inventory/inventory-content*` →
   `.tsx` 만 (`.full` / `.full2` 부재 확인)
4. `git ls-files | grep "inventory-content.tsx.full"` → 0 매치
