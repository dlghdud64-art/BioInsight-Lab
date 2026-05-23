# §11.272a-redo-2 + §11.272d Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(ui): §11.272a-redo-2 + §11.272d 호영님 P0 3차 hot fix — skip-nav 모바일 항상 노출 회귀 (focus-visible→focus) + 운영 브리핑 FAB 바텀시트 겹침 (body scroll-lock watch)

호영님 P0 spec (2026-05-23):
1. "본문 바로가기" 모바일 첫 로딩 항상 visible — 헤더 ~40px 점유
2. "✦ 운영 브리핑" FAB 가 견적 detail bottom sheet open 시 primary CTA
   ("회신 검토 시작 →") 위에 떠서 가림

Root cause:
1. §11.272a-redo (#592) 의 focus-visible:not-sr-only 가 iOS Safari mount
   직후 첫 focusable element 에 임의 적용 → 항상 노출 회귀
2. FAB position:fixed + sheet position:fixed 동시 → 시각 겹침

Fix (3 file swap + 1 NEW test):
- apps/web/src/app/dashboard/_components/dashboard-shell.tsx:
  · skip-link className focus-visible: → focus: swap
  · absolute left-[-9999px] top-[-9999px] off-screen 패턴 제거
  · sr-only 만으로 모바일 완전 hidden, desktop Tab focus 시 노출

- apps/web/src/app/admin/layout.tsx:
  · dashboard-shell 와 동일 패턴 swap

- apps/web/src/components/operational-brief/floating-entry.tsx:
  · useBodyScrollLocked() helper NEW (MutationObserver + body 의
    data-scroll-locked attribute / style.overflow=hidden watch)
  · FAB return 직전 `if (bodyScrollLocked) return null;`
  · Radix Dialog/Sheet/DropdownMenu 모두 mount 시 body scroll-lock →
    FAB 자동 hidden (운영 브리핑 popup + 견적 detail + 재고 detail 등
    카테고리 무관 통합 detection)

- apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts
  (NEW, 8 it × 2 nested describe):
  · skip-link 4 it (dashboard + admin 각각 trace + focus:not-sr-only +
    focus-visible:not-sr-only 0 + left-[-9999px] 0)
  · FAB 4 it (trace + useBodyScrollLocked + MutationObserver +
    bodyScrollLocked return null + popup.isOpen 보존)

canonical truth 보존:
- skip-link href "#main-content" / "#admin-main" + 한글 "본문 바로가기"
  보존 (WCAG 2.4.1)
- FAB position / Sparkles icon / "운영 브리핑" label / aria-expanded /
  popup.isOpen wiring 보존
- handleClick / open / disabled state 변경 0

Verification (sandbox grep simulation):
- dashboard-shell §11.272a-redo-2 ×1 + focus:not-sr-only ×2 +
  focus-visible:not-sr-only ×0
- admin/layout §11.272a-redo-2 ×1 + focus:not-sr-only ×1 +
  focus-visible:not-sr-only ×0
- FAB §11.272d ×3 / useBodyScrollLocked ×2 / MutationObserver ×2 /
  data-scroll-locked ×4 / bodyScrollLocked ×2

호영님 production effect:
1. 모바일 대시보드/견적/구매/재고 첫 로딩 시 "본문 바로가기" 완전 hidden
2. desktop Tab 사용자 keyboard nav 시 정상 노출 (WCAG 2.4.1 보존)
3. 견적 카드 탭 → bottom sheet open → FAB 자동 hidden → CTA 가림 0
4. sheet close → FAB 자동 복귀
5. 대시보드 온보딩 / 재고 위험 sheet 도 통합 hidden (Radix scroll-lock
   공통 detection)

Out of Scope (옵션 B/C 장기 백로그):
- FAB → 헤더 햄버거 menuItem 으로 이동 (옵션 C 장기 — FAB 제거)
- bottom sheet padding-bottom 추가 (옵션 B)
- sheet open transition 중간 frame 의 FAB visibility

Rollback path: git revert <SHA>
- 3 file + 1 test revert → skip-link 모바일 visible 회귀 +
  FAB always visible (겹침 복원)

Lessons:
1. iOS Safari :focus-visible 처리 차이 — mount 직후 첫 focusable element
   에 임의 적용. :focus 가 superset + iOS Safari 안전
2. body scroll-lock watch 가 통합 sheet/dialog detection — Radix UI
   공통 (data-scroll-locked / overflow:hidden), MutationObserver 단일 hook
3. FAB hide on sheet open = mobile UX 정합 — fixed bottom 좌표 충돌 회피
4. 호영님 spec 옵션 A (popup 만 watch) → sandbox wider 구현 (body
   scroll-lock 통합) future-proof
```

## Files to stage

```
apps/web/src/app/dashboard/_components/dashboard-shell.tsx
apps/web/src/app/admin/layout.tsx
apps/web/src/components/operational-brief/floating-entry.tsx
apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.272d-skip-link-fab-overlap.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

# sentinel test 검증 (선택)
pnpm vitest run apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts

git add apps/web/src/app/dashboard/_components/dashboard-shell.tsx \
        apps/web/src/app/admin/layout.tsx \
        apps/web/src/components/operational-brief/floating-entry.tsx \
        apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.272d-skip-link-fab-overlap.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후, iOS Safari 우선)

### 본문 바로가기
1. iPhone Safari → labaxis.co.kr/dashboard (또는 /quotes)
2. 좌측 상단에 "본문 바로가기" 버튼 **0** 확인
3. 데스크탑 Chrome → labaxis.co.kr/dashboard → Tab 키 1회 → skip-link 노출 확인

### FAB 바텀시트 겹침
1. iPhone Safari → labaxis.co.kr/dashboard/quotes
2. 우하단 "✦ 운영 브리핑" FAB 표시 확인
3. 견적 카드 1개 탭 → bottom sheet open → **FAB 자동 hidden 확인** ("회신 검토 시작 →" CTA 가림 0)
4. sheet 닫기 → FAB 자동 복귀 확인
5. /dashboard 진입 → 온보딩 카드 sheet 도 동일 hidden
6. /dashboard/inventory → 위험 카드 sheet 도 동일

## 햄버거 dead button (3rd report) 관련 별도 보고

sandbox Chrome MCP smoke 에서 햄버거 button **정상 작동 확인** (PointerEvent
dispatch → DropdownMenu open + 5 menuItem render). production code 자체는
정상. iOS Safari 특화 trap 가능성 (cache / touch-action / Web Inspector
필요). 별도 batch 에서 정답 추적.
