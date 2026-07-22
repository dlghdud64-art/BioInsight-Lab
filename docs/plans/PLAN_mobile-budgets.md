# Implementation Plan: 모바일 예산 관리 · 지출 분석 개선 (§mobile-budgets)

- **Status:** 🚧 P1–P4 Complete (2026-07-21 · 코드 `e2c195f4`) — P5 프로덕션 스모크만 잔여
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-21
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(핸드오프 §4):** 웹 기능 삭제 0 — 표현만 접힘/요약, 값·설정은 웹과 단일 소스 · 초록 대형 CTA 금지(초록=완료 표시만)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `모바일 예산·지출 분석 핸드오프.md` (2026-07-21) — §1 7a · §2 7b · §3 8a · §4 패리티 표(인수 기준) · §5 토큰 · §6 QA 10항
- 프로토타입 `모바일 예산·지출 분석 지시문.html` (7a·7b·8a)

**repo 실측 (2026-07-21, 1차):**
- **라우트 drift 정정:** 핸드오프 `/dashboard/budgets` → 실제 **`/dashboard/budget`**(page.tsx 955줄) ·
  `/dashboard/spend-analysis` → 실제 **`/dashboard/analytics`**(page.tsx 1481줄, 타이틀 "지출 분석")
- 예산 관리: KPI 3종(즉시 확인 L321·차단 위험 L330·승인 대기 L339)·예산 0건 온보딩 히어로(L650~)·
  등록 Dialog(L297) 기존 실재. 지출 분석: 활성화 3단계(L383 "canonical derive — 하드코딩 금지")·탭 구조 실재
- → 핸드오프 요구 = 기존 canonical 파생 **재배치/요약**(§mobile-reports 와 동일 패턴). 신규 파생 규칙 0 목표

**Chosen Source of Truth:** 핸드오프 md + 프로토타입. 적용 경계 = viewport <768px(`md:`), 데스크톱 회귀 0.
§4 웹 기능 패리티 표 = 인수 기준(기능 삭제 0).

**미확인(P0 판정 대상):**
- [ ] 7b 경고 임계(70/90%)·초과 발주 차단 토글의 **저장 필드 실재 여부**(Budget/BudgetPool 모델·API) —
  부재 시 schema+API 확장 = scope 상향, 호영님 별도 승인
- [ ] 등록 즉시 양 화면 동기화 — budget/analytics 페이지의 react-query queryKey 규약 실측
- [ ] 진입점 3곳(budget 헤더·7a 배너·8a 단계 카드)의 현행 배선(기존 Dialog 재사용 vs 신규 시트)

**Environment Reality Check:**
- [x] main `0578e3ac` (§mobile-reports 종결 직후) · baseline 130 file fail · F6/F9/F10 승계

## 1. Priority Fit
- [x] Post-release — backlog #1 (§mobile-reports 종결 승계, 호영님 직접 지시. 현 P1 충돌 없음)

## 2. Work Type
- [x] Feature · Mobile · Web · Design Consistency (2라우트 + 공용 시트 멀티 surface)

## 3. Overview

**Success Criteria (핸드오프 §6 QA 10항 = 인수 기준):**
- [ ] 예산 관리: 0건 = 초록 한 줄 요약("예산 상태 정상 · 0/0/0" + 상세 ›), 1건+ = 해당 항목만 카드 승격
- [ ] 온보딩 배너(중형): 라벨+제목 15px+설명 1줄+CTA 2개, 문구 잘림 0
- [ ] 거대 점선 빈 박스 금지 — 접힌 행 2(카테고리별 지출·예산 풀별 소진율), 데이터 시 제자리 확장
- [ ] 진입점 3곳 전부 7b 시트 하나로 연결
- [ ] 7b: 분기 세그먼트 + 실제 날짜 표기 · 임계 구간 시각화(~70/70–90/90+) · 차단 토글 · CTA `예산 풀 등록`
- [ ] 등록 즉시 양 화면 동시 갱신(배너 dismiss / 활성화 2/3) — 임계값 단일 소스
- [ ] 지출 분석: 배너·체크리스트 중복 0(단일 카드, 진행 1/3+점+단계 3줄), CTA 1개(현재 단계만)
- [ ] 초록 대형 CTA 0 (초록 = 완료 표시만) · 탭 칩 페이드 힌트
- [ ] §4 패리티 표 전 항목 충족(웹 기능 삭제 0) · 터치 44px+ · baseline-delta 0 · 데스크톱 회귀 0

**Out of Scope (⚠️):**
- [ ] 데스크톱(≥768px) 레이아웃 변경 · 예산 승인 플로우 로직 변경
- [ ] 활성화 3단계 파생 규칙 변경(기존 canonical derive 소비만)
- [ ] 임계/차단 저장 필드 신설(P0 판정 전 금지 — 부재 확인 시 별도 승인 안건)

## 4. Product Constraints
**Must Preserve:** same-canvas(시트=bottom sheet, 새 페이지 0) · canonical truth(임계값·활성화 단계 단일 소스) · 기존 등록 API 계약
**Must Not Introduce:** page-per-feature · 가짜 진행률/고정 카운트 · 초록 대형 CTA · stale 온보딩 배너(등록 후 잔존)

**Canonical Truth Boundary:**
- Source of Truth: Budget(pool) 모델 — 한도·기간·임계·차단 설정 / 활성화 단계 = 기존 derive
- Derived Projection: KPI 요약/카드 승격 · 배너 노출 여부 · 진행 1/3 · 임계 구간 시각화
- Persistence Path: 7b 등록 mutation → 기존 budget API(P0 실측) → invalidation 으로 양 화면 갱신

**UI Surface Plan:** [x] Existing route section + [x] Bottom sheet(7b 공용) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 7b = 공용 시트 컴포넌트 1개, 진입점 3곳 prop 배선 | 진입점별 중복 구현 방지·임계 단일 소스 | 시트 상태 끌어올림 필요 |
| 양 화면 동기화 = react-query invalidation(prefix 규약) | §bottom-nav-badge 학습 재사용 — 추가 배선 최소 | queryKey 규약 P0 실측 필요 |
| 모바일 뷰 = §mobile-reports 패턴(md 경계 분기 + 전용 컴포넌트) | 검증된 패턴·데스크톱 무접촉 | 파일 추가 |

## 6. Global Test Strategy
- 정적 sentinel + F9 원문 + F10 build + 기존 budget/analytics 관련 테스트 전건 + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-21)
- Status: [x] Complete

**실측 결과:**
- 저장 소스: `/api/budgets` = `db.budget`(Budget 모델). **Budget 에 임계·차단 필드 0.**
  임계 3필드(warningPercent 70 · softLimitPercent 90 · hardStopPercent 100)+`controlRules` 는
  **CategoryBudget 에만 실재**(카테고리 단위 · 게이트 = `lib/budget/category-budget-gate.ts` ·
  프론트 UI 사용처 0 — API만). → 7b 임계 구간 시각화 = **저장 없는 규약 안내**(70/90/100,
  CategoryBudget 규약과 동일 수치 표기 — 이원화 0)로 처리 가능
- **차단 토글 = 저장처 부재** → 판정 상신(아래 확정 판정 참조)
- 활성화 3단계 = analytics L383 canonical derive(② 예산 등록 done = budget.total>0) —
  7b 등록 성공 → `["analytics-dashboard"]` invalidate 로 2/3 자동 전환(규칙 재사용, 신설 0)
- 동기화 규약: budget 페이지 = 수동 fetch(자체 reload 콜백) · analytics = react-query
  `["analytics-dashboard"]`. 7b onSuccess = 호출측 reload 콜백 + invalidateQueries 병행
- 진입점 3곳 현행: ① budget 헤더 `예산 등록` Dialog(L288, BudgetForm) ② 7a EmptyState CTA(L483 →
  같은 Dialog) ③ 8a 단계 카드 = `/dashboard/budget` **페이지 이동**(시트 교체 대상)
- 제거 대상 실증: 초록 대형 CTA(analytics L707 `bg-emerald-600 h-11`) · 배너(L695)+체크리스트
  카드(L722) 중복
- **확정 판정(호영님 2026-07-21): 차단 토글 = (a) v1 제외** — 저장처 없는 토글은 no-op 금지 원칙
  위반이라 시트에서 제외, 임계 구간 시각화만. Budget 스키마 확장(blockOverspend)은 별도 트랙 후보
- **✋ Gate:** [x] 임계/차단 소스 확정 [x] 마이그레이션 0 확정(rollback 단순) [x] phase 유지

### Phase 1: Contract & RED — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 🆕 `src/__tests__/regression/mobile-budgets-p1.test.ts` — QA 10항 정적 어서션 + 패리티/회귀 블록
- **✋ Gate:** [x] RED 실증 → 구현 후 16/16 GREEN · [x] 기존 GREEN 유지
- **Rollback:** 테스트 revert

### Phase 2: 7b 등록 시트 + 진입점 3곳 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 비고: 7b 저장 = 기존 `POST /api/budgets` 무변경(name·amount·currency·periodStart·periodEnd·description, 신규 필드 0·마이그레이션 0) · 임계(70/90/100) = 표시 전용 규약(저장 0, CategoryBudget 수치와 동일 표기·이원화 0) · 차단 토글 = v1 제외(호영님 P0 판정, 저장처 부재) · budget 페이지 EOL 혼재 → LF 정규화 포함.
- **✋ Gate:** [x] 등록 mutation 실배선(no-op 0) · [x] 양 화면 invalidation 실증 · [x] 임계 단일 소스
- **Rollback:** 시트+배선 revert

### Phase 3: 7a 예산 관리 모바일 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- **✋ Gate:** [x] 0건 요약↔카드 승격 분기 정직 · [x] 배너 잘림 0 · [x] 데스크톱 무변경
- **Rollback:** budget 모바일 섹션 revert

### Phase 4: 8a 지출 분석 모바일 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- **게이트 종합:** P1 16/16 · baseline-delta 0 · build EXIT 0. 배포 대기(코드 `e2c195f4`).
- **✋ Gate:** [x] 중복 카드 0 · [x] CTA 1 · [x] 초록 대형 CTA 0 · [x] 데스크톱 무변경
- **Rollback:** analytics 모바일 섹션 revert

### Phase 5: 스모크 · 종결
- Status: [ ] Pending
- 프로덕션 스모크(직전 트랙 방식 — Chrome 500px + 실기기 375px 잔여 명기) · QA 10항 · 롤백 문서화
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0
- **Rollback:** phase별 커밋 revert(데이터/마이그레이션 없음 전제 — P0 판정 후 확정)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 임계/차단 저장 필드 부재 → schema/API 확장 | Med | High | P0 실측 → 부재 시 별도 승인·트랙 분리 |
| 2,436줄 2페이지 접촉 — 데스크톱 회귀 | Med | High | md 경계 엄수·기존 테스트 전건·스냅샷 |
| 등록→양 화면 동기화 누락(stale 배너) | Med | Med | invalidation prefix 규약 + P1 sentinel 강제 |
| 활성화 단계 파생 중복 구현 | Low | Med | 기존 canonical derive 소비만(P1 금지 어서션) |

## 9. Rollback Strategy
- Phase 2~4 커밋 분리 revert. 전체 = 코드 커밋 revert. (마이그레이션 유무 P0 후 확정)

## 10. Notes & Learnings
- [2026-07-21] 계획서 생성 승인(호영님 "생성"). 라우트 drift 2건(budgets→budget · spend-analysis→analytics) 정정 기록.
