# §11.272e Commit Message Draft (호영님 P0 5차 — 단순 삭제)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(ui): §11.272e #skip-link-element-removal — 본문 바로가기 skip-link 완전 삭제 (호영님 P0 5차 — sr-only CSS hot fix 의존 5차 후에도 데스크탑 회귀 → element 자체 제거)

호영님 P0 5차 (2026-05-24):
"데스크탑에서도 최상단 왼쪽에 본문 바로가기 뜨는데 이거 완전
삭제하는 작업 해봐 계속 반영이 안되는데"

§11.125 / §11.272a / §11.272a-redo / §11.272a-redo-2 / §11.272d
5차 CSS hot fix 후에도 호영님 데스크탑 좌상단 "본문 바로가기"
파란 button visible. CSS hot fix 의존 한계 인정. element 자체 제거.

Fix (2 file ~20 line 제거 + sentinel test rewrite):

- apps/web/src/app/dashboard/_components/dashboard-shell.tsx:
  · <a href="#main-content">본문 바로가기</a> element + className 제거
  · §11.272e trace marker comment 남김

- apps/web/src/app/admin/layout.tsx:
  · <a href="#admin-main">본문 바로가기</a> element 제거
  · <main id="admin-main"> 은 보존 (다른 anchor 가능성)
  · §11.272e trace marker

- apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts
  rewrite (8 it):
  · §11.272e trace + skip-link 잔존 부재 (href="#main-content" / 본문
    바로가기 text 0)
  · main id 보존
  · FAB body scroll-lock (§11.272d) 부분 그대로 유지

canonical truth 보존:
- <main id="main-content"> / <main id="admin-main"> id 보존
- FAB body scroll-lock watch (§11.272d) 영향 0
- DashboardSidebar / OperationalBriefPopupProvider 구조 영향 0

WCAG 2.4.1 a11y trade-off 인정 (별도 batch):
- skip-link 가 키보드 사용자의 sidebar nav 우회 도구였음
- 제거 후 키보드 사용자 → brower 기본 Tab navigation 만
- 별도 batch — <nav role="navigation" aria-label="주요 메뉴">
  landmark navigation 으로 a11y 강화 가능

호영님 production effect (Vercel READY 후):
1. 데스크탑 좌상단 "본문 바로가기" 파란 button 완전 0
2. 모바일 mount 직후 회귀 0
3. desktop Tab focus 시 노출 0 (element 자체 없음)

§11.272 family 종료:
§11.272 + §11.272a + §11.272a-redo + §11.272a-redo-2 + §11.272d +
§11.272e (6 entry close)

Rollback path: git revert <SHA>
- 2 file element 복원 → "본문 바로가기" visible 회귀 +
  WCAG 2.4.1 충족

Lessons:
1. CSS hot fix 5차 후에도 회귀 시 element 자체 제거
2. 호영님 "계속 반영이 안되는데" 신호 = element 또는 dependency
   제거 시그널. CSS swap 의 시간 비용 vs 단순 제거의 즉시 해결
3. a11y trade-off 의 명시적 인정 + 별도 batch path 보존
4. Karpathy minimum-diff — 2 file ~20 line 제거 + 1 test rewrite
```

## Files to stage

```
apps/web/src/app/dashboard/_components/dashboard-shell.tsx
apps/web/src/app/admin/layout.tsx
apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.272e-skip-link-removal.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts

git add apps/web/src/app/dashboard/_components/dashboard-shell.tsx \
        apps/web/src/app/admin/layout.tsx \
        apps/web/src/__tests__/regression/skip-link-fab-overlap-272d.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.272e-skip-link-removal.md

git commit -F docs/commit-drafts/COMMIT_11.272e-skip-link-removal.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard Cmd+Shift+R hard refresh
2. 좌상단 "본문 바로가기" **0 확인** (데스크탑 + 모바일)
3. iPhone Safari → labaxis.co.kr/dashboard → 좌상단 visible 0
4. Tab 키 → skip-link 노출 안 됨 (element 자체 없음)
