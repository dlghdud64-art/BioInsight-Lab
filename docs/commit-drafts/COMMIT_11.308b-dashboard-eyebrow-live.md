# §11.308b Commit Message Draft (대시보드 영문 라벨 제거)

```
chore(dashboard): §11.308b #dashboard-eyebrow-live-removed — "Operational Intelligence Dashboard" eyebrow + "Live" 배지 완전 제거 (호영님 Q11 = A, 2026-05-26)

호영님 P2 spec (Q11 = A, 2026-05-26):
대시보드 헤더의 영문 eyebrow + Live 배지 = 사용자 무의미.
- "Operational Intelligence Dashboard" 영문 → 사용자 (시약 담당자, QC
  실무자) 가 모르는 개발 용어
- "Live" 배지 (animate-ping pulse) → 대시보드는 원래 실시간, 별도 표기 불필요

→ 헤더 단순화: 한국어 "대시보드" title + greeting 만.

§11.308 시리즈 진행:
- §11.308a ✅ 스마트 입고 진입점 (대시보드 + 재고, P1)
- §11.308a-v2 ✅ 스마트 입고 헤더 승격 (P0)
- §11.308b ✅ 본 batch (영문 라벨 제거, P2)
- §11.308c (호영님 Q12 = A "현재 동작 유지") — 작업 0
- §11.308d (대시보드 빠른 액션 영역) — 후속

Fix (1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/dashboard/page.tsx:
  · eyebrow <p> 통째 제거 (line 558-561):
    - "Operational Intelligence Dashboard" 영문
    - emerald dot pulse 인디케이터
    - tracking-[0.12em] uppercase 폰트 스타일
  · "Live" 배지 <span> 통째 제거 (line 566-572):
    - bg-emerald-50 text-emerald-700 border border-emerald-200/60
    - animate-ping pulse 효과 (h-1.5 w-1.5 rounded-full bg-emerald-400)
    - "Live" 텍스트
  · h2 title 직접 자식 (이전 <div className="flex items-center gap-2.5"> 안)
    → <h2 text-2xl md:text-[28px] font-black tracking-tighter text-slate-900>
       대시보드
       </h2> 단독 직접 노출
  · 주석 §11.308b 업데이트 (제거 근거 + 호영님 Q11 = A 명시)

- apps/web/src/__tests__/regression/
  dashboard-eyebrow-live-removed-308b.test.ts (NEW, ~11 it):
  · 제거 4 it ("Operational Intelligence Dashboard" 0 / eyebrow <p> 0 /
    "Live" 배지 textContent 0 / animate-ping pulse 0)
  · 보존 3 it ('대시보드' h2 / 폰트 클래스 / greeting)
  · 회귀 0 4 it (§11.243 isOnboardingMode + OnboardingHero /
    AIInsightDialog / SmartReceivingScannerModal 0 / PlanOnboardingBanner)

canonical truth 보존 (회귀 0):
- §11.243 isOnboardingMode / OnboardingHero / AIInsightDialog 분기 변경 0
- §11.308a-v2 Header SmartReceivingScannerModal 진입점 변경 0 (이미 헤더 승격)
- §11.252d-1 onboardingDismissed localStorage persist 변경 0
- §11.82 AIInsightDialog real API 호출 변경 0
- 다른 widget (ExecutiveSummarySection / SpendTrendCard 등) 변경 0
- React Query / store / mutation 변경 0
- session / authenticatedUser 패턴 변경 0

호영님 production effect:
1. labaxis.co.kr/dashboard 헤더:
   - 이전: "● OPERATIONAL INTELLIGENCE DASHBOARD" + "대시보드 ● Live"
   - 변경: "대시보드" 단독 (한국어 title 만)
   - greeting (사용자명 + 처리 항목 N건 안내) 그대로
2. 영문 인지 부담 0 — 시약 담당자/QC 실무자 친화
3. animate-ping pulse 효과 제거 — 시각 노이즈 감소
4. 데스크탑 / 모바일 동일 효과

Out of Scope:
- §11.308c 온보딩 위젯 변경 (호영님 Q12 = A "현재 동작 유지" — 작업 0)
- §11.308d 빠른 액션 영역 신규 (후속 별도 batch)
- 다른 페이지 영문 eyebrow / Live 배지 (settings / billing 등 — 후속)

Rollback path: git revert <SHA>
- 1 file (dashboard/page.tsx) + 1 sentinel 복원
- eyebrow + Live 배지 회귀 (영문 인지 부담 + pulse 노이즈 재발)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/page.tsx `
  apps/web/src/__tests__/regression/dashboard-eyebrow-live-removed-308b.test.ts `
  docs/commit-drafts/COMMIT_11.308b-dashboard-eyebrow-live.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.308b-dashboard-eyebrow-live.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard 헤더:
   - "Operational Intelligence Dashboard" 영문 0
   - "Live" 배지 0 (animate-ping 효과 0)
   - "대시보드" 한국어 title 단독 노출
   - greeting (사용자명 + N건 안내) 그대로
3. §11.243 OnboardingHero / AIInsightDialog 변화 0
4. §11.308a-v2 Header ScanLine 진입점 변화 0 (헤더 별도 컴포넌트)
```
