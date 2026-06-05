fix(dashboard): §11.366 #mobile-entry-loading — 무한·장시간 스켈레톤 상한 + retry 창 단축 (호영님 P0 / CORE+ⓑ, branch-independent)

호영님 spec: 모바일 대시보드 진입 스켈레톤 무한/장시간 = P-라이브(첫 화면 진입 차단). 코드 진단 — 무한 경로 = auth status "loading" hang 유일, 데이터 경로 = §11.361-1b/1c throw+retry backoff(cold 500 시 ~14s 노출). 단순 revert 금지(거짓 빈상태 재발).

Fix (apps/web/src/app/dashboard/page.tsx):
- ① useQuery refetch(refetchStats) 구조분해 추가.
- ② isStillLoading + loadTimedOut state + 6s setTimeout. 진입 후 6초 내 미해소 시 상한 도달.
- ③ 스켈레톤 게이트 2분기: timeout 전 = 기존 스켈레톤 / timeout 후 = 에러 + "다시 시도"(status loading 시 reload=세션 재수립, 그 외 refetch). 무한 스켈레톤 제거.
- ⓑ retry 3→2, retryDelay cap 8000→4000. 재시도 창 ~14s → ~3s.

Branch-independent: auth hang(a) + retry backoff(b·c) 양 경로 모두 6초 상한 후 에러 UI로 커버.

Canonical truth 보존: §11.361-1b(throw→retry) / §11.361-1c(스켈레톤 유지로 거짓 빈상태 차단) truth fix 유지. 데이터/집계/온보딩 게이트 무변경. 읽기 fetch만, 외부영향 0.

회귀: tsc src 0 / build PASS / dashboard-onboarding-gate-truth-361 4/4 green (1b 단언 retry:3 → /retry:\s*[23]/ 갱신 정합).

Production effect: 모바일/콜드스타트 진입 시 무한·장시간(~14s) 스켈레톤 → 6초 상한 후 에러+재시도. 첫 화면 진입 차단 해소.

Out of Scope: ⓒ 서버 early count-check(api/dashboard/stats), 2-B 세션 강제 reauth(CORE reload로 대부분 흡수) — 런타임 a/b/c 회신 후 별도.

Rollback: git revert <hash> — page.tsx 단일 파일, 게이트 분기·retry 옵션만 변경.
