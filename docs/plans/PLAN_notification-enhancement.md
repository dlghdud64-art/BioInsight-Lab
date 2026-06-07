# Implementation Plan: 알림 고도화 — 도메인 trigger 배선 (1차: 재고 + 발주)

- **Status:** 🔄 In Progress (Phase 2/3 구현 완료 2026-06-08 / 정식 vitest·tsc·push 클로드코드 대기)
- **Started:** 2026-06-08
- **Scope:** medium (4~6 phase). 1차 = 재고 + 발주 도메인. 견적/예산/입고검수는 후속.

**CRITICAL INSTRUCTIONS** (phase 완료 시): ① 체크박스 ② quality gate(클로드코드 tsc/lint/test) ③ 전항목 통과 ④ Last Updated ⑤ Notes ⑥ 통과 후 다음.

⛔ quality gate 실패/소스충돌 미해소 진행 금지. dead 알림(클릭 무반응)·알림 피로(정보성 남발)·front-only 금지.
⛔ 알림 trigger 는 canonical 상태전이에서만 파생 — UI state 아님. ontology 를 chatbot 으로 재해석 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source (코드 실측 2026-06-08, Explore 정독):**
- 모델: `NotificationEvent` + `NotificationAction` (prisma schema L2710~). entityType/entityId/eventType/metadata/readAt. actionType/severity 는 정규 컬럼 아님(payload JSON).
- dispatcher: `lib/notifications/event-dispatcher.ts` `dispatchNotificationEvent({eventType, entityType, entityId, triggeredBy, metadata, recipients})` — 이벤트+액션 원자 생성, preference 필터(§11.250), 액션 자동(getDefaultActionsForEvent). best-effort try-catch 권장 명시.
- eventType: `event-types.ts` 18종 정의 + EVENT_TYPE_META(label/entityType/defaultActions) 완비. 재고 `INVENTORY_LOW/EXPIRING/RECEIVED`, 발주 `ORDER_PLACED/SHIPPED/DELIVERED` 전부 정의됨.
- UI/조회: `GET /api/notifications`, Header bell(useQuery 1분 폴링 + unreadCount), `buildNotificationHref`(deep-link), 모바일 notifications.tsx, 이메일 template — **전부 배선 완료**(§11.209d Stage 2, 5 PLAN closed).

**Conflicts / 정정:**
- 호영님 토막 "모델만 있고 trigger/actionType 미배선" → **부분 정정**: 결재 승인 3종(PURCHASE_APPROVAL_*)은 완전 배선. **재고/발주 포함 나머지 도메인 12종은 dispatchNotificationEvent caller 0 = dead code**(정의만, DB 미적재 → bell 빈 상태). 토막의 "trigger 미배선"은 이 12종에 대해 정확.
- actionType 정규화/severity 컬럼 부재 = payload JSON 으로 충분(현 href/카테고리 routing 동작) → **1차 범위 제외**(필요시 후속).

**Chosen Source of Truth:** 현 코드. 알림 = canonical 상태전이의 projection. 발생원은 도메인 mutation.

**Environment Reality Check:**
- [x] 인프라(dispatcher/UI/href/preference) 완비 — 재사용
- [ ] 만료(INVENTORY_EXPIRING) = 시간경과 이벤트 → cron/배치 인프라 존재 여부 확인 필요(P4)
- [ ] recipient 결정 로직(inventory.userId/org members, order owner) 각 route 확인 필요
- [x] sandbox: tsc/lint/test 불가 → fs+regex sentinel, 정식은 클로드코드

## 1. Priority Fit
- [ ] P1 immediate [ ] Release blocker [x] P2 / 차별화 (운영 OS 정체성 — "행동유발 피드")
- 1차 = **재고 + 발주**(라이브 가치 최고, 호영님 지정). 견적/예산/입고검수/만료는 후속 순번.

## 2. Work Type
- [x] Workflow / Ontology Wiring  [x] Web (server trigger)  [ ] mutation 신규 아님(기존 mutation에 알림 dispatch 부착)

## 3. Overview

**Feature Description:** 재고·발주 도메인의 canonical 상태전이 지점에 `dispatchNotificationEvent` 호출을 배선해, 정의만 돼있던 알림이 실제 생성·노출되게 한다. UI/조회/deep-link/모바일/이메일은 기존 인프라 재사용.

**Success Criteria:**
- [ ] 재고/발주 상태전이 시 NotificationEvent 생성 → bell/모바일에 노출.
- [ ] 각 알림 클릭 → 해당 워크벤치/상세 deep-link(`buildNotificationHref`). dead 알림 0.
- [ ] dispatch 실패가 메인 mutation 을 차단하지 않음(best-effort try-catch).
- [ ] 알림 피로 방지: actionable + 상태변화만(정보성 남발 0). 중복 알림 방지(같은 상태전이 1회).
- [ ] 회귀 0(sentinel) — 기존 결재 알림 3종 동작 보존.

**Out of Scope (⚠️ 구현 금지):**
- [ ] 신규 알림 UI/페이지(기존 bell/모바일 재사용).
- [ ] actionType/severity 스키마 정규화(payload JSON 유지).
- [ ] 견적/예산/입고검수 도메인(후속 순번).
- [ ] 만료(INVENTORY_EXPIRING) 시간기반 배치 — cron 인프라 확인 후 P4 또는 별도 백로그.
- [ ] chatbot/assistant 재해석.

**User-Facing Outcome:** 운영자가 재고 부족/입고/발주 배송 등 상태변화를 bell 알림으로 즉시 인지하고, 클릭하면 해당 화면으로 바로 진입.

## 4. Product Constraints
**Must Preserve:** [ ] canonical truth(알림=projection) [ ] 기존 결재 알림 3종 [ ] preference 필터 [ ] deep-link 패턴
**Must Not Introduce:** [ ] dead 알림 [ ] 알림 피로(남발) [ ] front-only(상태전이 없이 알림) [ ] 중복 알림 [ ] mutation 차단(dispatch 실패가 본 작업 막기)

**Canonical Truth Boundary:**
- Source of Truth: 도메인 mutation(재고 차감/입고, 발주 생성/상태전이).
- Derived: NotificationEvent/Action(상태전이의 projection).
- Persistence: 도메인 mutation 트랜잭션 성공 후 dispatch(best-effort, 별도 try-catch — 본 트랜잭션 비차단).

## 5. 알림 카탈로그 (1차 확정)

| eventType | canonical trigger | 삽입 지점(route/action) | recipient | 비고 |
| :-- | :-- | :-- | :-- | :-- |
| `INVENTORY_RECEIVED` | 입고 완료 | `POST /api/inventory/smart-receiving` 성공 후 / `inventory/[id]/restock` | inventory owner + org members | 가장 단순(명확 상태전이) |
| `INVENTORY_LOW` | 차감 후 currentQuantity ≤ 임계(reorderPoint) 도달 | `lot-dispatch`/`inventory_use` 성공 후 판정 | owner + org | 임계 필드 확인 필요(reorderPoint 존재?) |
| `ORDER_PLACED` | 발주 생성 | `POST /api/orders` 성공 후 | order owner + approver | order_create 기존 enforceAction 경로 |
| `ORDER_SHIPPED` | status → SHIPPED | `PATCH /api/orders/[id]` 상태전이 | owner | 외부 상태(§11.353 종속 가능 — 확인) |
| `ORDER_DELIVERED` | status → DELIVERED | `PATCH /api/orders/[id]` (발주매핑 입고 포함) | owner | smart-receiving 발주매핑과 정합 |

- **중복 방지:** 같은 entity+eventType 단시간 중복 dispatch 방지(예: 이미 미읽음 동일 알림 존재 시 skip) — Phase 에서 설계.
- **만료(INVENTORY_EXPIRING):** 시간기반 → P4(배치) 또는 백로그 분리.

## 6. Test Strategy
- trigger 배선 → 각 route 성공 시 dispatchNotificationEvent 호출 sentinel(호출 존재 + try-catch 래핑 + 올바른 eventType/entityId).
- dead 알림 0: buildNotificationHref 가 재고/발주 eventType 커버 검증(누락 시 추가).
- 회귀: 결재 알림 3종 caller 보존, 메인 mutation 동작 불변.
- 정식 vitest/실DB = 클로드코드. sandbox = fs+regex.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — [x] Done (2026-06-08 정독)
- 인프라 완비 확인, 갭=재고/발주 caller 0 확정, 카탈로그 1차 확정.
- 🔴 잔여 확인(Phase 1 착수 시): recipient 결정 로직(owner/org 조회) + reorderPoint 임계 필드 + buildNotificationHref 재고/발주 커버 + order status route(§11.353 종속).
- ✋ Gate: 충돌 0, 카탈로그 확정. Rollback: planning-only.

### Phase 1: Contract & Failing Tests — [ ] Pending
- 🔴 재고/발주 trigger 호출 + best-effort try-catch + deep-link 커버 sentinel(실패 확인). recipient 헬퍼 시그니처.
- 🟢 공통 trigger 헬퍼(recipient 조회 + dispatch wrap) 스캐폴딩.
- ✋ Gate: 실패테스트 real, 기존 green, tsc/lint 문서화. Rollback: contract revert.

### Phase 2: 재고 trigger 배선 — [~] 부분 완료
- [x] **공통 헬퍼** `lib/notifications/recipients.ts` `resolveOrgRecipients(owner, org)` — 소유자+OWNER/ADMIN dedup + graceful. index export. (Phase 1 contract 흡수)
- [x] **INVENTORY_RECEIVED**: smart-receiving 두 분기(기존 매칭재고/신규 품목) 성공 후 best-effort dispatch. sentinel `notif-inventory-received` 13/13 GREEN(sandbox node).
- [x] **INVENTORY_LOW**: `inventory/[id]/use` 출고/사용 차감 성공 후 edge 감지(`quantityBefore > safetyStock && newQty <= safetyStock`) dispatch. best-effort. ⚠️ **truth 정정**: INVENTORY_LOW 는 `inventory/[id]` PATCH(§11.250a)에 이미 완비 — 갭은 **use(출고) 경로뿐**. 임계는 기존 caller 와 정합 위해 `safetyStock`(autoReorderThreshold 아님).
- [x] 🔵 중복 방지 = edge 감지(임계 전이 1회, 복귀 전 재발화 0)로 query-free dedupe. 미읽음 SELECT 불필요(N+1 회피).
- ✋ Gate: 알림 생성→bell 노출, dead 0(href INVENTORY 커버 확인됨), mutation 비차단(best-effort), 중복 0. Rollback: dispatch diff revert(헬퍼 무변경).

### Phase 3: 발주 trigger 배선 — [x] 구현 완료 (검증 클로드코드 대기)
- [x] **ORDER_PLACED**: `orders` POST 발주 생성 성공 후 dispatch (caller 0 갭 — 진짜 신규). vendor-split 시 대표 Order 1건(activity/state log granularity 정합, 나머지 vendor Order 알림은 후속 백로그).
- [x] **ORDER_SHIPPED/DELIVERED**: `orders/[id]` PATCH 상태전이 edge 감지(`before.status !== SHIPPING/DELIVERED`) dispatch. ⚠️ **truth 정정 2건**: ① admin status route(§11.250acd-2)에 이미 완비 — 갭은 **owner PATCH 경로뿐**. ② enum 에 "SHIPPED" 없음 → 실제 값 `SHIPPING`(ORDER_SHIPPED 알림은 SHIPPING 전이). ORDER_CREATED_FROM_POCANDIDATE 는 audit eventType(알림 아님) → ORDER_PLACED 무충돌.
- [x] DELIVERED ↔ smart-receiving 정합: 서로 다른 eventType(ORDER_DELIVERED on ORDER vs INVENTORY_RECEIVED on INVENTORY) → 알림 중복 0.
- ✋ Gate: 상태전이별 1회(edge), 멱등 PATCH 중복 0, best-effort. Rollback: 발주 dispatch diff revert(헬퍼/인프라 무변경).

### Phase 4: 만료(INVENTORY_EXPIRING) — [ ] Pending (조건부)
- 🔴 cron/배치 인프라 존재 확인. 없으면 별도 백로그 분리(BACKLOG_notification-expiry-batch).
- 🟢 (인프라 있을 시) 일 1회 만료 D-N 스캔 → EXPIRING dispatch(품목당 1회/기간).
- ✋ Gate: 중복 발송 0(기간 dedupe). Rollback: 배치 비활성.

### Phase 5: Invalidation / Smoke / Rollback — [ ] Pending
- 🔴 알림 읽음→unreadCount 갱신, 상태전이→bell 즉시 반영 smoke.
- 🟢 클로드코드 tsc/lint/test/build → push → 라이브 육안(알림 생성·클릭·deep-link).
- ✋ Gate: 회귀 0, rollback 문서. Rollback: 도메인별 dispatch 독립 revert(플래그).

## 8. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| dispatch 실패가 mutation 차단 | Med | High | best-effort try-catch(트랜잭션 외부), 실패 로그만 |
| 알림 피로(남발) | Med | Med | actionable+상태변화만, 중복 dedupe, preference 필터 |
| 중복 알림(DELIVERED ↔ 발주매핑 입고) | Med | Med | 상태전이 1회 보장, 동일 entity+type dedupe |
| deep-link 누락(dead 알림) | Low | Med | buildNotificationHref 재고/발주 커버 검증 선행 |
| reorderPoint 임계 필드 부재 | Low | Med | Phase 1 확인, 없으면 LOW 판정 기준 재정의 |
| order 외부상태(§11.353) 종속 | Med | Low | SHIPPED/DELIVERED trigger 가능 시점만, 미정이면 DELIVERED 우선 |

## 9. Rollback Strategy
- Phase별 도메인 dispatch 호출이 독립 → 해당 diff revert로 격리 rollback. 인프라(dispatcher/UI) 무변경이라 영향 0. best-effort라 revert해도 mutation 정상.

## 10. Progress Tracking
- Overall ~75% · Current: Phase 2/3 구현 완료, 정식 검증 대기 · Blocker: sandbox vitest 실행 불가(rollup native 부재 + bash mount 파일툴 비동기) → 정식 tsc/lint/vitest/build 클로드코드 · Next: 클로드코드 검증 → push → 라이브 육안(알림 생성·클릭·deep-link)
- Phase Checklist: [x] P0 [x] P1(헬퍼/contract 흡수) [x] P2(RECEIVED+LOW) [x] P3(ORDER_*) [ ] P4(만료, 조건부) [ ] P5(smoke, 클로드코드)

## 11. Notes & Learnings
- [2026-06-08] **Phase 2 잔여 + Phase 3 구현 완료.** Truth reconciliation 으로 PLAN "caller 0" 전제 부분 폐기 — INVENTORY_LOW(inventory PATCH §11.250a)·ORDER_SHIPPED/DELIVERED(admin status route §11.250acd-2)는 이미 배선됨. 실제 갭만 정밀 배선: ① INVENTORY_LOW → `inventory/[id]/use`(출고 경로), ② ORDER_PLACED → `orders` POST(진짜 신규), ③ ORDER_SHIPPED/DELIVERED → `orders/[id]` PATCH(owner 경로). 무지성 추가였으면 기존 caller 와 **중복 알림** 발생할 뻔. enum "SHIPPED" 부재 → `SHIPPING` 정정. dedupe = edge 감지(임계/상태 전이 1회) query-free, 24h SELECT 미채택(N+1 회피 + 정합 re-entry 보존). sentinel `notif-inventory-low-order.test.ts` 작성. **검증 미완**: sandbox vitest 실행 불가(rollup native + mount 비동기) → 정식 tsc/lint/vitest/build/push 클로드코드 필수.
- [2026-06-08] Phase 0 잔여 확인 완료: deep-link(buildNotificationHref INVENTORY/ORDER entityType 커버, event-category-map L169/171), recipient 패턴(orgMember OWNER/ADMIN findMany, request/approve L438), 재고 임계(autoReorderThreshold/safetyStock schema L814).
- [2026-06-08] Phase 2 부분: 공통 헬퍼 resolveOrgRecipients 추출 + INVENTORY_RECEIVED(smart-receiving 2분기) best-effort dispatch 완료. sentinel 13/13. **나머지(INVENTORY_LOW, ORDER_PLACED/SHIPPED/DELIVERED)는 동일 헬퍼+best-effort 패턴 복제로 확장 — 정밀도 위해 새 세션 권장.**
- [2026-06-08] Phase 0: 인프라 완비(§11.209d Stage 2), 갭=재고/발주 trigger caller 0. 고도화=trigger 배선만(UI/href/preference 재사용). 만료는 시간기반→배치 별도. actionType/severity 정규화 1차 제외(payload JSON 충분).
- 원칙(호영님): 알림=행동유발+canonical 상태변화만, deep-link 필수(dead 금지), chatbot 재해석 금지.
