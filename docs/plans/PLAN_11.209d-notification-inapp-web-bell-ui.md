# Implementation Plan: §11.209d-notification-inapp-web-bell-ui (Batch B)

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (UI infra land 발견) → Phase 1 RED 31/32 fail → Phase 2 GREEN (helper + Header swap 32/32 PASS + regression 179) → Phase 3 ADR close

⛔ DO NOT modify /api/notifications GET/POST routes (이미 land)
⛔ DO NOT modify /api/notifications/[id]/read POST (이미 land)
⛔ DO NOT modify lib/notifications helpers (이미 land — getUserNotifications / getUnreadCount / markNotificationRead)
⛔ DO NOT change Bell icon dropdown UI structure (이미 land — Bell + DropdownMenu + 카테고리 7개 색상)

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 발견):**
- `/api/notifications` GET — query: actionType / entityType / status / limit / offset / countOnly. response: `{ notifications: NotificationItem[], unreadCount, limit, offset }`
- `/api/notifications/[id]/read` POST — markNotificationRead helper 호출, 본인 소유 체크
- `lib/notifications` helpers — getUserNotifications, getUnreadCount, markNotificationRead, dispatchNotificationEvent
- `apps/web/src/components/dashboard/Header.tsx` — Bell icon + DropdownMenu + 카테고리 7개 (CATEGORY_CONFIG) + unread badge + "모두 읽음" + "전체 알림 보기" footer + 빈 상태. **하드코딩된 mock notifications array** 만 사용.
- 직전 §11.209d-notification-inapp-server-wiring 으로 PURCHASE_APPROVAL_REQUESTED / PURCHASE_APPROVED / PURCHASE_REJECTED event type 추가됨.

**Conflicts Found:**
- Header.tsx 의 mock array (8 entries) 가 사용자에게 이미 보이는 상태 — 실제 알림과 무관 (false notification visible). 즉 본 batch land 시 mock 제거 + API swap.
- "모두 읽음" API 0 (read-all 별도 API 미존재) — Promise.all loop 로 client-side 처리.

**Chosen Source of Truth:**
- `/api/notifications?actionType=IN_APP&limit=20` GET → useQuery → 1분 폴링
- `/api/notifications/[id]/read` POST → useMutation → onSuccess invalidate
- "모두 읽음" → Promise.all(unread.map(POST /read)) — 별도 API 신설 0 (작은 surgical)
- eventType → category mapping helper 신설 (`lib/notifications/event-category-map.ts`)

**Environment Reality Check:**
- vitest @ apps/web (host)
- npx tsc (host)
- DB 변경 0
- Header.tsx 는 source-level test + UI 동작 확인 (실제 device smoke)

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — 직전 Batch A (server wiring) 의 user-visible complement
- 현재 Header 의 false mock notification 제거 — 실제 알림 표시
- §11.209d cluster Stage 2 가치 활성화

## 2. Work Type
- [x] Web (Header UI mock → API swap)
- [x] Workflow / Ontology Wiring (eventType 매핑 helper)

## 3. Overview

Header bell icon dropdown 이 mock array → 실제 `/api/notifications` 데이터 표시. eventType 별 category 매핑 + text/href/time formatting 추가.

**Success Criteria:**
- [ ] mock notifications array 제거
- [ ] useQuery (`/api/notifications?actionType=IN_APP&limit=20`) + 1분 폴링
- [ ] eventType → category mapping helper (lib/notifications/event-category-map.ts)
- [ ] notification click → mark as read mutation + navigate
- [ ] "모두 읽음" → Promise.all loop
- [ ] unread badge = data.unreadCount
- [ ] empty / loading state 보존 (기존 UI 유지)

**Out of Scope (Batch C / 별도):**
- Batch C: mobile 알림 screen + 카운터
- Stage 3 push (APN/FCM)
- /dashboard/notifications page 변경 (이미 land)
- read-all 별도 API 신설
- email digest / retry / escalation chain

**User-Facing Outcome:**
- 사용자가 결재 요청/승인/반려 시 즉시 bell badge counter ↑ + dropdown 에 표시
- 실제 quote/inventory/order 알림 흐름 시각화

## 4. Product Constraints

**Must Preserve:**
- [x] Bell icon + DropdownMenu UI structure (이미 land)
- [x] 7개 카테고리 색상 매핑 (CATEGORY_CONFIG) — 그대로
- [x] same-canvas (header 안에 통합)
- [x] canonical truth (NotificationEvent + NotificationAction = source)

**Must Not Introduce:**
- [x] dead button (mock 제거 후 빈 상태 처리 land)
- [x] N+1 (single useQuery + 1분 폴링)
- [x] read-after-write race (mutation onSuccess invalidate)

**Canonical Truth Boundary:**
- Source of Truth: `/api/notifications` GET response
- Derived Projection: category / text / href / time (UI 변환)

**UI Surface Plan:**
- [x] Header bell dropdown (이미 land — mock swap)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| useQuery + 1분 폴링 | 단순, 즉각 가치 | refetchInterval 부담 (1 query/min/user) |
| read-all client-side loop | 별도 API 신설 회피 (작은 surgical) | unread 다수 시 N requests |
| event-category-map helper 신설 | drift 차단 + 향후 mobile 재사용 | 1 file 추가 |

**Dependencies:**
- `/api/notifications` (land)
- `/api/notifications/[id]/read` (land)
- 직전 PURCHASE_APPROVAL_REQUESTED / PURCHASE_APPROVED / PURCHASE_REJECTED event type (land)

**Integration Points:**
- `apps/web/src/components/dashboard/Header.tsx` — mock 제거 + useQuery + eventType 매핑
- `apps/web/src/lib/notifications/event-category-map.ts` (NEW) — 4 helper export

## 6. Global Test Strategy

- vitest source-level grep — Header.tsx 의 mock array 잔존 0 + useQuery/useMutation 호출 + event-category-map import
- event-category-map helper unit test — eventType → category 매핑 정합 + text/href 매핑

## 7. Implementation Phases (3 phases, 3-5h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1-1.5h)
- 🔴 RED:
  - `lib/notifications/event-category-map.test.ts` — 4 helper export (eventTypeToCategory / buildNotificationText / buildNotificationHref / formatNotificationTime) + 매핑 정합 (12 + 3 신규 type → 7 카테고리)
  - `dashboard/header-notification-wiring.test.ts` — Header.tsx 의 mock array 잔존 0 + useQuery `/api/notifications` + useMutation `/api/notifications/[id]/read` + event-category-map import

### Phase 2: 🟢 GREEN (2-3h)
- `lib/notifications/event-category-map.ts` (NEW) — 4 helper
- `Header.tsx` — mock array + useState 제거, useQuery + useMutation, mapping helper 사용

✋ **Quality Gate:** vitest pass + regression 0, dead button 0, fake notification 0
**Rollback:** 2 file revert

### Phase 3: ✋ Quality Gate + ADR + commit (0.5-1h)
- ADR-002 §11.209d-notification-inapp-web-bell-ui entry CLOSED
- commit message draft + 호영님 host push

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 1분 폴링 부담 (1 query/min/user) | Med | Low | 향후 SSE / WebSocket 별도 batch |
| metadata 의 quoteId 없는 케이스 | Med | Low | href fallback `/dashboard/notifications` |
| read-all loop 시 race (UI 깜박임) | Low | Low | onMutate optimistic update 또는 Promise.all 후 single invalidate |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 2 file revert (Header.tsx + event-category-map.ts)
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ All phases complete
- **Next validation:** 호영님 host `git push` + Vercel 자동 배포 + 결재자 계정 web 로그인 → bell icon 실제 알림 표시 확인 (직전 Batch A 가 server 에 NotificationEvent 쌓아둔 것 visible)

**Phase Checklist:**
- [x] Phase 0 complete (audit — UI infra land 발견)
- [x] Phase 1 complete (RED tests — 31/32 fail confirmed real)
- [x] Phase 2 complete (GREEN — helper + Header, 32/32 PASS + regression 179)
- [x] Phase 3 complete (ADR + commit)

## 12. Notes & Learnings

**Implementation Notes:**
- 직전 Batch A 의 자연 다음 step — server 가 쌓는 NotificationEvent 를 사용자에게 노출.
- helper 신설 lock — Batch C (mobile) 가 동일 eventType → category 매핑 재사용 가능 (drift 차단).
- "모두 읽음" 별도 API 없이 client Promise.all loop — 작은 surgical 우선.
- 1분 폴링 (refetchInterval 60s) — 실시간성 향후 SSE/WebSocket 별도 batch.

**Lessons (cluster level):**
1. Phase 0 audit 의 가치 — UI infra 거의 다 land, 8 mock entries 제거 + helper + useQuery swap 만.
2. helper 신설 = drift 차단 + Batch C 재사용 lock.
3. 7 카테고리 + unknown fallback "system" = dead notification 0.
4. read-all 별도 API 회피 + Promise.all loop.
5. refetchInterval 60s 단순 폴링 — 실시간성 별도 batch.

**Deferred Follow-ups:**
- `#notification-inapp-mobile-screen` (Batch C) — mobile 알림 list + 카운터
- Stage 3 push (APN/FCM)
- SSE/WebSocket 실시간 알림
- read-all 별도 API (성능 최적화)
- /dashboard/notifications page 갱신 (별도 audit)
