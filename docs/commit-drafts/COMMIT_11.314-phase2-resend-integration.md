feat(email): §11.314 Phase 2 #resend-integration — sender.ts production 분기 Resend SDK 통합 (호영님 release-prep deferred, 2026-05-30)

호영님 release-prep deferred §11.314 Phase 2 (GREEN) — SMTP 실제 발송 전환.

배경 (Phase 0 Truth audit):
- §11.314-b (task #97) PDF + mailto MVP 완료, production = mailto 폴백
- sender.ts mock (NODE_ENV=development 콘솔 로깅 + production TODO) → 실제 발송 필요
- resend ^6.6.0 SDK 이미 설치됨 + .env.example RESEND_API_KEY/EMAIL_FROM 정합 완료
- 호영님 권장안 채택: Provider=Resend, From=noreply@labaxis.co.kr
- sandbox 발견: sender.ts line 84 partial 상태 (이전 작업 중단) → 완전 재작성

Fix (Phase 1+2 — sender.ts 단일 + sentinel 1):

- apps/web/src/lib/email/sender.ts (재작성):
  · `import { Resend } from "resend"` import + lazy 초기화 (`getResend()` helper)
  · `_resend: Resend | null = null` 모듈 레벨 + 빌드 타임 throw 방지
  · `RESEND_API_KEY` env 누락 시 throw + 명확한 메시지
  · production 분기 (NODE_ENV !== "development" + pilot 미해당):
    · `from = process.env.EMAIL_FROM ?? "noreply@labaxis.co.kr"` (fallback 안전)
    · `await resend.emails.send({ from, to, subject, html, text, attachments })`
    · attachments map (filename / content / contentType) Resend API 정합
    · `if (error) throw new Error(...)` silent success 금지
    · 발송 성공 시 `console.log` + messageId
  · canonical 보존:
    · EmailAttachment / EmailOptions interface 시그니처 변경 0
    · sendEmail(options): Promise<void> 시그니처 변경 0
    · pilot vendor isVendorPilot 분기 보존 (no real outbound mail to pilot)
    · NODE_ENV=development 콘솔 로깅 보존 (sandbox 보호)
    · 8 caller `await sendEmail(options)` 호출 시그니처 영향 0

- apps/web/src/__tests__/regression/
  email-sender-resend-integration-314p2.test.ts (NEW):
  · 7 it Phase 2 GREEN target:
    · Resend SDK import + 인스턴스 ✓
    · resend.emails.send() + throw new Error ✓
    · EMAIL_FROM env 사용 ✓
    · RESEND_API_KEY env 사용 ✓
    · attachments 정합 (send() options.attachments) ✓
    · 옛 production TODO 주석 잔존 0 ✓
  · 5 it canonical 보존:
    · EmailAttachment / EmailOptions interface 시그니처 ✓
    · sendEmail 함수 시그니처 ✓
    · pilot vendor isVendorPilot 분기 ✓
    · NODE_ENV=development 콘솔 로깅 ✓

호영님 production effect:
1. NODE_ENV=production (Vercel) + RESEND_API_KEY 설정 시 자동 SMTP 발송 작동.
2. 8 caller (inventory alerts / orders send-email / quotes 3 / request approve+reject / vendor quotes response / purchase-conversion) 코드 변경 0, sender.ts swap 만으로 SMTP 전환.
3. PDF 첨부 (§11.314-b 견적요청서) 정합 — Resend attachments 직접 전달.
4. SMTP 실패 시 throw → caller try/catch 에 전파 (silent success 금지).
5. pilot vendor 자동 보호 (test vendor 에게 실제 메일 안 감).
6. development 환경에서는 콘솔 로깅 (sandbox 작업 보호).

호영님 진입 시 필수 사전 조치:
1. Resend dashboard 가입: https://resend.com
2. API key 발급 → Vercel env `RESEND_API_KEY` 설정 (production + preview)
3. 도메인 verification: Resend dashboard → labaxis.co.kr DNS TXT/MX 추가
4. From 주소 검증: noreply@labaxis.co.kr 활성화 확인
5. EMAIL_FROM Vercel env 설정 (선택, .env.example 기본값 사용 가능)
6. Vercel redeploy → production smoke

호영님 production smoke 가이드:
- 1차 dry-run: test vendor 1건 발송 → Resend dashboard 로그 확인 (delivered / bounced)
- 2차 limited: 실제 vendor 1-2건 발송 → vendor 측 수신 확인
- 3차 전체 rollout: 모든 caller 정상 동작 확인

Out of Scope (Phase 3):
- 회귀 audit (caller 8개 try/catch 정합) + PLAN closeout
- 옛 .env.example SendGrid placeholder 주석 정리 (Phase 3)
- 발송 큐 (BullMQ / Inngest queue) — 동기 발송 우선
- retry 정책 별도 batch (Resend SDK 내장 retry 사용)

검증 (sandbox 정적 grep):
- Resend import + new Resend() ✓
- resend.emails.send() + throw new Error ✓
- EMAIL_FROM / RESEND_API_KEY env ✓
- attachments 정합 ✓
- 옛 production TODO 잔존 0 ✓
- pilot vendor + NODE_ENV=development 분기 보존 ✓

Rollback path: git revert <SHA>
- sender.ts 옛 mock TODO 분기 복원 (NODE_ENV=production 에서도 console.log 만)
- caller 8개 영향 0 (sender.ts swap 만 revert)
- sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/lib/email/sender.ts `
  apps/web/src/__tests__/regression/email-sender-resend-integration-314p2.test.ts `
  docs/plans/PLAN_11.314-phase2-smtp-real-sender.md `
  docs/commit-drafts/COMMIT_11.314-phase2-resend-integration.md
git status
git commit -F docs/commit-drafts/COMMIT_11.314-phase2-resend-integration.md
git push origin main
```

호영님 환경 사전 조치 (push 전 또는 후):
1. Resend dashboard 가입 + API key 발급
2. Vercel project settings → Environment Variables:
   - `RESEND_API_KEY` = re_xxxxxxx (production + preview)
   - `EMAIL_FROM` = noreply@labaxis.co.kr (선택)
3. Resend dashboard → Domains → labaxis.co.kr 추가 + DNS verification
4. Vercel redeploy

## Production smoke

1. Vercel READY + env 키 설정 확인
2. Resend dashboard 도메인 verification "Verified" 상태 확인
3. test vendor (pilot 아닌 실제 vendor) 1건 발송:
   · /api/quotes/[id]/vendor-requests POST → vendor email 발송
   · Resend dashboard 로그 → "delivered" 확인
4. PDF 첨부 (§11.314-b 견적요청서) 정상 수신 확인 — vendor 측 PDF 열림
5. SMTP 실패 case (잘못된 from 도메인 등) → caller try/catch error 처리 확인
6. pilot vendor (#vendor-email-seed-pilot) → SMTP skip 콘솔 로그 확인 (실제 발송 안 됨)
7. NODE_ENV=development 환경 (호영님 로컬) → 콘솔 로깅만 작동 확인

## Next (호영님 push 회신 후)
- Phase 3: 회귀 audit (caller 8개 try/catch 정합) + .env.example 옛 SendGrid 주석 정리 + PLAN closeout
