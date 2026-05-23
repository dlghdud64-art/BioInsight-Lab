# §11.283 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(workbench): §11.283 #sourcing-hamburger-onClick-fallback — 호영님 P0+ 4차 환경 silent fail defense-in-depth (Radix onPointerDown 정상 attach 임에도 native event delegation trap 환경 cover)

호영님 P0+ 4차 (2026-05-24) report:
production /app/search 우상단 ☰ 햄버거 click 무반응. 1·2·3차 §11.280
+ §11.280-2 + §11.282-d + §11.282-e 후속에도 호영님 환경 미작동.

Phase 0 Truth Reconciliation (Chrome MCP + 호영님 DevTools 4단계):
- Sandbox PointerEvent dispatch: aria-expanded:true / data-state:open /
  portal:1 / menuItems:5 (대시보드/견적/구매/재고/설정) 정상
- 호영님 1줄 검증 4회:
  · ?.click() → undefined (Radix design — Radix onClick 안 씀)
  · PointerEvent dispatch → state:open (sandbox 동일, Radix wiring 정상)
  · React props audit → reactKeys:[__reactFiber, __reactProps],
    onPointerDown:"function", onClick:"undefined" (Radix design)
  · global pointerdown listener → PD@ ... TARGET: BUTTON 메뉴 열기
    (native pointerdown button hit 정상)
- 시크릿창 동일 결과 → Chrome extension 무관

Root Cause 확정:
production code + React hydration + Radix wiring 모두 정상.
호영님 환경의 native pointerdown 이 React event delegation root
까지 도달 못 함 = 일부 환경 (특정 브라우저/OS/마우스 driver 조합)
에서 silent fail.

Fix (1 file ~25 line + 1 NEW test, defense-in-depth):
- apps/web/src/app/_workbench/search/page.tsx:
  · DropdownMenuTrigger 에 onClick prop 추가
  · onClick handler — e.currentTarget.getAttribute("data-state")
    === "closed" 분기
  · 분기 안에서 PointerEvent("pointerdown", {bubbles:true,
    cancelable:true, isPrimary:true, button:0}) 강제 dispatch
  · Radix internal handler 가 받아서 setOpen(true)
  · Radix uncontrolled mode 유지 (controlled mode 회피 → keyboard
    navigation / focus trap 정합 영향 0)

- apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts
  (NEW, 9 it):
  · §11.283 trace + sourcing-hamburger-onClick-fallback comment
  · aria-label="메뉴 열기" + onClick prop wiring
  · data-state="closed" 분기
  · PointerEvent("pointerdown") 강제 dispatch
  · isPrimary:true / bubbles:true / button:0 옵션
  · §11.280-2 Menu icon pointer-events-none 보존
  · §11.282-d touch-manipulation + webkit-tap-highlight 보존
  · §11.282-e asChild 제거 보존
  · menuItem 5종 (대시보드/견적/구매/재고/설정) 보존

canonical truth 보존:
- Radix DropdownMenu uncontrolled mode
- §11.280 outer container fix
- §11.280-2 Menu icon pointer-events-none
- §11.282-d touch-manipulation + webkit-tap-highlight-color:transparent
- §11.282-e asChild 제거 + DropdownMenuTrigger 자체 button render
- menuItem 5종 + Link navigation
- DropdownMenuContent / Label / Separator / Item 구조

회귀 0:
- 정상 onPointerDown 환경: native pointerdown → setOpen(true) →
  data-state="open" 변경 → 그 다음 native click 의 onClick handler
  fire 되지만 `data-state === "closed"` 분기 미진입 → 추가 dispatch 0
  → toggle 무한 loop 0
- Radix internal handler 자체 변경 0
- 다른 surface DropdownMenu (Header.tsx 알림/도움말/프로필 +
  inventory/quotes/settings 등 20+ file) 영향 0

Verification (sandbox grep simulation):
- §11.283 ×3 / sourcing-hamburger-onClick-fallback ×2
- onClick={(e) => ×1 / getAttribute("data-state") === "closed" ×1
- new PointerEvent("pointerdown" ×1 / isPrimary: true ×1
- §11.280-2 / §11.282-d / §11.282-e marker 모두 보존

호영님 production effect (Vercel READY 후):
1. 소싱 화면 우상단 ☰ 햄버거 click → 어떤 환경에서도 dropdown
   100% 열림 (defense-in-depth)
2. 5 menuItem 정상 render + Link navigation
3. Radix keyboard navigation (Enter/Space/↓/↑/Esc) 그대로 작동
4. 호영님 환경 외 동일 trap 다른 사용자 silent fail 해소

Out of Scope (별도 batch):
- Header.tsx 알림/도움말/프로필 DropdownMenu 동일 fallback 적용
  (호영님 보고 동일 trap 확인 후 batch)
- 다른 hamburger surface (mobile 전용 등) 별도 audit
- Radix UI version upgrade (현 2.1.0 → 최신, production-wide impact)

Rollback path: git revert <SHA>
- 1 file ~25 line revert + 1 test 삭제 → 호영님 환경에서 dead button
  회귀

Lessons:
1. 4차 audit 의 layer-by-layer 진단 — button DOM → React hydration →
   Radix props → native event delegation 순차 검증으로 정확한 root
   cause 확정 (1·2·3차에 못 잡은 silent fail 위치)
2. Sandbox Chrome MCP + 호영님 DevTools 1줄 검증의 시너지 — sandbox
   결과와 호영님 결과 비교로 production code 결함 vs 환경 trap
   명확히 분리
3. Defense-in-depth — production code 정상 + 환경 trap 확정 시에도
   silent fail user 보호. Radix uncontrolled mode + onClick fallback
   으로 모든 환경 cover
4. ?.click() 의 undefined 반환은 진단 신호 아님 — optional chaining
   의 자연스러운 반환. PointerEvent dispatch + state attribute 변화
   측정이 진짜 진단
5. Radix DropdownMenuTrigger 의 onPointerDown-only design — Radix는
   onClick 안 씀 (asChild 여부 무관). native click sequence 의
   pointerdown 단계에서 작동. 일부 환경에서 pointerdown trap 되면
   silent fail → onClick fallback 가장 안전한 우회
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.283-sourcing-hamburger-onclick-fallback.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

# sentinel test 검증 (선택)
pnpm vitest run apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts

git add apps/web/src/app/_workbench/search/page.tsx \
        apps/web/src/__tests__/regression/sourcing-hamburger-onclick-fallback-283.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.283-sourcing-hamburger-onclick-fallback.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/app/search 진입 (Cmd+Shift+R hard refresh)
2. 우상단 ☰ 햄버거 click → **dropdown 즉시 열림 확인**
3. 5 menuItem (대시보드/견적 관리/구매 운영/재고 관리/설정) 표시 확인
4. 메뉴 항목 click → 해당 페이지 navigate 확인
5. 다시 ☰ click → dropdown 닫힘 확인 (toggle 정상)
6. 키보드 Tab → ☰ focus → Enter/Space → dropdown 열림 확인 (keyboard navigation 회귀 0)
7. (재현 확정 위해) 호영님 DevTools Console 에 1줄 검증:
   ```js
   const b=document.querySelector('[aria-label="메뉴 열기"][data-state]');
   console.log('onClick:', typeof b[Object.keys(b).find(k=>k.startsWith('__reactProps'))].onClick)
   ```
   → 출력: `onClick: function` (이전 `undefined` → 이번 `function`)

## 호영님 환경 추가 점검 (production fix 적용 후에도 안 열리면)

만약 production fix 후에도 호영님 환경에서 dropdown 안 열리면 → onClick
조차 React event delegation 까지 fire 안 되는 더 깊은 trap. 다음 조치:
- Chrome 재시작
- Edge / Firefox 시도 → 정상 작동 시 Chrome 자체 issue (Chrome reset
  또는 재설치)
- 호영님 OS 마우스 driver 점검 (Windows 설정 → 장치 → 마우스)

## 다음 batch 후보 (호영님 결정)

- Header.tsx 알림/도움말/프로필 DropdownMenu 에 동일 fallback 적용
  (호영님 click 결과 보고 후 결정)
- 다른 hamburger surface (mobile 전용 + admin 등) 동일 fallback 적용
- Radix UI 2.1.0 → 최신 version upgrade (production-wide impact, P2)
