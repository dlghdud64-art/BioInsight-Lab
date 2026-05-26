# §11.306b Commit Message Draft (구매 운영 견적 보관함 header CTA 제거)

```
chore(purchases): §11.306b #purchases-header-quotes-archive-removed — header "견적 보관함" Link 제거 (하단 탭바 중복 단순화, 호영님 P2 2026-05-26)

호영님 P2 spec (2026-05-26):
구매 운영 헤더 우측 "견적 보관함" Button 이 하단 탭바 /dashboard/quotes
와 중복. header CTA 단순화 — "소싱" 1개만 남김. 하단 탭바 wiring 보존
으로 사용자 접근 경로 회귀 0.

Fix (1 file 5 line 제거 + 1 NEW sentinel):

- apps/web/src/app/dashboard/purchases/page.tsx (line 536-540 제거):
  · <Link href="/dashboard/quotes"> wrapper 제거
  · <Button> "견적 보관함" 제거
  · <FileText> icon 제거 (단 import 는 보존 — line 886 "회신" 카드 +
    line 1399 다른 위치 사용)
  · §11.306b 주석 추가 (제거 근거 명시)

- apps/web/src/__tests__/regression/
  purchases-header-quotes-archive-removed-306b.test.ts (NEW, 7 it):
  · "견적 보관함" literal 0 occurrence
  · header Link href=/dashboard/quotes + FileText icon 패턴 0
  · "소싱" Link (/app/search + Search icon) 보존
  · FileText import 보존 (line 886 "회신 N/M" 다른 사용처)
  · "일괄 발주 전환" header CTA (ready_for_po > 0) 보존
  · §11.277c isExpanded toggle 보존
  · §11.306a flex-col sm:flex-row 보존 (회귀 0)

canonical truth 보존 (회귀 0):
- 하단 탭바 /dashboard/quotes wiring 보존 (별도 컴포넌트, 본 file 외부)
- FileText import + 다른 사용처 변경 0
- "소싱" Link CTA 보존
- "일괄 발주 전환" header CTA (stats.ready_for_po > 0 분기) 보존
- §11.277c isExpanded toggle 변경 0
- §11.306a flex-col sm:flex-row + w-full sm:min-w-[160px] 변경 0
- usePurchasesQuery / STATUS_MAP / BLOCKER_LABEL 변경 0

호영님 production effect:
1. labaxis.co.kr/dashboard/purchases header:
   - 이전: [🔍 소싱] [📄 견적 보관함] [+ 일괄 발주 전환?]
   - 변경: [🔍 소싱] [+ 일괄 발주 전환?]
2. 하단 탭바 "견적 관리" /dashboard/quotes 동작 변화 0
3. header 시각 단순화 — 사용자 인지 부담 ↓
4. 데스크탑 / 모바일 모두 동일 효과

Out of Scope:
- 하단 탭바 reorder (호영님 Q10 = C 후속)
- §11.306c 재고 dot indicator (P2, 별도 batch)
- §11.306a 보존 (Vercel READY 완료 — 회귀 sentinel 강제)

Rollback path: git revert <SHA>
- 1 file (purchases/page.tsx) + 1 sentinel 복원
- header "견적 보관함" CTA 회귀
```

## Push

```powershell
git add `
  apps/web/src/app/dashboard/purchases/page.tsx `
  apps/web/src/__tests__/regression/purchases-header-quotes-archive-removed-306b.test.ts `
  docs/commit-drafts/COMMIT_11.306b-purchases-header-quotes-archive.md

git commit -F docs/commit-drafts/COMMIT_11.306b-purchases-header-quotes-archive.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. labaxis.co.kr/dashboard/purchases header:
   - "견적 보관함" CTA 0 occurrence
   - "소싱" CTA 1개만 남음 (정합)
   - "일괄 발주 전환" CTA 는 stats.ready_for_po > 0 시 노출
3. 하단 탭바 "견적 관리" 클릭 → /dashboard/quotes 정상 이동 (회귀 0)
4. §11.306a (carded 펼침 모바일 1컬럼) 회귀 0
