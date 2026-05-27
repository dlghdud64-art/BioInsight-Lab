# §11.314-b-1 Commit Message Draft (견적요청서 PDF generator + route — backend)

```
feat(quotes): §11.314-b-1 #quote-generate-pdf — 견적 요청서 PDF generator + GET/POST /api/quotes/[id]/generate-pdf (order PDF 인프라 재사용) (호영님 §11.308 옵션 C MVP, 2026-05-27)

호영님 §11.308 확인요청 → 옵션 C (PDF 생성 + mailto MVP):
견적 요청서를 PDF 로 생성 → 사용자가 다운로드 후 공급사에 메일 첨부
전송. 실제 SMTP 자동 발송(A)은 인프라 부담 커 Phase 2 후속.

§11.314-b-1 = backend (lib generator + API route).
§11.314-b-2 = client (전송 버튼 PDF 다운로드 + mailto + 에러 개선) 후속.

인프라 재사용 (scope 축소):
order PDF (lib/orders/po-pdf-generator + orders generate-pdf route +
pdfkit ^0.18.0) 패턴을 quote 로 복제. 신규 의존성 0.

Fix (2 file 신규 + 1 NEW sentinel):

- apps/web/src/lib/quotes/quote-request-pdf-generator.ts (NEW, ~180 line):
  · generateQuoteRequestPdf(input): Promise<Buffer>
  · pdfkit + Pretendard 한글 폰트 임베드 (미존재 시 Helvetica fallback)
  · 견적 요청서(Quote Request/RFQ) 레이아웃:
    - Header: 견적번호 + 발행일 + 회신기한(validUntil)
    - 요청 정보: 수신(vendor) + 요청자 + 제목
    - 요청 품목 표: 품목(name+brand+catalog) / 규격(spec+grade) / 수량 /
      견적가(빈 칸 — 공급사 회신 시 작성)
    - 요청 사유/비고: quote.description
    - 안내: "견적가 란에 단가 기재하여 회신" + LabAxis footer
  · canonical truth = Quote (DB). PDF = derived snapshot (Quote 변경 0)

- apps/web/src/app/api/quotes/[id]/generate-pdf/route.ts (NEW, ~155 line):
  · GET/POST 둘 다 (mobile expo-file-system downloadAsync GET 호환,
    orders 패턴 정합)
  · auth() + 3-source ownership (owner / org member / guestKey) —
    vendor-requests checkQuoteAccess 정합
  · QuoteItem.productId → db.product.findMany 조회 + productMap 매핑
    (품목명/브랜드/카탈로그/규격/grade)
  · generateQuoteRequestPdf → PDF Buffer
  · audit log graceful (SETTINGS_CHANGED + action quote_pdf_generate,
    catch 무시 — PDF 응답 영향 0)
  · PDF stream 반환 (application/pdf + Content-Disposition attachment,
    filename = quoteNumber 또는 quote-{id8})
  · quote not found 404 / Forbidden 403 분기

- apps/web/src/__tests__/regression/
  quote-generate-pdf-314b.test.ts (NEW, ~15 it):
  · generator 5 it (export / pdfkit+폰트 / 헤더+회신기한+품목표 /
    견적가 빈칸 / input shape)
  · route 6 it (GET/POST / auth+3-source ownership / product 조회 매핑 /
    PDF stream / audit graceful / 404)
  · 회귀 0 2 it (order PDF generator / route 변경 0)

canonical truth 보존 (회귀 0):
- order PDF (po-pdf-generator / orders generate-pdf) 변경 0
- Quote / QuoteItem / Product 모델 변경 0 (read-only PDF 생성)
- §11.314-a vendor-requests (이메일 mock) 변경 0 (별도 흐름)
- 기존 quote 전송 흐름 영향 0 (신규 endpoint 추가)

호영님 production effect:
1. POST/GET /api/quotes/[id]/generate-pdf → 견적 요청서 PDF 즉시 생성
2. PDF 내용: 품목/규격/수량 + 견적가 빈칸(공급사 작성) + 회신기한 + 요청사유
3. 단 본 batch 는 backend only — 클라이언트 버튼 wiring 은 §11.314-b-2
   · 현재는 API 직접 호출 시에만 PDF 생성 (UI 버튼 미연결)

§11.314 시리즈:
- §11.314-a ✅ 견적 전송 403 권한 fix (requester 허용)
- §11.314-b-1 ✅ 본 batch (PDF generator + route, backend)
- §11.314-b-2 (client: 전송 버튼 → PDF 다운로드 + mailto + 에러 개선) — 후속

Out of Scope (§11.314-b-2 / Phase 2):
- 클라이언트 전송 버튼 wiring (PDF 다운로드 + mailto)
- "견적 요청 실패" → "견적서 생성 실패" 에러 메시지 개선
- 실제 SMTP 자동 발송 (SendGrid/SES — Phase 2)
- Pretendard 폰트 file (host 에 public/fonts/PretendardVariable.ttf 필요 —
  미존재 시 Helvetica fallback, 한글 깨짐 위험. 별도 폰트 추가 mini-batch)

Rollback path: git revert <SHA>
- 2 file 신규 삭제 + 1 sentinel 삭제
- 사용자 영향: generate-pdf endpoint 제거 (UI 미연결이라 영향 0)
- order PDF / vendor-requests 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/lib/quotes/quote-request-pdf-generator.ts `
  apps/web/src/app/api/quotes/[id]/generate-pdf/route.ts `
  apps/web/src/__tests__/regression/quote-generate-pdf-314b.test.ts `
  docs/commit-drafts/COMMIT_11.314b-1-quote-generate-pdf.md

git status   # untracked: 4 (또는 modified 0 + untracked 4)
git commit -F docs/commit-drafts/COMMIT_11.314b-1-quote-generate-pdf.md
git push origin main
```

## Production smoke

1. Vercel READY 확인 (pdfkit 빌드 정상 — order PDF 와 동일 의존)
2. API 직접 호출 (브라우저 또는 호영님 계정):
   - GET /api/quotes/{quoteId}/generate-pdf → PDF 다운로드
   - 품목/규격/수량 + 견적가 빈칸 + 회신기한 표시 확인
   - 한글 표시 (Pretendard 폰트 — host 에 폰트 있으면 정상, 없으면 깨짐)
3. 권한: 본인/조직/guestKey quote 만 200, 그 외 403
4. §11.314-b-2 (UI 버튼 연결) 까지는 화면 버튼으로는 PDF 생성 미연결 (정상)
```
