fix(quotes): §11.314-c #quote-status-sent-on-pdf — 견적서 PDF 생성(발송) 시 status PENDING/PARSED → SENT 전환 (호영님 §11.308b 완료기준 #4 누락 보완, 2026-05-27)

점검 발견 (호영님 "빠진 것 점검" 요청):
호영님 §11.308b 완료기준 #4 "견적 상태 draft → sent 전환" 이 §11.314-b
PDF 다운로드 흐름에서 누락. 견적 발송(PDF 다운로드) 후에도 status
PENDING("대기 중") 으로 남아 견적 관리에서 "발송됨" 미표시 → 사용자 혼란.

설계 결정:
- status 전환 = generate-pdf route(서버)에서 PDF 생성 성공 직후.
  PDF 생성 = 견적 요청서 발행 = 발송 행위 (vendor-requests 의 successCount
  > 0 시 SENT 전환과 동일 패턴 정합).
- POST(발송) 일 때만 전환. GET (mobile read-only download) 은 0
  (request.method 구분 — GET handler 가 POST 호출해도 method="GET").
- quotes/[id]/status route(PATCH) 미사용 — quote_status_change 가
  buyer/approver/ops_admin 전용이라 requester(연구원) 403 (§11.314-a 와
  동일 문제). generate-pdf 는 ownership 검증만 (enforceAction 0) →
  requester 발송 허용 정합.
- best-effort (status 전환 실패해도 PDF 응답 영향 0).

Fix (1 file 수정 + sentinel 보강):

- apps/web/src/app/api/quotes/[id]/generate-pdf/route.ts:
  · PDF 생성 + audit log 사이에 status 전환 블록 추가:
    - request.method === "POST" && status in (PENDING, PARSED) →
      db.quote.update({ status: "SENT", updatedAt }) (best-effort .catch)
    - statusTransitioned flag
  · audit metadata 에 statusTransitioned + previousStatus 기록

- apps/web/src/__tests__/regression/quote-generate-pdf-314b.test.ts:
  · §11.314-c describe 4 it 추가 (POST 분기 / SENT update / audit
    metadata / enforceAction 미사용)

canonical truth 보존 (회귀 0):
- GET (mobile read-only download) status 전환 0 (idempotent read 유지)
- 이미 SENT/RESPONDED/COMPLETED 등은 전환 0 (PENDING/PARSED 만)
- PDF 생성 / ownership / audit / stream 로직 변경 0
- §11.314-a vendor-requests SENT 전환 (이메일 flow) 변경 0
- ALLOWED_STATUS_TRANSITIONS (PENDING→SENT, PARSED→SENT) 정합

호영님 production effect:
1. labaxis.co.kr 견적 관리 → "견적서 PDF 다운로드" (POST):
   - PDF 다운로드 + status PENDING/PARSED → SENT 전환
   - 견적 목록에서 "발송됨" 표시 → 발송 후 대기 표시 혼란 해소
2. 모바일 PDF 재다운로드 (GET) — status 변경 0 (이미 SENT 유지)
3. 호영님 §11.308b 완료기준 #4 충족

§11.314 시리즈 완전 종결:
- §11.314-a ✅ 견적 전송 403 권한 fix
- §11.314-b ✅ PDF generator + route + 전송 버튼 wiring
- §11.314-c ✅ 본 batch (status PENDING/PARSED → SENT 전환)
→ §11.308 확인요청 완료기준 5/5 충족 (PDF 템플릿 / 생성 API / 전송 버튼
   PDF+mailto / status 전환 / 에러 메시지 개선)

Rollback path: git revert <SHA>
- 1 file status 전환 블록 복원 + sentinel describe 삭제
- 회귀: 발송 후에도 status PENDING (발송됨 미표시)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/quotes/[id]/generate-pdf/route.ts `
  apps/web/src/__tests__/regression/quote-generate-pdf-314b.test.ts `
  docs/commit-drafts/COMMIT_11.314c-quote-status-sent.md

git status   # modified: 2 + untracked: 1
git commit -F docs/commit-drafts/COMMIT_11.314c-quote-status-sent.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 견적 관리 (PENDING 견적):
   - "견적서 PDF 다운로드" 클릭 → PDF 다운로드 + status SENT 전환
   - 견적 목록 새로고침 → "발송됨" 표시 (이전 "대기 중" 0)
3. 모바일 PDF 재다운로드 (GET) → status 유지 (재전환 0)
4. 이미 SENT/COMPLETED 견적 → PDF 다운로드 시 status 변경 0
