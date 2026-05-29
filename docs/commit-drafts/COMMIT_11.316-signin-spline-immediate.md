fix(auth): §11.316 #signin-spline-immediate-mount — 로그인 페이지 3D 즉시 노출 + 짧은 fade (호영님 P1, 2026-05-29)

호영님 P1 — 로그인 페이지(/auth/signin) 3D 배경 노출 지연 fix.

근본 원인 (auth/signin/page.tsx SplineBg):
- useEffect 안 `setTimeout(800)` 으로 의도적 지연: "auth card 먼저, 그 다음 3D fade-in"
- opacity transition 2.4s (fade 자체도 길어 체감 더 늦음)
- 결과: 페이지 진입 후 약 800ms + Spline scene 다운로드 + 2.4s fade = 총 ~3-5초 후
  완성된 3D 노출. 호영님 의도("바로 뜨게")와 반대.

Fix (small, single-file, visual only):

- apps/web/src/app/auth/signin/page.tsx:
  · useEffect: setTimeout(800) 제거 → 즉시 IIFE 로 dynamic import("@splinetool/runtime") +
    Application + scene.load 시작.
  · cleanup race-condition 안전 위해 `let disposed = false` flag 도입.
    load 도중 unmount 되어도 setLoaded 호출/leak 방지 (기존 clearTimeout 패턴 동일 안전성).
  · canvas style transition "opacity 2.4s ease" → "opacity 0.6s ease"
    (즉시감 확보, 자연스러운 fade 유지).
  · 새 §11.316 주석으로 변경 의도 기록.

- apps/web/src/__tests__/regression/
  signin-spline-immediate-mount-316.test.ts (NEW, ~6 it):
  · setTimeout(800) / "Delayed mount" 제거 + 즉시 mount 주석 / §11.316 marker
  · transition 0.6s 적용 + 2.4s 잔존 0
  · cleanup race-condition disposed flag 패턴
  · canonical 보존 — Spline scene URL / autoplay / reducedMotion / opacity loaded 분기 / dispose cleanup

canonical truth 보존 (회귀 0):
- Spline scene URL (Nd9Ab5oDbi1kcWsV) 변경 0
- reducedMotion 분기 + filter brightness/contrast 보존
- autoplay loop (app.play()) 보존
- opacity loaded ? 0.88 : 0 분기 보존 (시각 layering 동일)
- dispose cleanup 보존 (clearTimeout → disposed flag 로 패턴만 swap, 동일 safety)
- SignInContent / Suspense / next-auth wiring 영향 0
- vendor/login + signin 외 다른 페이지 영향 0

호영님 production effect:
1. /auth/signin 진입 즉시 Spline runtime import + scene load 시작 (800ms 지연 제거).
2. scene ready 즉시 opacity 0 → 0.88 fade-in (transition 0.6s 자연스러움 유지).
3. 체감: 진입 후 1~2초(scene download 시간) 내 3D 완성 노출 (기존 3~5초 → 약 절반).
4. auth card는 useEffect 이전부터 SSR/CSR 으로 이미 즉시 렌더 — 본 변경에 영향 0.

Out of Scope (⚠️ 본 batch 미포함):
- Spline scene 자체 preload (link rel="preload") — 추가 최적화 가능하나 별도 P2
- vendor/login 페이지의 3D 처리(현재 SplineBg 미사용) — 무관
- intro/landing/hero 페이지의 hero-section / hero-demo-flow-panel — 별개 surface

검증 (sandbox 정적):
- setTimeout(800) grep 0 / "Delayed mount" 주석 0
- transition "opacity 0.6s ease" 적용 / "2.4s" 잔존 0
- disposed flag + dispose cleanup 안전 패턴 정합
- Spline scene URL / autoplay / reducedMotion 보존 확인

Rollback path: git revert <SHA>
- 옛 setTimeout(800) + transition 2.4s 복원 + sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/auth/signin/page.tsx `
  apps/web/src/__tests__/regression/signin-spline-immediate-mount-316.test.ts `
  docs/commit-drafts/COMMIT_11.316-signin-spline-immediate.md
git status
git commit -F docs/commit-drafts/COMMIT_11.316-signin-spline-immediate.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /auth/signin 진입(Hard refresh: Cmd/Ctrl+Shift+R) → 3D 영역이 진입 직후 fade-in 시작
   (옛 800ms 지연 없이 약 1~2초 내 완성)
3. opacity 0 → 0.88 fade 가 부드럽게 0.6s 내 마감되는지 (갑작스럽지 않음)
4. reducedMotion 사용자(접근성 설정 ON) → filter 변경 + fade 동일 동작 확인 (선택)
5. auth card 입력/제출 흐름 회귀 0 확인
