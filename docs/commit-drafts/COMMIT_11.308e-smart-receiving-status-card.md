feat(dashboard): §11.308e #smart-receiving-status-card — 대시보드 본문 awareness + status 카드 신설 (호영님 P2 옵션 B 경량, 2026-05-28)

호영님 P2 옵션 B (경량, 새 API 0) — §11.308 시리즈의 마지막 보류분 정리.

배경:
- §11.308a-v2 (호영님 P0, 완료) 가 스마트 입고 진입을 글로벌 Header(ScanLine
  button)로 승격하면서 대시보드 본문의 진입 button 이 제거됨.
- 결과: 운영자가 Header 의 작은 ScanLine button 을 놓치거나 기능 존재를 인지
  못 할 위험. backend(§11.309c) 와 modal(§11.309d) 은 갖췄으나 본문 awareness 부재.

해결 (옵션 B 경량 — 새 API 0, 기존 stats forward):
- 대시보드 본문에 awareness + at-a-glance status 카드 추가
- 진입 button 신설 0 (Header 단일 source 보존, 중복 진입 anti-pattern 방지)
- 안내 문구로 "헤더 [스마트 입고] 버튼" 위치/역할을 본문에서 가르침

Fix (1 new component + 1 wiring + 1 sentinel):

- apps/web/src/components/dashboard/SmartReceivingStatusCard.tsx (NEW):
  · Props: { pendingHandoffCount: number } (display-only)
  · Layout: 모바일 col / 데스크탑 row flex, p-3 md:p-4 (§11.311 mobile pattern 정합)
  · 아이콘: ScanLine + bg-emerald-50/text-emerald-600 (Header hover 톤 정합)
  · 처리 대기 badge: 1+건 = bg-yellow-100 text-yellow-700 (긴급/주의),
    0건 = bg-emerald-50 text-emerald-700 (정상). §11.302 신호등 정합.
  · 안내 문구: "상단 헤더 [스마트 입고] 버튼으로 스캔 → AI 가 OCR 추출·품목
    매칭 → 재고에 자동 반영됩니다" (Header awareness)
  · 단일 CTA: "입고 큐 열기" → /dashboard/purchase-orders?bucket=handoff
    (real route, 항상 활성, dead button 0)
  · 카드 안 스캐너 modal/스캔 button 신설 0 (Header 단일 source)
  · 새 API 호출 0, useState/useEffect/fetch 0 (옵션 B 경량 display-only)
  · amber/orange Tailwind class 0 (§11.302d-6 정합)

- apps/web/src/app/dashboard/page.tsx:
  · import { SmartReceivingStatusCard } from "@/components/dashboard/SmartReceivingStatusCard"
  · <OperatorQuickActions /> 직후, "3상태 중앙 패널" 직전 wiring
  · pendingHandoffCount={stats.compareStats.purchaseToReceivingCount}
    (canonical truth — mutation 0, display forward only)

- apps/web/src/__tests__/regression/
  smart-receiving-status-card-308e.test.ts (NEW, ~8 it):
  · 컴포넌트: props + 3 testid + yellow/emerald 분기 + ScanLine + emerald + 안내 + CTA
  · canonical truth 가드: 스캐너 modal/스캔 button/API 호출/useState 0
  · amber/orange 0
  · 페이지 wiring: import + OperatorQuickActions 직후 정확 위치 + count source 정합

canonical truth 보존 (회귀 0):
- 카드 = display-only (count forward, mutation 0)
- 스캔 truth = Header SmartReceivingScannerModal 단일 source (중복 진입 0)
- CTA = real route (/dashboard/purchase-orders?bucket=handoff) — dead button 0
- 다른 카드/3상태 패널/sidebar 영향 0

호영님 production effect:
1. 대시보드 본문에 "스마트 입고" 카드 1줄 추가 (OperatorQuickActions 직하).
2. 처리 대기 N건 KPI + 헤더 button 안내 + 입고 큐 진입 1버튼.
3. 헤더 ScanLine button 의 위치/역할이 본문에서 학습됨 (awareness↑).

Out of Scope (⚠️ 본 batch 미포함):
- OCR 대기 job/최근 처리 trend 가시화 (옵션 A — 새 API 필요, 후속)
- Header SmartReceivingScannerModal 직접 진입(중복 anti-pattern, 의도적 미포함)
- /dashboard/purchase-orders?bucket=handoff 자체 UX (별도)

검증 (sandbox, vitest 미설치 → 정적):
- 컴포넌트 amber 0 / testid 3 / 안내 + CTA + ScanLine + emerald 톤 ✓
- page.tsx import + wiring + count source ✓
- 인접성 단언/snapshot 가진 기존 test 없음 (회귀 충돌 0)

Rollback path: git revert <SHA>
- 컴포넌트/sentinel/import/wiring 모두 단일 commit 으로 제거

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/dashboard/SmartReceivingStatusCard.tsx `
  apps/web/src/app/dashboard/page.tsx `
  apps/web/src/__tests__/regression/smart-receiving-status-card-308e.test.ts `
  docs/commit-drafts/COMMIT_11.308e-smart-receiving-status-card.md
git status
git commit -F docs/commit-drafts/COMMIT_11.308e-smart-receiving-status-card.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard 진입 → "운영 바로가기" 4 카드 아래에 "스마트 입고" 카드 1줄 노출
3. 처리 대기 N건 = OperatorQuickActions "입고 처리" count 와 동일 (canonical truth)
4. 0건이면 emerald badge "처리 대기 0건" 정상 노출
5. "입고 큐 열기" → /dashboard/purchase-orders?bucket=handoff 이동 확인
6. 안내 문구 "상단 헤더 [스마트 입고] 버튼…" 노출 확인
