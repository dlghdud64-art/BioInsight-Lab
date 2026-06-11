# PLAN — #catalog-spec-backfill: 견적 회신 파싱 + supplier 입력 spec 충전 (§번호 호영님 배정)

- **Status:** ✅ A0~A3 구현 완료 (2026-06-11) — 클로드코드 vitest/build/push 대기
- **A0 핵심 발견:** parse-pdf 실파서 = gemini-quote-parser(§11.290 pipeline)이며 **specification
  을 이미 추출 중** — route 응답 매핑이 떨구고 있었음 → ①-a 는 통과 1줄 + 모달 표시로 축소.
  quote-ai-parser(BOM 추출용)에도 spec 필드·프롬프트 동반 정합.
- **스코프 분할:** ①-b(파싱 item→Product 매칭 후 카탈로그 승격 CTA)는 매칭 신뢰도 설계
  선행으로 후속 분리 (오매칭 적재 = canonical 오염 차단).
- **구현:** ② `/api/products/[id]/specification` PATCH 신설(zod·enforceAction·서버측
  ADMIN/SUPPLIER 게이트) + 상세 "스펙 편집" 버튼(canEditSpec)·다이얼로그·저장 wiring /
  ①-a route 통과 + 모달 규격 배지 표시 / sentinel `catalog-spec-backfill`(11 tests).
- **Started:** 2026-06-11
- **승인:** 호영님 2026-06-11 (①+② 1 batch — 조달청 spec 부재 P0 확정 후 소스 재선정)

## 0. Truth (P0 확정)

- **조달청 ref = identity 전용** — `ProcurementCatalogRef`·transform·operation 반환 필드 전수
  확인, spec(규격/용량) 필드 원천 부재. 1,108 backbone 은 존재 소스, 규격 소스 아님.
- **소스 확정**: ① 견적 회신 파싱(파서 기성: parse-pdf/parse-image) ② supplier/admin 직접 입력.
  ③ 제조사 카탈로그 수집 ④ 파트너 데이터 피드 = 전략 트랙(파트너십 가치 검증) 종속 — 본 batch 밖.
- **canonical 쓰기 대상**: `Product.specification`(+ `specifications` JSON — 상세 "추가 스펙"
  그리드 기성). 이원 구조의 쓰기 정책은 A0 lock.
- **원칙 (§11.348 동형)**: 파싱→제안→**사람 승인**→적재. 자동 적재 금지(오파싱·환각이
  canonical 오염 금지). 권한은 서버측 검증 필수(UI 게이트 단독 불충분).

## Phase

### A0 Truth Lock — [진행 중]
- 파서(parse-pdf/parse-image) 출력 스키마에 spec/규격 후보 필드 유무
- Product.specification 쓰기 API 유무(admin PATCH 등) + 권한 검증 위치
- supplier spec 편집 진입 surface 확정(상세 admin 영역 vs 벤더 포털)
- specification vs specifications 쓰기 정책

### A1 RED — sentinel
- ① 파싱 결과 spec 후보 노출 + 승인 CTA (자동 적재 0 단언)
- ② spec 편집 — canUpload 동형 게이트(ADMIN·SUPPLIER) + 저장 wiring + 서버측 권한 단언
- 회귀 0: §1-2⑤ 정직한 empty 유지(spec 적재 시 그리드 자동 표시), 기존 견적 플로우 무손상

### A2 GREEN ① — 견적 파싱 충전
- 파서 출력 → "규격 제안" 박스(승인/무시) → 승인 시 적재 (provenance: 출처=견적서)

### A3 GREEN ② — supplier/admin 편집
- spec 편집 버튼(안전 정보 편집 동형 위치·게이트) + 저장 API(서버 권한 검증)

### Gate / Rollback
- 자동 적재 0 · fake 0 · 권한 서버 검증 · 375px · 견적 플로우 회귀 0
- 트랙 ①② 독립 revert

## Key Risks
- 파서 출력이 자유 텍스트면 제안 품질 저하 → A0 실측 후 ② 선행으로 스코프 재조정 가능
- specification 이원 구조 쓰기 정책 미정 — A0 lock
