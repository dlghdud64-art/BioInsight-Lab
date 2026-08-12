# §test-baseline-debt — 전체 스위트 250 RED 분류

작성: 2026-08-12
상태: **1단계(ratchet) 완료 / 2단계(교정) 미착수** (동결 아님 — 방향 전환의 장애물)
발원: compliance 은퇴 검증차 전체 스위트를 처음 돌렸더니 250 RED

---

## 0. ⚠️ 왜 이게 이 세션의 가장 중요한 발견인가

매 턴 **"게이트: vitest ops 18x passed / RED 0"** 로 보고해 왔다.
그런데 전체를 돌리니 **250개가 깨져 있었다.**

> 이 세션에서 세 번 반복된 그 실패가 최상위 층에서도 일어나고 있었다 —
> **"게이트 통과" 를 말해왔는데 게이트가 부분집합이었다.**
> `ops` 스위트는 이번에 우리가 만든 sentinel 들이고, 제품 동작을 검증하는 나머지는
> 아무도 보지 않았다. (호영님 2026-08-12)

이는 §enforcement-handle-close-sweep §3-4 의 **무음 실패 상위 규칙**의 네 번째 사례다:
*도구가 대상을 찾지 못한 것과 위반이 없는 것을 구분하지 않았다* 의 변형 —
**측정 범위를 좁혀놓고 전체라고 말했다.**

### 보고 규칙 변경 (즉시 적용)

> 게이트 보고에 **전체 스위트 숫자를 함께 쓴다.**
> ❌ "ops 180 passed / RED 0"
> ✅ "ops 180 / **전체 11522 passed, 250 failed (baseline 동일)**"

---

## 1. 실측 (2026-08-12, `vitest run --reporter=json` 전수)

```
Test Files  112 failed | 1072 passed | 8 skipped  (1192)
Tests       250 failed | 11522 passed | 86 skipped | 1 todo  (11859)
```

실패 assertion **250건 / 71 파일**.

### 범주 분포 — **예상과 달랐다**

| 범주 | assertion | 판정 |
|---|---|---|
| **B. 오래된 계약** (정적 sentinel 단언 불일치) | **245 (98%)** | 코드가 바뀌었는데 sentinel 이 안 따라감 |
| **D. 런타임 오류** | **4** | 1파일(`operational-brief-inventory-density`) — `Cannot read properties of null` |
| **E. 테스트 인프라 버그** | **1** | `order-tracking-pdf-link` — 경로 오타 `apps/apps/mobile/...` (ENOENT) |
| **A. 환경 의존**(DB·네트워크) | **0** | 없음 |
| **C. 모듈 해석 실패** | **0** | 없음 |

⚠️ **환경 의존이 0** 이라는 것이 중요하다. "DB 없어서 깨진 것" 이라는 흔한 변명이 성립하지 않는다.
**거의 전부가 소스 텍스트 sentinel 의 stale 계약**이다.

### 디렉토리 분포

| 디렉토리 | assertion |
|---|---|
| `__tests__/dashboard` | **162** |
| `__tests__/api` | 40 |
| `__tests__/mobile` | 14 |
| `__tests__/regression` | 10 |
| `__tests__/inventory` | 8 |
| 기타(user·lib·components·landing·legal·organizations·security) | 16 |

---

## 2. 호영님 질문 — **이번 sweep 발견물이 이미 250 안에 있었는가**

**아니다.** 기계 대조 결과:

| 발견물 | 250 안에 있었나 |
|---|---|
| `complianceLink` / compliance-links 실패 | **0건** |
| `quoteList` 유령 모델 / quote-lists | **0건** |
| 벤더 포털 mock 데이터 | **0건** (vendor 문자열 매칭 10건은 sourcing·inventory-reorder 의 다른 맥락) |
| placeholder success (templates 등) | 0건 |

→ **이번 sweep 이 재발견한 것이 아니다.** 유령 모델·mock 렌더·조용한 실패는
어떤 테스트도 잡고 있지 않았다. 정적 소스 sentinel 은 "그 문자열이 있는가" 만 보므로
**동작하지 않는다는 사실 자체를 볼 수 없었다** — 이 세션 내내 확인한 그 한계다.

### ⚠️ 다만 1건은 **내가 만든 회귀**였다 (즉시 승계 처리)

`src/__tests__/regression/ai-insight-lock-leak.test.ts` — **§11.369-2 (호영님 P-track)**.

```
FAIL  성공 경로 enforcement.complete() 호출
      expected '...' to match /enforcement\.complete\(/
```

`789bce00`(읽기 전용 라우트의 거짓 감사 차단)에서 `complete()` → `fail()` 로 바꾸며
이 sentinel 을 RED 로 만들었다. **그때 "ops 170 passed / RED 0" 으로 보고했다** —
regression 스위트를 안 돌렸기 때문이다. §0 의 피해가 내 작업에서 실제로 발생했다.

**메모리 규칙 위반**: *이전 결정을 잠근 sentinel 대체는 승인 후 진화, 충돌 시 구현 전 상신·halt.*
sentinel 존재를 확인하지 않고 코드를 바꿨다.

**처리 — 은퇴가 아니라 승계.** §11.369-2 가 지키려던 것은 **lock 해제 보장**이고,
그 목적은 `complete()` 로도 `fail()` 로도 달성된다(둘 다 `failMutation` 호출).
쓰기가 0인 핸들러이므로 `fail()` 이 옳고, **원 계약은 유지되며 오히려 강화된다**
(E8 이 재발을 감시). 첫 단언을 `fail()` 로 승계하고 사유를 파일 주석에 남겼다.

---

## 3. 호영님 질문 — **워크벤치·견적·제품 상세가 목록에 있는가**

**있다. 30 파일.** 왕복 검증 전에 읽어야 한다.

| 영역 | 대표 파일 (assertion) |
|---|---|
| 견적 발송 | `quote-dispatch-mobile-banner-272b`(12) · `quote-dispatch-visible-gate-274`(11) · `quote-dispatch-fixed-flow-264h5`(6) |
| 견적 테이블/카드 | `quote-table-v2-phase-a`(4) · `quote-card-sian-border-checkbox`(3) · `quote-bottom-sheet-dual-overlap-264i`(5) |
| 소싱 | `sourcing-filter-mobile-unified-263b`(15) · `sourcing-hamburger-menu-254b`(5) · `sourcing-search-toolbar-258b/d`(8) |
| 비교 | `compare-completed-notification`(18) · `compare-detail-mobile`(11) |
| 워크벤치 레일 | `quotes-workbench-rail-column-fit-A`(2) |

⚠️ **전부 B-contract(정적 단언)다.** 즉 "발송이 안 된다" 가 아니라 "발송 화면의 소스에
기대한 문자열이 없다" 이다. 그래도 **왕복 검증 전에 읽어야 한다** — 그중 일부는
UI 가 실제로 바뀌었는데 sentinel 이 안 따라온 것이고, 일부는 기능이 사라진 것일 수 있다.
정적 단언만으로는 둘을 구분할 수 없다(§0 의 한계 그대로).

---

## 4. 호영님 질문 — **250은 언제부터인가**

기존 기록으로 역산한다(신규 측정 아님):

| 시점 | 근거 문서 | 규모 |
|---|---|---|
| 2026-06-15 | `BASELINE_suite-red-2026-06-15.md` | dashboard+regression 부분집합만으로 **91 파일 / 286 test fail** |
| 2026-08-02 | `PLAN_regression-baseline-triage.md` | regression 스위트 424파일 중 **30파일 / 50 test** — 그 트랙에서 **0 RED 로 복구 완료** |
| 2026-08-12 (오늘) | 이 문서 | 전체 1192파일 **112파일 / 250 test** |

→ **오래된 부채다. 최근 급증이 아니다.** 2026-06-15 시점에 이미 부분집합만으로 286건이었다.
2026-08-02 트랙이 `regression` 하위만 0으로 만들었고(현재 그 디렉토리는 10건뿐 — 그중 1건이
방금 내가 만든 회귀), **`dashboard` 하위 162건은 손대지 않은 채 남아 있다.**

원인도 그 문서에 적혀 있다:
> 각 트랙이 관련 sentinel + build 만 검증하고 push(전체 suite 미실행)하며 stale 누적.

**즉 §0 의 "부분집합을 전체처럼" 은 이 레포의 누적 관행이었고, 나도 그대로 했다.**

---

## 4-1. 1단계 — **ratchet 고정** (2026-08-12 완료)

245개를 교정하지 않는다. 대신 **잃어버린 능력만 되찾는다: 회귀를 놓치지 않는 것.**

| 산출물 | 내용 |
|---|---|
| `apps/web/test-baseline.json` | 실패 파일 목록 **70 파일 / 247 assertion** (커밋) |
| `apps/web/scripts/suite-gate.ts` | 전체 스위트 실행 + 기지선 대조 |
| `npm run test:gate` | 게이트. `-- --update` 로 의도적 갱신 |

계약은 E1/E2 동형이다:
- 목록 **밖** 새 실패 1건이라도 → RED (E1)
- 목록에 있는데 지금 통과 → RED, 목록에서 빼야 함 (E2, stale 방지)

**GREEN 의 정의가 바뀐다**: `ops 196 passed` 가 아니라
**`전체 11522 passed / 247 failed (기지선 일치)`**.

corrupt→RED 실증: 기지선에서 1건 제거 → `🛑 신규 실패 1 파일` 로 경로까지 출력.

### 게이트 설계 판단 2건

**(가) git 추적 파일만 본다.** 게이트는 **커밋된 계약**을 측정한다. 로컬 미추적
테스트가 실패한다고 RED 를 내면 체크아웃마다 결과가 갈린다.
실측: `quote-centerworkwindow-demote-363b.test.ts` 가 미추적 상태로 3건 실패 중 —
기지선에서 제외하고 실행 시 경고로 표시한다.

**(나) 파일 단위다.** assertion 단위로 잠그면 stale 목록 관리 비용이 245건 교정 비용에
근접한다. 대가: 같은 파일 안에서 실패 assertion 이 **교체**되면 못 잡는다.

### ⚠️ flaky 1건 관측

게이트 4회 실행 중 1회가 `69 파일 / 246` 으로 나왔다(나머지 3회 70/247).
flaky 는 **양방향으로 오판**한다 — 신규 RED 또는 stale 오탐. 발견 시 목록이 아니라
그 테스트를 고쳐야 한다. 후보는 아래 §4-3.

## 4-2. 부정 단언 필터 — **2건, 1파일뿐**

호영님 지시: *긍정 단언 stale 은 UI 진화의 흔적일 수 있으니 왕복에서 보고,
**부정 단언 깨짐**("없어야 할 것이 생겼다")만 읽어라.*

전체 250건 중 부정 단언 실패는 **2건 / 1파일**이다.

```
src/__tests__/dashboard/quotes/quote-centerworkwindow-demote-363b.test.ts
  · dead primary 라벨 "승인 패키지 준비 완료" 제거 (approval_prep)
      expected ... not to match /승인 패키지 준비 완료/
  · dead primary 라벨 ternary "선택안 확정" 제거 (compare_review>=2)
      expected ... not to match />= 2 \? "선택안 확정" : "추가 회신 확보"/
```

**이 파일은 git 미추적이다.** 즉 누군가 sentinel 을 먼저 쓰고 코드는 아직 안 고친
상태(또는 미완 작업)다. 내가 커밋하지 않았다 — 남의 미커밋 작업이다.

판정: **"없어야 할 것이 생겼다" 가 아니라 "지우기로 한 것을 아직 안 지웠다"** 이다.
회귀가 아니라 미완이다. 견적·소싱 30파일에서 **진짜 회귀 성격의 부정 단언 실패는 0건**.

→ 나머지 28파일(긍정 단언 stale)은 읽지 않는다. **왕복에서 직접 본다.**
   코드를 더 읽는 것으로 동작을 알 수 없다는 이 세션의 교훈을 여기에도 적용한다.

## 4-3. 분류 중 발견한 실제 결함 1건 — `executionId` 충돌

`src/lib/ai/__tests__/dispatch-execution-handoff.test.ts` H5 가 실패한다.

```
expected 'exec_mspnzrf8' not to be 'exec_mspnzrf8'
```

서로 다른 `idempotencyKey` 로 만든 두 execution 이 **같은 executionId** 를 받았다. 원인:

```ts
executionId: `exec_${Date.now().toString(36)}`
```

**같은 밀리초 안에 생성되면 충돌한다.** 동일 패턴이 4곳에 있다:
`approval-execution-queue-engine.ts:84` · `dispatch-execution-engine.ts:133` ·
`receiving-execution-engine.ts:195` · `receiving-execution-resolution-v2-engine.ts:29`
(+ `receiving-intake-workbench-engine.ts:280`).

시간 의존이라 **간헐 실패**한다 — §4-1 의 flaky 후보가 이것이다.
빠른 머신일수록 재현율이 올라간다(이 머신에서 3/3 재현).

⚠️ 이것은 stale 계약이 아니라 **제품 결함**이다. 두 실행이 같은 id 를 가지면
발송·입고 이력이 뒤섞인다. → **§execution-id-collision** 등재(교정은 지시 대기).

## 4-4. 이 숫자가 말하는 것 — §sentinel-ast-migration 의 근거

> **정적 sentinel 은 UI 가 정상적으로 진화하면 자동으로 깨진다.**

245개가 그 증거다. 그리고 **이번 세션에 만든 20여 개도 같은 운명**이다 —
`readFileSync` + `toMatch` 는 "그 문자열이 그 자리에 있는가" 만 보므로,
리팩터링·문구 변경·컴포넌트 분리 어느 것에도 견디지 못한다.

이 세션에서 이미 세 번 겪었다: E3 정규식 두 번 오탐 · E6 optional catch binding 누락 ·
E8 의 `dbTyped` 누락. **문법 변형에 구조적으로 취약하다.**

→ §sentinel-ast-migration 은 취향 문제가 아니라 **245라는 숫자가 근거**다.
   동결은 유지하되(실사용자 트래픽 우선) 재개 시 이 절을 근거로 쓴다.

## 5. 판정과 다음

- **교정하지 않는다** (호영님 지시). 1단계는 ratchet 고정까지다(§4-1).
- 예외 1건: `ai-insight-lock-leak` — 내가 만든 회귀이므로 즉시 승계 처리했다.
- **동결하지 않는다** — 사용자 앞에 세우려면 무엇이 깨져 있는지 알아야 한다.

### 착수 시 우선순위 제안 (판단은 호영님)

1. **D + E (5건)** — 런타임 오류·인프라 버그. 가장 얇고 성격이 명확하다.
2. **워크벤치·견적·제품 상세 30파일** — 왕복 검증 직전에 읽는다. 읽기만 해도
   "무엇이 사라졌는지" 가 드러날 수 있다.
3. **`dashboard` 나머지** — 162건. 별도 트랙.

### 이 부채가 다시 쌓이지 않게

`ops` 서브셋 게이트는 빠르지만 **전체를 대표하지 않는다.**
전체 스위트는 ~270초다 — 커밋마다 돌리기엔 무겁고, **트랙 종료 시점에는 반드시** 돌린다.
보고 형식(§0)을 지키면 부분집합이 전체로 오독될 여지가 없어진다.
