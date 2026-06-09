# SCOPING — Catalog Public Ingest Phase 0 데스크 unblock (쿼리 스펙 + 커버리지 카운트)

> **Last Updated:** 2026-06-09
> **목적:** `PLAN_catalog-public-ingest.md` Phase 0의 데스크 사전작업 — 분류번호 확정 + cowork용 커버리지 카운트 쿼리 스펙. **코드 변경 0(planning-only).**
> **작성:** 샌드박스 데스크(웹 리서치). 실제 카운트는 호영님 API 키 발급 후 cowork/콘솔 실행.

---

## 1. 확정 사실 (웹 리서치 검증)

- **조달청 물품분류번호 = UNSPSC v9.4 기준.** 4단계 계층(대분류 Segment · 중분류 Family · 소분류 Class · 세분류 Commodity), 각 2자리 = **8자리**. 품명이 UNSPSC Commodity와 일치하면 UNSPSC 8자리 그대로, 불일치 시 조달청 신규번호 생성.
- **세부물품분류번호 = 8자리 + 2자리 = 10자리.**
- **물품식별번호(prdct_id_no)** = 제조사+모델 고유 → PLAN의 dedup PK.
- **실증 예:** 다중가스검출기 = `41113118` → Segment **41**, Family **4111**, Class **411131**, Commodity `...18`. 세그먼트 41이 실험·측정·시험장비에 대응함을 확인.
- **데이터 소스(무료, 공공데이터법 개방):**
  - 증분/조회 OpenAPI: **15129417**(조달청 물품목록정보서비스).
  - 벌크 seed: **15050862**(상품정보시스템 등록 물품 내역, fileData CSV 일괄).
  - 참고 미러: gimi9.com / 15058890(목록정보서비스 동족).

---

## 2. 타겟 분류 세그먼트 (시약·실험)

PLAN 대상 = 시약 + 실험·측정·시험장비. UNSPSC v9.4 기준 2개 세그먼트:

| 세그먼트 | UNSPSC 정의 | LabAxis 대상 |
| :-- | :-- | :-- |
| **12** | Chemicals including Bio Chemicals and Gas Materials | 시약·화학물질·표준품 |
| **41** | Laboratory and Measuring and Observing and Testing Equipment | 실험·측정·시험장비·실험소모품 |

**세부 Family/Class 후보(console-confirm 필요 — 정확 코드는 UNSPSC lookup 또는 조달청 분류조회로 확정):**
- 12 하위: 화합물·혼합물(1216 류), 시약·표준품 family.
- 41 하위: 실험·과학장비(4110 류), 측정·관찰·시험(4111 — 41113118 실증), 실험소모품·비품(4112/4115 류), 임상·실험 시약/표준품(4116 류).

⚠️ **세부 8자리 코드 목록은 본 데스크에서 확정 불가(날조 금지).** Phase 0 GREEN에서 (a) UNSPSC v9.4 공식 분류표 또는 (b) data.go.kr 분류조회 operation으로 12·41 하위 시약·실험 관련 Family/Class 화이트리스트를 확정.

---

## 3-pre. operation 확정 (2026-06-10, 활용신청 상세기능정보 캡처)
Endpoint base: `https://apis.data.go.kr/1230000/ao/ThngListInfoService`. 일일 트래픽 operation당 1000.

| operation | 용도 |
| :-- | :-- |
| `getPrdctClsfcNoUnit2Info` | 물품분류 2단위(대분류 Segment). 조건 없으면 2단위 전체. → 12·41 확인 |
| `getPrdctClsfcNoUnit4Info` | 물품분류 4단위(중분류 Family) |
| `getThngGuidanceMapInfo` | 물품안내지도 — 상위 분류번호로 하위 조회(upPrdctClsfcNo, root=최상위). 분류 트리 재귀 |
| `getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch` | 품목 목록. 검색조건=세부품목번호/물품식별번호/품명(1개+ 필수). 반환=물품분류번호·물품식별번호·세부품명·품명·영문품명·삭제/사용여부·조달업체등록번호·**제조업체명** 등 |
| `getThngPrdnmLocplcAccotListInfoInfoPrdnmSearch` | 품명 목록 |
| `getThngPrdnmLocplcAccotListInfoInfoLocplcSearch` | 소재지 목록 |
| `getThngListClChangeHistInfo` / `getLsfgdNdPrdlstChghstInfoSttus` | 분류·품목 변경이력(증분 refresh 후보) |

**커버리지 카운트 경로:** ① Unit2 → 12·41 Segment 확인 → ② Unit4 → 12·41 하위 시약·실험 Family 화이트리스트 → ③ 품목 목록 조회로 품목수·제조사 분포·식별번호 존재율.
**미확정(미리보기 [확인]으로 닫을 것):** 필수 파라미터(inqryDiv 등), totalCount 필드 위치, 품목 목록의 분류 필터 가능 여부(품명 검색 후 물품분류번호 클라 필터 필요할 수 있음).

## 3. 커버리지 카운트 쿼리 스펙 (SKELETON — 미리보기로 파라미터 확정)

**목표:** PLAN Phase 0 go/no-go 수치 = (1) 시약·실험 품목 총수, (2) 제조사 분포, (3) 물품식별번호 존재율.

⚠️ operation명·파라미터명은 data.go.kr 콘솔(키 발급 후 Swagger/활용가이드)에서 **반드시 실명 확인** 후 대입. 아래는 조달청 OpenAPI 공통 관례 기반 placeholder.

```
GET https://apis.data.go.kr/1230000/{서비스경로}/{operation}
  ?serviceKey={발급키, URL-encoded}
  &pageNo=1
  &numOfRows=1            # 카운트만 필요하면 1행 + totalCount 헤더 활용
  &type=json
  &{분류파라미터}={물품분류번호 8자리 or 세그먼트 prefix}   # ← console-confirm
```

**확인해야 할 항목(콘솔 Swagger에서):**
- [ ] 정확한 서비스 경로 + operation명 (물품분류 조회 / 물품식별번호별 품명 조회 / 목록 조회 중 카운트 가능한 것)
- [ ] 분류 필터 파라미터명 (예상: `prdctClsfcNo` / `dtilPrdctClsfcNo` — **실명 확인**)
- [ ] 세그먼트 단위 prefix 검색 지원 여부(12·41 대역 일괄) vs 8자리 exact만 → 후자면 화이트리스트 코드별 N회 호출
- [ ] 응답의 `totalCount` 필드 위치(카운트 추출)
- [ ] rate limit / 일일 트래픽(배치 설계 영향)

**카운트 절차(키 발급 후):**
1. 12·41 세그먼트(또는 §2 화이트리스트 Family/Class)별 `numOfRows=1` 호출 → `totalCount` 합산 = **시약·실험 품목 총수**.
2. 표본 N페이지(예: numOfRows=1000 × 수 페이지) fetch → `mfrt_nm` 분포(제조사 수·상위 집중도) + `prdct_id_no` null/존재율 계산 = **식별번호 존재율**(dedup backbone 적용 가능 비율).
3. 수치를 PLAN §11 Progress + Phase 0 Quality Gate(go/no-go·사이징)에 기록.

**go/no-go 기준(PLAN 정합):** backbone 가치는 tail(전문 시약 희박)과 무관하게 식별번호 존재 품목에서 성립. 카운트는 사이징·우선순위만 좌우(설계 불변).

---

## 4. cowork/호영님 실행 체크리스트

- [ ] **호영님:** data.go.kr 회원가입 → 15129417 + 15050862 활용신청(무료, 자동승인 통상) → serviceKey 발급.
- [ ] **cowork(키 수령 후):** 콘솔 Swagger에서 §3 console-confirm 항목 실명 확정 → 12·41 화이트리스트 코드 확정(§2) → 커버리지 카운트 3종 실행 → PLAN Phase 0 GREEN 기록.
- [ ] **go 판정 시:** PLAN Phase 1(스키마 마이그레이션 + 계약 테스트) 진입.

---

## 4-b. 커버리지 카운트 결과 (2026-06-10, Chrome 직접 호출 실측)
endpoint `getPrdctClsfcNoUnit8Info`, 파라미터 `prdctClsfcNoBgnNo`/`prdctClsfcNoEndNo`/`type=json`. 응답 구조 `response.body.totalCount` + `items[].prdctClsfcNo/prdctClsfcNoNm/prdctClsfcNoEngNm`. resultCode "00" 정상 확인.

| 지표 | 값 |
| :-- | :-- |
| 화학·시약 8자리 분류 (Seg 12, 12000000~12999999) | **123** |
| 실험·측정·시험장비 8자리 분류 (Seg 41, 41000000~41999999) | **985** |
| 시약·실험 backbone 합 (8자리 commodity) | **1,108** |
| 현 LabAxis 카탈로그(canonical db.product) | 286 |
| 전체 세부품명(Unit10) | 23,586 (⚠️ Unit10은 범위필터 미적용 = 전체값. 12·41 분해는 Phase 1에서 8자리별 순회) |

**go/no-go: ✅ GO.** backbone 골격(1,108) > 현 카탈로그(286) ~4배. 8자리 분류 하위 세부품명·물품식별번호(실제 제품)는 그보다 훨씬 큼 → 286 천장이 무료 공공데이터로 해소 확정. **키 정상 작동**(Chrome same-origin fetch). 외부 직접호출은 발급 직후 일시 Unauthorized였으나 전파 후 정상.

**Phase 1 진입 전 남은 1건:** 제품(물품식별번호) **실수** = `getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch` 파라미터 확정(미리보기) 후 측정. backbone GO는 이미 성립이라 Phase 1(스키마+계약) 병행 가능.

## 5. 미확정(console-confirm) 명시 — 추정 통과 금지
- operation명 / 분류 파라미터 실명 / 세그먼트 prefix 검색 지원 여부 / totalCount 필드 경로 / rate limit.
- 12·41 하위 시약·실험 Family/Class 8자리 화이트리스트.
- 정확 품목 수·제조사 분포·식별번호 존재율(= Phase 0 카운트 산출물).

---

## Sources
- [조달청_물품목록정보서비스(15129417) | 공공데이터포털](https://www.data.go.kr/data/15129417/openapi.do)
- [조달청_상품정보시스템 등록 물품 내역(15050862) | 공공데이터포털](https://www.data.go.kr/data/15050862/fileData.do)
- [물품분류번호 8자리 예시 — 다중가스검출기 41113118 (서울시 게시판)](https://seoulboard.seoul.go.kr/comm/getFile?bbsNo=163&fileNo=128081&fileTy=ATTACH&srvcId=BBSTY1&upperNo=7266)
