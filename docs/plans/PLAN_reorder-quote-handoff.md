# Implementation Plan: §reorder-quote-handoff — 재발주 → 견적 핸드오프 배선 + UI 정직화 (1a–1d)

- **Status:** ⏳ Pending
- **Started:** 2026-08-05
- **Last Updated:** 2026-08-05
- **Estimated Completion:** TBD (Phase 0 실측 후 산정)

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

**Latest Truth Source (2026-08-05 실측, 계획 세션 — 어제자 사본 기준, ⚠️표는 실행 세션 최신 트리 재확정 필요):**
- 호영님 구현 지시문 + 시각 truth HTML(1a–1d, 2026-08-01 실기기 확인) — 요구 계약의 원본.
- `components/inventory/ReorderReviewSheet.tsx` — `hasVendor` 분기·`ENABLE_PURCHASING` 게이팅 기존재. "견적 요청 초안 만들기" = **query-string prefill 후 `/dashboard/quotes` 이동, DB write 0 (§11.310 Q30 명시 설계)**.
- **⚠️ 핵심 실측**: prefill 파라미터(`productName`·`quantity`·`reason`·`supplier`)의 **소비 코드 부재** (quotes page·quote-draft·intake dock 전수 grep 0) → 현행 CTA는 **초안 미생성 no-op 핸드오프**로 추정. 호영님이 본 `공급사 미정` 카드는 quote 카드 공용 empty state(vendorRequests 0, page L3241)로 추정 — 다른 경로 생성 quote였을 것.
- `app/dashboard/quotes/page.tsx` (4,966줄) — `dock`/`selected`/`source` query param 패턴 기존재(딥링크형 same-route 패널 인프라), "공급사 발송 검토" 모달 = 정식 발송 워크플로, `견적 대기` 문구 L3287·`예상 금액` 행 L4658.
- `app/dashboard/inventory/inventory-content.tsx` L538 — 헤더 KPI 3 소스(§inventory-delta-label-kpi P4). 모바일 뷰 `mobile-inventory-view.tsx` 별도. 레드 카드 스타일 정확 위치는 P0.
- `/quotes/{id}/prepare` 라우트 부재.

**Secondary References:**
- §11.310 Q30/Q31 (prefill 설계 결정) / §inventory-reorder-surface-unify / §quote-table-sian / PLAN_quote-dispatch-real-send-unify (발송 검토 모달 계약).

**Conflicts Found:**
- 지시문 1c "초안 생성 완료 시 라우팅" vs 실측 "초안 생성 자체가 없음" → **이 트랙의 실체 = 배선 신설 + UI 정직화** (지시문 전제 확장, 호영님 보고 완료 2026-08-05).
- 지시문 원안 `/quotes/{rfqId}/prepare` 신규 라우트 vs same-canvas 원칙 → **호영님 확정 (a) 딥링크형 same-route 패널** `/dashboard/quotes?prepare={id}` (기존 param 패턴 승계, 신규 페이지 0, 발송 검토 모달 연속 자연).
- §11.310 Q30 "DB write 0" 설계를 뒤집음 — 전환 근거: DB write 0 설계가 소비자 부재로 no-op이 됐고, 지시문의 핸드오프 연속성(직행·복귀·상태 pill)은 영속 초안 없이는 불가. 결정 전환을 본 계획이 공식화.

**Chosen Source of Truth:**
- 호영님 지시문 + 시각 truth HTML = UI 계약. Quote(DB) = 초안 truth (query-string은 전달 수단으로 강등). 발송 워크플로 truth = 기존 발송 검토 모달 (재구현 금지, 연속 진입만).

**Environment Reality Check:**
- [ ] 실행 세션 최신 트리에서 prefill 미소비 재확정 (어제자 사본 한계)
- [ ] 격리 /tmp vitest 환경 승계
- [ ] prod 접근 불요 (스키마 변경 없음 전제 — P0에서 초안 생성 API 실측 후 확정)

---

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker
- [x] Post-release (UX·핸드오프 정직화) — **호영님 지정 트랙 (2026-08-05, 실기기 확인 기반)**
- [ ] P2 / Deferred

**Why This Priority:**
재고→견적 핸드오프가 현재 no-op(초안 미생성 추정) — 재발주 권장의 실사용 첫 경로가 끊겨 있음. 현재 P1 충돌 없음.

---

## 2. Work Type

- [x] Feature (초안 생성 배선 + prepare 표면)
- [x] Bugfix (no-op 핸드오프)
- [x] Workflow / Ontology Wiring (inventory → quotes 핸드오프)
- [x] Web (모바일웹 우선, 반응형 동일 로직)
- [x] Design Consistency (KPI 강조 일원화·타이포 토큰)

---

## 3. Overview

**Feature Description:**
재발주 시트 CTA를 실제 초안 생성(DB write)으로 배선하고, 생성 직후 견적관리의 **딥링크형 발송 준비 패널**(`?prepare={id}`)로 직행시킨다. 공급사 0 품목은 CTA 정직화(바로 발주 hide + 예고 라벨), KPI 레드 이중 강조 제거, 나중에 저장 초안은 리스트 카드에서 할 일 표현으로 복귀 가능하게.

**Success Criteria (지시문 QA 7항 + 배선 계약):**
- [ ] 1a: KPI 3장 동일 흰 카드, 미달 카드는 숫자 `#b91c1c`+6px 점만. 강조는 재발주 배너 하나
- [ ] 1b: 공급사 0 → yellow 안내 + CTA `초안 만들고 공급사 지정 →` + **바로 발주 미노출**(대체 안내 1줄) + 보조 `공급사 소싱에서 먼저 찾기`. 공급사 있으면 기존 2버튼 유지
- [ ] 배선: CTA → **초안 실제 생성(DB write, 품목×수량·출처 메타 `재고관리 재발주안에서 생성`)** → `?prepare={id}` 직행 (리스트 경유 없음)
- [ ] 1c: 발송 준비 패널 — 헤더(RFQ mono·`방금 재고관리에서 생성됨`)·3스텝 pill(② 활성)·품목 카드(연동 배지·근거·2초 하이라이트 1회)·공급사 지정 패널(검색+소싱/이메일+이전 거래 추천 1줄)·CTA disabled+사유 → 지정 시 기존 발송 검토 모달 연속·`나중에 하기` 저장 링크
- [ ] 1d: 카드 pill `공급사 지정 필요`(amber)·CTA `공급사 지정하고 발송 →`(1c 복귀)·`예상 금액: 견적 대기` 행 숨김·진입 시 2초 하이라이트
- [ ] 타이포: 날짜 `YYYY. M. D.` 전역·RFQ/Lot mono 500/600·`tabular-nums` 전역
- [ ] 회귀 게이트 신규 실패 0

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 발송 검토 모달 재구현·변경 (연속 진입만)
- [ ] `/quotes/{id}/prepare` 신규 라우트 (호영님 (a) 확정 — same-route 패널)
- [ ] 바로 발주(PO) 경로 로직 변경 (1b는 노출 분기만)
- [ ] 재발주 추천 산출 로직·모바일 네이티브 앱(Expo) 반영 (모바일웹만)
- [ ] DB 스키마 변경 (기존 Quote 생성 API 재사용 전제 — P0 확정)

**User-Facing Outcome:**
재고 미달 → 재발주 시트 → 탭 1번에 초안 생성 + 공급사 지정 화면 직행 → 지정 → 발송. 막다른 골목·죽은 버튼·이중 강조 소멸.

---

## 4. Product Constraints

**Must Preserve:**
- [x] same-canvas: prepare는 quotes route 내 딥링크 패널 (신규 페이지 0)
- [x] 발송 검토 모달 = 발송 truth (연속 진입, 재구현 금지)
- [x] ENABLE_PURCHASING 게이팅·소싱 진입(onSearchVendors) 기존 배선 재사용
- [x] canonical truth: Quote(DB)가 초안 truth — query-string은 생성 입력 전달 수단으로 강등

**Must Not Introduce:**
- [x] dead button (공급사 0의 바로 발주 → hide+안내)
- [x] placeholder success (초안 생성 실패 시 이동 금지·에러 표시)
- [x] page-per-feature (prepare 패널로 흡수)
- [x] 하이라이트 애니메이션 반복 (1회만 — 재방문 미발생)

**Canonical Truth Boundary:**
- Source of Truth: Quote + QuoteItem (DB)
- Derived: prepare 패널 표시·리스트 카드 상태 pill(공급사 지정 필요 = vendorRequests/supplier 부재의 표현)
- Persistence Path: 기존 quote 생성 API (P0 확정)

**UI Surface Plan:**
- [x] Existing route section: inventory KPI·ReorderReviewSheet·quotes 리스트 카드
- [x] Filtered same-route state: `/dashboard/quotes?prepare={id}` 딥링크 패널 (bottom sheet(모바일)/right dock(md+) — P0에서 기존 패턴 확정)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 초안 생성 = 시트 CTA에서 mutation 후 id로 이동 (호영님 (a)) | no-op 해소의 유일 경로. 실패 시 이동 안 함(정직) | Q30 "DB write 0" 전환 — 근거 §0 기록 |
| prepare = `?prepare={id}` same-route 패널 | 딥링크·직행·복귀(1d CTA) 전부 충족 + page-per-feature 회귀 0 + 4,966줄 page와 상태 이원화 회피 | 신규 컴포넌트 분리 필수 (page 비대화 방지) |
| 1d 상태 pill은 파생 계산 (supplier 부재 → `공급사 지정 필요`) | 새 상태 필드 불필요 — 스키마 무변경 | — |
| 타이포 토큰은 전역 CSS + 유틸 (tabular-nums·mono) | 지시문 전역 통일 요구 | 전역 적용 회귀면 스코프 축소해 대상 표면 한정 (P0 판단) |

**Dependencies:**
- Required Before Starting: P0 실측 (prefill 미소비 재확정·quote 생성 API·KPI 스타일 위치·모달 진입 계약·패널 컴포넌트 형태)
- External Packages: 없음 (IBM Plex Mono — 기존 로딩 여부 P0 확인)
- Touched: `ReorderReviewSheet.tsx` / `inventory-content.tsx` / `mobile-inventory-view.tsx` / `quotes/page.tsx`(패널 mount·카드) / 신규 `components/quotes/prepare/*` / 글로벌 스타일 / 테스트

**Integration Points:**
- quote 생성 API (P0 확정) / 발송 검토 모달 오픈 계약 / onSearchVendors 소싱 진입 / quotes 리스트 카드 렌더

---

## 6. Global Test Strategy

Red-Green-Refactor 강제, 기존 규율 승계 (corrupt→RED·격리 /tmp·실행 세션 독립 검증 최종 권위·전달 파일 정체성 확인).
- 배선(생성 mutation·라우팅) → 동적 통합 테스트 (mock fetch/router 관측)
- UI 분기(1b hide·1c disabled+사유·1d pill) → 컴포넌트 동적 테스트
- 시각 정밀(색·간격·하이라이트) → 코드 리뷰 + 호영님 실기기 QA (P4) — 자동화 비대상 명시
- 지시문 QA 7항 = P4 체크리스트

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock (코드 변경 0)
**Goal:** 배선 접점·컴포넌트 실측 확정.
- Status: [x] Complete (2026-08-05 — 5/5 실측, §12)

**🔴 RED (확인 항목):**
- [ ] 실행 세션 최신 트리: prefill 미소비 재확정 (미확정 시 소비 지점 실측으로 계획 보정)
- [ ] quote 생성 API 후보 실측 (엔드포인트·필수 필드·출처 메타 수용 가능성)
- [ ] KPI 레드 스타일 정확 위치 (inventory-content + mobile view 양쪽)
- [ ] 발송 검토 모달 오픈 계약 (props/트리거) + 기존 bottom sheet/dock 패턴 중 prepare 패널 형태 확정
- [ ] IBM Plex Mono 로딩·tabular-nums 전역 적용 안전성
**🟢 GREEN:** §12 기록·계약 문장 확정
**🔵 REFACTOR:** 타이포 전역 vs 표면 한정 스코프 확정

**✋ Quality Gate:** 미확인 0건
**Rollback:** planning-only

#### Phase 1: Contract & Failing Tests
**Goal:** 배선·분기 계약 RED.
- Status: [x] Complete (2026-08-05 — sentinel 21건 처음부터 RED)

**🔴 RED:**
- [ ] 시트 CTA → 생성 mutation 호출 + 성공 시 `?prepare={id}` 이동·실패 시 이동 0+에러 (현행 no-op → RED)
- [ ] 공급사 0 분기: 바로 발주 미노출 + CTA 라벨 + 안내 (현행 → RED)
- [ ] prepare 패널: 스텝 상태·지정 전 CTA disabled+사유·지정 시 발송 검토 진입·나중에 저장
- [ ] 1d 카드: pill·CTA 복귀 링크·`견적 대기` 행 숨김
**🟢 GREEN:** 스캐폴딩만
**🔵 REFACTOR:** 커버리지 경계 명시 (시각 정밀은 P4 실기기 몫)

**✋ Quality Gate:** 신규 RED 처음부터 RED, 기존 inventory·quotes 스위트 회귀 0
**Rollback:** 테스트 revert

#### Phase 2: Core — 초안 생성 배선
**Goal:** CTA → DB write → id 획득 GREEN.
- Status: [x] Complete (2026-08-05)

**✋ Quality Gate:** 배선 테스트 GREEN, corrupt→RED+원복, no placeholder success
**Rollback:** mutation 배선 revert (기존 query-string 이동 복원)

#### Phase 3: UI Wiring — 1a·1b·1c·1d + 타이포
**Goal:** 4표면 + 토큰 GREEN.
- Status: [x] Complete (2026-08-05 — 21/21 GREEN·corrupt→RED 4종·회귀 142/0, §12)

**✋ Quality Gate:** 분기·상태 테스트 GREEN, 기존 표면 회귀 0, one-primary-CTA·터치 타겟(h-11) 준수, 신규 페이지 0
**Rollback:** 표면별 독립 revert

#### Phase 4: Rollout / QA
**Goal:** 지시문 QA 7항 + 실기기 확인 + push.
- Status: [ ] Pending

**✋ Quality Gate:** 실행 세션 독립 검증(파일 정체성 확인 포함) → 커밋·push 승인 게이트 → 배포 후 호영님 실기기 QA 7항 회신
**Rollback:** Phase 3 → 2 revert

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (해당)
**Resolver Input:** 재고 미달 → 재발주 권장 → 초안 생성 → 공급사 지정 → 발송
**Validation:**
- [ ] 강조 1원화 (배너 1개, KPI 카드 채색 0)
- [ ] row/시트 CTA가 실제 mutation+navigation (no-op 0)
- [ ] prepare 패널이 발송 검토 모달로 연속 (재고↔견적 왕복 0)

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| quotes/page.tsx(4,966줄) 비대화 | High | Med | prepare·카드 변경은 신규 컴포넌트 분리, page는 mount+param만 |
| tabular-nums 전역이 기존 표면 흔듦 | Med | Low | P0에서 스코프 판단 — 회귀 시 표면 한정 |
| 생성 API가 출처 메타 미수용 | Med | Med | P0 실측 — notes/reason 필드 재사용 우선, 스키마 변경은 별도 승인 |
| 어제자 사본 기준 실측 drift | Med | Med | P0 첫 항목 = 실행 세션 최신 트리 재확정 |

---

## 10. Rollback Strategy

- P1: 테스트 revert / P2: mutation 배선 revert(기존 이동 복원) / P3: 표면별 revert / P4: 전체 revert
- **Special:** DB 스키마 무변경 전제 — 생성되는 건 기존 Quote 행뿐이라 데이터 롤백 불요.

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0 대기
- Current blocker: 없음
- Next validation step: Phase 0 확인 항목 5건

**Phase Checklist:**
- [ ] Phase 0 / [ ] Phase 1 / [ ] Phase 2 / [ ] Phase 3 / [ ] Phase 4

---

## 12. Notes & Learnings

**Phase 0 Truth Lock 실측 (2026-08-05, 계획 세션 — 항목1은 디바이스 최신 트리 직접 grep):**

*측정1 — prefill 미소비 확정 (최신 트리)*: `get("productName")` 소비자 = `purchase-orders/new`(Q31 바로발주 ✓ 정상)·inventory API 3곳뿐 — **quotes 표면 0**. "견적 요청 초안 만들기" = 초안 미생성 no-op 핸드오프 **확정**. 관련 3파일 mtime 07-21~28 = 계획 사본 신선.

*측정2 — quote 생성 API*: `POST /api/quotes` (zod `quoteCreatePayloadSchema`, lib/validation/quote-create-schema.ts). items `[{productId(nullable ✓), vendorId, quantity, notes}]` — **productId nullable이라 신규/미매칭 품목 수용**, title 서버 fallback, notes·specialNotes로 출처 메타 전달 가능. `ReorderReviewInput.productId` 존재(null 허용) → 시트가 가진 데이터로 충분. **스키마 무변경 확정.**

*측정3 — KPI 레드 위치*: 데스크톱 `inventory-content` KPI 3은 **이미 de-red 완료**(§inventory-redesign P1 2026-07-09 — 흰 카드+숫자만 색, 클릭=필터 토글·testid 4종). 호영님 실기기의 레드 이중 강조는 **모바일 상태요약 2x2(§11.374 P3.3, mobile-inventory-view)** 소재로 확정 — 1a 스코프 = 모바일 뷰를 데스크톱 문법(흰 카드·숫자색·점)으로 정렬. 데스크톱 무접촉.

*측정4 — 발송 검토 진입 계약*: `VendorRequestModal`(dispatch/vendor-dispatch-workbench) + **발송 인텐트 2-step**(ConfirmSendModal 확인 → "발송 검토 계속" 시 진입, §11.279d 오발송 방지). prepare 패널의 "발송 검토로" CTA는 이 2-step 계약 재사용 (직접 진입 금지 — 기존 결정 준수). 패널 형태 = 기존 `dock`/`selected` param + bottom sheet(모바일)/dock(md+) 패턴 승계.

*측정5 — 타이포*: IBM Plex Mono 미로딩·`tabular-nums` 사용 0 (globals·config). **폰트 도입 필요** — Pretendard self-host(copy script) 패턴 검토. 전역 일괄 적용은 회귀 리스크 → **1차 스코프 = 이번 4표면의 코드 표시부(RFQ 번호·수량·금액) 한정**, 전역 확대는 P4 이후 별도 제안 (지시문 "전역 통일"의 단계 축소 — 호영님 승인 대상).

**Phase 1–3 실행 기록 (2026-08-05, 격리 /tmp vitest):**
- **P1**: `reorder-quote-handoff.test.ts` sentinel 21건(P2 배선 6·1a 2·1b 4·1c 5·1d 4) 처음부터 RED — repo UI 관례(mobile-reorder-gate 패턴, readFileSync+regex → operator 실 vitest 권위) 승계. 계획 §6의 "동적 통합" 문구는 이 관례로 대체(§12 기록으로 공식화). 시각 정밀은 P4 실기기 몫(커버리지 경계 헤더 명시).
- **P2 배선**: 시트 CTA → `POST /api/quotes`(items.notes=reason + specialNotes 출처 메타) → 성공 시 `?prepare={id}` 직행·실패 시 이동 0+에러 표기·pending disabled. 구 query-string 이동 제거 (§11.310 Q30 폐기 — 근거 §0).
- **P3 구현**: 1a inventory-main KPI 3장 흰 카드 통일(#b91c1c 숫자+6px 점) / 1b 공급사 0 → 안내 2줄(#fffbeb 계열)·CTA "초안 만들고 공급사 지정 →"·바로 발주 hide+대체 안내(공급사 有는 flag 게이팅 유지) / 1c `QuotePreparePanel` 신설(3스텝·하이라이트 1회·지정 게이트 disabled+사유·발송 인텐트 2-step 연속·나중에 하기) + page `?prepare=` mount / 1d 칩 "공급사 지정 필요"(yellow 토큰)·CTA "공급사 지정하고 발송"(onPrepare)·정보 0 행 → 생성일(YYYY. M. D.)·복귀 하이라이트.
- **호영님 결정 (2026-08-05)**: RFQ 서체 상충(07-21 본문 폰트 vs 08-01 mono 복원) → **07-21 유지** — 리스트 카드는 본문 폰트, prepare 패널 내부만 mono(코드 단독 표기). 지시문 amber hex는 07-20 색상 규약(앰버=yellow 토큰)으로 번역.
- **sentinel 승계 2파일**: `inventory-mobile-reorder-gate`(prefill lock → POST 계약, Q31 발주 경로 보존 단언 유지) / `quotes-mobile-refine-p1`(미정→지정 필요·추가→지정하고 발송 — 보호 의도 주석 보존). sweep: 구 문구 렌더 잔존 0 단언 추가.
- **게이트**: 21/21 GREEN + 승계 후 관련 스코프 14파일 **142 passed·0 failed**. corrupt→RED 4종(배선 소실·1b hide 소실·1d 문구 회귀·1c 게이트 소실) 각 targeted RED + 원복 diff-clean. `dashboard/quotes` 디렉토리 잔여 실패(60건)는 라이브 트리 재현 확인된 **기존 실패군**(quote-kpi-scroll-dots 등 — 이 changeset 무접촉). tsc·build는 push 전 게이트(실행 세션) 몫.
- 미충족 지시문 항목(정직 기록): 1c "품목 근거(현재/안전)" — Quote에 재고 근거 데이터 부재로 미표시(가짜 금지). 1c "이메일로 추가" 버튼 — 발송 검토 단계 소관이라 캡션 안내로 대체(dead button 회피). 1d "재고관리 재발주안에서 생성" 문구 — 리스트 카드 데이터(specialNotes 미포함)로 미표시, 생성일로 대체. 필요 시 후속 트랙.

**계획 시점 기록 (2026-08-05):**
- 호영님 결정: 1c = (a) 딥링크형 same-route 패널 `?prepare={id}` ("권고 가자") — 지시문 원안 신규 라우트 기각.
- 계획 세션 실측이 지시문 전제를 확장: 현행 핸드오프는 "표시 없음"이 아니라 **초안 미생성 no-op 추정** (prefill 소비자 0) — §11.310 Q30 "DB write 0" 설계 전환을 본 계획이 공식화.
- 시각 truth HTML(1a–1d)은 업로드 원본 보존 — 구현 시 색·간격·문구의 권위.
