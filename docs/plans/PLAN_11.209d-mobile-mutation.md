# Implementation Plan: §11.209d-mobile-mutation (Approve/Reject CTA)

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit → Phase 1 RED 11/15 fail → Phase 2 GREEN (server canApprove + mobile hooks 28/28 PASS) → Phase 3 GREEN (Mobile UI CTA + RN Modal) → Phase 4 ADR close

⛔ DO NOT add request-approval (결재 요청) mobile CTA — defer 별도 batch
⛔ DO NOT add offline mutation queue / push notification — Stage 3 별도
⛔ DO NOT change web mutation routes — canonical 단일 (mobile = thin wrapper)
⛔ DO NOT bypass server enforcement — canApprove 는 visibility 분기일 뿐, 실제 권한은 server `enforceAction` + `teamMember.role === ADMIN`

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- Web mutation routes — `POST /api/request/[id]/approve` (body 없음), `POST /api/request/[id]/reject` (body `{ reason }`), 둘 다 server-side ADMIN check + budget gate + email best-effort (이미 land)
- 결재 요청 라우트 — `POST /api/work-queue/purchase-conversion/[quoteId]/request-approval` (이미 land, mobile out of scope)
- Mobile auth = `apiClient` axios + Bearer accessToken + 401 refresh interceptor (NextAuth `auth()` 가 mobile JWT 호환 — GET `/api/quotes/[id]` 동작 확인)
- Mobile `QuoteApproval.latestPendingRequestId` ← mutation 호출 시 PR id

**Conflicts Found:**
- Mobile `useQuoteApproval(id)` response 에 `canApprove` boolean 0 → visibility 분기 미흡

**Chosen Source of Truth:**
- Option A — server-side computed `canApprove` 추가 (current user team role === ADMIN, internalApprovalStatus === PENDING)
- Web mutation routes single canonical (mobile = thin wrapper)
- 반려 사유 = RN Modal (cross-platform, iOS Alert.prompt 미사용)

**Environment Reality Check:**
- vitest @ apps/web (host)
- vitest @ apps/mobile (host, jest-expo 환경)
- npx tsc (host) — sandbox 는 prisma noise 만

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d cluster mobile closure
- 모바일 = 현장/엣지 운영 도구 의미 회복 (read-only → mutation 가능)
- dead button 0 lock 정합

## 2. Work Type
- [x] Workflow / Ontology Wiring (mobile mutation hook)
- [x] Mobile (Expo / RN UI CTA)
- [x] API contract (canApprove field 추가)

## 3. Overview

R&D Operations / Enterprise workspace 결재자가 모바일에서 견적 결재(승인/반려) CTA 를 직접 사용. 현재는 view-only.

**Success Criteria:**
- [ ] `/api/quotes/[id]` response.approval.canApprove boolean 정확
- [ ] mobile useApproveQuote / useRejectQuote hook 동작 + invalidation
- [ ] mobile 결재 카드 안에 PENDING + canApprove === true 시 "승인" / "반려" Pressable visible
- [ ] 반려 시 사유 입력 RN Modal
- [ ] mutation pending state + error Alert
- [ ] same-canvas + dead button 0

**Out of Scope:**
- 결재 요청 (request-approval) 모바일 CTA — 결재자 select UX 복잡 (별도 batch)
- 모바일 push notification (Stage 3)
- offline mutation queue / retry
- ProcurementRole 매트릭스 자동 결재자

**User-Facing Outcome:**
- 결재자가 모바일 견적 상세에서 "승인" 또는 "반려" 직접 가능
- 반려 사유 입력 가능
- 즉시 결과 반영 (toast + history refresh)

## 4. Product Constraints

**Must Preserve:**
- [x] same-canvas (quote detail screen 안에 통합)
- [x] canonical truth (web mutation route 단일, mobile = thin wrapper)
- [x] invalidation discipline (`["quote-approval", id]` + `["quote", id]`)

**Must Not Introduce:**
- [x] page-per-feature (결재 별도 페이지 0)
- [x] dead button (canApprove false 시 hide)
- [x] no-op / fake success (server response 후에만 toast)
- [x] preview overriding actual truth (server response 가 canonical)

**Canonical Truth Boundary:**
- Source of Truth: web `POST /api/request/[id]/{approve,reject}` route + DB PurchaseRequest
- Derived Projection: `canApprove` (current user role + PENDING)
- Persistence Path: `enforceAction` → `db.purchaseRequest.update` → email best-effort

**UI Surface Plan:**
- [x] Inline expand (approval card 안에 CTA pair)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Option A — server canApprove | dead button 0, UX 정합, single source | 추가 query (organizationMember + teamMember) |
| 결재 요청 defer | 결재자 select UX 복잡 (별도 batch) | 모바일에서 결재 cycle 시작 불가 (web 만) |
| RN Modal (반려 사유) | cross-platform, 한국어 placeholder | Alert.prompt iOS-only 보다 line 더 |

**Dependencies:**
- Web mutation routes already land
- Mobile auth bridge (NextAuth + JWT) verified via existing GET routes
- React Native >= 0.79 (Modal API)

**Integration Points:**
- `/api/quotes/[id]` GET — `canApprove` field 추가
- `/api/request/[id]/approve` POST — mobile caller 추가 (route 변경 0)
- `/api/request/[id]/reject` POST — mobile caller 추가 (route 변경 0)
- `apps/mobile/hooks/useApi.ts` — 2 mutation hooks 추가
- `apps/mobile/types/index.ts` — `QuoteApproval.canApprove: boolean`
- `apps/mobile/app/quotes/[id].tsx` — approval card 안에 CTA + Modal

## 6. Global Test Strategy

- Web — vitest unit/integration test for canApprove computed (route response shape)
- Mobile — vitest hook test for useApproveQuote / useRejectQuote (mutation function + invalidation)
- Manual smoke — mobile 디바이스에서 결재자 계정 로그인 → 견적 상세 → "승인" / "반려" → toast → history 갱신

## 7. Implementation Phases (4 phases, 6-9h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED — server canApprove + mutation hook tests (1.5-2h)
- 🔴 RED:
  - `apps/web/src/__tests__/api/quotes/quote-detail-canapprove.test.ts` — response.approval.canApprove boolean (admin → true, member → false, NOT_REQUIRED → false)
  - `apps/mobile/__tests__/hooks/use-quote-mutations.test.ts` — useApproveQuote / useRejectQuote mutation 정의 + invalidation
  - `apps/mobile/types/index.ts` — QuoteApproval.canApprove: boolean

✋ **Quality Gate:** failing tests 가 real (build noise 0), existing tests pass
**Rollback:** 테스트만 revert

### Phase 2: 🟢 GREEN — server canApprove + mobile mutation hooks (2-2.5h)
- 🟢 GREEN:
  - `/api/quotes/[id]` GET — teamMember role 체크 → canApprove computed
  - `apps/mobile/hooks/useApi.ts` — useApproveQuote, useRejectQuote
  - onSuccess: invalidate `["quote-approval", id]` + `["quote", id]`

✋ **Quality Gate:** vitest pass, tsc 변경 파일 errors 0, no regression
**Rollback:** route + hooks revert

### Phase 3: 🟢 GREEN — Mobile UI CTA wiring (2-3h)
- 🟢 GREEN:
  - Approval card 안에 PENDING + canApprove === true 시 CTA pair
  - "승인" → Alert.alert confirm → mutation → toast
  - "반려" → RN Modal (TextInput + 확인/취소) → mutation → toast
  - pending = ActivityIndicator, error → Alert.alert
- 🔵 REFACTOR: 한국어 어미 정합, sr-only 라벨 정합

✋ **Quality Gate:** dead button 0, fake success 0, loading/error 명시, same-canvas 보존
**Rollback:** UI revert

### Phase 4: ✋ Quality Gate + ADR + commit (1-1.5h)
- ADR-002 §11.209d-mobile-mutation entry CLOSED + lessons
- commit message draft + 호영님 host push

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| NextAuth `auth()` mobile JWT POST 비호환 | Low | High | GET 동작 확인됨 — POST 도 동일. Phase 4 smoke verify |
| Budget gate 403 모바일 UX | Med | Med | server blockers[] → Alert.alert 한국어 |
| canApprove 추가 query 부담 | Med | Low | 같은 batch 에 join (overfetch 0) |
| Race (web 과 mobile 동시 approve) | Low | Low | server `status !== PENDING → 400` 이미 land |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: route + hooks revert (DB 변경 0)
- Phase 3: UI revert (CTA hide)
- Phase 4: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ All phases complete
- **Next validation:** 호영님 host `git push` + Expo build smoke (실제 device 결재자 계정 로그인 → 견적 상세 → 승인/반려 → toast → history 갱신 확인)

**Phase Checklist:**
- [x] Phase 0 complete (audit)
- [x] Phase 1 complete (RED tests — 11/15 fail confirmed real)
- [x] Phase 2 complete (GREEN — server canApprove + mobile hooks, 28/28 PASS)
- [x] Phase 3 complete (GREEN — UI CTA pair + RN Modal)
- [x] Phase 4 complete (ADR § 11.209d-mobile-mutation CLOSED entry)

## 12. Notes & Learnings

**Implementation Notes:**
- Phase 1 RED 의 path issue (`REPO_ROOT_MOBILE` 5 단계 vs 6 단계) 즉시 fix — `__tests__/api/quotes/` 깊이가 schema test 보다 한 단계 더 깊어 `..` 6번 필요.
- TeamRole.ADMIN 만 통과 — 직전 mutation routes 에서도 `teamMember.role !== TeamRole.ADMIN → 403` 정합. canApprove 도 동일 source 사용.
- Mobile React Query invalidation 4 keys (quote-approval / quote / quotes / dashboard-summary) — partial sync 시 status badge 또는 카운터 drift 위험.
- RN Modal `onRequestClose` 는 Android 전용 prop — iOS 는 명시적 "취소" button 으로 닫음 (UX 정합).

**Lessons (cluster level):**
1. 모바일 mutation 의 canonical = web route 단일. mobile = thin wrapper.
2. canApprove server-side computed = dead button 0 lock 정합 source.
3. cross-platform UX = Alert.prompt iOS-only 회피 + RN Modal + TextInput 통일.
4. Karpathy "silent wrong assumption" 차단 — read-only 결재 카드 vs 모바일 = 현장 도구 의도 충돌 회복.
5. 결재 요청 (request-approval) 은 결재자 select UX 복잡 — out of scope (별도 batch).

**Deferred Follow-ups:**
- `#mobile-request-approval-cta` — 결재 요청 모바일 CTA + 결재자 select
- `#mobile-push-notification` (Stage 3) — APN/FCM
- `#mobile-offline-mutation-queue` — 오프라인 mutation 큐 + retry
- `#mobile-approver-routing` — ProcurementRole 자동 결재자 매트릭스
