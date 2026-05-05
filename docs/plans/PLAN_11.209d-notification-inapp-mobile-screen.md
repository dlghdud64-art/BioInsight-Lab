# Implementation Plan: §11.209d-notification-inapp-mobile-screen (Batch C)

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (인프라 + tabs 5 보존 결정) → Phase 1 RED 17/17 fail → Phase 2 GREEN (helper + types + hooks + screen + Stack + entry, 17/17 PASS + regression 177) → Phase 3 ADR close

⛔ DO NOT add 별도 알림 tab (5 → 6 tab UX 부담). more (설정) tab 안 entry + Stack screen 으로 통합.
⛔ DO NOT modify existing push notification 인프라 (apps/mobile/lib/notifications.ts — Stage 3 영역, 본 batch out of scope).
⛔ DO NOT add SSE/WebSocket realtime (web bell 과 동일 60s 폴링 정합).
⛔ DO NOT bypass mobile JWT auth (apiClient interceptor 사용 — 이미 GET routes 호환 검증).

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 발견):**
- `/api/notifications` GET (이미 land) — `?actionType=IN_APP&limit=20` query 호환
- `/api/notifications/[id]/read` POST (이미 land)
- Mobile `apiClient` (axios + Bearer token + 401 refresh) — 이미 GET/POST 호환
- Mobile tabs 구조: 홈 / 견적 / 구매 / 재고 / 설정 (5 tab) + Stack screens (quotes/[id], inventory, scan 등)
- Mobile `lib/notifications.ts` 는 **expo-notifications push** 처리 (Stage 3) — in-app UI 분리됨
- Batch B 의 helper (`event-category-map.ts`) 은 web 전용 — mobile 은 별도 복제 필요 (monorepo packages 부재)

**Conflicts Found:**
- packages/ 가 tsconfig 만 — web ↔ mobile 공유 helper monorepo package 부재. mobile 에 helper 별도 복제 필요.
- mobile types/index.ts 에 NotificationItem type 0 — 신설 필요.

**Chosen Source of Truth:**
- 별도 Stack screen `apps/mobile/app/notifications.tsx` (5 tab 보존, more tab 안 entry)
- Helper 복제 = `apps/mobile/lib/event-category-map.ts` (web 과 동일 source — 코멘트 lock)
- NotificationItem type 신설 = `apps/mobile/types/index.ts` (web `notification-query.ts` 의 NotificationItem 와 동일 shape)
- entry point = more (설정) tab 안 "알림" 메뉴 + unread count badge (작은 surgical)

**Environment Reality Check:**
- vitest @ apps/web (host) — mobile UI 는 source-level grep
- mobile apk smoke — host 에서만 가능

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d Stage 2 완전 closure (Batch A server + Batch B web bell + Batch C mobile)
- 모바일 사용자 in-app 알림 가시성 회복

## 2. Work Type
- [x] Mobile (Expo / RN UI 신설)
- [x] Workflow / Ontology Wiring (helper 재사용)

## 3. Overview

모바일에서 in-app 알림 list + 카운터 표시. Batch B helper (eventTypeToCategory / buildNotificationText / buildNotificationHref / formatNotificationTime) 동일 source 재사용.

**Success Criteria:**
- [ ] mobile useNotifications + useMarkNotificationRead hook
- [ ] `apps/mobile/lib/event-category-map.ts` 복제 (web 과 동일 source)
- [ ] mobile types/index.ts NotificationItem type 추가
- [ ] `apps/mobile/app/notifications.tsx` 별도 screen (FlatList + helper 4개)
- [ ] more (설정) tab 안 "알림" entry + unread count badge
- [ ] read state 시각화 + click navigation (mobile 라우터)
- [ ] root _layout.tsx 에 Stack.Screen registration

**Out of Scope (별도 batch):**
- Stage 3 push notification UX 통합 (이미 land 한 expo-notifications + handleNotificationResponse 와 별도)
- offline cache / sync queue
- SSE/WebSocket 실시간
- mobile bell icon (header 신설 부담)

**User-Facing Outcome:**
- 모바일 결재자가 more tab → "알림" 진입 → list 시각화
- click → mark as read + entity navigation (quote 상세 / 재고 / 구매)
- unread count badge

## 4. Product Constraints

**Must Preserve:**
- [x] same-canvas (별도 페이지 0 회피 — Stack screen 은 detail 흐름 정합)
- [x] canonical truth (/api/notifications response = source)
- [x] tabs 5 개 보존 (UX 부담 회피)
- [x] dead button 0 (unknown eventType "system" fallback)

**Must Not Introduce:**
- [x] 별도 알림 tab (UX 부담)
- [x] mobile 전용 별도 type/contract (web 과 동일 shape)
- [x] expo-notifications 인프라 변경 (Stage 3 영역 분리)

**Canonical Truth Boundary:**
- Source of Truth: `/api/notifications` response (web/mobile 동일)
- Derived Projection: helper 4 개 (web/mobile 동일 source)

**UI Surface Plan:**
- [x] Stack screen (notifications) + more tab entry

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| helper 별도 복제 (mobile) | monorepo packages 부재 — drift 차단 lock 위해 코멘트 명시 | 2 file maintenance 부담 (web/mobile sync) |
| 별도 Stack screen | tabs 5 보존 + detail flow 정합 | bell icon 같은 빠른 access 0 (more 탭 경유) |
| more tab entry + badge | 작은 surgical | home tab 변경 0 |
| NotificationItem type 신설 | web 과 동일 shape 보장 | mobile types/index.ts edit |

**Dependencies:**
- `/api/notifications` GET (land)
- `/api/notifications/[id]/read` POST (land)
- Batch A (server wiring) + Batch B (web bell) — 모두 land

**Integration Points:**
- `apps/mobile/lib/event-category-map.ts` (NEW) — 4 helper 복제
- `apps/mobile/types/index.ts` — NotificationItem type 추가
- `apps/mobile/hooks/useApi.ts` — useNotifications + useMarkNotificationRead
- `apps/mobile/app/notifications.tsx` (NEW) — Stack screen
- `apps/mobile/app/_layout.tsx` — Stack.Screen registration
- `apps/mobile/app/(tabs)/more.tsx` — "알림" entry + unread count badge

## 6. Global Test Strategy

- vitest source-level grep (mobile 의 `__tests__` 는 jest-expo 미설치이므로 web `__tests__/mobile/` 위치)
- helper unit test 는 web 측 동일 test 가 covering — mobile 복제 에서는 source-level grep 으로 정합 검증

## 7. Implementation Phases (3 phases, 4-6h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1-1.5h)
- 🔴 RED:
  - `apps/web/src/__tests__/mobile/notifications-screen-wiring.test.ts` — mobile screen + hook + helper + entry point + types 정합 (source-level grep, 6+ checks)

### Phase 2: 🟢 GREEN (2-3h)
- `apps/mobile/lib/event-category-map.ts` (NEW) — 4 helper 복제
- `apps/mobile/types/index.ts` — NotificationItem type 추가
- `apps/mobile/hooks/useApi.ts` — useNotifications + useMarkNotificationRead
- `apps/mobile/app/notifications.tsx` (NEW) — FlatList + helper + read mutation
- `apps/mobile/app/_layout.tsx` — Stack.Screen registration
- `apps/mobile/app/(tabs)/more.tsx` — "알림" entry

### Phase 3: ✋ Quality Gate + ADR + commit (0.5-1h)
- ADR-002 §11.209d-notification-inapp-mobile-screen entry CLOSED
- commit message draft

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| helper drift (web/mobile sync 부담) | Med | Med | 코멘트 명시 + 향후 monorepo packages 추출 별도 batch |
| FlatList performance (알림 다수) | Low | Low | limit=20 query + pagination 별도 batch |
| more tab "알림" entry visibility 분기 | Low | Low | 항상 visible (unreadCount === 0 시 badge hide) |
| Stack screen back button | Low | Low | expo-router 기본 동작 |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 6 file revert
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ All phases complete
- **Next validation:** 호영님 host `git push` + Expo build/OTA + mobile device smoke (more 탭 → "알림" entry → list visible + click → entity navigation)

**Phase Checklist:**
- [x] Phase 0 complete (audit)
- [x] Phase 1 complete (RED tests — 17/17 fail)
- [x] Phase 2 complete (GREEN — 6 file, 17/17 PASS + regression 177)
- [x] Phase 3 complete (ADR + commit)

## 12. Notes & Learnings

**Implementation Notes:**
- §11.209d-notification cluster Stage 2 완전 closure (server / web / mobile 3 batch).
- helper 복제 vs monorepo package — 작은 surgical 우선 (복제 + ADR lock).
- 별도 알림 tab 신설 vs 기존 menu 재사용 — 후자 (5 tab 보존, more 안 entry).
- 동적 description 으로 unread count 표현 = badge UI 신설 회피.

**Lessons (cluster level):**
1. Phase 0 audit 가치 — push 인프라 (Stage 3) 이미 land 발견.
2. helper 복제 + ADR 코멘트 lock — drift 차단.
3. 기존 menu structure 재사용 — UX 부담 0.
4. 동적 description = badge UI 회피.
5. 3 batch split (server / web / mobile) = 각 작은 surgical commit.

**Deferred Follow-ups:**
- `#notification-inapp-shared-package` — packages/shared/notifications 추출
- Stage 3 push (APN/FCM 통합 with in-app UX)
- `#notification-inapp-pagination` — 무한 스크롤
- `#notification-inapp-realtime-sse` — SSE/WebSocket 실시간
- `#notification-inapp-mobile-home-counter` — 홈 탭 상단 카운터
