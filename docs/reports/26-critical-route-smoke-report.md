# #26 Critical Route Smoke — STOPPED at S07 (P0 Authorization Gap)

- Date: 2026-04-23
- Operator: Claude (governance: `labaxis-bug-hunter` B안 — read-only static audit)
- Parent task: `#26 Critical Route Smoke (S01/S02/S03/S07/S08 + RFQ canonical)`
- Predecessor commits: `ebd1c579` (#24 env presence), `3a777619` (#25 Sentry defer)

---

## 1. Decision

`#26` Critical Route Smoke는 **S07에서 중단**합니다. Option A (code audit)만으로 admin route authorization guard drift가 정적으로 확정되어, Option B (unauthenticated runtime smoke)와 이후 시나리오(S08, S01, S02, S03)는 **모두 실행하지 않음**.

| 항목 | 값 |
| --- | --- |
| Verdict | **FAIL** |
| Severity | **P0** (security / authorization boundary failure) |
| Blocker | **YES** |
| Launch readiness | **NO-GO until #27 closes** |
| Release-prep | **재오픈** |

`#16c` RFQ canonical handoff smoke PASS evidence는 계속 유효 (commit `66a9cb1b`) — 본 중단으로 영향받지 않음.

---

## 2. S07 Execution Method

### 선택된 경로: Option A — Static Code Audit

- **환경:** 로컬 read-only 소스 트리. production URL 접촉 0건.
- **범위:** `apps/web/src/app/api/admin/**`, `apps/web/src/app/dashboard/admin/**`, `apps/web/src/middleware.ts`, `apps/web/src/lib/api/admin.ts`, `apps/web/src/lib/auth/scope.ts`.
- **수단:** `find` / `grep` inventory + 개별 route `Read` 검증. 코드 수정 0건.

### 포기된 경로: Option B — Unauthenticated Runtime Smoke

- Option A에서 FAIL이 확정된 시점에 B를 더 돌리면 "증거 수집"이 "진행해도 되는 상태"로 오인될 위험. 집행 중단.

---

## 3. S07 Result

### 3.1 Expected (요구사항)

RESEARCHER 역할 또는 그 이하 비관리자 세션은:

1. `/dashboard/admin` 페이지를 렌더하지 못한다.
2. `/api/admin/**` 의 어떤 route도 `2xx` + admin payload를 반환하지 않는다 (기대: `403 Forbidden` 또는 `401 Unauthorized`).
3. 로그아웃 상태는 모든 admin surface에서 `401` 또는 signin redirect.

### 3.2 Actual (정적 코드 관측)

- `middleware.ts:108-125` — `/dashboard/*` 경로 가드는 `isLoggedIn` 체크만. **role 체크 없음**.
- `apps/web/src/app/dashboard/admin/page.tsx:52-56` — `status === "unauthenticated"` 시만 signin 리다이렉트. role 체크는 "서버에서 처리됨" 주석뿐. 실제 서버 단은 API별로 불일치.
- `apps/web/src/app/api/admin/**` 21개 route 감사:

**TIER 1 — 정상 가드 (auth + `isAdmin()` 또는 `enforceAction`) — 9건**

```
/api/admin/users                                     auth + isAdmin
/api/admin/products                                  auth + isAdmin
/api/admin/products/[id]                             auth + enforceAction + isAdmin
/api/admin/quotes                                    auth + isAdmin
/api/admin/orders                                    auth + enforceAction + isAdmin
/api/admin/orders/[id]/status                        auth + enforceAction + isAdmin
/api/admin/inbound-emails                            auth + isAdmin
/api/admin/inbound-emails/[id]/attach-to-quote       auth + enforceAction + isAdmin
/api/admin/seed                                      auth + enforceAction(sensitive_data_import)
```

**TIER 2 — 인증만 있고 role 체크 없음 — 7건 (RESEARCHER 접근 시 2xx)**

```
/api/admin/canary-preflight      auth only  → canary preflight payload
/api/admin/canary-promotion      auth only  → promotion gate + anomaly
/api/admin/canary-watchboard     auth only  → real-time canary metrics
/api/admin/quotes/[id]           auth only  → quote 본문 + user.email + user.name PII 노출
/api/admin/rollout-gate          auth only  → go/no-go gate 판정
/api/admin/shadow-report         auth only  → shadow 비교 리포트
/api/admin/shadow-sampling       auth only  → high-risk 샘플링 데이터
```

**TIER 3 — 인증 체크조차 없음 (mock data) — 3건 (로그아웃 상태에서도 2xx)**

```
/api/admin/activity   NO auth, hardcoded mock activities
/api/admin/charts     NO auth, random/hardcoded distribution
/api/admin/stats      NO auth, hardcoded stats (placeholder KRW 등)
```

### 3.3 Verdict — FAIL / P0

- **TIER 2**의 `/api/admin/quotes/[id]` — 실제 Quote row + user.email + user.name을 RESEARCHER가 조회 가능 → **canonical truth 및 PII 노출 (명백한 P0)**.
- **TIER 2** 6건 추가 — 운영 intelligence (canary/shadow/rollout gate) 비관리자 노출.
- **TIER 3** 3건 — 로그아웃 상태에서도 admin-shaped payload 반환 (P1 hygiene, 그러나 P0 판정에 가산).
- **Page-level guard 부재** — RESEARCHER가 `/dashboard/admin` 셸 자체를 로드.

기대값 불충족 항목이 1건 이상이면 FAIL이며, S07은 FAIL 시 P0로 승격하는 gate. 따라서 **FAIL / P0 확정**.

---

## 4. Stopped Scope (본 smoke에서 집행하지 않음)

| 시나리오 | 상태 | 사유 |
| --- | --- | --- |
| S08 admin dashboard read-only 조회 | **PARKED** | S07 FAIL 상태에서 의미 없음. #27 해소 후 재개. |
| S01 제품 검색 → 비교 → 견적 요청 | **PARKED** | #26c isolated write chain은 Stop #1 (WRITE DB 환경 미확정) 때문에 원래도 blocked. S07 FAIL과 합쳐 이중 차단. |
| S02 견적 → 구매 전환 | **PARKED** | 위와 동일. |
| S03 구매 → 입고 → 재고 반영 | **PARKED** | 위와 동일. |
| RFQ canonical | **REUSED AS PRIOR EVIDENCE** | `#16c` closeout commit `66a9cb1b` 재사용. 본 smoke에서 추가 집행 없음. |

---

## 5. Prior Evidence Preserved

- `#16c` RFQ canonical handoff persistence smoke PASS — 본 결정에 영향 없음.
- `#24` Vercel env presence gate CLEAN (commit `ebd1c579`) — env gate만. launch 전체 GO 아님.
- `#25` Sentry DEFER with sunset clause (commit `3a777619`) — launch window 한정.

---

## 6. Governance Compliance

| 금지선 | 준수 여부 |
| --- | --- |
| Production write | 0건 |
| Code change | 0건 |
| DB migration | 0건 |
| Seed 수정 | 0건 |
| Cleanup 의존 smoke | 해당 없음 (B 미실행) |
| Env values 읽기 | 0건 (`DATABASE_URL` host tail만 presence 판정) |
| Dead button / no-op / fake success | 해당 없음 |
| Canonical truth 오염 | 0건 |

---

## 7. Next — `#27 P0 Admin Authorization Guard`

본 중단의 후속 트랙으로 별도 bug-hunter 태스크 개설:

### 7.1 Scope

- Read-only root cause confirmation 먼저.
- Minimal diff fix.
- Admin dashboard 재설계 금지. 신규 page 금지. 무관한 route cleanup 금지. Mock data를 숨기는 것으로 fix 대체 금지.

### 7.2 Root cause (정적 확인 사항)

1. `middleware.ts`는 `/dashboard/*`의 로그인 여부만 검증.
2. `/dashboard/admin` page component는 role gate를 하지 않음.
3. Admin API route guard가 route별로 불일치 (TIER 1/2/3 드리프트).
4. 일부 route auth only, 일부 route auth 없음.

### 7.3 Fix direction

1. Shared `requireAdmin` / `assertAdmin` helper 확인 또는 추가 (`apps/web/src/lib/api/admin.ts:105` `isAdmin(userId)`은 있으나 helper 미일관 사용).
2. 모든 `/api/admin/**` route에 admin role gate 적용.
3. Unauthenticated → `401`.
4. Authenticated non-admin → `403`.
5. ADMIN → 기존 behavior 유지.
6. `/dashboard/admin` page-level access도 non-admin 차단.
7. Mock admin endpoints도 최소 auth+admin gate 적용 또는 비활성화.

### 7.4 Prohibited

- Console warning으로만 처리.
- "mock route라서 예외" 처리.
- Route별 임시 `if`문 남발.
- Non-admin에게 admin page shell 렌더 후 API만 막는 구조.

### 7.5 Regression tests (최소 기준)

- RESEARCHER: `/dashboard/admin` 접근 차단. 모든 `/api/admin/**` route `403`.
- Unauthenticated: 모든 `/api/admin/**` route `401` 또는 auth redirect.
- ADMIN: read-only admin APIs `200`.
- Sensitive mutation routes: 기존 `enforceAction` / CSRF / audit guard 유지.

---

## 8. Working Tree Status (문서 생성 시점)

- 본 문서 외 작업 없음. dirty files (57 M + 23 ??)는 손대지 않음.
- 본 문서만 선택 stage 후 단일 커밋.
