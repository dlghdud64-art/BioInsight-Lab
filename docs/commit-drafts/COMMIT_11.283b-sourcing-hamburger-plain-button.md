# §11.283b Commit Message Draft (호영님 5차 단순화)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(workbench): §11.283b #sourcing-hamburger-plain-button — 호영님 P0+ 5차 Radix DropdownMenu 제거 + plain button/useState 단순화 (5차 hot fix 후에도 dead button → 단순/직관 접근)

호영님 P0+ 5차 (2026-05-24) 결정:
"단순하게 가자 왜 이렇게 돌아가 단순하게 직관적으로 생각해 안되는거에 대한"

§11.280 / §11.280-2 / §11.282-d / §11.282-e / §11.283 onClick fallback
5차 hot fix 후에도 시크릿창 동일 dead button → Radix DropdownMenu
dependency 자체가 호영님 환경 silent fail root cause.

단순화 fix (1 file ~70 line + 1 test rewrite):

- apps/web/src/app/_workbench/search/page.tsx:
  · hamburgerOpen useState (line 2880 옆 추가)
  · DropdownMenu/DropdownMenuTrigger/DropdownMenuContent/
    DropdownMenuItem/DropdownMenuLabel/DropdownMenuSeparator 5종
    모두 제거 (햄버거 영역만)
  · plain <button aria-label="메뉴 열기" aria-expanded={hamburgerOpen}
    aria-haspopup="menu" onClick={() => setHamburgerOpen(v => !v)}>
  · 조건부 render — backdrop (fixed inset-0 외부 click close) +
    <div role="menu" aria-label="주요 화면">
  · 5 Link (대시보드/견적/구매/재고/설정) onClick 으로
    setHamburgerOpen(false) → navigate 후 close
  · Menu icon pointer-events-none (§11.280-2 정신 보존)
  · touch-manipulation + webkit-tap-highlight (§11.282-d 보존)

- apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts
  rewrite (10 it):
  · §11.283b trace + sourcing-hamburger-plain-button comment
  · hamburgerOpen useState 정의
  · plain <button> aria-label + onClick toggle
  · aria-expanded + aria-haspopup
  · 조건부 render + backdrop + role="menu"
  · 5 menuItem href 보존
  · setHamburgerOpen(false) ≥ 6 (backdrop 1 + menuItem 5)
  · Menu pointer-events-none / touch-manipulation 보존

canonical truth 보존:
- 5 menuItem (대시보드/견적/구매/재고/설정) href 그대로
- §11.280-2 Menu pointer-events-none 보존
- §11.282-d touch-manipulation + webkit-tap-highlight 보존
- DropdownMenu import 그대로 (다른 surface 8 spot 사용중)
- navigate 후 menu close UX 보존

회귀 0:
- Radix DropdownMenu 의 다른 사용처 (Header.tsx 알림/도움말/프로필 +
  inventory/quotes/settings 등 20+ file) 영향 0
- 일부 a11y 회귀 인정 (별도 batch):
  · Arrow keys navigation 미지원 (plain Tab navigation 만)
  · Esc close 미지원
  · Focus trap 미지원

호영님 production effect (Vercel READY 후):
1. 소싱 화면 우상단 ☰ click → setHamburgerOpen toggle → 100% 작동
2. 5 menuItem click → 페이지 navigate + menu close
3. 외부 영역 click → backdrop close
4. Radix wiring trap 0 (dependency 자체 0)

Out of Scope (별도 batch):
- Esc keydown close (useEffect)
- Arrow keys / Home/End keyboard navigation
- Focus trap (Tab cycling)
- Header.tsx 알림/도움말/프로필 DropdownMenu 동일 단순화

Rollback path: git revert <SHA>
- 1 file ~70 line + sentinel test rewrite 복원
- Radix DropdownMenu 회귀 + 호영님 환경 dead button 회귀

Lessons:
1. 5차 회귀의 신호 — dependency 자체가 trap. Radix wiring 5차
   hot fix 후에도 dead button = dependency 제거가 가장 직관적 fix
2. plain HTML + plain React state 의 신뢰성 — <button onClick> +
   useState + 조건부 render 는 어떤 환경에서도 100% 작동 보장
3. 호영님 단순함 spec 의 가치 — 5분 단순 fix + 회귀 0 vs 5차
   복잡 audit (Chrome MCP + DevTools 4단계) 의 시간 비용
4. a11y trade-off 인정 — Radix 의 keyboard / focus trap / Esc 는
   별도 batch. 호영님 production effect 우선
5. Karpathy minimum-diff — 1 file ~70 line + 1 test rewrite
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.283b-sourcing-hamburger-plain-button.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts

git add apps/web/src/app/_workbench/search/page.tsx \
        apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.283b-sourcing-hamburger-plain-button.md

git commit -F docs/commit-drafts/COMMIT_11.283b-sourcing-hamburger-plain-button.md
git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/app/search Cmd+Shift+R hard refresh
2. 우상단 ☰ click → **dropdown 즉시 열림** ✅
3. 5 menuItem 표시 (대시보드/견적/구매/재고/설정)
4. menuItem click → 해당 페이지 navigate + menu close
5. 외부 영역 click → menu close
6. 다시 ☰ click → 다시 열림 (toggle)
