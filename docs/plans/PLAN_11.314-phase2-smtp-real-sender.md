# Implementation Plan: §11.314 Phase 2 — SMTP 실제 발송 (sender.ts mock → production)

- **Status:** ⏳ Pending (호영님 provider 결정 대기)
- **Started:** 2026-05-30 (§11.324 종결 후 진입)
- **Estimated Completion:** TBD (Provider 결정 후 ~2-3h)
- **Scope:** release-prep deferred / single file core change / 8 caller 영향
- **호영님 모델 권장:** Opus 4.7로 충분 (provider SDK 통합 + env 설정 + error handling)
- **Prerequisite:** §11.314-b PDF + mailto MVP 완료 (task #97 completed)

---

## 🔒 통제 구조 (호영님 원칙)
| 구분 | 담당 |
|---|---|
| Provider 결정 | **호영님** (cost / quota / vendor lock-in 권한) |
| env 키 + Vercel 설정 | **호영님** (security 권한) |
| Production 발송 dry-run | 호영님 (sandbox SMTP 불가) |
| sandbox 작업 | Claude (sender.ts 구현 + sentinel) |

⛔ sandbox SMTP test 불가 — 호영님 환경 dry-run 의존
⛔ Provider API key 절대 sandbox 노출 금지

---

## 0. Truth Reconciliation ✅ COMPLETE (2026-05-30 sandbox)

**Target file:** `apps/web/src/lib/email/sender.ts` (~100 lines, mock)

**현재 sender.ts 구조:**
- ✅ `EmailAttachment` interface (filename / content Buffer or base64 / contentType MIME)
- ✅ `EmailOptions` interface (to / subject / html / text / attachments? / vendorId?)
- ✅ `sendEmail(options): Promise<void>` 함수 시그니처
- ✅ pilot vendor 분기 (isVendorPilot → SMTP skip + audit-only console.log)
- ✅ NODE_ENV=development 콘솔 로깅 (preview 100 chars + attachment metadata)
- ❌ production 분기 = TODO 주석 + 임시 console.log (실제 발송 0)

**Caller 8 file (모두 `await sendEmail(options)` 호출):**
1. `app/api/inventory/alerts/send/route.ts` — 재고 알림 발송
2. `app/api/orders/[id]/send-email/route.ts` — 주문 이메일
3. `app/api/quotes/[id]/route.ts` — 견적 발송
4. `app/api/quotes/[id]/vendor-requests/route.ts` — 견적 요청서 벤더 발송 (§11.314-b)
5. `app/api/request/[id]/approve/route.ts` — 결재 승인 알림
6. `app/api/request/[id]/reject/route.ts` — 결재 반려 알림
7. `app/api/vendor/quotes/[quoteId]/response/route.ts` — 벤더 응답 알림
8. `app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts` — 발주 승인 요청

**SDK 미설치 확인 필요:** package.json 에 `@sendgrid/mail` / `resend` / `@aws-sdk/client-ses` / `nodemailer` 모두 0 (Phase 0 추가 audit)

---

## 1. Priority Fit
- [x] **release-prep deferred** (release blocker 아님, 호영님 production smoke 시 mailto 폴백)
- [x] §11.314-b PDF + mailto MVP 의 다음 실제 발송 단계
- 비고: 호영님이 우선순위 P1 또는 P2 로 격상 결정 가능

## 2. Work Type
- [x] **Feature** (실제 SMTP 발송 신규)
- [x] **Migration / Rollout** (mock → production, feature flag 또는 env 분기)

## 3. Overview

**Feature Description:**
sender.ts production 분기에 실제 SMTP 발송 SDK 통합. mailto 폴백 대신 vendor email 자동 발송. 8 caller 의 sendEmail() 호출이 모두 실제 SMTP 로 라우팅.

**Success Criteria:**
- [ ] Provider 결정 + Vercel env 키 설정 (호영님)
- [ ] sender.ts production 분기에 provider SDK 통합
- [ ] EmailAttachment (PDF) 첨부 정합 (§11.314-b 견적 PDF 발송)
- [ ] error handling — provider API 실패 시 throw + log (caller 8개 try/catch 영향 확인)
- [ ] pilot vendor 분기 보존 (isVendorPilot SMTP skip 유지)
- [ ] NODE_ENV=development 콘솔 로깅 보존 (sandbox 개발 환경)
- [ ] sentinel — production 분기 결정 패턴 검증

**Out of Scope:**
- 발송 큐 (BullMQ/Inngest queue) — 동기 발송 우선
- 발송 retry / exponential backoff — provider SDK 내장 retry 우선
- 발송 audit log (DB) — caller 책임 (이미 일부 caller 구현)
- 이메일 template 변경 (templates.ts 별개 plan)
- 8 caller 동작 변경 (sender.ts 내부 swap 만)

## 4. Product Constraints
- ✅ canonical truth = sender.ts 단일 발송 흐름 (각 caller inline 발송 X)
- ❌ dead button / fake success = production fail 시 caller 에 throw (silent success 금지)
- ✅ pilot vendor 보호 (no real outbound mail to pilot vendor)
- ✅ NODE_ENV=development 콘솔 로깅 (sandbox 보호)

## 5. Architecture & Dependencies — Provider 옵션 비교 (호영님 결정)

| Provider | 무료 quota | 비용 (월 1만 건) | SDK 복잡도 | LabAxis 정합 | 호영님 권장도 |
|---|---|---|---|---|---|
| **Resend** | 3,000/월 + 100/일 | $20/월 (50k) | ⭐ 가장 simple, React Email 친화 | ✅ Next.js + React 생태계 정합 | ⭐⭐⭐ **권장 1순위** |
| **SendGrid** | 100/일 (3,000/월) | $19.95/월 (50k) | ⭐⭐ 표준 enterprise SDK | ⭐ 엔터프라이즈 표준, 다소 무거움 | ⭐⭐ |
| **AWS SES** | 62,000/월 (EC2 한정) | $1/월 (10k) — 가장 저렴 | ⭐⭐⭐ AWS 인프라 + IAM 설정 필요 | ⭐ Vercel 호스트 → SES auth 추가 작업 | ⭐ (cost 우선 시 권장) |
| **Nodemailer SMTP (Gmail Workspace)** | Google Workspace 의존 | Workspace 라이선스 비용 | ⭐⭐ SMTP 직접 설정 | ⭐⭐ 회사 도메인 자체 발송 | ⭐⭐ (Google Workspace 사용 중이면 권장) |

**호영님 결정 필요 항목:**
- [ ] Provider 선택 (Resend / SendGrid / AWS SES / Nodemailer SMTP)
- [ ] env 키 명칭 + Vercel 설정
- [ ] From 주소 (no-reply@labaxis.co.kr? quote@labaxis.co.kr?)
- [ ] 일 발송량 예상 (free tier 충분 여부 판단)
- [ ] retry 정책 (provider SDK 기본 vs 별도 큐)

## 6. Global Test Strategy
- sandbox: sender.ts mock 분기 단위 테스트 (vitest)
- 호영님 로컬: provider SDK dry-run (Resend test mode 또는 SendGrid sandbox)
- production: 호영님 limited rollout (1-2 vendor 테스트 발송 후 전체 확대)

## 7. Implementation Phases

### Phase 0: Provider 결정 + env 명세 (호영님 입력 대기)
- Status: [ ] Pending (호영님 결정)
- 호영님 spec text 회신 받기 (provider + env + From 주소)
- package.json SDK 미설치 audit

### Phase 1: RED sentinel
- Status: [ ] Pending
- production 분기 결정 patterns 단언
- pilot vendor 보존 + NODE_ENV=development 콘솔 보존
- attachment 정합 + error throw 단언

### Phase 2: GREEN 작업
- Status: [ ] Pending
- package.json SDK 추가 (npm install <provider-sdk>)
- sender.ts production 분기 swap (TODO → real send)
- env 검증 (build time 또는 runtime guard)
- error handling + throw 패턴

### Phase 3: 회귀 + closeout
- Status: [ ] Pending
- 8 caller try/catch 영향 audit
- 호영님 production dry-run 가이드
- PLAN closeout

## 8. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| sandbox SMTP test 불가 | High | Med | 호영님 로컬 dry-run 의존 (Resend test mode / SendGrid sandbox) |
| Provider API key 노출 | Low | High | env 키 sandbox 절대 노출 X, .env.example 만 |
| 8 caller try/catch 미정합 | Med | Med | Phase 3 audit, throw 추가 시 caller 영향 0 보장 |
| free tier quota 초과 | Low | Med | Phase 0 호영님 일 발송량 예상 + quota 결정 |
| pilot vendor 보호 회귀 | Low | High | Phase 1 sentinel 으로 isVendorPilot 분기 강제 보존 |

## 9. Rollback Strategy
- Phase 1 fail: sentinel 삭제
- Phase 2 fail: sender.ts production 분기 옛 TODO 복원, mailto 폴백 유지
- Phase 3 fail: env 키 비활성 → NODE_ENV=production 에서도 mock 로깅으로 폴백

## 10. Notes

**§11.314-b cross-reference:**
- task #97 (§11.314-b 견적요청서 PDF + mailto MVP) = mailto 폴백으로 호영님 production 사용 중
- 본 Phase 2 = mailto → 자동 SMTP 발송 전환 (사용자 경험 ↑, vendor 응답 시간 ↓)

**호영님 spec text 요청 항목:**
1. Provider 선택 (4 옵션 중 1)
2. env 키 명칭 (예: RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO)
3. From 주소 + Reply-To 주소
4. 일 발송량 예상 (free tier 결정)
5. retry/queue 정책 (Phase 2 vs 별도 batch)
