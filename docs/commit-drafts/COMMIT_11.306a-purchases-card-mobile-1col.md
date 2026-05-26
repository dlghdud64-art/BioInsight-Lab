# §11.306a Commit Message Draft (구매 운영 카드 펼침 모바일 1컬럼)

```
fix(purchases): §11.306a #purchases-card-mobile-1col — 구매 운영 카드 펼침 시 모바일 1컬럼 세로 흐름 (md 이상 2컬럼 유지) — 호영님 P1 모바일 사용성

호영님 P1 spec (2026-05-26):
구매 운영 카드 (purchases/page.tsx) 가 §11.277c (모바일 2단계 접힘/펼침)
이후 모바일 펼침 시 좌측 본문 + 우측 사이드 정보 (결정보조정보/가격/
견적상세) 가 horizontal flex 유지 → 좌측 본문 152px 압축 (360px viewport
기준). 펼침 효용성 저하.

§11.306a Phase 0 evidence (sandbox 직접 audit):
1. purchases/page.tsx:786 `<div className="flex items-start gap-4">`
   (horizontal flex 만, responsive prefix 0)
2. purchases/page.tsx:879 우측 사이드
   `${isExpanded ? "flex" : "hidden"} sm:flex flex-col items-end gap-2
   flex-shrink-0 min-w-[160px]` (모바일에서도 160px 강제)
3. 360px viewport 펼침 계산:
   - 화면 360px - 우측 160px - gap-4(16px) - p-4(32px) = 좌측 152px
   - 좌측에 제목 + 본문 + 막힘/다음단계 grid 가 들어가야 함 → 압축

Fix (2 file, 3 line):

- apps/web/src/app/dashboard/purchases/page.tsx (2 line swap):
  · line 786: `flex items-start gap-4`
    → `flex flex-col sm:flex-row sm:items-start gap-4`
  · line 879: `... min-w-[160px]`
    → `... w-full sm:w-auto sm:min-w-[160px]`

- apps/web/src/__tests__/regression/
  purchases-card-expanded-mobile-1col-306a.test.ts (NEW, 11 it):
  · flex-col sm:flex-row 패턴 강제
  · w-full sm:w-auto sm:min-w-[160px] 패턴 강제
  · `className="flex items-start gap-4"` 단독 0 occurrence
  · `(?<!sm:)min-w-[160px]` 단독 0 occurrence
  · §11.277c 보존 (expandedCardIds / aria-expanded /
    isExpanded?flex:hidden sm:flex / sm:hidden toggle button /
    toggleCardExpand)
  · §11.284c 보존 (purchases-card-amount-supplier testid /
    grid-cols-1 sm:grid-cols-2)
  · 데스크탑 변화 0 보장 (sm:items-start / sm:flex flex-col items-end)

canonical truth 보존 (회귀 0):
- usePurchasesQuery / STATUS_MAP / DECISION_SUPPORT_STATUS_LABEL /
  BLOCKER_LABEL 변경 0
- §11.277c isExpanded state 변경 0
- §11.284c 본문 amount + supplier 1줄 변경 0
- §11.284d base status filter 변경 0
- §11.298e ActionMenu wiring 변경 0
- React Query invalidation 변경 0
- API / resolver / engine 변경 0

호영님 production effect:
1. 모바일 (360px) 카드 펼침 시:
   - 이전: 좌측 본문 152px 압축 (제목 wrap, 막힘/다음단계 grid 좁음)
   - 변경: 좌측 본문 ~328px (이전 대비 2.16x) + 우측 사이드 별도 row
2. 모바일 (375px) 카드 펼침 시:
   - 이전: 좌측 167px → 변경: ~343px
3. sm (640px+) / md (768px+) / lg (1024px+):
   - 데스크탑 변화 0 (sm:flex-row + sm:items-start 보존)
   - sm:min-w-[160px] 보존 → 우측 사이드 폭 변화 0
4. 카드 collapsed 기본 상태 변화 0 (우측 hidden 분기 보존)
5. 모바일 toggle button (sm:hidden) 동작 변화 0

§11.306 시리즈 진행:
- §11.306a ✅ 본 batch (구매 운영 카드 펼침 모바일 1컬럼, P1)
- §11.306b ⏳ 구매 운영 header "견적 보관함" 제거 (P2, 하단 탭바 중복)
- §11.306c ⏳ 재고 위험 배지 dot indicator 제거 (P2, §11.302d 연계)

Out of Scope (defer):
- §11.306b/c 별도 commit (호영님 Q2 = A: rollback 단위 분리)
- §11.277c isExpanded state 변경 (보존)
- §11.302d 신호등 토큰 변경 (보존)
- 견적 관리 (dashboard/quotes) 모바일 정합 — §11.307 별도 batch

Rollback path: git revert <SHA>
- 2 file 복원 (1 production code + 1 sentinel test)
- 모바일 펼침 시 좌측 152px 압축 회귀
```

## Push

```powershell
git add `
  apps/web/src/app/dashboard/purchases/page.tsx `
  apps/web/src/__tests__/regression/purchases-card-expanded-mobile-1col-306a.test.ts `
  docs/plans/PLAN_11.306-mobile-ux-consolidation.md `
  docs/commit-drafts/COMMIT_11.306a-purchases-card-mobile-1col.md

git commit -F docs/commit-drafts/COMMIT_11.306a-purchases-card-mobile-1col.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. 모바일 (실기기 또는 DevTools 360~414px) labaxis.co.kr/dashboard/purchases:
   - 카드 "더 보기" 탭 → 본문 + 우측 사이드 정보 위→아래 stack
   - 좌측 본문 가독성 회복 (제목 wrap 0 또는 1줄로 깔끔)
3. sm+ (640px+) 좌우 row 유지 (데스크탑 변화 0)
4. lg (1024px+) 변화 0 — KPI 4-card / queue / rail 시각 동일
5. 카드 collapsed 기본 상태 우측 hidden 유지

## 후속 batch

| § | scope | 우선도 |
|---|---|---|
| §11.306b | 구매 운영 header "견적 보관함" Link 제거 (하단 탭바 중복) | P2 |
| §11.306c | 재고 위험 배지 dot indicator 제거 (옵션 A, §11.302d 연계) | P2 |
| §11.307 | 견적 관리 (quotes) 모바일 3건 — 스캔 명칭 + 드롭다운 짤림 + 버튼 순서 | P1 (신규) |
| §11.305-phase6 | release-prep P1 closeout (Batch 10 readiness gate) | Phase 5 완료 후 |
