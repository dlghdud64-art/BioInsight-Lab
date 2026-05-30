chore(email): §11.314 Phase 2 #closeout — caller 8 try/catch audit + .env.example SendGrid placeholder 제거 + PLAN 종결 (호영님 release-prep deferred, 2026-05-30)

호영님 release-prep deferred §11.314 Phase 3 (GREEN, closeout) — 회귀 audit + .env.example 정리 + plan 종결.

배경:
- §11.314 Phase 2 작업 (Resend SDK production 분기 통합) → throw 패턴 변경 영향 audit 필요
- .env.example 옛 SendGrid placeholder 잔존 (line 41-42, Resend 채택 후 무관)
- 호영님 권장안 채택 후 Phase 3 = closeout only

Fix (Phase 3 — .env.example 정리 + PLAN closeout):

- apps/web/.env.example (line 40-44):
  · 옛 placeholder 제거:
    · `# SENDGRID_API_KEY=""`
    · `# SENDGRID_INBOUND_SECRET=""`
  · 신 주석: `§11.314 Phase 2 (2026-05-30): SendGrid placeholder 제거 (Resend 채택)`
  · RESEND_API_KEY + EMAIL_FROM 보존 (Phase 2 정합)

- docs/plans/PLAN_11.314-phase2-smtp-real-sender.md:
  · Status: ⏳ Pending → ✅ Complete
  · Completed: 2026-05-30 (호영님 권장안 Resend 채택, ~1.5h sandbox)

회귀 audit 결과 (sandbox grep) — 8 caller try/catch 정합:

| Caller | line: sendEmail | line: try/catch wrapping |
|---|---|---|
| inventory/alerts/send/route.ts | 116 | 13 try / 144 catch (외부) ✓ |
| orders/[id]/send-email/route.ts | 148 | 106 inner try / 141 catch ✓ |
| quotes/[id]/route.ts | (line 86 .catch wrap) | 37/238 outer try / 227/320 catch ✓ |
| quotes/[id]/vendor-requests/route.ts | 318 | 314 inner try / 328 catch (emailError) ✓ |
| request/[id]/approve/route.ts | 360 | 346 inner try / 366 catch (emailErr) ✓ |
| request/[id]/reject/route.ts | 148 | 133 inner try / 154 catch (emailErr) ✓ |
| vendor/quotes/[quoteId]/response/route.ts | 110 | 99 inner try / 116 catch (emailError) ✓ |
| work-queue/.../request-approval/route.ts | 248 | 237 inner try / 254 catch (emailErr) ✓ |

⇒ **8 caller 전부 try/catch 정합** — §11.314 Phase 2 silent success → throw 패턴 변경 영향 0.

§11.314 Phase 2 전체 3 phase 합산 effect:
- Phase 0 Truth: sender.ts (~100 lines mock) + 8 caller 식별 + Resend SDK 이미 설치 확인
- Phase 1 RED: 12 it sentinel
- Phase 2 GREEN: sender.ts 재작성 (Resend production 분기 + lazy init + throw error + attachments)
- Phase 3 회귀 0: caller 8 try/catch 정합 audit + .env.example SendGrid 제거 + PLAN closeout

호영님 production effect (Phase 3 단독):
- production 변화 0 (sentinel + .env.example placeholder + PLAN 갱신)
- .env.example 정리 → 호영님 onboarding 시 옛 SendGrid 혼동 0
- 8 caller 영향 0 확정 (audit evidence)

Out of Scope:
- 다음 트랙 (§11.318-CORRECTION / §11.317-c lib/ai @ts-nocheck / 신규 spec)
- 발송 큐 (BullMQ/Inngest) — 동기 발송 유지
- retry 정책 별도 batch (Resend SDK 내장 retry 사용)

검증:
- .env.example SENDGRID 잔존 0 ✓ (RESEND_API_KEY/EMAIL_FROM 보존)
- 8 caller try/catch 정합 grep evidence ✓
- PLAN file Status Complete ✓

Rollback path: git revert <SHA>
- .env.example 옛 SENDGRID 주석 복원
- PLAN Status 복원

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/.env.example `
  docs/plans/PLAN_11.314-phase2-smtp-real-sender.md `
  docs/commit-drafts/COMMIT_11.314-phase3-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.314-phase3-closeout.md
git push origin main
```

## Production smoke
- N/A (.env.example + PLAN closeout only, production 변화 0)
- 호영님 §11.314 Phase 2 production smoke = Resend dashboard 도메인 verification + Vercel env 설정 후 진행

## Next (호영님 push 회신 + Resend env 설정 후)

§11.314 Phase 2 완전 종결. 다음 트랙 (호영님 결정):
- §11.318-CORRECTION 환각 억제 batch (spec 상세 필요)
- §11.317-c lib/ai @ts-nocheck (tracker #63 통합 가능)
- 또는 호영님 신규 spec / production smoke 이슈
