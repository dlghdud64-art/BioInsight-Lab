fix(pdf): §11.326 Phase 4 #pdfkit-font-buffer — PDFDocument constructor 에 Pretendard Buffer 직접 주입 (호영님 가설 B-1 확정, 2026-05-30)

호영님 P0 §11.326 시나리오 3 → Phase 4 root cause B-1 확정 fix.

배경 (Vercel 결과 + 4 grep 분석):
- ✅ Phase 2 적용 확인 (commit 9abc1f07): outputFileTracingIncludes + resolvePretendardPath + Helvetica fallback 제거 모두 적용됨
- ❌ 그러나 호영님 production 재시도 시 여전히 동일 `ENOENT '/var/task/.../Helvetica.afm'` 발생
- 4 grep audit 결과:
  · 시나리오 A (다른 generator) 기각 — endpoint import 정합 (generateQuoteRequestPdf 단일)
  · 시나리오 C (Vercel cache) 기각 — Phase 2 trace marker 있음
  · 🚨 **시나리오 B-1 확정**: `new PDFDocument({ size, margin })` 만 호출, `font` option 누락
- PDFKit source 동작: `this.font(options.font || 'Helvetica')` — constructor 가 default font 'Helvetica' 즉시 auto-load → AFM 파일 없으면 ENOENT (registerFont 호출 전 발생)

호영님 가설 B-1 (70% 추정) **확정**.

Fix (Phase 4 — 2 file Edit + sentinel 갱신):

- apps/web/src/lib/quotes/quote-request-pdf-generator.ts:
  · `import { existsSync, readFileSync } from "node:fs"` (readFileSync 추가)
  · `const fontPath = resolvePretendardPath()` 후
  · `const fontBuffer = readFileSync(fontPath)` 추가
  · `new PDFDocument({ size: "A4", margin: 48 })` → `new PDFDocument({ size: "A4", margin: 48, font: fontBuffer })`
  · `doc.registerFont("Korean", fontPath)` → `doc.registerFont("Korean", fontBuffer)` (Buffer 호환)
  · `doc.font("Korean")` 보존 (alias 적용)

- apps/web/src/lib/orders/po-pdf-generator.ts:
  · 동일 패턴 적용 (PO 발주서 PDF 도 함께 fix)

- apps/web/src/__tests__/regression/pdf-font-bundling-326.test.ts:
  · Phase 3 sentinel 갱신 — 2 generator 모두 `font: fontBuffer` + readFileSync import + const fontBuffer 단언 추가
  · 옛 `registerFont("Korean", fontPath)` → `registerFont("Korean", fontBuffer)` 단언 swap

PDFKit constructor 동작:
- 옛: `new PDFDocument({ size, margin })` → constructor 가 `this.font('Helvetica')` 호출 → AFM file load → ENOENT
- 신: `new PDFDocument({ size, margin, font: fontBuffer })` → constructor 가 `this.font(fontBuffer)` 호출 → Buffer 직접 사용, Helvetica auto-load 차단

canonical 보존 (회귀 0):
- Pretendard 폰트 파일 자체 변경 0
- resolvePretendardPath() 헬퍼 보존 (Phase 2)
- next.config.js outputFileTracingIncludes 보존 (Phase 2)
- generator 함수 시그니처 변경 0 (caller 영향 0)
- PDFDocument options (A4, margin 48) 보존
- Korean alias (registerFont + font) 보존 — 다른 코드 경로 font 참조 호환
- §11.314-b mailto + Quote status SENT 보존
- Phase 1 mitigation 보존

호영님 production effect:
1. PDFKit constructor 가 Helvetica auto-load 안 함 → Helvetica.afm ENOENT 사라짐
2. fontBuffer 직접 주입 → Pretendard 즉시 활성 → 한글 PDF 정상
3. Korean alias 도 함께 등록 → 호환성 유지
4. PO PDF (발주서) 도 동일 fix 적용

PDFKit 0.18.0 source 참조:
- constructor 첫 라인: `this.font(options.font || 'Helvetica')`
- `font` 가 string 이면 path resolve, Buffer 이면 직접 등록
- `font: null` / `font: false` 는 falsy → 'Helvetica' fallback → 해결 안 됨 (Buffer 만 robust)

Out of Scope:
- §11.327 (preferences 403 폭주) — Phase 1 push 완료, Phase 2 호영님 4 info 회신 대기
- §11.328 (입고 데이터 모델) — SPEC sync 대기
- D-1 (폰트 lib/ 이동) — Phase 4 가 root cause 해결하면 불필요

검증 (sandbox 정적 grep):
- import readFileSync (2 generator) ✓
- const fontBuffer = readFileSync(fontPath) (2 generator) ✓
- new PDFDocument({..., font: fontBuffer}) (2 generator) ✓
- doc.registerFont("Korean", fontBuffer) (2 generator) ✓
- sentinel 4 it 갱신 (quote 2 + po 2) ✓

Rollback path: git revert <SHA>
- 2 generator 옛 패턴 복원 (constructor font option 제거, registerFont fontPath 사용)
- sentinel 4 it revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/lib/quotes/quote-request-pdf-generator.ts `
  apps/web/src/lib/orders/po-pdf-generator.ts `
  apps/web/src/__tests__/regression/pdf-font-bundling-326.test.ts `
  docs/commit-drafts/COMMIT_11.326-phase4-pdfkit-font-buffer.md
git status
git commit -F docs/commit-drafts/COMMIT_11.326-phase4-pdfkit-font-buffer.md
git push origin main
```

## Production smoke (호영님 즉시 진행)

1. Vercel READY 확인 (Phase 4 빌드)
2. 견적 발송 모달 → "견적서 PDF 다운로드" click
3. **성공 시:**
   · 한글 PDF 정상 다운로드 (Pretendard 적용)
   · console.error 0
   · 토스트 "견적서 PDF 다운로드 완료"
4. **실패 시 (만약 여전히):**
   · 새 console message 가 무엇인지 회신 (`[§11.326]` 또는 다른 에러)
   · `Pretendard 폰트 미발견 — 후보: ...` 면 D-1 (폰트 lib/ 이동) 진입
   · 다른 에러면 추가 audit
5. PO PDF (발주서) 도 정상 동작 확인

## Next (호영님 push 회신 후)
- 성공 시: Phase 3 closeout (이미 sandbox 작성) push + §11.326 batch 종결
- §11.327 Phase 2 root cause 분기 (호영님 4 info 회신 대기)
- §11.328 SPEC sync 후 진입
