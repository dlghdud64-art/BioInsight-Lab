# Implementation Plan: GS1 datamatrix → 재고 등록 자동채움

- **Status:** 🔄 In Progress
- **Started:** 2026-06-08
- **Last Updated:** 2026-06-08

**CRITICAL:** phase 완료마다 ① 체크박스 ② quality gate(클로드코드 tsc/lint/vitest) ③ 전항목 통과 ④ Last Updated ⑤ Notes ⑥ 통과 후 다음. ⛔ gate 실패/소스충돌 진행 금지. dead button/no-op/fake success 금지.

---

## 0. Truth Reconciliation
- **Latest (코드 실측 2026-06-08):** `apps/mobile/app/scan.tsx` `useCodeScanner` codeTypes에 **`data-matrix` 이미 포함**(L226) → datamatrix 스캔은 됨. 단 `onCodeScanned`는 barcode 모드 QR 재고조회로만 라우팅, **GS1 파싱 0**. GS1 파서 부재(AI 01/10/17 파서 0).
- **재고 등록 폼:** lotNumber/expirationDate/catalogNumber 필드 존재(현재 OCR `r.parsed.*`로 채움).
- **⚠️ canonical nuance:** GS1 = GTIN(01)+Lot(10)+Expiry(17). 카탈로그는 `catalogNumber` 키, **GTIN 필드 없음** → GTIN으로 제품매칭 불가(= A 트랙). **Lot+Expiry는 카탈로그 무관 즉시 폼 채움**(재고등록 가치, 폭 무관).
- **Chosen SoT:** 현 코드. datamatrix payload = canonical 캡처원, OCR은 보조.
- **Env:** sandbox vitest 실행 불가(rollup native) → 순수파서는 plain node로 로직 검증, 정식 vitest/실기기 클로드코드·호영.

## 1. Priority Fit
- [x] P1 — 재고 등록 신뢰(작은 인쇄 OCR 대비 결정적 인코딩), 카탈로그 폭 무관 즉시 가치.

## 2. Work Type
- [x] Feature  [x] Mobile  ([ ] web 재고등록 동일 적용은 후속)

## 3. Overview
**Feature:** datamatrix payload를 GS1 표준 파싱 → 재고 등록 폼의 Lot·Expiry(+표시용 GTIN) 자동채움. OCR 보조로 강등.
**Success:**
- [ ] GS1 element string(FNC1·괄호 양식) → {gtin, lotNo, expirationDate(YYYY-MM-DD), serial} 정확 파싱.
- [ ] 재고등록(label/receive)에서 datamatrix 스캔 → Lot/Expiry 자동채움 + "스캔" source 배지.
- [ ] §11.378 dirty 게이트 정합(자동채움도 수정 가능, fake 0).
- [ ] 회귀 0(기존 barcode QR 재고조회·OCR 경로 보존).
**Out of Scope (⛔):**
- [ ] GTIN→제품 매칭(카탈로그 GTIN 필드 부재 = A 트랙). GTIN은 표시만.
- [ ] 웹 재고등록 적용(후속).
- [ ] 추출(OCR) 고도화(§1-0 별도).

## 4. Product Constraints
- Source of Truth: datamatrix GS1 payload(스캔 캡처). Derived: 폼 prefill. Persistence: 기존 재고등록 mutation 불변.
- Must not: fake success(파싱 실패 시 빈칸+OCR 보조, 가짜 생성 0), GTIN 매칭 사칭.
- UI Surface: 기존 scan 재고등록 폼 inline(신규 페이지 0).

## 5. Architecture
- `lib/scan/gs1-parser.ts` 순수 모듈(RN/DOM import 0 → vitest 단위). web 재사용 가능 위치 고려.
- 통합점: scan.tsx onCodeScanned(label/receive 분기) → parseGs1 → 폼 setState.

## 6. Test Strategy
- 파서 = 순수 단위(AI 01/10/17/21, FNC1 \x1d, 괄호양식, YYMMDD→날짜, DD=00 처리, 미지 AI graceful). sandbox=plain node 검증, 정식 vitest 클로드코드.
- 배선 = sentinel(readFileSync regex) + 실기기 smoke(호영).

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — [x] Done
- datamatrix 스캔 기존 확인, GS1 범위(01/10/11/15/17/21) 확정, GTIN매칭 제외 명시.

### Phase 1: GS1 파서 (pure) + 테스트 — [x] Done (2026-06-08)
- ✅ `lib/scan/gs1-parser.ts` 구현(AI 01/10/11/15/17/21, FNC1·고정/가변 길이, 괄호 HRI, YYMMDD→ISO, DD=00→YYYY-MM, 미지 AI graceful, 비GS1 isGs1=false).
- ✅ `gs1-parser-datamatrix.test.ts`(실 import 단위). sandbox node 포트 검증 17/17 GREEN(정식 vitest 클로드코드).
- ✋ Gate: 순수(외부 import 0) 확인. Rollback: 파일 삭제.

### Phase 2: 재고등록 배선 (A안) — [x] Done (2026-06-08)
- ✅ TR 정정: codeScanner는 barcode 모드 전용(frameProcessor와 배타) → A안 = barcode onCodeScanned에서 GS1 분기.
- ✅ scan.tsx: parseGs1 import + onCodeScanned GS1 분기(`intent !== "use_qr" && isGs1 && (lot|expiry)`) → Lot/유효기간 자동채움 + setGs1Gtin + label-review 분기. use_qr 차감은 기존 performLookup 유지.
- ✅ label-review GS1 정합: isGs1Capture 시 OCR 저신뢰 게이트 미적용(datamatrix=결정적), 헤더 "datamatrix 스캔 완료/Lot·유효기간 확정", GTIN 표시줄(매칭 아님). 제품명 필수 게이트는 보존.
- ✅ 잠재버그 수정: barcode 모드 raw GS1 → performLookup 실패 → GS1 분기로 해소.
- ✅ sentinel `gs1-receive-wiring.test`(배선 + 회귀: performLookup/frameProcessor/§11.378 보존). node 15/15 GREEN.
- ✋ Gate: frameProcessor 무변경, 가짜 0(제품명 필수), 회귀 0. Rollback: onCodeScanned GS1 분기 diff revert.

### Phase 3: Smoke/Rollback — [ ] Pending
- sentinel GREEN, 실기기 datamatrix QA(호영). Rollback: GS1 분기 제거 → OCR 경로.

## 8. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| GTIN≠catalogNumber 혼동 | Med | Med | 매칭 아닌 표시 한정, 폼은 Lot/Expiry만 |
| datamatrix 가변 포맷 | Med | Med | GS1 AI 표준(FNC1·고정/가변 길이표) 준수 |
| 실기기 미검증 | High | Low | 호영 실기기 QA, 파서는 단위로 선검증 |

## 9. Rollback
- P1 실패: 파서 삭제. P2 실패: onCodeScanned GS1 분기 revert → 기존 OCR. 스키마/서버 무변경.

## 10. Progress
- Phase: [x] P0 [ ] P1 [ ] P2 [ ] P3

## 11. Notes
- (착수) datamatrix 스캔 자체는 기존 enabled — GS1 파싱+배선만 신규.
