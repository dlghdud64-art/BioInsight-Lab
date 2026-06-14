# Implementation Plan: 로그 통합 (활동 로그 + 감사 추적 → 단일 로그 surface)

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — 체크박스 갱신 / quality gate 검증 / Last Updated / Notes / 그다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op 도입 금지.
⛔ **감사 컴플라이언스(GMP Part 11 / admin-gate / PDF export) 회귀 금지** = 규제 리스크.
⛔ 안전(`/dashboard/safety`)을 로그로 흡수 금지 = ontology/canonical 경계 보호.

---

## 0. Truth Reconciliation

**Latest Truth Source (코드 근거, P0 확정):**
- **활동 로그** `dashboard/activity-logs/page.tsx` — 데이터: `/api/activity-logs` = Prisma **`ActivityLog`** 실데이터(`db.activityLog.findMany/count/create`, org 멤버 scoped). ⚠️ **정정: mock 아님.** 페이지 주석 line 45 "mock data 만"은 **stale**(§11.63 wiring 전 흔적). enum `ActivityType`(schema 1360) 한글 매핑.
- **감사 추적** `dashboard/audit/page.tsx` — 데이터: `/api/audit-logs` = Prisma **`AuditLog`** 실데이터(`getAuditLogs`, §11.81), **admin-gate**(role ADMIN/org admin/self, line 42-49), **GMP Part 11** 타임존, **PDF 내보내기**(§11.89). enum `AuditEventType`(schema 1481).
- **안전 관리** `dashboard/safety/page.tsx` — 화학물질/MSDS 도메인. **통합 대상 아님(확정)**.
- **`DataAuditLog`**(schema 2073) ← `/api/data-audit-logs`(CRUD 추적, org RLS) — **UI 소비처 0(orphan).** 통합 out-of-scope.
- sidebar(152-153): "활동 로그" `/dashboard/activity-logs` + "감사 추적" `/dashboard/audit` 인접 2항목.

**Conflicts Found (P0 해소):**
- ~~활동=mock~~ → **정정: 활동·감사 둘 다 실데이터, 단 서로 다른 모델**(`ActivityLog`/enum ActivityType vs `AuditLog`/enum AuditEventType, 별 테이블).
- **권한 비대칭**: 활동=org 멤버 열람 / 감사=admin-gate. 통합 모드토글이 권한 분기 필요(비admin=활동만, admin=둘 다).

**Chosen Source of Truth:**
- **모델 병합 없음.** 통합 = **단일 route + 모드토글, 각 모드가 자기 모델 읽기** — 활동 모드→`ActivityLog`(`/api/activity-logs`) / 감사 모드→`AuditLog`(`/api/audit-logs`). 두 모델 각각이 자기 도메인 SoT.
- mock 제거·데이터 수렴·migration **불요**(둘 다 실데이터). = 위험 ↓.
- **통합 형태 = 단일 로그 route + 모드 2개(활동/감사)** — 호영님 승인. 감사 모드 stricter(admin-gate + Part11 + PDF export) 보존. 모드 토글은 **권한 분기**(비admin은 감사 모드 비노출/disabled).

**Environment Reality Check:**
- [ ] repo/branch context (main, operator-shell push)
- [ ] sentinel = readFileSync+regex (격리 node 검증), 실 vitest·build·push = operator-shell
- [ ] prod write 0 (UI/route 한정, AuditLog 스키마 변경 없음 전제 — P0에서 확정)

## 1. Priority Fit
- [x] Post-release / P2 (Post-§11.374 UX·구조 정합)
- **Why:** §11.374·ETL 종결 후 메뉴/surface 정합 트랙. 신규 P1 충돌 없음. 단 감사=규제 surface라 회귀 민감.

## 2. Work Type
- [x] Workflow / surface 구조 변경
- [x] 데이터 정직화 (mock 제거 → 실 소스)
- [x] Mobile (§mobile-surface 추가 적용)
- [x] Design Consistency

## 3. Overview

**Feature Description:**
활동 로그 + 감사 추적 2개 surface를 **단일 로그 route + 활동/감사 모드 토글**로 통합. 활동 모드는 실 AuditLog 기반(mock 제거), 감사 모드는 컴플라이언스 등급(admin-gate + 필터 + PDF export) 보존.

**Success Criteria:**
- [ ] 단일 로그 surface — 활동/감사 모드 토글, 각 모드가 자기 모델 읽기(활동→ActivityLog / 감사→AuditLog)
- [ ] 감사 모드 컴플라이언스 보존: admin-gate · GMP Part 11 타임존 · PDF export
- [ ] **권한 분기**: 비admin은 감사 모드 비노출/disabled, admin은 둘 다
- [ ] 모드별 필터/컬럼 정합(활동=ActivityType / 감사=AuditEventType), 빈데이터 정직 empty
- [ ] sidebar 2항목 → 1항목(+감사 뷰), dead link 0, 구 route redirect
- [ ] 모바일 §mobile-surface(헤더 우측액션·컴팩트·drill-in), 375px smoke
- [ ] sentinel GREEN (감사 보존 회귀 0)

**Out of Scope (⚠️ 절대):**
- [ ] 안전(`/dashboard/safety`) 통합/흡수
- [ ] **데이터 모델 병합/migration** — ActivityLog·AuditLog 각각 유지(읽기 surface만 통합). 스키마 무변경.
- [ ] **DataAuditLog**(orphan endpoint, UI 0) 노출/연결
- [ ] 감사 권한 완화(admin-gate 약화)
- [ ] kpi-category-axis / safety empty-state 버그(별 트랙)

**User-Facing Outcome:**
- 흩어진 로그 2개 → 한 곳에서 활동/감사 전환. 감사는 여전히 admin 전용·export 가능. 활동은 실데이터(또는 정직한 빈 상태).

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench/queue/rail/dock, same-canvas
- [ ] canonical truth = AuditLog (UI state가 대체 금지)
- [ ] 감사 컴플라이언스(admin-gate / Part 11 / PDF export)

**Must Not Introduce:**
- [ ] page-per-feature, dead button/no-op
- [ ] 활동 모드 mock/가짜 분포(정직성)
- [ ] 안전 도메인 흡수(ontology 경계)
- [ ] route 통합으로 인한 dead link(redirect 보존)

**Canonical Truth Boundary:**
- Source of Truth: Prisma `AuditLog` (`/api/audit-logs`)
- Derived Projection: 활동/감사 모드 뷰(필터·컬럼 차이)
- Snapshot/Preview: 없음(실시간 fetch)
- Persistence Path: 기록은 기존 audit 기록 경로 — 본 트랙은 **읽기 surface 통합**만(쓰기 경로 무변경)

**UI Surface Plan:**
- [x] Existing route section (`/dashboard/audit`를 canonical로, 모드 토글 흡수) — *대안: 신규 통합 route + redirect (P2에서 확정)*
- [ ] New page (⚠️ 지양)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 활동을 감사 인프라(실 AuditLog)로 수렴 | 정직성(§1-2⑤), 단일 SoT | 활동로그 mock이 제거되며 빈 상태 노출 가능 |
| 단일 route + 모드 토글(활동/감사) | same-canvas, 메뉴 단순화 | 모드별 권한/필터 분기 로직 필요 |
| 감사 모드 stricter 보존 | 규제(GMP Part 11) | 모드 전환 시 권한·export 분기 테스트 필수 |

**Dependencies:**
- Required Before Starting: P0 truth(활동 mock 여부 / data-audit-logs 역할 / AuditLog 이벤트 범위)
- Touched: `dashboard/audit/page.tsx`, `dashboard/activity-logs/page.tsx`, `_components/dashboard-sidebar.tsx`, (redirect) route config
- API: `/api/audit-logs`(canonical), `/api/activity-logs`(흡수/제거 판정), `/api/data-audit-logs`(역할 확정)

## 6. Global Test Strategy
Sentinel(readFileSync+regex): 단일 surface 모드토글 계약 · 감사 보존(admin-gate/Part11/export 문자열·핸들러) · 활동 mock 제거 · sidebar 1항목 · redirect. 실 vitest·build = operator-shell. 권한/export E2E는 smoke로 문서화.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-06-14)
- Status: [x] Complete
- **확정:** 활동=실 ActivityLog(mock 아님, 주석 stale) / 감사=실 AuditLog(admin·Part11·export) / DataAuditLog=orphan(UI 0, 제외) / 권한 비대칭(활동=org멤버, 감사=admin). 통합=단일 route+모드토글, **모델 병합 없음**(각 모드 자기 모델), 스키마 무변경.
- **✋ Gate:** 핀 2개 해소, 충돌 0, 위험 재산정(mock risk 제거 → 권한 분기 risk 추가). Rollback: planning-only.

### Phase 1: Contract & Sentinel (RED)
- Status: [ ] Pending
- **🔴 RED:** 단일 로그 surface 계약 sentinel(활동/감사 모드 토글) + **회귀 0**(감사 admin-gate·Part11·PDF export 보존, 활동 mock 제거) — 구현 전 RED.
- **🟢 GREEN:** 계약 scaffolding 최소.
- **✋ Gate:** RED 진짜 실패, 기존 sentinel 무회귀. Rollback: sentinel revert.

### Phase 2: 단일 surface 구현
- Status: [ ] Pending
- **🟢 GREEN:** 단일 로그 route에 활동/감사 모드 토글. 각 모드가 자기 모델/엔드포인트(활동→`/api/activity-logs`/ActivityLog, 감사→`/api/audit-logs`/AuditLog) 읽기 — **데이터 병합 없음**. 모드별 필터/컬럼 분기 + **권한 분기**(비admin 감사 모드 비노출). empty 정직.
- **✋ Gate:** 감사 export/admin-gate/Part11 동작, 활동 ActivityLog 보존, 권한 분기 정합, dead button 0, sentinel GREEN. Rollback: 활동/감사 분리 surface 복귀.

### Phase 3: 메뉴 정리 + redirect
- Status: [ ] Pending
- **🟢 GREEN:** sidebar 활동로그+감사 2항목 → 1항목(+감사 뷰 진입). 구 route(`/dashboard/activity-logs`) → 통합 route redirect. dead link 0.
- **✋ Gate:** 메뉴 1항목, 구 링크 redirect, dead link 0. Rollback: sidebar 2항목 복귀.

### Phase 4: 모바일 + Smoke
- Status: [ ] Pending
- **🟢 GREEN:** 통합 surface §mobile-surface(AppPageHeader 우측액션·StatusCountGrid식 컴팩트·drill-in). 375px smoke + 감사 export 동작 + 모드 토글 + admin-gate 실측.
- **✋ Gate:** 모바일 정합, 컴플라이언스 동작 확인. Rollback: 모바일 스타일 revert.

## 8. Optional Addenda

### A. Workflow / Ontology Addendum
- 로그 surface = app overview/utility 성격(강 ontology 액션 최소). 감사 모드 = 규제 열람(읽기·export 중심).
- 안전은 **별 도메인** — 본 통합에서 제외(경계 보호).

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 감사 컴플라이언스 회귀(export/admin/Part11 손실) | Med | **High(규제)** | P1 sentinel 강제 보존 + P4 export smoke |
| **권한 비대칭 분기 누락**(비admin이 감사 모드 접근) | Med | **High(보안)** | 모드 토글 권한 게이트 sentinel + smoke |
| route 통합 → 구 링크 깨짐 | Med | Med | redirect 보존, sidebar 정리 |
| 모드별 모델 혼선(ActivityLog↔AuditLog 필드 차이) | Med | Med | 모드별 adapter 분리, 필드 매핑 명시 |

## 10. Rollback Strategy
- P1 실패: sentinel revert
- P2 실패: 활동/감사 분리 surface 복귀(통합 전 상태)
- P3 실패: sidebar 2항목 + 구 route 복귀
- P4 실패: 모바일 스타일 revert
- 데이터 비파괴(읽기 surface 통합만, AuditLog 무변경)

## 11. Progress Tracking
- Overall: 20% (P0 Truth Lock 완료)
- Current: P1(계약+sentinel RED) 진입 대기
- Phase Checklist: [x] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4

## 12. Notes & Learnings
- [2026-06-14] 통합 형태 = 단일 route + 활동/감사 모드토글(감사 stricter 보존). 호영님 승인. 안전은 별 도메인(통합 제외) — ontology 경계.
- [2026-06-14] **P0 핀 해소**: ① 활동로그 = 실 ActivityLog(`db.activityLog.*`) — 주석 "mock data 만"(line 45)은 §11.63 wiring 전 stale. mock 아님. ② DataAuditLog = CRUD 추적 endpoint(`/api/data-audit-logs`), UI 소비처 0 = orphan → 제외.
- [2026-06-14] **핵심 정정**: 활동·감사 = 서로 다른 실 모델(ActivityLog/ActivityType vs AuditLog/AuditEventType). 통합은 "한 모델 수렴"이 아니라 **단일 route + 모드토글, 각 모드가 자기 모델 읽기**. 데이터 병합·mock제거·migration 불요 = 위험 ↓. 단 **권한 비대칭**(활동=org멤버 / 감사=admin) → 모드 토글 권한 분기가 신규 핵심 리스크(보안).
