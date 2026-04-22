# Post-Launch Monitoring Readiness Checklist

- **Date:** 2026-04-22
- **Scope:** read-only 준비 체크리스트. 코드/DB/migration/env 변경 없음.
- **Upstream lock:** `docs/reports/release-prep-p1-reconciliation.md` (commit `65cbd739`) — P1 release-prep blocker = 0 기준.
- **Constraints:** no code change, no migration, no DB change, no parked task 착수.

---

## 0. 목적

release-prep P1을 닫은 뒤, 실 트래픽 유입 단계(또는 파일럿 투입)로 넘어가기 전에 **observation path**가 실제로 살아 있는지 점검하기 위한 준비 문서. 이 문서 자체는 monitoring을 수행하지 않음 — 어디서 무엇을 봐야 하고, 무엇이 escalation인지, 어떤 조건에서 parked 항목을 깨우는지의 **기준선**만 확정.

---

## 1. Monitoring Gates (7-point)

### 1.1 Sentry DSN presence / environment 분리

#### 1.1.1 Audit result (2026-04-23, read-only)

**Web (`apps/web/`): Sentry unwired.**
- `apps/web/package.json`: `@sentry/*` dependency **0건**.
- `apps/web/next.config.js`: `withSentryConfig` / sentry import **0건**.
- `apps/web/instrumentation.{ts,js}`, `sentry.{client,server,edge}.config.{ts,js}`: **파일 없음**.
- `apps/web/src/app/error.tsx:17-23`: production 분기가 TODO placeholder (`// 예: Sentry, LogRocket 등`) — 실제 capture 호출 **0건**. `error.digest` 노출은 line 39-43에서 확인.
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` 환경변수: Vercel Production 리스트 **미등록** (#24 inventory 기준).

**Mobile (`apps/mobile/`): SDK 설치만 존재.**
- `apps/mobile/package.json:14`: `"@sentry/react-native": "^8.4.0"` 존재.
- production wiring (DSN / init / error capture) 상태는 **별도 확인 대상** — 본 섹션 범위 밖.

**UAT-READINESS-REPORT PRE-10:** `⛔ 확인 필요` 상태로 기록되어 있음 — 본 결정(#25)으로 대체.

#### 1.1.2 #25 decision (2026-04-23): DEFER with sunset clause

> **Important distinction:**
> This section records the Sentry go/defer decision for the **launch window only**.
> It does **not** waive Sentry long-term. Any of sunset triggers T1–T5 below mandates immediate GO conversion.

**Verdict:** DEFER with sunset clause.

**Rationale (3 points):**

1. **대체 관측 채널 존재** — Vercel runtime logs가 web API route 500/unhandled을 자동 캡처. `error.tsx`의 `error.digest` ID 노출로 사용자 보고 → Vercel log 조회 pipeline 성립. CSRF 및 mutation 감사는 별도 telemetry 경로 보유.
2. **Sentry GO의 실질 작업 범위가 본 섹션 범위 초과** — `@sentry/nextjs` 설치, 3 config 파일, `next.config.js` wrap, `instrumentation.ts`, `error.tsx` capture 호출, sourcemap upload, Vercel env 4개 추가, issue rule 설정. 별도 `PLAN_sentry-wiring.md` 필요. 지금 착수 시 release-prep P1 completed 기조 회귀.
3. **초기 pilot traffic 볼륨 예상 낮음** — 파일럿 첫 유상 고객 계약 임박 단계 = 한자리수 고객 수준. Blind-spot window가 짧고 dense manual review로 보강 가능.

**Interim monitoring channels (5개, DEFER window 동안):**

| # | 관측 대상 | 대체 채널 | 조회 방법 | Owner |
|---|-----------|-----------|-----------|-------|
| 1 | 500 / unhandled runtime error | Vercel Deployment → Logs → Runtime | Vercel dashboard 1 click | 총괄관리자 |
| 2 | 사용자 보고 에러 | `error.tsx` `error.digest` ID (`apps/web/src/app/error.tsx:39-43`) | 사용자가 digest 전달 → Vercel logs에서 해당 digest 검색 | 총괄관리자 |
| 3 | CSRF 위반 | `/api/security/csrf-status` `telemetry.csrfEvents` | admin session 1 HTTP GET | 총괄관리자 |
| 4 | Mutation 무결성 | MutationAuditEvent table row count (traffic-pending 해제 후) | Prisma query 1 row count | 총괄관리자 |
| 5 | Build / deployment failure | Vercel deployment status + build logs | Vercel dashboard | 자동 알림 (Vercel built-in) |

**Daily manual review routine (DEFER window 동안):**
- 1일 1회 Vercel runtime logs 최근 24h ERROR 레벨 스캔 (5분 이내).
- 사용자 에러 보고 시 digest ID 기반 즉시 조회.
- 주 1회 MutationAuditEvent table row count 관측.

**Sunset triggers (T1~T5, 어느 하나라도 hit이면 즉시 `PLAN_sentry-wiring.md` 착수 → GO 전환):**

| ID | 조건 |
|----|------|
| T1 | MAU > 30 **OR** 일 API call > 1,000 |
| T2 | Vercel runtime logs 24h ERROR count > 10건 지속 |
| T3 | 첫 유상 계약 체결 → 계약 D-7 내 Sentry 필수 |
| T4 | Vercel logs로 재현 불가능한 프로덕션 버그 1건 이상 |
| T5 | 결정일 + 30일, **2026-05-23** 무조건 재평가 |

**Clarifying override (T1~T5와 병렬, 수치 미달이어도 발동):**

- 결제 / auth / RFQ / 구매 / 입고 같은 **critical workflow**에서 고객 영향 **P0/P1 오류**가 발생하고 Vercel logs만으로 **원인 추적이 부족**하면 **즉시 Sentry GO로 전환**한다.
- 이 override는 T1~T5 숫자 달성 여부와 무관하며, blind-spot 한 건이라도 critical workflow에서 발생하면 단독으로 GO 트리거가 된다.

**블로커 승격 조건 (기존 유지 + 강화):**
- 프로덕션에서 500/unhandled error가 발생했는데 위 interim channel 5개 중 **어느 것으로도 조회/원인 추적 불가**하면 blocker. 즉시 Sentry GO 전환 및 release-prep 재오픈.

**#25 Final verdict:**

```
#25 Sentry go/defer decision
Status: completed (decision recorded)
Verdict: DEFER with sunset clause (launch window only)
Long-term waiver: NO
Sunset triggers: T1~T5 + clarifying override (critical workflow P0/P1)
Hard re-evaluation date: 2026-05-23
Next gate: #26 Critical route smoke (S01/S02/S03/S07/S08 + RFQ canonical)
```

---

### 1.2 CSRF telemetry 수신 경로

**현재 상태 (read-only 실측):**
- `recordSecurityEvent` 소스: `apps/web/src/lib/security/csrf-middleware.ts`, `server-enforcement-middleware.ts`, `event-provenance-engine.ts`, `lib/security/index.ts`.
- `PLAN_batch10-soft-enforce-rollout.md` closeout 상 `full_enforce` 직행 per plan 문구. runtime env는 본 문서에서 단정하지 않음.
- `docs/plans/PLAN_batch10-soft-enforce-rollout.md` §0 Environment Reality Check: `recordSecurityEvent telemetry 수신 경로 확인` 체크 상태 미완.

**Gate 기준:**
- [ ] `recordSecurityEvent` 기록 대상 sink 확정 (DB table / log / external SIEM).
- [ ] `LABAXIS_CSRF_MODE` 프로덕션 env 실값 확인 (코드 변경 없이 Vercel env UI에서 조회).
- [ ] violation 발생 시 조회 방법 문서화 (1 query 또는 1 click 수준).

**블로커 승격 조건:**
- `full_enforce` 상태인데 violation 조회 경로가 0이면 blocker.

---

### 1.3 MutationAuditEvent monitoring gate

**현재 상태 (read-only 실측):**
- `apps/web/src/lib/audit/durable-mutation-audit.ts` 존재, contract smoke (`__tests__/durable-mutation-audit-contract.mjs`) 존재.
- `AUDIT_OPERATIONAL_RULES.md` §4 Durable 6건: approve / cancel / reverse / po_void / reclass / invites.accept.
- Migrated 0건 — live row gate = **traffic-pending**.

**Gate 기준 (traffic-pending):**
- [ ] 실 durable mutation 1건 이상 집행된 이후에만 live row 검증 의미 있음.
- [ ] 파일럿 첫 mutation 실행 후 `MutationAuditEvent` row = 1 이상 확인 (read-only SELECT).
- [ ] 6개 durable route별 1회 이상 hit되면 route coverage matrix `✓ Migrated` 로 전환.

**블로커 승격 조건 (release-prep reconciliation report §3 재기재):**
```
MutationAuditEvent escalation condition:
- actual durable mutation executed
- AND MutationAuditEvent row remains 0
- THEN blocker
```

---

### 1.4 Vercel deploy / env / ignoreCommand 상태

#### 1.4.1 vercel.json 드리프트 상태 (기존 관측 유지)

- `vercel.json` (repo root): `buildCommand = "npx prisma generate && npx prisma migrate deploy && npm run build"`, `rootDirectory = apps/web`.
- `apps/web/vercel.json`: `buildCommand = "npm run build"`, `env.NODE_ENV = "development"`, `env.PRISMA_GENERATE_DATAPROXY = "false"`.
- **드리프트 관측**: 두 vercel.json 파일이 동시에 존재. 어느 파일이 Vercel 프로젝트에서 채택되는지는 Vercel 프로젝트 설정(`Root Directory`)에 따라 결정. read-only 범위에서는 단정하지 않음.
- `ignoreCommand` 필드 양쪽 모두 미정의.

**블로커 승격 조건:**
- 실제 채택 `vercel.json`에 `prisma migrate deploy`가 포함되지 않았는데 신규 migration이 존재하면 blocker.
- `MOBILE_DEV_PASSWORD`가 프로덕션에 설정돼 있으면 blocker (UAT PRE-08 기준).

**드리프트 기록(수정은 별도 plan 필요):**
- 두 vercel.json 중 어느 쪽을 canonical로 할지 결정 + 반대 파일 제거 — **본 checklist 범위 밖**, release-prep 완료 후 별도 작업.

#### 1.4.2 Vercel env presence audit (#24 closeout, 2026-04-22)

> **Important distinction:**
> This section clears the Vercel env presence gate only.
> It does not replace critical route smoke, Sentry/go-defer decision, or post-launch telemetry validation.

**Scope:** 값 확인 없음, presence / flag / scope / last-update만 관측. Vercel 대시보드 Needs Attention 툴팁 원문은 `DATABASE_URL` 1건에 한해 heuristic 분류 목적으로 1회 추출 (값 아님). Reveal 버튼 / value 영역 / cookie / localStorage 접근 0건.

**Env inventory (Production scope, 값 미기록):**

| # | Env Name | Scope | Flag | Presence | Code Requirement | Blocker Status | Note |
|---|----------|-------|------|----------|------------------|----------------|------|
| 1 | `LABAXIS_CSRF_MODE` | Production | Sensitive | present | required (`csrf-contract.ts:85-102`) | PASS | runtime probe `/api/security/csrf-status` → `mode=full_enforce`, `rolloutGuide.current=full_enforce`, `rolloutGuide.next=done` |
| 2 | `NEXT_PUBLIC_SUPABASE_URL` | Production | — | present | required | PASS | — |
| 3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Env | — | present | required | PASS | — |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | All Env | — | present | required | PASS | — |
| 5 | `ABAXIS_CSRF_MODE` | Production | — | present (typo) | code path 0건 | non-blocker | post-launch E: full_enforce 24~48h 관측 후 삭제 |
| 6 | `DIRECT_URL` | All Env | — | present | required | PASS | — |
| 7 | `DATABASE_URL` | All Env | Needs Attention | present | required | PASS (hygiene only) | Vercel tooltip: "looks like a secret; consider rotating and saving as Sensitive" |
| 8 | `GOOGLE_GEMINI_API_KEY` | All Env | Needs Attention | present | required (AI 기능) | PASS (hygiene only) | 동일 heuristic 추정 (원문 미확보) |
| 9 | `NEXTAUTH_SECRET` | All Env | Needs Attention | present | required (`auth.ts:14` fallback) | PASS (hygiene only) | 동일 heuristic 추정 |
| 10 | `AUTH_SECRET` | All Env | Needs Attention | present | required (`auth.ts:14` primary) | PASS (hygiene only) | 동일 heuristic 추정 |

**Missing envs 평가 (6건, 전부 code fallback 존재):**

| Env Name | Code Reference | Missing 허용 근거 | Blocker Status |
|----------|----------------|------------------|----------------|
| `NEXTAUTH_URL` | `apps/web/src/lib/env.ts:17` | `VERCEL_URL` 자동 주입이 우선 (`env.ts:12`) | non-blocker on Vercel Production |
| `AUTH_URL` | 동일 helper 경유 | 동일 | non-blocker |
| `GOOGLE_CLIENT_ID` | `apps/web/src/auth.ts:9` | conditional provider (`auth.ts:19`): `...(hasGoogleOAuth ? [Google(...)] : [])` | non-blocker (missing 시 provider 배열 비어있음, NextAuth 부팅 정상) |
| `GOOGLE_CLIENT_SECRET` | `apps/web/src/auth.ts:10` | 동일 | non-blocker |
| `MOBILE_JWT_SECRET` | `apps/web/src/lib/auth/mobile-jwt.ts:18` | `AUTH_SECRET` fallback: `MOBILE_JWT_SECRET \|\| AUTH_SECRET \|\| ""` | non-blocker (`AUTH_SECRET` present) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | grep 0건 | 코드 참조 없음 — `ANON_KEY` 단일 사용 | non-blocker |

**Missing = GO condition (UAT PRE-08):**
- `MOBILE_DEV_PASSWORD` — Vercel Production 리스트에 미등록 ✅

**Hard NO-GO assessment:**

- `LABAXIS_CSRF_MODE` runtime probe **PASS** — `/api/security/csrf-status` 응답에서 `mode=full_enforce`, `rolloutGuide.current=full_enforce`, `rolloutGuide.next=done` 3개 조건 모두 충족.
- `ABAXIS_CSRF_MODE`는 typo env이며 code path 0건 → runtime 영향 없음 (grep `ABAXIS_CSRF_MODE` 전체 레포 매치 0건).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`은 conditional provider 구조상 **technical boot blocker 아님** (`auth.ts:19`).
- `NEXTAUTH_URL` / `AUTH_URL`은 `VERCEL_URL` 우선 구조상 **blocker 아님** (`env.ts:12`).
- `MOBILE_JWT_SECRET`은 `AUTH_SECRET` fallback으로 **web release blocker 아님** (`mobile-jwt.ts:18`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 **code reference 0건이면 blocker 아님**.

**Post-launch follow-ups (release blocker 아님, 별도 작업 큐):**

| ID | 항목 | 관측/행동 조건 |
|----|------|----------------|
| A | Google OAuth UI dead-button check | Sign-in 페이지에 "Google 로그인" CTA가 렌더되는데 env 없어서 provider가 빈 배열이면 dead button. **critical route smoke 전 확인**. |
| B | `VERCEL_URL` / custom domain redirect integrity smoke | Custom domain 연결 후 OAuth callback URL이 Vercel preview URL을 반환하지 않는지 검증. |
| C | Mobile secret separation before mobile production | 모바일 앱 프로덕션 배포 전 `MOBILE_JWT_SECRET`을 `AUTH_SECRET`와 분리. |
| D | Needs Attention envs → Sensitive flag hygiene cleanup | `DATABASE_URL`, `GOOGLE_GEMINI_API_KEY`, `NEXTAUTH_SECRET`, `AUTH_SECRET` 4건을 Sensitive 플래그로 일괄 전환. |
| E | `ABAXIS_CSRF_MODE` typo env deletion | `full_enforce` 안정 24~48h 관측 후 Vercel에서 삭제. 별도 커밋. |

**#24 Final verdict:**

```
#24 Vercel env presence audit
Status: completed
Verdict: CLEAN / GO for env presence gate only
Overall post-launch readiness: not final yet
Next gate: #25 Sentry go/defer decision
```

---

### 1.5 Critical route smoke checklist

**현재 상태 (read-only 실측):**
- `UAT-READINESS-REPORT.md` §4 Test Scenario Pack S01~S12 존재.
- `docs/CSRF_COVERAGE_MATRIX_V2.md`: 47 highRisk routes + 9 exempt routes 정의.
- `docs/reports/16c-rfq-persistence-smoke-closeout.md`: RFQ canonical path 최신 smoke.

**Post-launch smoke 최소 범위:**
- [ ] S01 제품 검색 → 비교 → 견적 요청 (RESEARCHER / Desktop)
- [ ] S02 견적 → 구매 전환 (RESEARCHER / Desktop+Mobile)
- [ ] S03 구매 → 입고 → 재고 반영 (BUYER)
- [ ] S07 비관리자 admin API 차단 (RESEARCHER → 403 기대)
- [ ] S08 admin 대시보드 조회 (ADMIN)
- [ ] RFQ handoff canonical path 1회 재현 (`#16c` closeout 경로 그대로)

**Gate 기준:**
- [ ] 6개 smoke 모두 PASS 시 post-launch smoke complete.
- [ ] 실패 1건 이상 시 해당 시나리오의 route가 CSRF highRisk / MutationAuditEvent durable인지 먼저 확인 후 escalate 판단.

**블로커 승격 조건:**
- S07 (비관리자 admin API 차단) 실패 시 즉시 release-prep 재오픈.

---

### 1.6 Post-launch escalation criteria

| Signal | 관측 소스 | 임계치 | Escalation |
| --- | --- | --- | --- |
| unhandled 500 | Vercel runtime logs (Sentry 미채용 시) | 5분 내 3건 이상 | incident-response skill 발동 |
| CSRF violation (full_enforce) | `recordSecurityEvent` sink | 24h 내 1건 이상 | CSRF route registry 재검토, violation payload 조사 |
| durable mutation executed + MutationAuditEvent row = 0 | `MutationAuditEvent` SELECT | 1건 이상 | Durable audit wiring 긴급 triage |
| 비관리자 admin API 200 응답 | admin route smoke | 1건 이상 | 즉시 release-prep 재오픈, P0 |
| RFQ handoff banner 미렌더 | user report + `sessionStorage` 확인 | 1건 이상 | #19 복원 또는 canonical smoke 재실행 |
| Vercel deploy 실패 | Vercel 대시보드 | 연속 2회 | Vercel env / ignoreCommand / build log 조사 |

**On-call 전제:**
- [ ] 각 signal별 1차 조사 담당 사전 명시 (총괄관리자 + 1 백업).
- [ ] rollback 권한(Vercel env flip back, redeploy) 최소 1명 상시 확보.

---

### 1.7 Parked tasks wake-up trigger

| 항목 | Wake-up 조건 |
| --- | --- |
| #11 DB schema drift | schema ↔ 실 row 불일치로 API 500 1건 이상 관측 시 |
| #16d Vendor dispatch smoke | 파일럿 user가 canonical Quote 생성 후 "벤더 발송" CTA를 실행하는 시점 |
| #19 SF1 sessionStorage lost across signin redirect | 실제 사용자에서 RFQ handoff 재현 실패 1건 이상 보고 시 |
| #22 / #16.1 Legacy RequestWizardModal 500 | legacy 경로 진입 가능 CTA가 프로덕션에 노출됐다고 관측된 시점 |
| #16.2 `/test/search` 3중 compare surface drift | canonical 외 compare surface를 통해 submit이 관측된 시점 (또는 `/test/*` 경로의 파일럿 노출 검토 시) |
| Toss Payments migration | 파일럿 첫 유상 고객 계약 임박, 또는 세금계산서 요구 발생 시 (CEO 결정 2026-04-18 트리거) |
| Support Center expansion | post-launch 30일 내 support ticket 패턴 집적 후 재평가 |
| Safety / Inventory 추가 UI 정리 | P2 후보, 파일럿 피드백 기반으로 재평가 |

**착수 금지 원칙:** 위 wake-up 조건이 실제로 관측되기 전에는 수동으로 착수하지 않음.

---

## 2. Go / No-Go Criteria (post-launch 진입 전)

**GO 조건 (모두 충족):**
- [x] P1 release-prep blocker = 0 (commit `65cbd739` reconciliation report)
- [ ] §1.4 Vercel env presence 전수 확인 완료 (`MOBILE_DEV_PASSWORD` 미설정 포함)
- [ ] §1.5 critical route smoke 6건 중 S07 admin 차단은 반드시 PASS
- [ ] §1.6 on-call 담당 지정 완료 + rollback 권한 확보
- [ ] §1.1 Sentry 채용 여부 결정 (go/defer 둘 다 허용, 미결정은 NO-GO)
- [ ] §1.2 CSRF violation 조회 경로 1개 이상 문서화
- [ ] §1.3 MutationAuditEvent read-path 재확인 (앞선 12번 task 근거)

**NO-GO 조건 (1건이라도 해당):**
- [ ] §1.4 `MOBILE_DEV_PASSWORD` 프로덕션 설정 확인됨
- [ ] §1.4 미채택 `vercel.json`이 `prisma migrate deploy`를 포함하지 않고 신규 migration 존재
- [ ] §1.5 S07 비관리자 admin API 차단 실패
- [ ] §1.1 Sentry 채용 여부 미결정

---

## 3. Escalation Triggers (post-launch 진입 이후)

§1.6 표의 각 signal 임계치 초과 시 해당 행의 escalation 절차 실행. 다만 다음 3건은 자동 P0:

1. 비관리자 admin API 200 응답 1건 이상 (§1.5 S07)
2. `durable mutation executed + MutationAuditEvent row = 0` 관측 (§1.3)
3. `full_enforce` 상태에서 CSRF violation으로 인한 프로덕션 중단 (§1.2)

---

## 4. Governance Statement

- 본 문서는 read-only 체크리스트입니다.
- 코드·스키마·migration·DB·seed·env 변경 없음.
- canonical truth 보호: YES.
- page-per-feature / chatbot·assistant 재해석 / dead button / no-op / fake success 금지 원칙 유지.
- 본 문서의 체크 완료 행위는 **관측·기록**만 수행. 신규 기능 추가·parked 항목 수동 착수 금지.

---

## 5. Next Step

이 문서를 커밋한 뒤에는 **실행 단계(Sentry go/defer 결정, env presence 실측, critical route smoke 수행)**로 넘어갑니다. 실행 단계는 본 checklist의 gate별로 **별도 승인 + 별도 read-only audit**을 받은 후에만 진행.

지금 착수 금지 리스트는 `release-prep-p1-reconciliation.md` §5와 동일하게 유지.
