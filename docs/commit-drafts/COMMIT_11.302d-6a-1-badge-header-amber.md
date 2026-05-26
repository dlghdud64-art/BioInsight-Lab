# §11.302d-6a-1 Commit Message Draft (badge.tsx + Header.tsx amber/orange swap)

```
chore(ui): §11.302d-6a-1 #badge-header-amber-removed — badge.tsx amber variant value swap (key 보존) + Header.tsx notification 2 entry 신호등 swap (호영님 P1 sweep batch 1/3, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6 전체 amber/orange sweep audit 완료 — ~150 file ~620+ 위치.
6a (critical ~10 file) / 6b (workbench ~30) / 6c (lib + legacy ~30)
분할 진입. 본 batch = 6a-1 (foundation 2 file).

6a-1 scope (badge.tsx 응용 전체 영향 + Header.tsx 글로벌):
- badge.tsx: dotColorMap.amber 의 value 만 yellow swap, key "amber"
  보존 → caller (Badge dot="amber" ~20+ 위치) wiring 영향 0
- Header.tsx: NOTIFICATION_TYPE_MAP 2 entry 색상 swap
  - expiry_warning (만료) = 긴급/주의 → amber → yellow (의미 보존)
  - safety_alert (안전) = 위험 강도 ↑ → orange → red (강한 경고로 격상)

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할 (사용처 ~150 file ~620+ 위치)
- §11.302d-6a (critical ~10 file 분할 진행)
  - §11.302d-6a-1 ✅ 본 batch (badge.tsx + Header.tsx)
  - §11.302d-6a-2 (dashboard 4 widget: executive-summary / Category /
    Budget / ai-action-inbox) — 후속
  - §11.302d-6a-3 (3 ai-assistant-panel + dashboard/page.tsx) — 후속
- §11.302d-6b (workbench/approval ~30 file) — 후속
- §11.302d-6c (lib + legacy ~30 file) — 후속

Fix (2 file 수정 + 1 NEW sentinel):

- apps/web/src/components/ui/badge.tsx:
  · dotColorMap.amber.dot: "bg-amber-500" → "bg-yellow-500"
  · dotColorMap.amber.ping: "bg-amber-400" → "bg-yellow-400"
  · key 명 "amber" 보존 (caller wiring 영향 0):
    - Badge dot="amber" prop 사용처 ~20+ file (확인 필요 시 grep)
    - StatusDotColor type literal "amber" 보존
  · §11.302d-6a-1 주석 추가 (key 보존 + value swap 근거)

- apps/web/src/components/dashboard/Header.tsx:
  · NOTIFICATION_TYPE_MAP expiry_warning entry:
    - unreadTint: "text-amber-500" → "text-yellow-500"
    - unreadBg: "bg-amber-50" → "bg-yellow-50"
  · NOTIFICATION_TYPE_MAP safety_alert entry (위험 격상):
    - unreadTint: "text-orange-500" → "text-red-500"
    - unreadBg: "bg-orange-50" → "bg-red-50"
  · 다른 5 entry (stock_alert/quote_arrived/delivery_complete/
    approval_pending/system) 변경 0
  · §11.302d-6a-1 주석 추가 (swap 근거 명시)

- apps/web/src/__tests__/regression/
  badge-header-amber-removed-302d6a1.test.ts (NEW, ~14 it):
  · badge.tsx 6 it (amber value yellow swap / amber key 보존 /
    dotColorMap 6 entry 보존 / Badge props 보존)
  · Header.tsx 5 it (expiry_warning yellow / safety_alert red /
    amber-orange Tailwind class 0 / entry icon+label 보존 /
    NOTIFICATION_TYPE_MAP 7 entry 보존)
  · 회귀 0 3 it (§11.308a-v2 ScanLine 진입점 / §11.295-296 Radix 0 /
    stock_alert red 보존)

canonical truth 보존 (회귀 0):
- Badge component API (props/variant/render) 변경 0
- dot="amber" caller 사용처 ~20+ wiring 영향 0 (key 명 보존)
- NOTIFICATION_TYPE_MAP 7 entry 구조 보존 (icon/tint/bg/label)
- §11.308a-v2 Header ScanLine 진입점 변경 0
- §11.295/§11.296 plain button 패턴 보존 (Radix 0)
- §11.302 신호등 의미 일관성 (stock_alert red / safety_alert red 격상)

호영님 production effect:
1. labaxis.co.kr 전역 Badge dot="amber" 위치 ~20+:
   - 시각 차이: 따뜻한 amber → 밝은 yellow (긴급/주의 의미 유지)
   - 컴포넌트 동작 / wiring / 의미 변경 0
2. labaxis.co.kr 헤더 알림 dropdown:
   - "만료" 알림 색상: amber → yellow (의미 유지)
   - "안전" 알림 색상: orange → red (위험 강도 격상, 사용자 인지 강화)
3. CLAUDE.md §11.302 신호등 정합 — foundation 2 file 완료

Out of Scope (§11.302d-6a-2 / 6a-3 / 6b / 6c 후속):
- dashboard widgets 4 file (executive-summary / Category / Budget /
  ai-action-inbox) — 6a-2
- 3 ai-assistant-panel (inventory / order / quote) + dashboard/page.tsx — 6a-3
- workbench / approval / sourcing / quotes dispatch — 6b
- lib (safety-visualization 등) + legacy _workbench — 6c
- 테스트 파일 — 의도적 swap 0 (sentinel pattern 보존)

Rollback path: git revert <SHA>
- 2 file (badge.tsx + Header.tsx) amber 복원 + 1 sentinel 삭제
- 사용자 영향: ~20+ Badge dot 위치 + 헤더 2 알림 amber/orange 회귀
- 다른 회귀 0 (component API / wiring / 다른 entry)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/ui/badge.tsx `
  apps/web/src/components/dashboard/Header.tsx `
  apps/web/src/__tests__/regression/badge-header-amber-removed-302d6a1.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-1-badge-header-amber.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-1-badge-header-amber.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 전체 Badge dot="amber" 위치 (~20+ 컴포넌트):
   - 색상 yellow tone 변경 확인 (시각 차이만, 동작 0)
   - 대표 위치: 재고 위험 배지 / 견적 상태 chip / 구매 상태 chip 등
3. labaxis.co.kr 헤더 알림 (Bell icon) dropdown:
   - "만료" 알림 색상 = yellow tint + yellow background
   - "안전" 알림 색상 = red tint + red background (위험 격상)
4. §11.308a-v2 ScanLine 진입점 + §11.295/§11.296 plain button 정상 동작
```
