# Implementation Plan: 운영 브리핑 — 견적 상태(완료/취소) 공급사 통보 (미리보기→확인→발송)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-29
- **Last Updated:** 2026-06-29

**CRITICAL**: phase별 체크박스→quality gate→Notes→다음. ⛔ dead button/no-op/placeholder success 금지. ⛔ 발송 전 미리보기·명시 확인 없이 발송 금지. ⛔ 미리보기≠발송 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 호영님 directive 2026-06-29 (제안형 in-place 승인 = 견적 상태 통보 1종으로 고정).

**호영님 확정 제약:**
- 후보 = **견적 상태(완료/취소) → 고객 통보 이메일 1종**. 발주/MSDS/추천채택 제외.
- **8초 deferred-commit 폐기.** 안전장치 = **발송 전 미리보기(받는사람·제목·본문) + 명시 확인**.
- 발송 = **기존 `PATCH /api/quotes/[id]/status`** + 기존 activity/transition 로그 재사용. **신규 백엔드 라우트 0.**

**Recon (코드 확정):**
- `PATCH status`: body `{status, reason?}`, enforceAction(quote_status_change), `to = quote.user.email`(요청자). COMPLETED→`sendQuoteCompletedEmail`(react-email `QuoteCompletedEmail`), CANCELLED+reason→`sendQuoteRejectedEmail`(인라인 HTML). CSRF 보호(csrf-route-registry L87) → 클라 `csrfFetch`(dispatch 형제 선례).
- 미리보기 데이터(수신자·itemCount·totalAmount) = 기존 `GET /api/quotes/[id]/detail` 재사용(user.email 반환).
- `@react-email/render` **부재**(node_modules·package.json) + 설치 금지 → 완료 react-email을 popup에서 byte-identical 렌더 불가.

**Chosen Source of Truth — 미리보기≡발송 보장 방식:**
- **공유 카피 모듈**(client-safe, 순수) `lib/email/quote-status-email-content.ts`: `quoteStatusEmailSubject(kind, quoteNumber)` + `quoteStatusEmailBody(kind, data) → string[]`(본문 문구).
- 메일러가 이를 사용: 제목(양쪽), 취소 본문 HTML(공유 문구로 빌드), 완료 본문 문구(`QuoteCompletedEmail`가 동일 문구 렌더 — **디자인 보존, 문구 공유**).
- 미리보기 = 동일 모듈의 제목 + 문구 표시 → **발송되는 본문 문구와 동일**(content-honest). 완료 이메일의 시각 디자인은 프로덕션 그대로 유지.

**Environment:** main HEAD 1a45ad4b. operator=tsc/build/vitest/push 권위.

## 1. Priority Fit
- [x] Post-release — 제안형 첫 in-place 승인 파일럿(호영님 directed). 정직 안전장치(미리보기) 필수.

## 2. Work Type
- [x] Feature(in-place 승인) · [x] Workflow wiring · honesty-critical

## 3. Overview

**Success Criteria:**
- [ ] 견적 모듈·전이 가능(완료/취소) 카드에만 통보 액션 노출(dead button 0)
- [ ] 클릭 → `GET detail` → **받는사람·제목·본문 미리보기 패널**
- [ ] 명시 확인("확인하고 발송"; 취소는 사유 입력) 전 발송 0
- [ ] 발송 = `csrfFetch PATCH status` (COMPLETED / CANCELLED+reason). 기존 로그 적재
- [ ] 미리보기 제목·본문 = 실제 발송과 동일 소스(공유 모듈)
- [ ] 성공/실패/로딩 상태 처리. 발송 후 카드 갱신(store refetch 또는 낙관적)

**Out of Scope (⚠️):**
- [ ] 발주/MSDS/추천채택 · 신뢰도% · 예측 · 자동승인 · 8초 타이머
- [ ] 신규 API 라우트 · 완료 이메일 시각 디자인 변경
- [ ] 견적 외 모듈 in-place 승인

**User-Facing Outcome:** 브리핑에서 견적 완료/취소를 처리할 때 **누구에게·어떤 제목·어떤 본문**이 가는지 보고 확인한 뒤 발송. 블라인드 발송 0.

## 4. Product Constraints
- Must Preserve: same-canvas(popup 인라인) · canonical truth(PATCH가 SoT·state-machine 검증) · 기존 popup 기능(dismiss/idle/nav) · honesty(미리보기≡발송)
- Must Not Introduce: placeholder success · 미리보기 없는 즉시 발송 · 미리보기≠발송 · 신규 백엔드 · dead button
- Canonical Truth: 상태 전이 = `PATCH`(validateTransition). 이메일 발송 = PATCH 내부(기존). 미리보기 = 파생 표시(truth 변형 0).

## 5. Architecture
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 공유 카피 모듈(제목/본문) | 미리보기≡발송 보장·drift 0 | 완료 컴포넌트 문구를 공유 소스로 이전(targeted) |
| 발송=기존 PATCH(csrfFetch) | 신규 백엔드 0·로그 재사용 | enforceAction 게이트 그대로(권한 없으면 403) |
| 미리보기 데이터=GET detail | 기존 엔드포인트·user.email | 추가 fetch 1회(액션 시) |
| 완료 react-email 디자인 보존 | 프로덕션 메일 품질 | 미리보기는 문구 텍스트(픽셀-identical 아님, content-identical) |

## 6. Test Strategy
- 신규 sentinel: 미리보기-우선(확인 핸들러 없는 발송 0)·제목/본문 공유 모듈 사용·csrfFetch PATCH·견적/전이 게이팅·popup 기존 보존.
- 공유 모듈 단위(제목/본문 빌더 순수성). operator vitest 권위.

## 7. Phases

### Phase 0: Truth Lock — [x] Complete
PATCH 수신자·이메일 분기·CSRF·GET detail·react-email/render 부재·공유 카피 방식 확정.

### Phase 1: 공유 카피 모듈 + 메일러 정합 — [ ]
`lib/email/quote-status-email-content.ts`(순수): 제목·본문 빌더. 메일러(완료/취소) 제목·본문을 이 모듈로 정합(발송 무변경·문구 공유화). 단위 검증.
- ✋ Gate: tsc 0, 기존 이메일 테스트 GREEN, 발송 동작 보존.

### Phase 2: popup 통보 액션 + 미리보기 패널 — [ ]
BriefCardInline(견적·전이가능) → "완료/취소 통보" 액션 → `GET detail` → 미리보기(받는사람/제목/본문 from 공유 모듈) → 확인(취소는 사유) → `csrfFetch PATCH`. 로딩/성공/실패 상태. dead button 0.
- ✋ Gate: tsc/build 0, no-op 0, 미리보기 없는 발송 0, honesty(공유 소스).

### Phase 3: sentinel — [ ]
미리보기-우선·공유 모듈·csrfFetch·게이팅·popup 보존.
- ✋ Gate: 신규 GREEN, 보존 GREEN, baseline 신규 RED 0.

### Phase 4: gate & live — [ ]
operator tsc/build·sentinel·baseline → push → 배포 → 라이브(미리보기→확인→발송·로그 적재, 로그인 세션 측).

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 완료 컴포넌트 문구 이전 시 이메일 깨짐 | Med | Med | targeted 치환·기존 이메일 테스트 GREEN 확인 |
| 미리보기≠발송 drift | Low | High | 단일 공유 모듈 강제·sentinel |
| enforceAction 403(권한 없음) | Low | Med | 실패 상태 정직 표기(가짜 성공 0) |
| popup 대형 파일 Edit truncation | Med | Med | byte-precise python + 3곳 wiring grep |

## 10. Rollback
- P1: 공유 모듈 + 메일러 revert / P2: popup revert / P3: sentinel revert / P4: 커밋 revert

## 11. Progress
- Overall: 15% · Current: Phase 1 · Blocker: 없음

## 12. Notes
- [2026-06-29] @react-email/render 부재·설치 금지 → byte-identical 렌더 불가. 공유 카피 모듈로 content-identical 미리보기. 완료 이메일 디자인 보존.
- [2026-06-29] 8초 deferred-commit 폐기(호영님). 안전 = 발송 전 미리보기+확인.
