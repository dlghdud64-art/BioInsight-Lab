# Implementation Plan: 모바일 활동 로그 · 전역 드롭다운 개선 (§mobile-logs)

- **Status:** ⏳ Pending
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-21
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(핸드오프):** 기본 탭 하드코딩 금지 · 눌리지 않는 행 금지(행=딥링크) · 회색 채색 드롭다운 패널 금지 · 8개+/멀티 = 바텀 시트

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `모바일 활동 로그 핸드오프.md` (2026-07-21) — §0 진단 4 · §1 라우팅/메뉴 · §2 필터/시트/리스트 · §3 전역 드롭다운 토큰 · §4 QA 10항
- 프로토타입 `모바일 활동 로그 지시문.html` (1a·1b·1c·2a~2c)

**repo 실측 (2026-07-21, 1차):**
- **라우트 drift:** 핸드오프 `/logs` → 실제 **`/dashboard/audit`** = §log-consolidation 통합 host(1,196줄,
  활동/감사 모드 토글). `/dashboard/activity-logs` 는 전면 redirect stub(10줄)
- **진단 ① 근본 원인 확정:** audit L367 초기 모드 = "admin 은 감사, 그 외 활동" **하드코딩** + more-sheet
  "활동 로그" 가 redirect 경유 → admin 은 항상 감사 진입. 수정 = `?tab=` 파라미터 반영(하드코딩 제거)
- **진단 ② 실증:** more-sheet L82-83 활동/감사 2항목 병렬 노출
- **진단 ④ 실증:** `components/ui/select.tsx` trigger(L29)·content(L85) `bg-el` 회색 채색 —
  dropdown-menu/popover 는 bg-popover 흰색 정상 → **select 만 교정 = 최소 diff, 전 화면 파급(데스크톱 포함,
  핸드오프 "전역" 명시)**
- 기존 sentinel: `log-consolidation-p1.test.ts` (활동 보존 가드 통합 host 이동) — 회귀 경계
- 비admin 감사 접근 강등 메커니즘 실재(L376~) — 탭 노출 게이팅만 추가하면 정합

**Chosen Source of Truth:** 핸드오프 + 프로토타입. 라우팅은 통합 host 유지(§log-consolidation 존중 —
새 페이지 0), 탭 파라미터로 정합. <768px 경계 · 단 §3 드롭다운 토큰은 전역(데스크톱 포함, 핸드오프 명시).

**Environment Reality Check:**
- [x] main `5508035d` · baseline 130 file fail · F6/F9/F10 승계

## 1. Priority Fit
- [x] Post-release backlog #1 승계. **단 진단 ① = 실사용 라우팅 버그 — 트랙 내 최우선(P2 선행)**

## 2. Work Type
- [x] Feature · Bugfix(라우팅) · Mobile · Web · Design Consistency(전역 드롭다운)

## 3. Overview

**Success Criteria (핸드오프 §4 QA 10항 = 인수 기준):**
- [ ] 더보기 "활동 로그" → 활동 탭 진입(감사 진입 버그 해소) · 메뉴 하이라이트 = 실제 경로
- [ ] 더보기 = 활동 로그 1항목(`?tab=activity`) · 감사 추적 = 페이지 내 탭, 관리자만 노출
- [ ] 기본 탭 하드코딩 0 — `?tab=` 파라미터 그대로 반영
- [ ] 필터 한 줄(도메인 칩+구분선+기간·7일▾+담당자▾+⚙세부) 가로 스크롤+페이드 · 라벨 없는 "전체" 0
- [ ] 세부 시트 = 선택 도메인 타입만 · 칩 멀티 선택 + `필터 적용 · N개` · 활성 칩 ✕ 해제 + 배지
- [ ] 리스트 날짜 그룹(오늘/어제/날짜) + 도메인 이니셜 칩 + 행 탭 딥링크(눌리지 않는 행 0)
- [ ] 전역 select: 흰 패널+그림자(0 12px 32px rgba(15,23,42,.14))+44px 항목+선택 ✓(`#eff6ff`/`#1d4ed8`) · 회색 채색 패널 0
- [ ] 단일선택 ≤7 = 드롭다운(내부 스크롤 0) · 8+/멀티 = 바텀 시트
- [ ] 터치 44px+ · baseline-delta 0 · 데스크톱 로그 화면 회귀 0

**Out of Scope (⚠️):**
- [ ] 로그 데이터 모델/API 변경 · 새 페이지(통합 host 유지)
- [ ] dropdown-menu/popover 컴포넌트 변경(이미 흰 패널 — select 만)
- [ ] 감사 모드 권한 로직 변경(기존 강등 메커니즘 유지, 탭 노출 게이팅만)

## 4. Product Constraints
**Must Preserve:** §log-consolidation 통합 host 구조 · 기존 sentinel(log-consolidation-p1) · 비admin 강등 메커니즘 · 감사 GMP timestamp 표기
**Must Not Introduce:** page-per-feature 회귀(activity-logs 부활 금지) · dead link 딥링크 · 가짜 필터(적용 안 되는 칩)

**Canonical Truth Boundary:**
- Source of Truth: ActivityLog/AuditLog(모델 무접촉) · 현재 탭 = URL `?tab=` (state 아닌 URL)
- Derived Projection: 날짜 그룹 · 도메인 칩 필터 · 활성 필터 칩
- Persistence Path: 없음(읽기 전용)

**UI Surface Plan:** [x] Existing route section + [x] Bottom sheet(세부 필터) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 탭 = URL 파라미터(`?tab=`) 단일 소스 | 하드코딩 제거·딥링크/하이라이트 정합·버그 근본 해소 | 초기 모드 분기 로직 재작성 |
| 전역 토큰 = select.tsx 만 수정 | 진단 ④ 원인 지점 한정·최소 diff | 전 화면 시각 파급(스모크 범위 확대) |
| 모바일 필터/리스트 = §mobile-reports 패턴(md 분기) | 검증된 패턴 | audit 1,196줄 접촉 |

## 6. Global Test Strategy
- 정적 sentinel + F9 원문 + F10 build + `log-consolidation-p1` 전건 GREEN 유지 + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- audit/page.tsx 전독(모드 전환·필터·리스트·이벤트 타입 11종 매핑) · 프로토타입 1a/1b/1c/2a~2c 정독 ·
  딥링크 대상 라우트 실재 매핑(도메인별) · log-consolidation sentinel 어서션 경계 확정 ·
  select.tsx 소비처 파급 조사(bg-el 의존 화면)
- **✋ Gate:** 딥링크 매핑 전건 실재 확인 · sentinel 충돌 0 판정 · phase 재산정
- **Rollback:** 계획 단계 — 코드 0

### Phase 1: Contract & RED
- Status: [ ] Pending
- 🆕 `src/__tests__/regression/mobile-logs-p1.test.ts` — QA 10항 정적 어서션 + 회귀 블록(통합 host·강등
  메커니즘·log-consolidation 가드 보존)
- **✋ Gate:** RED 실증 · 기존 GREEN 유지
- **Rollback:** 테스트 revert

### Phase 2: 라우팅 · 메뉴 (1c — 버그픽스 선행)
- Status: [ ] Pending
- `?tab=` 파라미터 반영(초기 모드 하드코딩 제거) · more-sheet 활동 로그 1항목(`/dashboard/audit?tab=activity`)
  · 감사 탭 admin 게이팅 · 하이라이트 경로 정합
- **✋ Gate:** 활동 클릭→활동 탭 실증 · 비admin 탭 미노출 · 기존 감사 접근 무회귀
- **Rollback:** 라우팅/메뉴 revert

### Phase 3: 필터 한 줄 + 세부 시트 (1a/1b)
- Status: [ ] Pending
- **✋ Gate:** 라벨 없는 "전체" 0 · 시트 = 선택 도메인 타입만 · 적용/해제 실동작(가짜 필터 0)
- **Rollback:** 필터 섹션 revert

### Phase 4: 리스트 + 전역 select 토큰 (2a~2c)
- Status: [ ] Pending
- 날짜 그룹+이니셜 칩+행 딥링크 · select.tsx bg-el→흰 패널+그림자+44px+선택 ✓
- **✋ Gate:** 딥링크 dead link 0 · 전역 시각 파급 스모크 경로 문서화
- **Rollback:** 리스트 revert / select.tsx 단독 revert 가능(커밋 분리)

### Phase 5: 스모크 · 종결
- Status: [ ] Pending
- 프로덕션 스모크(QA 10항 + 전역 드롭다운 대표 화면 3곳 시각) · 롤백 문서화
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| log-consolidation sentinel 충돌 | Med | High | P0 어서션 경계 실측 → 충돌 시 진화 판정 상신(임의 진화 금지) |
| 전역 select 파급 — 전 화면 시각 회귀 | Med | Med | select.tsx 커밋 분리·대표 화면 스모크·단독 revert 경로 |
| 딥링크 대상 부재(dead link) | Med | High | P0 매핑 전건 실재 확인 · 대상 없는 도메인은 행 비링크 대신 상세 시트 판정 |
| 1,196줄 단일 파일 접촉 | Med | High | md 경계 엄수·기존 테스트 전건 |

## 9. Rollback Strategy
- P2/P3/P4 커밋 분리 revert. select.tsx = 별도 커밋(전역 파급 단독 롤백). 마이그레이션 0.

## 10. Notes & Learnings
- [2026-07-21] 계획서 생성 승인(호영님 "생성"). 라우트 drift(/logs→/dashboard/audit) · 진단 ①②④ 실증 완료.
