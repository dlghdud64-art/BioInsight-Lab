# §11.308a-v2 Commit Message Draft (스마트 입고 진입점 헤더 승격)

```
feat(receiving): §11.308a-v2 #header-smart-receiving — 스마트 입고 진입점 글로벌 헤더 승격 (호영님 P0 2026-05-26) — 대시보드 본문에서 글로벌 헤더로 이동, 어느 페이지에서든 1탭 접근

호영님 P0 spec (2026-05-26):
스마트 입고 = 글로벌 액션 (검색 / 알림과 동일 레벨). 대시보드 본문
배치 시 다른 페이지(견적/구매/재고) → 대시보드 이동 → 스캔 button 의
2단계 낭비 + 온보딩 위젯 아래에 묻혀 가시성 ↓. 글로벌 헤더로 승격
하면 어디서든 1탭으로 스마트 입고 진입.

§11.308a (v1) 후속 — 진입점 위치만 swap, SmartReceivingPlaceholderModal
컴포넌트 + 재고 탭 진입점은 보존.

Fix (3 file 수정 + 1 NEW sentinel):

- apps/web/src/components/dashboard/Header.tsx:
  · lucide-react import 에 `ScanLine` 추가
  · SmartReceivingPlaceholderModal import 추가
  · useState `isSmartReceivingOpen` 추가 (line 102 근처, 다른 dropdown
    state 옆 — Notification / Help / Profile 패턴 정합)
  · ScanLine button 신규 — Search/BarcodeScanFab 직후 + Bell 직전 위치
    (호영님 spec "검색과 알림 사이")
    - data-testid="header-smart-receiving-entry"
    - aria-label="스마트 입고"
    - h-10 w-10 md:h-9 md:w-9 (모바일 44px 터치 영역 보장)
    - hover:text-emerald-600 + hover:bg-emerald-50 (스캔 = emerald tint)
  · <SmartReceivingPlaceholderModal /> 렌더 — </header> 직전
  · §11.276 BarcodeScanFab env-gated 보존 (production null)

- apps/web/src/app/dashboard/page.tsx:
  · lucide-react import 에서 `ScanLine` 제거 (다른 사용처 0)
  · SmartReceivingPlaceholderModal import 제거 + §11.308a-v2 주석
  · useState `isSmartReceivingOpen` 제거 (Header.tsx 로 이동)
  · 헤더 우측 본문 ScanLine button 블록 통째 제거 +
    "AI 리포트 button 위에 위치" 안내 주석 → §11.308a-v2 주석으로 swap
  · <SmartReceivingPlaceholderModal /> 렌더 제거
  · AIInsightDialog 변경 0 (§11.243 isOnboardingMode 분기 보존)

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · 변경 0 — 재고 탭 진입점 (mobile + desktop 2 button + Modal) 보존
  · 호영님 spec: "글로벌 헤더 = 어디서든 바로, 재고 탭 = 재고 관리 맥락"

- apps/web/src/__tests__/regression/
  header-smart-receiving-308a-v2.test.ts (NEW, 19 it):
  · Header.tsx 6 it (ScanLine import / Modal import / state /
    button (testid + aria + ScanLine icon + setIsSmartReceivingOpen) /
    Modal 렌더 / 터치 영역 44px)
  · dashboard/page.tsx 5 it (ScanLine import 0 / Modal import 0 /
    state 0 / dashboard-smart-receiving-entry testid 0 /
    AIInsightDialog 보존)
  · inventory-main.tsx 4 it (mobile + desktop testid 보존 /
    Modal 렌더 보존 / state 보존)
  · SmartReceivingPlaceholderModal 1 it (file 변경 0)
  · Header 회귀 0 4 it (Bell / Search / BarcodeScanFab / CommandPalette)

canonical truth 보존 (회귀 0):
- SmartReceivingPlaceholderModal 컴포넌트 변경 0 (§11.308a v1 그대로)
- 재고 탭 진입점 (inventory-main.tsx mobile + desktop 2 button) 변경 0
- §11.243 OnboardingHero / isOnboardingMode 분기 변경 0
- §11.276 BarcodeScanFab production env-gate 보존
- §11.295 Header 도움말 + 프로필 plain dropdown 보존
- §11.296 Header 알림 plain dropdown 보존
- §11.271 BarcodeScanFab inline mount 위치 보존
- AIInsightDialog 동작 변경 0

호영님 production effect:
1. labaxis.co.kr (모든 페이지) 글로벌 헤더 우측:
   - [🔍 검색 (모바일)] [BarcodeScanFab (dev 만)] [📷 스마트 입고 NEW]
     [🔔 알림] [HelpCircle 도움말 (데스크탑)] [Profile] [≡ 메뉴 (모바일)]
2. /dashboard 본문: 스마트 입고 button 제거 → AI 리포트만 우측 노출
3. /dashboard/inventory 모바일 + 데스크탑 헤더: 재고 등록 옆
   [📷 스마트 입고] 진입점 보존 (재고 관리 맥락)
4. 모바일 (375px) 헤더 아이콘 4개 (검색/스캔/알림/메뉴) — viewport
   충분 (호영님 spec 검증: 4 × 52px + 로고 ~120px = 328px / 375px)
5. backend 미구현 — placeholder modal "곧 제공 예정" + 수동 입고 fallback
   (§11.308a 동일 동작)

호영님 사용자 시나리오:
- 견적 페이지 → 물건 도착 → 헤더 📷 탭 → 즉시 스캔 (이전: 대시보드
  이동 → 본문 button 찾기 = 2단계, 변경: 헤더 1탭 = 1단계)

Out of Scope:
- 하단 탭바 "스캔" 전용 탭 (호영님 Q10 = C 후속 batch)
- BarcodeScanFab 와 ScanLine 의미 분리 명확화 (BarcodeScanFab = 바코드
  라벨, ScanLine = 거래명세서 OCR, production env 다름)
- 글로벌 헤더 외 다른 페이지 본문 진입점 추가 (재고 탭 만 별도 유지)

Rollback path: git revert <SHA>
- 4 file 복원 — 헤더 button 제거 + 대시보드 본문 button + state + Modal 복원
- 회귀 = 대시보드 본문에 스마트 입고 button 재노출 (다른 페이지에서 접근 불가)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/Header.tsx `
  apps/web/src/app/dashboard/page.tsx `
  apps/web/src/__tests__/regression/header-smart-receiving-308a-v2.test.ts `
  docs/commit-drafts/COMMIT_11.308a-v2-header-smart-receiving.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.308a-v2-header-smart-receiving.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS
2. 모든 페이지 글로벌 헤더 우측:
   - [📷 스마트 입고] 신규 button 노출 (검색~알림 사이)
   - hover emerald tint
   - 탭 → SmartReceivingPlaceholderModal "곧 제공 예정" + 수동 fallback
3. /dashboard 본문:
   - 스마트 입고 button 0 (제거 확인)
   - AI 리포트 button 만 우측 노출
4. /dashboard/inventory:
   - mobile + desktop 헤더 [📷 스마트 입고] 진입점 보존
5. 모바일 (375px) 헤더 아이콘 짤림 0
6. §11.243 OnboardingHero / §11.276 BarcodeScanFab production gate /
   §11.295/§11.296 dropdown plain pattern 회귀 0
```
