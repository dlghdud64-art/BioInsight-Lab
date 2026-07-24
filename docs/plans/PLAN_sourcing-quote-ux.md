# Implementation Plan: 소싱 견적 담기 인터랙션 · AI 비교 분석 리포트 (§sourcing-quote-ux)

- **Status:** ⏳ Pending (P0~P5)
- **Started:** 2026-07-24
- **Last Updated:** 2026-07-24
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(핸드오프):** front-only success 금지(서버 반영 확인 후 UI 확정) · 카운트 단일 소스(하단 바=레일=리포트) ·
  피드백의 주인공 = 목적지(견적함/비교함), 토스트 의존 금지 · 관문 전면 차단 금지(스펙 즉시+가격/납기만 잠금) ·
  리포트는 실행으로 이어짐(읽고 끝 금지) · `prefers-reduced-motion` 폴백 필수 · 플라잉 좌표 실측(하드코딩 금지)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `소싱 개선 핸드오프.md`(2026-07-24) — §1 담기 인터랙션(시퀀스 4단+토스트, ~600ms,
  베지어 명세) · §2 AI 리포트(1a 관문·1b 확정안) · §3 배선 규칙 · §4 스타일 토큰 표 · §5 QA 9항
- 프로토타입: `소싱 견적담기 애니메이션.dc.html`(동작 데모) · `소싱 AI 비교 리포트.dc.html`(1a·1b 확정안)

**Secondary References:**
- 이번 세션 실측 승계: `hooks/use-compare.ts` 실재 · `ai-insight-dialog-nullsafe.test.ts` 실재(AI 인사이트
  다이얼로그 계열 기존 존재 추정) · `_workbench/search-panel.tsx` 실재(f4fa09de 접촉)
- §global-filters 공용 컴포넌트·전역 select 토큰(기완료 — 무접촉 승계)

**Conflicts Found (P0 실측 대상 — 전부 "추정" 상태):**
- 라우트 drift 추정: 핸드오프 `/app/search` vs 실제 라우트(§mobile-logs 전례: `/logs`→`/dashboard/audit`)
- 담기 현 구현 미실측: 견적함 레일·배지·"화면 상단 중앙 대형 안내 박스"(제거 대상) 위치·현 토스트 구현
- AI 비교 리포트: 신설 vs 기존(ai-insight-dialog) 확장 — 미판별
- 담기 서버 반영: 현재 optimistic(front-only) 여부 미실측 — §3 위반이면 P4 가 버그픽스로 확대
- 회신 도착 자동 갱신 경로(폴링/invalidate/이벤트) 미실측

**Chosen Source of Truth:**
- 핸드오프 + 프로토타입 2종. 라우팅·구현 구조는 repo 실측 우선(P0 에서 drift 정정 후 계약 잠금).
- canonical: 견적 후보/비교 목록 = 서버 상태(담기·해제 = 서버 반영 후 확정). 애니메이션·칩·배지 = 파생 표시.

**Environment Reality Check:**
- [x] main HEAD(§global-filters 종결 40ace2a2 이후) · F9 격리/실 vitest · F10 build 가용
- [x] 프로덕션 스모크 경로: sandbox(Claude in Chrome, admin) — 애니메이션 런타임 검증 필수 트랙

## 1. Priority Fit
- [x] Post-release / UX 개선 — 비블로커. 단 §3 배선(front-only 금지·카운트 단일 소스)은 정직성
  클래스 — 현 구현이 optimistic 이면 해당 부분은 버그픽스로 우선 처리.

## 2. Work Type
- [x] Feature(인터랙션+리포트) · [x] Workflow Wiring(담기→견적 요청 플로우) · [x] Web ·
  [x] Design Consistency(토큰 표) · [ ] 모델/스키마 변경 0 전제(P0 검증)

## 3. Overview

**Feature Description:**
소싱 화면의 견적 담기/비교를 목적지 중심 마이크로 인터랙션(모프→플라잉 칩→배지 범프→레일 슬라이드,
토스트는 보조)으로 교체하고, AI 비교 분석 리포트에 관문 상태(1a: 스펙 즉시·가격/납기 잠금)와 데이터
상태(1b: 추천 요약·비교 표·리스크 노트·프리필 CTA)를 구현. 배선은 서버 확정·단일 소스·딥링크.

**Success Criteria (핸드오프 §5 QA 9항 = 인수 기준):**
- [ ] 담기: 모프(450ms 팝)→플라잉(550ms, 좌표 getBoundingClientRect 실측)→범프(1→1.45→1)→슬라이드 인
      시퀀스 + 토글 해제 · 비교는 보라(#6d28d9) 동일 문법
- [ ] 대형 안내 박스 제거 · 소형 pill 토스트 1.8s("견적 후보에 담았어요 · 가격은 견적 요청 후 확정")
- [ ] `prefers-reduced-motion`: 플라잉·범프 생략, 모프·카운트 상태 변화만
- [ ] 관문(가격 보유 < 2건): 스펙 비교(제조사·규격·분류) 즉시 표시 + 가격·납기 행만 🔒 "견적 후 확정" ·
      관문 스트립 1줄(사유+CTA `견적 요청 만들기 ›`+자동 갱신 약속) · 전면 차단 0
- [ ] 데이터 상태: 추천 요약 카드(배지+이유 1문장+핵심 수치 3) · 비교 표(추천 열 ★·우위 값만 #15803d) ·
      리스크 노트(yellow 토큰) · 신선도 표기 · 참고용 고지
- [ ] CTA `추천안으로 견적 요청 ›` → 견적 요청서 생성 플로우 딥링크(추천 품목·수량 프리필) — dead link 0
- [ ] 담기/해제·리포트 갱신 = 서버 반영 확인 후 UI 확정(front-only 0) · 회신 도착 시 리포트 자동 갱신
- [ ] 카운트 단일 소스: 하단 바 = 레일 = 리포트 · baseline-delta 0 · 접촉 sentinel GREEN 유지

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] AI 분석 로직/모델 변경(표시·관문·배선만 — 기존 분석 결과 소비)
- [ ] 견적 요청서 생성 플로우 자체 변경(딥링크 프리필 파라미터 전달만)
- [ ] 새 페이지(리포트는 same-canvas 오버레이/시트 — P0 에서 기존 surface 판별)
- [ ] 스키마/마이그레이션

**User-Facing Outcome:**
- 담기가 "어디로 갔는지" 눈에 보이고(목적지 피드백), AI 리포트가 가격 없어도 차단되지 않으며,
  추천이 바로 견적 요청 실행으로 이어짐.

## 4. Product Constraints

**Must Preserve:**
- [x] workbench/queue/rail/dock(견적함 레일 구조) · [x] same-canvas · [x] 기존 담기/비교 서버 계약 ·
- [x] §global-filters·전역 select 토큰 기완료분(무접촉)

**Must Not Introduce:**
- [x] front-only success(핵심 금지 — 애니메이션이 서버 확정을 앞지르는 fake 완료 금지: 시퀀스는
      시작하되 실패 시 롤백 상태 명시) · [x] 토스트 의존 피드백 · [x] page-per-feature ·
- [x] chatbot 재해석(AI 리포트 = 구조화 카드/표, 대화형 UI 금지)

**Canonical Truth Boundary:**
- Source of Truth: 견적 후보 목록·비교 목록·견적 회신(서버) — AI 분석 결과 포함
- Derived Projection: 버튼 모프 상태·플라잉 칩·배지 카운트·리포트 카드/표·신선도
- Persistence Path: 담기/해제 mutation → 서버 확인 → invalidate → 카운트/레일/리포트 동기
- 실패 경로: mutation 실패 시 모프 롤백 + 오류 표시(placeholder success 금지)

**UI Surface Plan:**
- [x] Existing route section(소싱 검색 결과·레일) + [x] 기존 리포트 surface 확장(P0 판별 —
      오버레이/시트/다이얼로그 중 기존 규약) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 애니메이션 = CSS transform+transition, 좌표 실측 | 핸드오프 명세·하드코딩 금지·성능 | JS 좌표 계산 코드 소폭 |
| 시퀀스 시작은 낙관, 확정은 서버 후 | 체감 즉시성 + front-only 금지 양립(실패 시 롤백) | 롤백 상태 구현 비용 |
| 리포트 = 기존 AI surface 확장 우선 | 신설 회피·same-canvas | 기존 구조 제약 수용(P0 판별) |
| 관문 = 행 단위 잠금(전면 차단 폐기) | 핸드오프 1a 명시 | 잠금/해제 행 상태 분기 |

**Dependencies:**
- Required Before: P0 실측(라우트·현 구현·서버 경로·리포트 surface)
- External Packages: 없음(신규 애니메이션 라이브러리 도입 금지 — CSS 우선)
- Touched(추정, P0 확정): 소싱 검색 결과 컴포넌트 · 견적함 레일 · use-compare · AI 리포트 surface ·
  견적 요청 생성 플로우(파라미터 수신부만)

**Integration Points:**
- 담기/해제 mutation + invalidate 체인 · AI 분석 결과 fetch · 견적 회신 도착 → 리포트 invalidate ·
  견적 요청서 생성 딥링크(프리필 파라미터)

## 6. Global Test Strategy
- 신규 `sourcing-quote-ux-p1.test.ts` — 정적 sentinel: 시퀀스 마커(모프 토글·flying 칩·범프·소형 토스트
  1.8s·대형 박스 부재-lock)·getBoundingClientRect 참조·reduced-motion 분기·관문 잠금 행·추천 카드/우위
  /리스크 토큰·CTA 프리필 파라미터·카운트 단일 소스 파생·서버 확정 후 상태 전이
- 한계 명시: 애니메이션 시퀀스·타이밍은 정적 계약으로 부분 검증만 — **P5 런타임 게이트가 최종**
- F9 원문 + F10 + 접촉 sentinel GREEN 유지(충돌 시 진화 판정 상신) + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- **🔴 RED:** §0 추정 5건 전부 실측 — ① 소싱 실제 라우트(drift 정정) ② 담기/비교 현 구현(버튼·레일·
  배지·대형 안내 박스 위치·현 토스트) ③ 담기 서버 반영 경로(optimistic 여부 — front-only 실재 시
  결함 등록) ④ AI 리포트 현존 surface(ai-insight-dialog 확장 vs 신설 판별 — 신설이면 surface 상신)
  ⑤ 회신 도착 자동 갱신 가용 경로(기존 invalidate/폴링)
- **🟢 GREEN:** 프로토타입 2종 스펙 잠금(토큰·시퀀스 ms·베지어 — 핸드오프 §4 표와 대조) ·
  프리필 딥링크 대상 플로우·파라미터 계약 확정 · 접촉 sentinel 경계 실측
- **🔵 REFACTOR:** 스코프 확정(AI 로직 무접촉·플로우 무변경 재확인)
- **✋ Gate:** 추정 5건 전부 실측 전환 · 수정 지점 파일·라인 명기 · 충돌/결함 발견 시 상신
- **Rollback:** planning-only

### Phase 1: Contract & RED
- Status: [ ] Pending
- 신규 `sourcing-quote-ux-p1.test.ts` — §6 계약(P2 인터랙션 · P3 리포트 · P4 배선 그룹) + 회귀 가드
  (기존 담기/비교 서버 계약·레일 구조·접촉 sentinel 무저촉)
- **✋ Gate:** RED 실증(그룹별 정확 계수) · 기존 전체 GREEN 유지
- **Rollback:** 테스트 revert

### Phase 2: 담기/비교 마이크로 인터랙션 (§1)
- Status: [ ] Pending
- 모프(450ms 팝 베지어)→플라잉 칩(550ms, 실측 좌표, 견적=#2563eb/비교=#6d28d9)→배지 범프+글로우→
  레일 슬라이드 인+CTA 활성 · 토글 해제 · 대형 안내 박스 제거 · 소형 pill 토스트 1.8s ·
  reduced-motion 폴백 · 실패 시 모프 롤백
- **✋ Gate:** F9 P2 계약 GREEN · 기존 담기/비교 기능 무회귀 · F10 EXIT 0 · 커밋 단독 revert
- **Rollback:** P2 커밋 revert

### Phase 3: AI 비교 분석 리포트 (§2 — 1a+1b)
- Status: [ ] Pending
- 1a 관문: 스펙 비교 즉시 + 가격·납기 행 🔒(bg #fafbfd·#94a3b8) + 관문 스트립(사유+CTA+자동 갱신 약속)
- 1b: 추천 요약 카드(#f5f9ff·보더 #2563eb)·비교 표(추천 ★·우위 #15803d)·리스크 노트(yellow)·
  신선도 헤더·참고용 푸터 고지 · CTA `추천안으로 견적 요청 ›`(P4 에서 배선)
- **✋ Gate:** F9 P3 계약 GREEN · 관문 전면 차단 0 · 기존 AI surface 회귀 0 · F10 EXIT 0
- **Rollback:** P3 커밋 revert

### Phase 4: 배선 (§3 — 정직성)
- Status: [ ] Pending
- 담기/해제 서버 확정 후 UI 확정(실패 롤백 경로 실증) · 카운트 단일 소스(하단 바=레일=리포트 동일 파생) ·
  CTA → 견적 요청서 생성 딥링크(추천 품목·수량 프리필 — dead link 0) · 회신 도착 시 리포트 자동
  갱신(P0 실측 경로 재사용)
- **✋ Gate:** F9 P4 계약 GREEN(front-only 가드 포함) · 프리필 파라미터 실전달 · F10 EXIT 0
- **Rollback:** P4 커밋 revert

### Phase 5: 스모크 · 종결
- Status: [ ] Pending
- sandbox 프로덕션 런타임: QA 9항 전건(시퀀스 육안+DOM·토글·reduced-motion 에뮬 가능 범위·관문/데이터
  상태·프리필 딥링크 착지·카운트 3면 일치·새로고침 후 담기 상태 persist)
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0 · 미검증 항목은 증거 등급 구분 기록
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Optional Addenda
- **A. Workflow(소싱→견적):** CTA = workflow route 상 strong contextual action(정당) ·
  프리필 = 요청서 플로우의 기존 파라미터 계약 재사용(신설 금지, P0 실측)

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 애니메이션 정적 검증 한계 | 확정 | Med | 마커 pin + P5 런타임 게이트 최종 · 증거 등급 구분 |
| 현 담기가 front-only(optimistic) | Med | High | P0 실측 — 실재 시 P4 를 버그픽스로 승격·우선 |
| AI 리포트 신설 필요 판정 | Med | Med | 기존 surface 확장 우선 · 신설 불가피 시 same-canvas 시트 상신 |
| 라우트 drift | Med | Low | P0 첫 작업 정정(§mobile-logs 관례) |
| 자동 갱신 경로 부재 | Med | Med | 기존 invalidate 재사용 · 부재 시 보수적 재조회(폴링 신설 금지 상신) |
| 접촉 sentinel 충돌 | Med | Med | 임의 진화 금지·판정 상신(관례) |

## 10. Rollback Strategy
- P2/P3/P4 커밋 분리 revert · 마이그레이션 0 · 애니메이션은 reduced-motion 경로가 사실상 기능 폴백.

## 11. Progress Tracking
- Overall: 0% · Current: P0 대기 · Next: P0 실측 5건
- [ ] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4 · [ ] P5

## 12. Notes & Learnings
- [2026-07-24] 계획 생성(호영님 "생성"). 핸드오프+프로토타입 2종 입력. 추정 5건은 P0 실측 전환 전까지
  단정 금지. front-only 실재 시 P4 정직성 배선을 버그픽스로 승격.
