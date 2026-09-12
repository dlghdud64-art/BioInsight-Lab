# Implementation Plan: §audit-missing-complete (c) — enforcement.reject() 도입

- **Status:** ⏳ Pending
- **Started:** 2026-09-13
- **Last Updated:** 2026-09-13
- **Estimated Completion:** (phase 별 게이트 통과 기준 · 날짜 고정 안 함)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후
1. ✅ 체크박스 갱신  2. 🧪 quality gate 실행  3. ⚠️ 전 항목 통과 확인
4. 📅 Last Updated 갱신  5. 📝 Notes 기록  6. ➡️ 그 다음 phase

⛔ quality gate 실패 상태로 진행 금지 · 상한(ceiling)은 **내려가기만** 한다

---

## 0. Truth Reconciliation

**Latest Truth Source:** 2026-09-12~13 실측 — 핸들러 블록 파서(인자 괄호를 먼저 균형으로 닫는 판본) + prod 조회(로컬 operator-shell → Supabase xhid…).

**Secondary References:**
- 호영님 명제 "enforceAction 169 vs complete 146 → 23곳이 쓰기인데 감사 없음" (본인 정정: **뺄셈이지 측정이 아니었다**)
- 호영님 표현 "57곳" (본인 정정: 57은 **핸들러 수**, 교체 **지점**은 144)

**Conflicts Found:**
- "쓰기인데 감사 없는 23곳" → 실측 **(b) 0건**. 쓰기 경로 감사는 온전하다.
- "lock 잔존이 감사 소실보다 급하다" → `ACTIVE_MUTATION_TTL_MS = 5분`(lib/security/mutation-replay-guard.ts) + 프로세스 메모리(람다 인스턴스별) → lock 잔존은 **일시적 마찰**. 급한 쪽은 **감사 소실**(영구).

**Chosen Source of Truth:** 오늘 실측.
```
enforceAction 보유 핸들러                     159
(a) 쓰기 없음 · complete 없음                  27   정상(AI 추출·파싱·번역 등)
(b) 쓰기인데 complete 누락                      0   결함 없음
(c) enforceAction 이후 raw 4xx                145 지점 / 58 핸들러 / 20 도메인  ← 이 계획의 대상
     (파서 144 + 미커버 파일에서 수동 발견 1 · vendor-requests 429)
     enforceAction 이전 4xx                  206 지점  ← 대상 **밖**(handle 없음)
파서 커버리지                                 142/144 파일 (놓침 2)
```

**Environment Reality Check:**
- [ ] 공유 워킹트리(병렬 세션) — 커밋 단위로 끊고, push 동승분을 보고에 공개
- [ ] vitest 전량 게이트 약 15분 · `NEXT_DIST_DIR=.next-scan`
- [ ] 파서 미커버 2파일 수동 확인: `app/api/inventory/alerts/send/route.ts` · `app/api/quotes/[id]/vendor-requests/route.ts`

---

## 1. Priority Fit

- [x] **P2 / 구조 교정**  (release blocker 아님)

**Why:**
- (b) 0건 → 데이터 정합 위험 없음. lock 은 TTL 로 자동 해소 → 사용자 장애 아님.
- 그러나 **거부된 시도가 감사에 영영 안 남는다** — 규제 축(바이오·제약 실사)에서 영구히 남는 구멍이다.
- 호영님: "P2 이되 미루지 마십시오."
- P0-b2(OCR 6건 public)가 승인되면 **그쪽이 선행**한다.

---

## 2. Work Type
- [x] Bugfix (구조 교정)  - [x] API / Route 계약

---

## 3. Overview

**Feature Description:**
`enforceAction` 이 handle 을 연 뒤 4xx 로 조기 반환하는 자리가 145 지점 있다. 그 경로는 `fail()` 도 `complete()` 도 부르지 않아 **거부 시도가 감사에 남지 않는다**(부수로 lock 이 최대 5분 잔존).
`enforcement.reject(status, body)` 를 도입해 **잡은 쪽이 푼다**는 원칙으로 되돌린다.

**Success Criteria:**
- [ ] `enforcement.reject()` 가 **fail() 을 먼저 부르고** 그 다음 응답을 반환한다(프록시 라우트와 같은 원칙: 내보내기 전에 기록)
- [ ] 응답 **바이트가 동일**하다 — status·body 를 그대로 통과시키고 부작용만 추가한다
- [ ] enforceAction 이후 raw 4xx 지점 145 → **0**
- [ ] prod 스모크: 거부 1회 → `MutationAuditEvent` 에 **`result` 가 성공이 아닌 값**으로 남는다

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] `enforceAction` **이전** 4xx 206 지점 — handle 이 없다. 손대지 않는다.
- [ ] 라우트 래퍼(`withEnforcement`) — 시그니처 변경이라 별건. 이 계획은 그 길을 막지 않는다.
- [ ] (a) 27곳(쓰기 없음) — 정상이다.

**User-Facing Outcome:** 없음(응답 동일). 운영자가 감사에서 거부 시도를 본다.

---

## 4. Product Constraints

**Must Preserve:** canonical truth(감사 기록) · 응답 계약 · workbench/queue/rail/dock 무관
**Must Not Introduce:** placeholder success · 응답 형태 변경 · page-per-feature

**Canonical Truth Boundary:**
- Source of Truth: `MutationAuditEvent`(durable-audit) — 시도와 결과
- Derived: 화면 감사 표면(§audit-surface-divergence 는 별건)
- Persistence Path: `enforceAction` → handle → `complete()` / `fail()` / **`reject()`(신규)**

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **② 거부 헬퍼**(래퍼 아님) | 호출부 한 줄 교체 + sentinel 하나. 중간 상태가 짧고 상한으로 잔량이 보인다 | 해제 책임이 여전히 호출자에 있다(래퍼가 근본) |
| **`enforcement` 객체 메서드**로 둔다 | 경계를 **tsc 가 1차로 막는다** — 실측(Phase 0 프로브): 164곳이 `let enforcement: InlineEnforcementHandle \| undefined;` 를 핸들러 최상단에 선언하므로 변수는 스코프에 **있고**, `enforcement.reject()` 는 **TS18048 possibly undefined** 로 막힌다 | 🛑 `enforcement?.reject()` 로 **우회 가능**(프로브 B 통과) → sentinel 2차가 필요하다 |
| **두 겹**: tsc + sentinel | 우회형까지 잠근다 — "enforceAction 이전 구간에서 `enforcement?.` 사용 0". 오늘 P0-b1 의 private+비결정적 키와 같은 원칙 | 검사 1개 추가 |
| 🛑 **전역 헬퍼 금지** | `import { reject }` 형태로 만들면 위 보증이 **사라진다**(handle 없는 자리에서도 호출 가능해진다). 금지한다 | 없음 |
| fail() 먼저, 응답 나중 | 내보내고 기록하면 실패 시 흔적이 없다(P0-b1 프록시와 같은 원칙) | 없음 |

**Integration Points:** `lib/security/server-enforcement-middleware.ts`(InlineEnforcementHandle) · route.ts 57개 핸들러

---

## 6. Global Test Strategy

- 계약 변경 → `reject()` 단위 테스트(부작용 순서 · 응답 동일성)
- 교체 → 상한 sentinel(enforceAction 이후 raw 4xx ≤ N) · RED-first
- 주입 프로브: 적용 cmp 확인 → 실행 → 바이트 복원 확인
- **§sentinel-inversion 사전 절차**(오늘 방침): 고치려는 값을 핀한 단언이 나오면 원 명제가 아직 참인지 판정 → 승계/폐기. 좁힌 축 sweep(raw 4xx 요구 핀 **78건** 경고)은 사전 경고용이며, **못 찾아도 게이트가 잡는다**(오늘 3건 모두 그 경로로 나왔다)
- prod 스모크는 **행수가 아니라 `result` 값**을 본다(§audit-intent-vs-effect: 쓰기가 일어났다 ≠ 의도대로 됐다)

---

## 7. Implementation Phases

### Phase 0: 경계 고정 & 사전 판정
**Goal:** 대상(145)과 대상 밖(206)을 **컴파일러가 가르게** 하고, 기존 핀을 훑는다.
- Status: [x] **Complete** (2026-09-13 · 프로브 + 미커버 분류 + 핀 목록)

**🔴 RED:** enforceAction **이전** 자리에서 handle 메서드를 부르면 tsc 가 막는지 — 프로브로 실측
**🟢 GREEN:** 실측 결과(2026-09-13):
```
선언 패턴    let enforcement: InlineEnforcementHandle | undefined;   164곳 (핸들러 최상단)
             const enforcement = enforceAction(...)                    1곳
프로브 A     enforcement.fail()   → TS18048 possibly undefined   ✅ 막힌다
프로브 B     enforcement?.fail()  → 에러 없음                    ❌ 우회 통과
```
→ 경계는 "스코프 부재"가 아니라 **타입 판정**이다. 계획서 초안의 "컴파일이 안 된다"는 **정정**했다.
**🔵 REFACTOR:** 206 전수 검증은 여전히 불필요(무심코 쓰면 tsc 가 잡는다). 대신 **sentinel 2차**로 우회형을 잠근다.

**✋ Quality Gate:**
- [x] 전역 헬퍼 형태 아님(객체 메서드) — `import { reject }` 금지
- [x] 프로브 A/B 실측 완료 · 보증 강도 기록
- [x] 파서 미커버 2파일 수동 분류 — `inventory/alerts/send` 3곳 모두 fail() 선행(정상) · `quotes/[id]/vendor-requests` 429 는 **대상**(+1)
- [x] 기존 핀 78건 경고 목록 확보 (스크래치패드 `pins-raw4xx.txt` · 사전 경고용 · 못 찾아도 게이트가 잡는다)
**Rollback:** 계획 단계 · 코드 변경 0(프로브는 바이트 복원 확인)

### Phase 1: `reject()` 계약 + 상한 핀
**Goal:** 헬퍼를 만들고 잔량을 숫자로 고정한다.
- Status: [ ] Pending

**🔴 RED:** 단위 테스트 — fail() 이 응답 **생성 전에** 호출된다 · status/body 동일 · handle 이 닫힌 뒤 재호출 안전
**🟢 GREEN:** `InlineEnforcementHandle.reject(status, body)` 구현
**🔵 REFACTOR:** `deny()` 와 역할 분리 주석(deny=권한 거부 · reject=핸들러 판단 거부)

**✋ Quality Gate:** sentinel 신설(enforceAction 이후 raw 4xx ≤ **145**) · 주입 프로브 RED · tsc 0 · 전량 게이트 신규 RED 0
**Rollback:** git revert(헬퍼 + sentinel)

### Phase 2: inventory 28 지점
**Goal:** 최다 도메인부터. 오늘 여러 번 만진 축이라 회귀가 빨리 드러난다.
- Status: [ ] Pending
**✋ Quality Gate:** 상한 **117** · 도메인 테스트 GREEN · 게이트 신규 RED 0
**Rollback:** git revert(도메인 단위)

### Phase 3: organizations 24 + quotes 14
- Status: [ ] Pending
**✋ Quality Gate:** 상한 **79**

### Phase 4: team 13 + budgets 12 + admin 6 + billing 6
- Status: [ ] Pending
**✋ Quality Gate:** 상한 **42**

### Phase 5: 잔여 41 + 프로브 + prod 스모크
**Goal:** 상한 0 · 실제로 남는지 확인.
- Status: [ ] Pending

**🔴 RED:** 상한 1 프로브 → RED 확인(잔량이 정확히 0)
**🟢 GREEN:** prod 스모크 — 거부 시도 1회(다른 조직 자원 접근 → 403)
  🛑 **행수가 아니라 `result` 값을 본다.** 거부가 `success` 로 남으면 실패다.
**🔵 REFACTOR:** 임시 계측 제거 · 한계 목록 갱신

**✋ Quality Gate:** 상한 **0** · prod `MutationAuditEvent` 에 거부 1행(`result` ≠ 성공) · 게이트 신규 RED 0
**Rollback:** git revert(도메인 단위로 되돌릴 수 있다)

---

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 경계 오판(206 중 일부가 실제 handle 이후) | Low | High | tsc 1차(TS18048) + **sentinel 2차**(`enforcement?.` 우회 0). 전역 헬퍼 금지로 1차 보증 유지 |
| 기존 핀 78건이 raw 4xx 요구 | Med | Med | 사전 sweep(경고) + 전량 게이트(검출). 오늘 3건 모두 게이트가 잡았다 |
| 응답 계약 변경 | Low | High | status/body 통과 · **응답 동일성**을 sentinel 로 핀 |
| 파서 미커버 2파일 | High | Low | 한계 기록 + 수동 분류(Phase 0) |
| 병렬 세션 push 동승 | Med | Low | `@{u}..HEAD` 선확인 후 보고에 공개 |

---

## 10. Rollback Strategy
- Phase 1 실패: 헬퍼 + sentinel revert (호출부 미변경이라 영향 0)
- Phase 2~5 실패: **도메인 단위 revert** — 각 커밋이 한 도메인이라 되돌림 범위가 좁다
- DB/스키마 변경 **없음** · 응답 계약 **불변** → prod 롤백 리스크 낮음

---

## 11. Progress Tracking
- Overall: 0%
- Current phase: Phase 1 (reject() 계약 + 상한 핀 145)
- Blocker: 없음 (P0-b2 승인이 오면 그쪽 선행)
- Next: Phase 0 경계 고정

- [x] Phase 0  - [ ] Phase 1  - [ ] Phase 2  - [ ] Phase 3  - [ ] Phase 4  - [ ] Phase 5

---

## 12. Notes & Learnings

**착수 전 확정된 정정**
- [2026-09-13] "쓰기인데 감사 없는 23곳" → (b) **0건**. 뺄셈은 측정이 아니다.
- [2026-09-13] "57곳" → 57은 **핸들러**, 교체 **지점은 144**. 2.5배. 두 수를 계속 구분해 쓴다.
- [2026-09-13] "lock 이 감사보다 급하다" → TTL 5분 존재로 성립 안 함. 급한 쪽은 감사 소실.
- [2026-09-13] 첫 파서가 `{ params }` 구조분해 인자의 중괄호를 본문 시작으로 오인해 144 중 54파일을 놓쳤다.
  "파일 144 > 핸들러 97 은 불가능"이라는 모순으로 잡았다. CLAUDE.md 에 이미 적힌 함정이었다.
- [2026-09-13] **Phase 0 프로브**: 경계 보증이 초안보다 약하다. 변수는 스코프에 **있고**(164곳이 최상단 선언),
  막는 것은 `| undefined` 타입 판정(TS18048)이다. `enforcement?.` 로는 **뚫린다** — 그래서 두 겹으로 간다.
  초안의 "스코프에 없어 컴파일이 안 된다"는 틀렸다. 프로브 없이 넘어갔으면 약한 보증을 강한 것으로 적을 뻔했다.
- [2026-09-13] **Phase 0 완료**: 파서 미커버 2파일을 손으로 갈랐더니 1건이 실제 대상이었다
  (`quotes/[id]/vendor-requests` 429). 대상이 144 → **145 지점 / 58 핸들러**로 늘었다.
  커버리지 한계를 "기록만" 하고 넘겼으면 그 1건은 영원히 안 잡혔다.
