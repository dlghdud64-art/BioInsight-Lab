# Implementation Plan: §11.367 운영 브리핑 횡단 트리아지 재설계 (D-9)

- **Status:** ⏳ Pending
- **Started:** 2026-06-04
- **호영님 P1 (D-9, 2026-06-04). D-1·D-2(§11.364-1) 완료 후 진입.**

**CRITICAL**: phase 완료마다 체크박스·Last Updated / quality gate(Claude Code tsc·lint·test) / dead button·no-op·라우팅-only·placeholder success 금지 / §0 AI 정책(결정형·투명, "AI 판단/권장" 라벨 금지) / 미해소 충돌로 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 현 배포 + §11.364(D-1~D-6)·§11.366(D-8) 미푸시/푸시분.

**현 구조 (Phase 0 진단):**
- 운영 브리핑 popup = 카테고리 4카드(견적·발주·입고·재고, L89-92) → `viewMode "category"→"list"→inline` 3-tier drill-down.
- **⚠️ 결정적: popup triage source = `useOpsStore`(ops-console) = `seed-data.ts` 정적 mock**(L58/415-416). dashboard §11.362 priority = 실 stats API(severityRank). → **운영 브리핑이 mock 데이터 표시 = canonical truth 위반 + triage 불일치 근본.**
- amber 잔존(L92 재고=amber, L79 컬러바) = §11.302 위반 + D-2 미적용.

**Conflicts / 핵심 결정 (Phase 0 게이트):**
- triage source 2개: popup(mock ops-store) vs dashboard(실 stats §11.362). **단일화 방향 = popup을 실 canonical(stats API/§11.362 severityRank)로 재배선** 필요. 이게 D-9 #5의 본질 + 최대 scope.
- ⚠️ **scope 확장 경고**: D-9 지시는 "triage 단일화"지만 실제는 **mock→실데이터 재배선** = popup 데이터층 전면 개편(대형). 호영님 확인 필요.

**Chosen Source of Truth:** 실 stats API + §11.362 severityRank(canonical). ops-store mock은 popup에서 제거 대상.

**Environment:** 코드 편집·grep 가능 / ⚠️ tsc·vitest·build = Claude Code / DB 변경 0(조회 재배선만).

## 1. Priority Fit
- [x] P1 (호영님 D-9). 런칭 게이트 인접(triage 신뢰). D-1·D-2 선행 완료.
- 우선순위: D-2(완료) → D-1(완료) → **D-9(이 건)**.

## 2. Work Type
- [x] Design Consistency [x] Canonical(triage source 통합) [x] **데이터 재배선(mock→실)** [x] Workflow/Ontology(triage 정렬)
- same-canvas(popup 내 처리), 신규 페이지 0, 챗봇/생성형 NL 금지(§0).

## 3. Overview

**Feature:** 운영 브리핑을 카테고리 메뉴 → **전 도메인 횡단 단일 우선순위 큐**로. 각 줄=근거+인라인 액션(same-canvas). 정렬 결정형(결품>만료>SLA>승인). triage source를 dashboard와 단일화(실 canonical). 0건 패널 축소.

**Success Criteria:**
- [ ] 운영 브리핑 = 카테고리 카드 0, 횡단 우선순위 큐 1개(카테고리는 줄 태그).
- [ ] 각 줄 근거+실행 액션, 패널 내 처리(라우팅-only·no-op 0).
- [ ] 정렬 기준 코드 상수 명시·결정형(결품>만료 임박>SLA 지연>승인 대기), 안전·컴플라이언스 상단 고정. "AI 판단/권장" 라벨 0(§0).
- [ ] 상단 priority banner·브리핑 패널·바로가기 동일 triage source(숫자·항목 불일치 0).
- [ ] 0건 시 패널 축소 1줄("지금 처리할 운영 이슈 없음"). 빈 카테고리 4개 0.
- [ ] amber→yellow(§11.302).

**Out of Scope (⚠️):**
- [ ] 일일 스냅샷(어제 대비) — 데이터 축적 후 별건.
- [ ] "브리핑" 네이밍 변경 — 별도.
- [ ] 생성형 NL 브리핑/챗봇화(§0 B분류 금지).

**User-Facing Outcome:** 운영자가 한 패널에서 전 도메인 "지금 할 일"을 긴급도순으로 보고 즉시 처리.

## 4. Product Constraints
- Must Preserve: [ ] same-canvas [ ] canonical truth(실 stats) [ ] §11.362 severityRank 재사용 [ ] D-1 역할 분리
- Must Not: [ ] 카테고리 메뉴 회귀 [ ] 라우팅-only/no-op [ ] mock 데이터 표시 [ ] AI 판단 라벨 [ ] 생성형 NL
- **Canonical Truth Boundary:** Source=실 stats API + §11.362 priority. ops-store mock = popup에서 제거. Projection=triage 큐 표시.
- **UI Surface:** [ ] popup 패널 내 단일 큐(same-canvas), 인라인 expand 액션.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| triage source = 실 stats/§11.362 (mock 제거) | canonical 일치, 숫자 불일치 0 | popup 데이터층 재배선(대형) |
| 공통 triage 모듈 추출 | priority banner·패널·바로가기 단일 참조 | 신규 모듈 + 3곳 배선 |
| §11.362 severityRank 재사용 | 정렬 결정형 이미 구현 | 항목 단위(줄)로 확장 필요 |

**Touched:** `operational-brief/popup.tsx`(카테고리→큐, 데이터 source), `dashboard/page.tsx`(§11.362 priority 공유), 신규 공통 triage 모듈(`lib/triage/*` 가칭), inbox-adapter/ops-store(mock 제거 또는 분리).

## 6. Test Strategy
- sentinel: 카테고리 4카드 부재 / 인라인 액션 존재 / 정렬기준 상수 존재 / triage source 단일 참조 / amber 0 / AI 판단 라벨 0.
- source 단일화 = priority banner·패널·바로가기 숫자 일치 검증.
- ⚠️ 실행 = Claude Code.

## 7. Phases

### Phase 0: triage source 아키텍처 확정 (게이트)
- [ ] popup ops-store(mock) vs dashboard stats(실) 데이터 흐름 전수 진단.
- [ ] 단일화 방향 확정: 공통 triage 모듈(실 stats 소비) 추출 vs popup이 §11.362 priority 직접 소비.
- [ ] **scope 결정(호영님)**: mock→실 재배선 포함(권장, canonical) vs UI만(triage 불일치 잔존).
- [ ] §11.362 severityRank를 항목(줄) 단위로 확장 가능한지 확인.
- ✋ Gate: source 단일화 설계 확정, scope 합의. **Rollback:** planning-only.

### Phase 1: 공통 triage 모듈 (실 canonical)
- [ ] 🔴 sentinel: triage 모듈이 실 stats 기반 + severityRank 정렬.
- [ ] 🟢 `lib/triage`(가칭) — 실 stats(재고/만료/SLA/승인) → 횡단 우선순위 항목 배열(근거·액션·카테고리 태그·severityRank). 안전/컴플라이언스 상단 고정.
- [ ] 🔵 §11.362 severityRank 재사용.
- ✋ Gate: 정렬 결정형·투명(상수), mock 0, AI 라벨 0. **Rollback:** 모듈 삭제.

### Phase 2: popup 카테고리 → 단일 큐 UI
- [ ] 🔴 sentinel: 카테고리 4카드 부재, viewMode "category" 제거, 단일 큐.
- [ ] 🟢 popup 데이터 source ops-store(mock) → 공통 triage 모듈. 카테고리 4카드/3-tier 제거 → 횡단 단일 리스트(카테고리=줄 태그).
- [ ] 🔵 amber→yellow(§11.302).
- ✋ Gate: 카테고리 메뉴 0, mock 표시 0. **Rollback:** popup revert.

### Phase 3: 인라인 액션 (same-canvas, no-op 0)
- [ ] 🔴 sentinel: 각 줄 인라인 액션 존재, 라우팅-only 0.
- [ ] 🟢 각 줄 근거 + 인라인 액션 1개(예 "Trypsin 0 bottle(안전재고 8)·[재발주]"). 패널 내 처리(mutation/CTA wire). 카테고리로 던지고 끝 금지.
- ✋ Gate: no-op/dead-end 0, 액션 실동작. **Rollback:** 액션 wire revert.

### Phase 4: 정렬·0건·source 단일화 검증
- [ ] 🟢 정렬 결정형 최종(결품>만료>SLA>승인, 안전 상단). 0건 패널 축소 1줄. priority banner(상위 3줄)·패널(전체 큐)·바로가기(네비) 동일 source 검증.
- ✋ Gate: 숫자 불일치 0, 0건 축소, AI 라벨 0. **Rollback:** 항목 단위.

### Phase 5: Smoke / Rollback
- [ ] Claude Code tsc/lint/test/build → push → Chrome: 단일 큐·인라인 액션·숫자 일치·0건 축소.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| mock→실 재배선 = popup 전면 개편 | High | High | Phase 분리, 공통 모듈 우선, 단계 rollback |
| ops-store 다른 컴포넌트 의존 | Med | Med | Phase 0 의존 전수, popup만 분리 |
| triage 항목화 시 §11.362 banner 회귀 | Med | High | source 단일화 후 banner=상위 3줄 파생 |
| 인라인 액션 no-op | Med | High | Phase 3 실 mutation wire 강제 |

## 10. Rollback
- Phase 1 모듈 / Phase 2 popup UI / Phase 3 액션 wire — 각 독립.

## 11. Progress
- Overall 0% · Current: Phase 0 대기 · Next: triage source 아키텍처 + scope 확정(호영님).
- Checklist: [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4 [ ] P5

## 12. Notes

**Phase 0 act-wiring 3확정 (2026-06-04, 코드 정독 — 채팅 지시문 기능 관점):**
- **#1 카드 클릭 = 이동만(절반)**: 최종 액션 `router.push(item.entityRoute)`(popup L1100) + href 네비(L779-811). 패널 내 mutation 0. → D-9 #2 "라우팅-only 금지·패널 내 처리"와 충돌 = **act-wiring이 D-9 핵심 가치**(Phase 3). dead는 아님(이동 작동).
- **#2 집계 = mock(canonical 아님)**: popup `useOpsStore`=seed-data 정적. RCV/RFQ 실 ID는 seed 포맷(실처럼 보이는 mock). → Phase 1 실 canonical 재배선.
- **#3 메일 = 미연결**: popup vendor-requests 직접 호출 0. §11.348-SEND 인프라 존재하나 브리핑 미연결. → 발송 폐루프(브리핑→vendor-requests)는 Phase 3 인라인 액션의 선택 확장(reply-to §11.348-A 의존).

**종합:** 채팅 지시문(act-wiring 기능) + cowork 지시문(카테고리→큐 디자인) = 동일 작업으로 수렴. (mock+카테고리메뉴+이동만) → (실 canonical+횡단 큐+패널 내 act).

- triage 단일화 = mock→실 stats 재배선이 본질(대형). D-9 지시 표면보다 scope 큼 → Phase 0 게이트에서 호영님 scope 확정 필수.
- 순서(호영님): §11.361 #1(완료·배포) → §11.364 브리핑. 본의=브리핑 집계가 모듈별 canonical truth 사용 → Phase 1 공통 triage 모듈 + §11.362 severityRank 공유로 해소.
- D-1·D-2 = §11.364-1 완료. canonical 충돌 시 D-1 우선. amber sweep = D-2 잔재(popup) 흡수.
- 메일 발송 폐루프(#3) = §11.348-A reply-to 미완 의존 → 무리한 동시 진행 금지, Phase 3 선택 확장으로 분리.
