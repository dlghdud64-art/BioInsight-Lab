# Implementation Plan: 요금 & 도입 페이지 시안 최종 반영 (pricing-handoff)

- **Status:** ⏳ Pending
- **Started:** 2026-06-28
- **Last Updated:** 2026-06-28
- **정본 spec:** `uploads/요금 도입 최종 핸드오프.md` (호영님 2026-06-28) + `lib/billing/plan-descriptor.ts`(가격 SSOT)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 후:
1. ✅ 체크박스 체크
2. 🧪 quality gate 검증 (operator-shell vitest/tsc/build 권위 — sandbox vitest 불가)
3. ⚠️ 전 gate 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 에 learnings/blocker 기록
6. ➡️ 통과 후에만 다음 phase

⛔ gate 실패·source-of-truth 충돌 미해소·dead button/no-op/fake success 도입 시 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** `요금 도입 최종 핸드오프.md` (호영님, 2026-06-28). 시안 8섹션을 라이브 `app/pricing` 에 정합.

**Secondary References:** 현행 `app/pricing/page.tsx`(778L)·`_components/pricing-assistant.tsx`·`scroll-progress.tsx`, `lib/billing/plan-descriptor.ts`, `lib/plans.ts`, 기존 pricing sentinel 군(`pricing-assistant-enhance`·`pricing-card-select`·`pricing-carousel-responsive`·`plan-tier-naming-304`·`pricing-prelaunch`).

**Conflicts Found:**
- **무료체험:** 핸드오프 §1 "1개월 무료체험" 노출 요구 ↔ 현행 `pricing-고도화 P1` 의도적 숨김(trial 결제 백엔드 부재 = fake claim). **호영님 결정(2026-06-28): 노출**. 단 정보성 라벨만 — "무료체험 시작" dead CTA 금지(CTA="Basic 시작하기"→가입 유지).
- 기존 sentinel `pricing-assistant-enhance` / `pricing-prelaunch` 가 "무료체험 미노출" 고정 → 노출 결정으로 진화 필요.

**Chosen Source of Truth:** 핸드오프 .md(최신 호영님) + 가격은 `plan-descriptor.ts`(PLAN_PRICES 파생). 무료체험 = 노출(호영님 override).

**Environment Reality Check:**
- [ ] repo/branch context (HEAD 493ee8b1, origin/main 동기)
- [ ] sandbox = 코드작성+정적검증, operator-shell = vitest/tsc/build/push 권위
- [ ] sandbox vitest 불가(linux 네이티브 부재) → 정적 replay 후 operator 실행

## 1. Priority Fit
- [x] Post-release UX(요금 페이지 이미 라이브) — P1 blocker 아님
- 대부분 시안 기 구현. 본 트랙 = gap 클로저 + 무료체험 노출.

## 2. Work Type
- [x] Design Consistency (시안 정합) + [x] Web

## 3. Overview
**Feature:** 시안 핸드오프 8섹션을 라이브 요금&도입 페이지에 100% 정합. 현행 95% 구현 상태라 delta 클로저 중심.

**Success Criteria:**
- [ ] §1 가격/좌석/재고 한도 SSOT 100% 일치 + 카드 feats 문구 정합
- [ ] §1 "1개월 무료체험" Basic 노출(정보성 라벨, dead CTA 0)
- [ ] §2 카드 클릭선택·Basic 기본·체크배지·"가장 많이 선택" Basic 고정
- [ ] §3 비교표 9행 순서·셀 종류(none/base/check)·라벨스캔·LOT/GMP 정합 + sticky 헤더
- [ ] §4 AI 즉답 2문장·이모지/MD 후처리·폴백·"참고용" 푸터
- [ ] §5 980/560 브레이크포인트(2열/캐러셀) + 힌트
- [ ] §6 스크롤 진행바
- [ ] §0.1 미구현 차별점 "제공 중" 노출 0 (fake claim 0)

**Out of Scope (⚠️ 구현 금지):**
- [ ] trial-START 결제 백엔드(별도 §pricing-billing-backend)
- [ ] "무료체험 시작" 기능 CTA(dead/no-op) — 라벨만
- [ ] 신규 AI/chatbot UI
- [ ] 가격 값 변경(연간 토글은 표시만, 금액 불변)

**User-Facing Outcome:** 방문자가 시안과 동일한 요금&도입 페이지를 봄 — 4열 카드/클릭선택/비교표/AI즉답/캐러셀, Basic "1개월 무료체험" 라벨 노출.

## 4. Product Constraints
**Must Preserve:** same-canvas(단일 pricing route)·가격 SSOT(plan-descriptor)·honesty(실기능만 "제공 중")
**Must Not Introduce:** page-per-feature·dead button("무료체험 시작" no-op)·fake success·가격 drift

**Canonical Truth Boundary:**
- Source of Truth: `lib/billing/plan-descriptor.ts`(PLAN_PRICES) + 핸드오프 §1 표
- Derived Projection: 카드 feats·비교표 셀
- Snapshot/Preview: 없음
- Persistence Path: 없음(정적 페이지) — CTA는 기존 signup/continue 라우팅

**UI Surface Plan:** [x] Existing route section (`app/pricing`, same-canvas)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| 현행 page.tsx delta 수정(재작성 X) | 95% 구현·sentinel 결합 보존 | delta 정밀 감사 필요 |
| 무료체험 = 정보성 라벨(pill) | fake CTA 회피, §0.1 절충 | trial 실작동은 후속 |
| 가격은 descriptor 파생 유지 | SSOT 단일화 | — |

**Touched:** `app/pricing/page.tsx`, (필요시)`_components/*`, 결합 sentinel 군.
**Integration Points:** plan-descriptor, FAQ_DATA, PricingAssistant(/api/pricing-assistant), continue/signup 라우팅.

## 6. Global Test Strategy
- 구조 정합 → sentinel(readFileSync+regex) 진화/신규.
- 무료체험 노출 → `pricing-assistant-enhance`/`pricing-prelaunch` 의 "미노출" 단언 진화.
- user-visible flow(4열/2열/캐러셀·AI·비교표) → smoke.
- sandbox vitest 불가 → 정적 replay, operator-shell 실행 권위.

## 7. Implementation Phases

### Phase 0: Gap 정밀 감사 *(audit only, no prod code)*
- Status: [x] Complete (2026-06-28)
- **결과 — 라이브 vs 시안 구조 delta(초기 "95%" 정정, MEDIUM scope):**
  - D1 히어로: 시안 네이비 히어로 → 현 §11.304 제거(라이트 "요금 안내"). **호영님 결정: 시안대로 복원**(/intro 중복 감수).
  - D2 카드: 시안 3 아이콘 스탯배지(사용자/견적·구매/재고) → 현 "운영 범위" 텍스트 박스. **호영님 결정: 시안대로 스탯배지**.
  - D3 CTA: 시안 "시작하기" → 현 "도입 신청"(PG 미연동 정직). **호영님 결정: "도입 신청" 유지**(fake start 회피).
  - D4 무료체험: Basic 노출(호영님 결정). D5 비교표 sticky 헤더(미적용). D6 Pro "성장 단계 추천" 배지 제거(시안=Basic만). D7 카드 feats §1 문구 정합.
- **✋ Gate:** delta 표 확정 + 결정 락 완료.

### Phase 1: 네이비 히어로 복원 (D1)
- Status: [ ] Pending
- **🔴 RED:** sentinel — 히어로 네이비 그라데이션 + ph-tag("연구 구매 운영 플랫폼") + h1("운영 규모에 맞는 플랜을 선택하세요") + 서브카피 + 토글 in-hero
- **🟢 GREEN:** 현 라이트 "요금 안내"+별도 토글 → 네이비 히어로 섹션. 토글 hero 내 이동(navy 스타일). /intro 중복 주석 정합
- **🔵 REFACTOR:** spacing/토큰 정리, same-canvas
- **✋ Gate:** dead button 0, 토글 동작 보존, baseline 신규 RED 0
- **Rollback:** 히어로 섹션 revert

### Phase 2: 카드 3 스탯배지 + 무료체험 + 배지/feats 정합 (D2/D4/D6/D7)
- Status: [ ] Pending
- **🔴 RED:** sentinel — 카드 상단 3 스탯배지(사용자/견적·구매/재고 아이콘+값+라벨, descriptor 파생) · Basic "1개월 무료체험" 노출 · Pro 배지 제거 · feats §1 정합
- **🟢 GREEN:** "운영 범위" 텍스트 박스 → 3 스탯배지 그리드(descriptor.operatingVolume 파생). 무료체험 정보성 라벨(CTA="도입 신청" 불변). recommendTag Pro=null. feats 문구 §1
- **🔵 REFACTOR:** 카드 height 통일 유지, 중복 제거
- **✋ Gate:** fake claim 0(무료체험=라벨·dead CTA 0), 가격/한도 SSOT 일치, baseline 신규 RED 0
- **Rollback:** 카드 구조 revert to P1

### Phase 3: 비교표 sticky 헤더 + Smoke + Rollback (D5)
- Status: [ ] Pending
- **🔴 RED:** sentinel sticky thead + smoke path(데스크탑 4열·태블릿 2열·모바일 캐러셀·AI·비교표 sticky·스크롤바·히어로)
- **🟢 GREEN:** thead sticky top:nav-h + Basic 열 강조. 라이브 점검 + baseline-delta
- **🔵 REFACTOR:** 임시 계측 제거, notes 확정
- **✋ Gate:** baseline 신규 RED 0, rollback 문서화
- **Rollback:** page.tsx git revert

## 8. Workflow/Ontology Addendum
- 해당 없음(정적 마케팅 페이지).

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| 무료체험 노출 = fake claim 인식 | Med | Med | 정보성 라벨만·dead CTA 0·호영님 결정 명시 |
| 미세 문구/행순서 drift 미포착 | Med | Low | P0 1:1 감사 |
| sentinel "미노출" 결합 | Med | Med | P1 진화(supersession 근거) |
| page.tsx 778L 수정 truncation | Low | Med | byte-precise·무결성 체크 |

## 10. Rollback Strategy
- P0 실패: audit only
- P1 실패: delta revert(page.tsx/_components/sentinel)
- P2 실패: page.tsx git revert

## 11. Progress Tracking
- Overall: 0%
- Current phase: P0 착수 예정
- Current blocker: 없음
- Next: P0 gap 감사 → delta 표

**Phase Checklist:**
- [x] Phase 0 (감사 + 결정 락)
- [x] Phase 1 (네이비 히어로 — sandbox, operator vitest/build 대기)
- [x] Phase 2 (3 스탯배지 + 무료체험 + sentinel 진화 2 — sandbox, operator 대기)
- [ ] Phase 3 (비교표 sticky 헤더 D5 + smoke)

**진행 메모:** D7 feats=이미 §1 정합(변경 0). D6 Pro "성장 단계 추천" 배지=보류(핸드오프 미명시+recommendTag sentinel 결합). D5 sticky=P3.

## 12. Notes & Learnings

**승인된 결정 (호영님 2026-06-28):**
1. 무료체험 = **노출**(§1대로) — 단 정보성 라벨, "무료체험 시작" dead CTA 금지.
2. 계획 승인 → 문서 생성 → P0 착수.
3. D1 히어로 복원 · D2 3 스탯배지 · D3 "도입 신청" CTA 유지.
4. **PG 연동 후속 예정 (호영님) — "감안" 설계:** CTA/무료체험/도입신청 분기를 PG 플래그(예: ENABLE_BILLING_PG)로 스왑 가능하게 구조화. 지금은 정직(dead button 0, "도입 신청"·무료체험=라벨), PG+trial 착지 시 "시작하기"+체크아웃/실 trial 전환이 최소 diff. 라벨 문구는 그대로 truthful 전환.
