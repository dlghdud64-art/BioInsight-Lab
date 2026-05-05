# Implementation Plan: #notification-inapp-helper-drift-sync

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (workspaces 외 mobile 발견) → Phase 1 drift sync test 55/55 PASS (drift 0 즉시 검증) → ADR close

⛔ DO NOT attempt apps/mobile workspaces 통합 (Expo hoisting 충돌 위험 — 별도 audit batch).
⛔ DO NOT consolidate web/mobile helper into single file (monorepo packages workspace 외 mobile — direct import 불가).
⛔ DO NOT modify helper logic — 본 batch 는 정합 검증 test 만 추가.

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/lib/notifications/event-category-map.ts` (Batch B, land)
- `apps/mobile/lib/event-category-map.ts` (Batch C, land)
- root `package.json` workspaces: `["apps/web", "packages/*"]` — apps/mobile **외부** (Expo 별도 npm install)
- packages/ 에 tsconfig 만 (shared package 부재)

**Conflicts Found:**
- 직전 ADR 에서 "monorepo packages 부재 → mobile 에 helper 복제" 결정 → drift 위험 ADR 코멘트 lock 만으로 관리
- Expo hoisting 충돌 위험 → workspaces 통합은 별도 audit batch

**Chosen Source of Truth:**
- 현재 복제 구조 유지 + drift 자동 검증 CI test 추가
- 3 helper logic 정합 (eventTypeToCategory / buildNotificationText / formatNotificationTime) — case set + 한국어 라벨 + 시간 분기 동일성
- buildNotificationHref 는 라우터 경로 차이 (`/dashboard/quotes` vs `/quotes/[id]`) — drift 검증 제외
- 7 카테고리 enum 정합

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d-notification cluster Stage 2 closure 후 drift 차단 lock

## 2. Work Type
- [x] Test (CI sync verification)
- [x] Documentation (ADR drift sync 정책)

## 3. Overview

web/mobile event-category-map helper 의 drift 자동 검증 — 두 file 의 logic 정합 매핑 (case set / 카테고리 / 한국어 라벨) 을 grep test 로 lock.

**Success Criteria:**
- [ ] 18 eventType 모두 양쪽 case 분기 존재 검증
- [ ] 7 카테고리 enum 정합 (string literal 양쪽 존재)
- [ ] 결재 lifecycle 한국어 라벨 정합 ("결재 요청 도착" / "결재 승인 완료" / "결재 반려")
- [ ] formatNotificationTime 분기 정합 ("방금 전" / "어제" / "N분 전" / "N시간 전" / "N일 전")
- [ ] vitest PASS 시 drift 0 / FAIL 시 drift 발견 + 수정 강제

**Out of Scope (별도 batch):**
- workspaces 통합 (Expo hoisting audit 별도)
- buildNotificationHref drift 검증 (라우터 경로 차이로 제외)
- helper logic 수정

## 4. Product Constraints

**Must Preserve:**
- [x] 두 helper file 그대로 유지
- [x] 현재 동작 (test 만 추가)

**Must Not Introduce:**
- [x] mobile workspace 변경 (Expo build 위험)
- [x] helper 통합 (현재 monorepo 구조 incompatible)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Grep based sync test | 작은 surgical, runtime 호출 0 | logic 동등성 100% 보장 0 (case set + 라벨 만) |
| buildNotificationHref 제외 | 라우터 경로 차이 의도적 분기 | href drift 자동 catch 0 (manual review) |

## 6. Implementation Phases (1 phase, 1-2h)

### Phase 1: Drift sync test + ADR (1-2h)
- `apps/web/src/__tests__/lib/notifications/event-category-map-mobile-drift-sync.test.ts` (NEW)
  - eventTypeToCategory case set 정합 (18 type)
  - 7 카테고리 enum 정합
  - 한국어 라벨 정합 (결재 lifecycle 3개 + 재고 + 견적 + 주문 + system fallback)
  - formatNotificationTime 한국어 분기 정합
- ADR-002 #notification-inapp-helper-drift-sync entry CLOSED + drift sync 정책 명시

✋ **Quality Gate:** vitest PASS (drift 0 검증) + regression 0
**Rollback:** test revert

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 첫 run 시 drift 발견 (test FAIL) | Low | Med | 즉시 두 file sync — 어느 한쪽 수정 |
| 향후 buildNotificationHref drift | Med | Low | manual review (test 제외 명시 + ADR 코멘트) |
| helper logic 변경 시 두 file 수정 누락 | Med | Med | test 가 catch (CI gate) |

## 10. Rollback Strategy

- Phase 1: test 1 file revert

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ Complete
- **Next validation:** 호영님 host `git push` (DB 변경 0 — Vercel/Expo 영향 0)

## 12. Notes & Learnings

**Implementation Notes:**
- 첫 vitest run 에서 drift 0 즉시 확인 — Batch B/C 가 정합 land 했음을 검증.
- buildNotificationHref 는 의도적 분리 (mobile 라우터 vs web 라우터 contract 차이) — drift 자동 검증 제외 + manual review.
- workspaces 통합 (Option 1) 은 Expo hoisting 위험 큼 — 별도 audit batch park.

**Lessons (cluster level):**
1. audit 가치 — workspaces 외부 mobile 발견으로 단순한 packages/shared path 차단.
2. Option 1 risk 평가 우선 — Expo hoisting/EAS build 영향 audit 필수.
3. drift sync 정책 = 두 file 동시 수정 + CI test gate.
4. buildNotificationHref 의도적 분리 = 라우터 contract 차이.
5. "single source of truth" trade-off — code 통합 vs CI test gate.

**Deferred Follow-ups:**
- `#monorepo-mobile-workspace-integration` — apps/mobile workspaces 추가 (Expo hoisting audit + EAS smoke)
- `#packages-shared-notifications-extract` — workspaces 통합 후 packages/shared 추출
- buildNotificationHref drift 자동 검증 (라우터 매핑 별도 helper)
