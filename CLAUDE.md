# LabAxis — Behavioral Guidelines for Claude Code

LabAxis 운영 OS (연구 구매 운영 OS) 코드 작업 시 따라야 할 행동 가이드라인.
Andrej Karpathy 의 LLM coding pitfall 관찰 (forrestchang/andrej-karpathy-skills)
을 LabAxis 제품 제약과 통합하여 흡수.

이 문서는 labaxis-bug-hunter / labaxis-delivery-planner / labaxis-feature-planner
/ labaxis-react-native-expert / labaxis-ui-wizard skill 과 보완 관계 — 본 문서는
**모든 작업의 공통 기준선**, skill 들은 트랙별 절차를 강제.

**Tradeoff:** 본 가이드라인은 속도보다 정확성·근거·최소 변경을 우선. 사소한
질문 (build 시간 / 환경 설정 / 단순 정의) 은 판단 후 즉답 가능.

---

## 1. Think Before Coding — 의심을 표면화하라

Karpathy "silent wrong assumptions" 차단. **추측·은폐·overconfidence 금지.**

작업 시작 전:

- 가정 (assumption) 을 명시. 불확실하면 묻는다.
- 해석이 여러 갈래면 모두 제시 — 침묵으로 하나 선택 금지.
- 더 단순한 접근이 있으면 말한다. 필요하면 사용자에게 push back.
- 모호한 부분은 멈추고 무엇이 헷갈리는지 명명한 뒤 묻는다.

**LabAxis Truth Reconciliation 추가 강제 (labaxis-bug-hunter / delivery-planner):**

- 코드 수정 전 **현재 source 의 canonical 동작** 파악. 추정으로 fix 작성 금지.
- **canonical truth** 충돌 (여러 위치가 같은 fact 보유) 발견 시 먼저 단일화
  대상을 명확히 한 뒤 작업 시작.
- ontology (재고 / 견적 / 발주 / 입고) 를 chatbot / assistant 자유 채팅으로
  재해석 금지 — 작업 surface 안에서 selectable work object 로만 노출.

---

## 2. Simplicity First — 요청에 정확히 응답

**문제를 푸는 최소한의 코드. speculative 변경 금지.**

- 요청되지 않은 기능 추가 금지.
- 1회용 코드에 불필요한 abstraction 추가 금지.
- 요청되지 않은 "유연성" / "configurability" 추가 금지.
- 발생 불가능한 시나리오에 대한 error handling 금지.
- 200 line 짜리를 50 line 으로 쓸 수 있다면 다시 쓴다.

자문: "시니어 엔지니어가 이걸 보면 'over-engineered' 라 할까?" → 그렇다면 단순화.

**LabAxis 추가 제약 (labaxis-feature-planner):**

- **page-per-feature 금지** — 기존 dashboard surface (purchases / quotes /
  inbox / inventory / receiving / purchase-orders) 에 통합. 별도 페이지 신설
  은 surface 분산 + canonical truth 분산 위험.
- **chatbot / assistant 재해석 금지** — operational brief popup 또는
  per-surface ContextPanel rail 안에서 selectable work object 로만 노출.
- **dead button / no-op / fake success 금지** — onClick 이 정의된 버튼은
  실제 동작 (mutation 또는 navigation) 또는 disabled state 명시. 시각적
  성공 (toast 후 실제 변경 0) 은 canonical truth 위반.

---

## 3. Surgical Changes — 닿아야 할 곳만 닿는다

**필요한 부분만 수정. 자기 변경의 흔적만 정리.**

기존 코드 수정 시:

- 인접 코드 / 주석 / 포맷팅 "개선" 금지.
- 깨지지 않은 것 refactor 금지.
- 기존 스타일과 다르더라도 그 스타일에 맞춘다.
- 무관한 dead code 발견 시 언급은 하되 삭제하지 않는다.

자기 변경이 만든 orphan:

- 본인 변경으로 unused 가 된 import / variable / function 만 제거.
- 사전 존재 dead code 는 요청 없이 제거 금지.

테스트: 변경된 모든 line 이 사용자 요청과 직접 연결돼야 한다.

**LabAxis 추가 제약 (labaxis-bug-hunter Minimal-Diff Resolution):**

- **canonical truth 보호** — UI state 가 canonical truth (DB / lib resolver
  output / API contract) 를 덮어쓰면 안 됨. resolver 의 status / blocker /
  nextAction 을 UI 변형 후 다시 사용 금지.
- **API contract drift 0** — endpoint 변경 시 caller 정합 필수 (`grep -r`
  로 0 caller 확인 후 변경, 또는 caller 일괄 swap 같은 batch 안에).
- **rollout safety** — soft_enforce → full_enforce 전환 시 rollback path
  명시. 한 batch 안에 enforcement upgrade + 실제 사용 같이 land 금지.
- **workflow wiring 누락 금지** — 새 mutation 은 cache invalidation
  (`invalidateBriefNarrative` 등) + sync surface (mobile/web 분기) 동시 정합.

---

## 4. Goal-Driven Execution — 검증 가능한 성공 기준

**성공 기준 정의 후 검증까지 loop.**

작업을 검증 가능한 목표로 변환:

- "validation 추가" → "잘못된 input 에 대한 test 작성 → 통과"
- "버그 수정" → "버그 재현하는 test 작성 → 통과"
- "X refactor" → "전후 모두 test 통과"

multi-step 은 짧은 plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

강한 성공 기준이 있으면 독립 loop 가능. "make it work" 같은 약한 기준은
지속적 clarification 필요.

**LabAxis 추가 절차 (labaxis-feature-planner / delivery-planner):**

- **TDD 강제** — RED → GREEN → REFACTOR. 새 기능 / 복잡 버그 / API
  slimming / workflow wiring 시 source-level test 먼저 작성.
- **Phase 별 quality gate** — Phase 0 audit (read-only) → Phase 1 RED →
  Phase 2 GREEN → Phase 3 verify (vitest + tsc) → Phase 4 ADR append →
  Phase 5 commit + push. 각 phase 결과 호영님 확인 후 다음 phase.
- **rollback path 명시** — git revert SHA + DB rollback (migration 있을
  시) 즉시 사용 가능 상태로 commit message 에 명시.
- **승인 전 문서 / 코드 생성 금지** — feature-planner 가 강제 — 호영님이
  계획 승인 전 implementation 시작 금지.

---

## 5. LabAxis 제품 제약 — 운영 OS 정합

본 섹션은 Karpathy 외 LabAxis 고유 제약. 모든 작업이 검증해야 할 lock.

**§11.142 운영 브리핑 lock**
- "운영 브리핑" popup / per-surface ContextPanel rail 은 selected work
  object 가 있을 때만 facts 노출. 임의 chatbot / 자유 input 0.
- 4 section 정합: 상황 요약 / 판단 근거 (※ "핵심 근거" 표기 deprecated) /
  리스크 / 다음 조치.
- 4 cell MetricCell grid (text-3xl + tone-based border-l-4) 패턴은
  ContextPanel rail 한정 — page-per-feature detail page 에는 적용 X
  (§11.190b/c defer 결정 정합).

**workbench / queue / rail / dock 4-zone**
- 같은 canvas (same-canvas) 안에서 work object 선택 + facts rail + action
  dock 동시 노출. 별도 페이지 navigation 으로 분리 금지.

**한국어 정합**
- visible label / sr-only / aria-label / placeholder 모두 일관 한국어 어미.
- raw enum / internal key (예: `user-inv-001`, `ready_for_po`, `P0`) 는
  사람 라벨 매핑 후 노출 (§11.182 / §11.184 정합).

**모바일 vs 웹**
- 모바일 (Expo/React Native) 은 현장/엣지 운영 도구. 웹은 본진 운영.
  mobile 전용 기능을 chatbot / 별도 페이지로 reinterpret 금지.
- mobile 분기 (`useIsMobile` / `MobileOperationalBriefSheet` / responsive
  Tailwind) 는 same-canvas 보존하며 표시 형식만 분기.

---

## 6. 운영 흐름 — 실패 시그널과 회복

작업이 어긋났다는 시그널 (Karpathy: "fewer rewrites due to overcomplication"):

- diff 가 unnecessary 변경 (인접 코드 / 무관 형식 / dead code 정리) 포함
- TDD test 가 implementation 후에 추가됨 (RED 가 사라짐)
- API contract 변경이 caller 정합 없이 land
- canonical truth 가 UI state 로 덮여짐
- rollout 이 한 batch 안에 enforcement + 실제 사용 동시 포함

**회복 절차:**

1. 멈춘다. 현재까지 변경된 line 을 다시 읽는다.
2. 어떤 line 이 사용자 요청과 직접 연결되지 않는지 식별.
3. 분리 가능한 cleanup 은 별도 트랙 (deferred ADR entry) 으로 park.
4. 본 batch 는 사용자 요청에 직접 연결된 변경만 남긴 후 vitest + tsc 재검증.

본 가이드라인이 작동하는지의 증거:
- diff 가 사용자 요청과 line-by-line 연결됨
- 구현 전에 명확화 질문이 나옴 (구현 후 후회 0)
- canonical truth 가 한 곳에만 존재
- rollback path 가 ADR 에 명시됨

---

## Appendix — Skill 선택 가이드

| 트리거 | 사용할 skill |
|---|---|
| 새 기능 / 복잡 버그 구현 계획 | labaxis-feature-planner |
| LabAxis 코드 작업 시작 전 (TDD 계획 + Truth Reconciliation) | labaxis-delivery-planner |
| 에러 / 버그 진단 (코드 수정 전 root cause) | labaxis-bug-hunter |
| Tailwind UI / mobile 최적화 / responsive 작업 | labaxis-ui-wizard |
| Expo / React Native 모바일 작업 | labaxis-react-native-expert |

각 skill 은 본 CLAUDE.md 의 4 가이드라인 (Think / Simplicity / Surgical /
Goal-Driven) 위에서 트랙별 phase / quality gate / rollback path 를 강제.

---

**Source:**
- Andrej Karpathy 의 LLM coding pitfall 관찰 — 2026-01-26 X post
- forrestchang/andrej-karpathy-skills GitHub repo (tens of thousands of
  stars 단기간 획득) 4 원칙 흡수
- LabAxis 제품 제약 — ADR-002 §11.142 운영 브리핑 lock + skill 시리즈
  (bug-hunter / delivery-planner / feature-planner / react-native-expert /
  ui-wizard)
