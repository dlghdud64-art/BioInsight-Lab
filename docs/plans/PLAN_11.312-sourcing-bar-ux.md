# Implementation Plan: §11.312 소싱 sticky bar UX (P1)

- **Status:** ✅ Complete (1차 작업 sandbox 완료 + 호영님 push 완료, task #76 completed. plan 문서 stale 갱신 — §11.312-b 진입 시 sandbox 실제 상태 재확인 결과 (1)~(6) 모두 sandbox 적용 완료)
- **Started:** 2026-05-26
- **Last Updated:** 2026-05-30 (§11.312-b 진입 시 stale 정정)
- **Owner:** Claude (sandbox) → 호영님 (평일 push)
- **호영님 spec 원문 § 번호:** §11.306 → **§11.312** 부여 (기존 §11.306 = 모바일 UX a/b/c 충돌 회피)
- **후속 batch:** §11.312-b (호영님 production smoke 후 데스크탑 "전체 해제" 위치 보강, `PLAN_11.312-b-sourcing-bar-ux-refinement.md`)

### 🔧 stale 정정 (2026-05-30, §11.312-b 진입 시 확인)
실제 sandbox 상태 = 모든 sub-task wiring 완료:
- (1) SourcingCandidatesSheet 컴포넌트 ✅ (375 lines, mode compare/quote/review 3 mode + 개별 ✕ + onRemoveCompare/onRemoveQuoteItem/onClearCompare/onClearQuote/onClearReviewFlag wiring)
- (2) search/page.tsx bar wiring ✅ (line 1454-1604, setCandidatesSheetMode("compare"/"quote"/"review") 3 button)
- (3) 비교 개별 삭제 ✅ (onRemoveCompare 안 toggleCompare 호출)
- (4) reviewReason quoteItems 노출 ✅ (line 1598, requestReadiness.candidates → reviewFlag mapping)
- (5) amber → yellow 색상 정합 ✅ (검토 배지 line 1535 bg-yellow-100 text-yellow-700)
- (6) 🗑 휴지통 통합 ✅ (line 1560 sheet 내 통합 주석 명시)
- (7) Sentinel + commit draft = 호영님 push 후 production smoke 로 검증 완료 (별도 sentinel file 추가 시 §11.312-b 와 통합)

---

## 0. Truth Reconciliation

**대상:**

- `apps/web/src/app/_workbench/search/page.tsx` (line 1454-1535 sticky bar)
- 신규 컴포넌트: `apps/web/src/components/sourcing/SourcingCandidatesSheet.tsx`

**state (page level):**
- `compareIds: string[]` + `clearCompare()` — 개별 삭제 helper 부재 → inline `setCompareIds` 또는 store 확장
- `quoteItems` + `removeQuoteItem(id)` ✅
- `requestReadiness.summary.review` — 검토 N (지금은 표시만, 탭 비활성)
- `products` — compareIds → name lookup용

**§11.302 색상 정합 확인:**
- line 1465 `text-amber-500` (비교 "2개 이상 필요") → `text-yellow-600`
- line 1490 `bg-amber-50 text-amber-600` (검토 N) → `bg-yellow-100 text-yellow-700` (호영님 spec 명시)

---

## 1. Sub-task

| # | scope | 상태 |
|---|---|---|
| (1) | SourcingCandidatesSheet 컴포넌트 신규 (mode: compare/quote/review) | ✅ sandbox 완료 |
| (2) | search/page.tsx bar wiring (탭 → sheet open + 미리보기 텍스트) | ⏳ |
| (3) | compare 개별 삭제 helper (inline setCompareIds 또는 store) | ⏳ |
| (4) | 검토 사유 (reviewReason) quoteItems 에 노출 (현재는 readiness summary만) | ⏳ — readiness reason → quoteItems prop 전달 |
| (5) | 색상 정합 (amber → yellow) | ⏳ |
| (6) | 🗑 휴지통 → confirm dialog 또는 sheet 내 "전체 삭제"로 통합 | ⏳ 권장: sheet 내 통합 (호영님 spec) |
| (7) | Sentinel + commit draft | ⏳ |

---

## 2. 회귀 보호

- §11.252f sticky bar 2-row 구조 보존 (compareIds.length > 0, quoteItems.length > 0 분기)
- §11.268c divider opacity 보존
- 기존 `CompareReviewWorkWindow` / `RequestReviewWindow` / `setComparisonModalOpen` / `setRequestWizardOpen` wiring 변경 0
- `requestHandoff` 분기 (견적 요청 조립 vs 견적 요청서 만들기) 보존
- `totalAmount` 표시 보존

---

## 3. 호영님 결정 (받음)

- Q30 = A (견적 query string) — §11.312 와 무관 (§11.310)
- Q33 = §11.310 scope만 amber 정합 — §11.312 도 amber → yellow 적용 (호영님 spec 명시)
- bar 미리보기 텍스트: 첫 항목명 + truncate, 2개+ 시 숫자 배지 (호영님 spec)
- 🗑 휴지통: sheet 내 "전체 삭제"로 통합 권장 (호영님 spec 권장)

---

## 4. Next steps

1. search/page.tsx 수정 — state + wiring + 미리보기 + amber→yellow + 🗑 sheet 통합
2. quoteItems에 reviewReason 필드 노출 (requestReadiness 에서 매핑)
3. Sentinel test
4. Commit draft + present_files
5. 다음 호영님 평일 push
