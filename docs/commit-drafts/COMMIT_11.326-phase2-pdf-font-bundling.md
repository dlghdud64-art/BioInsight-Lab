fix(pdf): §11.326 Phase 2 #pdf-font-bundling — Vercel outputFileTracingIncludes + Helvetica fallback 제거 + fontPath 다중 fallback (호영님 P0, 2026-05-30)

호영님 P0 §11.326 (호영님 spec §11.324 매핑) — PDF Helvetica.afm ENOENT root cause fix.

Phase 1 (이미 sandbox 완료, push 대기):
- vendor-dispatch-workbench 토스트 friendly + actionable
- preferences useMutation retry: 0 명시 + onError 로깅

Phase 2 root cause 확정 (호영님 console.error 로깅 evidence):
- DevTools: `POST /api/quotes/{id}/generate-pdf 500 + ENOENT '/var/task/apps/web/.next/server/chunks/data/Helvetica.afm'`
- ✅ Pretendard 폰트 `apps/web/public/fonts/PretendardVariable.ttf` 존재 (task #99 §11.314-d)
- ✅ generator try { register Pretendard } catch { Helvetica fallback }
- ❌ Vercel 함수 번들에 PretendardVariable.ttf 자동 포함 안 됨 (monorepo + Next.js outputFileTracingIncludes 누락)
- → fontPath 미존재 → silent Helvetica fallback → Vercel 에 Helvetica.afm 없음 → 500 ENOENT
- 호영님 spec 옵션 B 권장: 한글 폰트 강제 + Helvetica fallback 제거

Fix (Phase 2 — 3 file Edit):

- apps/web/next.config.js (line 11-22):
  · experimental.outputFileTracingIncludes 추가
  · `/api/quotes/[id]/generate-pdf`: ['./public/fonts/**/*']
  · `/api/orders/[id]/generate-pdf`: ['./public/fonts/**/*']
  · Vercel serverless 함수 번들에 PretendardVariable.ttf 강제 포함
  · serverComponentsExternalPackages (pdf-parse / pdfjs-dist) 정합 보존

- apps/web/src/lib/quotes/quote-request-pdf-generator.ts:
  · `import { existsSync } from "node:fs"` 추가
  · `resolvePretendardPath()` 헬퍼 신설:
    · 후보 3개: process.cwd()/public/fonts/ + process.cwd()/apps/web/public/fonts/ + __dirname relative
    · 차례로 existsSync 시도, 첫 hit 반환
    · 모두 미발견 시 명확한 throw (후보 경로 + Vercel + 로컬 가이드 메시지)
  · 옛 try { register } catch { Helvetica } 패턴 제거:
    · 신: resolvePretendardPath() throw → caller 가 catch → 토스트 표시 (Phase 1 actionable)
    · silent 한글 깨짐 차단 (Helvetica 의존 제거)

- apps/web/src/lib/orders/po-pdf-generator.ts:
  · 동일 패턴 적용 (quote 와 동일 import + resolvePretendardPath + Helvetica fallback 제거)
  · §11.326 cross-reference 명시

canonical 보존 (회귀 0):
- Pretendard 폰트 파일 자체 변경 0 (이미 존재)
- generator 함수 시그니처 변경 0 (caller 영향 0)
- PDFDocument options (A4, margin 48) 보존
- 견적 요청서 / 발주서 PDF 내용 / 레이아웃 변경 0
- Phase 1 mitigation (토스트 + retry) 동작 보존
- §11.314-b mailto + Quote status SENT 전환 보존
- next.config.js 기존 설정 (typescript / images / compiler / webpack) 영향 0

호영님 production effect:
1. Vercel 빌드 시 outputFileTracingIncludes 로 PretendardVariable.ttf 함수 번들에 강제 포함
2. resolvePretendardPath() 가 3 경로 차례 시도 → 모두 매칭 → registerFont 성공 → 한글 PDF 정상
3. 만약 여전히 fontPath 못 찾으면 throw → Phase 1 console.error 에 명확한 message (후보 경로 list) 노출 → 다음 디버깅 단서
4. 한글 깨짐 silent 회피 (옛 Helvetica fallback 제거) — 한글 견적서/발주서 보장
5. PO PDF (발주서) 도 동일 fix 적용 — quote PDF 와 함께 한글 출력 정상

Out of Scope:
- §11.327 (preferences 403 폭주) — Phase 1 mitigation 만, root cause 호영님 production info 회신 의존
- 폰트 파일 추가 (NotoSansKR 등) — Pretendard 이미 존재, 변경 0
- 폰트 라이선스 파일 (OFL.txt) 동봉 — Pretendard OFL 1.1 (호영님 권장 가이드)
- PDF 라이브러리 교체 (옵션 C) — pdfkit 유지, 호영님 옵션 B 정합

검증 (sandbox 정적):
- next.config.js outputFileTracingIncludes ✓
- 2 generator resolvePretendardPath() 헬퍼 + existsSync ✓
- 옛 try { register } catch { Helvetica } 패턴 잔존 0 ✓
- doc.font("Helvetica") 잔존 0 (2 generator) ✓

Rollback path: git revert <SHA>
- next.config.js outputFileTracingIncludes 제거
- 2 generator resolvePretendardPath + existsSync import + Helvetica fallback 제거 revert
- 옛 silent fallback 패턴 복원

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/next.config.js `
  apps/web/src/lib/quotes/quote-request-pdf-generator.ts `
  apps/web/src/lib/orders/po-pdf-generator.ts `
  docs/commit-drafts/COMMIT_11.326-phase2-pdf-font-bundling.md
git status
git commit -F docs/commit-drafts/COMMIT_11.326-phase2-pdf-font-bundling.md
git push origin main
```

## Production smoke (호영님 즉시 진행)

1. Vercel READY 확인 (outputFileTracingIncludes 변경 시 cold start 시간 약간 증가 가능)
2. 견적 발송 전 최종 확인 모달 → "견적서 PDF 다운로드" click
3. **성공 경로:**
   · PDF 다운로드 정상 (한글 "견적 요청서 (Quote Request)" 깨짐 없음)
   · 영문/숫자/특수문자 모두 정상
   · 토스트 "견적서 PDF 다운로드 완료" 노출
4. **실패 경로 (만약 여전히 fail):**
   · 토스트: "견적서 PDF를 만들 수 없습니다" + Phase 1 actionable 안내
   · DevTools console: `[§11.326] PDF 생성 실패 {status: 500, serverDetail: "[§11.326] Pretendard 폰트 미발견 — 후보: ..."}`
   · serverDetail 의 후보 경로 list 가 다음 디버깅 단서 (어느 경로도 매치 안 됐다는 evidence)
5. PO PDF (발주서) 도 동일 동작 확인 (별도 caller 경로)

## §11.327 (preferences 403 폭주) — 별도 진행
- Phase 1 (retry 명시 + onError 로깅) 이미 sandbox 완료
- root cause = middleware/CSRF 의심, 호영님 production info 회신 후 Phase 2

## Next (호영님 push 회신 후)
- Phase 3: 회귀 audit + sentinel 추가 + PLAN closeout
- §11.327 root cause 분기 (호영님 production info 의존)
