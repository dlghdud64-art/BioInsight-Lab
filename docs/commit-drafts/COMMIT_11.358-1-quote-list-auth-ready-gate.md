fix(quotes) §11.358-1 #quote-list-auth-ready-gate — 세션 loading 윈도우 빈 화면 오노출 제거 (호영님 P-라이브)

호영님 spec: 견적 관리 진입 시 useSession status === "loading" 윈도우 동안
isLoading=false → 빈 결과(empty state) 잠깐 노출 → 1-2초 후 실데이터 깜빡임.

root cause: quotesQueryLoading 만 isLoading 판정 기준. 세션 미해결("loading")
상태에선 useQuery enabled:false → quotesQueryLoading=false → 빈 화면 깜빡 노출.

Fix (apps/web/src/app/dashboard/quotes/page.tsx):
- isLoading = quotesQueryLoading || status === "loading"
- 세션 미해결 동안 스켈레톤/로딩 유지 → empty state 거짓 노출 차단.

canonical truth 보존: useQuery enabled/queryFn·empty state UI·데이터 mutation 무변경.

production effect: 진입 ~1s 동안 빈 결과 깜빡임 0, 세션 해결 후 즉시 실데이터 또는 정상 empty 노출.

Out of scope: §11.366 dashboard auth-ready 게이트(별 트랙 기 적용) / 다른 surface 동형 적용 — 별도.

Rollback: quotes/page.tsx isLoading 1줄 revert.
