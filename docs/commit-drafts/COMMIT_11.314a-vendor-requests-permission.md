# §11.314-a Commit Message Draft (견적 전송 403 권한 fix)

```
fix(quotes): §11.314-a #vendor-requests-permission-fix — 견적 전송 action quote_request_resend → isReminder 분기 (첫 발송 quote_request_submit, requester 허용) — "견적 요청 실패" 403 해소 (호영님 §11.308 확인요청 옵션 A, 2026-05-27)

🚨 P1 — 견적 전송 기능 차단 (연구원 계정 "견적 요청 실패").

호영님 §11.308 확인요청 → 회신 A (API 있음 — 에러):
- Q1: 전송 API 있음 (POST /api/quotes/[id]/vendor-requests, §11.228b 구현)
- Q2: 방식 A(이메일) 설계됨, 단 sender 는 mock (실제 발송 0, §11.314-b 별도)
- Q3: §11.302d 무관 (이전 batch)

root cause (코드 확정):
vendor-requests route 가 action 'quote_request_resend' 하드코딩.
server-authorization-guard 권한 정의:
  quote_request_submit: ['requester', 'buyer', 'ops_admin']  ← 연구원 포함
  quote_request_resend: ['buyer', 'ops_admin']               ← 연구원 제외
→ 견적 첫 발송인데도 resend(재발송) action 적용 → RESEARCHER(→requester)
  계정은 권한 없어 enforcement.deny() → 403 → 클라이언트 "견적 요청
  전송에 실패했습니다".

fix (호영님 옵션 A):
첫 발송 = quote_request_submit (requester/연구원 허용),
리마인더(isReminder=true) = quote_request_resend (재발송 거버넌스 유지).

Fix (1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts:
  · body parse + validation 을 enforceAction 앞으로 이동
    (isReminder 추출 후 action 결정 위해)
  · enforceAction action:
    'quote_request_resend' (하드코딩)
    → isReminder ? 'quote_request_resend' : 'quote_request_submit'
  · §11.314-a 주석 (root cause + 옵션 A 근거)
  · enforceAction lock (complete/fail) / deny / checkQuoteAccess /
    vendor email 검증 / sendEmail / SENT 전환 모두 보존

- apps/web/src/__tests__/regression/
  vendor-requests-permission-fix-314a.test.ts (NEW, ~11 it):
  · action isReminder 분기 + resend 하드코딩 0 + body parse 순서 — 3 it
  · 회귀 0 8 it (lock complete/fail / deny / checkQuoteAccess 3-source /
    email 도메인 검증 / schema / sendEmail+SENT / §11.228b cooldown)

canonical truth 보존 (회귀 0):
- checkQuoteAccess 3-source priority (owner/org member/guestKey)
- enforceAction lock complete()/fail() (§11.305 와 달리 정상 해제 — lock 버그 0)
- vendor email 도메인 검증 (INVALID_TLDS + bare IP)
- §11.228b isReminder 24h cooldown
- sendEmail + successCount > 0 시 quote status SENT 전환
- 리마인더 재발송 거버넌스 (buyer/ops_admin) 유지

호영님 production effect:
1. labaxis.co.kr 견적 관리 → 최종 확인 후 전송:
   - 연구원(requester) 계정도 견적 첫 발송 가능 (403 → 200/201)
   - "견적 요청 실패" 해소 → "견적 요청 전달 완료" toast
   - quote status PENDING → SENT 전환
2. 리마인더 재발송은 여전히 buyer/ops_admin (거버넌스 유지)
3. ⚠️ 단 실제 이메일은 아직 sender mock — 공급사 실제 수신 0.
   §11.314-b (PDF+mailto, 호영님 옵션 C) 에서 실제 전송 구현 예정.

§11.314 시리즈:
- §11.314-a ✅ 본 batch (권한 403 fix — 전송 흐름 동작)
- §11.314-b (PDF 생성 + mailto, 호영님 옵션 C, 5~7h) — 후속
  · 견적요청서 PDF 템플릿 + POST /api/quotes/[id]/generate-pdf
  · 전송 버튼 → PDF 다운로드 + mailto (공급사 이메일 pre-fill)
  · 에러 메시지 개선

Out of Scope (§11.314-b):
- 실제 이메일 발송 (sender mock → PDF+mailto)
- 견적요청서 PDF 템플릿
- 전송 버튼 라벨 변경

Rollback path: git revert <SHA>
- 1 file action 분기 복원 + 1 sentinel 삭제
- 회귀: requester 견적 전송 403 재발 ("견적 요청 실패")
- ⚠️ revert 비권장 — P1 기능 차단 재발
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts `
  apps/web/src/__tests__/regression/vendor-requests-permission-fix-314a.test.ts `
  docs/commit-drafts/COMMIT_11.314a-vendor-requests-permission.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.314a-vendor-requests-permission.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 견적 관리 (연구원/RESEARCHER 계정):
   - 견적 작성 → 최종 확인 후 전송 → 403 없이 진행 (이전 "견적 요청 실패" 해소)
   - "견적 요청 전달 완료" toast + quote status SENT
3. 리마인더 재발송 (isReminder=true) — buyer/ops_admin 만 (거버넌스 유지 확인)
4. ⚠️ 실제 이메일 수신은 §11.314-b 까지 mock (공급사 메일 0) — 정상
```
