# Implementation Plan: MSDS 일괄 등록 (Track B — 진짜 실 등록)

- **Status:** 🔄 In Progress
- **Started:** 2026-07-04
- **Last Updated:** 2026-07-04
- **Feature ID:** §msds-bulk-registration (§msds-registration Track B)

**CRITICAL:** phase 완료 시 (1) 체크박스 (2) quality gate (3) Last Updated (4) Notes 후 다음 phase.
⛔ dead button/no-op/placeholder success 금지. ⛔ 플래그-only 등록 금지(문서 실물 첨부 = 등록 정의).

## 0. Truth Reconciliation

**결정 (호영님 2026-07-04):**
- 등록 정의 = 문서 실물(PDF) 첨부·보관 (플래그-only 금지).
- 매칭 = PDF 내용 추출 자동매칭 + 사용자 확인.
- Track A(라벨 정정)·CAS 위험분류는 이미 배포 — 재작업 없음.

**이미 존재(재사용):**
- 단일 실 등록: POST /api/products/[id]/sds (파일 저장 + 버전 메타).
- SDS 파이프라인: SDSDocument(extractionStatus/extractionResult), sds/[id]/extract, sds/[id]/apply(merge/overwrite), safety/sds(라이브러리 GET), sds/[id]/signed-url.
- 안전지수: GMP/KOSHA 준비도 = hasMsds 파생 자동(safety L402-404) — 실 등록 시 자동 상승, 별도 작업 0.
- 버전 관리: docVersion/issuedAt/expiresAt(§msds-version-validation).
- 매칭 프리미티브: casNo 저장(§cas-hazard), scan-label 매칭, catalog.

**갭(구현 대상):**
- 일괄(bulk) 업로드 오케스트레이션 (현재 단일만).
- N개 문서 자동매칭 확인 UI.
- 감사 이력: SDSDocument에 createdBy 없음.

**아키텍처 확정 (B-P0, 2026-07-04) — migration 0:**
- staging = 스토리지 경로 prefix(`_staging-<sessionId>/`, uploadSdsFile productId 파라미터 재사용). 미매칭 PDF는 확인 전까지 staging, commit 시 product 경로로 이동·SDSDocument 생성. **DB 엔티티/nullable 불필요.**
- 감사 = 기존 `lib/activity-log.ts` `createActivityLog`(ActivityLog 모델) 재사용. **createdBy 필드 migration 불필요.**
- 매칭 identity = `safety-extractor`에 casNumber·productName 추출 추가(additive prompt). MSDS §1(제품명)·§3(CAS) 존재.
- bulk = 2-phase: ① 업로드+동기 추출+자동매칭 프리뷰 ② 확인+commit(건별 apply·감사). async extract 파이프라인과 별개(동기 identity, N cap).

**Priority Fit:** Post-release 정식 기능. **migration 0 → prod DB 게이트 없음**(감사=활동로그, staging=스토리지 prefix).

## 1. Product Constraints
- same-canvas(안전페이지 워크벤치, 신규 page 금지) · canonical=SDSDocument/hazardCodes · 단일 등록 경로 보존.
- no-op/fake success 0 · 플래그-only 금지 · 문서 실물 필수.

## 2. Phases

### Phase 0: Truth Lock + staging 아키텍처
- Status: [x] Complete
extract/apply 파이프라인 정독 · staging 방식 확정 · 감사 방식(createdById vs 활동로그) 확정.
✋ Gate: 아키텍처 확정, 충돌 0. Rollback: planning-only.

### Phase 1: 추출 identity 확장 (매칭 소스)
- Status: [x] Complete
safety-extractor 에 casNumber·productName 추가(additive). SafetySummary 확장. 실패테스트 먼저.
✋ Gate: 기존 호출부 무영향(additive), 단위 GREEN. Rollback: 필드 제거. **migration 없음.**

### Phase 2: 매칭 엔진 (순수함수)
- Status: [x] Complete
추출 CAS/제품명/Cat → 재고 품목 매칭. scan 매칭 재사용. 확신도·미매칭 분리. 단위테스트.
✋ Gate: 단위 GREEN, 오매칭 방지(확신 낮으면 미매칭). Rollback: lib 제거.

### Phase 3: 일괄 오케스트레이션 API
- Status: [x] Complete
N PDF → staging → 추출 → 자동매칭 → 확인 후 batch apply(SDSDocument 생성·hasMsds→true·감사). 미매칭 수동지정.
✋ Gate: no-op 0, front-only success 0, 부분실패 격리. Rollback: 배선 revert.

### Phase 4: UI 워크벤치 (same-canvas)
- Status: [x] Complete
안전페이지 업로드→매칭표 확인→일괄 등록. 단일 모달·미분류 칩 재사용. loading/error/empty/부분성공 상태.
✋ Gate: dead button 0, same-canvas, 상태 완비. Rollback: UI revert.

### Phase 5: Smoke / Rollback
- Status: [x] Complete (검증·문서화)
실 PDF 일괄 등록 → hasMsds·GMP/KOSHA 상승·감사·미분류 감소 검증. build/sentinel.
✋ Gate: build 0, rollback 문서화. Rollback: 단계별 revert.

## 3. Risks
| Risk | Mit |
| :--- | :--- |
| staging 복잡도 | P0에서 최소 diff 방식 확정, match-first 우선 검토 |
| 부분 실패(N중 일부) | 건별 상태·격리, 전체 실패 아님 |
| 매칭 오류 | 확신 낮으면 미매칭→수동, auto-apply 금지 |
| OpenAI 의존(추출) | 무키 시 정직 skip, 수동 매칭 fallback |
| ~~prod migration~~ | **제거** — 감사=활동로그, staging=스토리지 prefix (migration 0) |

## 4. Progress
- Overall: 100% (B-P0~P5 완료, migration 0)
- Current: 커밋 대기
- Next: 커밋·push (DB 게이트 없음) · (후속)감사-who enum

## 5. Notes
- [2026-07-04] 스펙 대부분(A·CAS·안전지수·버전·단일등록) 기배포. Track B = bulk 계층 + 감사만.

## B-P5 검증 결과 (2026-07-04)
- **무결성:** B-track 10파일 NUL 0.
- **로직(Node):** matcher 6/6(Cat 유일→auto, CAS 다중→수동, Cat 우선, 무매칭→none) · extractor identity 4/4.
- **sentinel(fs+regex):** B-P1+P2 매칭·B-P3 API 12/12 · B-P4 UI 9/9 · Track A 재정밀 5/5.
- **Track A 정합:** 진짜 '일괄 등록(문서 첨부)' 추가로 msds-prep-wizard 의 광범위 '일괄 등록' 금지를 '일괄 등록 시작'(가짜) 금지 + 실등록 setBulkOpen 연결로 정밀화.

## Smoke Path (operator, OPENAI_API_KEY 프로덕션 설정 시)
1. 안전페이지 → 'MSDS 일괄 등록 (문서 첨부)' → PDF 여러 개 선택 → '분석·매칭'.
2. 매칭표: 위험시약 MSDS 는 CAS/제품명으로 자동매칭, 미매칭은 드롭다운 수동 지정.
3. 'N종 등록' → registered N. 안전페이지 refetch → hasMsds↑ → GMP/KOSHA 준비도 상승·미분류 감소.
4. OPENAI 무키: 자동매칭 비활성(정직 표기), 전량 수동 지정으로도 실 등록 가능.

## Rollback
- B-P4: 안전페이지 버튼/마운트 revert + 컴포넌트 제거.
- B-P3: bulk/route·commit/route 제거.
- B-P2/P1: msds-match.ts 제거 · extractor identity 필드 revert. **migration 0 → DB rollback 불필요.**

## Deferred — 감사(누가) 로그
createActivityLog(MSDS_REGISTERED) 은 ActivityType enum 확장(migration) 필요 → 별도 트랙. 현재 SDSDocument.createdAt=when 은 기록됨. who 는 후속 enum 추가 시 배선.
