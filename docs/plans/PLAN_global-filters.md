# Implementation Plan: 전역 필터 통일 — 툴바 인라인 필터 바 · 전 화면 이식 (§global-filters)

- **Status:** ⏳ Pending (P0~P5)
- **Started:** 2026-07-23
- **Last Updated:** 2026-07-23
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(호영님 확정):** 전 화면·전 뷰포트 필터 통일 · 세로 4단 필터 패널 금지 · 라벨 없는 "전체" 금지 ·
  단일선택 ≤7 = 드롭다운 / 8+·멀티 = 바텀 시트 · **필터 트리거는 공용 컴포넌트 — 화면별 중복 구현 금지**

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 확정 지시(2026-07-23): "필터 전역 바꾸는걸로 가자" + "모바일 아니고 웹도" = b(전 화면) + a(활동
  로그 데스크톱) 흡수, a = Phase 파일럿
- 기준 프로토타입 `전역 필터 셀렉트 개선.dc.html`:
  - **데스크톱 = 2a 툴바 인라인 필터 바** — 검색과 같은 행에 트리거 가로 배치, 라벨 병기(`카테고리 · 전체`),
    세로 4단 패널 금지, 활성 필터만 파란 강조, 활성 칩 행(적용 시만) + 결과 건수 + 초기화
  - **모바일 = 한 줄 칩 트리거 + 바텀 시트** (§mobile-logs 활동 로그 기구현 패턴)
  - 열린 드롭다운 = 전역 토큰(흰 패널·그림자 `0 12px 32px rgba(15,23,42,.14)`·44px 행·선택 ✓
    `#eff6ff`/`#1d4ed8`) — **select.tsx 기적용 완료**(§mobile-logs d6f8f55b·d51def34·f4fa09de,
    computed rgb 프로덕션 실증)
- 핸드오프 `모바일 활동 로그 핸드오프.md` §3(전역 토큰 표·사용 규칙)

**Secondary References:**
- §mobile-logs 세션 실측 스크린샷: reports 필터 = 세로 4단 팝오버(2a 위반 대표) · inventory 위치/상태
  팝오버 · audit 데스크톱 Select 2(라벨 없는 "전체" 위반)
- PLAN_mobile-logs.md · PLAN_reports-honesty.md (접촉 화면 최신 상태)

**Conflicts Found:**
- §mobile-logs P3 결정 "데스크톱 Select/멤버 칩 보존(회귀 0 원칙)" ↔ 본 트랙 — **의도적 폐기**
  (호영님 지시, 스코프가 '회귀 방지'에서 '전 뷰포트 통일'로 격상). PLAN_mobile-logs 는 기록 유지(무수정).
- 미확보 truth 1건: `전역 필터 셀렉트 개선.dc.html` 원본 파일 — P0 에서 operator 확보·스펙 대조.
  미확보 시 호영님 인용 스펙(§상단 2a 서술)을 잠정 계약으로 사용하고 원본 확보 시 대조 정정.

**Chosen Source of Truth:**
- 프로토타입 2a + 핸드오프 §3 + 기적용 select.tsx 토큰. 필터 상태의 canonical 은 각 화면 기존
  state/URL 파라미터 — 공용 컴포넌트는 **표시·트리거만 소유, 필터 로직/상태는 화면 소유 유지**.

**Environment Reality Check:**
- [x] main HEAD(§reports-honesty 종결 69bf18f3 이후) · F9 격리/실 vitest · F10 build 가용
- [x] 프로덕션 스모크 경로: sandbox(Claude in Chrome, admin)

## 1. Priority Fit
- [x] Post-release / Design Consistency — 비블로커. §mobile-logs 패턴 신선할 때 진행 효율 최대.
- 진행 중 P1 급 이슈 발생 시 화면 이식 단위로 중단 가능(phase 독립 rollback).

## 2. Work Type
- [x] Design Consistency · [x] Feature(공용 컴포넌트) · [x] Web + Mobile(반응형 분기) · [ ] 모델/API 변경 0

## 3. Overview

**Feature Description:**
전 대시보드 화면의 필터 UI 를 단일 패턴으로 통일 — 데스크톱 2a 툴바 인라인 필터 바, 모바일 칩 한 줄+
바텀 시트, 열린 패널은 전역 select 토큰. 공용 컴포넌트 추출로 화면별 중복 구현 제거.

**Success Criteria:**
- [ ] 공용 컴포넌트(FilterBar·FilterSheet 계열 ≤3개)로 전 대상 화면 이식 — 화면별 자체 필터 트리거 0
- [ ] 데스크톱: 검색 동일 행 인라인 트리거 · 라벨 병기(`카테고리 · 전체`) · 세로 다단 필터 패널 0 ·
      활성 필터만 파란 강조 · 활성 칩 행(적용 시만) + 결과 건수 + 초기화
- [ ] 모바일: 칩 한 줄 가로 스크롤 + 8+/멀티 바텀 시트(`필터 적용 · N개`) — 활동 로그 패턴 동일
- [ ] 라벨 없는 "전체" 전 화면 0 · 회색 채색 패널 0(기완료 토큰 승계) · 터치 44px+
- [ ] 각 화면 필터 실동작 무회귀(적용·해제·건수) · baseline-delta 0
- [ ] 이식 안 된 화면은 P5 백로그에 명시(silent 누락 0)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 필터 로직/서버 param 변경(표시 계층만 — canonical 필터 상태는 화면 소유)
- [ ] 검색 인풋 자체 리디자인 · 테이블/리스트 본문 변경
- [ ] admin/* 화면(운영자 내부 — 후속 판정) · 다크 패널(governance-dev) · disabled 컨트롤(settings 준비중)

**User-Facing Outcome:**
- 어느 화면이든 필터가 같은 위치·같은 문법·같은 패널로 동작 — 화면마다 다른 필터 UI 학습 비용 제거.

## 4. Product Constraints

**Must Preserve:**
- [x] 각 화면 필터 상태/URL 파라미터(canonical) · [x] same-canvas · [x] 기존 서버 param 계약
- [x] select.tsx 전역 토큰(§mobile-logs 완결분 — 재수정 금지)

**Must Not Introduce:**
- [x] page-per-feature · [x] 화면별 필터 트리거 중복 구현 · [x] dead button/가짜 필터
- [x] 공용 컴포넌트가 필터 로직/상태를 소유(표시·트리거만)

**Canonical Truth Boundary:**
- Source of Truth: 각 화면의 필터 state/URL 파라미터(무접촉)
- Derived Projection: 트리거 라벨(`카테고리 · 전체`)·활성 칩·건수
- Persistence Path: 없음(표시 계층)

**UI Surface Plan:**
- [x] Existing route section(각 화면 툴바 행 교체) + [x] Bottom sheet(모바일) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 공용 = 표시 계층만(controlled) | 화면별 필터 의미 특수성 수용·canonical 무접촉 | 화면별 wiring 코드 잔존(정당) |
| 공용 컴포넌트 ≤3개(트리거바·칩행·시트) | 과설계 방지 | 특수 케이스는 화면 로컬 조합 |
| 파일럿(활동 로그) → 게이트 → 확산 | 패턴 결함을 1화면에서 조기 발견 | 전체 완료까지 화면 간 일시 불일치(과도기 수용) |
| 화면별 커밋 분리 | 단독 revert 경로 | 커밋 수 증가(정당) |

**Dependencies:**
- Required Before: P0 인벤토리(대상 화면·예외 확정) · 프로토타입 원본
- Touched(예상): components/ui 신규 filter-*.tsx · audit·inventory·reports·quotes·purchase-orders 등
  page 레벨 툴바(P0 확정)

## 6. Global Test Strategy
- 신규 `global-filters-p1.test.ts` — 공용 컴포넌트 계약 + 화면별 이식 계약(이식 시 화면별 어서션 추가)
- 화면별 기존 sentinel GREEN 유지(F9) — 충돌 시 임의 진화 금지·판정 상신(§mobile-logs 관례)
- F10 build + 화면별 프로덕션 스모크(sandbox) + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- **🔴 RED:** 필터 보유 화면 전수 인벤토리 — 대시보드 전 라우트 실측: 화면별 {필터 목록, 단일/멀티,
  항목 수(≤7/8+), 현 트리거 유형(Select/팝오버/자체), 서버/클라 필터 여부, 기존 sentinel 접촉}
  → **화면별 판정표**(드롭다운/바텀시트/예외·제외)
- **🟢 GREEN:** 프로토타입 원본 확보·2a 스펙 잠금(토큰·구조·상태) · 공용 컴포넌트 3개 인터페이스 초안
  (controlled props — 화면 상태 주입형)
- **🔵 REFACTOR:** 제외 확정(admin·다크·disabled) · 특수 케이스(기간 프리셋·예산 등) 예외 규칙 1줄씩
- **✋ Gate:** 인벤토리 전수(누락 0 — 라우트 목록 대조) · 예외 판정 근거 명기 · 스펙 충돌 0
- **Rollback:** planning-only

### Phase 1: Contract & RED
- Status: [ ] Pending
- 신규 `global-filters-p1.test.ts` — 공용 컴포넌트 실재·토큰 소비·화면별 중복 트리거 금지 가드 +
  파일럿(활동 로그 데스크톱) 이식 계약 RED
- **✋ Gate:** RED 실증(정확 계수) · 기존 전체 GREEN 유지
- **Rollback:** 테스트 revert

### Phase 2: 공용 컴포넌트 + 활동 로그 파일럿(=a 흡수)
- Status: [ ] Pending
- 공용 filter-bar(데스크톱 인라인)·filter-chip-row(모바일)·filter-sheet(바텀 시트) 구현(표시 계층,
  select.tsx 토큰 소비) · audit 데스크톱 Select 2 → 인라인 필터 바 교체(모바일 칩행은 공용으로 치환)
- **✋ Gate:** F9 파일럿 계약 GREEN · audit 접촉 sentinel 전체 GREEN(mobile-logs-p1 30 포함 — 충돌 시
  상신) · F10 EXIT 0 · **배포 후 sandbox 런타임 패턴 검증 통과 전 P3 진행 금지**
- **Rollback:** 파일럿 커밋 단독 revert(공용 컴포넌트는 미사용 상태로 무해)

### Phase 3: 재고·리포트 이식
- Status: [ ] Pending
- inventory 위치/상태 팝오버 → 인라인 바 · reports 4단 팝오버 폐기(2a 위반 대표) → 인라인 바 ·
  화면별 커밋 분리
- **✋ Gate:** 화면별 F9(mobile-reports-p1·purchase.contract 등 GREEN) · F10 · sandbox 스모크
- **Rollback:** 화면별 커밋 revert

### Phase 4: 발주·견적 + 잔여 화면 이식
- Status: [ ] Pending
- P0 인벤토리 확정 순서대로(발주·견적 우선, 잔여는 판정표 기준) · 화면별 커밋 분리
- **✋ Gate:** 화면별 F9·F10·스모크 — P3 동일
- **Rollback:** 화면별 커밋 revert

### Phase 5: 전역 스모크 · 종결
- Status: [ ] Pending
- 전 이식 화면 판정표(데스크톱+모바일) · 라벨 없는 "전체" 전 화면 0 확인 · 미이식 화면 백로그 명시
- **✋ Gate:** 판정표 전건 · baseline-delta 0 · build EXIT 0 · 백로그 silent 누락 0
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 화면별 필터 의미 특수성(기간 프리셋·예산·날짜범위) | High | Med | P0 예외 판정표 — 1:1 이식 불가는 로컬 조합 허용(공용 토큰만 강제) |
| 기존 sentinel 대량 접촉 | High | Med | 화면별 커밋 분리 · 충돌 시 진화 판정 상신(임의 진화 금지) |
| 공용 컴포넌트 과설계 | Med | Med | ≤3개 · 표시 계층 한정 · 파일럿 게이트에서 API 동결 |
| 과도기 화면 간 불일치 | 확정 | Low | phase 순서 공지·P5 백로그 명시로 수용 |
| 프로토타입 원본 미확보 | Med | Low | 호영님 인용 스펙 잠정 계약 → 원본 확보 시 대조 정정 |

## 9. Rollback Strategy
- 화면별/phase별 커밋 분리 revert. 공용 컴포넌트는 additive(미사용 시 무해). 마이그레이션 0.

## 10. Progress Tracking
- Overall: 0% · Current: P0 대기 · Next: P0 인벤토리 착수
- [ ] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4 · [ ] P5

## 11. Notes & Learnings
- [2026-07-23] 계획 생성(호영님 "생성"). b(전 화면) + a(활동 로그 데스크톱, 파일럿 흡수) 확정.
  §mobile-logs "데스크톱 Select 보존" 결정 의도적 폐기 기록. 전역 select 토큰은 기완료분 승계(재수정 금지).
