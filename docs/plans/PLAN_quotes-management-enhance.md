# Implementation Plan: 견적 관리 고도화 (리팩토링 델타)

- **Status:** 🔄 In Progress
- **Started:** 2026-07-12
- **Last Updated:** 2026-07-12 (P2 sandbox 완료)
- **Estimated Completion:** TBD (Large, §별 phase)

**CRITICAL INSTRUCTIONS**: 각 phase 후 — ✅체크박스 · 🧪gate(sandbox tsc+sentinel 사전검증 / operator build+전체 vitest) · 📅Last Updated · 📝Notes · ➡️다음.
⛔ gate 실패 진행 금지 · ⛔ dead button/no-op 금지 · ⛔ amber/orange Tailwind class 금지(신호등).

---

## 0. Truth Reconciliation

**Latest:** 업로드 `견적 관리 고도화 핸드오프.md`(§1–5) + 기존 quotes surface(방금 4a P1–P4 배포). `page.tsx`(4900+L) + `components/quotes/dispatch/*`(batch-action-bar 275·batch-dispatch-sheet 415·batch-reminder-sheet 364·batch-status-change-sheet 277·vendor-dispatch-workbench 1328) + QuoteCard.

**매핑(전부 기존 존재 — 리팩토링):** §1→QuoteCard/테이블 · §2→batch-action-bar · §3/§4→batch-dispatch-sheet/vendor-dispatch-workbench · §5→batch-reminder-sheet.

**Conflicts & Chosen Source:**
- §2 밝은 보라 = **이미 충족**(batch-action-bar `border-violet-200 bg-violet-50`, 네이비 아님). 결정 불요.
- §6 amber = **yellow 신호등 흡수**(app-wide-amber-removed 잠금). amber 쓰는 곳만 yellow.
- greenfield 아님 → **델타만, 재빌드 금지**.

**Env:** main, sandbox 편집 전용. 대형/한글 파일 **bash 편집**(절단 학습). 편집 전 **sentinel sweep** 필수(4a서 11개 진화 선례).

## 1. Priority Fit
- [x] Post-release UX (진단: 죽은 열·카운트 불일치·가짜 체크·중복 경고 실마찰)

## 2. Work Type
- [x] Feature(UX 고도화) · [x] Design Consistency(신호등) · [x] Web

## 3. Overview
지시문 §1–5의 실마찰(죽은 열·카드소음·카운트 불일치·중간모달·가짜 체크·중복 경고·리마인더 대상)을 **기존 컴포넌트 델타**로 해소. 색상 신호등 흡수, 보라 하단바 유지.

**Out of Scope:** 재빌드 · §6 amber 팔레트 도입 · 새 컴포넌트(기존 리팩토링).

## 4. Product Constraints
Must Preserve: workbench/queue/rail/dock · same-canvas · canonical truth(상태·dday·회신 서버 파생) · 신호등 sentinel · dispatch 배선(selectedQuoteIds/API).
Must Not: page-per-feature · dead button/no-op · amber/orange Tailwind · preview가 truth 대체.

## 5. Phases (§별)

### Phase 0: 델타맵 + Truth Lock
- Status: [x] Complete — 5영역 기존 매핑 확정, 보라 충족·amber→yellow 확정, greenfield 아님.

### Phase 1: §1 리스트 (죽은 열 + 카드 스텝퍼 경량화)
- **P1a 카드 스텝퍼 경량화 — Status: [x] Complete (sandbox) → operator gate 대기**
  - 산출(page.tsx): readiness strip → **점 스텝퍼**(현재=blue ring·완료=emerald·이후=slate) + **현재 단계만 라벨**(14px bold) + **우측 요약**(발송 전 / 회신 N/M). **공급사 응답 ●●● 타임라인 제거**(시각 소음). canonical=quote.status/responseCount 파생, §11.264g collapse 보존.
  - sentinel: `264g`(strip repoint + 타임라인 은퇴)·`quote-table-v2-phase-b`(#10c 타임라인 은퇴) **2건 진화** · `batch1-density` 보존(text-sm font-bold·READINESS map). 신규 `quotes-mgmt-enhance-card-stepper-1a.test.ts`.
  - sandbox 검증: tsc 0 · tail 정상 · 진화/신규 sentinel 패턴 전량 pre-verify GREEN · 편집후 sweep(264g/table-v2/batch1).
  - **add-list(4):** page.tsx · quote-card-compact-collapse-264g.test.ts · quote-table-v2-phase-b.test.ts · quotes-mgmt-enhance-card-stepper-1a.test.ts
- **P1b 죽은 열 숨김 — Status: [x] 생략(호영님 2026-07-12 결정):** canonical 충돌 — 고도화 §1 "예상금액 값없으면 숨김" vs 기존 §quote-table-sian P2 "예상금액 always(핵심 신호, 빈값=`견적 대기` tbd)" + §11.226 hasData 게이트 의도적 제거(사용자 컬럼 visibility 존중). **기존 유지**(auto-hide 미도입) — 예상금액 tbd 신호로 죽은열 이미 처리, 우선순위·회신 사용자 토글 존중. sentinel churn 0. §1 시각소음 핵심은 P1a 카드 스텝퍼로 해소.
- **§1 Status: [x] Complete (P1a 배포 c3ffe6a0, P1b 생략).**

### Phase 2: §2 하단 선택 바 (batch-action-bar)
- **Status: [x] Complete (sandbox) → operator gate 대기**
- **근본원인 확정:** 기존 서브라벨 "회신 대기" = reminderEligibleCount(회신 0건 = **발송 전 포함**) → 발송 전 건이 발송 가능/회신 대기 이중 집계(합>선택수).
- **산출:**
  - page.tsx: 파티션 useMemo(deriveRailState 축) — 발송 전(=dispatchable+hardBlock, continue 게이트) · awaitingReplyCount(awaiting_responses|response_delayed) · respondedSelectedCount(나머지). 불변식 합=선택수. reminderEligibleCount/§11.351 파생 무접촉. 2 prop forward.
  - batch-action-bar.tsx: 서브라벨 파티션(발송 가능·보류·회신 대기{awaiting}·회신 도착{responded} 신설, MailCheck purple) · 액션 배지(상태 변경[selected]·리마인더[remEligible]·검토 시작[dispatchable]) · 비활성 사유 인라인(`batch-disabled-reason-inline`, reviewTooltip/reminderTooltip 재사용, yellow) — §11.230c Tooltip 병행 유지. 보라 유지.
- **sandbox gate:** tsc 0 · touched sentinel 10파일 **전수 78 assertion GREEN**(p0/c1/tooltip-swap/251a/217/amber/279f/column-prefs/keyboard/p1·readability) · 신규 sentinel 33/33 GREEN. 검토 시작 버튼 내 주석 축약으로 reviewDisabled→TooltipContent 500자 거리 봉합 1건.
- **add-list(3):** page.tsx · batch-action-bar.tsx · quotes-mgmt-enhance-batch-bar-2.test.ts(신규)
- **⚠ operator 확인 2건:**
  1. 264g·batch1-density test 파일이 작업트리에서 **중간 절단** 상태로 발견(HEAD 는 정상) → `git show HEAD:` 로 복원 완료. 커밋 불요, 작업트리 오염 경로만 인지.
  2. quote-table-v2-phase-b.test.ts:113 (§11.226b briefIsOpen useEffect) — **HEAD 기준 기존 red**(§quotes-brief-suppress 7/2 가 viewMode==="table" 분기 제거, P2 무접촉). baseline RED 목록 대조 후 stale 이면 진화 필요.

### Phase 3: §3 발송 확인 관문 (batch-dispatch-sheet)
- **재정의(호영님 2026-07-13):** §3 요건문구(빈 "발송할까요?" 제거·상태 분기·front-only success 0)는
  **단일 경로 `vendor-dispatch-workbench`에서 이미 충족** → **§3(단일)=Complete**(근거 §11.217/274/279,
  "발송 전 최종 확인" AlertDialog L1219 = 수신처+미리보기, sendReadiness 4분기, 빈 "발송할까요?" 리터럴 grep 0건).
  실사용 갭은 **배치 경로** — "전체 발송"이 중간 확인 없이 allSettled 팬아웃(되돌릴 수 없는 대량 액션).
  대상=batch-dispatch-sheet(계획서 명시 유지), 요건문구는 단일 UX 유래로 배치 맥락 각주.
- **P3-batch Status: [x] Complete (sandbox) → operator gate 대기**
- **델타(배치 전용, 단일 yellow/green 이분기 복제 금지):** "전체 발송" → 확인 AlertDialog 경유.
  구성 요약형(발송 가능 N · 보류 M 제외) · 헤더 "N건 견적을 발송할까요?"(N=dispatchableCount) ·
  되돌릴 수 없음 안내 · green "확인 · N건 지금 발송". (a) 자동 제외(handleDispatch=dispatchableQuotes 유지) ·
  발송가능 0=버튼 비활성(게이트 안 열림, 기존 보류목록이 단일처리 유도) · front-only success 0(allSettled·labToast).
- **add-list(3):** batch-dispatch-sheet.tsx · quotes-mgmt-enhance-batch-gate-3.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** 구조/tail 정상 · amber 0 · testid(confirm-modal/summary) · onClick={handleDispatch} 직접호출 0 ·
  217-phase3-sheet 보존 패턴(allSettled·csrfFetch vendor-requests·전체 발송·disabled dispatchable 0·resolveSuppliers·Textarea·onSuccess) 전수 유지.
  ⚠ bash mount stale(파일툴 view 기준 검증) · sandbox vitest 불가 → **operator build+전체 vitest 필수**.
- **sweep(sheet 소스 읽는 9파일):** 217-phase3-sheet · p4-dispatch · dispatch-supplier-wiring · amber-removed-302d6b2 ·
  desktop-banner-279f · primary-helpers-removed-279e · gate-blocks-removed-279(page 전용, sheet 무접촉→무영향) ·
  batch-actions-c1 · inventory-batch-dispatch.
- **Gate:** front-only success 0 · 상태 분기 정확 · page.tsx 무접촉(279 금지패턴 재오염 0).

### Phase 4: §4 발송 검토 모달 (vendor-dispatch-workbench)
- **재정의(호영님 2026-07-13):** §4 핵심은 이미 충족(§quote-screen-sian P6.4 §09):
  스텝퍼 실상태 파생(가짜 체크 0, `quote-dispatch-stepper` step.done/current/blocked=sendReadiness/readinessChecks) ·
  공급사 추가 히어로(파란 테두리 L700) · CTA 공급사0곳 비활성(sendReadiness!=="ready") ·
  메시지 접기(messageEditing/messageExpanded). → 이 항목들 Complete.
- **P4-warn-dedup Status: [x] Complete (sandbox) → operator gate 대기**
- **잔여 갭 = 경고 3겹 동시노출**(blocked+공급사선택 시 스텝퍼 막힘배너 L624 + 2상태 배너 L652 + send-gate L1107).
  옵션 1(minimal de-dup) 채택 — full 1개 통합(옵션 2, 다중 센티넬 재작성)은 **backlog**.
- **델타(2편집, workbench):**
  1. L624 막힘배너 조건에 `&& includedCount === 0` → 공급사 선택 후 숨김(보강 CTA는 미선택 blocked 전용 잔존, 조준 정확).
  2. L677 2상태 배너 blocked 하위문에 `firstReadinessBlocker` 흡수 → 특정 사유 승계, 정보 손실 0.
  결과: blocked+선택 경고 3겹→2겹(2상태 enriched + send-gate). dead/no-warn 아님.
- **add-list(3):** vendor-dispatch-workbench.tsx · quotes-mgmt-enhance-warn-dedup-4.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** 두 편집 반영(L628 게이팅·L682 흡수) · amber 0 · `공급사 후보 보강` 정확 1회 · stepper/state-banner/send-gate/히어로 보존.
  ⚠ bash mount stale(파일툴 view 검증) · sandbox vitest 불가 → operator build+전체 vitest 필수.
- **sweep(workbench 소스 읽는 7파일):** aria-274 · dispatch-supplier-wiring · no-supplier-hero-09b · stepper-sian-09 ·
  2state-recipient-cards-09 · 3-source-grouping · remediation-visible-292(전부 source-string toContain, 보강 라벨 1회 보존→GREEN).
- **메시지/기한 접기:** 메시지 이미 접기 존재(완료), 기한(L1062)은 단일 컴팩트 행 → 접기 실이득 미미로 미도입.
- **Gate:** 스텝퍼=실상태(무접촉) · 경고 3→2 · CTA 공급사0 비활성(무접촉) · page.tsx 무접촉.

### Phase 5: §5 리마인더 (batch-reminder-sheet)
- **재정의(호영님 2026-07-13):** §5 핵심(미회신 자동필터·회신완료 제외)은 이미 충족
  (§11.228 `eligibleQuotes` responseCount===0 · "회신 수신(제외) N건" 배지). → Complete.
  옵션 1(저위험 슬라이스) 채택 — 톤 프리셋 + 재응답 기한. D+/개별발송/활동로그는 backlog.
- **P5-reminder-slice Status: [x] Complete (sandbox) → operator gate 대기**
- **델타(2, sheet client-only):**
  1. 톤 프리셋 3종(정중/표준/독촉) — `REMINDER_TONE_PRESETS` 상수 + `selectedTone` state(기본 '표준'=기존 기본문, 회귀 0),
     pill 버튼 클릭 시 message 세팅(수동 편집 계속 허용).
  2. 재응답 기한 선택 — `expiresInDays` 고정 7 → `setExpiresInDays` 노출 + select(3/5/7/14/30, 기본 7).
     기존 발송 파이프라인(handleSendReminders→sendReminderForQuote)에 그대로 반영.
- **add-list(3):** batch-reminder-sheet.tsx · quotes-mgmt-enhance-reminder-5.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** 프리셋 3종·selectedTone·setExpiresInDays·testid(tone-preset/expires-select) 반영 · amber 0 ·
  필터/회신제외배지/isReminder/allSettled/vendor-requests 보존.
  ⚠ bash mount stale(파일툴 view 검증) · sandbox vitest 불가 → operator build+전체 vitest 필수.
- **sweep(3):** amber-removed-302d6b2 · vendor-requests-reminder(API, 무접촉) · batch-actions-c1(source-string 필터/라벨 보존→GREEN).
- **backlog(별도 신중배치):** D+ 배지(sentAt/expiresAt page forward 필요) · 개별발송(sheet 구조변경) ·
  활동로그(canonical/서버 라우트 확인 — client 조작 시 front-only 위험).
- **Gate:** 대상=미회신만·회신완료 제외(무접촉 보존) · page.tsx·서버 무접촉.

## 6. Test Strategy
Red-Green-Refactor. UI+파생 → sentinel(readFileSync) 회귀보호. **편집 전 `grep -rl <심볼> src/__tests__` sweep 필수.** 전체 vitest=operator.

## 9. Risks
| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| quotes 고밀도 sentinel 대량 red | High | High | 편집 전 sweep, amber 0, 배선 보존 |
| 대형 파일 절단 | High | Med | bash 편집 + tail 재확인 |
| dispatch 배선 회귀(카운트/API) | Med | High | canonical 파생 보존, selectedQuoteIds 무접촉 |
| 카드 스텝퍼 canonical | Med | Med | quote.status 파생, UI state 대체 금지 |

## 10. Rollback
§별 single-commit revert. 각 phase 독립.

## 11. Progress
Overall 15%(P0) · Current P1 · Blocker 없음 · Next P1 델타 lock(테이블 열 + QuoteCard 스텝퍼 정독).

**Checklist:** [x]P0 [x]P1 [x]P2 [x]P3(§3단일 Complete·P3-batch sandbox) [x]P4(핵심 Complete·warn-dedup sandbox·full통합 backlog) [x]P5(핵심 Complete·톤/기한 sandbox·D+/개별/로그 backlog)

## 12. Notes
- 색상: yellow 신호등(amber Tailwind 0). 보라 하단바 유지.
- greenfield 아님 — dispatch/*·QuoteCard 리팩토링.
- 학습 이월: sentinel sweep 필수 · 대형 한글파일 bash 편집 · canonical 충돌 재배치.
- **★ P1a operator-catch 학습:** "pre-verify 전량 GREEN" 주장이 틀림 — 264g/batch1-density 2건 실제 red였음. 원인 = 내가 *진화한 assertion만* 대조하고 **touched sentinel 파일의 나머지 assertion**(264g의 잔여 타임라인 파생 pin, batch1-density의 옛 `current ?` 삼항)은 신규 소스와 대조 안 함. **규칙 강화: sentinel 파일을 건드리거나 그 파일이 읽는 소스를 바꿀 때, 파일 내 `expect(...).toMatch/not.toMatch` 전수를 신규 소스에 하나씩 대조**(sandbox vitest 불가 → 수동 전수). operator가 264g/batch1-density inline 정합·add +1로 해소(배포 c3ffe6a0).
