# COMMIT — §11.348-SEND-A: 견적 요청 발송 reply-to(연구소 명의) (production 2파일)

```
feat(email) §11.348-SEND-A #quote-send-replyto — vendor-requests 발송에 reply-to=요청자(연구소) 추가 (공급사 답장 연구소로, A 명의)
```

## 배경 (코드 확인 기반)
- §11.348-SEND-A 자동발송은 이미 BUILT(batch-dispatch-sheet→vendor-requests→Resend). **유일 갭 = reply-to**: `EmailOptions`에 replyTo 없음 → from=noreply@labaxis 발송 + reply-to 미설정 → 공급사 답장이 연구소로 안 감(유실) = A 원칙("책임·관계 연구소") 위반.

## Fix (production 2파일 + sentinel)
- `lib/email/sender.ts`: `EmailOptions.replyTo?: string` 추가 + `resend.emails.send`에 `...(options.replyTo ? { replyTo: options.replyTo } : {})` 조건부 전달. (Resend SDK 필드 = `replyTo` camelCase, context7 확인)
- `api/quotes/[id]/vendor-requests/route.ts`: sendEmail 호출에 `replyTo: session?.user?.email ?? undefined` (요청자=연구소 명의). 미설정 시 noreply 유지(기존동작).
- 신규 `__tests__/regression/quote-send-replyto-348a.test.ts`: sentinel(5).

## 검증 (vitest)
- quote-send-replyto-348a + 314b 회귀 → **22/22 passed**. esbuild OK. python 패치(truncation 회피).

## ⚠️ 외부발송 동작 변경 — push 전 필수
1. **코드 검토**(외부 메일 동작 변경).
2. **env 확인**: `RESEND_API_KEY`·`EMAIL_FROM` 프로덕션 설정.
3. **`npm run test`** 로 sentinel green 재확인.
- pilot 보호(isVendorPilot)·dev mode 콘솔·from fallback 보존 → 미설정/테스트벤더는 실발송 0(안전).

## Canonical truth / 원칙
- A 명의: LabAxis=도구, 발송 책임·답장은 연구소. replyTo 미설정 시 기존 noreply 동작(회귀 0).

## Out of Scope
- §11.348-A 회신 루프 본체(token response→입고안→승인), 공급사 온보딩(B). EMAIL_FROM 자체를 연구소 도메인으로 바꾸는 건 별건(reply-to로 A 충족).

## Rollback
- EmailOptions.replyTo + send 전달 + route replyTo 3곳 revert. 독립.
