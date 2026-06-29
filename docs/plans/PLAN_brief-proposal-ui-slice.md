# Implementation Plan: 운영 브리핑 제안형 — UI-safe 슬라이스 (dismiss/숨김/idle)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-29
- **Last Updated:** 2026-06-29

**CRITICAL**: phase별 체크박스→quality gate→Notes→다음. ⛔ dead button/no-op/placeholder success/fake claim 금지. ⛔ canonical truth 보호.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 업로드 "운영 브리핑 제안형 핸드오프.md" (호영님 2026-06-28/29).

**Recon 결과 (Explore agent):**
- 현 popup.tsx(704L, §brief-redesign single-queue) = 단일 큐 + 인라인 AI 근거 1줄 + nav. `resolvePrimaryAction()` **항상 null** → 전 모듈 nav-only(honesty 가드, derive-briefing-item L83-85).
- 현 popup 원칙(호영님 2026-06-28): "브리핑에서 완결 X → 화면으로 간다."
- in-place 실 mutation **0** (견적 send/PO issue/입고 post/MSDS 교체 미구현). 신뢰도%·내일예상·발주초안 구조화 데이터 **canonical 부재**.

**Conflicts:**
- 제안형 "승인=in-place 실행" ↔ 실 mutation 0 + 현 popup 원칙 반전.
- 제안형 신뢰도%/내일예상/초안 미리보기 ↔ canonical 소스 0 → 정적이면 fake.

**Chosen Source of Truth (호영님 2026-06-29 결정):** "제안형 + 실연동만" → 실연동 미구현이므로 **UI-safe 슬라이스 먼저**. 정직하게 가능한 view-state 신뢰루프(넘기기/숨김/되돌리기/idle)만. 승인 실행·신뢰도·예측·실 mutation = 백엔드 후속.

**Environment:** main HEAD 051a37b5. operator-shell=vitest/tsc/build/push 권위.

## 1. Priority Fit
- [x] Post-release UX(공유 운영 브리핑, 8 surface 일괄). 호영님 directed. 백엔드 의존부는 defer.

## 2. Work Type
- [x] Design Consistency · [x] Feature(view-state 신뢰루프)

## 3. Overview

**핵심 통찰:** "승인→실행→되돌리기"는 실 mutation 0이라 정직 불가. "넘기기→숨김→되돌리기"는 순수 view-state라 정직 가능. UI-safe 슬라이스 = 후자만.

**Success Criteria:**
- [ ] 카드 "넘기기"(사유: 이미 처리/불필요/나중에) → client-side 숨김. 정직 라벨(❌"AI 학습" → "오늘 목록에서 숨김")
- [ ] "오늘 숨김" 섹션 + 되돌리기(복원)
- [ ] 활성 0건 → idle 안내(❌가짜 "내일 예상" 제외)
- [ ] recalc: 헤더/스트립/섹션 라벨이 dismiss 반영 재계산
- [ ] 승인/primary = 기존 nav CTA 유지(실 mutation 0 → 변경 0)
- [ ] 보존 sentinel 전부 GREEN

**Out of Scope (⚠️ 백엔드 후속):**
- [ ] 실 승인 mutation(발주/이메일/MSDS/추천 채택)
- [ ] 신뢰도% 칩 · 자동승인(data-auto) · 내일 예상 예측
- [ ] 발주초안 테이블/3사 비교표/이메일 초안 구조화 미리보기
- [ ] canonical title 문구 재작성(8 surface 공유, 미터치)

**User-Facing Outcome:** 불필요한 제안을 넘겨 큐를 정리하고(되돌리기 가능), 다 처리하면 정직한 idle 안내. 가짜 승인/신뢰도/예측 0.

## 4. Product Constraints
- Must Preserve: 단일 큐 · same-canvas · canonical(UnifiedInboxItem 파생) · honesty 가드(primaryAction null=nav) · no-LIVE · 헤더폭(400/460/432) · CTA 14자 · a11y(aria-expanded) · 모바일 시트 · minimize/dock
- Must Not Introduce: placeholder success · fake claim(신뢰도/학습) · dead button · 카테고리 게이트 회귀 · 6-section dossier 부활
- Canonical Truth: dismiss = **client view-state only**(Set<id>), 서버/비즈니스 truth 0 변형. 새 truth 0.

## 5. Architecture
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| dismiss = client Set(서버 0) | view-state만 = 정직, 백엔드 0 | 새로고침 시 숨김 리셋(허용, 백엔드 후속) |
| 넘기기 사유 라벨 정직화 | "AI 학습" stub 금지 | 시안 문구와 차이 |
| 승인 nav 유지 | 실 mutation 0 | 제안형 "실행" 미충족(백엔드 후속) |

## 6. Test Strategy
- 신규 sentinel: dismiss 핸들러·숨김 섹션·되돌리기·idle·정직 라벨(no "학습"/"자동 승인" fake)·recalc.
- 보존: popup-redesign-single-queue·popup-self-contained·header-cutoff·cta-shorten·inventory-317.

## 7. Phases

### Phase 0: Truth Lock — [x] Complete
recon(실 mutation 0·honesty 가드·sentinel 5종·BriefingItem/UnifiedInboxItem shape) 확정.

### Phase 1: UI-safe 구현 — [ ]
popup.tsx: dismiss state(Set)+넘기기 인라인(사유 3선, 정직 라벨)+"오늘 숨김" 섹션+되돌리기+idle(가짜 내일 0)+recalc 확장. 승인 nav·canonical·honesty 보존.
- ✋ Gate: tsc/build 0, dead button 0, fake claim 0, 보존 sentinel GREEN.

### Phase 2: Sentinel — [ ]
신규 dismiss/idle sentinel + 보존 5종 확인.
- ✋ Gate: 신규 GREEN, 보존 GREEN, baseline 신규 RED 0.

### Phase 3: Gate & Live — [ ]
operator tsc/build·popup sentinel·baseline → push → 배포 → 라이브(넘기기·숨김·되돌리기·idle, 로그인 세션 측).

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 8 surface 공유 → 회귀 광범위 | Med | High | popup 1파일·view-state만·sentinel 5종 보존 |
| dismiss가 canonical 가리기 오해 | Low | Med | client Set만, 서버 truth 0, 새로고침 복귀 명시 |
| Edit truncation(대형 파일) | Med | Med | byte-precise python 편집 |

## 10. Rollback
- Phase 1/2 실패: popup.tsx + 신규 sentinel revert
- Phase 3 실패: 커밋 revert

## 11. Progress
- Overall: 15% · Current: Phase 1 · Blocker: 없음

## 12. Notes
- [2026-06-29] recon: 실 mutation 0 = 제안형 "승인 실행"은 백엔드 프로그램. UI-safe = view-state 신뢰루프(넘기기/숨김/idle)만 정직 가능.
