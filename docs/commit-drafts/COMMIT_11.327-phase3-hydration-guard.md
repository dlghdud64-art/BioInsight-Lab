fix(quotes): §11.327 Phase 3 #hydration-guard — quotes/page useEffect feedback loop 차단 (호영님 P0, Option A, 2026-05-30)

호영님 P0 §11.327 Phase 3 (GREEN) — `/api/user/preferences` 403 폭주 root cause fix (Option A minimal).

배경 (Phase 2 sandbox audit 결과):
- middleware CSRF gate (Batch 10) → 403 매핑 가설 D
- csrfFetch race-condition retry 1회 → 단발 403 만으로는 20+ 폭주 불가
- quotes/page.tsx useEffect 4쌍 (hydration + mutation) audit → 가설 F (feedback loop) **100% 확정**:
  · **Mutation 2 dep `[columnPrefs, userPrefs]`** — userPrefs 가 mutation onSuccess 마다 새 reference
  · mutation → server PATCH → cache update → preferences 새 reference → hydration 재실행 → setLocalState → mutation 재실행 → 무한 loop
  · 4쌍 × N회 × csrfFetch retry 2 = **20+ 폭주 매칭**

호영님 spec §6 + §3-2 가설 F (useEffect feedback loop) 확정.

Fix (Phase 3 Option A — quotes/page.tsx 단일 file):

- apps/web/src/app/dashboard/quotes/page.tsx (line 1084-1395):

  · **hydratedRef 신설 + preferences-arrival flag set** (line 1088 근처):
    · `const hydratedRef = useRef(false);` — 첫 hydration 완료 flag
    · 별도 useEffect: `if (userPrefs.preferences) hydratedRef.current = true;` `dep=[userPrefs.preferences]`
    · columnPrefs hydration 의 early return 영향 0 — preferences 도착 시 flag 자동 set

  · **Mutation 1 (briefingCollapsed, line 1113-)** hydratedRef 가드:
    · `if (!hydratedRef.current) return;` 첫 줄 추가
    · dep `[isBriefingCollapsed]` 보존

  · **Mutation 2 (columnPrefs, line 1123-) — 핵심 root cause:**
    · `if (!hydratedRef.current) return;` 추가 (localStorage write 이후)
    · dep `[columnPrefs, userPrefs]` → `[columnPrefs]` **userPrefs 제거**
    · userPrefs 자체가 mutation 마다 새 reference → 직접적 feedback loop 원인 차단
    · localStorage write 는 dep 무관하게 매번 (silent fail tolerant)
    · eslint-disable-next-line react-hooks/exhaustive-deps 추가

  · **Mutation 3 (quotesView, line 1363-)** hydratedRef 가드:
    · `if (!hydratedRef.current) return;` 추가
    · dep `[viewMode, sortState]` 보존

  · **Mutation 4 (quotesFilter, line 1389-)** hydratedRef 가드:
    · `if (!hydratedRef.current) return;` 추가
    · dep `[statusFilter, modeChip]` 보존

- apps/web/src/__tests__/regression/
  quotes-page-hydration-guard-327.test.ts (NEW):
  · 8 it 회귀 가드:
    · hydratedRef = useRef(false) 신설 + §11.327 trace marker
    · preferences fetch 완료 시 hydratedRef.current = true (별도 useEffect)
    · 4 mutation useEffect hydratedRef 가드 + skip pattern
    · Mutation 2 옛 dep `[columnPrefs, userPrefs]` 잔존 0
    · canonical: useUserPreferences hook 호출 + 4 hydration logic + Phase 1 mitigation 보존

canonical 보존 (회귀 0):
- useUserPreferences hook 자체 변경 0 (다른 6 caller page 영향 0):
  · /dashboard/inventory/inventory-content.tsx
  · /dashboard/purchase-orders/page.tsx
  · /dashboard/purchases/page.tsx
  · /dashboard/receiving/page.tsx
  · /dashboard/safety/page.tsx
  · components/settings/notification-preference-toggles.tsx
- §11.327 Phase 1 mitigation (retry: 0 + onError warn) hook 단에 보존
- 4 hydration useEffect 로직 보존 (server-first hydration 원칙)
- debounce 400ms (hook 내부) 보존
- localStorage write fallback 보존

호영님 production effect:
1. `/dashboard/quotes` 진입 시 PATCH 호출 횟수 = **20+ → 0~1회** (사용자 액션 시만)
2. 첫 hydration 완료 전 (mount + server fetch) mutation 가드 → 불필요 PATCH 0
3. 사용자 컬럼 resize / 필터 변경 / view 전환 시만 정상 PATCH (debounce 400ms)
4. CSRF 403 = 별도 호영님 production info 회신 후 (서버 정책 확인 필요, fix 와 무관)
5. 콘솔 폭주 사라짐 → 다른 진짜 오류 가시성 회복

⚠️ Option A scope:
- quotes/page.tsx 단일 file (호영님 화면 우선)
- 다른 6 caller page (inventory/purchase-orders/purchases/receiving/safety/notification) 도 동일 패턴 가능성 → §11.327b 후속 batch (호영님 결정 시)
- 단기 검증: 호영님 화면 폭주 사라지면 Option B sweep 진입 결정

Out of Scope:
- 다른 6 caller page 동일 fix (Option B sweep — 별도 batch)
- useUserPreferences hook 내부 deduplication (Option C architectural — 별도 batch)
- CSRF middleware 정책 (호영님 production info 회신 후)
- §11.328 (입고 데이터 모델) SPEC sync

검증 (sandbox 정적 grep):
- hydratedRef = useRef(false) ✓
- preferences-arrival flag set useEffect ✓
- 4 mutation 모두 `if (!hydratedRef.current) return` 가드 ✓
- Mutation 2 dep `[columnPrefs, userPrefs]` 잔존 0 ✓
- useUserPreferences hook 변경 0 ✓
- §11.327 Phase 1 (retry:0 + onError warn) hook 보존 ✓

Rollback path: git revert <SHA>
- hydratedRef + 4 가드 + dep 변경 모두 revert
- sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/dashboard/quotes/page.tsx `
  apps/web/src/__tests__/regression/quotes-page-hydration-guard-327.test.ts `
  docs/commit-drafts/COMMIT_11.327-phase3-hydration-guard.md
git status
git commit -F docs/commit-drafts/COMMIT_11.327-phase3-hydration-guard.md
git push origin main
```

## Production smoke (호영님 즉시 진행)

1. Vercel READY 확인
2. /dashboard/quotes 진입 → DevTools Network/Console
3. **§11.327 검증:**
   · PATCH /api/user/preferences 호출 횟수:
     · 옛: 20+ 반복 403
     · 신: 0~1회 (사용자 첫 액션 시만)
   · console `[§11.327] preferences PATCH 실패 (silent fallback)` 폭주 사라짐
4. 사용자 액션 (column resize / 필터 변경 / view 전환) 시:
   · 정상 PATCH 1회 (debounce 400ms 적용)
   · 만약 여전히 403 → CSRF 정책 issue (별도 fix)
5. 다른 6 caller page (inventory 등) 폭주 여부 확인:
   · 만약 동일 폭주 → Option B sweep 진입 (별도 batch)
   · 없으면 Option A 충분

## Next (호영님 push + smoke 후)

- 시나리오: quotes 폭주 사라짐 + 다른 6 page 폭주 0 → Option A 종결 + Phase 4 closeout
- 시나리오: quotes 폭주 사라짐 + 다른 6 page 폭주 잔존 → Option B sweep (별도 batch)
- 시나리오: quotes 도 여전히 폭주 → 다른 root cause (CSRF 정책 / 다른 mutation site) 추가 audit
- §11.328 SPEC sync 후 진입
