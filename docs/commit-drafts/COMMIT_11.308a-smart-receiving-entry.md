# §11.308a Commit Message Draft (스마트 입고 진입점)

```
feat(receiving): §11.308a #smart-receiving-entry — 스마트 입고 placeholder modal + 대시보드/재고 진입점 (호영님 P1 2026-05-26)

호영님 P1 spec (2026-05-26):
거래명세서 OCR + LLM 구조화 + PO 매칭 backend 미구현 상태에서 진입점
먼저 배치. dead button 회피 — placeholder 모달 + 수동 입고
(/dashboard/receiving) fallback CTA.

호영님 결정:
  Q8 = A (placeholder + 수동 fallback)
  Q9 = A (대시보드 + 재고 양쪽)
  Q10 = C (하단 탭바는 후속)
  Q13 = A (§11.308a 먼저, P2 후속)

Fix (3 file 추가/수정 + 1 NEW sentinel):

- apps/web/src/components/inventory/SmartReceivingPlaceholderModal.tsx
  (NEW, ~120 line):
  · Dialog 기반 placeholder modal
  · 헤더 "스마트 입고" + ScanLine icon + "곧 제공 예정" 배지
  · 본문: Phase 1 OCR / Phase 2 AI 구조화 / Phase 3 PO 매칭 + 입고 확정 안내
  · CTA: [수동으로 입고 처리하기] → router.push("/dashboard/receiving")
  · CTA: [닫기] → onClose()
  · 터치 영역 ≥ 44px (모바일 a11y)
  · dead button 0 — 모든 CTA 가 real handler wiring

- apps/web/src/app/dashboard/page.tsx:
  · lucide-react import 에 `ScanLine` 추가
  · SmartReceivingPlaceholderModal import 추가
  · useState `isSmartReceivingOpen` 추가 (line 145 근처)
  · 헤더 우측 (AIInsightDialog 옆) ScanLine 진입점 button 추가
    (data-testid="dashboard-smart-receiving-entry",
     min-h-[44px] + emerald-600)
  · <SmartReceivingPlaceholderModal open onClose /> 렌더 (헤더 컨테이너 직후)
  · §11.243 isOnboardingMode / OnboardingHero 분기 보존

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · lucide-react import 에 `ScanLine` 추가
  · SmartReceivingPlaceholderModal import 추가
  · useState `isSmartReceivingOpen` 추가 (state 1회, mobile/desktop 공유)
  · Mobile view (md:hidden, line 991~) "재고 등록" 옆 진입점 button
    (data-testid="inventory-smart-receiving-entry-mobile",
     min-h-[44px] + emerald-600)
  · Desktop view (md+, line 1069~) "재고 등록" 옆 진입점 button
    (data-testid="inventory-smart-receiving-entry-desktop",
     emerald-600)
  · <SmartReceivingPlaceholderModal open onClose /> 렌더 (mobile view 직후,
    mobile + desktop 공통)
  · §11.297c ActionMenu (재고 utility menu) 보존
  · "재고 등록" + "입고 반영" button 변경 0

- apps/web/src/__tests__/regression/
  smart-receiving-entry-308a.test.ts (NEW, 18 it):
  · SmartReceivingPlaceholderModal — file 존재 + export +
    "곧 제공 예정" + 거래명세서/OCR 안내 + 수동 CTA + 닫기 CTA +
    터치 영역 44px + ScanLine icon
  · dashboard/page.tsx — ScanLine import + Modal import +
    isSmartReceivingOpen state + button testid + setIsSmartReceivingOpen(true) +
    Modal 렌더 정합
  · inventory-main.tsx — ScanLine + Modal import + state 1회 +
    mobile/desktop testid 2건 + setIsSmartReceivingOpen(true) ≥ 2회 +
    Modal 렌더 1회
  · 회귀 0 — OnboardingHero (isOnboardingMode && !onboardingDismissed) +
    ActionMenu (menuId="inv-utility-mobile") + "재고 등록"/"입고 반영" 보존

canonical truth 보존 (회귀 0):
- §11.243 isOnboardingMode / OnboardingHero 분기 보존
- §11.297c ActionMenu (재고 utility) 보존
- "재고 등록" / "입고 반영" / 라벨 인쇄 / 엑셀 업로드 / QR 스캔 변경 0
- AIInsightDialog 동작 변경 0
- backend mutation / API / resolver 호출 0 (placeholder 만)
- §11.302d 신호등 토큰 변경 0
- React Query invalidation 변경 0

호영님 production effect:
1. 대시보드 (모든 viewport):
   - 헤더 우측 [📷 스마트 입고] (emerald) + AI 리포트 (기존)
   - 탭 → placeholder 모달 "스마트 입고 (곧 제공 예정)" + Phase 1/2/3 안내
   - [수동으로 입고 처리하기] → /dashboard/receiving 이동
2. 재고 페이지 (mobile + desktop):
   - "재고 등록" 옆 [📷 스마트 입고] (emerald) 추가
   - 동일 placeholder 모달 노출
3. 모바일 (375px) 현장 시나리오:
   - 물건 도착 → 재고 탭 진입 → [📷 스마트 입고] 탭 → modal
   - "곧 제공 예정" 안내 + 수동 입고 fallback 으로 dead button 0
4. backend (Phase 1~3) 구현 시 placeholder modal 만 실제 카메라/OCR/AI
   흐름 으로 swap — 진입점 / state wiring 그대로 재사용 가능

Out of Scope (defer):
- 실제 OCR / LLM / PO 매칭 backend (별도 batch, §11.309+)
- §11.308b 영문 라벨 제거 (P2, 후속)
- §11.308c 온보딩 위젯 변경 (호영님 Q12 = A 현재 동작 유지)
- §11.308d 대시보드 빠른 액션 영역 신규 (P2, 후속)
- §11.306b/c (재고 dot, 견적 보관함, P2)
- 하단 탭바 "스캔" 전용 탭 (호영님 Q10 = C 후속)

Rollback path: git revert <SHA>
- 4 file (modal NEW + dashboard + inventory-main + sentinel) 복원
- 진입점 button + modal 회귀 (사용자 영향 — 스마트 입고 진입점 0)

§11.308 시리즈 진행:
- §11.308a ✅ 본 batch (스마트 입고 진입점 P1)
- §11.308b ⏳ 영문 라벨 제거 (P2, dashboard/page.tsx eyebrow + Live 배지)
- §11.308c ⏳ 온보딩 위젯 (호영님 Q12 = A 현재 동작 유지, 변경 없음 가능성)
- §11.308d ⏳ 대시보드 빠른 액션 영역 (P2)
- §11.306b/c ⏳ 재고 dot + 견적 보관함 (P2)
- §11.309 ⏳ 스마트 입고 backend MVP (P0, 호영님 ~12영업일 spec)
```

## Push

```powershell
git add `
  apps/web/src/components/inventory/SmartReceivingPlaceholderModal.tsx `
  apps/web/src/app/dashboard/page.tsx `
  apps/web/src/app/dashboard/inventory/inventory-main.tsx `
  apps/web/src/__tests__/regression/smart-receiving-entry-308a.test.ts `
  docs/plans/PLAN_11.308a-smart-receiving-entry.md `
  docs/commit-drafts/COMMIT_11.308a-smart-receiving-entry.md

git commit -F docs/commit-drafts/COMMIT_11.308a-smart-receiving-entry.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/dashboard:
   - 헤더 우측 [📷 스마트 입고] (emerald) 노출
   - 탭 → modal 열림 + "곧 제공 예정" + Phase 1/2/3 안내
   - [수동으로 입고 처리하기] → /dashboard/receiving 이동
   - [닫기] → modal close
3. labaxis.co.kr/dashboard/inventory:
   - mobile (375px): "재고 등록" 옆 [📷 스마트 입고] 노출
   - desktop (md+): "재고 등록" 옆 [📷 스마트 입고] 노출
   - 양쪽 모두 같은 modal 열림
4. §11.243 OnboardingHero 동작 변경 0
5. §11.297c ActionMenu (재고 utility) 동작 변경 0
```
