fix(auth) §11.371-1 #session-expiry-gate — 세션 만료 시 mutation dead-end → 재로그인 유도 (호영님 P0 구조 2026-06-05)

호영님 spec: 세션 만료 중 스캔/입고/재고 액션이 csrfFetch 401 을 그냥 반환 →
"보안검증 미완" dead-end. 미들웨어는 /dashboard 네비게이션만 게이트, apiClient 만
401 redirect — csrfFetch(mutation 실경로)가 gap.

Fix:
- api-client.ts: csrfFetch 401 → /auth/signin?callbackUrl 리다이렉트(apiClient 정책 미러,
  systemic). const→let response(403 retry 재할당), window guard. 403(권한거부)은 제외(loop 방지).
- Header.tsx: 스캔 버튼 onClick 사전 게이트 — status!=='authenticated' 시 doomed 모달 open
  대신 signin 유도(§11.366 useSession status 패턴 재사용).

canonical truth 보존: auth.ts/미들웨어 불변. 403 CSRF retry 보존.

production effect: 세션 만료 사용자가 액션 시 dead-end 대신 즉시 재로그인(callbackUrl 복귀).
모든 csrfFetch mutation 경로 systemic 적용.

Out of scope: 403 권한거부 redirect(loop 위험). 미들웨어/auth 변경.

Rollback: api-client.ts / Header.tsx 파일별 독립 revert.
