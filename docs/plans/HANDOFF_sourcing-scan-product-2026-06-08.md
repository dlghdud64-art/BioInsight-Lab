# Handoff Index — 소싱·스캔·제품 surface 세션 (2026-06-08)

- **Status:** 📋 핸드오프 인덱스. 모바일 스크린샷 리뷰 기반 **결정만**, 코드 작업 0건.
- **분리:** sandbox(스크린샷 진단, 레포 없음) ↔ cowork(레포 `C:\Users\young\ai-biocompare`). 이 파일은 결정·지시 전용, 구현은 cowork.
- **읽는 법:** §1 = 바로 실행 가능(잠김), §2 = 실행 전 코드 확인 필요, §3 = 이 세션 밖 큐, §4 = 관통 원칙.

---

## 0. 실행 순서 요약

| 순위 | 항목 | 절 |
| :-- | :-- | :-- |
| **P0 (최상위)** | **카탈로그 정합 — searchProducts=로컬 db.product(≈286), "500만+" 허위광고. 모든 것의 토대** | **§1-cat** |
| **P1 블로커** | **라벨 추출 엔진 — 도메인 미스 + datamatrix 부재 (라벨·BOM·재고등록 공통 선행)** | **§1-0** |
| P1 | 카탈로그 vendor 데이터 교차검증 (웰호 오기) | §1-2 ① |
| P1 | 헤더 뒤로가기 겹침 / 가짜 surface 제거 | §1-2 ②③, §1-3 |
| P1 | 스캔 intent 모델 (소싱 카메라 재정의) | §1-1 |
| P2 | 퀵뷰 스펙 확장 / 전체 상세 정리 / ~~compare 라우트~~ | §1-2 ④⑤ (⑥ done-by-retire §11.381c 2026-06-10) |
| P3 | 라벨·원칙 정리 | §1-2 ⑦, §4 |

> 데이터(§1-2①)와 라이브 결함(뒤로가기·가짜 surface)이 최우선. UI 충실화·정리는 그다음.

---

## 1. 잠긴 결정 (실행 가능)

### 1-cat. 카탈로그 정합 — P0 (최상위, 모든 것의 토대)
**코드 확정 (2026-06-08 cowork TR):** `searchProducts`(src/lib/api/products.ts)는 **로컬 `db.product`만** 조회(외부 5M 소스 0, Prisma 없으면 sample fallback). 실제 검색 집합 = import-catno-master "**검증 실거래 286 Product / 68 Vendor**" + seed ~31. **"500만+ 품목"은 5개 surface의 무근거 광고 = 웰호보다 큰 canonical(표시) 위반**(단발 오기 아니라 사업 클레임 허위표시). 상대가 규제 산업 전문 구매자라 신뢰·표시광고 리스크 실재. ⚖️ 표시광고 법적 검토는 변호사 영역 — 사실관계상 286을 500만+로 광고는 즉시 정정 대상.

라벨추출·BOM·검색·비교가 전부 이 ~286 위에 얹힘. **진짜 병목 = AI 아니라 카탈로그(canonical)의 폭 + 정합.** (PoC §5b "커버리지 75%"는 매핑 대상이 맞았으므로 유효 — 오히려 더 심각.)

**전략 (호영님 확정): 혼합 — B 즉시 + A 로드맵.**
- **B (즉시 필수):** "500만+" → 정성 표현(숫자 제거) 5 surface 정정. ✅ 완료(아래 실행 로그). 라이브 허위 클레임 제거.
- **A (대형 로드맵, 별 트랙):** 외부 공급사 카탈로그 실연동 — 데이터 파트너/API 라이선싱 + 수집·dedup + 286 품질관리(웰호류)를 스케일로. 광고가 진실이 되는 길. 별도 트랙 분리.

**실행 순서:** ① B(완료) → ② datamatrix 디코드(재고 등록용, 폭 무관 — 아래) → ③ A 로드맵 → ④ 추출 매칭 고도화·BOM 킬러(폭 A 확보 후, 그 전엔 286 천장).

### 1-0. 라벨 추출 엔진 — P1 블로커 (라벨·BOM·재고등록 공통 선행)
근본원인: **제네릭/소비자제품 도메인 미스 + GS1 datamatrix 미사용.** 영양제(한글·표준 레이아웃·"제품명/유효기간" 또렷) = 성공, 시약 라벨(영문 + Cat/Lot + 2D datamatrix + EXP 다양 포맷 + 기술용어) = 저신뢰 → (blank 로직 때문에) 공란. LabAxis는 시약·소모품인데 소비자 라벨 기준으로 검증된 셈.

**코드 확인 (2026-06-08 cowork TR):**
- ✅ **datamatrix/GS1 디코드 부재 확정** — zxing/quagga/gtin 라이브러리 0. 시약 라벨엔 2D datamatrix가 거의 항상 있고 GTIN·Lot·Expiry를 결정적 인코딩 → OCR보다 신뢰도 ↑. **최고 레버.**
- ✅ **필드 스키마 갭** — `lib/ocr/label-parser.ts` `LabelParseResult` = {catalogNo, lotNo, expirationDate, brand, productName, casNumber}. **규격/용량·보관온도 누락.**
- ⚠️ 정정: 엔진은 "영양제 튜닝"이 아니라 **reagent-named**(fallback `parseReagentLabel` + BRAND_PATTERNS이 Sigma/Gibco/NEB/QIAGEN/Takara 등 시약 전용). 실패 원인 = Gemini 프롬프트 도메인 강도(미확인) + datamatrix 부재 + 스키마 갭 복합.
- ✅ **code-confirm 닫음:** `gemini-label-parser.ts` `PARSE_PROMPT` = "reagent label parser" 명시(영양제 아님 재확인). 단 **얇음** — 필드 5개(productName/catalogNo/lotNo/expirationDate/casNumber), **규격·용량·보관온도·제조사 없음, few-shot 없음, EXP는 YYYY-MM-DD 단일 가정**(시약 EXP 다양성 미대응), datamatrix 없음. → 실패 = 도메인 튜닝이 아니라 **라벨 포맷**(작은 기술인쇄 OCR 약함 + 신뢰 데이터가 datamatrix 인코딩). datamatrix가 결정적 레버 = 코드로 확정.
- ⚠️ **datamatrix 천장 정정:** "효과 상한 286"은 **카탈로그 매칭**(라벨검색→제품, BOM 추천)에만 해당. **재고 직접등록**의 datamatrix는 내 재고의 Cat/Lot/EXP 캡처라 **카탈로그 폭 무관 — 지금 가치**. → datamatrix는 재고등록용으로 즉시 진행 가능(286 안 묶임), 추출의 *매칭* 가치만 A 대기.

**지시 (레버리지순):**
1. **GS1 datamatrix 디코드 = 1차 경로** 추가(비전 OCR 보조). 재고 QR 바코드 디코드 역량과 공유. 결정적 인코딩이라 신뢰도 최고.
2. **추출 프롬프트·스키마 시약 도메인 재타게팅** — 필드 명시(제품명 영문 reagent / Cat. No / Lot No / EXP 다양 포맷 / 규격·용량 / 제조사 / 보관온도) + 시약 라벨 few-shot. 스키마에 규격·보관온도 추가.
3. **blank-on-low-confidence → 초안 채움 + 경고**로 전환. ⚠️ §11.378/§11.375 게이트(저신뢰+미보정 차단)와 충돌 주의 — "공란"이 아니라 "저신뢰 초안 + 신뢰 표시 + 검수 강제"로 정합(fake success 금지 유지).
4. 라벨 검색·직접등록·BOM이 **공통 엔진**이면 한 번에 적용 → 셋 다 같이 살아남.

핵심: **엔진 골격은 멀쩡(reagent-named), 도메인만 맞추면 라벨 검색·재고 등록·BOM 추출이 동반 회복.** 제네릭 추출이 lab을 못 버틴다는 교훈은 BOM에도 동일(§5b 카탈로그 커버리지 갭과 별개의 추출측 근본).

### 1-1. §11.37x 스캔 intent 모델
- 스캔 = **조회 read-only 기본.** 차감은 스캔 후 **명시 확인** 단계로만 — 자동 차감 금지(canonical truth 보호).
- **스마트 입고 = 재고/입고 surface로 이전.** 소싱 카메라에서 하드와이어 제거.
- **소싱 카메라 = 라벨 스캔 검색 + QR 재고 확인**으로 재정의.
- 스캔 resolve 후 surface 맥락 기반 액션 분기(확인/차감/주문). 활성 §11.374~380 스캔 트랙과 통합.

### 1-2. 소싱/제품 surface 배치 (§11.35x)
1. **[P1·선행] vendor 데이터 교차검증.** "웰호" = 오기 (정답 ㈜웰진/Welgene, LM001=Welgene 제품군). 한 제품에 vendor 2개 모순 + 한글 표기 깨짐(웰진→웰호). 샘플 점검 → 오염 범위 파악 → 소스 재매핑 or 일괄 정정. **카탈로그가 신뢰 토대라 UI보다 먼저.**
2. **[P1] 헤더 뒤로가기 겹침.** floating 원형 `<`가 breadcrumb·`^`와 겹침. back affordance 하나로 통합(중복이면 floating 제거), `pt-safe`+z-index 정리, breadcrumb·title 같은 flow, x-axis 시작점 정렬.
3. **[P1] 가짜 추천 제거.** 연관 추천 "유사도 0% + 유사합니다" 제거(실 유사도 연결 or 숨김).
4. **[P2] 퀵뷰 시트 스펙 확장.** 보관온도·주의사항·구성·용량/규격을 카탈로그 필드 매핑(대부분 존재 확인). 미채움은 "미등록" empty. 전체 상세는 "더 보기" 보조.
5. **[P2] 전체 상세 정리.** 자사 A~E 그레이드 출처 trace 후 **제품 surface에서만 제거**(§2); 제목·본문 색 대비 상향; max-md 레이아웃(패딩·폭·line-clamp·터치타겟 h-10+).
6. **[P2] /app/compare.** 비교 결과 뷰가 소싱에 흡수돼 있는지 확인(§2) 후 **중복 라우트·"비교 목록" 진입점 제거.** (비교 자체는 소싱 dock = 비교 후보→비교 검토로 확정, 유지.)
7. **[P3] 라벨.** "AI 추천순" → "추천순"(정렬 로직 유지). "비교 적합" 배지 의미·연결 확인.

### 1-3. 소싱 AI surface — 조숙 분석 금지 + 단계 게이트
- **비교 검토:** 가격·납기 보유 후보 **≥2건일 때만** "AI 비교 분석" 활성. 미만이면 **스펙 비교 표**(제조사·규격/용량·배송기간·분류·안전정보 유무) + **"견적 요청 만들기" primary**. "AI 비교 분석 리포트" 라벨은 분석 가능 상태에서만.
- **검색 결과 "AI 분석"** 버튼·패널 제거 → 행 inline blocker chip(납기 미확인·견적 필요·안전정보 없음) + 차단 시 상단 우선 배너 1개. 라벨 폐기, 검색결과 한정(비교 분석 아님).
- human-in-loop caveat("분석은 추천 근거, 담당자 확인") **유지**.

---

## 2. cowork code-confirm 대기 (실행 전 코드 확인)
- 자사 A~E 그레이드 출처: product 직속 값 vs inventory join (제거 방식 가름).
- "AI 분석" 실제 로직: 단순 룰(null 체크)이면 행 chip 이전 / 스코어링이면 정렬·배지 흡수.
- "AI로 생성"(사용 용도) persist 여부: front-only면 fake → 동일 처리.
- /app/compare: 비교 결과 뷰가 소싱에 흡수돼 있는지(흡수 안 됐으면 삭제 대신 소싱 흡수).
- 비교 데이터 모델: 스펙 필드(규격/용량/배송기간) 채워지나(pre-quote 스펙 비교 가능 여부).
- 소싱 카메라가 SmartReceivingScannerModal 직접 여는지 / QR 재고조회 경로 별도 존재 여부.

---

## 3. 별도 트랙 (이 세션 밖, 큐)
- **§11.352 발주 인계** (이미 별도 지시문): backend model(발주요청 패키지 entity + "외부 발주됨" 수동 마킹), export 산출물(건별 발주요청서 — PDF/CSV/링크), 레일 CTA = "발주 인계/패키지 생성". + **§11.350 Phase 0**(MOCKUP_* 실/목 read)로 닫기. vitest = 완료 확인.
- **BOM (프로토콜→품목)**: 시약·조성 중심 문서는 PoC 바로(유료 티어 OK, 학습-비사용). 전체 실험 프로토콜은 **연구자 인터뷰 게이트**(파일: `BACKLOG_protocol-bom-researcher-interview.md`). 추천 = 카탈로그 매핑(deterministic), AI 주관 권유 금지. 미완 진입점은 라이브 숨김 + 백로그.
- **차감 확인 UX**: 불출 수량·lot 선택 (§11.37x 잠근 뒤 이어서).

---

## 4. 관통 원칙
- **ontology/AI = inline 신호(배너·행 chip·정렬)·단계 게이트로만.** 별도 AI 버튼/패널 신설 금지.
- **dead button / no-op / fake success / 조숙 분석 금지.** 데이터 없는데 분석 패널 띄우지 말 것.
- **canonical truth(카탈로그 데이터) 신뢰 우선.** 데이터 오염 위에 UI 정리해도 무의미 — 특히 바이오 구매자는 vendor를 다 안다.
- **same-canvas, page-per-feature 회귀 금지.** 시작한 작업을 그 화면에서 끝낼 것.

---

## 1-4. 소싱 AI surface — 단계 게이트 (확정, cowork 적재)
원칙: **조숙 분석 금지 + 단계 게이트.**
1. **비교 = 2단계.** pre-quote = 스펙 비교(제조사·규격/용량·배송기간·분류·안전정보 유무, 견적 전 후보 좁히기). post-quote = 가격·납기 분석. "AI 비교 분석"은 **가격·납기 보유 후보 ≥2건일 때만** enabled. 미만이면 스펙 비교 표 + **"견적 요청 만들기" primary**(disabled+이유 "견적 2건+ 필요"). "AI 비교 분석 리포트" 라벨은 분석 가능 상태에서만.
2. **검색 결과 "AI 분석" 버튼·패널 제거** → 행 inline blocker chip(납기 미확인·견적 필요·안전정보 없음) + 차단 시 상단 우선 배너 1개. 라벨 폐기, 검색결과 한정.
3. **human-in-loop caveat 유지**("분석은 추천 근거, 최종은 담당자 확인" 노란 배너).
4. ontology/AI = inline 신호·단계 게이트로만. 데이터 없는데 분석 패널 금지.
- **확인필요(code-confirm):** 비교 데이터 모델에 스펙 필드(규격/용량/배송기간) 채워지나 → 채워지면 pre-quote 스펙 비교 즉시 가능.

---

## 실행 로그 (2026-06-08 cowork 세션)
- ✅ **P0 카탈로그 정합 — B(광고 정정) 완료**: 허위 "500만+ 품목" 클레임 5 surface 제거(ops-flow-section / search/page ×1 [+1 동일카피] / dashboard/page / support-center/page / command-palette) → 정성 표현(숫자 0). 허위 강제하던 `search-page-252e.test` 반전(500만 not-match). P0 회귀 가드 `catalog-claim-honesty-p0.test` 신규(5 surface 500만 0). 잔존 0 확인. **A(외부 카탈로그 실연동)는 별도 로드맵 트랙.** searchProducts=로컬 db.product(≈286) 확정 = canonical 병목.
- ✅ **P1 BOM PoC(매핑 반쪽)**: catno-master 286 대상 더미 시약 12종 매칭 9/12=75%(어순 token-set 보강 시 83%, 미스 2건=카탈로그 커버리지 갭). deterministic 골격 건전. 추출 반쪽(Gemini)은 유료키 필요(미실행). `BACKLOG_protocol-bom-...md` §5b 기록.
- ✅ **§1-0 라벨엔진 root 확정**: gemini-label-parser PARSE_PROMPT reagent-named이나 얇음(5필드·few-shot 0·datamatrix 0). datamatrix가 결정적 레버(재고등록용은 폭 무관 즉시 가치).
- ✅ **P1 §1-2③ 가짜 추천 FIX 완료**: code-confirm 닫으니 근본원인이 메모보다 깊음 — `/api/recommendations/personalized` 기본 경로(`generatePersonalizedRecommendations`) score = **카테고리·브랜드 검색 빈도 카운트(0,1,2…)**, 0~1 유사도 아님. UI `×100 %` → 매칭 0 "유사도 0%", 1건 "유사도 100%", 다건 "유사도 200%+" + reason 폴백 "유사한 제품입니다" = fake-metric 모순(§4 위반). (협업·구매패턴·컨텍스트 경로만 진짜 0~1 score.) 라이브 확인 `/products/[id]`. **Fix(호영님 (b) "유사도 배지 미표시"):** `personalized-recommendations.tsx` — "유사도 N%" 배지 + TrendingUp 제거, CardDescription 유사도 카피 정정, score는 정렬용으로만 유지. explainability는 "추천 근거" reason 박스 + "구매 패턴 기반" source 배지가 담당. 신규 가드 `recommendation-similarity-honesty.test.ts`(금지 4 / 보존 2). vitest는 sandbox rollup-native 불일치로 미실행 → 정규식 직접 검증 PASS. **클로드코드 tsc/build·push 대기.**
- ✅ **GS1 datamatrix 재고등록(P1, datamatrix 천장)**: 파서(`apps/mobile/lib/scan/gs1-parser.ts`, 17/17) + scan.tsx 배선(A안, 15/15) — `PLAN_gs1-datamatrix-receive.md`. 미푸시.
- ✅ **P1① vendor 정정**: `catno-master-prepared.json` "웰호" 3곳 제거(제품 2 `vendors:[]` + 거래처 마스터 1). 제조사 영문 Welgene 유지. (호영님 결정: 영문사 영문 유지, 웰호 삭제.) **DB 반영(import 재실행 or UPDATE)은 통제구조상 "진행" 대기.**
- ✅ **P1 가짜/중복 진입점 정리**: `search/page.tsx` 품목등록(→/protocol/bom, 라벨불일치+BOM숨김)·비교목록(→/app/compare, workbench 흡수 중복) 카드 제거(재고확인 유지). `help/page.tsx` 프로토콜분석(BOM) 링크 제거. **BOM·compare 라우트/페이지는 보존(삭제 금지) — 라이브 진입점만 차단.**
- ⏳ **남음**: /app/compare 라우트 파일 자체 정리(git rm, inbound 링크 재확인 후) / "품목 등록" 올바른 목적지(카탈로그 수기 등록) 결정 / 소싱 상단 "검색 / 프로토콜 업로드" 병렬 진입 재설계(BOM PoC 후).
- ⚠️ **툴링 주의**: sandbox bash 마운트가 파일툴 쓰기 후 트레일링 널바이트를 **아티팩트로 표시**(실파일 C:\ 무손상, Read 툴로 확인). git diff가 일부 파일을 "binary"로 볼 수 있음 → **무결성 최종 판정은 클로드코드 tsc/build**.

## 실행 로그 (2026-06-08 cowork 세션 — 2차)
- ✅ **§1-2② 헤더 뒤로가기 겹침 FIX(미커밋)**: TR — `/products/[id]/page.tsx` 모바일 back affordance 2개 충돌(floating 원형 `<` `fixed top-16 left-4 z-50 rounded-full` + breadcrumb, container `pt-14`로 같은 상단대 시작). root layout 전역 헤더 없음 + `viewportFit:cover` 확정 → floating의 top-16은 헤더 아닌 임의 오프셋. **Fix(호영님 lock ⓑ): floating 제거**(breadcrumb이 회귀 경로 담당), container `pt-14`→`pt-[calc(env(safe-area-inset-top)+1rem)]`(노치 안전, 모바일 최상단). breadcrumb·데스크톱 "검색 결과 목록" 보존, ChevronLeft는 데스크톱 back 1회 유지(dead import 아님). 가드 `product-detail-back-affordance.test.ts`(금지 2/적용 1/보존 2) 정규식 PASS. **클로드코드 커밋·push + vitest 실행 대기.**
- 🔎 **#2 §1-3 / §1-2⑦ — planner-grade 확정(supersede 발견)**: §1-3가 제거하려는 "AI 분석" 트리거 버튼+시트를 **§11.265c 가드(265c.test)가 canonical lock으로 강제 중** — `setAiAnalysisSheetOpen`·`data-testid=sourcing-ai-analysis-trigger`·라벨 "AI 분석"·aria "AI 분석 열기"·`sourcing-ai-analysis-sheet`. 즉 #2 = §11.265c 폐기 + 테스트 3건(265c·268b·258b) supersede + inline blocker chip 신규(`sourcing-result-row.tsx`) + 상단 우선 배너 + compare 2단계 게이트(`_workbench/compare/page.tsx`, ≥2 견적 시만 "AI 비교 분석"). §1-2⑦("AI 추천순"→"추천순" `search/page.tsx:897`, "비교 적합" 배지 `sourcing-result-row.tsx:138`)도 동일 toolbar·동일 테스트라 #2에 흡수(단독 시 265c/268b 이중수정). → **feature-planner 트랙 권고**(잠긴 스펙 supersede + 테스트 thrash + 게이트 로직 + rollback).

## 실행 노트 (cowork)
- §1-2① vendor 교차검증 완료(웰호 삭제). DB 반영은 "진행" 후.
- §2 code-confirm 6건은 해당 P1/P2 착수 시 선행.
- §11.375 OCR 게이트 push 반영(Vercel) 확인 대기 중.
