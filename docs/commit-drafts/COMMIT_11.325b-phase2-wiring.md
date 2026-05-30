feat(workbench): §11.325b Phase 2 #detail-entry-wiring — 명시적 "상세 보기" button + ChevronRight wiring (워크벤치 카드 dead UI 해소) (호영님 P1, 2026-05-30)

호영님 P1 §11.325b Phase 2 (GREEN) — 워크벤치 검색 카드 시각 affordance 명확화.

배경 (§11.325 Truth):
- 워크벤치 카드 → rail ProductDetailSummary same-canvas wiring 사실상 이미 구현 (onSelect → activeResultId → rail render)
- 문제 = 시각 affordance 부재:
  · ChevronRight (line 319) onClick 0 = dead UI
  · 명시적 "상세 보기" 라벨 0 — onSelect 의미 모호
- 호영님 4 결정: 옵션 A (명시적 button) + ChevronRight wiring(제거 X) + same-canvas 유지 + P1

Fix (Phase 2 — sourcing-result-row.tsx 단일 file 3 Edit):

- apps/web/src/app/_workbench/_components/sourcing-result-row.tsx:

  · **데스크탑 명시적 "상세 보기" button 신설** (line 318 근처, 견적 담기 직후):
    · `data-testid="sourcing-result-row-detail-cta"`
    · `onClick={() => { onSelect(); }}` — 부모 `onClick={(e) => e.stopPropagation()}` 로 카드 본체 onSelect 중복 호출 방지
    · `<motion.button>` outline 스타일 (h-8 px-3 + slate-200 border + hover blue), 비교/견적 button 패턴 통일
    · 라벨 "상세 보기"

  · **ChevronRight `<button>` wrap + onClick wiring** (line 319 swap):
    · 옛: `<ChevronRight className="..." />` — onClick 0, 시각만
    · 신: `<button type="button" aria-label="상세 보기" onClick={(e) => { e.stopPropagation(); onSelect(); }} className="hidden sm:inline-flex ... cursor-pointer rounded p-1 -m-1 hover:bg-slate-100"><ChevronRight className="..." /></button>`
    · `data-testid="sourcing-result-row-detail-chevron"`
    · stopPropagation 으로 카드 본체 onSelect 중복 호출 방지
    · cursor-pointer + hover:bg-slate-100 명시 (affordance 명확)
    · ChevronRight 시각(className) 그대로 보존, hit area 만 button 으로 강화

  · **모바일 명시적 "상세 보기" button 신설** (line 360 근처, 견적 담기 직후):
    · `data-testid="sourcing-result-row-detail-cta-mobile"`
    · 동일 onSelect 호출
    · 모바일 ChevronRight 는 `hidden sm:inline-flex` 로 데스크탑만 노출되므로 모바일은 button 만으로 affordance 확보

canonical 보존 (회귀 0):
- 카드 본체 `onClick={onSelect}` (line 208) 보존 — rail trigger 패턴 유지
- `isSelected` prop / 선택 시각 (rowStyle / text-blue-400) 보존
- `onToggleCompare` / `onToggleRequest` wiring 보존 (비교 추가 / 견적 담기)
- 데스크탑/모바일 sm:flex / sm:hidden 분기 패턴 보존
- sourcing-context-rail.tsx `<ProductDetailSummary>` render + `showDetailLink={true}` 보존 (same-canvas 패턴)
- /products/[id] 라우트 자체 보존 (비로그인 ProductCard 진입로)
- props 시그니처 변경 0 — caller (_workbench/search/page.tsx) 영향 0

§11.325b Phase 1 sentinel GREEN 전환:
- 명시적 button testid + onSelect wiring ✓
- "상세 보기" 라벨 매칭 ✓ (3건: 데스크탑 button + ChevronRight aria-label + 모바일 button)
- `<button>` wrap + onClick={onSelect} + ChevronRight 매칭 ✓
- cursor-pointer + hover 매칭 ✓
- canonical: onSelect / isSelected / onToggleCompare / onToggleRequest 보존 ✓
- rail same-canvas: ProductDetailSummary + showDetailLink={true} 보존 ✓

호영님 production effect:
1. 워크벤치 검색 카드 데스크탑/모바일 모두 명시적 "상세 보기" button 노출 — 의도 명확.
2. ChevronRight onClick wiring + cursor-pointer + hover:bg-slate-100 — secondary affordance 살아남, dead UI 해소.
3. 카드 본체 click 도 동일 onSelect 호출 — 사용자 선호 다양한 진입로 (카드 어디든 click).
4. rail 안 ProductDetailSummary render — same-canvas 패턴 (워크벤치 컨텍스트 손실 0).
5. `showDetailLink={true}` 보조 link — 필요 시 /products/[id] full-page 진입 가능 (비로그인 진입로와 정합).
6. CLAUDE.md "dead button / no-op 금지" 원칙 정합.

Out of Scope (Phase 3):
- 회귀 통합 + 모바일 final + closeout (Phase 3)
- product-detail-summary.tsx 의 §11.314 Part A 정합 추가 audit (별도 batch)

검증 (sandbox 정적 grep):
- sourcing-result-row-detail-cta (데스크탑 button) ✓
- sourcing-result-row-detail-chevron (ChevronRight button wrap) ✓
- sourcing-result-row-detail-cta-mobile (모바일 button) ✓
- onClick={() => { onSelect(); }} 패턴 3건 (데스크탑 button + ChevronRight + 모바일 button)
- 카드 본체 onClick={onSelect} (line 208) 보존 ✓
- ChevronRight 시각 (h-3.5 w-3.5 + group-hover) className 보존 ✓

Rollback path: git revert <SHA>
- 옛 ChevronRight 단순 className + button 신설 3건 모두 revert (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/_workbench/_components/sourcing-result-row.tsx `
  docs/commit-drafts/COMMIT_11.325b-phase2-wiring.md
git status
git commit -F docs/commit-drafts/COMMIT_11.325b-phase2-wiring.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /app/_workbench/search → 검색어 입력 → 결과 카드 노출
3. 데스크탑 (lg+):
   · 카드 우측 액션 영역: [비교 추가] [견적 담기] [상세 보기] [▶ ChevronRight button]
   · "상세 보기" click → 우측 rail 에 ProductDetailSummary 표시 (same-canvas)
   · ChevronRight click → 동일 동작 (rail trigger), hover 시 cursor-pointer + slate-100 배경
   · 카드 본체 click → 동일 onSelect (기존 동작 보존)
4. 모바일 (375px, sm:hidden 영역):
   · 카드 하단: 가격 / [비교 추가] [견적 담기] [상세 보기]
   · ChevronRight 안 보임 (sm:inline-flex)
   · "상세 보기" click → rail trigger
5. 비교 추가 / 견적 담기 동작 회귀 0
6. isSelected 시각 (rowStyle border + ChevronRight text-blue-400) 보존
7. caller _workbench/search/page.tsx (line 1133-1155) wiring 영향 0

## Next (호영님 push 회신 후)
- Phase 3: 회귀 통합 + 모바일 final + closeout (§11.325b 종결)
