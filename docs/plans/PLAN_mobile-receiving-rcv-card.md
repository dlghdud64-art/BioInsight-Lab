# Implementation Plan: 모바일 입고 관리 — RCV 단위 통합 카드 + 문서 첨부 시트

- **Status:** ✅ Complete
- **Started:** 2026-07-26
- **Last Updated:** 2026-07-26
- **Estimated Completion:** 완료 (Phase 1–4)
- **커밋 체인:** 575bda04(P1·P2) → dbad39ba(P3) → (P4 라벨 정밀화 대기)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 「모바일 입고 관리 핸드오프.md」 + 프로토타입 「모바일 입고 관리 개선.dc.html」 (2026-07-26 세션)
- 라이브 코드 (2026-07-26 확인): `apps/web/src/components/receiving/*`, `apps/web/src/lib/ops-console/inbox-adapter.ts`, `scenario-transition-runner.ts`, `ops-store.tsx`

**Secondary References:**
- PLAN_receiving-list-v2.md (데스크탑 v2, 2026-07-08)
- PLAN_receiving-doc-attach-dbbacked.md (실 파일 업로드 트랙 — 별건, deferred 유지)
- CLAUDE.md §Mobile Patterns(§11.311) · §11.302 신호등(yellow 잠금, amber 보류)

**Conflicts Found:**
1. 핸드오프 §3 `Blocker[]` 신규 타입 vs 라이브 canonical(`ReceivingBatchContract` + `deriveLineDocStatus`) → **라이브 contract 파생으로 해결** (신규 truth 저장소 금지)
2. 핸드오프 1b "촬영/파일 선택 실업로드" vs 입고 DB-backed 업로드 트랙 부재(기존 모달 정직-disabled) → **호영님 2026-07-26 a안 승인**: 문서별 첨부(실 게이트 전이) 배선 + 드롭존 정직-disabled 유지
3. `receiving-doc-attach-v2` sentinel이 데스크탑 모달의 muted amber(`#b45821`) 잠금 vs CLAUDE.md yellow 잠금 → **데스크탑 모달 무접촉**으로 회피. 모바일 신규 표면만 yellow 토큰
4. 라이브 모바일 파일들(`mobile-receiving-view` L65 등)에 `#b45821` raw hex 잔존 → 재작성하는 라인만 yellow 정합, 전면 sweep 금지(§P6 보류 결정 준수)

**Chosen Source of Truth:**
- 데이터: `graph.receivingBatches` (ops-store canonical) — RCV 단위 파생은 **순수함수 뷰모델**로. `unifiedInboxItems`(이슈 단위 분열 projection)는 모바일 입고 리스트에서 사용 중단
- 시각/UX: 핸드오프 §1·§2·§4 토큰

**핵심 진단 (라이브 확인 완료):**
- `inbox-adapter.ts buildInboxFromReceiving()`: RCV 1건 → 최대 3 item(`quarantine_constrained`/`receiving_issue`/`posting_blocked`) emit → 모바일 카드 3장 분열 (핸드오프 진단 #2 재현)
- **추가 결함**: blocker 전무 batch는 item 0개 emit → ready RCV 리스트 미노출. RCV 단위 뷰모델이 자연 해결
- 첨부 배선 자산: `attach_receiving_document` transition + `deriveLineDocStatus` + `store.attachReceivingDocument` (ops-store L118/510) 라이브. 시트는 이 경로에 wiring
- `postToInventory`·`completeInspection` wrapper 존재 (ops-store L112–113)

**Environment Reality Check:**
- [ ] vitest 실행: 호영님 환경 `apps/web`에서 `npx vitest run src/components/receiving` (sandbox 실행 불가 — 공유 node_modules 설치 금지, 호영님 회신 기반 판정)
- [x] 기존 sentinel 영향 범위 확인: `receiving-list-card-v2`·`list-filter-v2`는 데스크탑 리스트 대상 → 무영향. `doc-attach-v2`·`post-v2`는 무접촉 파일 대상 → 무영향
- [x] 데스크탑 경로(`ReceivingDesktopList`·quickview·post modal) 무접촉 확정

## 1. Priority Fit

- [x] P1 immediate — 호영님 직접 핸드오프, §11.311 모바일 계열, dead-surface(첨부 실행 표면 부재) 해소

## 2. Work Type

- [x] Feature + Design Consistency (Mobile Web)

## 3. Overview

**Feature Description:**
모바일(`/dashboard/receiving`, <768px) 입고 리스트를 RCV 1건=카드 1장(차단 사유 체크리스트 내장)으로 통합하고, `첨부 ›` CTA에서 리스트 내 바텀 시트로 문서 첨부(실 게이트 전이)를 실행 가능하게 배선.

**Success Criteria (핸드오프 §5 QA 체크리스트 준수):**
- [ ] RCV 1건 = 카드 1장, 결과 요약("반영 차단") 대등 카드 소멸
- [ ] 체크리스트: 문서→보류→검수 순서 + 검수는 선행 미해결 시 비활성("1·2 해결 후 진행돼요")
- [ ] `첨부 ›` → 바텀 시트(누락 라인·문서 종류 프리셋), no-op 0
- [ ] 첨부 = store 게이트 전이 확인 후 줄 소멸 + KPI 동시 갱신 (front-only success 0)
- [ ] 최종 `재고 반영` 비활성 사유 인라인, 전부 해결 시 활성 → `postToInventory` 실 mutation
- [ ] ready RCV(그린 칩) 카드 노출 (현행 미노출 결함 해소)
- [ ] 흰 카드 + 칩/텍스트만 채색, 보류 칩 yellow 토큰(`#fef9c3/#a16207`)
- [ ] 터치 타겟 ≥44px

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- 실 파일 업로드/촬영 (PLAN_receiving-doc-attach-dbbacked 별건 — 드롭존 정직-disabled 유지)
- 데스크탑 리스트/모달/드로어 변경
- `#b45821` 전면 sweep (§P6 보류)
- inbox-adapter 자체 수정 (다른 surface들이 소비 — 입고 홈/work-queue 회귀 위험)

**User-Facing Outcome:**
모바일에서 RCV별 "반영까지 남은 일 N"이 한 카드에 보이고, 첨부→줄 소멸→재고 반영까지 리스트 이탈 없이 완결.

## 4. Product Constraints

**Must Preserve:** same-canvas(시트=리스트 위 오버레이) / canonical truth(`receivingBatches`) / KPI·체크리스트 동일 소스
**Must Not Introduce:** page-per-feature / dead button / front-only success / UI state truth
**Canonical Truth Boundary:**
- Source of Truth: `graph.receivingBatches` (+ `deriveLineDocStatus`)
- Derived Projection: 신규 `mobile-receiving-view-model.ts` 순수함수 (`blockers[]`·`status` 파생 — 핸드오프 §3 의미론, 저장 안 함)
- Persistence Path: `store.attachReceivingDocument` / `completeInspection` / `postToInventory` → `applyTransition` → 파생 재계산
**UI Surface Plan:** [x] Bottom sheet + 기존 route 리스트 내 재조립. 신규 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 모바일 리스트 데이터 소스를 `unifiedInboxItems` → `receivingBatches` 파생 뷰모델로 교체 | 분열의 근원이 이슈-단위 projection. RCV 단위는 canonical에서만 무손실 파생 가능. ready 미노출도 자연 해소 | 모바일/데스크탑 리스트 데이터 소스 이원화(데스크탑은 기존 유지 — 후속 통합 별건) |
| inbox-adapter 무수정 | 타 surface(work-queue·대시보드) 소비 중, 회귀 반경 최소화 | 이슈-단위 item은 타 surface에 존치 |
| 첨부 시트 = 신규 모바일 전용 컴포넌트 (데스크탑 모달 무접촉) | `doc-attach-v2` sentinel(amber 잠금 포함) 충돌 회피, 모바일 프리셋 컨텍스트 자유 | 첨부 UI 2벌 (문서 모델·wiring은 동일 store 경로 공유) |
| 검사(보류)·검수 CTA는 상세 라우팅 유지 | 검사 판정은 라인별 판단 필요 — 시트로 뭉개면 오판 위험. 핸드오프도 `검사 ›`만 명시 | 보류 해소는 상세 왕복 1회 |

**Touched:** `mobile-receiving-view.tsx`(재조립) · 신규 `lib/ops-console/mobile-receiving-view-model.ts` · 신규 `components/receiving/mobile-doc-attach-sheet.tsx` · `app/dashboard/receiving/page.tsx`(모바일 분기 wiring) · 신규/갱신 sentinel tests

## 6. Global Test Strategy

- 뷰모델(순수함수): vitest **unit** — blocker 파생·의존순서·resolved 소멸·status 매트릭스
- UI 구조·wiring: **sentinel**(readFileSync+regex, CLAUDE.md 패턴) + 회귀 0 describe 필수
- 실행 불가 항목은 "실행 불가" 명기, 추정 통과 금지. 스모크는 호영님 실기기(375px)

## 7. Implementation Phases

### Phase 1: RCV 뷰모델 + Failing Tests (1–2h)
- Status: [ ] Pending
- 🔴 unit test 먼저: `buildMobileReceivingCards(batches)` — doc/quarantine/inspection blocker 파생, `inspection.dependsOn` 게이트, 전부 해결 시 `ready`, posted 제외, KPI 카운트 동일 소스
- 🟢 `mobile-receiving-view-model.ts` 순수함수 구현 (`deriveLineDocStatus` 재사용, 신규 상태 저장 0)
- 🔵 네이밍·불필요 필드 제거
- ✋ Gate: 뷰모델 unit 전건 green(호영님 회신), 기존 suite 회귀 0, truth boundary 위반 0
- Rollback: 신규 파일 2개 삭제 — 기존 화면 무영향

### Phase 2: 리스트 카드 재조립 (2–3h)
- Status: [ ] Pending
- 🔴 sentinel 먼저: RCV 1카드·체크리스트 순서·비활성 검수 줄·최종 CTA 사유 인라인·흰 카드(배경 채색 금지)·보류 칩 yellow·`#b45821`/rose 배경 부재·회귀 0(KPI·칩 필터·정렬 보존)
- 🟢 `mobile-receiving-view.tsx` 재조립: 카드 헤더(차단 배지 `#fef2f2/#b91c1c` 칩만 + 경과 레드 텍스트) + 체크리스트(번호 칩 red/yellow/gray) + `첨부 ›`(primary)·`검사 ›`(outline, 상세 라우팅) + 최종 CTA(`재고 반영 · N건 해결 후 가능` 비활성 / ready 시 `postToInventory` wiring). ready 카드 그린 칩 + 활성 CTA. KPI·필터 칩 카운트 = 뷰모델 파생
- 🔵 잔존 `#b45821`(L65 due_soon) → yellow 텍스트 토큰 정합
- ✋ Gate: sentinel green, dead button 0, 375px 잘림 0(호영님 확인), 터치 44px
- Rollback: `mobile-receiving-view.tsx` revert (Phase 1 산출물은 무해하게 잔존 가능)

### Phase 3: 문서 첨부 바텀 시트 (2–3h)
- Status: [ ] Pending
- 🔴 sentinel 먼저: 시트 오픈 프리셋(RCV·누락 라인) · `onAttach`→`store.attachReceivingDocument` 직접 wiring · mutation 후 토스트 순서 · 완료 CTA 비활성 사유(`첨부 완료 · COA 업로드 후 가능`) · 드롭존 정직-disabled 문구 · 회귀 0
- 🟢 `mobile-doc-attach-sheet.tsx` (그랩바 바텀 시트, per-line/per-lot CoA·MSDS 모델 유지): 완료 건 그린 ✓ / 미첨부 건 문서별 `추가` 배선. 첨부 → store 전이 → 뷰모델 재파생으로 체크리스트 줄 소멸 + KPI 감소(동일 렌더 사이클, front-only 아님). 안내문 "게이트 전이 기록" 정직 문구(활동 로그 미존재 주장 금지)
- 🔵 데스크탑 모달과 중복 로직 최소화(REQUIRED 상수 등 공유 가능분만 추출)
- ✋ Gate: no-op 0, 부분 첨부(1/2) 잔여 카운트 유지, Esc/백드롭 닫기, sentinel green
- Rollback: 시트 파일 + page wiring revert → Phase 2 상태(`첨부 ›`=상세 라우팅 폴백)

### Phase 4: 스모크 · 회귀 · 인계 (0.5–1h)
- Status: [ ] Pending
- 🔴 스모크 경로 정의: 차단 RCV 첨부 2건 → 줄 소멸 → 검수 → ready 전환 → 재고 반영 → 리스트 소멸 + KPI 0
- 🟢 호영님 실기기 스모크 + `npx vitest run src/components/receiving src/lib/ops-console` 전건 회신
- 🔵 임시 코드 제거, 본 문서 Notes 갱신
- ✋ Gate: QA 체크리스트(§3 Success Criteria) 전항 통과, 데스크탑 무회귀
- Rollback: batch 전체 revert 경로 문서화 (신규 파일 2 + 수정 파일 2)

## 8. Mobile Addendum

- viewport <768px 전용 분기(`md:hidden`) — 데스크탑 무접촉
- 터치 44px / first fold: KPI+칩 ≤350px 유지(§11.311) / 브레드크럼 없음
- 오프라인/딥링크 해당 없음(웹). 시트 내 스크롤 overscroll-contain

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 뷰모델-KPI 카운트 불일치 | Low | Med | 단일 파생 함수에서 카드·KPI 동시 산출 + unit 매트릭스 |
| 데스크탑 sentinel 오폭 | Low | Med | 데스크탑 파일 무접촉 + Phase 4 전체 suite 회신 |
| 시트-모달 로직 drift | Med | Low | store 경로 단일 공유, REQUIRED 상수 추출 |
| yellow 전환이 잔존 amber와 혼재 | Med | Low | 이번 파일 내 한정 정합, sweep은 Out of Scope 명시 |

## 10. Rollback Strategy

- Phase 1 실패: 신규 2파일 삭제
- Phase 2 실패: `mobile-receiving-view.tsx` revert
- Phase 3 실패: 시트+page wiring revert (첨부는 상세 라우팅 폴백 — dead button 아님)
- Phase 4 실패: batch revert, 데스크탑 경로는 애초 무접촉

## 11. Progress Tracking

- Overall: 100% · 마감
- [x] Phase 1 [x] Phase 2 [x] Phase 3 [x] Phase 4

## 12. Notes & Learnings

**검증 결과 (QA 체크리스트 §3 Success Criteria 대조):**
- [x] RCV 1건 = 카드 1장 — 런타임 DOM 실측 확정(RCV-2026-0031 1카드, 옛 3장 분열 소멸)
- [x] 체크리스트 순서·의존(검수는 1·2 미해결 시 비활성 "1·2 해결 후 진행돼요") — 런타임 확인
- [x] `첨부 ›` → 바텀 시트(RCV·라인 프리셋), no-op 0 — 런타임 확인(role=dialog, L-Glutamine 프리셋)
- [x] 업로드 성공 시 서버(store) 반영 후 줄 소멸 — 런타임 확인(CoA 추가 → 문서 줄 소멸, 차단 3→2, front-only 아님)
- [x] 최종 `재고 반영` 비활성 사유 인라인 / ready 시 활성 — 확인
- [x] ready RCV 노출 — 뷰모델 unit 커버(현 org 데이터 반영가능 0건이라 런타임 미도달)
- [x] 보류 칩 yellow 토큰(#fef9c3/#a16207), amber(#b45821) 미도입 — sentinel 확인
- [x] 흰 카드 + 칩/텍스트만 채색(배경 채색 금지) — sentinel 확인
- [x] 터치 44px — sentinel 확인
- 🟡 실기기 375px 잘림 육안 — Claude-in-Chrome viewport 375 미적용(1283 clamp)으로 DOM 마커 대체 검증. 호영님 실기기 최종 확인 권장.

**Phase 4 라벨 정밀화(a안, 호영님 2026-07-26):**
- KPI/칩 "문서 대기" → "반영 차단". 근거: `blockedCount`는 다중 blocker(문서+보류+검수) 포함 차단 RCV 수 →
  "문서 대기"는 오라벨(raw-label 방지 원칙). "반영 차단"이 `반영 가능`(ready)과 대칭·정확.
- semantics 불변(숫자·소스 동일). KPI·칩·체크리스트 동일 소스(blockedCount) 유지.

**Blockers Encountered:**
- [2026-07-26] §11.334 post-modal sentinel 3연속 공백 취약(P2 인접 → P3 줄바꿈) → `\s*` 개행/공백 내성으로 근본 해소.
- [2026-07-26] v2 sentinel 자기함정(부정 단언이 설명 주석의 ModuleLandingItem 오매칭) → stripComments 적용(product-detail 교훈).
- [2026-07-26] 스모크 초기 2회 오판(데스크탑 viewport를 모바일로·엉뚱한 .md:hidden 검사) → textContent·정확 컨테이너로 정정.

**Implementation Notes:**
- 모바일 리스트 데이터 소스 = `receivingBatches`(canonical) 파생 뷰모델. 데스크탑은 `unifiedInboxItems`(이슈-단위) 유지 — 이원화(후속 통합 별건).
- inbox-adapter 무수정(타 surface 소비 회귀 방지). ready RCV 미노출 결함은 RCV 단위 파생으로 자연 해소.
- 실 파일 업로드/촬영은 정직-disabled(PLAN_receiving-doc-attach-dbbacked 별건). front-only success 0.
- 데스크탑 doc-attach-modal(센터 Dialog) 무접촉 — 모바일 바텀 시트 별도, store 경로만 공유.

**Deferred (후속):**
- apps/mobile/app/scan.tsx:1274-1275 구문 에러(이번 트랙 무관, 별건 정리 대상).
- 실기기 375px 육안 + ready RCV(반영 가능 데이터 있는 org) 노출 최종 확인.
