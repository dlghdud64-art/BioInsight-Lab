# §11.306c Commit Message Draft (재고 위험 배지 dot indicator 제거)

```
chore(inventory): §11.306c #inventory-risk-badge-dot-removed — mobile-inventory-view Badge 좌측 dot indicator 제거 (호영님 P2 옵션 A, 2026-05-26)

호영님 P2 spec (2026-05-26) 옵션 A:
재고 페이지 모바일 view 의 "위험" Badge 좌측 dot 이 배지 본체와
같은 색 (bg-red-600) → 대비 부족. 옵션 A 채택: dot 제거, 배지 본체
색상 만으로 상태 표시 충분.

§11.306c evidence (sandbox 직접 audit):
1. components/inventory/mobile-inventory-view.tsx STATUS_CONFIG:
   - danger.dotCls = "bg-red-600"
   - danger.badgeCls = "bg-red-600 text-white border-red-700"
   - dot 색 = 배지 본체 색 → 시각 노이즈 (안 보이거나 중복)
2. dot 사용처 (Badge 내부) 2건:
   - line 395-398: 카드 row 1 Badge
   - line 511-514: Sheet header Badge
3. dot 사용처 (Badge 외부, 보존) 1건:
   - line ~306: 제품명 좌측 단독 dot (별도 시각 신호)

Fix (1 file 2 위치):

- apps/web/src/components/inventory/mobile-inventory-view.tsx:
  · line 395-398 카드 Badge: <span rounded-full mr-1 dotCls/> 제거,
    label 만 직접 노출
  · line 511-514 Sheet Badge: 동일 dot 제거, label 만
  · §11.306c 주석 추가 (옵션 A 채택 근거 + 외부 dot 보존 명시)

- apps/web/src/__tests__/regression/
  inventory-risk-badge-dot-removed-306c.test.ts (NEW, 7 it):
  · Badge 안 dot span (rounded-full mr-1 statusCfg.dotCls) 0 occurrence
  · Badge wrapping 패턴 차단 (Badge > dot > label)
  · 카드 Badge label 만 직접 노출 정합
  · STATUS_CONFIG dotCls 4 정의 보존 (다른 caller 있을 수 있음)
  · STATUS_CONFIG badgeCls 4 신호등 색상 보존 (§11.302d 정합)
  · STATUS_CONFIG.label 4건 ("위험"/"부족"/"임박"/"정상") 보존
  · 제품명 좌측 단독 dot 보존 (Badge 와 별도 시각 신호)

canonical truth 보존 (회귀 0):
- STATUS_CONFIG dotCls / badgeCls / label 정의 변경 0
- 제품명 좌측 단독 dot (line ~306) 보존 — Badge 와 별도 시각 신호
- §11.302d 신호등 색상 토큰 변경 0
- §11.283d STATUS_CONFIG 구조 보존
- 재고 status 분기 (normal/low/expiring/danger) 보존
- inventory-content.tsx / inventory-main.tsx / inventory-flow-view.tsx 변경 0

호영님 production effect:
1. labaxis.co.kr/dashboard/inventory 모바일 view:
   - 카드 Badge: [● 위험] → [위험] (dot 제거, label 만)
   - 시각 노이즈 감소 — bg-red-600 배지 안 bg-red-600 dot 중복 해소
   - 배지 본체 색상 강도 (bg-red-600 text-white) 그대로 위험 신호 유지
2. Sheet 상세 헤더: 동일 효과
3. 제품명 좌측 dot 보존 — danger 시 빨간 dot 으로 별도 알림 시각 유지
4. desktop view (InventoryTable / inventory-content) 영향 0

Out of Scope:
- STATUS_CONFIG dotCls 정의 제거 (다른 caller 있을 수 있어 보존)
- 제품명 좌측 dot 제거 (호영님 spec "배지 좌측" 만 해당)
- §11.302d 신호등 색상 변경

Rollback path: git revert <SHA>
- 1 file (mobile-inventory-view.tsx) + 1 sentinel 복원
- 카드 + Sheet Badge 안 dot 회귀
```

## Push

```powershell
git add `
  apps/web/src/components/inventory/mobile-inventory-view.tsx `
  apps/web/src/__tests__/regression/inventory-risk-badge-dot-removed-306c.test.ts `
  docs/commit-drafts/COMMIT_11.306c-inventory-risk-badge-dot.md

git commit -F docs/commit-drafts/COMMIT_11.306c-inventory-risk-badge-dot.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/dashboard/inventory 모바일 view (375px):
   - 재고 카드 Badge "위험" — 좌측 dot 0 occurrence
   - 배지 본체 색상 (bg-red-600 text-white) 그대로 위험 시각 강도 유지
   - 제품명 좌측 dot (별도 시각 신호) 보존
3. Sheet 상세 (카드 탭) 헤더 Badge — 동일 효과
4. §11.302d 신호등 색상 정합 변화 0
```
