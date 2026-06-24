# Implementation Plan: Quote Dispatch — 단일 발송 실 이메일 통합 (§11.314 옵션 A 역전)

- **Status:** ⏳ Pending
- **Started:** 2026-06-24
- **Last Updated:** 2026-06-24
- **Estimated Completion:** TBD

**CRITICAL INSTRUCTIONS**: After each phase:
1. ✅ 체크박스 갱신 2. 🧪 operator vitest + `npm run build` 게이트 3. ⚠️ 전 quality gate 통과 4. 📅 Last Updated 갱신 5. 📝 Notes 기록 6. ➡️ 통과 후에만 다음 phase
⛔ quality gate 실패·source-of-truth 충돌·dead button/no-op/placeholder success 금지

---

## 0. Truth Reconciliation

**Latest Truth (2026-06-24 세션 검증):**
- 단일 견적 "견적 요청 발송"(card → `VendorRequestModal`): `csrfFetch POST /api/quotes/{id}/generate-pdf` → PDF 다운로드 + `mailto:` + status PENDING/PARSED→SENT(generate-pdf route L146-149). **실 시스템 발송 0**(운영자 수동 전송). 모달 토스트 "PDF 다운로드 완료"(정직).
  - 근거: `components/quotes/dispatch/vendor-dispatch-workbench.tsx` L389-456 / `app/api/quotes/[id]/generate-pdf/route.ts` L132-157.
- 일괄 "전체 발송"(`BatchDispatchSheet`): `dispatchSingleQuote` → `POST /api/quotes/{id}/vendor-requests` → DB `QuoteVendorRequest`(status SENT) + `sendEmail`(`lib/email/sender.ts`: prod Resend SMTP / dev console.log) + audit EMAIL_SENT.
  - 근거: `batch-dispatch-sheet.tsx` L85-142 / `app/api/quotes/[id]/vendor-requests/route.ts` L275-409 / `sender.ts` L65-122.

**Conflict:**
- §11.314-b-2/c "옵션 A"(단일=PDF+mailto, PDF 발행=발송 행위→SENT) ↔ 신규 호영님 결정(2026-06-24, 단일도 실 이메일 발송). 당시 sender mock(실 발송 0)이라 PDF 우회였으나, 현재 Resend 라이브(일괄 prod 사용 중).

**Chosen Source of Truth:**
- **신규 호영님 결정 supersede** §11.314-b-2/c. 단일 발송 = 일괄과 동일하게 `/vendor-requests` 실 발송 경로. PDF 다운로드는 **별도 export 액션으로 유지**(호영님 결정).

**Environment Reality Check:**
- [ ] repo `C:\Users\young\ai-biocompare`, web=`apps/web`, HEAD e0501166
- [ ] operator vitest + build 게이트, sandbox 편집·정찰만
- [ ] ⚠️ **미확인 블로커 후보**: `/vendor-requests`가 requester 역할로 발송 가능한지(아래 Risk R1) — P0 선검증

---

## 1. Priority Fit
- [x] Post-release (honesty/UX 정합). blocker 아님.
- 현 단일 흐름은 정직 토스트("다운로드")라 거짓은 아니나, 같은 "발송"이 단일(실발송0)·일괄(실발송) 의미 비대칭 → 통합으로 해소.

## 2. Work Type
- [x] Workflow/Ontology Wiring · [x] Web · [x] Design Consistency (라벨/거동 정합). (Bugfix성 honesty 포함.)

## 3. Overview

**Feature:** 단일 견적 발송을 PDF+mailto → 실 이메일 발송(`/vendor-requests`, batch와 동일 경로)으로 통합. PDF는 "견적서 다운로드" 별도 export로 분리 존치.

**Success Criteria:**
- [ ] 단일 "견적 요청 발송" → `/vendor-requests` POST(실 발송), `mailto:`/generate-pdf-as-send 제거
- [ ] 토스트가 실 발송 결과 정직 표기(`emailsSent`/`emailsFailed`, dev=미발송 명시)
- [ ] "견적서 PDF 다운로드"는 별도 액션으로 잔존(발송과 분리, dead button 0)
- [ ] status SENT 전이는 발송 경로(vendor-requests)가 책임(generate-pdf의 send용 status 전이는 발송과 분리)
- [ ] requester 역할 발송 가능(403 0) — 아니면 R1 처리 선행

**Out of Scope (⚠️):**
- [ ] sender.ts Resend 인프라 변경 / 이메일 템플릿 재설계
- [ ] 일괄 발송 흐름 변경(이미 실 발송)
- [ ] generate-pdf 라우트 삭제(PDF export로 존치)

**User-Facing Outcome:** 단일 "발송"이 일괄과 동일하게 실제 공급사 이메일 발송. PDF가 필요하면 "견적서 다운로드"로 별도 수행. dev에선 "개발 환경=미발송" 정직 표기.

## 4. Product Constraints

**Must Preserve:** [x] workbench/queue/rail/dock · [x] same-canvas · [x] canonical(QuoteVendorRequest/status) · [x] invalidation(["vendor-requests"] cache-bust)
**Must Not Introduce:** [x] page-per-feature · [x] dead button/no-op · [x] **placeholder success(발송 안 됐는데 "발송 완료")** · [x] fake send
**Canonical Truth Boundary:**
- Source of Truth: `QuoteVendorRequest`(status/sentAt) + `sendEmail` 결과(emailsSent/Failed) + Quote.status
- Derived: 토스트·배지·funnel 표시
- Persistence: `/vendor-requests` POST(기존 경로 재사용)
**UI Surface Plan:** [x] 기존 VendorRequestModal(same-canvas) — 신규 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 단일 모달 dispatch → `/vendor-requests`(batch와 동일) | 실 발송 경로 단일화, DRY(dispatchSingleQuote 패턴 재사용) | VendorRequestModal 핸들러 재작성 |
| PDF는 "견적서 다운로드" 별도 버튼으로 분리 | 발송≠export 의미 분리, export UX 보존(호영님 결정) | 모달에 액션 2개(발송/다운로드) 공존 — 라벨 명확화 |
| generate-pdf 라우트의 send용 status SENT 전이 재검토 | 발송 책임을 vendor-requests로 이관 → generate-pdf는 순수 export(status 전이 제거 검토) | §11.314-c sentinel 진화 |

**Dependencies:** resolve-suppliers(validVendors)·csrfFetch·sender.ts. 신규 패키지 0(sandbox 설치 금지).
**Integration:** `/api/quotes/[id]/vendor-requests`(재사용), `["vendor-requests", quoteId]` invalidation(L1305 기존).

## 6. Global Test Strategy
- sentinel(readFileSync+regex): 단일 dispatch가 vendor-requests 호출·mailto 부재·정직 토스트. §11.314-b/c sentinel 진화(옵션 A 역전, 보호 의도=발송 정합 재정의). 각 phase가 자기 sentinel GREEN 동반(repo delta-0 규율).
- vitest/build = operator. sandbox "실행 불가" 표기, Grep 선검증.

## 7. Implementation Phases

#### Phase 0: Truth & Role Lock ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**R1 판정 = GREEN (통합 블로커 없음):** `/api/quotes/[id]/vendor-requests` POST L166-169 — `action: isReminder ? 'quote_request_resend' : 'quote_request_submit'`. **첫 발송=`quote_request_submit`는 requester 허용**(§11.314-a fix, L152-153 주석 명시). PDF 우회는 권한이 아니라 "sender mock(실 발송 0)"(§11.314-b-2) 때문 → 현재 Resend prod 라이브(`email-sender-resend-integration-314p2`·`smtp-314-p2` sentinel 확증) → **단일 통합 가능**. `vendor-requests-permission-fix-314a` sentinel이 requester 권한 확정.

**Sentinel 진화 맵 (역전):**
- ⚠️ **`vendor-dispatch-pdf-wiring-314b2.test.ts`** = 옵션 A 거동 전면 핀(generate-pdf 호출 / **vendor-requests POST 0** / mailto / "PDF 다운로드" 라벨·토스트). **전면 역전 재작성** 필요 — 보호 의도를 "PDF+mailto"→"실 발송(vendor-requests)+PDF 별도 export"로 재정의(호영님 결정 역전, 약화 아님).
- **`quote-generate-pdf-314b.test.ts`** = generate-pdf status PENDING/PARSED→SENT 핀(§11.314-c). 발송 책임을 vendor-requests로 이관 시 generate-pdf는 순수 export → **send용 status 전이 제거 + 해당 단언 진화**(P2에서 정독 후 확정).
- 확인 필요(P1): `mobile/vendor-request-modal*.test.ts`·`dispatch-supplier-wiring.test.ts` — VendorRequestModal dispatch 거동 핀 여부.
- 무손(역전 무관, 오히려 통합 근거): `vendor-requests-permission-fix-314a`·`email-sender-resend-integration-314p2`·`email-sender-smtp-314-p2`·`vendor-requests-reminder`·`quote-send-replyto-348a`.

**✋ Gate:** ✅ R1 GREEN, ✅ 핵심 진화 대상 2 sentinel 식별 + 무손 대상 분리
**Rollback:** planning-only

#### Phase 1+2(wire): Contract & 단일 실 발송 ✅ COMPLETE (2026-06-24)
- Status: [x] Complete (delta-0 위해 contract+wire+sentinel 진화 동반)

**Land:** `vendor-dispatch-workbench.tsx` `executeDispatch` → `csrfFetch POST /api/quotes/{id}/vendor-requests`({vendors: validVendors, message, expiresInDays: clampedExpires}). `mailto:`/generate-pdf-as-send 제거. 토스트=실 발송 결과(`result.summary.emailsSent/emailsFailed` 기반, failed>0 시 "일부 공급사 발송 실패" destructive — 가짜 성공 0). tracking statusLabel "PDF 다운로드 완료"→"발송 완료". CTA 라벨 "견적서 PDF 다운로드"→"공급사에 발송"/"발송 중…"/"발송 완료", aria-label→"공급사에 견적 요청 발송". 보존: email 검증·validVendors·sentTracking/localStorage·sendReadiness·setConfirmationOpen·onSuccess.

**Sentinel 진화 3건(missed-sweep 전수 grep으로 식별):**
- `vendor-dispatch-pdf-wiring-314b2.test.ts` — **전면 재작성**(PDF+mailto → vendor-requests 실 발송, 보호 의도 역전).
- `vendor-dispatch-workbench-aria-label-274.test.ts` — active aria-label 핀 진화("공급사에 견적 요청 발송").
- `dispatch-supplier-wiring.test.ts` — tracking statusLabel 핀 진화("발송 완료").
- 무손: `quote-generate-pdf-314b`(route 미변경)·audit-345b/b2·pdf-font-326·email-sender-314p2(전부 route/config/infra, 클라 dispatch 무관).

**✋ Gate:** dead button/no-op/placeholder success 0(실 발송 결과 기반), build EXIT 0, baseline-delta 0(3 sentinel 진화 동반)
**Rollback:** executeDispatch → generate-pdf+mailto 복원 + 3 sentinel revert

#### Phase 2(pdf): 견적서 다운로드 별도 export ✅ COMPLETE (2026-06-24, P1과 동일 배치 병합)
- Status: [x] Complete

**병합 사유:** baseline-delta가 **4번째 sentinel** `pdf-font-bundling-326` Phase 1(vendor-dispatch-workbench의 §11.326 PDF 실패 토스트/console 핀)을 신규 RED로 포착. §11.326 완화책은 PDF 생성 행위가 있는 곳에 있어야 정당 → P2(pdf 버튼)를 P1과 같은 배치로 당겨 `executeDownloadPdf`에 §11.326 토스트·console 이전 → pdf-font-bundling-326 **진화 0으로 GREEN 유지** + PDF transient gap 동시 해소.

**Land:** `vendor-dispatch-workbench.tsx` — `executeDownloadPdf`(generate-pdf **GET**, status 전이 0=발송 아님) + `isDownloadingPdf` state + 푸터 "견적서 다운로드" 버튼(취소 옆). 성공 토스트 "견적서를 다운로드했습니다"(’PDF 다운로드 완료’ 문구 회피 — 314b2 정합). 실패=§11.326 완화 토스트("견적서 PDF를 만들 수 없습니다"+미리보기 복사 안내)+console.error[§11.326]. 314b2에 export 버튼 가드 추가.

**✋ Gate:** PDF GET 다운로드·status 오염 0·pdf-font-bundling-326 GREEN(진화 0)·314b2 자기모순(generate-pdf 호출 0→GET export) 교정·build EXIT 0
**Rollback:** 버튼 + executeDownloadPdf + state revert

#### Phase 3: Smoke / Rollback / sentinel 마무리
- Status: [ ] Pending
**🔴 RED:** §11.314-b-2/c 진화 sentinel 최종.
**🟢 GREEN:** dev/prod 거동 정직 문구 확정, audit EMAIL_SENT 경로 확인, smoke(단일·일괄 둘 다 실 발송).
**✋ Gate:** baseline-delta 0, build EXIT 0, rollback 문서화
**Rollback:** env/flag 없음 — 핸들러 git revert

## 8. Addenda
**Workflow/Ontology(적용):** dispatch resolver — 발송 전(PENDING)→발송 후(SENT) 전이는 **실 발송 성공 시에만**(placeholder 금지). row CTA "견적 요청 발송"=실 발송. PDF=별도 export.

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| ~~**R1** requester 역할 `/vendor-requests` 발송 403~~ **[P0 해소]** | ~~Med~~ | ~~High~~ | ✅ vendor-requests는 첫 발송=quote_request_submit로 requester 허용(§11.314-a). 블로커 아님 |
| placeholder success(발송 실패인데 SENT) | Med | High | 토스트·status 전이를 sendEmail 결과 기반으로(emailsSent>0). 회귀 sentinel |
| §11.314-b-2/c sentinel 역전 진화 | High | Med | 보호 의도(발송 정합) 보존하며 핀 진화. 옛 PDF+mailto 핀 grep 선식별 |
| dev console.log 오해(실발송으로) | Low | Med | dev "미발송(개발 환경)" 정직 표기 |
| PDF export 분리 시 dead button | Low | Med | generate-pdf 실 동작 유지(다운로드), 라벨 "견적서 다운로드" 명확 |

## 10. Rollback Strategy
- P1: sentinel revert. P2: dispatch 핸들러 generate-pdf+mailto 복원. P3: 문구/진화 revert. (env/flag 없음, git revert 단순.)

## 11. Progress Tracking
- Overall: 90% (P0 + P1/wire + P2/pdf 완료) · Current: P3(smoke/rollback) · Blocker: 없음 · Next: smoke(단일·일괄 실 발송 + PDF 다운로드) + 마무리
**Checklist:** [x] P0 [x] P1+wire [x] P2(pdf export) [ ] P3(smoke)
✅ transient PDF gap 해소(P2 동일 배치 병합).

## 12. Notes & Learnings
**Decisions (2026-06-24, 호영님):**
- 옵션 2: 단일 발송 → 실 이메일 발송 통합(§11.314-b-2 옵션 A 역전, Resend 라이브 전제).
- PDF "견적서 다운로드"는 별도 export로 유지.
**Open:** R1(requester 발송 권한) — P0에서 확정 후 통합 가부 결론.
