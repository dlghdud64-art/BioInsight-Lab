# §11.302a Commit Message Draft (dropdown-menu.tsx + @radix-ui package 제거)

```
chore(deps): §11.302a #dropdown-menu-dead-file — components/ui/dropdown-menu.tsx + @radix-ui/react-dropdown-menu package 제거 (application-wide grep 0 후속)

배경 (§11.298f 후속):
§11.298e application-wide Radix wiring 0 완성 → §11.298f silent fail
회복 + _workbench/search/page.tsx dead import cleanup. 이 위에서
dead file (components/ui/dropdown-menu.tsx) + dead package
(@radix-ui/react-dropdown-menu) 자체 정리.

사용처 0 검증 (grep audit):
  apps/web/src/components/ui/dropdown-menu.tsx:4
    → 자기 자신만 @radix-ui import (self-reference dead)
  apps/web/src/__tests__/regression/data-table-view-options-plain-298e.test.ts:60
    → sentinel test 의 grep pattern string (사용 아님)
  apps/web/src/app/dashboard/inventory/inventory-content.tsx.full[2]
    → backup file 의 dead import (§11.302b 별도 batch — 호영님 OK 필요)

Active code 사용처 = 0. 안전한 dead file/package 정리.

Fix (1 file Edit + 1 file rm + 1 NEW test + lock 자동 정리):

- apps/web/package.json:
  · "@radix-ui/react-dropdown-menu": "^2.1.0" entry 제거 (line 41)

- apps/web/src/components/ui/dropdown-menu.tsx:
  · 파일 자체 삭제 (git rm)
  · sandbox 자동 삭제 0 — 호영님 환경 git rm 후 land

- apps/web/package-lock.json:
  · npm install 시 자동 정리 (호영님 환경)

- apps/web/src/__tests__/regression/dropdown-menu-dead-file-302a.test.ts
  (NEW, 5 it):
  · §11.302a trace (self-referential sentinel)
  · components/ui/dropdown-menu.tsx 파일 부재 (existsSync false)
  · package.json @radix-ui/react-dropdown-menu entry 부재
  · application-wide @/components/ui/dropdown-menu import 0
    (silent fail 제거 — try/catch exit code 1 만 success)
  · application-wide @radix-ui/react-dropdown-menu import 0

canonical truth 보존 (회귀 0):
- application-wide 사용처 0 — §11.298f sentinel 으로 이미 검증
- bundle size 감소 — Radix DropdownMenu 전체 module 제거
- 호영님 production effect 0 — UI 변경 0 (이미 모든 dropdown 이
  plain button 또는 ActionMenu shared 으로 swap 완료)
- 다른 Radix package (react-dialog / react-popover / react-select /
  react-toast 등 14 package) 모두 보존

호영님 production effect:
1. 화면 변경 0 (이미 plain swap 으로 정상 작동 중)
2. next build bundle size 감소 — Radix DropdownMenu module 제거 +
   transitive deps (react-popper 등) cleanup
3. dependency tree 축소 — npm audit / security scan 표면 감소

§11.302a 후속 (별도 batch):
- §11.302b backup file 삭제:
  · apps/web/src/app/dashboard/inventory/inventory-content.tsx.full
  · apps/web/src/app/dashboard/inventory/inventory-content.tsx.full2
  · 사용처 0 (ADR-002 단일 언급만)
  · 호영님 명시적 OK 필요 — sandbox 자동 삭제 금지

Out of Scope:
- monorepo root package-lock.json 의 @radix-ui/react-dropdown-menu
  entry (line 81) — workspace npm install 시 자동 정리
- 다른 Radix package latest upgrade audit (별도 cluster §11.281
  candidate)

Rollback path: git revert <SHA>
- package.json entry 복원 + dropdown-menu.tsx 파일 복원
- npm install → package-lock.json 재생성
- sentinel test 삭제

Lessons:
1. dead file/package 정리는 grep audit 후 호영님 환경 git rm.
   sandbox 파일 삭제 = prohibited action (CLAUDE.md).
2. self-referential sentinel — test 자체에 trace marker 포함하여
   commit draft 부재 시에도 § version 추적 가능.
3. backup file (.full / .full2) 은 별도 batch — 호영님 명시적 OK
   받고 한 번에 정리 (preemptive sandbox 삭제 금지).
4. Karpathy minimum-diff — 1 file Edit (1 line) + 1 file rm +
   1 NEW test (5 it) + lock 자동 정리.
```

## Push (호영님 환경)

```bash
# 1. Sandbox 가 작성한 변경 stage
git add apps/web/package.json \
        apps/web/src/__tests__/regression/dropdown-menu-dead-file-302a.test.ts \
        docs/commit-drafts/COMMIT_11.302a-dropdown-menu-dead-file.md

# 2. 호영님 환경에서 dead file 삭제 (sandbox 0)
git rm apps/web/src/components/ui/dropdown-menu.tsx

# 3. package-lock.json 자동 정리
npm install

# 4. lock 변경 stage + commit
git add apps/web/package-lock.json
git commit -F docs/commit-drafts/COMMIT_11.302a-dropdown-menu-dead-file.md
git push origin main
```

## Production smoke

1. labaxis.co.kr Cmd+Shift+R — 화면 변경 0 (이미 plain swap 완료)
2. next build output bundle size 비교 — Radix DropdownMenu module
   제거 효과 확인
3. 모든 dropdown surface 정상 작동 확인:
   - 소싱 햄버거 (§11.283b plain)
   - Header 도움말/프로필/알림 (§11.295/296 plain)
   - 재고 row actions (§11.297 family ActionMenu)
   - 단일 dropdown 11 file (§11.298 family plain)
   - data-table view options (§11.298e plain checkbox)
4. npm ls @radix-ui/react-dropdown-menu → "(empty)" 확인
