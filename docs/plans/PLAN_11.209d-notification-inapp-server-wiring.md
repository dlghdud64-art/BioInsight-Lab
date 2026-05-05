# Implementation Plan: §11.209d-notification-inapp-server-wiring

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (인프라 land 발견) → Phase 1 RED 20/21 fail → Phase 2 GREEN (3 type + 3 hooks 21/21 PASS) → Phase 3 ADR close

⛔ DO NOT modify NotificationEvent / NotificationAction schema (이미 land + 다른 도메인 caller 사용 중)
⛔ DO NOT modify dispatchNotificationEvent helper (이미 land)
⛔ DO NOT modify mutation atomic (Stage 1 email + Stage 2 in-app 모두 best effort, try/catch graceful)
⛔ DO NOT use `APPROVAL_NEEDED` 재사용 — defaultActions 의 EMAIL_DRAFT 가 Stage 1 sendEmail 과 contract 충돌. 3 결재-specific 신규 type 추가.

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 발견):**
- NotificationEvent + NotificationAction model 이미 land (schema.prisma:2436-2495)
- `lib/notifications/` 인프라 land (event-types, event-dispatcher, event-action-map, notification-query, action-executor, governance-bridge, index)
- `dispatchNotificationEvent({ eventType, entityType, entityId, triggeredBy, metadata, recipients })` helper land (transaction 안에서 NotificationEvent + NotificationAction 자동 생성)
- `/api/notifications` GET (사용자 알림 list + unread count) + POST (admin 이벤트 생성) land
- `dashboard/notifications` 페이지 + UI 컴포넌트 land
- 기존 12개 NOTIFICATION_EVENT_TYPES 정의됨 (QUOTE_REQUESTED / APPROVAL_NEEDED / VENDOR_REPLIED 등)

**Conflicts Found:**
- `APPROVAL_NEEDED` 의 defaultActions = `["IN_APP", "QUEUE_ITEM", "EMAIL_DRAFT"]` — Stage 1 email 이 이미 즉시 sendEmail 호출하므로 EMAIL_DRAFT (검토 후 send) 와 contract 충돌. 직접 재사용 불가.

**Chosen Source of Truth:**
- 3 결재-specific 신규 event type 추가 — Stage 1 sendEmail 과 분리:
  - `PURCHASE_APPROVAL_REQUESTED` (approver 수신, defaultActions = `["IN_APP", "QUEUE_ITEM"]`)
  - `PURCHASE_APPROVED` (requester 수신, defaultActions = `["IN_APP"]`)
  - `PURCHASE_REJECTED` (requester 수신, defaultActions = `["IN_APP"]`)
- entityType = `"PURCHASE_REQUEST"` (Stage 1 와 일관)
- 3 server hooks 가 dispatchNotificationEvent 호출 (best effort)

**Environment Reality Check:**
- vitest @ apps/web (host)
- npx tsc (host)
- DB migration 0 (schema 변경 0)
- prisma generate 0 필요

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d cluster Stage 2 (in-app) 시작
- Stage 1 (email) 보완 — 사용자가 in-app 에서도 결재 lifecycle 확인 가능
- 후속 Batch B (web bell UI) + Batch C (mobile 알림) 의 server-side 기반

## 2. Work Type
- [x] Workflow / Ontology Wiring (3 mutation hook → notification dispatch)
- [x] Web (event-types extension)

## 3. Overview

3 결재 mutation route 가 in-app 알림을 발송 (NotificationEvent + IN_APP NotificationAction 생성). Stage 1 (email) 와 동시 호출 — best effort.

**Success Criteria:**
- [ ] event-types.ts 에 3 신규 type 추가 + EVENT_TYPE_META + isValidEventType 정합
- [ ] request-approval route — dispatchNotificationEvent({ PURCHASE_APPROVAL_REQUESTED, recipients: [{ userId: approverId }] })
- [ ] approve route — dispatchNotificationEvent({ PURCHASE_APPROVED, recipients: [{ userId: requesterId }] })
- [ ] reject route — dispatchNotificationEvent({ PURCHASE_REJECTED, recipients: [{ userId: requesterId }], metadata: { rejectionReason } })
- [ ] best effort (try/catch graceful, mutation 결과 영향 0)

**Out of Scope (별도 batch):**
- Batch B: web header bell icon UI
- Batch C: mobile 알림 list + 카운터
- email digest / retry / escalation
- Slack/Teams webhook
- Stage 3 push notification

**User-Facing Outcome:**
- DB 변경 없음 (Batch A 한정 — server-side wiring 만)
- Batch B/C 진행 시 사용자 가시 — 본 batch 는 server 가 NotificationEvent 기록만

## 4. Product Constraints

**Must Preserve:**
- [x] mutation atomic (try/catch graceful)
- [x] Stage 1 email contract (직접 sendEmail, 변경 0)
- [x] canonical truth (PurchaseRequest mutation = source, notification = projection)
- [x] dispatchNotificationEvent contract (EMAIL_DRAFT 분리)

**Must Not Introduce:**
- [x] APPROVAL_NEEDED 재사용 (EMAIL_DRAFT 충돌)
- [x] schema migration (이미 land)
- [x] mutation 결과 의존 (best effort lock)

**Canonical Truth Boundary:**
- Source of Truth: PurchaseRequest mutation (DB INSERT/UPDATE)
- Derived Projection: NotificationEvent + NotificationAction (audit + UI source)
- Email channel (Stage 1) 와 in-app channel (Stage 2) 는 독립 best-effort

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 3 신규 event type | Stage 1 sendEmail 과 EMAIL_DRAFT contract 분리 | event-types.ts edit + EVENT_TYPE_META 확장 |
| defaultActions = IN_APP + QUEUE_ITEM (요청만) | EMAIL_DRAFT 제외 | 향후 EMAIL_DRAFT 통합 시 별도 batch |
| best effort wiring | mutation atomic 보호 | notification fail 시 silent (audit log 만) |

**Dependencies:**
- NotificationEvent + NotificationAction model (land)
- dispatchNotificationEvent helper (land)
- 3 mutation route (land — request-approval / approve / reject)

**Integration Points:**
- `apps/web/src/lib/notifications/event-types.ts` — 3 type + 3 meta 추가
- `apps/web/src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts` — dispatchNotificationEvent 호출
- `apps/web/src/app/api/request/[id]/approve/route.ts` — dispatchNotificationEvent 호출
- `apps/web/src/app/api/request/[id]/reject/route.ts` — dispatchNotificationEvent 호출

## 6. Global Test Strategy

- vitest source-level grep — event-types 3 신규 type + 3 hooks 의 dispatchNotificationEvent 호출 명시
- Source-level (mock 실행 0) — 직전 Stage 1 email 도 source-level 로 verify

## 7. Implementation Phases (3 phases, 2-3h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (0.5-1h)
- 🔴 RED:
  - `apps/web/src/__tests__/lib/notifications/purchase-event-types.test.ts` — event-types.ts 에 3 신규 type + EVENT_TYPE_META 정합
  - `apps/web/src/__tests__/api/notifications-wiring.test.ts` — 3 route 에 dispatchNotificationEvent import + 호출

✋ **Quality Gate:** failing tests real
**Rollback:** 테스트 revert

### Phase 2: 🟢 GREEN (1-1.5h)
- 🟢 GREEN:
  - `lib/notifications/event-types.ts` — 3 type 추가 + EVENT_TYPE_META 확장
  - request-approval route — try/catch 안에 dispatchNotificationEvent 호출 (Stage 1 email 다음, best effort)
  - approve route — try/catch 안에 dispatchNotificationEvent 호출
  - reject route — try/catch 안에 dispatchNotificationEvent 호출

✋ **Quality Gate:** vitest pass + regression 0, mutation atomic 보호
**Rollback:** 4 file revert

### Phase 3: ✋ Quality Gate + ADR + commit (0.5h)
- ADR-002 §11.209d-notification-inapp-server-wiring entry CLOSED
- commit message draft

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| dispatchNotificationEvent transaction 실패 → mutation rollback | Low | High | try/catch 외부에서 호출, mutation atomic 분리 |
| 3 신규 type 이 event-action-map 의 default 0 | Low | Med | event-types defaultActions IN_APP/QUEUE_ITEM 만 — action-map default fallback 정합 (확인 필요) |
| approver/requester userId 가 mutation 후 존재 보장 | Low | Low | mutation 성공 후 호출 — purchaseRequest object 에서 추출 |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 4 file revert (lib/notifications/event-types.ts + 3 routes)
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ All phases complete
- **Next validation:** 호영님 host `git push` + 결재 cycle smoke (PR INSERT/approve/reject 후 NotificationEvent + IN_APP NotificationAction DB 생성 확인)

**Phase Checklist:**
- [x] Phase 0 complete (audit — 인프라 land 발견)
- [x] Phase 1 complete (RED tests — 20/21 fail confirmed real)
- [x] Phase 2 complete (GREEN — event-types + 3 routes, 21/21 PASS + regression 55)
- [x] Phase 3 complete (ADR § 11.209d-notification-inapp-server-wiring CLOSED entry)

## 12. Notes & Learnings

**Implementation Notes:**
- Phase 0 audit 의 가치 — schema migration / lib 신설 가정으로 plan 시작했으면 큰 over-engineering. 인프라 모두 land 되어 있어 surgical 2 file edit (event-types.ts + 3 routes) 만.
- DB 변경 0 / prisma generate 0 / migration 0 → 호영님 host 절차 매우 simple (git push 만).
- approve/reject route 는 dispatchNotificationEvent 의 transaction 이 mutation atomic 외부 — best effort 보호.

**Lessons (cluster level):**
1. Infrastructure first audit — "이미 land?" 우선 질문.
2. APPROVAL_NEEDED generic 재사용 vs 신규 specific type — defaultActions contract 충돌 회피.
3. Best-effort double channel — email + in-app try/catch 분리.
4. Karpathy "silent wrong assumption" 차단 — Stage 1 만 land 시 in-app 도 자동? 명시적 batch.
5. Batch split — server wiring (Batch A) → web bell UI (Batch B) → mobile 알림 (Batch C).

**Deferred Follow-ups:**
- `#notification-inapp-web-bell-ui` (Batch B) — header bell icon + dropdown
- `#notification-inapp-mobile-screen` (Batch C) — mobile 알림 list + 카운터
- Stage 3 push (APN/FCM)
- email digest / retry / escalation chain
- Slack/Teams webhook
