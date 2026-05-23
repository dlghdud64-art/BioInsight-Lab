# §11.282-e Commit Message Draft (P0+ 호영님 4번째 dead button 차단)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(sourcing): §11.282-e DropdownMenuTrigger asChild 제거 + Radix 자체 button render (호영님 3rd report — sandbox PointerEvent 정상 open 이지만 iOS Safari + desktop 모두 finger/mouse click dead, asChild prop spread 시 onClick 누락 root cause)

호영님 P0+ 3rd report (2026-05-23):
§11.265d (햄버거 wiring) + §11.282-a (Menu icon pe-none) 후 여전히 dead.
surface 불일치 가설 폐기 — /app/search 가 _workbench/search default
export 그대로 render, 햄버거 코드 production land 됨.

Sandbox audit 결정적 결과:
- DOM 정상 (button 44×44 visible, elementFromPoint=button 자체)
- reactPropsKeys=[type, aria-label, ..., onPointerDown, onKeyDown] —
  onClick 누락 (asChild prop spread 누락 가설)
- PointerEvent dispatch → aria=true / portal=1 / 5 menuItem (정상 open)
- MouseEvent('click') dispatch → clickEventFired=true 인데 aria 변화 0
  (click handler 미spread 확정)

Root cause:
Radix <DropdownMenuTrigger asChild> + 내부 <button> wrapper 패턴이
onPointerDown 만 spread, onClick 누락. 브라우저 native click 시퀀스
(pointerdown → click) 중 click 부분이 다른 layer 에 capture 되거나
onPointerDown 의 capture 가 hierarchy 에서 stop 시 fail.

Fix (1 spot, minimum-diff):
- _workbench/search/page.tsx line 3135-3143 햄버거 block:
  · asChild + <button> wrapper 제거 → <DropdownMenuTrigger type aria-label
    className> 직접 사용 → Radix 가 자체 button render + 모든 handler
    (pointerdown/click/keydown) 정확 attach
  · className 에 touch-manipulation + [-webkit-tap-highlight-color:
    transparent] 추가 — iOS Safari 300ms tap delay + tap highlight
    overlay 차단 (defensive layer)
  · Menu icon pointer-events-none 보존 (§11.280-2)
  · §11.282-e trace marker comment block 추가

canonical truth 보존:
- 5 menuItem (대시보드/견적/구매/재고/설정) + Link href 변경 0
- DropdownMenuContent / Label / Separator 변경 0
- Menu icon pointer-events-none 보존
- button 6 visual className utility 보존
- §11.265d / §11.280-2 / §11.282-a 변경 0

Changes (2 file):
- apps/web/src/app/_workbench/search/page.tsx (line 3135-3143,
  asChild 제거 + wrapper button 제거 + 2 utility 추가 + trace, ~15 line)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.282-e entry)
- docs/commit-drafts/COMMIT_11.282-e-sourcing-hamburger-asChild-removal.md (NEW)

호영님 production smoke (Vercel READY 후):
1. iOS Safari finger tap → 햄버거 open + 5 menuItem 표시 ✓
2. desktop Chrome mouse click → open ✓
3. 5 menuItem 각각 click → 해당 페이지 이동 ✓
4. menu 외부 click → close ✓

§11.282 family 4th attempt:
§11.265d (구현) → §11.280-2 (pointer-events-none) →
§11.282-a (Header.tsx 동일) → §11.282-e ✅ (asChild 제거)

Out of Scope (별도):
- _workbench/search ↔ /app/search canonical 단일화
- 다른 surface 의 Radix asChild 패턴 sweep (Tooltip/Popover/Dialog)
- production smoke 4 case 결과 ADR append

Rollback path: git revert <SHA>
- DropdownMenuTrigger 형태 복원 → dead button 회귀 (rollback 의미 0)
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.282-e-sourcing-hamburger-asChild-removal.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/_workbench/search/page.tsx \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.282-e-sourcing-hamburger-asChild-removal.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

**4 platform 모두 검증 필수** (이전 fix 들이 일부 platform 만 fix 했을 가능성):

1. **iOS Safari (iPhone)** — labaxis.co.kr/app/search → 햄버거 finger tap → 5 menuItem 표시
2. **iOS Safari (iPad)** — 동일
3. **Android Chrome** — 동일
4. **Desktop Chrome / Safari / Firefox** — mouse click

각 platform 에서 5 entry (대시보드/견적/구매/재고/설정) 각각 tap → 해당 페이지 이동 확인.

## 가설 검증
- ✅ 정상 작동 = asChild 패턴이 root cause 확정 → §11.282 family final close
- ❌ 여전히 dead = 다른 layer trap (parent stacking context / fixed inset-0 overlay capture / Radix UI 버전 bug) — Radix DropdownMenu 자체를 native `<details><summary>` 로 swap 검토
