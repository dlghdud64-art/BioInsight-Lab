# §ontology·security 보완 점검 리포트 (2026-06-14)

- **성격:** 정적 audit(grep/코드 추적). **수정 0.** 발견 → 호영님 검토 → 보완 트랙 우선순위 배정 게이트.
- **방법:** bug-hunter Truth Reconciliation. 각 항목 = 해소 / 부분 / 미해소 + 근거(파일:라인) + severity.
- **결론 요약:** 권한·전이 **인프라는 견고하게 존재**(state-machine + authorization-guard + enforceAction 60+ routes, 카테고리 예산 서버 강제). critical 0, **HIGH 2** = ① O1 quote status route canonical drift, ② S2 per-user 단일건 승인한도 서버 미강제(ABAC 빈 슬롯). 그 외는 표시 레이어 정규화/곁가지.

---

## ONTOLOGY

### O1. Transition authority — 부분 해소 (HIGH drift 1건)
**해소된 것:**
- Canonical transition table 존재: `lib/operations/state-machine.ts:20-90` — `ALLOWED_QUOTE/ORDER/PURCHASE/RECEIVING_TRANSITIONS` 4도메인 맵 + `validateTransition(domain, from, to)`. 주석 "No implicit transitions — if not in map, forbidden". → 전이 규칙이 canonical 한 곳에 집약됨.
- 행위자 권한(authority): `enforceAction` → `checkServerAuthorization` → `ACTION_ROLE_MINIMUM`(`server-authorization-guard.ts:140-213`)에 전 전이성 action별 role 매트릭스(`quote_status_change: [buyer, approver, ops_admin]`, `order_status_change: [ops_admin]` 등).

**🔴 HIGH 발견 — canonical SoT drift:**
- `app/api/quotes/[id]/status/route.ts:7` 에서 `validateTransition` 을 **import 하나 본문 미사용**(dead import).
- 실제 전이 검증은 **route 로컬 재정의** `ALLOWED_STATUS_TRANSITIONS`(`route.ts:12-20`, 사용 `:100-110`)로 수행.
- 두 테이블 **내용 불일치**: 로컬은 `CANCELLED → [PENDING]`(재활성화), `COMPLETED → [PURCHASED, CANCELLED]` 허용 / canonical state-machine.ts 는 `CANCELLED → []`, `COMPLETED → [PURCHASED]`.
- 영향: 전이 규칙이 두 곳에 흩어지고 불일치 → canonical SoT 무결성 훼손. 한쪽만 고치면 drift 지속.

### O2. String-literal status 비교 — 부분 미해소 (MED)
- 리터럴 status 비교 **192건 / 40파일** (`status === "approved"` 등). 대부분 UI 레이어: `dashboard/purchases/page.tsx`(37), `organizations/[id]/page.tsx`(10), `inventory-content.tsx`(11) 등.
- 서버 mutation 경로는 enum 사용(`QuoteStatus.PENDING` 등) — 정규화됨.
- 잔여 위험: UI 리터럴은 오타/대소문자 drift 위험(low-med). enum/const 정규화 미완.

### O3. Synonym drift (vendor/supplier/공급사/벤더) — 부분 미해소 (MED)
- 혼용 **167건 / 30파일**. 일부는 정당한 도메인 구분(`vendor-quotes.ts`/`vendor-request-token.ts` = vendor 도메인 API, `SUPPLIER` = role enum).
- 표시 용어 canonical 1개 미정규화 잔존(공급사 vs 벤더 혼용). §ko-ux ④와 동일 뿌리 — UI 용어 정규화 트랙과 합치면 일괄 처리 가능.

### O4. Canonical ↔ UI state 분리 — 미완 (추가 추적 필요)
- 보호 인프라 존재: `frontend-leak-guard`(governanceMessage internal-key 미노출), canonical truth 보호 설계.
- UI가 canonical을 덮어쓰는 surface 정밀 점검 미완. (chatbot式 재해석은 구조상 차단 — ontology는 contextual action.)

---

## SECURITY

### S1. 서버 권한 재검증 (우회 경로) — 해소 (인프라 견고), LOW 잔여
- `checkServerAuthorization`(`server-authorization-guard.ts:299-325`): `hasRequiredRole` 실패 시 `role_insufficient` deny. 클라 hide 무관하게 **서버에서 role 재검증**.
- `ACTION_ROLE_MINIMUM`(`:140-213`): 전 irreversible action에 최소 role 정의.
- `enforceAction`(server-enforcement-middleware) **60+ api routes 적용**(quotes/orders/inventory/billing/work-queue/organizations 등 광범위).
- ⚠️ 주의: `quotes/[id]/status/route.ts:47-48` 주석 "관리자 권한 확인 (선택적) / 현재는 인증된 사용자면 허용"은 **stale** — 실제로는 `enforceAction(quote_status_change)`가 role(`buyer+`)을 강제. 주석이 오해 소지.
- **LOW 잔여:** "전 mutation route 전수 적용" 여부는 미적용 route 정밀 grep 필요(60+ 확인했으나 누락 route 존재 가능성).

### S2. 승인 권한(LIMITS) / approval-baseline 강제 — 분리 판정 (예산축 해소 / 단건한도축 🔴 HIGH)
- role·self-approval: `approval_decision: [approver, ops_admin]` + `SELF_APPROVAL_FORBIDDEN`(`:215-219`) 강제 확인.
- **✅ 카테고리/월 예산 = 서버 강제 (해소):** `app/api/request/[id]/approve/route.ts:131-170` SERIALIZABLE tx 안에서 `validateCategoryBudgetInTransaction` → hard_stop 위반 시 `BudgetBlockedError` throw → rollback → **403 "예산 한도 초과 승인 불가"**(`:526-545`). race는 SERIALIZABLE 방어. UI 표시만이 아님.
- **🔴 HIGH — 단일건 승인한도(per-user `approvalLimit`) 서버 미강제:**
  - 저장만: `app/api/workspaces/[id]/members/[memberId]/route.ts`(approvalLimit PATCH + audit).
  - 라우팅 추천: `lib/billing/approver-routing.ts:24` "read-only DB query — mutation atomic 영향 0" → 누구에게 보낼지 *추천*만, 차단 아님.
  - ABAC 강제: `lib/ontology/policy/abac-rules.ts` = **빈 슬롯**(`export {}`, line 1-27). `amount < approvalLimit` 규칙은 **JSDoc 예시일 뿐 미구현**, 호출처 0.
  - 승인 실행: `request/[id]/approve/route.ts`에 approvalLimit 체크 **부재**(카테고리 예산만).
  - → **결론: approvalLimit을 설정해도 서버가 단건 한도 초과 승인을 막지 않음. 권한(ADMIN) 보유자는 자기 한도 무시하고 큰 금액 단건 승인 가능 = 단일건 결재 한도 통제 미작동(재무 통제 부분 구멍).** 단 카테고리 예산축은 막으므로 무제한은 아님.

### S3. Governance / audit trail 작동 — 인프라 강함, 작동 smoke 필요
- `logStateTransition` + `createActivityLogServer` + `audit-integrity-engine`(appendAuditEnvelope/computeStateHash) + `event-provenance-engine`(recordSecurityEvent) — quote status route(`:141-171`)에서 호출 확인.
- ⚠️ 실 기록이 비지 않고 도는지(누가·무엇 추적 가능) 라이브 smoke 미완.

### S4. 권한 게이트 ↔ ontology 교차 — 해소 방향
- state guard(전이 유효성) + role guard(행위자 권한) 병존. action별 role 정의 일관(`order_status_change=ops_admin` ↔ ORDER 전이맵).
- 정밀 불일치 매트릭스(전이는 막는데 권한 허용 등) 점검은 추가 추적.

---

## 보완 트랙 우선순위 (제안 — 호영님 배정 대기)

| # | 항목 | severity | 보완 방향 (수정 트랙) |
| :-- | :-- | :-- | :-- |
| 1 | O1 quote status route drift | **HIGH** | 로컬 `ALLOWED_STATUS_TRANSITIONS` 제거 → canonical `validateTransition` 일원화. 의도적 차이(CANCELLED→PENDING 재활성화)는 state-machine.ts에 반영 후 단일화. bug-hunter→feature-planner. |
| 2 | S2 per-user 단일건 승인한도 미강제 | **HIGH** (확정) | 카테고리/월 예산은 서버 강제(해소). per-user `approvalLimit`은 저장·라우팅만 — 승인 실행(`request/[id]/approve`)에서 한도 초과 차단 추가. ABAC 슬롯 구현 또는 approve route 인라인 게이트. sentinel-first. |
| 3 | O2 리터럴 status 정규화 | MED | UI 리터럴 → enum/const(status label 단일 소스, activity-labels 패턴 재사용). |
| 4 | O3 synonym 정규화 | MED | §ko-ux ④와 합쳐 표시 용어 canonical 1개(공급사). 도메인 식별자(vendor)는 보존. |
| 5 | S1 전수 적용 / S3 작동 smoke / O4 surface | LOW | 미적용 mutation route grep, audit trail 라이브 기록 확인, canonical↔UI surface 점검. |

**게이트:** 본 리포트 검토 → 우선순위 배정 → 보완 트랙별 sentinel-first 적용(승인 후). 본 점검은 수정 0.
