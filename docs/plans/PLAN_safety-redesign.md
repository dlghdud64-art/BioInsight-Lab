# Implementation Plan: §safety-redesign — 안전 관리(dashboard/safety) 레이아웃 리디자인 (실배선 유지)

- **Status:** 🔄 In Progress (P0)
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** UI/UX 리디자인 (Web) + 일부 action wiring

**CRITICAL INSTRUCTIONS** (phase 완료마다): 체크박스·quality gate·Last Updated·Notes·다음.
⛔ **핸드오프 mockup 그대로 이식 금지.** 현 페이지는 실배선(`/api/safety/products`·`buildSafetyDecision`, §11.348-B-1). 레이아웃/UX만 적용, 데이터·액션은 canonical 유지.
⛔ **no-op/fake success/dead button 금지** — 모든 CTA = 실 mutation / 실 네비 / disabled+사유 중 하나.
⛔ 단일 카운트 소스(canonical 집계) — 하드코딩 분산 금지(§핸드오프 §5/§9).

---

## 0. Truth Reconciliation
**Latest Truth (실측):** `app/dashboard/safety/page.tsx` = **실배선 페이지**. `useQuery` → `/api/safety/products` → `adaptSafetyProducts`(§11.348-B-1 mock→실데이터 완료) → `buildSafetyDecision`(canonical safety-decision-engine). recharts/GHS/dialog 실제. 스키마: `Product.msdsUrl`·`hazardCodes`(Json)·`SDSDocument`(MSDS 문서) 실존.
**핸드오프 성격:** 이 실배선을 모르는 **독립 mockup**(RAW 20종 하드코딩·데모 toast·current/improved 토글·localStorage view). → 레이아웃 사양으로만 수용, scaffolding 배제.
**Conflicts / 결정:**
- mockup 데이터/액션 → **현 실데이터·canonical 유지**(이식 시 §11.348-B-1 회귀).
- current/improved 토글 → 프로덕션 **제거**(improved만).
- 데모 toast CTA → **실 mutation OR disabled+사유**(P0 audit).
**Chosen SoT:** 안전 데이터=`/api/safety/products`·`buildSafetyDecision`. 카운트(미등록·구버전 19·점검 등)=canonical 집계 단일 소스.
**Env:** sandbox vitest 불가 → 정적 replay + operator-shell 게이트. prod migration 필요 시 §9.9 dry-run 게이트.

**P0 액션 백엔드 audit (필수):** MSDS 일괄 등록 / 점검 기록 생성 / 위험도 분류 실행 / CSV 내보내기 / 마법사 패키지 생성 — 각 실 mutation 라우트 존재 여부 확인. **없으면 그 CTA = disabled + 사유**(no-op 금지), 백엔드 빌드는 별도 follow-up 트랙.

## 1. Priority Fit
- [x] Post-release UI 리디자인. 파일럿(0% 데이터) → empty-state 중심. canonical/§11.348-B-1 보호가 최우선.

## 2. Work Type
- [x] Web UI/UX 리디자인 · [x] (일부) action wiring · 가능 시 집계 쿼리

## 3. Overview
**기능:** 현 안전 페이지를 핸드오프 레이아웃(요약 패널·AI 큐 상한·밀집 테이블·필터·일괄작업·KPI 팝오버·점검 준비 마법사)으로 리디자인. **실데이터/canonical/액션 배선 유지·강화**, mockup scaffolding 제거.

**Success Criteria:**
- [ ] 요약 판단 패널(sticky, buildSafetyDecision 기반) · AI 큐 상한8+내부 스크롤+전체보기 · 밀집 테이블(정렬·14행 페이지네이션) · 필터 칩(건수) · 다중선택 일괄작업 바 · KPI 호버 팝오버(실 집계) · 3단계 점검 준비 마법사.
- [ ] 모든 CTA wired-or-disabled(no-op 0) · 단일 카운트 소스 · 실데이터(/api/safety/products) 유지.
- [ ] mockup 잔재 0(RAW 하드코딩·current/improved 토글·localStorage view·데모 toast). empty-state(0%) 정상.
- [ ] amber 톤 통일(형광 노랑 미사용) · 신규 회귀 0.

**Out of Scope (⚠️):**
- [ ] MSDS 버전검증 9/19/72 상세 파서·공공 DB 대조(별도 `MSDS 버전검증 핸드오프.md` 트랙) — 본 plan은 **패널 UI + 단일 카운트 소스 연결**까지, 검증 엔진은 OOS.
- [ ] 백엔드 미존재 액션의 신규 mutation 라우트(별도 follow-up) — 본 plan은 wired-or-disabled.

## 4. Product Constraints
**Must Preserve:** DashShell/헤더 grammar · `/api/safety/products`·`buildSafetyDecision` canonical · §11.348-B-1 실데이터 · same-canvas
**Must Not Introduce:** mockup 하드코딩 회귀 · no-op/fake success · page-per-feature(마법사=모달 same-canvas) · 가짜 강조(0값 회색 유지)
**UI Surface Plan:** [x] 기존 safety route 본문 리디자인 · [x] 점검 준비 = 모달(같은 route) · 신규 page 0.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| 레이아웃만 교체, 데이터=현 useQuery/buildSafetyDecision | §11.348-B-1·canonical 보호 | mockup 데이터 미이식 |
| CTA wired-or-disabled (P0 audit) | no-op 금지 | 일부 CTA disabled+사유 잔존(백엔드 follow-up) |
| 단일 카운트 소스(집계 helper) | 핸드오프 §5/§9 정합 | 하드코딩 19 등 금지 |
| current/improved 토글 제거 | 프로덕션 정합 | 비교 데모는 핸드오프 문서로 충분 |

**Touched(예상):** `app/dashboard/safety/page.tsx`(대규모 리디자인) · 필요 시 `lib/safety/*`(집계/어댑터) · sentinel. (액션 라우트는 audit 후 결정.)
**Dependencies:** /api/safety/products·buildSafetyDecision 출력 shape(P0 확인). MSDS 버전검증 데이터(OOS).

## 6. Global Test Strategy
- sentinel(readFileSync+regex): 각 섹션 존재 · mockup 잔재 0 · CTA wired-or-disabled(no toast-only) · 실데이터 useQuery 유지 · 토글/ localStorage view 제거 · 단일 카운트 소스.
- empty-state(0%) 렌더 검증. operator-shell baseline·tsc.

## 7. Implementation Phases
### P0 — Context & Truth Lock — [x] (2026-06-27)
> **★ 발견:** 현 safety write 핸들러(MSDS/점검/폐기)가 **front-only no-op**(setTimeout+로컬 setItems+toast, POST 0) — 기존 LabAxis 위반 잔존. READ만 §11.348-B-1로 wired.
> **실 write 엔드포인트는 존재**(미연결일 뿐): MSDS→`/api/products/[id]/sds`(POST)·점검→`/api/inventory/[id]/inspection`(POST)·폐기→inventory route·CSV→client/`safety/spend/export`. → **배선으로 no-op 해소**(신규 백엔드/migration 불요).
> 위험도 분류·마법사 패키지 생성은 별도 엔드포인트 audit 필요(P5/P6) — 없으면 disabled+사유.
> 단일 카운트 소스 = buildSafetyDecision 분류 + /api/safety/products 집계. mockup 잔재(RAW·current/improved·localStorage view) 배제 확정.

### P1 — 계약 & 실패 sentinel — [ ]
**🔴** sentinel(RED): 요약패널·큐 cap·테이블·필터·일괄·KPI팝오버·마법사 존재 + mockup 잔재 0(RAW/current·improved/localStorage view/toast-only CTA) + useQuery 유지
**✋ Gate:** 실패테스트 real·기존 safety 테스트 GREEN 유지

### P2 — 안전 판단 요약 패널 (sticky) — [ ]
**🟢** buildSafetyDecision 기반 도넛(0% amber·ring 보존)·범례·가장 시급 배너·GMP/KOSHA 준비도 바·CTA(wired/ disabled). 0값 회색.
**✋ Gate:** 실데이터·empty-state·도넛 pct=0 처리

### P3 — AI 권장 처리 큐 — [ ]
**🟢** buildSafetyDecision 큐 상위 N · 상한 8 + 내부 스크롤 · "전체 보기"(실 네비/필터) · empty-state. 무제한 세로 폭증 제거.
**✋ Gate:** cap·스크롤·전체보기 wired·empty

### P4 — 화학물질 대장 테이블 — [ ]
**🟢** /api/safety/products → 밀집 테이블(컬럼·위험 칩·보관·MSDS/점검 상태) · 정렬(SortTh) · 14행 페이지네이션 · 필터 칩(건수) · empty-state. (반복 카드 제거)
**✋ Gate:** 실데이터·정렬·페이지네이션·필터 건수 canonical

### P5 — 일괄작업 바 + KPI 팝오버 — [ ]
**🟢** 체크박스 다중선택 → bulkbar(MSDS 일괄 등록·점검 기록 생성 — wired OR disabled+사유) · KPI 4종 호버 팝오버(분해=실 집계, CTA wired/disabled). 0값 회색.
**✋ Gate:** no-op 0·집계 canonical·다중선택 state

### P6 — 점검 준비 마법사 (3단계) — [ ]
**🟢** 모달 3단계(범위·담당/일정·패키지). 액션 wired OR disabled+사유. MSDS 버전검증 패널 = 단일 카운트 소스 표기(검증 엔진 OOS). 예상 준비도 미리보기.
**✋ Gate:** same-canvas 모달·no-op 0·카운트 단일 소스

### P7 — empty-state / 톤 / 토글 제거 / smoke — [ ]
**🟢** current/improved 토글·localStorage view 제거 · amber 톤 통일(형광 노랑 0) · 0% empty-state 전수 · smoke · baseline · tsc
**✋ Gate:** 회귀 0·mockup 잔재 0·empty 정상  **Rollback:** phase 단독 revert

## 8. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| mockup 이식으로 실데이터 회귀(§11.348-B-1) | High | High | 레이아웃만·useQuery 유지 sentinel |
| 백엔드 없는 CTA가 데모 toast(no-op) | High | High | wired-or-disabled 강제·sentinel(toast-only CTA 0) |
| 카운트 하드코딩 분산(19 등) | Med | Med | 단일 집계 소스·sentinel |
| 대규모 page 리팩토링 회귀 | Med | Med | phase별·기존 safety 테스트 GREEN 유지 |
| 마법사 액션 미배선 | Med | Med | disabled+사유, 백엔드 follow-up |

## 9. Rollback
- phase 독립 revert. 데이터 경로(useQuery/buildSafetyDecision) 무변경이 안전판 — 레이아웃 revert해도 데이터 정상.

## 10b. 상단정합 (라이브 vs 시안 — 2026-06-27, 내 1차 누락 보완)
- **발견:** 1차 델타 분석에서 상단(요약 패널·KPI)을 "거의 구현됨"으로 과대평가 → ②(테이블)만 land, 상단은 시안 미반영. 라이브 스샷으로 확인(호영님 "시안 미정합 재전달"). 내 미스.
- **호영님 결정:** 전체 정합 · 트렌드 차트 제거 · MSDS 버전검증은 백엔드 트랙(상단정합 후).
- **A 저장 상태 바 제거**(시안 §0): 바 JSX + 표시 파생(applied/pending/saved/failureReason/boundaryLabel) 제거. activeFrame persistence(hydration+PATCH effect)·updateSafetyFilter 보존. sentinel 2개(safety-save-state-fix·preferences-safety) 바-UI 블록 → 바 제거 정합으로 갱신(persistence/helper 보존).
- **B 트렌드 차트 제거**(시안 기준): TREND_DATA(mock 상수)+LineChart 렌더+recharts/TrendingUp import 제거.
- **C 안전 판단 요약 패널 신축**(시안 §3): "오늘의 안전 판단"→"안전 판단 요약". 도넛+범례(0값 회색)+가장 시급 배너+GMP/KOSHA 준비도 바(canonical 충족률 파생: koshaReadiness=MSDS보유율, gmpReadiness=MSDS+점검 완료율)+MSDS 일괄 CTA(패널 open, 미등록 0이면 disabled)+lg:sticky.
- **D KPI 코너 배지**(시안 §2): 대장 등록/규정 준수 불가/미분류/점검 이력 없음 + 0값 회색 + 아이콘 박스→inline(CLAUDE.md §1). 호버 팝오버 보존. "전월 대비 +2" 가짜 델타→"재고 대장 기준"(honesty).
- **E AI 큐 전체보기 푸터**(시안 §4): "전체 N건 보기"→`#safety-chem-list` scroll(실 동작).
- **KPI축소(핸드오프-KPI축소, 같은 배치 폴드):** 같은 KPI 카드 className 압축 — 패딩 p-5→p-3.5 md:p-4, 값 text-3xl→text-2xl md:text-3xl, 코너 배지 모바일 숨김(hidden sm:inline-flex), 2열 유지(grid-cols-2 lg:grid-cols-4). 호버 팝오버 보존. CLAUDE.md §1 정합. (보조설명 모바일 숨김은 4개 조건부라 생략.)
- sentinel `safety-top-redesign.test.ts`(상단정합+KPI축소). ⏳ operator: vitest(신규+갱신 2개 GREEN·baseline)·tsc·build.

## 10. Progress
- Overall: ~90% (③ 보류) · Current: 마무리(톤/empty) 코드완료(operator 게이트 대기) · Blocker: 없음 · Next: ③ 마법사는 패키지 생성 백엔드 follow-up 후
- [x] P0 · [x] P3(큐 cap8+스크롤) · [x] write no-op 해소(①) · [x] ②밀집테이블/필터칩/bulkbar · [~] ③ 마법사=보류(백엔드 미존재, 호영님 결정) · [x] 톤/empty/mockup-잔재0
- **③ 결정(2026-06-27):** 패키지 생성/점검 일정 생성 전용 백엔드 부재(audit) → 비완결 마법사 신축은 soft dead-end. 호영님 "③ 보류 + 마무리" 선택. 현 honest 패널(대상목록+disabled 사유) 유지, ③는 백엔드 트랙 후.
- **마무리 서브배치(2026-06-27):** 톤 — amber-*/orange-* tailwind 클래스 0(muted yellow만, 형광 노랑 미사용) 확인. empty-state — 0종(등록 없음) vs 필터 0건 구분. mockup scaffolding(current/improved 토글·localStorage view) 0 확인(실배선 페이지). sentinel `safety-finalize.test.ts`. ⏳ operator: vitest/tsc/build.
- **② 서브배치(2026-06-27):** 반복 카드 → 밀집 테이블(☑·물질명·CAS·위험·보관·MSDS·점검·작업). 정렬(물질명·위험·보관 toggleSort), 14행 페이지네이션. 필터 칩 4종(전체/MSDS미등록/미점검/고위험, canonical=items 집계 단일 소스) + "N종 중 M종 표시". 다중선택 bulkbar(선택해제 real, MSDS/점검 일괄=③ 마법사 연결 전까지 disabled+사유=no-op 금지). dead Filter 버튼 제거. 행클릭=우측 rail 유지. sentinel `safety-chem-table.test.ts`. ⏳ operator: vitest/tsc/build.
- **P0 결론(수정):** write 엔드포인트 audit 결과 — 안전 페이지=product-scoped 인데 점검=inventory-scoped·폐기=엔드포인트 없음·MSDS=파일+스토리지 필요. "배선만으로 해소"는 MSDS만 성립.
- **write 서브배치(2026-06-27, 호영님 ① 선택 = 정직한 최소):**
  - MSDS: setTimeout+로컬flip+가짜토스트 제거 → `POST /api/products/[id]/sds`(multipart file), 503/400/401 분기, 성공 시 `safetyQuery.refetch()`(canonical=sdsDocuments 기반 hasMsds 재계산). `productIdByLocalId` 맵 캡처(기존 버려짐). 버튼 file 미첨부 시 disabled.
  - 점검·폐기: 가짜 핸들러(handleInspSave/handleDispose) 삭제 → confirm disabled+사유("재고 lot 단위 — 재고 화면 처리"). 확정 배선은 product↔inventory scope 정합 별도 트랙.
  - sentinel: `__tests__/regression/safety-write-wiring.test.ts`(POST sds·refetch·503/400·disabled·가짜토스트 0·큐 cap8).
  - ⏳ operator-shell: vitest(신규 GREEN·baseline 유지)·tsc·build → commit/push.

## 11. Notes
- 2026-06-27: 생성. 핸드오프=mockup, 현 페이지=실배선(§11.348-B-1). 레이아웃만 적용·canonical/no-op 0 강제. current/improved 토글·RAW 하드코딩·localStorage view 미이식. MSDS 버전검증 엔진·미배선 액션 백엔드 = OOS/follow-up. 백엔드 audit(P0)로 wired vs disabled 결정.
