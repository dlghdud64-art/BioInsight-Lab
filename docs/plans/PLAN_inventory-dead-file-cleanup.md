# Implementation Plan: §inventory-dead-file-cleanup

- **Status:** ⏳ Pending
- **Started:** 2026-08-06
- **Last Updated:** 2026-08-06
- **Estimated Completion:** 2026-08-06 (반나절)

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
- §reorder-quote-handoff §12 (34ca8b03) — inventory-main.tsx importer 0 dead file 실측·사고 기록, dead 마커 부착(3507688f).
- 실행 세션 render-reachability 분석(2026-08-05) — 라이브 표면 = inventory-content.tsx (page.tsx import).

**Secondary References:**
- 계획 세션 사전 실측(2026-08-06, 2커밋 stale 사본 — P0에서 HEAD 재실측 필수):
  read 대상 테스트 4파일 중 3파일 잔존(reorder-quote-handoff 는 3507688f 기 재지정) —
  `inventory-filter-empty-state-361` · `layout-width-inventory-brief-333` · `smart-receiving-naming-split-315b`.
  주석-only 언급: 테스트 22파일 + `hooks/use-inventory-alert-count.ts` L11 · `app/api/team/[id]/inventory/route.ts` L50.

**Conflicts Found:**
- 없음 (dead 판정은 기확정 — 40일 재발 사고 이력이 근거).

**Chosen Source of Truth:**
- importer/도달성 기준 라이브 판정 (§reorder-quote-handoff 채택 규율). 스타일 문자열 존재는 판정 근거 아님.

**Environment Reality Check:**
- [ ] HEAD(34ca8b03) 트리에서 참조 전수 재실측 (stale 사본 금지)
- [ ] 격리 /tmp vitest 실행 가능 → operator 독립 vitest 권위
- [ ] dynamic import / lazy / 문자열 경로 참조 0 확인

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker / [ ] Post-release / [x] P2 / Deferred → 착수 승인됨(2026-08-06 "1,2 가자")

**Why This Priority:**
dead file 이 sentinel false-GREEN·오적용 사고를 2회(§11.328 시기 + §reorder-quote-handoff 1a) 유발. 기능 아닌 재발 위험 제거 트랙 — 소형·저위험이라 §pocandidate-vendor-split 선행 정지작업으로 배치.

## 2. Work Type

- [x] Bugfix(재발 위험 제거) / [x] Design Consistency(sentinel 계보 정리) — 그 외 해당 없음.

## 3. Overview

**Feature Description:**
importer 0 dead file `apps/web/src/app/dashboard/inventory/inventory-main.tsx` 를 삭제하고, 이를 read 하는 정적 sentinel 3파일을 라이브 표면으로 승계(또는 dead 전용 단언 폐기)하여 false-GREEN 사고 클래스를 소거한다.

**Success Criteria:**
- [ ] inventory-main.tsx 삭제, 전 트리 import/경로 참조 0
- [ ] read 대상 sentinel 3파일: 보호 의도 보존한 승계 또는 근거 기록 후 폐기 — corrupt→RED 실증
- [ ] 오도 소지 주석 2곳(훅·API route) 정정, 테스트 주석 22곳 무접촉(churn 회피 — 근거 §12 기록)
- [ ] 독립 vitest 게이트 신규 실패 0

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] inventory-content / mobile-inventory-view 기능 변경 (읽기 전용 참조만)
- [ ] 테스트 주석 22곳 일괄 rewording
- [ ] 기타 dead file 탐색 확장 (이 트랙은 inventory-main 1파일 한정)

**User-Facing Outcome:**
- 사용자 가시 변화 0 (dead file — 렌더 경로 무접촉). 개발 안전성 트랙.

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth — 라이브 표면 inventory-content 무접촉
- [x] 도달성 가드 sentinel (3507688f 신설분) 무손상

**Must Not Introduce:**
- [x] page-per-feature / dead button / no-op — 해당 표면 없음

**Canonical Truth Boundary:**
- Source of Truth: page.tsx → inventory-content.tsx 렌더 경로
- Derived Projection: 없음 / Persistence Path: 없음 (파일 삭제만)

**UI Surface Plan:** 해당 없음 (UI 무접촉)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 삭제 (보존 아님) | dead 마커로도 40일 내 재발한 사고 클래스 — 존재 자체가 함정 | git 히스토리로 복구 가능, 손실 0 |
| sentinel 승계 우선, 폐기는 예외 | 보호 의도(원 계약) 보존 규율 | 승계 불가(계약이 dead 전용) 시에만 폐기 + §12 근거 |

**Dependencies:** 없음. **Touched:** inventory-main.tsx(삭제) + sentinel 3파일 + 주석 2곳.

**Integration Points:** 없음 (렌더·API 무접촉).

## 6. Global Test Strategy

- sentinel 승계 = readFileSync+regex 관례 유지, 대상만 라이브 파일로.
- corrupt→RED: 승계 후 라이브 파일 임시 훼손 → RED 확인 → 원복 diff-clean.
- 게이트: 승계 3파일 + reorder-quote-handoff(도달성 가드) + tsc/build (operator 독립 실행 권위).
- 라이브 표면 실행 검증: UI 무접촉이므로 Chrome 실측은 재고 페이지 로드 1회(빌드 회귀 부재 확인)로 축소.

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock
**Goal:** HEAD 트리 재실측으로 참조 전수 확정.
- Status: [ ] Pending
**🔴 RED:** stale 사본 참조 목록을 가설로 두고 HEAD에서 재검증 / **🟢 GREEN:** read 대상·주석·dynamic import 전수 확정, 3파일 잠금 계약을 라이브 표면 대조로 승계/폐기 분류 / **🔵 REFACTOR:** 스코프 확정
**✋ Quality Gate:** 참조 목록에 미확인 항목 0, 분류표 산출 / **Rollback:** 계획 전용 — 코드 무변경

#### Phase 1: Sentinel 승계
**Goal:** 3파일 read 대상 라이브 재지정, 보호 의도 보존.
- Status: [ ] Pending
**🔴 RED:** 승계 후 라이브 파일 corrupt → RED 실증 / **🟢 GREEN:** 재지정 + 승계 주석(원 계약·경위) / **🔵 REFACTOR:** dead 전용 단언은 폐기 + 근거 주석
**✋ Quality Gate:** 3파일 GREEN + corrupt→RED + 기존 게이트 무손상 / **Rollback:** 테스트 파일 revert

#### Phase 2: 삭제 + Sweep + 게이트
**Goal:** 파일 삭제, 오도 주석 정정, 최종 게이트.
- Status: [ ] Pending
**🔴 RED:** 삭제 전 최종 참조 grep 0 확인 / **🟢 GREEN:** 삭제 + 주석 2곳 정정 + 독립 vitest·tsc·build / **🔵 REFACTOR:** §12 기록
**✋ Quality Gate:** 전 게이트 GREEN·신규 실패 0·prod 재고 페이지 로드 정상 / **Rollback:** git revert (파일 복원)

## 8. Optional Addenda
해당 없음.

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 숨은 dynamic/문자열 참조 | Low | High(빌드 깨짐) | P0 전수 grep(경로 문자열·lazy·next/dynamic) + P2 삭제 전 재확인 |
| sentinel 승계 시 계약 유실 | Low | Med | 원 계약 주석 보존 + corrupt→RED 실증 |

## 10. Rollback Strategy

- Phase 1 실패: 테스트 파일 revert. / Phase 2 실패: git revert 로 파일 복원 (단일 커밋 원자성).

## 11. Progress Tracking

- Overall completion: 85% — 2차 changeset(감사 실행분) 완료. 잔여: §inventory-detail-relive 미니트랙(366 이식) → P2 삭제 마감
- Current phase: B→A 2차 완료 / Current blocker: 366 이식(삭제 선행 조건)
- Next validation step: §inventory-detail-relive 계획 → 이식 → 재앵커 → inventory-main 삭제

**Phase Checklist:**
- [x] Phase 0 (재판정 포함) / [x] Phase 1 (확정분 승계) / [ ] Phase 2 (삭제 — 2차 감사 후로 보류)

## 12. Notes & Learnings

**계획 시점 기록 (2026-08-06):**
- 착수 승인: 호영님 "1,2 가자" — §pocandidate-vendor-split 선행 정지작업으로 A 트랙 우선.
- 원 사고 계보: §reorder-quote-handoff §12 사고 3(dead-file 오적용·sentinel false-GREEN) — 본 트랙이 그 백로그.

**Phase 0 재판정 (2026-08-06 — 계획 세션 결함 정정):**
- 최초 "read-대상 3파일" 판정은 오판 — 동일라인 grep 함정(readFileSync 와 경로 문자열이 다른 줄). §reorder-quote-handoff §12 교훈("grep 잘라 읽기 금지")의 변형 재위반.
- 교정 방법: 실행 기반 재실측 — dead file 삭제 상태에서 vitest 실행, ENOENT 로 실독 파일 전수 노출. **실독 sentinel = 17파일** (기존 3 + 신규 14).
- 스크래치 전수 실험(14파일 라이브 기계 재지정 후 vitest): 4파일 46단언 GREEN(계약 라이브 존재) / **10파일 44단언 RED(라이브에 잠금 계약 부재)**.
- RED 1차 분류 실측: 기능 자체 라이브 부재 의심 — SmartReceivingScannerModal 0회(§11.308a/309d), nameEn 0회(§11.366) / 기능 존재·내부 상이 — §11.302c KPI(라벨 존재·내부 변수 부재 = 후속 리디자인 대체 추정), 297e, getCardBg.
- **호영님 결정: B→A 단계** — 1차 확정분 커밋(삭제 보류), 2차 spec별 분류표(이식/재앵커/폐기) 산출 후 일괄 승인 → 삭제 마감.
- 발견(361): §11.361-2 fake-empty 수정이 dead file 에만 적용 — 라이브 필터 0건이 "등록된 재고 없음"으로 위장 잔존. **호영님 A안 승인으로 라이브 이식** (dead-file 오적용 3번째 확정 사례).
- 사고: 스테이징 브리지가 reorder-quote-handoff.test.ts 구버전 blob 반환(메타 9,176B vs 내용 7,760B). 대응 규율: **스테이징 사본은 device 직독(sha1/wc) 대조 후 사용** — 이후 14파일 해시 14/14 일치 확인 후 진행.

**1차 changeset (2026-08-06, 격리 vitest 21파일 241 passed·0 failed + corrupt→RED 실증 + tsc 신규 0):**
1. inventory-content.tsx — §11.361-2 라이브 이식 (emptyMessage/Action/Label 3항 필터 분기, 라이브 어휘 보존, 최소 diff)
2. inventory-filter-empty-state-361.test.ts — 라이브 재앵커 + 분기 우선순위 단언 신설 (2→3 tests)
3. layout-width-inventory-brief-333.test.ts — dead 절반 drop, 라이브 절반 승계
4. smart-receiving-naming-split-315b.test.ts — dead it() 폐기 (라이브 4중 잠금 무손실)
5~8. lot-coa · compare-retire-381c · move-location-wire-p3 · 283c-2 — 라이브 repoint + 재앵커 주석 (계약 라이브 존재 실측 GREEN)
- inventory-main.tsx 삭제 보류 (RED 10파일이 여전히 실독 — 2차 감사 마감 시 삭제).

**2차 changeset — RED 44단언 감사 실행 (2026-08-06, 호영님 분류표 승인):**

*분류표 판정(실측 근거 §12 상단 대조):*

| 계열 | RED | 판정 | 처리 |
|---|---|---|---|
| §11.308a·308a-v2·309d·371-3 스마트 입고 인라인 | 14 | 폐기(의도된 대체) | SUPERSEDED describe 로 전환 — 라이브 경로(scan_hub registry) 잠금은 371-3 5면이 담당, 인라인 재도입 차단 단언만 신설. 371-3 거래명세서 경로는 global-modal 로 재앵커 |
| §11.302c·302d-1·302d-2 신호등 | 20 | 폐기(후속 리디자인 대체) | 3파일 RETIRED 재작성 — 구세대 내부명 부활 차단(302c) + 라이브 실존 계약 승계 잠금(302d-1 우선사용 Badge·302d-2 getCardBg 4케이스, no_location 은 라이브 bg-slate-50 재앵커) |
| §11.297e | 2 | 재앵커 1 + 폐기 1 | dead describe 은퇴, 라이브 describe 에 issueType 분기·preparePanel 부활 차단(openReorderReview 승계) 확장 |
| §11.336 | 1 | 폐기(dead 절반) | 333 동형 부분 승계 |
| §11.366 | 7 | **이식 미니트랙** (호영님 확정) | 무접촉 — §inventory-detail-relive 에서 이식+재앵커 후 처리 |

*게이트:* 전환 9파일 82 passed·0 failed. 삭제 드라이런(파일 임시 제거): 실독 잔존 = **366 단독** (그 외 참조는 전부 주석 — quote-search-debounce·dashboard-mobile-refine-p2 포함 comment-only 실측).

*스윕 방법 교훈(2건 추가):* ① 동일라인 grep 함정 재발(297e 경로가 다음 줄) — 판정은 반드시 실행(ENOENT)으로. ② 스윕 패턴에 디렉토리 프리픽스를 넣으면("inventory/inventory-main") 프리픽스 없는 참조를 놓침 — 파일명 단독 패턴 + 실행 검증 병행이 계약.

*삭제 마감 순서(확정):* 2차 커밋 → §inventory-detail-relive(366 이식·재앵커) → P2(inventory-main 삭제 + 주석 2곳 정정 + 최종 게이트).
