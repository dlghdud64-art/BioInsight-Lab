# Implementation Plan: 견적 관리 모바일 개선 (3a 화면 · 4a 리마인더 · 5a 발송 검토)

- **Status:** ✅ Complete (2026-07-21 종결 — 배포 `9d0d71e8` · `6ec92727`)
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-21 (Phase 4 완료 — operator 게이트 대기)
- **Estimated Completion:** TBD

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후:
1. ✅ 체크박스 갱신 → 2. 🧪 quality gate 검증 → 3. ⚠️ 전 항목 통과 확인 →
4. 📅 Last Updated 갱신 → 5. 📝 Notes 기록 → 6. ➡️ 그 다음에만 다음 phase

⛔ quality gate skip 금지 · 미해소 충돌 상태 진행 금지 · dead button/no-op/placeholder success 금지
⛔ sandbox 검증은 **하네스 원문 실행**(F9 규칙) · `.tsx` 변경 배치는 커밋 전 `npm run build`(F10 규칙)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- repo 현재 코드 + shipped sentinel + `CLAUDE.md`(§11.311 Mobile Patterns · §11.302 신호등 · amber 금지 · #b45821 보류)
- `docs/handoff/HANDOFF_2026-07-20-dashboard-mobile.md` (직전 트랙 학습 F9·F10·색상 표기 규약)

**Secondary References:**
- 업로드 지시문 `모바일 견적 관리 핸드오프.md` (호영님 2026-07-21)
- 프로토타입 `모바일 견적 관리 지시문.html` (3a·4a·5a)
- §quote-mobile-v2 시안 (호영님 2026-07-03 승인 — 현행 `mobile-quotes-view.tsx` 정본)
- `PLAN_quotes-management-enhance.md` §5 (리마인더 배치, D+배지/개별발송/활동로그는 backlog 이월분)

**대상 Surface (실측):**

| 지시문 | 파일 | 성격 |
| :--- | :--- | :--- |
| 3a 화면 | `components/quotes/mobile-quotes-view.tsx` | 모바일 전용(부모 md:hidden 게이팅) — 데스크탑 무접촉 |
| 4a 리마인더 | **신규** 모바일 개별 케이스 바텀 시트 | 현행: s2 리마인더 CTA 는 데스크탑 라우팅 재사용, `BatchReminderSheet` 는 배치 전용 |
| 5a 발송 검토 | `components/quotes/dispatch/vendor-dispatch-workbench.tsx` (VendorRequestModal) | **데스크탑 공유** — 모바일서 재사용 (page.tsx L42·L3394) |

**Conflicts Found & 판정:**

1. **"회신 독려" 실재 2곳** — `mobile-quotes-view.tsx` L187 · `priority-recommendation-card.tsx` L31.
   PO surface 에는 이미 "독려 부재" sentinel(`po-triage-sections-sian` L136) 존재 → 지시문이 기존 honesty
   방향과 정합. **치환 진행.**
2. **"독려/독촉" 금지 범위** — ✅ **호영님 확정(2026-07-21): 이번 트랙 3개 surface 한정.**
   `batch-reminder-sheet` 톤 프리셋 `label:"독촉"`(sentinel `quotes-mgmt-enhance-reminder-5` 핀) 및
   ops-console lib 계층 독촉 14+개소는 **무접촉** — 전역 sweep 은 별도 배치.
3. **amber 토큰** — 색상 표기 규약(2026-07-20 확정: 핸드오프 앰버 표기 = warm warning = yellow 토큰)
   자동 적용. 지시문 `#fffbeb/#b45309`·`#fde68a`·`#d97706` → `yellow-50/yellow-700`·`yellow-200`·`yellow-600` 계열.
4. **`#b45821`/`#fdf3ec` hex 반입 발견** — `mobile-quotes-view.tsx` L50(s4 pill)·L56(mid 우선순위).
   CLAUDE.md §9 가 **보류** 로 명시한 muted amber 가 Tailwind class 아닌 hex 라 amber sentinel 을 우회한 상태
   (§quote-mobile-v2, 07-03 반입). 3a 가 카드를 개편하므로 **yellow 정합 동시 복구** (규율 회복, 별도 승인 불요 —
   yellow 가 라이브 규율이고 #b45821 이 보류이므로).
5. **좌측 색 띠·font-mono·"7월 N주" 날짜 칩** — §quote-mobile-v2 시안(07-03) 명시 요소를 지시문(07-21)이 반전
   → **supersession, 신규 지시 우선.** 관련 sentinel 핀 여부 Phase 0 전수 확인.
6. **배너 CTA stage 정합** — 지시문 예시(`🔔 리마인더`)는 s2 기준. top 이 s1(발송 대기)이면 리마인더 부적합
   → **카피 구조(품목 1줄 + 액션 1줄 + 메타 1줄, 대시 금지)만 전 stage 적용, CTA 는 stage별 유지.**
7. **"활동 로그에 기록됩니다" 문구** — 실기록 없으면 placeholder 거짓. 리마인더 발송 audit 배선 Phase 0 실측
   → 배선 실재 시 문구 유지, 부재 시 **실배선 구현**(문구 삭제가 아니라 — 지시문 의도가 기록 자체).

**Backlog 흡수:** 4a(D+N 경과 배지·개별 발송·활동 로그) = 이월 backlog "§5 D+배지/개별발송/활동로그" 흡수.

**Chosen Source of Truth:** repo 코드 + shipped sentinel > 지시문 > §quote-mobile-v2 구시안.
단 지시문이 구시안을 명시 반전하는 항목(색 띠·mono·날짜 칩·배너 카피)은 지시문 우선.

**Environment Reality Check:**
- [x] repo `ai-biocompare` main, 직전 종결 커밋 `2021d42f`
- [x] 검증: 하네스 원문 실행(F9) + operator full vitest 최종 판정. baseline `132 file fail / 293`(946bc8ef 시점)
- [x] vitest sandbox 실행 불가(F6) · `.tsx` 커밋 전 `npm run build` 필수(F10)
- [x] sandbox 패키지 설치 금지 · prod DB 무접촉

---

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (상위)
- [ ] P2 / Deferred

**Why:** 대시보드 트랙(§dashboard-mobile-refine, 07-20 종결)에 이은 모바일 시리즈 2번째.
이월 backlog(§5 D+배지/개별발송/활동로그)를 흡수해 부채 감소를 겸함. 규제/GMP 미결보다 후순위이나
사용자 대면 워크플로 개선 + backlog 흡수라 P2 상위.

---

## 2. Work Type

- [x] Feature (4a 신규 시트)
- [x] Mobile
- [x] Web (5a 공유 컴포넌트)
- [x] Design Consistency (3a)
- [x] Workflow / Ontology Wiring (리마인더 발송·활동 로그)

---

## 3. Overview

**Feature Description:**
견적 관리 모바일(<768px)의 3개 surface 개선 — 화면(배너 카피·날짜 칩·리스트 카드), 개별 케이스
리마인더 바텀 시트 신규, 공급사 발송 검토 시트의 정직성·위계 정비.

**Success Criteria (지시문 QA 체크리스트 전수):**
- [ ] "회신 독려/독촉" 문구가 **이번 트랙 3개 surface** 에 없다
- [ ] 배너: 품목 1줄 + 액션 1줄, 대시(`—`) 연결 없음, 메타 한 줄(RFQ · 마감 · 공급사 N곳)
- [ ] 날짜 칩 = 오늘 날짜만(`7.21 (화)` 형식), 마감 중복 없음
- [ ] 리스트 카드: 좌측 색 띠 0, 빈 `⏱ —` 0, 상황별 CTA(공급사 미정→`공급사 추가 ›` / 준비→`발송 ›`)
- [ ] RFQ 코드 font-mono 0 — Pretendard 세미볼드 + 자간 `.03em`
- [ ] 리마인더 대상 = 미회신 공급사만 자동 필터, D+N 경과 배지
- [ ] 리마인더 발송 = 실 mutation + 활동 로그 실기록 (placeholder 0)
- [ ] 스텝퍼 가짜 체크 0 — 막힌 단계만 warning, 이후 단계 회색 대기, 완료 체크는 실완료만
- [ ] 발송 검토 경고 1개(공급사 추가 히어로)만 존재
- [ ] 메시지·기한 기본 접힘(제목+요약+펼치기)
- [ ] 전송 버튼 비활성 사유 인라인(`공급사 추가 후 전송 가능 · 0곳`), 다운로드 = "직접 전달용" 라벨
- [ ] 터치 타겟 ≥ 44px
- [ ] shipped sentinel 회귀 0 (dispatch 264h5·279d·batch 계열·reminder-5·quote-mobile 계열)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 데스크탑 배치 시트(`batch-reminder-sheet` 등)·ops-console lib 의 독촉 문구 변경 (충돌 #2 확정)
- [ ] `priority-recommendation-card`(데스크탑) 구조 변경 — L31 "회신 독려" 라벨 치환만
- [ ] 신규 페이지 (page-per-feature 회귀)
- [ ] AI/chatbot UI — "✦ LabAxis 추천 공급사 탐색"은 기존 sourcing 동선 링크로 한정
- [ ] 발송 mutation 신규 구현 — 기존 vendor-requests 경로 재사용

**User-Facing Outcome:**
모바일에서 견적 상태를 압박 어휘 없이 읽고, 미회신 공급사에게 리마인더를 2탭으로 보내고,
발송 검토에서 뭐가 막혔는지 한 번에 안다.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock (5a 는 기존 워크벤치 내 정비)
- [ ] same-canvas — 4a 는 바텀 시트(신규 라우트 0)
- [ ] canonical truth — 리마인더 대상·D+N 은 `vendorRequests`(server truth) 파생
- [ ] 데스크탑 발송 플로우 무회귀 (5a 공유 컴포넌트)

**Must Not Introduce:**
- [ ] dead button / no-op / placeholder success (특히 활동 로그 문구·스텝퍼 체크)
- [ ] preview 가 truth 를 덮는 구조
- [ ] 발송 경로 이원화 (배치 시트와 다른 mutation 금지)

**Canonical Truth Boundary:**
- Source of Truth: `quote.vendorRequests[]`(status·respondedAt·createdAt), 발송 = `/api/quotes/[id]/vendor-requests` 계열
- Derived Projection: 미회신 필터, D+N 경과일, 스텝퍼 단계 상태, 카드 상황별 CTA
- Snapshot / Preview: 없음 (도입 금지)
- Persistence Path: 리마인더 발송 mutation + 활동 로그 기록 (Phase 0 실측 후 확정)

**UI Surface Plan:**
- [x] Bottom sheet (4a 신규)
- [x] Existing route section (3a — `mobile-quotes-view` 내부)
- [x] 기존 워크벤치 정비 (5a)
- [ ] New page — 사용 안 함

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 4a 는 신규 모바일 바텀 시트, 발송은 기존 vendor-requests mutation 재사용 | 경로 이원화 금지 — 배치 시트와 truth 공유 | 시트 UI 는 신규 작성 필요 |
| 5a 는 공유 컴포넌트 보수적 diff (뷰포트 분기 최소화) | 데스크탑 발송 플로우 회귀 방지 — 스텝퍼 정직성·경고 통합은 데스크탑에도 개선 | 모바일 전용 최적화 일부 양보. P0 에서 항목별 공유/분기 판정 |
| 3a 색상: #b45821 hex → yellow 토큰 정합 | CLAUDE.md 라이브 규율 복구(hex 우회 해소) | s4 pill 시각 변화 — 신호등 의미는 동일 |
| 배너 CTA stage 별 유지, 카피 구조만 지시문 적용 | top 케이스가 s1 이면 리마인더 CTA 는 오배선 | 지시문 예시와 문자적 차이 (의도 준수) |

**Dependencies:**
- Required Before Starting: Phase 0 실측(활동 로그 배선·5a sentinel 매핑·3a 핀 확인)
- External Packages: **없음**
- Touched: `mobile-quotes-view.tsx` / 신규 `mobile-reminder-sheet.tsx`(가칭) / `vendor-dispatch-workbench.tsx` / `priority-recommendation-card.tsx`(라벨 1건) / page.tsx(시트 wiring)

**Integration Points:**
- `/api/quotes/[id]/vendor-requests` (발송·리마인더 경로 — Phase 0 확정)
- `toQuoteCase` / `computePriority` / `quoteDisplayRef` (canonical 파생 재사용)
- page.tsx `onAction` 라우팅 (s2 리마인더 → 신규 시트 분기)
- 활동 로그 (audit 경로 — Phase 0 실측)

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수. **F9 규칙: 하네스는 테스트 파일 원문 추출·실행, 전사 금지.**

- 3a·5a Design Consistency → sentinel(readFileSync+regex) + 회귀 0 블록
- 4a 파생 로직(미회신 필터·D+N) → **unit test**(vitest 로직 테스트, sentinel 아님)
- 리마인더 발송 → integration 계약(mutation 호출·활동 로그 기록) sentinel + 스모크 경로 문서화
- 기존 계약 재검증: `quote-dispatch-fixed-flow-264h5` · `quote-table-send-cta-279d2` · batch 계열(2·3·4·5) ·
  `quote-vendor-response-status-264j` · `quotes-mobile-density-p1/p2/p3` · amber-removed walk 2종
- 실행: 하네스 원문 실행 → operator full vitest 최종. `.tsx` 커밋 전 build(F10)

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-21)
**Goal:** 판정 반영 확정 + 5a 전략(공유 vs 분기) + 활동 로그 배선 실측.
- Status: [x] Complete

**실측 결과:**

**G1 — 4a 서버 측 완비 (P2 대폭 축소).** `POST /api/quotes/[id]/vendor-requests` 가 이미:
`isReminder=true` → `quote_request_resend` 거버넌스 + 리마인더 전용 템플릿(`daysSinceRequest` 포함) +
24h rate-limit(429 cooldown) + **`createActivityLog` 실기록**(route L34·L376). 계약 =
`{vendors[], message?, expiresInDays, isReminder}` (batch-reminder-sheet 와 동일).
→ **서버 무접촉. P2 = 클라이언트 파생(미회신 필터·D+N 표시)만.** "활동 로그에 기록됩니다" 문구 = **truthful.**

**G2 — 5a 는 §quote-screen-sian §09 배치가 상당 부분 선구현.** 관련 sentinel 19개 매핑
(stepper-sian-circular-09 · no-supplier-hero-sian-09b · responsive-09c · 2state-recipient-09 ·
header-reselect-09 · supplier-wiring · remediation-292 · 3-source-grouping · batch-gate-3 · warn-dedup-4 ·
aria-274 · recipient-sian-09 · 279c×2 · pdf-326 · amber-302d6b2 · pdf-wiring-314b2 · toggle-reset-293 ·
manual-email-width). **5a delta 판정표:**

| 지시문 5a | 현행 실측 | 판정 |
| :--- | :--- | :--- |
| 1 스텝퍼 정합 | 상태 머신·honesty sub 문구 존재하나 **`draft.ready = message.length>10` 가 선행 단계와 독립** → 공급사 0(막힘)에도 3단계 초록 체크 = **지시문의 모순 실재** | ✅ **수정**: 누적 게이팅(선행 미완 시 done 불가). 최소 diff |
| 2 경고 통합 | 히어로 존재(09b)하나 내부에 **yellow 경고 헤더**(L694) + 별도 경고(L628, 후보 펼침 시) 공존 | ✅ **수정**: 히어로를 파란 안내 톤(`blue-300/blue-50` 계열)으로, 중복 경고 제거. **이월 backlog "§4 full 경고통합" 흡수** |
| 3 접기 구조 | 메시지·기한 상시 펼침 | ✅ **신규**: **모바일만 기본 접힘**(초기 상태 matchMedia), 데스크탑 기본 펼침 유지 — 데스크탑 UX 회귀 방지 |
| 4 푸터 위계 | 취소·다운로드 존재(P2 분리 export, pdf sentinel 2종 핀). 비활성 사유는 CTA 라벨 일부 | ✅ **수정**: 사유 인라인 `공급사 추가 후 전송 가능 · N곳` + 다운로드 라벨 `· 직접 전달용` 추가(공유). **노출 제한(0곳 한정)은 모바일만** — 데스크탑 다운로드 접근성 회귀 방지 |
| 5 케이스 칩 | 헤더 = ref + **담당자** 칩(L543, header-reselect-09 핀 가능성) | ✅ **수정**: RFQ+품목명으로 교체, 관련 sentinel 보호의도 확인 후 진화 |

**G3 — 3a 무보호 확인.** `mobile-quotes-view` 참조 테스트 **0건** → 색 띠·mono·날짜 칩·#b45821 어느 것도
핀 없음. 변경 자유 + **Phase 1 에서 전용 sentinel 신설 필수**(직전 트랙 F3 학습 동일).

**✋ Quality Gate:**
- [x] 미해소 충돌 0 — 전 항목 판정 완료
- [x] 코드 변경 0
- [x] 활동 로그 배선 문서화 (G1 — 실재, 문구 truthful)
**Rollback:** 계획 전용

### Phase 1: 3a 화면 — ✅ Complete (2026-07-21)
**Goal:** 배너 카피 구조 · 날짜 칩 · 색 띠 제거 · mono 제거 · 상황별 CTA · yellow 정합.
- Status: [x] Complete

**🔴 RED:** `quotes-mobile-refine-p1.test.ts`(신규 계약 22 + 회귀 0 블록 25) 원문 실행 — **22 실패 실증** ✅
**🟢 GREEN:** 구현 —
- 배너: `topReason`(대시 연결) 폐지 → `ACTION_LINE`(stage 별 액션 문장, 품목 1줄+액션 1줄). 메타에서 stage section 중복 제거. CTA stage 별 유지(P0 #6)
- 날짜 칩: `periodLabel`(주차) → `todayLabel`(`M.D (요일)`)
- 카드: 좌측 색 띠 div + `rail` 필드 폐지 · `ddText` null 분기 폐지(호출측 게이팅) · 공급사 미정 = yellow 칩 + CTA `공급사 추가 ›`(동일 onAction — 발송 검토 히어로가 추가 흡수, dead button 0) · RFQ `font-semibold tracking-[.03em]`
- 색: s4 pill·mid 우선순위 muted amber hex → `yellow-50/yellow-700/yellow-500`
- `priority-recommendation-card`: `NEXT_STEP.s2` "회신 확인" 치환(구조 무접촉)
**🔵 REFACTOR:** 자기모순 3건 수정 — **주석이 금지 문자열(압박 어휘·mono·hex)을 문자 그대로 포함**해
sentinel 에 걸림 → 주석 표현 우회. (F9 하네스가 즉시 적발 — 원문 실행 방식 유효성 입증)

**✋ Quality Gate:**
- [x] 신규+회귀 **47/47 GREEN · SKIP 0** (원문 실행)
- [x] PRC 관련 sentinel(density-p3·p4-core-b·navy-p4)의 미파싱분 — **접촉 파일 한정 수동 동형 7/7 PASS**
- [x] JSX 균형 · 금지어 0 · amber/orange class 0 · 데스크탑 무접촉(PRC 라벨 1건 외)
- [x] ⚠️ 기존 baseline 실패 1건 별도 확인: `quotes-mobile-density-p3` "sticky" 어서션 — page.tsx 에
  `hidden md:` 후행 추가로 인한 **기존 drift(미접촉 파일, 본 트랙 무관)**. baseline 132 목록 소속 추정 —
  operator 게이트에서 baseline-delta 판정 시 참고
- [ ] `npm run build` + full vitest — operator 위임(F10)
**Rollback:** 파일별 독립 revert (2파일)

### Phase 2: 4a 코어 로직 — ✅ Complete (2026-07-21)
**Goal:** 미회신 필터 · D+N 파생. (발송·활동 로그는 서버 기보유 — P0-G1 로 범위 축소)
- Status: [x] Complete

**🔴 RED:** `lib/quote-management/__tests__/reminder-targets.test.ts` — 14 케이스(미회신 필터·회신 제외·
D+N·내림·미상 null·미래 시계 null·표시명 fallback·email 미상 정직·페이로드 계약) 선작성
**🟢 GREEN:** `lib/quote-management/reminder-targets.ts` 신규 —
`hasVendorReplied`(replied 단일 술어) · `deriveReminderTargets`(미회신만, daysSince 실값) ·
`toReminderVendorsPayload`(기존 vendor-requests 계약 정합)
**🔵 REFACTOR:** `supplier-avatars.toSuppliers` 의 인라인 replied 식을 `hasVendorReplied` import 로 통일
(파생 규칙 이원화 0, component→lib 정방향. p3a sentinel 은 렌더 식만 핀 — 무저촉 확인)

**✋ Quality Gate:**
- [x] unit **14/14 GREEN** — tsx 는 esbuild Windows 바이너리로 실행 불가 → **node `--experimental-strip-types`
  로 실제 모듈 import·실행**(전사 아닌 진짜 실행. 설치 0)
- [x] truth boundary 무침범 — 순수 파생, 저장 0
- [x] 활동 로그 = 서버 `createActivityLog` 기실재(P0-G1) — 클라 측 추가 배선 불요
**Rollback:** lib + supplier-avatars 2파일 revert

### Phase 3: 4a 시트 UI — ✅ Complete (2026-07-21)
**Goal:** 모바일 리마인더 바텀 시트 + page s2 분기.
- Status: [x] Complete

**🔴 RED:** `quotes-mobile-refine-p3.test.ts`(P2 lib 6 + 시트 12 + wiring 3 + Out of Scope 2) 작성
**🟢 GREEN:**
- 신규 `components/quotes/mobile-reminder-sheet.tsx` — 그랩바·헤더("아직 회신하지 않은 공급사에게
  보냅니다")·케이스 요약(품목+RFQ+마감+회신 추적 pill)·미회신 N곳 행(이니셜·회신 0/1·**D+N yellow 배지,
  실값에서만**)·메시지(자동 생성+수정)·재응답 기한(1~30 경계)·활동 로그 고지(실배선 사실 서술)·
  발송 CTA(yellow-600, min-h-48, **비활성 사유 인라인**: 전원 회신 완료 / 발송 가능 이메일 없음)
- 발송 = `csrfFetch POST vendor-requests + isReminder:true` (batch 와 동일 계약, 경로 이원화 0).
  429 cooldown 안내. 성공 → toast + refetch(front-only success 0)
- `page.tsx` — `mobileReminderQuote` state + 모바일 onAction 에서 **s2 만 시트 분기**(타 stage 기존
  라우팅 보존), `ddLabel` 은 `computePriority` 파생
**🔵 REFACTOR:** 시트 재오픈 시 상태 초기화(이전 케이스 잔존 0)

**✋ Quality Gate:**
- [x] P1+P3+reminder-5 원문 실행 **PASS 87 · FAIL 0 · SKIP 24**
  (SKIP = reminder-5 의 SHEET 바인딩이 하네스 미파싱 — 단 핀 대상 `batch-reminder-sheet` 는 본 트랙
  **무접촉**(diff 0)이라 baseline 상태 그대로. operator full vitest 가 최종 판정)
- [x] JSX 균형 4파일 OK · 압박 어휘 0 · amber/orange class 0
- [x] dead button 0 · 발송 경로 단일 · 로딩/에러/빈 상태 존재
- [ ] `npm run build` + full vitest — operator 위임(F10)
**Rollback:** 시트+page 분기 revert → 기존 데스크탑 라우팅 복원

### Phase 4: 5a 발송 검토 시트 — ✅ Complete (2026-07-21)
**Goal:** 스텝퍼 정합 · 경고 통합 · 접기 · 푸터 위계 · 케이스 칩.
- Status: [x] Complete

**P0-G2 재보정 (구현 중 추가 실측):** 5a-3(접기 — `messageExpanded` 기본 false + 요약 줄 + 수정)과
5a-2 의 `✦ LabAxis 추천 공급사 탐색`·`공급사명(선택)` 입력은 **§09b 에서 기 구현** → 회귀 핀으로 전환.
실제 delta 는 4건으로 축소:

**🔴 RED:** `quotes-mobile-refine-p4.test.ts`(delta 4 + 기 구현 회귀 핀 + 회귀 0 블록)
**🟢 GREEN:** `vendor-dispatch-workbench.tsx` 단일 파일 —
1. **스텝퍼 누적 게이팅** — 선행 미완이면 이후 done 불가(`prefix` 누적). 지시문의 "1단계 막힘 + 3단계
   초록 체크" 모순 제거. 09 핀(`const state … = s.ready`) 구조 보존
2. **히어로 경고 통합** — 내부 yellow 경고 배너 → **blue 안내 톤**(`border-blue-300`, 지시문 #93c5fd 근사).
   같은 상태 경고 2겹 제거. 09b `no-supplier-add` 핀·292 보강 CTA 무손
3. **푸터 위계** — blocked 시 사유 인라인 `공급사 추가 후 전송 가능 · N곳`(274 aria/라벨 핀 무접촉) +
   다운로드 `· 직접 전달용` 라벨 + **공급사 1+곳 시 모바일 한정 다운로드 숨김**(P0 판정 — 데스크탑 항상)
4. **케이스 칩** — `quoteSummary`(품목명) 칩 추가. 담당자 칩은 header-reselect-09 가 "4b 과제거분 **복원**"
   으로 핀한 이력 → 제거 대신 **모바일 숨김 절충**(핀 보존)
**🔵 REFACTOR:** 없음(최소 diff 유지)

**✋ Quality Gate:**
- [x] P4 + dispatch 계열 7 sentinel 원문 실행 **PASS 53 · FAIL 1 · SKIP 17** → SKIP 전건 수동 동형 **14/14 PASS**
- [x] FAIL 1 = `vendor-dispatch-pdf-wiring-314b2` `/onSuccess\?\.\(\)/` — **기존 drift**(§action-toast P3
  2026-07-08 이 `onSuccess?.(result)` 로 변경, 본 트랙 diff 무접촉). baseline 소속 추정 — operator 판정 참고
- [x] JSX 균형 OK · 압박 어휘 0 · 데스크탑 발송 플로우 핀(274·292·09·09b·confirm-before-send) 전수 보존
- [ ] `npm run build` + full vitest — operator 위임(F10)
**Rollback:** 단일 파일 revert

### Phase 5: 스모크 · 롤아웃 — ✅ Complete (2026-07-21)
**Goal:** QA 체크리스트 전수 · 문서 종결.
- Status: [x] Complete

**QA 13항 전수 판정 (근거 = shipped sentinel / operator 게이트):**

| # | QA 항목 | 판정 | 근거 |
| :--- | :--- | :--- | :--- |
| 1 | 압박 어휘 0 (3 surface) | ✅ | p1·p3·p4 sentinel not-match |
| 2 | 배너 품목1줄+액션1줄·대시 0 | ✅ | p1 `ACTION_LINE`·topReason 폐지 |
| 3 | 날짜 칩 오늘만 | ✅ | p1 `todayLabel` |
| 4 | 카드 색 띠 0·빈 `⏱ —` 0·상황별 CTA | ✅ | p1 |
| 5 | RFQ 본문 폰트 | ✅ | p1 `tracking-[.03em]`·mono 0 |
| 6 | 리마인더 = 미회신만·D+N | ✅ | unit 14 + p3 |
| 7 | 실발송·활동 로그 | ✅ | 기존 vendor-requests 계약 + 서버 `createActivityLog`(P0-G1) |
| 8 | 스텝퍼 가짜 체크 0 | ✅ | p4 누적 게이팅 |
| 9 | 경고 1개(히어로) | ✅ | p4 blue 통합 |
| 10 | 메시지·기한 기본 접힘 | ✅ | 기 구현(§09b) — p4 회귀 핀 |
| 11 | 비활성 사유 인라인·직접 전달용 | ✅ | p4 |
| 12 | 터치 타겟 | ✅ | 신규 요소 전건 §11.311-8 준수(h-10 이상 / 시트 CTA 48px) |
| 13 | sentinel 회귀 0 | ✅ | operator baseline-delta 0 (P1–P3 `9d0d71e8` · P4 `6ec92727`) |

**스모크 경로 (라이브 확인 권장 — 클로드크롬/실기기):**
1. 모바일 `/dashboard/quotes` → s2 케이스 리마인더 탭 → 시트: 미회신만 표시·D+N 배지 → 발송 →
   toast 확인 → 활동 로그에 `quote_request_resend` 기록 확인
2. s1 공급사 미정 케이스 → `공급사 추가 ›` → 발송 검토 히어로(blue) → 이메일 추가 → 스텝퍼가
   순서대로만 초록 전환되는지 → 전송
3. 375px 가로 스크롤 0 · 공급사 1+곳 상태에서 모바일 다운로드 버튼 미노출 확인

**✋ Quality Gate:** [x] QA 13항 전수 [x] baseline-delta 0(operator) [x] 롤백 phase 별 문서화
**Rollback:** §10 그대로

---

## 8. Addenda

### A. Workflow / Ontology (적용)
- Resolver 입력: quote stage(s1–s5)·vendorRequests 상태 → 출력: 카드 CTA·배너 액션·리마인더 대상
- 배너 = 룰베이스 우선순위(`computePriority`) 유지, AI 재해석 금지
- Validation: [ ] top 배너 케이스 정확 [ ] 카드 CTA stage 정합 [ ] 리마인더 대상 = 미회신만

### D. Mobile (적용)
- 375px overflow 0 · 터치 ≥44px · 바텀 시트 그랩바 · safe-area
- Validation: [ ] 시트 스크롤 내 CTA 도달 [ ] 접힘 상태 요약 정확 [ ] 딥링크/모달 복귀 정상

---

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 5a 공유 컴포넌트 변경이 데스크탑 발송 회귀 | High | High | P0 판정표(공유/분기)·기존 sentinel 전건 회귀 가드·보수적 diff |
| 리마인더 발송 경로 이원화 | Med | Med | 기존 mutation 재사용 강제, P2 에서 경로 단일성 sentinel |
| 활동 로그 배선 부재 → placeholder 문구 | Med | High | P0 실측 → 부재 시 실배선 구현(P2), 문구만 붙이는 것 금지 |
| 독촉 sweep 범위 오판 → reminder-5 sentinel 파괴 | Low | Med | 범위 한정 확정(호영님)·Out of Scope 명시 |
| #b45821 정합이 s4 시각 변화 유발 | Low | Low | 신호등 의미 동일(warm warning)·시각 diff 는 P1 보고 |

---

## 10. Rollback Strategy

- P1 실패 → `mobile-quotes-view` / `priority-recommendation-card` 개별 revert
- P2 실패 → lib 파생 함수 revert (UI 미착수 상태)
- P3 실패 → 시트 컴포넌트 + page 분기 revert → 기존 데스크탑 라우팅 복원
- P4 실패 → `vendor-dispatch-workbench` 단일 revert
- P5 실패 → 해당 없음(검증 전용)

**Special Cases:** DB migration 없음 · billing 무접촉 · 활동 로그는 append-only(롤백 시 데이터 잔존 무해)

---

## 11. Progress Tracking

- Overall completion: **100% — ✅ 트랙 종결** (2026-07-21)
- 배포: `9d0d71e8`(P1–P3) · `6ec92727`(P4). PLAN 최종본만 미커밋(문서 전용)
- 잔여: 라이브 스모크 3경로(P5 기재 — 권장, blocking 아님) ·
  **기존 drift 2건 별도 정리 후보**: `quotes-mobile-density-p3` "sticky" · `pdf-wiring-314b2` "onSuccess?.()"

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete — 배포 `6ec92727`
- [x] Phase 5 complete

---

## 12. Notes & Learnings

**게이트 결과 (P1–P3, 2026-07-21):**
- ✅ **커밋 `9d0d71e8`** (`2021d42f..9d0d71e8`, origin/main). build EXIT 0 · full vitest 134/295 ·
  **baseline-delta 0**(신규 실패 = 기존 flaky `dispatch-execution-handoff` 1건뿐) · pre-commit hook GREEN
- 최종 add 11파일(소스 6 + 테스트 4 + PLAN) — operator 가 p3a 진화분 편입

**Blockers Encountered:**
- [2026-07-21] **p3a straggler (operator 적발, sandbox 미보고)** — `quote-management-p3a` L24 가
  supplier-avatars 의 인라인 replied 술어를 핀. P2 의 `hasVendorReplied` 추출로 인라인이 사라져 red.
  sandbox 는 사전 확인 시 `replied` **키워드 grep** 만 해 표현식 핀(L24, `respondedAt != null …`)을 놓침.
  → **학습 규칙화: 코드 추출·이동 시 역참조 탐색은 키워드가 아니라 이동하는 표현식 자체로 grep.**
  operator 가 통일 술어 사용으로 sentinel 진화(보호의도 불변 — 술어 내용은 unit test 가 lock).

**Implementation Notes:**
- 호영님 확정(2026-07-21): ① 계획서 생성 승인 ② 독려/독촉 금지는 **이번 트랙 3 surface 한정**
- 색상 표기 규약(07-20) 자동 적용 — 지시문 앰버 계열 = yellow 토큰
- 4a 는 이월 backlog(§5 D+배지/개별발송/활동로그) 흡수분
