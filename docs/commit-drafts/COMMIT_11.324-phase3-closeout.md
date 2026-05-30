test(landing): §11.324 Phase 3 #closeout — 회귀 audit + 옛 sentinel 2건 정합 (§11.267c describe.skip + §11.274c aria-label swap) + PLAN 종결 (호영님 P2, 2026-05-30)

호영님 P2 §11.324 Phase 3 (GREEN, closeout) — 회귀 audit + 옛 sentinel 갱신 + plan 종결.

배경:
- §11.324 Phase 2 작업 (Triage section 102 line 제거 + 3단계 다이어그램 + 큰 가입 CTA) → 기존 sentinel 2건 영향:
  · `__tests__/landing/search-result-triage-267c.test.ts` — 7+ it 완전 obsolete (Triage 4 카드 + Shortlist + Step 2/3 단언 모두 §11.324 가 제거)
  · `__tests__/components/section-landmark-aria-label-274c.test.ts` line 101-103 — SEARCH 한글 라벨 1 it ("소싱 결과 분류" → "LabAxis 사용 흐름 3단계")
- 다른 sentinel (263b/265b2/292/251b-redo) = 다른 surface 또는 §11.324 보존 영역 = 영향 0
- §11.324 Phase 1 sentinel (landing-search-triage-cleanup-324) 모두 자연 GREEN

Fix (Phase 3 — sentinel 2건 정합 + PLAN closeout):

- apps/web/src/__tests__/landing/search-result-triage-267c.test.ts:
  · `describe(...)` → `describe.skip(...)` — §11.324 supersede 명시
  · docblock 갱신:
    · 원본 §11.267c spec (Agent Board) 의도 명시
    · §11.324 호영님 P2 supersede 사유 (Triage 데모 vs 가입 conversion)
    · 새 sentinel 위치 cross-reference (landing-search-triage-cleanup-324)
    · Rollback path (§11.324 revert 시 describe.skip → describe 복원)

- apps/web/src/__tests__/components/section-landmark-aria-label-274c.test.ts:
  · line 101-103 `it("search/page.tsx 한글 \"소싱 결과 분류\" 매칭")` 의도 swap:
    · 옛: `expect(SEARCH).toMatch(/aria-label="소싱 결과 분류"/)`
    · 신: `expect(SEARCH).toMatch(/aria-label="LabAxis 사용 흐름 3단계"/)` + 옛 라벨 잔존 0 단언
  · §11.274c "영문 → 한글 정합" 원칙은 그대로 유효 (한글 라벨 유지)
  · §11.324 supersede 사유 docblock 추가

- docs/plans/PLAN_11.324-landing-search-triage-demo-cleanup.md:
  · Status: 🔄 In Progress → ✅ Complete
  · Completed: 2026-05-30

회귀 audit 결과 (sandbox grep):
- §11.267c landing/search-result-triage-267c.test.ts: describe.skip + docblock ✓ (vitest 실행 시 skipped 표시)
- §11.274c section-landmark-aria-label-274c.test.ts: line 101-103 의도 swap ✓
- §11.274c 다른 it (WORKBENCH_SEARCH 한글 라벨 매칭) 영향 0 (별개 file)
- §11.263b sourcing-filter-mobile-unified: 다른 surface (워크벤치 필터), §11.324 와 무관
- §11.265b2 sourcing-mobile-ai-analysis-sheet: 다른 surface (워크벤치 AI 분석), §11.324 와 무관
- §11.292 sourcing-triage-removal: 워크벤치 TRIAGE (다른 file), §11.324 와 무관
- §11.251b-redo search-placeholder: placeholder 단언, §11.324 보존 ✓
- app/_workbench/search/page.tsx 영향 0 ✓
- /products/[id] 라우트 영향 0 ✓

§11.324 전체 3 phase 합산 effect:
- Phase 0 Truth audit: app/search/page.tsx (340 lines) Triage 데모 영역 line 매핑 (21-59, 68-69, 117-129, 185-286)
- Phase 1 RED: 13 it sentinel (A 제거 6 it + B 신설 3 it + C canonical 4 it)
- Phase 2 GREEN: app/search/page.tsx 3 Edit (import/data, state/callback, JSX swap)
  · 옛 ~340 lines → 신 ~270 lines (~70 line 정리)
  · Triage 데모 → 3단계 다이어그램 + 큰 가입 CTA
- Phase 3 회귀 0: 옛 sentinel 2건 정합 (§11.267c skip + §11.274c swap) + PLAN closeout

호영님 production effect (Phase 3 단독):
- production 변화 0 (sentinel + PLAN 갱신만)
- 옛 §11.267c spec (Agent Board "Triage 데모 노출") 의 supersede 명시 — git history 추적 가능
- §11.274c 한글 라벨 정합 §11.324 supersede 반영

Out of Scope:
- 다음 트랙 (SMTP §11.314 Phase 2 / §11.318-CORRECTION / 신규 spec)

검증:
- §11.267c describe.skip ✓
- §11.274c line 101-103 swap ✓ (LabAxis 사용 흐름 3단계 매칭 + 옛 라벨 잔존 0)
- PLAN file Status Complete ✓

Rollback path: git revert <SHA>
- §11.267c describe.skip → describe 복원
- §11.274c 옛 한글 라벨 단언 복원
- PLAN Status 복원

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/__tests__/landing/search-result-triage-267c.test.ts `
  apps/web/src/__tests__/components/section-landmark-aria-label-274c.test.ts `
  docs/plans/PLAN_11.324-landing-search-triage-demo-cleanup.md `
  docs/commit-drafts/COMMIT_11.324-phase3-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.324-phase3-closeout.md
git push origin main
```

## Production smoke
- N/A (sentinel + PLAN closeout only, production 변화 0)
- 호영님 §11.324 Phase 2 production smoke 누적 결과 = 3 phase 합산 효과 확인 완료 가정
- vitest run 시 §11.267c describe.skip 으로 "7 tests skipped" 표시 예상 (회귀 fail 0)

## Next (호영님 push 회신 후)

§11.324 완전 종결. 다음 트랙 (호영님 결정):
- SMTP 자동발송 §11.314 Phase 2 (release-prep deferred, ~2-3h)
- §11.318-CORRECTION 환각 억제 batch (호영님 spec 상세 필요)
- 또는 호영님 신규 spec
