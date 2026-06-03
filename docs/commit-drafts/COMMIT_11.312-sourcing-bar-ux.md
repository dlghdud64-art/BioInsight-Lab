# §11.312 Commit Message Draft (소싱 sticky bar UX)

```
feat(sourcing): §11.312 #sourcing-bar-ux — sticky bar 개별 삭제 + 검토 배지 dead button 해소 + 미리보기 텍스트 + amber→yellow (호영님 P1 2026-05-26)

호영님 P1 spec (2026-05-26) — 호영님 spec § 번호 §11.306 → §11.312 부여
(기존 §11.306 = 모바일 UX a/b/c 충돌 회피).

§11.312 3건 통합 batch:
  A) 개별 ✕ 삭제 부재 — 비교/견적 bar 의 🗑 휴지통은 일괄 삭제만 가능
  B) ⚠ 검토 N 배지 dead button — 탭해도 아무 반응 없음
  C) bar 정보 부족 — "2" 만 표시, 어떤 항목인지 확인 불가

호영님 결정:
  - 미리보기 텍스트: 첫 항목명 truncate + 숫자 배지
  - 🗑 휴지통: sheet 내 "전체 삭제"로 통합 (bar 깔끔)
  - 색상: amber → yellow (§11.302 체계)

Fix (2 file 신규 + 1 file 수정 + 1 NEW sentinel):

- apps/web/src/components/sourcing/SourcingCandidatesSheet.tsx (NEW, ~340 line):
  · Sheet (shadcn) 기반 — side="bottom" + max-h-[80vh]
  · 3 mode 통합 (compare / quote / review) — props 분기
  · compare mode: products lookup (compareIds → name/brand/category/price)
  · quote mode: quoteItems + reviewReason flag (yellow-100 배경)
  · review mode: reviewReason 있는 quoteItems 만 필터
    - 사유 + 안내문 + [재고 확인] / [그래도 견적에 유지] 액션
    - [재고 확인] → router.push("/dashboard/inventory?search=<productName>")
    - [그래도 유지] → onClearReviewFlag (toggleCompare 로 review_required 해소)
  · 각 행 ✕ 개별 삭제 (candidate-remove-cta testid)
  · 전체 삭제 (candidates-clear-all testid) — window.confirm 후 호출
  · §11.302 색상 (yellow-100 / yellow-700 / emerald-600 / blue-600, amber 0)

- apps/web/src/app/_workbench/search/page.tsx (state + bar wiring + sheet 렌더):
  · import SourcingCandidatesSheet
  · useState candidatesSheetMode ("compare" | "quote" | "review" | null)
  · 비교 bar (line 1459~): "비교 N" 영역 → button
    (data-testid="sourcing-bar-compare-open", onClick setCandidatesSheetMode("compare"))
    + 첫 항목명 truncate 미리보기 (hidden sm:inline, max-w-[140px])
  · 견적 bar (line 1485~): "견적 N" 영역 → button
    (data-testid="sourcing-bar-quote-open", onClick setCandidatesSheetMode("quote"))
    + 첫 항목명 truncate 미리보기
  · ⚠ 검토 N 배지: span → button
    (data-testid="sourcing-bar-review-open", onClick setCandidatesSheetMode("review"))
    + amber-50/amber-600 → yellow-100/yellow-700 (호영님 spec)
  · "2개 이상 필요" 경고: text-amber-500 → text-yellow-500
  · 차단 N 배지: bg-red-600/10 text-red-500 → bg-red-100 text-red-700
  · 🗑 휴지통 button 2개 제거 (비교/견적 bar)
    — sheet 내 "전체 삭제" 통합 + 우측 "전체 해제" 링크 보존
  · <SourcingCandidatesSheet> 렌더 (page return 끝쪽):
    - quoteItems 매핑 → CandidateQuoteItem shape (productName/brand/catalogNumber
      /category/price/reviewReason/isBlocked) — products + requestReadiness.candidates
      에서 review flag detail 추출
    - onRemoveCompare = toggleCompare(productId) (개별 토글 = 제거 effect)
    - onClearReviewFlag = toggleCompare 로 compareIds 에서 제거 (review_required 해소)
    - onCompareReview = handleProtectedAction(() => setComparisonModalOpen(true))
    - onQuoteRequest = handleProtectedAction (requestHandoff 분기 보존)

- apps/web/src/__tests__/regression/sourcing-bar-ux-312.test.ts (NEW, 21 it):
  · Sheet 컴포넌트 7 it (file 존재 / export + 3 mode / 개별 삭제 testid /
    window.confirm / Review 액션 2 testid + /dashboard/inventory?search= /
    Review 사유 노출 / §11.302 yellow 정합 + amber 0)
  · search wiring 8 it (import / state / 3 bar button testid /
    amber→yellow swap / 🗑 제거 / Sheet 렌더 props / 미리보기 truncate)
  · 회귀 0 6 it (2-row 분기 / divider border-white/20 / requestHandoff 분기 /
    totalAmount / 전체 해제 / setComparisonModalOpen+setRequestWizardOpen)

canonical truth 보존 (회귀 0):
- §11.252f 2-row 구조 (compareIds.length > 0 + quoteItems.length > 0) 보존
- §11.268c divider border-white/20 opacity 보존
- requestReadiness / calculateRequestReadiness 변경 0 (review flag 추출만 추가)
- toggleCompare / clearCompare / removeQuoteItem / updateQuoteItem helper 변경 0
- CompareReviewWorkWindow / RequestReviewWindow / CompareReviewWindow wiring 변경 0
- setComparisonModalOpen / setRequestWizardOpen / setWorkWindowMode 변경 0
- totalAmount / requestHandoff 분기 변경 0
- "전체 해제" 우측 텍스트 링크 보존

호영님 production effect:
1. labaxis.co.kr/app/search (검색 후 비교/견적 후보 담은 상태):
   - 비교 bar "비교 N 첫항목명..." 탭 → sheet (각 항목 ✕ 개별 삭제)
   - 견적 bar "견적 N 첫항목명..." 탭 → sheet (개별 삭제 + 검토/차단 배지)
   - ⚠ 검토 N (yellow) 탭 → review sheet (사유 + [재고 확인] + [그래도 유지])
2. 🗑 휴지통 button 제거 — bar 시각 단순화
3. 모바일 (375px) bar overflow 0 (미리보기 hidden sm:inline)
4. §11.302 색상 정합 (yellow 신호등) — amber 사용 0 (이 bar 한정)

호영님 시나리오:
- 비교 후보 2개 중 1개만 빼고 싶을 때:
  → "비교 2" 탭 → sheet → 빼고 싶은 항목 ✕ → 즉시 갱신
- 검토 필요 2건이 뭔지 알고 싶을 때:
  → "⚠ 검토 2" (yellow) 탭 → review sheet → 사유 + [재고 확인] / [유지]

Out of Scope (defer):
- 다른 페이지 amber 사용처 정리 (별도 batch §11.302d-6, 호영님 Q33 결정)
- bar 미리보기 = 2개 이상일 때 ", +N" 표시 (현재 첫 항목명 + 숫자 배지만)
- Sheet 안 검토 사유 = readiness flag detail 외 별도 사유 사전 (LLM 자동 분류 등)
- "재고 확인" 시 inventory 페이지에서 검색어 자동 fill UI (현재 query string만)

Rollback path: git revert <SHA>
- 2 file (Sheet NEW + sentinel NEW) 삭제
- 1 file (search/page.tsx) bar 영역 + state + sheet 렌더 복원
- 🗑 휴지통 button + amber 색상 회귀
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/sourcing/SourcingCandidatesSheet.tsx `
  apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/sourcing-bar-ux-312.test.ts `
  docs/plans/PLAN_11.312-sourcing-bar-ux.md `
  docs/commit-drafts/COMMIT_11.312-sourcing-bar-ux.md

git status   # modified: 1 + untracked: 4
git commit -F docs/commit-drafts/COMMIT_11.312-sourcing-bar-ux.md
git push origin main
```

## Production smoke (호영님 평일)

1. Vercel READY 확인
2. labaxis.co.kr/app/search:
   - 검색 → 카드 2개 비교 체크 → bar "비교 2 첫항목명..." 노출
   - "비교 2" 탭 → bottom sheet 열림 + 각 항목 ✕ 개별 삭제 동작
   - 견적 bar 동일 — "견적 N" 탭 → sheet
   - ⚠ 검토 N (yellow) 탭 → review sheet (사유 + 액션)
   - "재고 확인" → /dashboard/inventory?search=<품목명> 이동
3. 🗑 휴지통 button 0 occurrence
4. §11.302 색상 정합 (yellow / red-100 / red-700)
5. 데스크탑 / 모바일 (375px) bar overflow 0
```
