# #25 Sentry DEFER — Sunset Trigger Operational Runbook

- Status: **ACTIVE** (DEFER clause 운영 규약 가동)
- Owner (decision): 호영 (총괄관리자)
- Opened: 2026-04-24 (ADR-002 Phase 6 이후)
- Parent decision: commit `3a777619` — `#25 Sentry DEFER with sunset clause`
- Source of trigger definitions: `docs/reports/post-launch-monitoring-readiness-checklist.md §1.1.2`

---

## 1. Context

2026-04-23 의 `#25 Sentry go/defer` 결정은 **launch window 한정 DEFER**. Sentry 자체를 장기 면제하는 결정이 아니라, release-prep P1 완료 기조를 회귀시키지 않기 위해 wiring 작업을 유예한 조건부 유예다. 조건 (T1~T5 + 병렬 override + hard re-eval date) 중 하나라도 hit 되면 즉시 `PLAN_sentry-wiring.md` 신규 작성 → 실 Sentry wiring 으로 GO 전환이 의무화된다.

본 runbook 의 목적은 위 trigger 들을 **"정의만 있는 trigger"** 에서 **"누가 · 언제 · 무엇으로 감지 · 다음 액션" 이 명시된 운영 가능한 규약** 으로 고정하는 것이다. Sentry wiring 자체는 이 runbook 의 scope 바깥 (§6 참조).

### 1.1 왜 DEFER 였는가 (요약)

- Sentry GO 의 실 작업 범위는 `@sentry/nextjs` 설치 + 3 config 파일 + `next.config.js` wrap + `instrumentation.ts` + `error.tsx` capture + sourcemap upload + Vercel env 4개 + issue rule 설정. release-prep P1 completed 기조를 깬다.
- 대체 monitoring 5 channel (Vercel logs · `error.digest` · CSRF telemetry · `MutationAuditEvent` · deployment status) 로 launch window 를 버틴다.

### 1.2 왜 DEFER 가 면제가 아닌가

- 5 channel 중 하나라도 blind-spot 이 되면 canonical truth 감시가 깨진다.
- 유상 계약이 들어오면 compliance 근거가 필요해진다.
- 결정일 (2026-04-23) + 30일 = **2026-05-23** 에 반드시 재평가.

---

## 2. T1~T5 감지 매트릭스

| ID | Condition | 감지 주체 | 주기 | 감지 신호 source | SLA | Next action |
|----|-----------|-----------|------|------------------|-----|-------------|
| **T1** | MAU > 30 **또는** 일 API call > 1,000 | 호영 (수동) + 자동 스크립트 (옵션) | 주 1회 (금요) | Vercel Analytics · `db.user.count` · `db.activityLog.count({createdAt: {gte: 24h}})` | 7d | `PLAN_sentry-wiring.md` 신규 + kickoff |
| **T2** | Vercel runtime logs 24h `ERROR` count > 10건 지속 | 호영 (수동) / alert 설정 시 자동 | 매일 1회 또는 threshold alert | Vercel Dashboard → Project → Logs → level=error | 24h | 위와 동일 |
| **T3** | 첫 유상 계약 체결 | 호영 | 계약 체결 즉시 | 영업 파이프라인 / 계약 문서 | 계약 D-7 | 위와 동일 |
| **T4** | Vercel logs 로 **재현 불가능** 한 프로덕션 버그 1건 이상 | 호영 (incident 발생 시) + 사용자 보고 | 문제 보고 시 (event-driven) | incident postmortem / 사용자 문의 / `#A01` L1 in-memory 증거가 cold-start 로 소실된 경우 포함 | 24h | 위와 동일 |
| **T5** | **2026-05-23** 도달 (결정일 + 30일) | 호영 | 캘린더 고정 | 캘린더 / 본 runbook §7 Changelog 열람 | 당일 | Re-decision: **GO** 또는 **DEFER 연장** (연장 시 재사유 필수 기록) |
| **병렬 override** | `결제 / auth / RFQ / 구매 / 입고` 같은 critical workflow 에서 P0/P1 오류 + Vercel logs 로 원인 추적 부족 | 호영 or 사용자 보고 | 문제 발생 시 (event-driven) | 사용자 보고 · 시스템 오류 · incident | **0d — 즉시** | 수치 미달이어도 **즉시 GO** |

### 2.1 매트릭스 해석 규칙

- T1, T2 는 threshold-driven. 주기적 모니터링으로 감지.
- T3, T4, T5 는 event-driven. 캘린더 또는 사고 발생 시 감지.
- 병렬 override 는 수치 독립. canonical truth 보호의 hard trigger.
- 한 trigger 라도 hit 되면 다른 trigger 재확인 없이 단독 발동. "조건 중첩" 요건 없음.

---

## 3. Interim Monitoring Channels (DEFER 기간의 대체 감지 스택)

Sentry 가 wired 되기 전까지 아래 5 channel 이 유일한 오류 추적 근거다. 어느 하나라도 조회 불가 상태가 되면 §2 병렬 override 즉시 발동.

| # | Channel | 역할 | 비고 |
|---|---------|------|------|
| C1 | Vercel runtime logs | 서버사이드 error / stack trace / request context | 가장 load-bearing |
| C2 | `error.digest` | 클라이언트 error boundary 가 서버 쪽으로 fingerprint 포워딩 | `apps/web/src/app/error.tsx` |
| C3 | CSRF telemetry | 보안 거부 / 차단 이벤트 | **L1 in-memory** — cold-start 손실 위험 (#A01 Phase 1 확정) |
| C4 | `MutationAuditEvent` | canonical truth mutation 의 success / blocked / error 추적 | 6 routes 한정 (AUDIT_OPERATIONAL_RULES.md §4) |
| C5 | Vercel deployment status | build / deploy 실패 감지 | Vercel dashboard |

### 3.1 Blind-spot blocker

`500` 또는 `unhandled error` 가 production 에서 관측됐는데 위 C1~C5 **어느 것으로도 조회·추적 불가** 하면, 이것은 clarifying override 발동 조건이다. 발생 즉시 Sentry GO 전환 + release-prep 재오픈.

### 3.2 L1 in-memory (C3) 관련 구조적 경고

CSRF 차단 / 권한 거부 / impossible-transition 이벤트는 `#A01` audit trail 감사 결과 **process-scoped in-memory 만 저장**. serverless cold-start 마다 손실. DEFER 기간 동안 보안 이벤트 누락 가능성이 있다는 점을 operator 가 인지하고 있어야 한다. 이는 별도 트랙 `#A03` (parked) 으로 해소 예정.

---

## 4. 에스컬레이션 경로

```
Step 1  감지 주체가 trigger 충족 식별 (§2 매트릭스 또는 §3.1 blind-spot)
          └── self-trigger (호영) 또는 사용자 보고
Step 2  호영 확인 → 본 runbook §7 Changelog 에 "YYYY-MM-DD  T{n} hit: <증거>" 한 줄 append
Step 3  SLA 내 (§2) `PLAN_sentry-wiring.md` 신규 작성 + 착수 선언
Step 4  Sentry 실 wiring (SDK · config · env · sourcemap · issue rule · 테스트)
Step 5  Sentry live 확인 후 본 runbook 상태 `ACTIVE` → `SUPERSEDED` 로 변경
          + `AUDIT_OPERATIONAL_RULES.md` 등 관련 문서에 "Sentry active since YYYY-MM-DD" 선언
```

### 4.1 연장 경로 (T5 에서만 허용)

T5 (2026-05-23) 도달 시점에 GO 가 아닌 **DEFER 연장** 으로 결정할 수 있다. 단 이 경우 다음을 모두 충족해야 한다:
1. T1~T4, 병렬 override, §3.1 blind-spot 모두 미발동 상태.
2. §7 Changelog 에 "YYYY-MM-DD  T5 reached → DEFER 연장 (사유: ...)  Next re-eval: YYYY-MM-DD" 명시 기록.
3. 다음 재평가 날짜 설정 (최대 +30일).

---

## 5. Sunset 진입 조건 (GO 전환 공식 선언)

GO 전환이 **의무** 인 경우 — 아래 중 하나라도 hit:
- T1 / T2 / T3 / T4 중 하나 이상
- 병렬 override (critical workflow P0/P1 + 추적 부족)
- §3.1 Blind-spot blocker (500/unhandled 인데 5 channel 모두 blind)
- T5 2026-05-23 도달 (이 경우 "GO" 또는 "DEFER 연장 with 재사유" 공백 불가)

GO 전환이 **선택** 인 경우:
- 없음. 본 runbook 은 sunset 경로를 전부 의무화한다.

---

## 6. Out of Scope (본 runbook 에서 다루지 않음)

이 runbook 은 **감지·에스컬레이션 규약만** 고정한다. 실제 Sentry 적용은 별도 문서에서:

- `@sentry/nextjs` 설치 / `sentry.{client,server,edge}.config.{ts,js}` 작성
- `next.config.js` `withSentryConfig` wrap
- `apps/web/src/app/error.tsx` capture 호출 실 구현
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` 등 env 주입 (Vercel env 등록)
- sourcemap upload 파이프라인
- Sentry issue rule / alert 룰 설계

→ 전부 **trigger 발동 시 신규 `PLAN_sentry-wiring.md`** 에서 처리.

관련 parked 트랙 (본 runbook 에서 개시하지 않음):
- `#A03` — L1 보안 이벤트 (CSRF · 권한 거부 · impossible transition) durable layer 로 승격
- `#A04` — Quote / Order create 를 L3 AuditLog 로 승격
- `#A05` — 감사 evidence 내보내기 · 보존 · SIEM 연동 설계

---

## 7. Changelog

- 2026-04-23 — commit `3a777619` — `#25 DEFER with sunset clause` 최초 결정. T1~T5 + 2026-05-23 hard re-eval + 병렬 override 정의. `post-launch-monitoring-readiness-checklist.md §1.1.2` 에 기록.
- 2026-04-24 — 본 runbook 생성. T1~T5 감지 매트릭스 + 5+1 field (Condition / 감지 주체 / 주기 / Source / SLA / Next action) 고정. §3.2 에 `#A01` 결과로 드러난 L1 in-memory 손실 경고 추가. `#25` DEFER 를 "정의" 에서 "운영 가능한 규약" 으로 격상.

---

## 8. Related

- `docs/reports/post-launch-monitoring-readiness-checklist.md §1.1.2` — T1~T5 원문.
- `apps/web/src/lib/audit/AUDIT_OPERATIONAL_RULES.md §2` — durable audit 은 `MutationAuditEvent` 만 운영 신뢰 (C4 의 근거).
- commit `3a777619` — `#25` 최초 결정.
- commit `272931fd` — `#A01 / #A02` audit trail 감사 결과, `Migrated 0건 → 6건` 정정.
- 미생성 — `PLAN_sentry-wiring.md` (sunset trigger 발동 시 신규).
