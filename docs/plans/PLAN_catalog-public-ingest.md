# PLAN — Catalog Public Ingest (식별 계층)

> **Last Updated:** 2026-06-09
> **Status:** Approved — Phase 0 진입 대기

## ⚖️ Quality Gate 규칙 (모든 phase 공통)
- 각 phase는 quality gate 통과 후에만 다음으로 진행. **실패 시 stop, skip 금지.**
- TDD Red-Green-Refactor 강제 — 테스트 먼저, 실패 확인 후 구현.
- 실행 불가한 검사는 "실행 불가"로 명시(추정 통과 금지).
- canonical truth(`db.product`) boundary 침범 금지 / dead button·no-op·front-only success 금지 / same-canvas 유지 / page-per-feature 회귀 금지.
- 각 phase 완료 시 체크박스 `[x]` + Last Updated 갱신 + notes 반영.

---

## 1. Feature Summary
조달청 공공데이터(식별 계층)를 LabAxis에 ingest하여 **정규화·dedup backbone + 검색 폭**을 무료로 확보한다. 핵심 = 물품식별번호(제조사+모델 고유) 레지스트리를 **별도 ref 테이블**로 적재하고 `searchProducts`가 union 조회, ref 항목은 실제 사용 시에만 canonical product로 승격(demand-driven). **가격 계층(종합쇼핑몰 계약단가·납기)은 본 플랜 범위 밖 — 별도 후속 플랜.**

**해결 대상 병목:** 검색 집합 ≈286 / "가격·납기 미확인" / 웰호류 정합 위반(제조사 오기).

---

## 2. Truth Reconciliation
- **Latest Truth Source:** 2026-06-09 세션 — `SCOPING_catalog-A-data-sources` §결정 배너(제휴 불채택·무료 ingest·demand-driven) + §7(공공데이터 2계층·UNSPSC·커버리지 caveat).
- **Secondary References:** `HANDOFF_sourcing-scan-product-surface` §catalog 정합(P0); 세션 grep 확정(searchProducts→로컬 db.product≈286, 외부 5M=0, "500만+"=정정 완료 `02bb7fd7`).
- **Conflicts Found:** 없음. (이전 "제휴 1순위" 프레이밍은 §결정 배너가 supersede.)
- **Chosen Source of Truth:** `db.product` = canonical. `searchProducts` = 검색 진입 경로. 공공데이터 = **reference**(별도 테이블, provenance 표기, 자동신뢰 금지).
- **Priority Fit:** **P1 (substrate)** — 확정 #1 병목 직격, de-gated. §11.37x(P1 스캔) 다음.
- **추정(미확정):** 조달청 시약·실험 정확 품목 수 → Phase 0에서 cowork API 카운트로 lock. 설계는 무관, 수치는 사이징·go/no-go만 좌우.

---

## 3. Requirements & Scope
- **작업 유형:** Migration/Data Ingest + Workflow-Ontology Wiring(검색 surface) + API(검색 union).
- **Scope:** Medium (5 phase, ~8–15h). 식별 계층 한정.
- **Integration Points:** `db.product`(canonical, read-only 보호) / `searchProducts`(union 확장) / 신규 `procurement_catalog_ref` 테이블 / 검색 결과 UI(provenance 배지) / nightly ingest job / feature flag.
- **범위 밖(명시적 defer):** 가격 계층(계약단가·납기), 제조사 공개 카탈로그 ingest, demand-driven 승격의 고도화(초기엔 최소 hook만).

---

## 4. Surface / Canonical Truth / Data Model
- **Source of Truth:** `db.product`(canonical). 공공데이터는 절대 db.product를 직접 덮지 않음.
- **Derived / Projection:** `procurement_catalog_ref` = 외부 참조 index(projection, not truth). 검색 결과의 ref 항목 = projection.
- **No-op / front-only 위험:** ref 항목이 검색에 뜨되 액션(퀵뷰·견적요청·담기) 없이 dead-end 되면 안 됨 → P3에서 실 액션 wiring 필수.
- **same-canvas:** 신규 페이지 없음. 기존 검색 surface에 ref 항목 + provenance 배지를 흡수.

**Data Model — `procurement_catalog_ref`:**
- `prdct_id_no`(물품식별번호, PK·dedup 키) / `prdct_clsfc_no`(물품분류번호, UNSPSC 기반) / `dtil_prdct_clsfc_no`(세부물품분류번호) / `mfrt_nm`(제조업체명) / `prdct_nm`·`dtil_prdct_nm`(품명·세부품명) / `eng_prdct_nm`(영문품명) / `model_nm`(모델명) / `source`('public_procurement') / `linked_product_id`(nullable→승격 시 db.product FK) / `ingested_at`·`source_updated_at`.
- 가격 필드는 본 플랜에서 미적재(가격 계층 후속).

**Persistence Path:** data.go.kr → ingest job → upsert(by 물품식별번호) → `procurement_catalog_ref`. db.product는 unchanged(승격 시에만 INSERT, 별도 명시 경로).

**UI Surface Plan:**
- [x] Existing route section (기존 검색 결과에 흡수)
- [ ] Inline expand / Right dock / Bottom sheet / Split panel / Settings panel
- [ ] New page (불가 — 정당화 없음)

---

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 별도 `procurement_catalog_ref` 테이블 (db.product 직접 적재 X) | canonical 보호 + demand-driven 승격 + 웰호류 차단을 한 구조로 만족 | 검색이 union 조회 → 쿼리 복잡도·인덱싱 비용 |
| dedup 키 = 물품식별번호 | 제조사+모델 고유 = 정규화 backbone | 식별번호 없는 품목은 backbone 밖(전문 시약 tail) |
| 식별번호 exact만 auto-merge, fuzzy는 주석/제안 | 오병합(canonical 손상) 방지 | 일부 중복은 수동/후속 정리 |
| demand-driven 승격(사용 시 product화) | 폭을 "사오지" 않고 실사용 기반 성장 | 초기 검색엔 ref 항목 비중 큼(배지로 구분) |

**Dependencies:**
- Required Before Starting: data.go.kr 무료 API 키, 시약·실험 분류번호(UNSPSC 12·41 대역) 확정, Phase 0 커버리지 카운트.
- External: data.go.kr Open API — 물품목록정보서비스(15129417), 상품정보시스템 등록 물품(15050862, 벌크 seed).
- Touched: `searchProducts`, product 검색 결과 컴포넌트, 신규 테이블·마이그레이션, ingest job/스케줄러, feature flag 인프라.

**Integration Points:** 검색 server action/route / product 검색 query / 검색 결과 surface / nightly job / audit log.

---

## 6. Global Test Strategy
All phases Red-Green-Refactor.
- 데이터/비즈니스 로직(transform·upsert·dedup matcher) → unit 필수.
- 검색 union 계약 변경 → integration 필수.
- 사용자 가시 흐름(ref 항목 검색→액션) → smoke 1+.
- ingest job/rollout → smoke + rollback 검증.
- 검색 surface = ontology 접점 → §8-A 매트릭스(검색 결과·배지·액션) 검증.
- **실행 불가 시 "실행 불가" 명시, 추정 통과 금지.**

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** truth·명령·우선순위·계약·아키텍처를 구현 전 확정.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** db.product canonical·searchProducts 경로 코드 확인 / API 키·엔드포인트 미확보 상태 명시 / 시약·실험 분류번호 미확정 노출.
**🟢 GREEN:** data.go.kr 키 발급, 시약·실험 분류번호(UNSPSC 12·41) 확정, **커버리지 카운트**(품목 수·제조사 분포·식별번호 존재율) 실행, ref-table 접근 확정.
**🔵 REFACTOR:** scope 재확인(식별 계층 한정 유지), stale 가정 제거.
**✋ Quality Gate:** 미해결 충돌 0, false 가정 0, 커버리지 수치로 go/no-go·사이징 문서화.
**Rollback:** planning-only, 코드 변경 없음.

### Phase 1: Contract & Failing Tests
**Goal:** 의도된 동작을 계약으로 고정, 실패를 가시화.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** `procurement_catalog_ref` 스키마 마이그레이션 테스트 / idempotent upsert(by 물품식별번호) 테스트 / dedup-match(식별번호 exact) 테스트 / search-union(ref 항목 반환) 테스트 — 전부 실패 상태로 작성.
**🟢 GREEN:** 최소 스키마·계약 scaffolding 구현(테스트 빨강→초록 최소선).
**🔵 REFACTOR:** 네이밍·scope 정리.
**✋ Quality Gate:** 실패 테스트가 real, 기존 테스트 무회귀, lint/typecheck 문서화.
**Rollback:** 계약/테스트 scaffolding revert.

### Phase 2: Core Ingest + Dedup Logic
**Goal:** ingest·정규화 핵심 로직 최소 동작.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** transform·upsert·dedup matcher unit 테스트.
**🟢 GREEN:** data.go.kr 페이징 fetch(시약·실험 분류 필터)→transform→idempotent upsert / 정규화 매처(식별번호 exact=auto-merge·`linked_product_id` 주석 / 제조사+세부품명 fuzzy=후보 주석만, merge 안 함). 벌크 seed(15050862) + API 증분(15129417).
**🔵 REFACTOR:** DRY, 추측성 코드 제거.
**✋ Quality Gate:** core 로직 테스트 통과, truth-boundary 무침범(db.product write 0), overfetch/N+1 없음.
**Rollback:** service/모델 레이어 Phase 1로 revert.

### Phase 3: Search Union + Provenance Wiring
**Goal:** 동작 로직을 실제 사용자 진입점에 연결.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** search union·배지·액션 integration 테스트(ref 항목이 검색에 뜨고 액션 가능).
**🟢 GREEN:** `searchProducts`가 union(db.product, procurement_catalog_ref) 조회 / ref 항목 "공공조달 참조" 배지 / 실 액션(퀵뷰·견적요청·담기) wiring(no dead-end) / demand-driven 승격 hook(ref→product 최초 실사용 시 INSERT).
**🔵 REFACTOR:** UI surface 단순화, 중복 제거, same-canvas 유지.
**✋ Quality Gate:** dead button·front-only success 0, loading/error/empty 상태 존재, 배지로 출처 명확, page-per-feature 회귀 0.
**Rollback:** UI/검색 wiring Phase 2로 revert.

### Phase 4: Rollout / Smoke / Rollback
**Goal:** 안전 출시·복구 보장.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** rollout 실패 모드 식별, smoke 경로 정의.
**🟢 GREEN:** feature flag(`catalog_public_ingest`), nightly refresh job, smoke(알려진 시약이 출처표기+액션 가능하게 검색됨) 실행, audit/카운트 로깅.
**🔵 REFACTOR:** 임시 계측 제거, notes 확정.
**✋ Quality Gate:** rollout 안전, rollback 문서화, 잔여 blocker 격리.
**Rollback:** flag off + `procurement_catalog_ref` read 제거(db.product 무손상 = canonical 안전). 필요 시 테이블 drop.

---

## 8. Addenda

### A. Workflow / Ontology Addendum (적용 — 검색 surface)
**Resolver Input:** route(검색) / selection(검색어·분류) / snapshot validity(ref provenance).
**Expected Output:** 검색 결과 항목 + source 표기 + allowedActions(퀵뷰·견적요청·담기).
**Surface Rules:** 기존 검색 결과 row에 흡수, 배지로 출처 구분. chatbot/terminal/AI 패널 금지.
**Validation:**
- [ ] ref 항목 출처 배지 정확
- [ ] 검색 정렬에서 ref가 canonical을 부당하게 밀어내지 않음
- [ ] row 액션 정확(dead-end 없음)
- [ ] demand-driven 승격 hook 동작

### C. API Slimming Addendum (적용 — searchProducts union)
**Waste Type 경계:** union 도입이 Overfetch/N+1 유발 금지.
**Minimal Diff:** select 필드 제한, ref 테이블 인덱스(물품식별번호·분류번호·제조사), 페이지네이션 유지. 단일 쿼리/조인 또는 분리 후 머지 중 측정으로 선택.

### D. Mobile Addendum (적용 — 검색은 모바일에도 존재)
**Must Include:** 검색 결과 ref 항목이 모바일에서도 배지+액션 동일 / offline 캐시 시 provenance 유지.
**Validation:**
- [ ] 모바일 검색 결과 빈/로딩/에러 상태
- [ ] ref 항목 탭 시 정확한 목적지(퀵뷰)
- [ ] 승격 후 product로 일관 표시

*(B. Billing — 해당 없음, skip.)*

---

## 9. Risk Assessment
| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| canonical(db.product) 오염 | Med | High | 별도 ref 테이블, db.product write 금지, provenance 필수, 승격만 별도 경로 |
| 전문 시약 커버리지 희박 | High | Med | P0 카운트가 go/no-go; backbone 가치는 tail 무관 성립; tail은 demand-driven |
| 식별번호 dedup 오병합 | Med | Med | 식별번호 exact만 auto-merge, fuzzy는 후보 주석만 |
| 검색 union 성능(N+1/overfetch) | Med | Med | 인덱스·select 제한·페이지네이션, §8-C |
| ref 항목 dead-end | Med | High | P3 실 액션 wiring + quality gate |
| API rate limit/스키마 변동 | Low | Low | nightly 배치, 벌크 seed + 증분, 스키마 검증 |

---

## 10. Rollback Strategy
- Phase 1 실패: 계약/테스트 scaffolding revert.
- Phase 2 실패: 모델/서비스 로직 revert(테이블 비활성).
- Phase 3 실패: 검색 union/UI wiring revert(검색은 db.product-only로 복귀).
- Phase 4 실패: feature flag off, ref read 제거, 필요 시 테이블 drop.
- **공통 안전판:** db.product는 전 과정 write 금지 → 어느 단계 롤백도 canonical 무손상.

---

## 11. Progress Tracking
- Overall completion: 0%
- Current phase: Phase 0 (대기)
- Current blocker: data.go.kr API 키 + 커버리지 카운트
- Next validation step: Phase 0 커버리지 수치로 go/no-go

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings
**Blockers Encountered:**
- [2026-06-09] 정확 품목 수 미확정 → Phase 0 API 카운트로 해소 예정.

**Implementation Notes:**
- 가격 계층(종합쇼핑몰 계약단가·납기)은 의도적 defer — commodity 한정 + 저신뢰 게이트로 별도 플랜.
- 제조사 공개 카탈로그 ingest = 폭 tail 보강의 별도 후속.
- 승격(promotion) 고도화(자동 enrich·중복 정리)는 본 플랜 최소 hook 이후 재검토.
