feat(email): §11.314 Phase 2 #smtp-resend — sender.ts mock → Resend 실제 발송 (호영님 결정 2026-05-30)

호영님 결정(2026-05-30): Provider=Resend / From=noreply@labaxis.co.kr / RESEND_API_KEY env.

배경:
- §11.314-b PDF + mailto MVP 완료 후 실제 SMTP 발송 단계
- resend ^6.6.0 이미 package.json 설치됨 (추가 npm install 0)
- sender.ts production 분기 = TODO 주석 + console.log (mock)

Fix (Phase 2 — sender.ts 단일 file + .env.example):

- apps/web/src/lib/email/sender.ts:
  · Resend import 추가 (`import { Resend } from "resend"`)
  · resend 클라이언트 초기화 (`new Resend(process.env.RESEND_API_KEY ?? "")`)
  · production 분기 (TODO 제거):
    · EMAIL_FROM env (fallback: noreply@labaxis.co.kr) 발신 주소
    · EmailAttachment → Resend attachments 포맷 변환 (Buffer→base64)
    · resend.emails.send() 실제 호출
    · error 시 throw → caller try/catch 전파 (silent success 금지)
  · 보존: isVendorPilot 분기(pilot SMTP skip) + NODE_ENV=development 콘솔 로깅
  · 보존: EmailOptions/EmailAttachment interface + sendEmail() 시그니처 (caller 8개 영향 0)

- apps/web/.env.example:
  · RESEND_API_KEY="" 추가 (Resend 대시보드에서 발급)
  · EMAIL_FROM="noreply@labaxis.co.kr" 추가

- apps/web/src/__tests__/regression/email-sender-smtp-314-p2.test.ts (sentinel):
  · 3 describe / 11 it
  · Resend import + send() 호출 + RESEND_API_KEY env + throw on error
  · isVendorPilot + NODE_ENV=development 보존
  · EmailOptions 시그니처 보존 (caller 8개 영향 0)
  · .env.example 키 명시

canonical 보존:
- caller 8개 `await sendEmail(options)` 시그니처 변경 0
- pilot vendor SMTP skip 보존 (no real outbound mail)
- NODE_ENV=development 콘솔 로깅 보존 (sandbox 개발 환경)
- EmailAttachment interface 보존 (§11.314-b PDF 첨부 정합)

호영님 production effect:
1. RESEND_API_KEY + EMAIL_FROM env Vercel 설정 후 → 실제 SMTP 발송 활성화
2. 견적 요청서 PDF 첨부 자동 발송 (§11.314-b + §11.314 Phase 2 합산)
3. 발송 실패 시 caller try/catch 에 throw 전파 (silent fail 0)
4. API key 미설정(빈 문자열) → Resend SDK = 401 throw → caller 에서 인지 가능
5. pilot vendor 자동 보호 유지 (no real outbound mail)

Out of Scope (Phase 3):
- 8 caller try/catch 영향 audit (throw 추가로 caller 기존 catch 그대로 작동)
- 발송 queue / retry (provider SDK 기본 retry 우선)
- 발송 audit log (DB) (caller 책임, 일부 이미 구현)
- PLAN closeout

env 설정 가이드 (호영님):
1. https://resend.com 가입 → API Keys → Create API Key
2. Vercel Dashboard → Settings → Environment Variables:
   - RESEND_API_KEY = <발급받은 키>
   - EMAIL_FROM = noreply@labaxis.co.kr (Resend 도메인 인증 후)
3. Resend Domains → labaxis.co.kr 도메인 인증 (DNS TXT 레코드)
4. 도메인 인증 전 테스트: EMAIL_FROM = onboarding@resend.dev (Resend 공용 주소)

Rollback path: git revert <SHA>
- sender.ts 옛 TODO + console.log 복원
- .env.example 키 제거
- sentinel 삭제
