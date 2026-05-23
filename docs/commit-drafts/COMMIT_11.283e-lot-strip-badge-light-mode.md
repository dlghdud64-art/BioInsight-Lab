# §11.283e Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(inventory): §11.283e lot_issue strip 검토/임박 배지 light mode 신호등 hot fix (호영님 P0+ production smoke 결과: "위험/부족/정상/검토 카드 색상 그대로")

호영님 P0+ production Chrome MCP smoke 결과:
labaxis.co.kr/dashboard/inventory HTML 검사 — bg-yellow-500: 7 spot +
dark_opacity_9xx_40: 3 spot 잔존. "검토" 배지 실제 색상 rgb(234,179,8)
(bg-yellow-500) + rgb(15,23,42) (text-slate-900) — 호영님 spec light
mode 신호등 (bg-yellow-100 text-yellow-700) 와 mismatch.

Root Cause:
§11.283d STATUS_CONFIG hot fix 가 mobile-inventory-view normal/low/
expiring/danger (4 spot) + dynamic expiring/expired badge (1 spot)
만 swap. 같은 file line 327-336 action.shortLabel 분기 (§11.273c
에서 land 된 lot_issue strip 6 분기) 는 §11.283d sweep scope 밖.

Fix (mobile-inventory-view.tsx 2 spot swap, minimum-diff):
- line 330 "검토": bg-yellow-500 text-slate-900 → bg-yellow-100
  text-yellow-700
- line 332 "임박": bg-yellow-500 text-slate-900 → bg-yellow-100
  text-yellow-700
- §11.283e trace marker comment block 추가

canonical truth 보존:
- 6 shortLabel 분기 구조 보존 (긴급/검토/폐기/임박/재주문/위치)
- 긴급/폐기 bg-red-600 text-white (§11.283d 정합) 보존
- 재주문 bg-blue-500 + 위치 bg-violet-500 (다른 category 의미) 보존
- none fallback bg-slate-200 text-slate-700 보존
- action.type !== "none" guard / title={action.label} aria 보존

Changes (3 files):
- apps/web/src/components/inventory/mobile-inventory-view.tsx
  (2 line swap + §11.283e comment block, ~10 line)
- apps/web/src/__tests__/regression/lot-strip-badge-light-mode-283e.test.ts
  (NEW, 6 it — trace + 검토 + 임박 + 잔존 부재 + 긴급/폐기 보존 +
  재주문/위치 보존)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.283e entry)

Verification:
- vitest §11.283e sentinel: 6/6 GREEN
- cluster (§11.283d + §11.290 p1 + §11.283e): 19/19 GREEN

호영님 production effect (Vercel READY 후):
- 재고 화면 검토 배지 light mode 정합 (옅은 노랑 + 진한 노랑 텍스트)
- 임박 배지도 동일 정합
- 긴급 배지 (bg-red-600 text-white) 대비 명확화 — 신호등 의미 강화

§11.283 family final close (v4):
- §11.283a (KPI grid) ✅
- §11.283b (배경 흰색) ✅
- §11.283c (inventory-content sweep) ✅
- §11.283c-2 (app-wide sweep) ✅
- §11.283d (STATUS_CONFIG light mode) ✅
- §11.283e (lot_issue strip badge light mode) ✅

Out of Scope (별도 cluster, 호영님 보고 없음):
- application-wide 잔존: priority-action-queue / import-staging-
  workbench / inventory-context-panel / InventoryTable / stock-
  lifespan-gauge (dotColor/iconBg subtle accents)
- ai-action-inbox.tsx 6 spot dark variant (대시보드 페이지 한정)
- stock-risk/page.tsx 4 spot (별도 페이지)

Rollback path: `git revert <SHA>` (1 commit, 2 line swap + comment
복원 → 검토/임박 배지 진한 노랑 + 어두운 텍스트 회귀)
```

## Files to stage

```
apps/web/src/components/inventory/mobile-inventory-view.tsx
apps/web/src/__tests__/regression/lot-strip-badge-light-mode-283e.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.283e-lot-strip-badge-light-mode.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare
git pull --ff-only
git add apps/web/src/components/inventory/mobile-inventory-view.tsx \
        apps/web/src/__tests__/regression/lot-strip-badge-light-mode-283e.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.283e-lot-strip-badge-light-mode.md
git commit -F /dev/stdin <<'EOF'
... (위 commit message)
EOF
git push origin main
```

## Production smoke (Vercel READY 후)

1. **iOS Safari 실제 디바이스** — `labaxis.co.kr/dashboard/inventory` 진입
2. lot_issue strip 검토 배지 — 옅은 노랑 (bg-yellow-100) + 진한 노랑 텍스트 (text-yellow-700)
3. lot_issue strip 임박 배지 — 동일 light mode 신호등
4. 긴급/폐기 배지 (bg-red-600 text-white) 대비 명확 확인
5. Chrome MCP HTML 검사: bg-yellow-500 잔존 ≤ 5 spot (mobile-inventory-view 외 컴포넌트, 호영님 보고 surface 아님)

## 호영님 결정 후속 (선택)

application-wide 잔존 sweep (별도 cluster):
- ai-action-inbox.tsx 6 spot dark variant
- stock-risk/page.tsx 4 spot dark opacity
- priority-action-queue / InventoryTable / stock-lifespan-gauge dotColor

→ 호영님 추가 spec 시 §11.283f / §11.291+ 별도 cluster 진행
