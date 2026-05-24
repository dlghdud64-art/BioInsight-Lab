# §11.298f Commit Message Draft (application-wide Radix wiring 0 회복)

```
fix(workbench): §11.298f #workbench-search-radix-cleanup — _workbench/search/page.tsx Radix DropdownMenu dead import 제거 + §11.298e sentinel silent fail 회복

배경 — §11.298e 부채:
§11.298e sentinel test 가 "application-wide Radix DropdownMenu wiring
0 완성" 으로 통과했지만, 실제로는 _workbench/search/page.tsx 의
Radix import 가 잔존. 햄버거 메뉴 자체는 §11.283b 에서 이미 plain
button + useState 으로 swap 되었으나 dead import 만 ~10 line 남음.

§11.298e sentinel 의 silent fail 패턴:
  `grep ... || true` — grep exit code 1 (no match) 와 동일하게
  매치가 있어도 silent 처리. application-wide grep 0 약속 위반.

Fix (1 file ~10 line + 1 NEW test):

- apps/web/src/app/_workbench/search/page.tsx:
  · line 12-21 (~10 line) — Radix DropdownMenu import 6 symbol +
    §11.254b 햄버거 도입 주석 (stale) 제거
    - DropdownMenu / DropdownMenuTrigger / DropdownMenuContent /
      DropdownMenuItem / DropdownMenuLabel / DropdownMenuSeparator
    - "@/components/ui/dropdown-menu" import 자체 제거
  · 새 trace 주석 2 line 으로 swap — §11.283b plain swap + §11.298f
    cleanup history 보존

- apps/web/src/__tests__/regression/workbench-search-radix-298f.test.ts
  (NEW, 6 it × 2 nested describe):
  · §11.298f trace marker
  · Radix dropdown-menu import 완전 제거 (readFileSync 직접 검증)
  · Radix DropdownMenu JSX 사용 0 (regex 직접 검증)
  · §11.283b plain swap trace 보존 확인
  · application-wide grep 0 — silent fail 제거:
    - `|| true` 제거, try/catch 으로 exit code 1 (no match) 만 success
    - 다른 exit code 는 명확히 throw
  · application-wide JSX 사용 0 — 동일 패턴

canonical truth 보존 (회귀 0):
- _workbench/search/page.tsx 의 햄버거 plain state (§11.283b) 보존
- isMenuOpen / setIsMenuOpen / handleMenu* state 변경 0
- 다른 import (lucide-react / Link / Image / Button / Input) 보존
- JSX 변경 0 (import section 만 touch)

호영님 production effect:
1. 소싱 페이지 (/dashboard/search) 햄버거 메뉴 — 변경 0
   (§11.283b plain swap 으로 이미 정상 작동 중)
2. bundle size 감소 — Radix DropdownMenu module 미사용 import 제거
3. 다음 batch (§11.302 dead file cleanup) 의 선결 조건 충족 —
   application-wide Radix import 0 회복

§11.298f 후속 (호영님 결정):
- §11.302 dead file cleanup:
  · components/ui/dropdown-menu.tsx 파일 자체 삭제
  · @radix-ui/react-dropdown-menu package.json + lock 제거
  · backup file (inventory-content.tsx.full / .full2) 삭제
    - 사용처 0 (ADR-002 단일 언급만)
    - 호영님 명시적 OK 필요

Out of Scope (별도 batch):
- §11.298e sentinel test 자체 수정 (silent fail 부분) — 본 batch 의
  §11.298f sentinel test 가 더 엄격한 검증 추가하므로 §11.298e 는
  보존 (배포된 sentinel 손대지 않음, Karpathy surgical changes)
- backup file 삭제 (§11.302)

Rollback path: git revert <SHA>
- 1 file ~10 line 복원 + sentinel test 삭제
- Radix import 복원 → dead import 회귀

Lessons:
1. sentinel test silent fail (`|| true`) = false-positive 위험.
   try/catch 으로 exit code 1 (no match) 만 success 처리하고 다른
   exit code 는 throw 가 정답.
2. Plain swap 시 import cleanup 누락 — §11.283b 같은 swap batch
   에서는 import 까지 line-by-line audit 필요.
3. backup file (.full / .full2) 은 dead file cleanup batch 에서
   호영님 명시적 OK 받고 삭제 — sandbox 자동 삭제 금지.
4. Karpathy minimum-diff — 1 file ~10 line + 1 NEW test (6 it).
```

## Push

```bash
git add apps/web/src/app/_workbench/search/page.tsx \
        apps/web/src/__tests__/regression/workbench-search-radix-298f.test.ts \
        docs/commit-drafts/COMMIT_11.298f-workbench-search-radix.md

git commit -F docs/commit-drafts/COMMIT_11.298f-workbench-search-radix.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/search Cmd+Shift+R
2. 헤더 우측 ≡ 햄버거 메뉴 click → 5 entry (대시보드/소싱/장바구니/
   설정/도움말) 정상 열림 (§11.283b plain swap 유지)
3. 각 menu item click → 정상 navigation
4. backdrop click → close
5. bundle size 비교 (next build output) — Radix dropdown-menu module
   미사용 import 제거 효과
