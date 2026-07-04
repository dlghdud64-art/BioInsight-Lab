# Implementation Plan: 안전관리 모달 고도화 (MSDS 등록 · 점검 기록)

- **Status:** ⏳ Pending
- **Started:** 2026-07-04
- **Last Updated:** 2026-07-04
- **Estimated Completion:** TBD (medium~large, 6 phases)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — ① 체크박스 체크 ② quality gate 명령 실행 ③ 전 항목 통과 확인 ④ Last Updated 갱신 ⑤ Notes 기록 ⑥ 그 다음에만 다음 phase.

⛔ quality gate 실패/미해결 truth 충돌 상태로 진행 금지 · dead button / no-op / placeholder success 도입 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 업로드 핸드오프 `안전관리 모달 고도화.md` + 시안 HTML (호영님 2026-07-04).

**Secondary References:** 현행 `src/app/dashboard/safety/page.tsx` (1517줄), `components/safety/MsdsBulkRegisterModal.tsx`, 스크린샷(안전 운영 판단, MSDS 미등록 100).

**Conflicts Found:**
- **C1 (큼)** 점검 단위: 현행 = lot 단위 엔드포인트 `/api/inventory/[id]/inspection` (page L316). 핸드오프 = **물질 대표 점검**(lot 안내 삭제, 헤더 뱃지 `물질 대표 점검`). → 저장 경로 변경.
- **C2** AI 큐 "완료 처리" 체크아이콘(page L898-904 `CheckCircle2`) = 로컬 `completedQueueIds` state 토글, **persistence 0**(새로고침 리셋). MSDS·점검 미완인데 "완료"로 흐림 = no-op/가짜완료. 핸드오프 미언급, 호영님 flag.
- **C3 (선행)** 목록이 비시약(카트·rack·bag stand 등) 100건 전부 "미등록" = 데이터 오류. 핸드오프 = 시약 카테고리만 필터.
- **C4 (외부 의존)** MSDS CAS 교차확인 = 안전보건공단 Open API(data.go.kr, msds.kosha.or.kr). 키 미보유. 법적: API=참고·자동채움, 공식 MSDS PDF=공급사 문서 필수(산안법).

**Chosen Source of Truth:** 핸드오프 우선. 단 C1은 저장경로 canonical 변경이므로 Phase 4에서 신중 처리. C4는 graceful-optional(§cas-hazard-classification P3c "키 없으면 정직 skip" 패턴 준용).

**Environment Reality Check:**
- [x] repo/branch: main (호영님 실 레포 = mount). 커밋·푸시 = 클로드코드 operator.
- [x] runnable: `npm run build --workspace=web` (tsc), vitest. sandbox 는 tsc 미실행 → operator gate.
- [ ] 실행 blocker: 공단 API 키(data.go.kr) 미발급 · 시약 카테고리 소스 필드 미확인(Phase 1 첫 작업).

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (기능 고도화)
- [ ] P2 / Deferred

**Why:** GMP/KOSHA 규정 준수 UX 강화 = 중요하나 릴리즈 블로커는 아님. C2(no-op)·C3(데이터 오류)는 신뢰 저해라 우선 처리.

## 2. Work Type

- [x] Feature (모달 2종 고도화)
- [x] Bugfix (C2 no-op 제거, C3 데이터 스코프)
- [ ] API Slimming
- [x] Workflow / Ontology Wiring (안전 큐 nextAction)
- [ ] Migration / Rollout (C1 점검 저장경로 — additive 지향)
- [ ] Billing / Entitlement
- [x] Web · Design Consistency

## 3. Overview

**Feature Description:** 안전 관리의 MSDS 등록·점검 기록 모달을 시안대로 고도화. 시약만 대상으로 정상화하고, 가짜완료(no-op)를 제거하며, 이상 발견 시 실질 조치 데이터(심각도·사진)를 캡처한다.

**Success Criteria:**
- [ ] 목록/KPI가 시약 카테고리 기준으로 정상화(비시약 제외)
- [ ] AI 큐 로컬 "완료 처리" no-op 제거 — 완료는 canonical 상태(MSDS·점검)로만
- [ ] MSDS 모달: CAS 키 입력 · 드래그&드롭+프리뷰 · 만료 · 파일없으면 제출 비활성 · 저장 후 목록 즉시 갱신 + 감사로그
- [ ] 점검 모달: 물질 대표 점검 · 점검자 자동채움 · 이상발견→내용·심각도·사진 · 저장 후 최근점검 갱신 + 감사로그

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 공단 API 실시간 자동채움을 공식 MSDS 대체물로 취급(법적 금지 — PDF 업로드 필수 유지)
- [ ] 새 페이지 신설(same-canvas Dialog 유지)
- [ ] AI/chatbot UI 신규

**User-Facing Outcome:** 시약만 깔끔히 노출 · 미등록/준비도 KPI 정확 · MSDS·점검을 시안 UX로 실제 등록 · 이상 발견 시 증빙까지 기록.

## 4. Product Constraints

**Must Preserve:** workbench/queue/rail/dock · same-canvas(Dialog) · canonical truth(MSDS·Inspection 실 저장) · invalidation(저장 후 목록·KPI refetch).

**Must Not Introduce:** page-per-feature · ontology→chatbot · dead button/no-op/placeholder success(← C2가 정확히 이것) · fake success · preview가 truth 대체.

**Canonical Truth Boundary:**
- Source of Truth: MSDS 문서 레코드(+버전/개정일/만료), Inspection 레코드(물질 대표), Product.safety 분류.
- Derived Projection: 안전지수·GMP/KOSHA 준비도·AI 큐(미등록/미점검 파생).
- Snapshot/Preview: 업로드 파일 프리뷰(제출 전), 공단 API 조회 결과(참고).
- Persistence Path: MSDS = POST /sds(기존) · Inspection = 물질 대표 저장경로(Phase 4 확정).

**UI Surface Plan:** [x] 기존 Dialog(모달) 내 인라인 — 새 라우트 없음.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-off |
|---|---|---|
| 점검 lot→물질 대표 | MSDS·점검 단위 일치, 시안 정합 | 저장경로 변경(additive 지향, 기존 lot 데이터 보존) |
| 공단 API graceful-optional | 키 미보유·법적 참고성 | 키 전엔 수동입력만(자동채움 비활성, 정직 표기) |
| 시약 필터 = 카테고리 파생 | KPI 정상화 선행 | 카테고리 소스 필드 확인 필요 |

**Dependencies:** 공단 Open API 키(data.go.kr, 후속) · Product 시약 카테고리 소스(Phase 1 확인) · 기존 POST /sds · 감사로그 훅.

**Integration Points:** safety/page.tsx · MSDS Dialog · Inspection Dialog · /api/sds · (신)물질점검 저장 · audit log · react-query invalidation.

## 6. Global Test Strategy

- 시약 필터/KPI 파생 → unit
- MSDS·Inspection 저장 계약 → integration
- 모달 저장→목록 갱신 → smoke
- sentinel(readFileSync+regex): no-op 제거·lot 안내 삭제·제출 비활성·물질 대표 뱃지·색 규칙
- 실행 불가(tsc/vitest sandbox) 시 "실행 불가" 표기 → operator gate

## 7. Implementation Phases

### Phase 0: Context & Truth Lock ✅(본 문서)
- Status: [x] Complete
- 산출: 충돌 C1~C4 확정, 가정(점검 물질단위 · API optional) 승인(호영님 2026-07-04).
- Gate: 충돌 미해결 0 · 우선순위 기록. Rollback: 문서만.

### Phase 1: 시약 카테고리 필터 + KPI 정상화 (선행)
- Status: [ ] Pending
- 🔴 시약 소스 필드 확인(Product.category/type) → 없으면 기준 재정의 후 실패 테스트 작성(비시약 제외 count)
- 🟢 filteredItems 에 시약 카테고리 게이트 + KPI(미등록·준비도) 파생을 시약 기준으로
- 🔵 파생 중복 제거
- ✋ Gate: 비시약 제외 test green · KPI 시약 기준 · 회귀 0. Rollback: 필터 조건 revert.

### Phase 2: AI 큐 "완료 처리" no-op 제거
- Status: [ ] Pending
- 🔴 sentinel: `completedQueueIds` 로컬 완료 토글 부재 단언
- 🟢 CheckCircle2 완료버튼 + completedQueueIds state 제거. 완료 = MSDS/점검으로 canonical 파생 시 큐 이탈
- 🔵 행 레이아웃 정리(nextAction CTA 유지)
- ✋ Gate: no-op 0 · nextAction·모바일 인라인 확장 보존 · dead button 0. Rollback: 커밋 revert.

### Phase 3: MSDS 등록 모달 고도화
- Status: [ ] Pending
- 🔴 integration: 파일없으면 제출 비활성 · CAS 필수 · 저장 후 목록 refetch
- 🟢 드래그&드롭 존+프리뷰(파일명·용량·삭제) · CAS 입력키 · 버전/개정일/만료 · 맥락 배너 · (키 있으면 공단 교차확인 ok/warn, 없으면 수동·정직 skip) · POST /sds 저장 + 감사로그
- 🔵 색 규칙(초록=참고확인/일치, 노랑=불일치, 빨강=위험)
- ✋ Gate: 제출 비활성 동작 · fake success 0 · 저장 후 상태 즉시 갱신 · 공식 PDF 필수 유지. Rollback: 모달 컴포넌트 revert.

### Phase 4: 점검 기록 모달 — 물질 대표 점검
- Status: [ ] Pending
- 🔴 저장 계약 test: 물질 대표 점검 저장 → 최근점검 갱신. lot 안내 부재 sentinel
- 🟢 헤더 `물질 대표 점검` 뱃지 · lot 안내 삭제 · 점검자 자동채움+변경 · 보관/PPE 토글 · 이상발견 ON→내용·심각도3단·사진 펼침(빨강) · 저장+감사로그
- 🔵 성공=초록/이상=빨강 시각 구분
- ✋ Gate: lot 안내 0 · 이상발견 후속입력 실제 저장 · no-op 0 · canonical 갱신. Rollback: 모달+저장경로 revert(기존 lot 경로 보존).

### Phase 5: Smoke / Rollback / Sentinel
- Status: [ ] Pending
- 🔴 smoke 경로 정의(등록→목록갱신, 점검→최근점검, 이상→조치저장)
- 🟢 smoke 실행 · 감사로그 확인 · sentinel 통과
- 🔵 임시 계측 제거 · Notes 정리
- ✋ Gate: build EXIT 0 · 전 sentinel green · rollback 문서화. Rollback: phase별 커밋 revert.

## 8. Addenda

**A. Workflow/Ontology(안전 큐):** resolver 입력=시약 상태(MSDS·점검·위험). 출력=nextAction/priority/blockers. Surface=same-canvas 큐 행 CTA. 검증: top 우선순위·행 CTA·모바일 인라인 정확. no chatbot.

## 9. Risk Assessment

| Risk | P | I | Mitigation |
|---|---|---|---|
| 점검 lot→물질 저장경로 변경 | Med | High | additive, 기존 lot 데이터 보존, P4 격리 |
| 공단 API 키 미보유 | High | Med | graceful-optional, 수동입력 fallback, 정직 skip |
| 시약 카테고리 소스 부재 | Med | Med | P1 첫 작업서 확인, 없으면 기준 재정의 |
| 감사로그 누락 | Low | High | 두 모달 저장 시 audit 훅 필수 gate |

## 10. Rollback Strategy

- P1 실패: 필터/파생 revert
- P2 실패: no-op 제거 커밋 revert
- P3 실패: MSDS 모달 컴포넌트 revert
- P4 실패: 점검 모달+저장경로 revert(기존 lot 경로 유지)
- P5 실패: 직전 커밋 revert
- 특수: DB 저장경로는 additive(파괴적 migration 금지, dry-run→보고→승인)

## 11. Progress Tracking

- Overall: 50% (P0·P1·P2 완료, 샌드박스 sentinel GREEN, operator 빌드·커밋 대기)
- Current phase: P3 대기(MSDS 모달)
- Current blocker: git index 손상(operator `git reset` 재생성 필요) · 공단 API 키 · RAW_MATERIAL 스코프 확인
- Next: P3 MSDS 모달 고도화

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1 (시약 REAGENT 서버 필터, sentinel 4/4)
- [x] Phase 2 (완료버튼 no-op 제거, sentinel 4/4)
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5

## 12. Notes & Learnings

- [2026-07-04] C2 AI 큐 "완료 처리" = 로컬 no-op 확인(호영님 flag). canonical 완료로 대체.
- 가정 승인: 점검 물질 대표 단위 전환 · 공단 API optional(호영님 2026-07-04).
- 점검 lot→물질 전환은 저장경로 canonical 변경 — P4에서 additive·rollback 보존으로 신중 처리.
