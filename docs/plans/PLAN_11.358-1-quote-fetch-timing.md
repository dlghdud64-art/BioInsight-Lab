# Implementation Plan: §11.358-1 — 견적 최초진입 fetch 간헐 실패 (타이밍/에러 UI)

- **Status:** 🗂️ Plan (Phase 0 코드 확정 — 착수 가능, 읽기 fetch라 외부영향 0)
- **Last Updated:** 2026-06-03
- **대상:** `apps/mobile` 견적 탭(`app/(tabs)/quotes.tsx`) + `lib/queryClient.ts`.

## Phase 0 — 코드 확정 (2026-06-03)
- **retry:2 존재**(`queryClient`) — 자동 재시도 O. 매번 아닌 간헐 실패와 정합(retry 대부분 구제).
- auth: apiClient 인터셉터가 요청마다 accessToken await → 단일 요청 토큰 race 처리됨. 401 시 refresh 인터셉터도 존재.
- **auth-ready 가드 부재**: `authPreflight`(lib/api.ts) 정의됐으나 **호출처 0(dead).** 앱 진입/탭 fetch 전 게이트 없음 → cold 윈도우 발사.
- **에러 UI 부재(핵심)**: `quotes.tsx` 가 `useQuotes` 에서 `isError` 미구독. 실패 시 `quotes=undefined → filtered=[] → ListEmptyComponent "견적이 없습니다"` → **실패를 빈 상태로 오표시.** 사용자가 "실패"를 "없음"으로 오인 = 체감 악화의 진짜 원인.
- 응답코드: sandbox 불가(기기 네트워크탭 필요). 코드상 cold-start race 유력.

## 근본 원인 (계층 확정)
1. (체감 핵심) **에러 UI 부재** → 실패가 빈 상태로 위장. 
2. (간헐 트리거) **cold-start race** + auth-ready 가드 부재. retry:2 가 대부분 구제하나 cold 윈도우 3회 실패 시 노출.

## Fix 후보 (전부 읽기 fetch, 외부영향 0)
- **F-1 (권장·핵심) — 에러 UI 정직화**: `quotes.tsx` 에 `isError` 구독 → 실패 시 `<ErrorState>`(이미 존재하는 컴포넌트) + "다시 시도" 버튼(`refetch`). 빈 상태("견적이 없습니다")와 **실패 상태 분리.** = 실패를 정직하게 + 즉시 수동 재시도.
- **F-2 (보강) — retry 유지/튜닝**: retry:2 유지. 필요 시 `retryDelay` exponential 명시(이미 기본 적용). 변경 최소.
- **F-3 (보류) — auth-ready 가드**: 인터셉터가 이미 per-request 토큰 await → 추가 가드 효과 제한적 + cold start 지연 부작용. **보류**(과잉).

## 권장 착수
- **F-1 단독 우선**(surgical, 외부영향 0). quotes 외 동일 패턴(inventory/purchases 등 isError 미구독) 있으면 동형 적용은 후속.
- 검증: 모바일 test 없음 → grep(isError/ErrorState/재시도 wiring). 런타임 재현은 기기.

## Out of Scope
- 응답코드 실측(기기 네트워크탭) — env/§11.358-1 재현 로그(호영님). cold-start 실측은 ops.
- 타 탭 에러 UI 동형 확산(후속).

## Notes
- §11.358 Phase 0(이전)의 "코드 정상·env 의심"과 정합 — 인증/라우트는 정상, 체감 결함은 **에러 UI 부재**가 핵심. F-1 이 가장 실속.

---
## 부록 — F-1 구현 완료 (Claude, 2026-06-03, push 대기)
- ✅ `quotes` + **`inventory`/`purchases`(동일 갭 확인 → 동형)** 3탭에 `isError` 구독 + `<ErrorState onRetry={refetch}>` 분기. 실패를 빈 상태("···없습니다")로 위장하던 것 → 정직 표시 + 재시도 버튼.
- ✅ F-2(retry:2) 유지, F-3(auth-ready 가드) 보류(인터셉터 per-request await로 효과 제한 + cold start 지연 부작용).
- ✅ migration 0, 읽기 fetch라 외부영향 0. grep 검증(3탭 isError+ErrorState+onRetry).
- ⚠️ 응답코드 실측·cold-start 재현은 기기(ops). F-1 은 원인 불문 개선이라 선적용 안전.
- **후속**: 디테일([id]) 화면 에러 UI 동형, 응답코드 실측 시 cold-start 추가 완화.
