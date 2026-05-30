# Implementation Plan: §11.329 견적서/발주서 PDF 레이아웃 정정 (Pretendard swap 후)

- **Status:** ⏳ Pending (Phase 0 truth-lock 완료, Phase 1 RED 진입)
- **Started:** 2026-05-30 · **Last Updated:** 2026-05-30
- **Priority:** P0 (견적 전송 실사용 차단) · **Effort:** 3~5h · **모델:** Opus 4.7+
- **번호:** §11.329 (PDF 레이아웃). 입고 데이터 모델 §11.326과 별개 트랙. 코드 내 옛 "§11.326 Phase 4" 폰트 주석은 lineage 참고.

**CRITICAL**: phase 완료마다 체크박스/Last Updated/Notes. 큰 파일 아님(201/207줄)이나 Edit 툴 truncation 이력 → **Python 원자 치환 + 매 편집 후 brace/paren/eof 확인**. PDF 시각 렌더는 sandbox 불가 → 좌표 산식·코드 검증까지, 시각 확인은 호영님 env.

## 0. Truth Reconciliation
- `src/lib/quotes/quote-request-pdf-generator.ts`(201) + `src/lib/orders/po-pdf-generator.ts`(207). 거의 동일 패턴.
- 폰트: `new PDFDocument({ size:"A4", margin:48, font: fontBuffer })` + `registerFont("Korean") + font("Korean")`. **Pretendard 정상(Phase 2 보존 대상).**
- **root cause = 컬럼 좌표 하드코딩 + text() width/align 누락:**
  - quote `colX={name:48,spec:280,qty:420,price:480}`, po `colX={name:48,qty:280,unit:360,total:460}`.
  - A4 width 595 − margin 48×2 = **contentWidth 499**, 좌 48 ~ 우 547.
  - 헤더·수량·견적가·푸터에 width 없음 → 우측 흐름/잘림(A,E). 컬럼 좌측정렬 → 헤더/데이터 어긋남(B). price:480 width 없이 흐름 → 우측 잘림(A). 요청사유 width:497(48+497=545 한계 근접). 페이지 넘김 처리 **없음**(rowY 무한).
- canonical: PDF = Quote/Order(DB) derived projection. 레이아웃만 수정, 폰트·데이터 불변.

### Chosen Source of Truth
- contentLeft=48, contentRight=547, contentWidth=499.
- 컬럼 재배분: quote `품목230 / 규격110 / 수량50 / 견적가109`(합499, x: 48/278/388/438). po `품목230 / 수량70 / 단가99 / 합계100`(x: 48/278/348/447).
- 숫자/가격 align:"right", 라벨/품목 align:"left". 모든 text() width 명시.

## 1. Priority Fit — P0. §11.326과 별개 트랙 병행.

## 2. Work Type — Bugfix + Design Consistency(레이아웃). Web(server PDF).

## 3. Overview
**Success Criteria:**
- [ ] 모든 text() 호출 width 명시 (우측 잘림 0)
- [ ] 표 헤더/데이터 컬럼 정렬 일치 (숫자·가격 right-align)
- [ ] 컬럼 좌표 contentWidth(499) 안에서 재배분 (Pretendard 폭 기준)
- [ ] "요청 사유/비고" 표 아래 full-width 별도 섹션
- [ ] 푸터 center + width (우측 잘림 0)
- [ ] quote + po 동일 패턴
- [ ] 페이지 넘김: rowY가 본문 하한 초과 시 addPage + 헤더 재그리기
- [ ] Pretendard 폰트 적용(Phase 2) 보존

**Out of Scope:** 폰트 교체/추가, PDF 디자인 전면 개편, 새 필드 추가, mailto/SMTP 로직.

## 4. Product Constraints
- Preserve: canonical truth(PDF=derived), Pretendard 폰트, 기존 입력 인터페이스.
- Must not: 데이터 변형, 폰트 회귀, dead/placeholder, 좌표 하드코딩(상수화).
- Boundary: SoT=Quote/Order DB. PDF는 snapshot. 레이아웃 상수만 신규.

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| LAYOUT 상수(contentLeft/Width + 컬럼맵) 도입 | 하드코딩 제거, 정합 | 약간의 상수 블록 |
| 모든 text width+align 명시 | pdfkit 흐름 차단(잘림 0) | 호출당 옵션 증가 |
| 페이지 넘김 헬퍼(ensureSpace) | 다품목 안정 | 헤더 재그림 로직 |
| Python 원자 치환 | Edit truncation 회피 | — |

**Touched:** 두 generator 파일 + 신규 sentinel 테스트.

## 6. Test Strategy
- sentinel(readFileSync+regex): width 명시, align:"right", contentWidth 상수, 요청사유 full-width, 푸터 center, 페이지 넘김 가드.
- 시각 렌더는 호영님 env(1/10품목/긴 사유 다운로드). sandbox는 코드 무결성+산식.

## 7. Implementation Phases

### Phase 0: Truth/번호 lock — ✅ 완료
- [x] 번호 §11.329, root cause(컬럼 하드코딩+width 누락), contentWidth 499, 컬럼 재배분 확정.

### Phase 1: 레이아웃 sentinel (RED) — ✅ 완료
- Status: [x] Complete
- 🔴 RED: [x] `src/__tests__/regression/pdf-layout-329.test.ts` — LAYOUT 상수/align right/요청사유 contentWidth/푸터 center/페이지 넘김/폰트 보존. 현재 코드 RED 확정(contentWidth·ensureSpace 없음, width:497 존재).

### Phase 2: quote-request GREEN — ✅ 완료 (재적용)
- Status: [x] Complete (241줄, brace/paren/eof 무결, colX 제거, contentWidth 6, w497 0)
- 🟢 GREEN: [x] LAYOUT 상수(contentLeft/Right/Width 499 + COL 품목230·규격110·수량50·견적가109) + ensureSpace 헬퍼 + 헤더/데이터 width+align:right(수량·견적가) + 요청사유 full-width(contentWidth, 497 제거) + 안내/푸터 width+center + 페이지 넘김. 230줄, brace/paren/eof 무결, colX 제거, 폰트 보존.
- ✋ Gate: sentinel(quote) 전항목 PASS, 폰트·데이터 불변. 시각 = 호영님 env.

### Phase 3: po-pdf GREEN — ✅ 완료 (재적용)
- Status: [x] Complete (235줄, 무결, colX 제거, 총액 right-align + ensureSpace). sentinel 11항목 ALL_PASS.
- 🟢 GREEN: [x] 동일 패턴(COL 품목230·수량70·단가99·합계100) + 헤더/데이터 right-align + 총합계 contentWidth right + 푸터 center + ensureSpace. 227줄 무결.
- ✋ Gate: sentinel(po) PASS.

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
- smoke 정의(1/10품목/긴 사유/페이지 넘김) — 호영님 env 다운로드 시각 확인. COMMIT draft + closeout.

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| sandbox PDF 시각 불가 | High | Med | 좌표 산식+코드 검증, 호영님 env 시각 확인 필수 |
| Pretendard 폭 추정 부정확 | Med | Med | 보수적 컬럼폭, 호영님 다운로드 후 조정 |
| 페이지 넘김 헤더/푸터 재계산 누락 | Med | Med | ensureSpace 헬퍼 단일화 |
| 두 파일 패턴 불일치 | Low | Med | 동일 LAYOUT 상수 구조 |
| 폰트 회귀 | Low | High | 폰트 블록 불변, sentinel 보존 검증 |

## 10. Rollback — 1: sentinel revert / 2: quote 파일 revert(HEAD) / 3: po 파일 revert / 4: feature 그대로(레이아웃만 영향).

## 11. Progress
- Overall: ~85% (Phase 0/1/2/3 완료, P4 smoke + 호영님 시각 검증/푸시 남음)
- Current: Phase 4 — 호영님 env 다운로드 시각 확인(1/10품목/긴사유) + 커밋·푸시.
- Blocker: 없음. PDF 시각 렌더는 sandbox 불가 → 호영님 env 필수.
- [2026-05-30] quote(230)/po(227) GREEN, sentinel 전항목 PASS, Python 원자 치환(truncation 0).

**확정(2026-05-30):** §11.329 / contentWidth 499 / quote(230·110·50·109)·po(230·70·99·100) / right-align 숫자·가격 / quote+po 동시 / 페이지 넘김 포함.

**Checklist:** [x] P0 / [x] P1(RED) / [x] P2(quote) / [x] P3(po) / [ ] P4(smoke, 호영님 env 시각)

## 12. Notes
- [2026-05-30] 코드 주석의 "§11.326 Phase 4"는 폰트 작업 lineage. 입고 §11.326과 번호 분리(§11.329).
- pdfkit: text(t,x,y) width 미지정 시 페이지 우측 끝까지 흐름 → 잘림 root cause.
