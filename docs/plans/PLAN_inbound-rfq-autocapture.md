# Implementation Plan: Inbound RFQ Auto-Capture (공급사 견적회신 자동수신)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-18
- **Last Updated:** 2026-06-18
- **Estimated Completion:** TBD (인프라 의존: MX/env — 호영님)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 코드 직접 검증(2026-06-18): rfq-token route, vendor-requests/route.ts L324-325, inbound/sendgrid route, schema.prisma L1597-1684.

**Secondary References:**
- §11.348-SEND-A (vendor-requests reply-to=요청자 결정)
- quote-send-replyto-348a.test.ts (현 reply-to sentinel)
- §email-rebrand / §ui-rebrand (labaxis.co.kr 도메인 단일화)

**Conflicts Found:**
- §11.348-SEND-A(reply-to=연구소 직접수신) ↔ 자동수신(reply-to=시스템). 호영님 승인(2026-06-18)으로 **자동수신 우선, 연구소 직접수신 → LabAxis 집약**으로 진화.
- rfq-token route의 `NEXT_PUBLIC_DOMAIN || "yourdomain.com"` placeholder ↔ verified 도메인 labaxis.co.kr.

**Chosen Source of Truth:**
- 코드 현 상태 + 호영님 2026-06-18 승인. canonical = `QuoteReply`(DB). 공급사 회신은 이메일 받은편지함이 아니라 LabAxis QuoteReply로 집약.

**Environment Reality Check:**
- [x] repo/branch context 이해 (C:\Users\young\ai-biocompare, operator push)
- [x] runnable: vitest / npm run build (operator/클로드코드)
- [x] execution blockers: 라이브 E2E는 인프라(MX·SendGrid Inbound Parse·env) 의존 — 호영님. 코드/유닛은 sandbox 가능.

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred

**Why:** 자동화 편의(회신 구조화·집약). 현재도 회신 유실 0(연구소 직접수신). P1(release-prep) 충돌 미확인이라 단정 안 함 — 충돌 발견 시 defer 가능. 호영님 명시 진입.

## 2. Work Type
- [x] Feature
- [x] Workflow / Ontology Wiring (quotes 핸드오프)
- [x] Migration / Rollout (reply-to 전환 + 인프라 cutover)

## 3. Overview

**Feature Description:** 공급사가 견적 요청 메일에 **이메일로 회신**하면, LabAxis가 자동으로 받아 `QuoteReply`(+첨부)로 구조화하고 quotes 화면에 노출 + 연구소에 알림. 발송 reply-to를 `rfq+token@inbound.labaxis.co.kr`로 전환해 루프를 닫는다.

**Success Criteria:**
- [ ] 견적 발송 시 rfqToken 자동 발급 + reply-to에 `rfq+token@inbound…` 임베드
- [ ] 공급사 회신 → inbound parse → 토큰 매칭 → QuoteReply 생성(dedup 유지)
- [ ] 첨부(견적 PDF 등) Supabase Storage 실저장 — **누락 0**
- [ ] quotes 화면에서 회신 + 첨부 확인(same-canvas)
- [ ] 새 회신 도착 시 연구소 알림

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 발송 provider 변경(Resend 유지)
- [ ] inbound provider 신규 추상화 레이어(기존 sendgrid route 재사용)
- [ ] AI 본문 파싱/금액 자동추출(별도 트랙 — 지금은 원문 저장만)
- [ ] 인프라(MX/DNS/SendGrid 계정/env) 직접 설정 — 호영님

**User-Facing Outcome:** 연구소가 공급사 회신을 받은편지함에서 찾지 않고 LabAxis quotes 화면에서 첨부까지 한 곳에서 본다.

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (회신 표시는 quotes same-canvas)
- [x] same-canvas (회신 dock/section, 신규 page 금지)
- [x] canonical truth (QuoteReply = DB 진실)
- [x] invalidation discipline

**Must Not Introduce:**
- [x] page-per-feature (회신 전용 페이지 금지)
- [x] chatbot/assistant 재해석
- [x] dead button / no-op / placeholder success (attachment 메타-only = placeholder → 실저장 강제)
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `QuoteReply` + `QuoteReplyAttachment` (DB)
- Derived Projection: quotes 화면 회신 목록
- Snapshot/Preview: inbound `InboundEmail`(원본 감사 로그)
- Persistence Path: inbound webhook → tx(QuoteReply + attachment + InboundEmail)

**UI Surface Plan:**
- [x] Existing route section (quotes 상세 same-canvas 회신 섹션/dock)
- [ ] New page (❌)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| reply-to = `rfq+token@inbound.labaxis.co.kr` | 루프 클로즈, 회신 시스템 집약 | §11.348 직접수신 폐기(알림으로 보완) |
| inbound provider = SendGrid Inbound Parse(기존 route 재사용) | 코드 이미 존재, Resend는 inbound 미지원 | 발송 Resend / 수신 SendGrid provider 이원화 |
| 첨부 = Supabase Storage 실저장 | "누락 0" 강제, placeholder 금지 | Storage 설정·권한 필요 |
| 알림 = 기존 sendEmail(Resend) 재사용 | 신규 채널 0 | — |

**Dependencies:**
- Required Before Live: MX(`inbound.labaxis.co.kr`→SendGrid), SendGrid Inbound Parse Host, `SENDGRID_INBOUND_SECRET`, `NEXT_PUBLIC_DOMAIN=labaxis.co.kr`, Supabase Storage bucket `quote-replies` (호영님/operator)
- Existing Touched: rfq-token route, vendor-requests route, inbound/sendgrid route, sender.ts, quotes 상세 UI, schema(변경 없음 예상)

**Integration Points:**
- 발송: vendor-requests/route.ts → rfqToken 발급 + replyTo
- 수신: inbound/sendgrid route → QuoteReply + attachment
- 표시: quotes 상세 page (회신 섹션)
- 알림: sender.ts sendEmail

## 6. Global Test Strategy
- 발송 reply-to 전환 → integration/sentinel (348a 진화)
- inbound parse 매칭/dedup/UNMATCHED → unit/integration
- attachment storage → unit(업로드 호출·실패 처리) + 메타 정합
- UI 회신 표시 → 렌더/empty/loading sentinel
- rollout → smoke(인프라 준비 후) + rollback
- 실행 불가(라이브 E2E) 구간은 "실행 불가(인프라 대기)" 명시

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
- 🔴 현 루프 단절·갭3 식별  🟢 코드/스키마 truth lock  🔵 scope 확정(Large 6 phase)
- ✋ Gate: 충돌 해소(§348 진화 승인), 가정 검증  ·  Rollback: planning-only

### Phase 1: 발송 reply-to 계약 전환 (루프 클로즈 진입)
- Status: [ ] Pending
- 🔴 RED: vendor-requests 발송이 rfqToken 발급 + `replyTo=rfq+token@inbound…` 임베드하는 failing test. 348a sentinel 진화(직접수신→시스템).
- 🟢 GREEN: rfqToken ensure(없으면 생성) + replyAddress 빌더 공용화 + replyTo 배선.
- 🔵 REFACTOR: replyAddress 빌더 단일화(rfq-token route와 공유), NEXT_PUBLIC_DOMAIN fallback 정합.
- ✋ Gate: 발송 시 토큰 보장, reply-to 정합, 348a 진화 GREEN, 기존 발송 회귀 0  ·  Rollback: replyTo=session.user.email 복원

### Phase 2: inbound parse 보강 + 첨부 실저장 (누락 0)
- Status: [ ] Pending
- 🔴 RED: attachment가 Supabase Storage에 실제 업로드되는 test(메타-only placeholder 금지). dedup/UNMATCHED/만료 매칭 test.
- 🟢 GREEN: `uploadAttachment` Supabase Storage 실구현(bucket quote-replies), 실패 시 명시 처리(silent success 금지).
- 🔵 REFACTOR: 트랜잭션 경계·크기 제한·확장자 sanitize 정리.
- ✋ Gate: 첨부 실저장 검증, placeholder 0, dedup 유지, storage 실패 비-silent  ·  Rollback: 업로드 구현 revert(메타-only로 임시 복귀 금지 — 대신 기능 비활성 플래그)

### Phase 3: QuoteReply 표시 UI (same-canvas)
- Status: [ ] Pending
- 🔴 RED: quotes 상세에 회신 섹션 렌더 + empty/loading/error test. 신규 page 금지 sentinel.
- 🟢 GREEN: 회신 목록(발신·시각·본문·첨부 다운로드) same-canvas 섹션/dock 배선.
- 🔵 REFACTOR: 중복 제거, workbench 구조 보존.
- ✋ Gate: dead button/no-op 0, empty/loading/error 존재, page-per-feature 0  ·  Rollback: UI 섹션 revert

### Phase 4: 연구소 알림 + §11.348 진화 정합
- Status: [ ] Pending
- 🔴 RED: 새 QuoteReply 생성 시 연구소(quote owner/org)에 알림 발송 test. §348 진화 일관성 sentinel.
- 🟢 GREEN: inbound 매칭 성공 시 sendEmail 알림(원문 링크=quotes 화면). 직접수신 폐기 보완.
- 🔵 REFACTOR: 알림 중복/스팸 방지(회신당 1회).
- ✋ Gate: 알림 정합, 직접수신 폐기 보완 확인, 알림 실패 비차단  ·  Rollback: 알림 비활성

### Phase 5: Rollout / Smoke / Rollback + 인프라 문서화
- Status: [x] Complete (코드) / 라이브 smoke 는 인프라 대기
- 🔴 RED: rollout 실패모드 = MX 미비 시 회신 유실 위험(P1 reply-to 전환). graceful 검증.
- 🟢 GREEN: **rollout gate `INBOUND_RFQ_ENABLED`** 추가 — 기본(미설정) 직접수신 유지(유실 0). inbound 401 graceful 확인. 인프라 체크리스트 확정(아래).
- 🔵 REFACTOR: notes 정리.
- ✋ Gate: 인프라 미비 시 발송/기존 흐름 무해(flag off=현행), rollback 문서화  ·  Rollback: `INBOUND_RFQ_ENABLED` unset(직접수신 즉시 복원)

**★ 인프라 의존성 체크리스트 (호영님 — 코드와 분리, 순서대로):**
1. `inbound.labaxis.co.kr` MX → SendGrid Inbound Parse + Inbound Parse Host 등록
2. `SENDGRID_INBOUND_SECRET` env(webhook URL secret)
3. `NEXT_PUBLIC_DOMAIN=labaxis.co.kr` env(reply 주소 도메인)
4. `STORAGE_PROVIDER`(vercel-blob 권장, 검증됨) + 토큰(`BLOB_READ_WRITE_TOKEN`) — 첨부 실저장
5. **(마지막) `INBOUND_RFQ_ENABLED=true`** — 1~4 완료 확인 후에만 켠다(cutover)

**Cutover 순서 (안전):** 1→2→3→4 인프라 준비 → 테스트 회신 1건 smoke(UNMATCHED/MATCHED Logs 확인) → 5 flag on → 실발송 1건으로 E2E(회신→QuoteReply→received 탭→알림). 문제 시 5 unset 즉시 롤백(직접수신 복원).

## 8. Addenda

### A. Workflow / Ontology Addendum (quotes 핸드오프)
- Resolver Input: quote 상태 / 회신 유무 / 첨부 유무
- Expected Output: quotes 화면 "회신 N건" + 다음 액션(검토)
- Surface Rules: quotes same-canvas 섹션만, chatbot 금지

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| reply-to 전환으로 연구소 직접수신 상실 | High(의도) | Med | 알림 + quotes 표시로 보완(Phase 3·4) |
| 인프라 미비로 라이브 0 | High | High | 코드 완성+graceful, 인프라 체크리스트(Phase 5), 호영님 |
| 첨부 storage 실패 → 누락 | Med | High | 실저장+비-silent 실패(Phase 2), placeholder 금지 |
| provider 이원화(발송 Resend/수신 SendGrid) 혼선 | Med | Med | 문서화, inbound route 단일 |
| §11.348 sentinel 회귀 | Med | Low | 348a 진화(Phase 1) |

## 10. Rollback Strategy
- P1 실패: replyTo=session.user.email 복원(348a 원복)
- P2 실패: 첨부 기능 플래그 비활성(메타-only 복귀 금지)
- P3 실패: 회신 UI 섹션 revert
- P4 실패: 알림 비활성
- P5 실패: env unset(inbound 비활성) + reply-to 복원
- **Special:** 인프라 cutover는 env/MX 되돌림으로 즉시 무해화

## 11. Progress Tracking
- Overall: 100% (코드) / 라이브 E2E 는 인프라 대기(호영님)
- Current phase: 전 phase 코드 완료 — 트랙 종결
- Current blocker: 없음(코드) / 라이브는 인프라 5종(위 체크리스트)
- Next: 호영님 인프라 cutover(1→5 순서) 후 E2E smoke

**Phase Checklist:**
- [x] Phase 0 (Truth lock)
- [x] Phase 1 (발송 reply-to 전환, 064ed5f6)
- [x] Phase 2 (첨부 실저장, 6ce4b877)
- [x] Phase 3 (회신 표시 UI, ecacd364)
- [x] Phase 4 (연구소 알림, ed1dc37f)
- [x] Phase 5 (rollout gate + 인프라 체크리스트)

## 12. Notes & Learnings
- [2026-06-18] 진입 전 truth lock: 자동수신 뼈대(스키마·토큰·inbound route) 80% 존재, 루프 미연결(발송 reply-to 미배선) + 첨부 placeholder + UI 부재가 실갭.
- §11.348-SEND-A는 폐기가 아니라 "직접수신→LabAxis 집약"으로 진화(호영님 승인).
- 인프라(MX/SendGrid Parse/env/Supabase bucket)는 호영님 — 코드와 분리, Phase 5 체크리스트.
