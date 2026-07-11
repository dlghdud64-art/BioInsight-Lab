# §label-scan-extraction — 추출 엔진 실패 분해 (1단계: 진단)

- **Status:** 🔍 1단계 sandbox 완료 (바코드 미촬영 확인 → 후보 D 제거, A/C 유력) — operator 배포 후 골든 3종 실행 → 로그 회신 대기. **수정 없음(가정 기반 수정 금지, 실체 먼저).**
- **Date:** 2026-07-10
- **Trigger:** 선명 라벨 3종(Sigma E5134·gibco PBS·Difco LB Broth) 연속 저신뢰. 특히 Difco REF 244620·LOT 1348628·EXP 2026-10-31 = 라벨서 가장 또렷한데 저신뢰.

## 파이프라인 매핑 (실코드)
`scan-label/route.ts` POST → `runOcrPipeline`(Tier1 Gemini **항상 실행** → confidence high & catalogNo 있으면 종료, else Tier2 Cloud Vision+Claude 설정 시, else Gemini fallback) → `mergeGs1WithOcr`(GS1 DataMatrix = lot/exp 결정적 우선, catalogNo=OCR only) → DB 매칭 → 클라이언트.
- Gemini 미설정 시 `parseWithGemini` **throw** → route가 catch → text 있으면 regex fallback(`parseReagentLabel`), 없으면 422/503. (populated-low 아님.)

## 실체 (코드 확인 — 단정 가능한 것)
1. **confidence = 필드 *개수*** (`gemini-label-parser` L164): `matchedFields>=4?high:>=2?medium:low`. 6필드(catalogNo·lotNo·expiry·brand·productName·cas) 카운트. **판독 정확도·legibility 아님.**
2. **GS1-blind confidence:** confidence는 Gemini OCR 카운트만 반영. GS1 DataMatrix로 검증된 결정적 lot/exp(checksum, 100% 신뢰)는 confidence에 미반영 → **GS1-검증 필드가 있어도 low 표기 가능**(오도).
3. **스키마 갭(호영님 #3):** Gemini 파서 반환·matchedFields에 **packSize/packUnit 없음**(quantity만). → `normalizePackUnit`(방금 land)이 받을 단위 문자열을 추출이 안 내보냄 → 단위 자동선택 미완결 확정.
4. **기존 로깅 사각지대:** 0필드·JSON파싱실패만 로깅 → "선명한데 matchedFields 1~3(low/medium)" · providerUsed · GS1 병합 소스는 **미로깅**.

## 실패 후보 (로그로 판별 — 단정 보류)

**호영님 확인(2026-07-10): Difco 스캔 시 바코드 미촬영 → GS1 없음.** ∴ **후보 D(GS1-blind) 제거.** GS1 없으면 lot/exp/catalogNo 전부 Gemini OCR 의존 → 선명 라벨 저신뢰 = Gemini가 실제 미판독. 남은 유력 = **A(provider 미동작) / C(Gemini 구조화 실패)**. B(개수 semantics)는 Gemini가 읽은 경우만 성립 → 후순위.
- **A. provider/env:** Gemini 미설정→regex fallback(약함). providerUsed 로그로 확인.
- **B. confidence=개수 semantics:** 정확히 읽어도 필드 수 적으면 low. matchedFields 로그로 확인.
- **C. Gemini 구조화 실패:** 읽고도 JSON 매핑 못 함(레이아웃 미스). rawText+필드별 null 로그로 확인.
- **D. GS1-blind badge(유력):** 폼은 GS1로 채워지고(정확) confidence만 Gemini OCR 카운트라 low. mergedSources 로그로 확인.

## 1단계 계측 (sandbox 완료 — 동작 변경 0, 로그만)
- `scan-label/route.ts` merge 직후 `console.info("[OCR-DIAG] scan-label", {providerUsed, fallbackReason, cached, geminiMatchedFields, geminiConfidence, gs1Present, mergedSources, fieldsPresent})`.
- `gemini-label-parser.ts` 부분추출(1~3필드) `console.warn("[OCR-DIAG] 부분 추출 N/6", 필드별 null map, rawText 앞400)`.
- 골든 fixture `lib/ocr/__tests__/golden-labels.fixture.ts` — 3종 정답 고정(확인분만, 미상=null+라벨확인 표기, GMP 날조 금지).

## operator 게이트 (진단 배포)
```
git add apps/web/src/app/api/inventory/scan-label/route.ts \
        apps/web/src/lib/ocr/gemini-label-parser.ts \
        apps/web/src/lib/ocr/__tests__/golden-labels.fixture.ts \
        docs/plans/PLAN_label-scan-extraction.md
cd apps/web && npm run build && npx vitest run   # baseline-delta 0(로그만 추가)
# 커밋 → push
```

## 다음 (호영님 보고 대기)
배포 후 **골든 3종 스캔 → 서버 로그에서 `[OCR-DIAG]` 회신.** 그 로그로 A/B/C/D 확정 →
- D면: confidence를 GS1-검증 반영으로 재정의(개수 탈피).
- B면: confidence semantics = legibility/정확도 기반 재설계.
- C면: Gemini 프롬프트/파싱 보강.
- A면: env/provider 설정.
- 스키마 갭(공통): 추출에 packSize/packUnit 필드 추가(단위 자동선택 완결).
→ 방향 합의 후 fix phase.

## Out of Scope (1단계)
threshold/prompt/schema **수정 없음**. 골든 fixture 정답의 미상 필드 확정(라벨 재확인)도 fix phase.
