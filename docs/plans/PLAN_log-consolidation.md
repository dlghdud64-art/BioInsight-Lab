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

**Latest Truth Source (코드 근거):**
- **활동 로그** `apps/web/src/app/dashboard/activity-logs/page.tsx` (26KB) — 데이터: `/api/activity-logs` (useQuery `["activity-logs", activityTypeFilter, entityTypeFilter]`). 코드 노트 line 45: *"canonical truth (mock data 만 — 실제 audit fetcher 는 §11.63 그대로)"* → **활동 로그는 일부/전부 mock 가능성**(P0 정독 확정 필요).
- **감사 추적** `apps/web/src/app/dashboard/audit/page.tsx` (37KB) — 데이터: `/api/audit-logs` = Prisma **AuditLog** 실데이터(§11.81 wired), **관리자 전용**(line 301/360), **GMP Part 11** 타임존(line 213), **PDF 내보내기**(§11.89). = 컴플라이언스 등급.
- **안전 관리** `apps/web/src/app/dashboard/safety/page.tsx` — 화학물질/MSDS 도메인 대시보드. **통합 대상 아님(확정)**.
- sidebar(`_components/dashboard-sidebar.tsx` 152-153): "활동 로그" `/dashboard/activity-logs` + "감사 추적" `/dashboard/audit` = 인접 2 항목.
- 제3 API `/api/data-audit-logs` 존재 — **역할 미확인(P0)**.

**Conflicts Found:**
- 두 surface가 **다른 API·다른 데이터 소스·다른 등급**(활동=mock 가능 / 감사=실 AuditLog 컴플라이언스).
- "통합"의 형태 모호 — 단일 route 모드토글 vs 흡수.

**Chosen Source of Truth:**
- **AuditLog(Prisma) = 실 이력 SoT.** 통합은 **활동을 감사 인프라(실 AuditLog)로 수렴**(활동 mock 제거, §1-2⑤ 정직성). 감사 흡수(컴플라이언스 약화) 아님.
- **통합 형태 = 단일 로그 route + 모드 2개(활동/감사)** — 호영님 승인(2026-06-14). 감사 모드 stricter(admin-gate + 컴플라이언스 필터 + PDF export) 보존.

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
- [ ] 단일 로그 surface — 활동/감사 모드 토글, 모드별 필터/컬럼/권한 정합
- [ ] 감사 모드 컴플라이언스 보존: admin-gate · GMP Part 11 타임존 · PDF export
- [ ] 활동 모드 mock 제거 → 실 AuditLog 기반, 빈데이터 정직 empty(가짜 분포 0)
- [ ] sidebar 2항목 → 1항목(+감사 뷰), dead link 0, 구 route redirect
- [ ] 모바일 §mobile-surface(헤더 우측액션·컴팩트·drill-in), 375px smoke
- [ ] sentinel GREEN (감사 보존 회귀 0)

**Out of Scope (⚠️ 절대):**
- [ ] 안전(`/dashboard/safety`) 통합/흡수
- [ ] AuditLog 데이터 모델/이벤트 스키마 변경(P0에서 스키마 무변경 확정 — 변경 필요 시 별 트랙·dry-run 게이트)
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

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- **🔴 RED:** 활동로그 mock 여부 정독 확정 / `/api/data-audit-logs` 역할 / AuditLog 모델·이벤트 범위 / 두 surface 필터·컬럼·권한 차이 매핑.
- **🟢 GREEN:** 통합 형태 확정(단일 route 위치, 모드 토글 계약), 감사 보존 요건 목록 고정, 스키마 무변경 확인.
- **🔵 REFACTOR:** 범위 잠금(안전·스키마·권한완화 제외 재확인).
- **✋ Gate:** mock 여부·data-audit-logs 역할 확정, 충돌 0. Rollback: planning-only.

### Phase 1: Contract & Sentinel (RED)
- Status: [ ] Pending
- **🔴 RED:** 단일 로그 surface 계약 sentinel(활동/감사 모드 토글) + **회귀 0**(감사 admin-gate·Part11·PDF export 보존, 활동 mock 제거) — 구현 전 RED.
- **🟢 GREEN:** 계약 scaffolding 최소.
- **✋ Gate:** RED 진짜 실패, 기존 sentinel 무회귀. Rollback: sentinel revert.

### Phase 2: 단일 surface 구현
- Status: [ ] Pending
- **🟢 GREEN:** `/dashboard/audit` canonical 기반 활동/감사 모드 토글 흡수. activity-logs mock 제거 → 실 AuditLog. 모드별 필터/컬럼/권한 분기. empty 정직.
- **✋ Gate:** 감사 export/admin-gate/Part11 동작, dead button 0, empty 정직, sentinel GREEN. Rollback: 활동/감사 분리 surface 복귀.

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
| 활동 mock 제거 → 빈 surface 오해 | High | Low | empty 정직(가짜 분포 0), 카피 명확 |
| route 통합 → 구 링크 깨짐 | Med | Med | redirect 보존, sidebar 정리 |
| data-audit-logs 역할 미확인 | Med | Med | P0에서 확정 후 진행 |

## 10. Rollback Strategy
- P1 실패: sentinel revert
- P2 실패: 활동/감사 분리 surface 복귀(통합 전 상태)
- P3 실패: sidebar 2항목 + 구 route 복귀
- P4 실패: 모바일 스타일 revert
- 데이터 비파괴(읽기 surface 통합만, AuditLog 무변경)

## 11. Progress Tracking
- Overall: 0% (계획 생성)
- Current: P0 진입 대기
- Phase Checklist: [ ] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4

## 12. Notes & Learnings
- [2026-06-14] 통합 형태 = 단일 route + 활동/감사 모드토글(감사 stricter 보존). 호영님 승인. 안전은 별 도메인(통합 제외) — ontology 경계.
- [2026-06-14] 미확인 핀(P0 해소): 활동로그 mock 여부(코드 노트 line 45 "mock data 만"), `/api/data-audit-logs` 역할.
