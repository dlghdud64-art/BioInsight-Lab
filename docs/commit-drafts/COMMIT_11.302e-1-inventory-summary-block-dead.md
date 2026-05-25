# §11.302e-1 Commit Message Draft (inventory-summary-block.tsx dead file 삭제)

```
chore(cleanup): §11.302e-1 #inventory-summary-block-dead — inventory-summary-block.tsx dead file 삭제 (호영님 OK, §11.302a/b 패턴 정합)

배경 (§11.302d 시리즈 종결 후 audit 발견):
InventorySummaryBlock component (apps/web/src/app/dashboard/inventory/
blocks/inventory-summary-block.tsx) 가 application-wide 사용처 0:
  - 자기 file 정의만 + §11.302d-2 sentinel test 의 comment trace mention
  - import statement / JSX 사용 0 매치
  - 4-card widget (전체 품목 / 부족 위험 / 만료 임박 / 최근 변동) —
    호영님 §11.302c spec "재고 KPI 3개" (재주문 필요/만료 임박/폐기
    검토) 와 라벨 불일치, 별도 stale widget

호영님 결정 (2026-05-25): "권장 고" — 옵션 A (dead file 삭제)
  §11.302a (dropdown-menu.tsx) / §11.302b (inventory-content backup
  file) 패턴 정합. dead file 의 swap (옵션 B) 은 future use 가정
  없으면 의미 0 — 삭제가 minimum-diff + canonical.

Fix (1 file rm + 1 NEW test):

- apps/web/src/app/dashboard/inventory/blocks/inventory-summary-block.tsx:
  · 파일 삭제 (git rm, 호영님 환경)
  · sandbox 자동 삭제 0 (CLAUDE.md prohibited actions — permanent
    deletions)

- apps/web/src/__tests__/regression/inventory-summary-block-dead-302e1.test.ts
  (NEW, 4 it):
  · §11.302e-1 trace (self-referential)
  · 파일 부재 (existsSync false)
  · application-wide InventorySummaryBlock import 0 (Node.js FS 스캔)
  · application-wide <InventorySummaryBlock JSX 사용 0

canonical truth 보존 (회귀 0):
- InventorySummary type (lib/store/inventory-store.ts line 118/125) —
  store interface, dead file 와 별도, 보존
- inventory-main.tsx KPI 3-card (§11.302c) — 변경 0
- inventory-content.tsx (§11.302d 시리즈) — 변경 0
- 어떤 page / component 도 InventorySummaryBlock import 안 함 —
  production effect 0

호영님 production effect:
1. 화면 변경 0 (어디서도 사용 안 됨)
2. apps/web/src/app/dashboard/inventory/blocks/ 디렉토리 cleanup
3. dead file 1 개 감소 — repo clean
4. next build bundle 영향 0 (tree-shake 이미 제외됨)

§11.302d 시리즈 + §11.302e-1 = 재고 페이지 신호등 cleanup 완전 종결:
- §11.302c KPI 카드 (재주문 필요/만료 임박/폐기 검토)
- §11.302d-1 inventory-main 4 Badge
- §11.302d-2 inventory-main getCardBg + duplicate cleanup
- §11.302d-3 inventory-content 잔여 6 surface 일괄
- §11.302d-3a ISSUE_CONFIG central mapping
- §11.302d-4 우선 처리 배너 색상 역전 정정
- §11.302d-5 요약 칩 색상 + 전체 재고 제거
- §11.302e-1 inventory-summary-block dead file (본 batch)

Out of Scope (§11.302e-2 보류):
- inventory-main Lot 추적 widget (line 1885-1898) — "P2 개발 예정"
  placeholder. 호영님 spec 외, 보존 (옵션 C). future P2 wave 에서
  spec 정합 적용 예정.

Rollback path: git revert <SHA>
- 1 file 복원 + sentinel test 삭제
- git history 에 inventory-summary-block.tsx content 보존

Lessons:
1. dead component cleanup = §11.302a (dropdown-menu) / §11.302b
   (backup file) 패턴 정합. 사용처 0 확인 후 호영님 명시적 OK 받고
   git rm.
2. §11.302d-2 sentinel test 의 comment trace 가 stale 됨 — dead file
   삭제 후 comment 정리 별도 batch 또는 보존 (historical record).
3. canonical mention vs orphan — InventorySummary type (store) 는
   live, InventorySummaryBlock component (widget) 는 dead. 같은
   prefix 단어라도 별도 audit 필요.
4. Karpathy minimum-diff — 1 file rm + 1 NEW test (4 it).
   sandbox 파일 삭제 0 + 호영님 환경 git rm.
```

## Push (호영님 환경)

```bash
# 1. Sandbox sentinel test stage
git add apps/web/src/__tests__/regression/inventory-summary-block-dead-302e1.test.ts \
        docs/commit-drafts/COMMIT_11.302e-1-inventory-summary-block-dead.md

# 2. Dead file 삭제 (호영님 환경)
git rm apps/web/src/app/dashboard/inventory/blocks/inventory-summary-block.tsx

# 3. Commit + push
git commit -F docs/commit-drafts/COMMIT_11.302e-1-inventory-summary-block-dead.md
git push origin main
```

## Production smoke

1. labaxis.co.kr Cmd+Shift+R — 화면 변경 0 (사용처 0)
2. `ls apps/web/src/app/dashboard/inventory/blocks/` — `inventory-summary-block.tsx` 부재
3. `git ls-files | grep inventory-summary-block.tsx` → 0 매치
4. `npm run build` — 빌드 정상 (tree-shake 이미 제외, bundle 영향 0)

## 후속 batch (호영님 결정)

| § | scope |
|---|---|
| §11.302e-2 (보류) | Lot 추적 widget P2 placeholder — future wave |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 (labaxis-feature-planner) |
| 새 P0/P1 | 호영님 다른 지시 |
