# §11.298b Commit Message Draft (user-menu Radix → plain)

```
fix(auth): §11.298b #user-menu-plain-button — user-menu.tsx Radix DropdownMenu 제거 + plain button (auth profile dropdown 10+ menuItem)

호영님 spec (2026-05-24):
단일 dropdown 11 file 중 가장 큰 user-menu.tsx (130 line, profile
dropdown 10+ menuItem). §11.295 프로필 패턴 정합 — plain button +
useState + 조건부 backdrop + role="menu". signOut sequence 보존.

Fix (1 file ~130 line swap + 1 NEW test):

- apps/web/src/components/auth/user-menu.tsx:
  · isUserMenuOpen useState 추가
  · <DropdownMenu> + <DropdownMenuTrigger asChild><Button>...>
    + <DropdownMenuContent>...<DropdownMenuLabel/Item/Separator>
    제거 → <div className="relative"> + <Button aria-label="사용자
    메뉴" aria-expanded aria-haspopup onClick> + 조건부 backdrop
    (fixed inset-0 외부 click close) + <div role="menu" aria-label
    ="사용자 메뉴">
  · 사용자 정보 header <button onClick={router.push("/dashboard/
    settings")}> (name + email + role + 호버 효과)
  · 7 Link/a (대시보드 / 견적 관리 / 구매 운영 / 재고 관리 / 설정 /
    청구 및 구독 / 고객센터 mailto) onClick 으로 setIsUserMenuOpen
    (false) → navigate 후 close
  · 로그아웃 button — signOut + resetWorkbenchSessionOnLogout +
    invalidateWorkbenchQueryCache sequence 그대로 + setIsUserMenuOpen
    (false) 추가
  · Radix DropdownMenu* import 6종 제거

- apps/web/src/__tests__/regression/user-menu-plain-button-298b.test.ts
  (NEW, 7 it):
  · §11.298b trace + isUserMenuOpen useState
  · plain Button aria + onClick toggle
  · Radix DropdownMenu* import/사용 완전 부재
  · 조건부 backdrop + role="menu" + 7 menuItem href 보존
  · 로그아웃 sequence 보존 (signOut/reset/invalidate)
  · 사용자 정보 header (name/email/role + /dashboard/settings) 보존
  · status loading + null guard 보존

canonical truth 보존 (회귀 0):
- useSession / signOut / resetWorkbenchSessionOnLogout /
  invalidateWorkbenchQueryCache wiring 변경 0
- 사용자 정보 (name / email / role / USER_ROLES mapping) 표시 보존
- status === "loading" + showLoading 2초 timeout 보존
- null guard (!session?.user) 보존
- User icon (pointer-events-none 추가)
- 모바일 사용자 이름 hidden (hidden md:inline)
- 7 menuItem + 로그아웃 모든 onClick/href 보존

호영님 production effect (Vercel READY 후):
1. 우상단 user menu button (User icon + 이름) click → plain
   dropdown 즉시 열림 (Radix 의존성 0)
2. 사용자 정보 header click → /dashboard/settings navigate
3. 각 menuItem click → 해당 페이지 navigate + dropdown close
4. 로그아웃 click → reset + invalidate + signOut sequence 정상
5. 외부 click → backdrop close
6. 호영님 환경 Radix silent fail 완전 차단 (auth surface)

Out of Scope (별도 batch §11.298c):
- quotes/page.tsx (2 dropdown)
- safety-spend / organizations / protocol/bom / quote-panel /
  data-table (6 file × 1 dropdown)

Rollback path: git revert <SHA>
- 1 file ~130 line + import 복원 → user-menu Radix 회귀

Lessons:
1. profile dropdown 패턴 — §11.295 (Header 프로필) 와 동일 (사용자
   정보 header + menuItem list + 로그아웃 separator)
2. signOut sequence 명시적 close 추가 — setIsUserMenuOpen(false) 으로
   redirect 직전 visual cleanup
3. mailto link 도 role="menuitem" 으로 wiring (외부 link 도 close)
4. Karpathy minimum-diff — 1 file ~130 line + 1 NEW test (7)
```

## Push

```bash
git add apps/web/src/components/auth/user-menu.tsx \
        apps/web/src/__tests__/regression/user-menu-plain-button-298b.test.ts \
        docs/commit-drafts/COMMIT_11.298b-user-menu-plain-button.md

git commit -F docs/commit-drafts/COMMIT_11.298b-user-menu-plain-button.md
git push origin main
```

## 다음 batch (§11.298c)

| File | dropdown | trigger |
|---|---|---|
| quotes/page.tsx | 2 | row actions + 기타 |
| safety-spend/page.tsx | 1 | row action |
| organizations/[id]/page.tsx | 1 | row action |
| protocol/bom/page.tsx | 1 | row action |
| _workbench/_components/quote-panel.tsx | 1 | row action |
| components/ui/data-table.tsx | 1 | column actions |
