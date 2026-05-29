fix(ocr): §11.315-a #gemini-model-config — preview-04-17 폐기 → env-aware GA 모델 + 404 fallback + raw JSON 노출 차단 (호영님 P0 즉시, 2026-05-28)

호영님 P0 — 스마트 입고/거래명세서 파싱 503/404 차단.

근본 원인:
- 3개 caller(gemini-label-parser / gemini-quote-parser / api/ai/bom-parse)가 모두
  `gemini-2.5-flash-preview-04-17` 를 **하드코딩**.
- 이 preview 모델은 정식 GA 후 폐기되어 `generateContent` 호출 시 404 NOT_FOUND.
- 추가 문제: /api/quotes/parse-image 의 catch 가 `error?.message` 를 그대로
  응답 body 에 반환 → 사용자에게 raw Gemini JSON({"error":{"code":404,...}}) 노출
  (호영님 스크린샷 IMG_5699/5700).

Fix (Part A — P0 즉시):

- apps/web/src/lib/ocr/gemini-config.ts (NEW):
  · `GEMINI_PRIMARY_MODEL` = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
  · `GEMINI_FALLBACK_MODEL` = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite"
  · `callGeminiWithFallback<T>(invoke)` — PRIMARY 시도 → 404/NOT_FOUND 면 FALLBACK 으로 1회 재시도,
    그 외 에러는 원본 throw. server-side console.warn 만 raw 보존.
  · `friendlyGeminiErrorMessage(context)` — quote/label/bom 컨텍스트별 한국어 친화 메시지
    (raw JSON 차단용 helper).

- apps/web/src/lib/ocr/gemini-label-parser.ts:
  · `model: "gemini-2.5-flash-preview-04-17"` 제거.
  · `generateContent` 호출을 callGeminiWithFallback 으로 래핑.

- apps/web/src/lib/ocr/gemini-quote-parser.ts:
  · `const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17"` 상수 제거.
  · `generateContent` 호출을 callGeminiWithFallback 으로 래핑.

- apps/web/src/app/api/ai/bom-parse/route.ts:
  · `model: "gemini-2.5-flash-preview-04-17"` 제거 → callGeminiWithFallback 래핑.

- apps/web/src/app/api/quotes/parse-image/route.ts:
  · catch 에서 `error?.message` 직접 반환 → `friendlyGeminiErrorMessage("quote")` 경유.
  · raw error 는 `console.error` 서버 로그에만 보존. 응답 body 는 친화 메시지만.

- apps/web/src/__tests__/regression/
  gemini-model-config-315a.test.ts (NEW, ~10 it):
  · PRIMARY/FALLBACK preview 아님 가드
  · callGeminiWithFallback 성공/404 재시도/non-404 throw 경로 동작 검증
  · friendlyGeminiErrorMessage context 별 한국어 + raw 패턴 0
  · 3 caller preview-04-17 잔존 0 + model 하드코딩 0 + fallback 헬퍼 사용
  · parse-image raw 노출 패턴 제거 + friendly 경유 / scan-label 친화 메시지 회귀 가드

검증 (sandbox 정적):
- preview-04-17 application-wide grep: 0 (gemini-config 주석만 잔존, intentional 설명)
- 3 caller 모두 `callGeminiWithFallback` import 1 + 사용 1
- parse-image catch friendlyGeminiErrorMessage 경유 + raw error 서버 로그만
- scan-label 친화 메시지 보존 (기존 양호)
- bom-parse catch 도 기존 friendly("BOM 파싱 중 오류가 발생했습니다.") — 추가 변경 0
- 기존 test 중 old 모델 ID 단언 0 (회귀 위험 0)

호영님 production effect:
1. 스마트 입고/거래명세서 스캔 → 정상 Gemini 호출 (gemini-2.5-flash GA).
2. 만약 GA 모델 일시 장애 → fallback gemini-2.5-flash-lite 자동 재시도.
3. 사용자에게 raw JSON 절대 노출 0 — "이미지 분석에 실패했습니다. 다시 시도하거나 직접 입력해 주세요." 만 표시.
4. 향후 폐기 시 GEMINI_MODEL 환경변수만 교체하면 코드 수정 없이 대응.

⚠️ Vercel 환경변수 권장 (선택):
- `GEMINI_MODEL` = `gemini-2.5-flash` (기본값과 동일, 명시적 설정 권장)
- `GEMINI_FALLBACK_MODEL` = `gemini-2.5-flash-lite` (기본값과 동일)
- 미설정 시 기본값으로 자동 동작 — 즉시 hotfix 효과 보장.

Out of Scope (⚠️ 본 batch 미포함 — §11.315-b 후속 batch 권장):
- Part B/C 입구 정리·명칭 분리. 조사 결과:
  · 재고 관리 "스마트 입고 (AI 스캔)" = `LabelScannerModal` (reagent 라벨 OCR → 재고 직접 등록)
  · 대시보드 헤더 "스마트 입고" = `SmartReceivingScannerModal` (거래명세서 → PO 매칭 → 입고)
  · → 진짜 다른 용도. spec Part C 의 "명칭 분리"(스마트 입고 vs 스마트 재고 등록) 방향이 정합.
  · §11.310 입고 1-flow Step 1 통합 vs 명칭만 분리 → 호영님 final 방향 확정 필요. §11.315-b 에서 처리.

⚠️ 번호 안내:
- 호영님 spec 의 "§11.312" 는 이미 task #76 (소싱 sticky bar UX, 완료/push 됨)이 사용 중이라
  본 batch 는 §11.315 로 매핑. 이의 있으시면 commit 전 알려주세요.

Rollback path: git revert <SHA>
- 컴포넌트/sentinel/config 모두 단일 commit, revert 1회로 복원.
- env 변수는 unset 시 기본값으로 동작 → 별도 조치 불필요.

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/lib/ocr/gemini-config.ts `
  apps/web/src/lib/ocr/gemini-label-parser.ts `
  apps/web/src/lib/ocr/gemini-quote-parser.ts `
  apps/web/src/app/api/ai/bom-parse/route.ts `
  apps/web/src/app/api/quotes/parse-image/route.ts `
  apps/web/src/__tests__/regression/gemini-model-config-315a.test.ts `
  docs/commit-drafts/COMMIT_11.315-a-gemini-model-config.md
git status
git commit -F docs/commit-drafts/COMMIT_11.315-a-gemini-model-config.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. (선택) Vercel 환경변수에 `GEMINI_MODEL=gemini-2.5-flash` 설정 + 재배포
3. /dashboard → 헤더 [스마트 입고] 클릭 → 거래명세서 이미지 업로드 → 정상 파싱
4. /dashboard/inventory → "스마트 입고 (AI 스캔)" → 라벨 이미지 업로드 → 정상 파싱
5. 의도적으로 잘못된 모델로 강제 실패 시(or 환경변수 wrong) → 사용자에게 친화 메시지만 표시되는지 (raw JSON 노출 0)
