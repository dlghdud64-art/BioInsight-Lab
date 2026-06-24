# Implementation Plan: §auth §2/§3 — 앱 재포커스 토큰 검증 + Silent Refresh (보수적 additive)

- **Status:** ⏳ Pending
- **Started:** 2026-06-24
- **Last Updated:** 2026-06-24

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 1.✅체크 2.🧪operator vitest+`npm run build` 3.⚠️gate 통과 4.📅날짜 5.📝Notes 6.➡️다음. ⛔ gate 실패·source-of-truth 충돌·dead button/no-op/placeholder success 금지.

---

## 0. Truth Reconciliation ✅ (recon 완료 2026-06-24)

**Latest Truth:**
- 반응형 401 = **이미 존재**: `lib/api-client.ts` `redirectToSignInOn401`(csrfFetch GET+mutation 전역) + `apiClient` 401 redirect(L193-198) → toast "세션이 만료되었습니다" + `/auth/signin?callbackUrl=` redirect. signin-path guard로 loop 차단(L302). §session-expiry-global·§11.371-1.
- `auth.ts`: NextAuth v5, `session.strategy: "jwt"`(L137), **maxAge 미설정 → 기본 30일**, updateAge 기본 24h rolling. 커스텀 refresh 콜백 0.
- `providers/session-provider.tsx`: `<SessionProvider>` props 0 → NextAuth 기본 `refetchOnWindowFocus=true`(포커스 시 /api/auth/session refetch 암묵), `refetchInterval=0`(off).

**Gap:**
- §2: **선제적 포커스-시점 세션 유효성 게이트 부재** — 만료 후 탭 복귀 시 "다음 API 호출 401"까지 죽은 화면/스테일 가능(반응형 의존).
- §3: **만료 전 명시적 silent refresh 부재**(NextAuth 기본 rolling 외).

**Conflicts / Prereq:**
- 핸드오프 "H-C(401 redirect 거동) 네트워크 확인 후" — **런타임 증거 sandbox 불가**(만료 라이브 세션 관찰 필요).

**Chosen Source of Truth:**
- 런타임 증거 없이 안전한 **보수적 additive 하드닝**: 기존 `redirectToSignInOn401` 재사용 + NextAuth 기본 동작 **제거 0**. 추측성 full 재설계 금지. (호영님 승인 2026-06-24)

**Env Reality Check:**
- [ ] HEAD af597015, web=apps/web, operator vitest+build·sandbox 편집만
- [ ] 런타임 401/refocus 거동 = 호영님 라이브 확인 권고(P3)

## 1. Priority Fit
- [x] Post-release 신뢰성(blocker 아님 — 반응형 401이 이미 하드 dead-end 차단). §2/§3 = 선제 UX 개선.

## 2. Work Type
- [x] Web · [x] Auth infra(additive) · [x] Design Consistency(dead-end 0)

## 3. Overview

**Feature:** 탭 재포커스 시 세션 유효성 선제 확인(§2) + 활성 사용 중 silent refresh(§3). 기존 반응형 401 redirect를 **선제적**으로 보강(재사용), NextAuth 기본 위 additive.

**Success Criteria:**
- [ ] §2: visibilitychange/focus 시 세션 무효 감지 → 기존 signin redirect 경로 재사용(선제, 사용자 클릭 전). 유효 세션엔 무동작.
- [ ] §3: 활성 세션이 사용 중 주기적으로 silent 갱신(rolling) → 장시간 작업 중 만료 dead-end 감소. 무음(토스트/리다이렉트 0, 실제 만료 시에만 §2/반응형 발동).
- [ ] redirect loop 0(signin-path guard 재사용), focus storm 0(interval 하한/debounce).
- [ ] NextAuth 기본 동작·기존 반응형 401 **제거 0**(additive).

**Out of Scope (⚠️):**
- [ ] NextAuth provider/세션 전략 변경, maxAge 강제 단축
- [ ] refresh-token rotation 신규 인프라(OAuth provider 토큰 회전)
- [ ] 반응형 401 redirect 로직 재작성(재사용만)

**User-Facing Outcome:** 오래 자리 비운 뒤 탭 복귀 시 죽은 화면/스테일 대신 즉시 재로그인 유도(선제). 작업 중엔 세션이 조용히 연장돼 갑작스런 만료 감소.

## 4. Product Constraints
**Must Preserve:** [x] 기존 401 redirect(재사용) · [x] signin-path loop guard · [x] same-canvas · [x] NextAuth 기본
**Must Not Introduce:** [x] dead button/no-op · [x] placeholder success(가짜 "세션 유효") · [x] redirect loop · [x] focus refetch storm · [x] 추측성 redesign
**Canonical Truth Boundary:**
- Source of Truth: NextAuth session(/api/auth/session) + JWT 만료
- Derived: useSession status / 포커스 가드 판정
- Persistence: 신규 0(세션 쿠키 기존)

**UI Surface Plan:** [x] 전역 가드 컴포넌트(layout AuthSessionProvider 하위, UI 없음) — 신규 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 포커스 가드 = 신규 클라 컴포넌트(AuthFocusGuard), 기존 redirect 재사용 | additive·minimal·loop guard 재사용 | 전역 마운트 1개 추가 |
| silent refresh = SessionProvider `refetchInterval` + `refetchOnWindowFocus` 명시 | NextAuth 내장 활용(커스텀 refresh 인프라 회피) | interval 폴링(경량, /api/auth/session) |

**Dependencies:** next-auth/react(useSession/getSession), 기존 redirectToSignInOn401. 신규 패키지 0.
**Integration:** `providers/session-provider.tsx`, `app/layout.tsx`(AuthSessionProvider), `lib/api-client.ts`(redirect 재사용).

## 6. Global Test Strategy
- sentinel: SessionProvider refetch props · AuthFocusGuard visibility 리스너 + 세션 무효 시 signin redirect(기존 경로 재사용) · loop guard 보존. 각 phase GREEN 동반(delta-0).
- 런타임(실 만료 거동) = operator/호영님 라이브 smoke(sandbox 불가, P3 문서).

## 7. Implementation Phases

#### Phase 0: Truth Lock ✅ COMPLETE (2026-06-24)
- Status: [x] (위 §0)

#### Phase 1: §2 — 재포커스 세션 유효성 선제 게이트 ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**Land:** `components/auth/auth-focus-guard.tsx`(신규) — `AuthFocusGuard`: visibilitychange/focus 리스너 → 300ms debounce → `getSession()`(canonical) 무효 시 `/auth/signin?callbackUrl=` redirect(기존 경로 재사용). 안전: `wasAuthedRef`(로그인 적 있던 세션만), `isProtectedPath`(보호 경로 한정), signin-path guard, visible-only, 리스너 cleanup. `app/layout.tsx` — AuthSessionProvider 하위 CompareFlowGuard 옆 `<AuthFocusGuard />` 마운트. sentinel: `auth-focus-guard-p1.test.ts`.

**✋ Gate:** no-op/dead 0(무효+wasAuthed+보호경로 시에만), loop 0(signin guard), 가짜 만료 0(getSession canonical만), build EXIT 0, baseline-delta 0
**Rollback:** 컴포넌트 + layout 마운트(import+<AuthFocusGuard/>) revert

#### Phase 2: §3 — Silent Refresh ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**Land:** `providers/session-provider.tsx` — `<SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>`. NextAuth 내장: 활성(visible) 세션 5분마다 /api/auth/session 재조회 → JWT updateAge rolling 연장(무음), 탭 복귀 시 재검증(§2 정합). 토스트/리다이렉트 0. sentinel: `auth-silent-refresh-p2.test.ts`.

**✋ Gate:** focus storm 0(5분 interval 하한 + NextAuth는 visible 시에만 poll), 무음(placeholder success 0 — 실 만료 시에만 §2 선제/api-client 반응형 redirect), build EXIT 0, baseline-delta 0
**Rollback:** SessionProvider props revert(무props 복원)

#### Phase 3: Smoke / Rollback ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**Wiring smoke (read-only, 2026-06-24):** 3중 레이어 정합 확인 —
- §3 silent refresh: `session-provider.tsx` `refetchInterval={5*60}` + `refetchOnWindowFocus`(활성 세션 rolling 연장).
- §2 선제 게이트: `auth-focus-guard.tsx` getSession()(L57) 무효 시 signin redirect, `<AuthFocusGuard />` layout L116 마운트.
- 반응형 fallback: `api-client.ts` `redirectToSignInOn401`(L300/349/389) 불변(제거 0).
- 흐름: 작업 중 §3가 세션 무음 연장 → 만료 후 탭 복귀 시 §2가 선제 redirect → 그래도 통과 시 다음 API 401을 api-client가 반응형 redirect.

**런타임 확인(호영님 라이브 권고, sandbox 불가):** 실 만료 세션으로 탭 복귀 → 즉시 signin 이동 / 장시간 작업 중 세션 유지 확인. cowork는 라이브 세션 만료 트리거 불가.

**✋ Gate:** baseline-delta 0, build EXIT 0, rollback 문서 ✓
**Rollback:** AuthFocusGuard(컴포넌트+layout 마운트) + SessionProvider props git revert. env/flag 없음.

## 8. Addenda
**Auth(적용):** 세션 무효 판정은 NextAuth canonical(useSession status==="unauthenticated"/getSession null) — 자체 만료 계산 금지(가짜 만료 0). redirect는 기존 경로 단일점.

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| NextAuth 기본 위 중복/추측성 | Med | Med | additive·기본 제거 0·런타임 확인은 호영님 라이브(P3) |
| focus refetch storm(/api/auth/session 폭주) | Med | Med | interval 하한(분 단위)·visibility debounce |
| redirect loop(만료 판정 오류) | Low | High | signin-path guard 재사용·canonical status만 신뢰 |
| 가짜 만료(유효 세션 강제 로그아웃) | Low | High | useSession/getSession canonical만, 자체 만료 계산 0 |

## 10. Rollback Strategy
- P1: AuthFocusGuard + layout 마운트 revert. P2: SessionProvider props revert. P3: 문서. env/flag 없음 — git revert.

## 11. Progress Tracking
- Overall: 100%(P0~P3 완료) · Current: 종결 · Blocker: 없음
**Checklist:** [x] P0 [x] P1(§2) [x] P2(§3) [x] P3(smoke)
✅ §auth §2/§3 종결 — 3중 레이어(silent refresh → 선제 포커스 게이트 → 반응형 401). NextAuth 기본·기존 401 제거 0(additive).

## 12. Notes & Learnings
**Decisions (2026-06-24, 호영님):**
- §auth §2/§3 진행, **보수적 additive**(기존 반응형 401 재사용·NextAuth 기본 제거 0).
**Truth-lock 핵심:** 반응형 401 redirect는 이미 존재(api-client) → §2/§3는 선제 보강. 런타임 증거(H-C)는 sandbox 불가 → 보수적 설계로 우회, 실거동은 P3 라이브 확인.
