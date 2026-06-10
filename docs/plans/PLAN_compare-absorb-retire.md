# PLAN — §11.31x #compare-absorb-retire — AI 비교 분석 흡수 후 compare 라우트 retire

> 호영님 결정: b2 (2026-06-10). 정정이 b2를 강화 — pre-quote 공백(이미지1 게이트)을
> 제품명·브랜드·카테고리가 메우고, 나머지 컬럼은 견적 유입 시 동일 데이터 경로로 자동 충전,
> 하이라이트는 동일 컴포넌트라 minimal-diff. 캐비엇(pre-quote 하이라이트 실효 낮음)은
> 동반비용 낮아 수용.

---

## 0. Truth Reconciliation

- **Canonical**: AI 비교 분석 = 소싱 "비교 검토" 단계(이미지1). 스펙 비교는 소싱 워크플로의
  한 단계이지 독립 페이지가 아님.
- **Stale**: compare 3라우트(`/compare` · `/app/compare` · `_workbench/compare`)는
  page-per-feature 잔재. 이미지2 로딩 오류 = 방치 증거.
- **Conflict 해소**: "live 링크 ~20개"는 canonical 신호 아님 → 흡수 전 역행 진입점으로 재분류.
- **✅ A0 lock 완료 (2026-06-10)**:
  - 소싱 "비교 검토" surface = `app/_workbench/_components/sourcing-result-review-workbench.tsx`
    (204줄). 현재 engine state 기반(triage·delta summary), `/api/products/compare` 미사용
    → 흡수 시 신규 wiring (compare와 동일 API, canonical truth 보존).
  - drawer 종속: `/api/sourcing/recommend` 유일 UI 소비처 = `sourcing-recommendation-drawer.tsx`
    (324줄). compare 제거 시 API 고아화. **호영님 결정: 보류 — Phase B 진입 전 재확인**
    (구출 vs API 동반 retire). compare 라우트 생존 동안은 고아 아님.
  - compare-analysis-drawer(1424줄)는 무관 — `/api/ai/compare-analysis`를 `_workbench/search`
    comparison-modal이 이미 소비, API 생존.
  - 스펙 데이터 경로 (정정보다 유리): pre-quote 충전 가능 컬럼 **5개**
    (제품명·브랜드·카테고리·규격/용량·Grade, 전부 catalog-borne, `/api/products/compare`).
    견적 충전 대상은 최저가·납기·공급사 수 3개뿐.
  - 하이라이트: 최저가(emerald)/최단납기(blue) 배지 로직 = `_workbench/compare/page.tsx` 내장
    → 동일 로직 이식, minimal-diff 확인.
  - 라우트 실체: `/app/compare` = 11줄 re-export(실체 `_workbench/compare/page.tsx` 1709줄),
    `/compare` = 별도 구형 페이지 1022줄. 제거 실체 2개 구현 + re-export 1개.

## 1. Priority Fit

- 추정 P2 / post-release (route contract cleanup 성격).
- 직전 트랙 catalog → 현재 P1 미확인, 단정하지 않음. P1 충돌 시 defer 제안 가능.

## 2. Work Type / Scope

- Workflow/Ontology Wiring + Feature(흡수) + Route contract cleanup.
- Scope: **medium (multi-surface)** — 소싱 surface + compare 3라우트 + 링크 ~20곳 + sentinel 6건.

## 3. Product Constraints 체크

- ✅ same-canvas: 스펙표·하이라이트를 기존 소싱 비교 검토 패널 내부에 흡수 (신규 페이지 0)
- ✅ canonical truth 보호: 스펙 데이터는 기존 데이터 경로 재사용, overlay store 신설 금지
- ✅ dead button / no-op 0: pre-quote 게이트 동안에도 3컬럼 실데이터 노출
- ❌ page-per-feature 회귀 금지: compare 독립 라우트 부활 금지
- ❌ chatbot / assistant 재해석 금지

---

## Phase A — 흡수 (소싱 비교 검토에 스펙표 + 하이라이트 이식)

### A0. Truth lock — ✅ 완료 (2026-06-10, §0 참조)
- surface 확정 / drawer 보류(B 이월) / 데이터 경로 5컬럼 확정

### A1. RED — sentinel 작성
- 소싱 surface 스펙표 sentinel: pre-quote 5컬럼(제품명·브랜드·카테고리·규격/용량·Grade) 노출 패턴
- 견적 유입 시 잔여 컬럼 충전 패턴
- diff 하이라이트 컴포넌트 wiring 패턴
- **회귀 0 블록**: 기존 소싱 비교 검토 state / handler / wiring / 라벨 보존 명시 매칭

### A2. GREEN — 구현
- 스펙표 컴포넌트 + 하이라이트를 비교 검토 패널 내부에 same-canvas 흡수
- 신규 페이지 / 라우트 / overlay store 생성 금지
- 모바일: §11.311 패턴 준수 (KPI 압축 · 터치 44px · first fold)

### A3. Wiring
- 견적 게이트 동안 객관 근거(5컬럼) 노출 — 이미지1 공백 메움
- 견적 유입 시 동일 데이터 경로 자동 충전 확인

### ✋ Gate A
- pre-quote 5컬럼 노출 확인
- dead button 0 / no-op 0
- same-canvas 유지 (라우트 변동 0)
- 기존 소싱 vitest 전체 green + 신규 sentinel green
- 375px 잘림/overflow 0

### ↩ Rollback A
- 소싱 surface 흡수분 git revert — compare 라우트 무손상 (A/B 독립)

### ✅ Phase A 완료 (2026-06-10)
- `e5d5c9d2` fix(workbench) §11.292 #sourcing-triage-baseline — §1-3 의도 반영 sentinel 갱신
- `0ea1b4f2` feat(sourcing) §11.381a #compare-absorb — 스펙표·하이라이트 same-canvas 흡수 (349 insertions)
- Gate A: vitest 31/31 green · pre-push `next build` 통과 · 호영님 push 완료
- rollback path: `0ea1b4f2` 단독 revert 가능 (292 baseline 커밋과 독립)

> **Phase A 단독 머지 가능** — 흡수만으로 사용자 가치 발생. 제거(B)는 후속 batch 분리 가능.
> 비가역 순서 강제: A 완료·검증 후에만 B 진입.

---

## Phase B — 제거 (compare 3라우트 retire + 재배선)

### B0. Truth lock + drawer 결정 게이트
- **✅ drawer 결정 (호영님 2026-06-10): 구출 — 소싱 이식.** B-pre 단계 신설:
  sourcing-recommendation-drawer 를 소싱 surface 로 이식 후 compare 제거.
  근거: §11.318 의도(과거 구매 기록 기반 추천) 보존 + 318c sentinel 갱신 비용 동일 + CTA 재활용.
- `app/app/*` flow tree(search→compare→quote) 구조 확정
- `compare-flow-guard` 경로 의존 확정

### B-pre. drawer 구출 (제거 전 이식 — RED→GREEN)
- 이식 지점 확정(소싱 결과/비교 검토 surface) → 318c sentinel 의도 반영 이전 → 이식 구현
- gate: drawer CTA(견적 요청) wiring 보존, dead button 0, compare 라우트 아직 무손상

### B1. RED — sentinel 작성
- 역행 링크 ~20곳 → 소싱 진입점 redirect sentinel
- compare 라우트 부재 검증 sentinel
- flow-guard 무깨짐 검증

### B2. GREEN — 구현
- **(가) 확정 (호영님 2026-06-10, 파일럿·외부 노출 0)**: redirect 없음.
  내부 링크 전수 재배선 + 라우트 삭제 (404 허용은 외부 기준, 내부 dead link 0)
- 4라우트 제거: `/compare` · `/compare/quote` · `/app/compare` · `_workbench/compare`(+_components 3파일)
- 재배선 매핑: `/app/compare`→`/app/search` (dashboard 3·reports 1·workbench/quote 3·flow-guard 1·
  app/step-nav·org-overview-hub) / inventory 2곳 `/compare?search=X`→`/app/search?q=X` /
  `/compare/quote/${id}`→`/quotes/${id}` (vendor/quotes·protocol-upload — 기존 dead link 교정) /
  quotes/[id] `/compare?sessionId=`→B2 구현 시 버튼 의도 확인 후 확정
- app/step-nav: compare step 제거 (search→quote 2단계 재구성)
- B0 발견 잔재 (스코프 밖, 기록만): `/test/*` 링크 다수·`_workbench/_components/step-nav.tsx`·
  `isFlowPath` /test 정규식 = 기존 latent-dead — 별도 cleanup batch 후보

### B3. Sentinel 정리 — 6건 의도 반영 갱신
- 252d2 · 252e · 251: `/app/compare` href lock → 소싱 진입점 lock 으로 이전
- 368 · 292b · 318c: compare `_components` 검증 → "소싱으로 이전됨" 검증으로 대체
- **무단 삭제 금지** — 갱신/이전만

### ✋ Gate B
- flow-guard 무깨짐
- 빌드 green (Vercel)
- dead link 0 / redirect 동작 확인
- sentinel 6건 갱신 green

### ↩ Rollback B
- 라우트·링크 git revert — Phase A 흡수분 독립 유지

### ✅ Phase B 구현 완료 (2026-06-10, push 대기)
- B-pre: `643d9b8d`+`b0388e23` (drawer 구출, push 완료)
- B1: 381c sentinel 17 tests (RED 14 → GREEN 17 확인)
- B2: 4라우트 실파일 7개 삭제 + 재배선 11파일 (dashboard·reports·inventory 2·
  vendor/quotes·protocol-upload·quotes/[id]·workbench/quote·flow-guard·
  org-overview-hub·app/step-nav) + 미사용 import 2건 정리
- B3: sentinel 10건 의도 반영 갱신 (252d2·252e·251·368qc·302d6d3·292b 재작성·
  ts-nocheck 재작성·318c C블록·381a·381b) — 무단 삭제 0, 전부 갱신/부재검증 전환
- quotes/[id] sessionId 배너: 정적 출처 배지로 전환 (dead link 0)
- baseline 추가 정합: 252e·251 은 §11.312-b/§1-3 의도 변경 미반영 stale 이었음 (B2 무관)

---

## 4. Key Risks

1. **sourcing-recommendation-drawer 종속** — compare 제거가 소싱 추천 기능을 깨뜨릴 수 있음.
   A0 우선 확정, 필요시 drawer 구출을 b2 스코프에 추가 (1줄 보고 게이트).
2. **flow tree 연쇄** — `app/app/{search,compare,quote}` + flow-guard. compare 단독 제거 시
   flow 깨짐 → redirect 필수.
3. **sentinel 6건 양방향** — 갱신/이전 원칙, 무단 삭제 금지.

## 5. Out of Scope

- 소싱 워크플로 자체 리팩토링 (비교 검토 패널 외 단계 무변경)
- catalog 데이터 모델 변경
- 신규 AI 분석 기능 추가 (기존 스펙표·하이라이트 이식만)

## 6. 운영 노트 (호영님 통제 구조)

- sandbox 작업 → present_files / inline patch 로 전달, 호영님 push 회신 후 다음 batch
- production DB 변경 없음 (route/UI 작업)
- commit: `feat(§11.31x) #compare-absorb-retire — ...` 컨벤션, Co-Authored-By 금지
