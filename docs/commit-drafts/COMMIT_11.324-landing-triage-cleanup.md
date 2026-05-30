refactor(landing): §11.324 #landing-search-triage-cleanup — Triage 데모 제거 + 3단계 다이어그램 + 가입 CTA (호영님 P2, A안, 2026-05-30)

호영님 P2 §11.324 (구 spec §11.320) — 비로그인 랜딩 /search Sourcing Result Triage 데모 정리.

배경:
- 비로그인 사용자 "무료로 시작하기" 진입 시 /search 랜딩에 실제 사용 UI 노출
- 5 문제: 목적 불일치 / Dead button 위험 / 검색과 단절 / 공간 비효율 / 인지 부하
- 호영님 A안 (권장): 데모 제거 + 3단계 다이어그램 + 큰 가입 CTA
- §11.318-CORRECTION canonical 표면 (워크벤치) 보존, /products/[id] 라우트 보존

Fix (Phase 2 — app/search/page.tsx 단일 file 3 Edit):

- apps/web/src/app/search/page.tsx (340 → ~270 lines, ~70 line 정리):

  · **Edit 1 — import + data 정리 (line 8-61):**
    · 옛 lucide-react import: `CheckCircle2 / RefreshCw / Ban` (Triage 전용 icon) 제거
    · 신 import 추가: `GitCompare / FileText` (3단계 다이어그램 icon)
    · 보존: Search / ArrowRight / Beaker / Package / FlaskConical / Microscope (exampleQueries 사용)
    · 옛 `triageGroups` data (Exact Match / Cross-Vendor / Substitute / Blocked + Shortlist/Hold/Exclude) 전체 제거 (~43 lines)
    · 신 `flowSteps` data 추가 (① 검색 / ② 비교 / ③ 견적, 각 no + icon + description)

  · **Edit 2 — state/callback 정리 (line 68-69, 117-129):**
    · 옛 state: `publicTriageStage` / `publicTriageAction` / `setPublicTriageStage` / `setPublicTriageAction` 제거
    · 옛 callback: `handleTriageAction` / `handleStepAction` 제거
    · 보존: `query / setQuery` + `buildWorkbenchPath / continueToAuth / handleSearch / handleExampleClick / handleKeyDown` (실제 검색창 동작 보존)
    · 보존: `savePendingAction / PendingActionType` import (handleSearch 안 continueToAuth + handleExampleClick 에서 사용)

  · **Edit 3 — Triage section (line 185-286, ~102 lines) → 3단계 다이어그램 + 가입 CTA swap:**
    · 옛 `<section data-testid="search-result-triage" aria-label="소싱 결과 분류">` 전체 제거:
      · Triage 헤더 + 4 카드 (triageGroups.map + Shortlist/Hold/Exclude × 4)
      · Compare panel 안내문 + live-state 영역 + action-dock (Step 2/3 + 로그인 후 계속 link)
    · 신 `<section data-testid="landing-search-flow-steps" aria-label="LabAxis 사용 흐름 3단계">`:
      · `grid grid-cols-3 gap-3 sm:gap-4 text-left` — 데스크탑/모바일 모두 3 columns
      · flowSteps.map → article 3개 (① 검색 / ② 비교 / ③ 견적, icon + title + description)
      · `hover:border-blue-300 hover:shadow-sm transition-all` — 시각 affordance
    · 신 큰 가입 CTA (logged-out 한정):
      · `<Link href="/auth/signin" data-testid="landing-search-primary-cta">` 큰 button:
        · "무료로 시작하기 — 30초 가입" + ArrowRight icon
        · `h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-bold shadow-sm hover:shadow-md`
      · 보조 link: "이미 회원이세요? 로그인" → /auth/signin (text-slate-500)

canonical 보존 (회귀 0):
- 상단 띠 가입 banner (`data-testid="search-signup-banner"`) 보존
- 히어로 (h1 "연구 시약·장비 검색" + Input placeholder "시약명·CAS·제조사" + Button "검색" + handleSearch wiring) 보존
- 검색 예시 칩 (exampleQueries.map + handleExampleClick + Beaker/Package/FlaskConical/Microscope icon) 보존
- Searchable keys info (제품명 / 카탈로그 번호 / 브랜드 / LOT 번호) 보존
- Suspense fallback + SearchPage default export 보존
- handleSearch / handleExampleClick / continueToAuth / buildWorkbenchPath / savePendingAction wiring 보존
- app/_workbench/search/page.tsx (로그인 워크벤치) 영향 0 — 별개 file
- /products/[id] 라우트 영향 0
- SEO/OG 메타데이터 영향 0 (page.tsx 외부)

§11.324 Phase 1 sentinel GREEN 전환 (~13 it):
- A 제거 단언:
  · search-result-triage testid 잔존 0 ✓
  · triageGroups data (Exact Match / Cross-Vendor / Substitute / Blocked) 잔존 0 ✓
  · Shortlist/Hold/Exclude actions 패턴 잔존 0 ✓
  · search-step-2-compare / search-step-3-request testid 잔존 0 + "Step 2 제품 비교" / "Step 3 견적 요청" 잔존 0 ✓
  · publicTriageStage / publicTriageAction state + handleTriageAction / handleStepAction 잔존 0 ✓
  · search-triage-compare-panel / live-state / action-dock testid 잔존 0 ✓
- B 신설 단언:
  · landing-search-flow-steps testid ✓
  · 검색 / 비교 / 견적 3단계 라벨 ✓
  · landing-search-primary-cta testid + "무료로 시작하기" + /auth/signin Link ✓
- C canonical 단언:
  · search-signup-banner + "무료 가입하고 비교·견적까지" ✓
  · 연구 시약·장비 검색 + handleSearch + placeholder ✓
  · 검색 예시 영역 보존 ✓

호영님 production effect:
1. 비로그인 랜딩 = 가치 제안 + 가입 유도 페이지로 단순화 — Triage 4 카드 (~40% 화면 점유) 사라짐.
2. 3단계 다이어그램 (검색/비교/견적) = LabAxis 사용 흐름 명확.
3. 큰 가입 CTA "무료로 시작하기 — 30초 가입" = primary conversion 부각.
4. dead button 0 = 모든 button/link 명확한 동작 (검색 / 가입 / 로그인).
5. CLAUDE.md "dead button 금지" 원칙 정합.
6. 검색창 동작 보존 = 비로그인도 검색 가능 (workbench 라우팅은 로그인 후).

Out of Scope (Phase 3):
- 회귀 audit + PLAN closeout (Phase 3)
- 기존 sentinel 영향 (search-triage-* testid 단언 sentinel) audit 갱신
- 옛 §11.267b / §11.274c 등 sentinel cross-reference

검증 (sandbox 정적 grep):
- search-result-triage testid 잔존 0 ✓
- triageGroups data + Shortlist/Hold/Exclude 잔존 0 ✓
- publicTriageStage / Action / handleTriageAction / handleStepAction 잔존 0 ✓
- landing-search-flow-steps + landing-search-primary-cta 신규 ✓
- exampleQueries / handleSearch / search-signup-banner 보존 ✓

Rollback path: git revert <SHA>
- 옛 triageGroups + state + Triage section 전체 복원 (단일 file)
- sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/search/page.tsx `
  apps/web/src/__tests__/regression/landing-search-triage-cleanup-324.test.ts `
  docs/plans/PLAN_11.324-landing-search-triage-demo-cleanup.md `
  docs/commit-drafts/COMMIT_11.324-landing-triage-cleanup.md
git status
git commit -F docs/commit-drafts/COMMIT_11.324-landing-triage-cleanup.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. 비로그인 상태 https://labaxis.co.kr/search 진입:
   · 상단 띠 "무료 가입하고 비교·견적까지 한 번에 →" 보존
   · 히어로 h1 "연구 시약·장비 검색" + 검색창 + 검색 button 보존
   · Triage 4 카드 + Shortlist/Hold/Exclude + Step 2/3 button 모두 사라짐
   · 3단계 다이어그램 노출 (① 검색 / ② 비교 / ③ 견적, hover 시 shadow)
   · 큰 가입 CTA "무료로 시작하기 — 30초 가입" + ArrowRight (h-12 px-8 blue-600)
   · 보조 link "이미 회원이세요? 로그인" 노출
   · 검색 예시 칩 (Anti-GAPDH antibody 등) 보존
   · Searchable keys info (제품명/카탈로그/브랜드/LOT) 보존
3. 검색창 입력 + 검색 button click → /auth/signin?callbackUrl=/app/search?q=... 로 redirect (continueToAuth wiring 정합)
4. 검색 예시 click → 동일 동작
5. 가입 CTA click → /auth/signin 진입
6. 로그인 상태 진입 → 동일 페이지지만 가입 CTA + 보조 link 숨김 (logged-out 한정 조건)
7. 모바일 375px overflow 0
8. /app/_workbench/search (로그인 워크벤치) 영향 0
9. /products/[id] 라우트 영향 0

## Next (호영님 push 회신 후)
- Phase 3: 회귀 audit (기존 sentinel 영향 — search-triage-* testid 단언 swap or describe.skip) + PLAN closeout
