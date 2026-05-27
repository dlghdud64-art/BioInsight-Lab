feat(quotes): §11.314-b-2 #vendor-dispatch-pdf-wiring — 견적 전송 버튼 vendor-requests(이메일 mock) → 견적서 PDF 다운로드 + mailto 교체 + 에러 메시지 개선 (호영님 §11.308 옵션 C/A, 2026-05-27)

호영님 §11.308 확인요청 → 옵션 C (PDF MVP) + 옵션 A (PDF 다운로드로 교체,
이메일 mock 숨김):
이메일 sender 가 mock (실제 발송 0) 이므로 dead-button/fake-success 회피
위해 "최종 확인 후 전송"(이메일) → "견적서 PDF 다운로드"(실제 동작) 교체.
실제 전송 = 사용자가 다운로드된 PDF 를 mailto(공급사 이메일 pre-fill)로 첨부.

§11.314-b-2 = client wiring (b-1 backend PDF generator + route 후속).

Fix (1 file 수정 + 1 NEW sentinel):

- apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx:
  · executeDispatch:
    - csrfFetch '/api/quotes/[id]/vendor-requests' (이메일 mock)
      → '/api/quotes/[id]/generate-pdf' (§11.314-b-1 PDF route)
    - PDF blob 다운로드 (createObjectURL + a.download '견적요청서-{id8}.pdf'
      + revokeObjectURL)
    - mailto — validVendors.email join + 제목/본문(message) pre-fill
      (window.location.href = mailto:...)
    - 성공 toast "견적서 PDF 다운로드 완료" + sentTracking "PDF 다운로드 완료"
    - 에러 메시지 개선: "견적 요청 전달 실패" → "견적서 생성 실패" +
      "견적서 생성에 실패했습니다. 다시 시도해 주세요."
  · 버튼 라벨:
    - aria-label "공급사에 전송" → "견적서 PDF 다운로드"
    - visible: "최종 확인 후 전송" → "견적서 PDF 다운로드",
      "전달 중…" → "견적서 생성 중…", "전송 추적 확인됨" → "PDF 다운로드 완료"
    - sendReadiness !== ready "전송 전 확인 필요" 보존

- apps/web/src/__tests__/regression/
  vendor-dispatch-pdf-wiring-314b2.test.ts (NEW, ~16 it):
  · executeDispatch PDF 교체 6 it (generate-pdf 호출 / vendor-requests 0 /
    blob 다운로드 / mailto / 성공 toast / 에러 메시지 개선)
  · 버튼 라벨 2 it (aria-label / visible)
  · 회귀 0 5 it (이메일 검증 / validVendors / sentTracking+localStorage /
    sendReadiness / setConfirmationOpen+onSuccess)

canonical truth 보존 (회귀 0):
- 공급사 선택 / 이메일 형식 검증 / includedSuppliers → validVendors
- sendReadiness 분기 (전송 전 확인 필요 — 미준비 시 안내)
- sentTracking + localStorage (다운로드 추적 증적)
- setConfirmationOpen / onSuccess wiring
- vendor-requests API (§11.314-a) 는 리마인더/다른 caller 용 보존 (executeDispatch 만 교체)
- §11.314-b-1 generate-pdf route / PDF generator 변경 0

호영님 production effect:
1. labaxis.co.kr 견적 관리 → 공급사 선택 → "견적서 PDF 다운로드" 버튼:
   - 견적 요청서 PDF 다운로드 + 메일앱 열림(mailto, 공급사 이메일 + 제목/본문)
   - "견적서 PDF 다운로드 완료" toast → 사용자가 PDF 첨부하여 전송
   - 이전 "견적 요청 실패" (이메일 mock 403/실패) 완전 해소
2. dead-button/fake-success 0 — 실제 다운로드 동작 + mailto
3. 공급사 LabAxis 가입 불필요 (PDF + 일반 메일)

§11.314 시리즈 종결:
- §11.314-a ✅ 견적 전송 403 권한 fix
- §11.314-b-1 ✅ PDF generator + route (backend)
- §11.314-b-2 ✅ 본 batch (전송 버튼 PDF 다운로드 + mailto, client)
→ §11.308 확인요청 → 옵션 C MVP 완성 (견적 전송 = PDF + mailto)

Out of Scope (Phase 2):
- SMTP 자동 발송 (SendGrid/SES) — sender mock → 실제 발송
- Pretendard 폰트 file (host public/fonts — 미존재 시 PDF 한글 깨짐)
- 견적 status PENDING → SENT 자동 전환 (현재 PDF 다운로드는 status 변경 0,
  필요 시 §11.314-c 에서 "발송 완료" 확인 버튼 + status 전환)

Rollback path: git revert <SHA>
- 1 file executeDispatch + 버튼 라벨 복원 + 1 sentinel 삭제
- 회귀: 견적 전송이 vendor-requests(이메일 mock) 로 복귀 → "견적 요청 실패" 재발

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx `
  apps/web/src/__tests__/regression/vendor-dispatch-pdf-wiring-314b2.test.ts `
  docs/commit-drafts/COMMIT_11.314b-2-vendor-dispatch-pdf-wiring.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.314b-2-vendor-dispatch-pdf-wiring.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 견적 관리 → 공급사 선택 → 최종 확인 모달:
   - 버튼 라벨 "견적서 PDF 다운로드"
   - 클릭 → PDF 다운로드 + 메일앱 열림 (공급사 이메일 + 제목 "견적 요청서")
   - "견적서 PDF 다운로드 완료" toast (이전 "견적 요청 실패" 0)
3. PDF 내용: 품목/규격/수량 + 견적가 빈칸 + 회신기한
4. 모바일: PDF 다운로드 + 공유 시트 (mailto)
5. 공급사 미선택 / 이메일 형식 오류 시 안내 (검증 보존)
