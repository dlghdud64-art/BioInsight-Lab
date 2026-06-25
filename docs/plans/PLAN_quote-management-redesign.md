# Implementation Plan: 견적 관리 리디자인 (quote 시안 정합)

- **Status:** ⏳ Pending
- **Started:** 2026-06-24
- **Last Updated:** 2026-06-24
- **시안:** uploads/시안-90a5ef15.html · quote-app.jsx(로직 정본) · quote.css · README-f8d594e9.md (호영님 2026-06-24, hifi)

**CRITICAL INSTRUCTIONS**: 각 phase 후 1.✅체크 2.🧪operator vitest+`npm run build` 3.⚠️gate 4.📅날짜 5.📝Notes 6.➡️다음. ⛔ gate 실패·dead button/no-op/placeholder success·가짜 핸드오프·page-per-feature 금지. labaxis-ui-wizard 정합(same-canvas·stateful·action-wired).

---

## 0. Truth Reconciliation
**시안(README):** 견적 관리 hifi 리디자인 — 퍼널 5단계·AI 액션·발송/비교/스캔 모달·우선순위 파생·발송 인텐트 모달·일괄 바·마감열 제거. 레포 패턴으로 1:1 이식(rebuild 아님).
**현 레포(`app/dashboard/quotes/page.tsx`, 267KB):** 호영님 "일부 구현됨" — **이미 존재**: `computePriority` 가중합 파생(§quote-management P4)·우선 추천 카드(L2243)·퍼널+단계클릭(L2334)·빠른필터 마감임박/높음/회신정체(L942)·배치바 리마인더/상태변경(L2316)·공급사 실명 아바타·브리핑 레일·다축 필터 popover·테이블/카드·VendorRequestModal(발송)·비교 모달.

**시안 실 diff(미구현/변경):**
1. 마감(dueDate) 열 **제거**(우선순위 중심) — 현 dueDate 컬럼 존재(COLUMN key/label/order L321·351·361).
2. stage 라벨 **"요청 발송 전" → "발송 대기"** 통일(L134·191, 퍼널 정합).
3. **발송 확인(인텐트) 모달 신규** — 행 "발송"→케이스 요약+"아직 발송 안됨"→"발송 검토 계속"→VendorRequestModal(오발송 방지). 현재 미존재.
4. **우선순위 칩 클릭 지정**(high↔mid↔low 순환 + 상단 재정렬) — 현 computePriority 파생 read-only.
5. AI 액션/우선 추천 카드 **navy gradient**(대시보드 "다음 단계 추천" 통일) + 퍼널 5단계(발송→회신→비교→승인→입고준비) 라벨/구성 정합.

**Chosen Source of Truth:** 시안=호영님 확정. **우선순위 클릭 = 세션 override(prioMap, DB 저장 0, 새로고침 시 computePriority 파생 복귀)** — README "저장 말고 파생" 원칙 유지(호영님 결정 2026-06-24).
**Prereq:** quote.css=프로토타입(레포 Tailwind/shadcn) → 토큰만. 시안 A/B/C·데이터 토글=데모용 제외.

## 1. Priority Fit
- [x] Post-release UX 리디자인(호영님 시안 시리즈 2번 — 견적관리). blocker 아님.

## 2. Work Type
- [x] Web · [x] Design Consistency · [x] Workflow/Ontology(발송 인텐트·우선순위)

## 3. Overview
**Feature:** 견적 관리를 quote 시안에 정합 — 마감열 제거·발송대기 라벨·발송 인텐트 모달·우선순위 클릭(세션)·AI 카드 navy·퍼널 5단계. 발주 off 유지(입고준비 단계).

**Success Criteria:**
- [ ] 마감(dueDate) 열 제거(우선순위 중심) — computePriority.dd는 빠른필터/정렬용 파생 보존, 컬럼만 제거
- [ ] stage chip "요청 발송 전" → "발송 대기"(퍼널·테이블 통일)
- [ ] 발송 인텐트 모달: 행 "발송" → 확인(케이스·공급사후보·마감 + "아직 발송 안됨") → "발송 검토 계속" → VendorRequestModal. dead button 0
- [ ] 우선순위 칩 클릭(high↔mid↔low 순환) + 상단 재정렬 — **세션 override(DB 0, 새로고침 복귀)**, computePriority 파생 기본
- [ ] AI 우선 추천 카드 navy gradient(대시보드 통일) + 퍼널 5단계 정합
- [ ] honesty: 룰베이스를 "AI"로 과대표기 0(가드② — 기존 "우선 추천" 라벨 유지)·가짜 0·발주 off getFlag 보존

**Out of Scope (⚠️):**
- [ ] 우선순위 DB 영구 저장(manualPriority 필드 — 별도 DB 트랙)
- [ ] 스캔 모달 신규 구현(현 견적서 스캔 동선 유지 — 별도 평가)
- [ ] ENABLE_PURCHASING on 분기 변경
- [ ] quote.css 클래스 복붙

## 4. Product Constraints
**Must Preserve:** [x] same-canvas(workbench/rail) · [x] canonical(computePriority 파생·vendorRequests) · [x] VendorRequestModal(실 발송, §quote-dispatch-real-send) · [x] getFlag 발주 분기
**Must Not Introduce:** [x] page-per-feature · [x] dead button/no-op · [x] 가짜 핸드오프/AI 과대표기 · [x] 우선순위 가짜 저장

## 5. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 마감열 제거(dd 파생 보존) | 시안 우선순위 중심 | dueDate 컬럼 sentinel 다수 진화 |
| 발송 인텐트 모달 = VendorRequestModal 앞단 | 오발송 방지(시안) | 행 발송 흐름 2-step |
| 우선순위 세션 override(prioMap) | README 파생 원칙 + 클릭 UX 양립 | 새로고침 복귀(영구 X — 의도) |
| AI 카드 navy = 대시보드 토큰 재사용 | 시각 통일 | 기존 추천 카드 색 진화 |

## 6. Test Strategy
- sentinel: 마감열 부재·발송대기 라벨·발송 인텐트 모달 wiring·우선순위 override(세션)·navy 카드. 각 phase GREEN 동반(delta-0). dueDate/stage-label/priority sentinel 진화는 보호의도(파생·canonical) 보존.

## 7. Phases

#### Phase 0: Truth Lock ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**sentinel 맵(전수 grep):**
- **마감(dueDate) 열 제거 = 최대 blast radius**: 전용 `quote-table-due-date-column.test.ts`(컬럼 존재 핀 → P1서 retire/진화) + `quote-table-column-prefs`·`quote-table-price-delivery-parity`·`quote-table-sian-realign`·`quote-card-batch3-price-delivery`(dueDate/마감 컬럼 참조 → 진화). dd 파생(computePriority.dd)은 빠른필터/정렬에 보존(컬럼만 제거).
- **stage 라벨 "요청 발송 전"→"발송 대기"**: page.tsx L134(STATUS map)·L191(badge)·L2503(aria) + 다수 sentinel(dashboard-mobile 등) — P1서 소스 문자열 정합 진화.
- **이미 구현(진화 최소)**: computePriority·우선 추천 카드·퍼널·배치바·VendorRequestModal·아바타·필터 — 무변경 또는 시각만.
- **신규(진화 적음)**: 발송 인텐트 모달(P2 신규 컴포넌트)·우선순위 세션 override(P3 신규 state).

**Phase 위험순:** P1(마감열·라벨, sentinel 多) > P4(navy/funnel 시각) > P2(인텐트 모달 신규) > P3(override 신규).
**✋ Gate:** ✅ 5 diff 확정·sentinel 맵(dueDate 5개·stage label 다수)·이미 구현분 분리. **Rollback:** planning-only.

#### Phase 1: 마감열 제거 + "발송 대기" 라벨 통일 (P1a 완료 / P1b 잔여)
- Status: 🔄 P1a 완료(2026-06-24) / P1b 잔여

**blast radius 축소 위해 분리.**

**P1a — stage 라벨 "요청 발송 전" → "발송 대기" ✅ COMPLETE (2026-06-24):**
- page.tsx OP_STATUS `요청_접수` label(L134) + signals badge(L191) "요청 발송 전" → "발송 대기"(퍼널 통일).
- **sentinel 진화 0**: `mobile-banner-quickactions-9`(`요청_접수:`키+bg-blue-100 핀)·`quote-table-readability`(5색만 핀)는 라벨 텍스트 미핀 → GREEN. 주석 내 "요청 발송 전"은 의미설명이라 보존(not.toMatch 미사용).
- sentinel: `quote-mgmt-redesign-stage-label-p1a.test.ts`(발송 대기 라벨 + 키/색/게이팅 보존).

**P1b — 마감(dueDate) 열 제거 (잔여):**
- COLUMN_DEF에서 dueDate 컬럼 제거(order/label/widths/visible) + tbody `if(key==="dueDate")` 렌더 제거. **dd는 computePriority.dd 파생(빠른필터 deadline_soon·정렬) 보존**(컬럼만 제거).
- sentinel 진화 5: `quote-table-due-date-column`(전용 retire/진화)·`column-prefs`·`price-delivery-parity`·`sian-realign`·`card-batch3-price-delivery`.
**✋ Gate:** dd 파생 보존(빠른필터/정렬 무손), build EXIT 0. **Rollback:** 컬럼 revert.

#### Phase 2: 발송 확인(인텐트) 모달
- Status: [ ] Pending
**🟢:** 행 "발송" → ConfirmSendModal(케이스 id·name·공급사후보 수·마감 + "아직 발송 안됨") → "발송 검토 계속" → 기존 VendorRequestModal. 0곳이면 "미지정 — 발송 검토에서 추가" 정직 표기. sentinel.
**✋ Gate:** dead button 0(취소/계속 실 동작), 오발송 방지(2-step), VendorRequestModal 무손. **Rollback:** 모달 + 행 발송 wiring revert.

#### Phase 3: 우선순위 클릭 지정 + 상단 재정렬 (세션 override)
- Status: [ ] Pending
**🟢:** 우선순위 칩 클릭 → prioMap[id] high↔mid↔low 순환(세션 state, DB 0) → 정렬 시 override 우선(없으면 computePriority.level). 새로고침 시 복귀. canonical 파생 기본 보존.
**✋ Gate:** 가짜 저장 0(세션만)·새로고침 복귀·computePriority 파생 기본·정렬 재배치 작동. **Rollback:** prioMap state revert.

#### Phase 4: AI 카드 navy + 퍼널 5단계 정합
- Status: [ ] Pending
**🟢:** 우선 추천 카드 navy gradient(대시보드 NextStepBanner 토큰 재사용, 라벨 "우선 추천"/"AI 추천" 가드② 유지). 퍼널 5단계 라벨(발송 대기/회신 추적/비교 검토/승인·예외/입고 준비) + 0건 흐림·현재집중 배지 정합. amber 0(§11.302).
**✋ Gate:** AI 과대표기 0·시각만(canonical 0)·build EXIT 0. **Rollback:** per-component revert.

#### Phase 5: 반응형 + smoke
- Status: [ ] Pending
**🟢:** 시안 반응형(모달 ≤680/≤560·테이블 가로스크롤·375px 잘림 0) read-only 확인 + 라이브 호영님. **✋ Gate:** baseline-delta 0, build EXIT 0. **Rollback:** 반응형 클래스 revert.

## 8. Risk
| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| dueDate 컬럼 제거 sentinel 다수 진화 | High | Med | grep 전수 선식별·dd 파생 보존(빠른필터/정렬 무손) |
| 발송 인텐트 모달 ↔ VendorRequestModal 중복 | Med | Med | 인텐트=앞단 확인만, 상세=기존 모달 재사용(중복 0) |
| 우선순위 세션 override 새로고침 혼란 | Low | Med | 영구 아님 명시(README 파생 원칙)·DB 0 |
| AI 과대표기(룰베이스→AI) | Low | High | "우선 추천" 라벨 유지(가드②), navy는 색만 |

## 9. Rollback
- P1: 컬럼/라벨 revert. P2: 인텐트 모달 revert. P3: prioMap revert. P4: 카드/퍼널 revert. P5: 반응형 revert. env/flag 없음 — git revert.

## 10. Progress
- Overall: 100%(P0~P5 완료) · Current: §quote-management-redesign 완결 · Blocker: 없음 · Next: 없음
  - P4 비고: 퍼널/카드 surface 이미 구현 상태(호영님 "일부 구현"). 카드만 대시보드 NextStepBanner 토큰으로 정합(시안). 퍼널은 호영님 결정 "현행 유지(발주 전환·s5 hide)" — 변경 0.
  - P5 비고: 반응형 read-only 감사(ConfirmSendModal max-w-md·우선순위 pill 28px·375px 잘림 0) — 코드 변경 0. end-to-end smoke sentinel로 P1a~P4 정합 land 잠금.
**Checklist:** [x] P0 [x] P1 [x] P2 [x] P3 [x] P4 [x] P5

## 11. Notes
**Decisions (2026-06-24, 호영님):** quote 시안 정합, "견적관리". 우선순위 클릭=**세션 override(DB 0, 파생 복귀)**. 이미 구현분(퍼널·추천카드·배치바·발송/비교 모달·아바타·필터) 제외, 신규/변경 5건 중심.
