# §org-create-limit-always-free — 조직 생성 한도가 모두에게 FREE 로 걸린다

**등재 2026-08-24** · 조직 관리(웹) P0 대조 중 발견 · **UI 트랙과 독립된 단독 슬라이스**

🛑 유료 플랜 고객도 조직을 **1개만** 만들 수 있다. 플랜을 조회하는 코드가 없다.

## 현행 (`app/api/organizations/route.ts:140~166` · 실측 2026-08-24)

```ts
existingMemberships = await db.organizationMember.findMany({
  where: { userId: session.user.id },      // 🛑 organization include 없음 → plan 을 못 본다
});
const currentOrgCount = existingMemberships.length;
// subscription 없으면 전부 FREE 가정
const plans: string[] = existingMemberships.map(() => "FREE");   // 🛑 조회 0 · 무조건 FREE
const hasPro   = plans.some((p) => p === "TEAM" || p === "ORGANIZATION");
const hasBasic = !hasPro && plans.some((p) => p === "BASIC");    // 🛑 enum 에 없는 값
const orgLimit = hasPro ? Infinity : hasBasic ? 3 : 1;
```

## 네 겹

```
겹 1  plan 조회 0        map(() => "FREE") — membership 에 organization 을 include 하지 않아
                         plan 을 볼 수단 자체가 없다. 주석은 "subscription 없으면" 이라 적었지만
                         subscription 도 조회하지 않는다.
겹 2  도달 불가 분기      "BASIC" 은 SubscriptionPlan enum 에 없다 (FREE·TEAM·ORGANIZATION).
                         TEAM 의 마케팅 이름이 Basic 이라 문자열만 남았다.
                         → hasBasic 은 plan 이 채워져도 영원히 false.
겹 3  세 번째 진실        조직 생성 한도 1/3/∞ 가 이 파일에 인라인 상수로 있다.
                         PLAN_LIMITS(lib/plans.ts:172)에는 maxOrganizations 자체가 없다.
겹 4  결과               orgLimit 은 항상 1. 유료 고객이 두 번째 조직 생성 시 403
                         PLAN_LIMIT_EXCEEDED + "Free/Starter 요금제에서는..." 문구.
```

🔑 `Organization.plan` 은 **살아 있다** — billing/webhook(:80·:165·:201)이 쓰고
subscription(:183)·billing(:355)이 읽는다. 이 자리만 안 읽는다.

## 왜 지금 나왔나

조직 관리(웹) 트랙의 C1(좌석 한도) 대조 중, `/api/organizations` 응답에 `plan` 이
있는지 재다가 나왔다. 좌석 한도를 재려던 grep 이 생성 한도의 결함을 물어 올렸다.

## 🛑 분리 판정 — UI 트랙과 묶지 않는다

```
성격    사용자 도달 · 실사용 차단 (유료 고객이 기능을 못 씀)
축      서버 entitlement — 조직 관리 UI 개편(PLAN_org-management-web)과 파일도 목적도 다르다
묶으면  UI 계획서의 P0~P6 중 어디에도 안 맞고, UI rollback 이 이 수정을 같이 되돌린다
```
**단독 슬라이스로 처리한다.** UI 트랙의 C1(응답에 plan 실기)과는 같은 파일을 건드리므로
착수 순서만 조율하면 된다 — 이쪽이 먼저면 C1 이 그 위에 얹힌다.

## 착수 시 측정 항목

```
1  조직 생성 한도의 정본은 어디인가 — PLAN_LIMITS 에 maxOrganizations 를 신설할지,
   이 파일 인라인을 유지할지. 신설이면 세 번째 진실이 사라진다 (권장 방향이나 판정 대상)
2  "BASIC" 문자열을 쓰는 다른 지점 전수 — 도달 불가 분기가 여기만인지
3  현재 프로덕션에 조직 2개 이상 보유 사용자가 있는가 (있다면 이 가드를 우회한 경로가 있다)
4  enforceAction(:119 주석)이 이 판정과 겹치는가 — 이중 게이트면 하나가 dead 다
5  유료 고객 실제 영향 범위 — TEAM·ORGANIZATION plan 조직 수
```

## 실측 2026-08-29 — 착수 5항 **전항 종결**

### ① 한도 정본 — `maxOrganizations` 부재 확인 · 세 번째 진실 성립

```
PLAN_LIMITS 키 전수 (lib/plans.ts:148~153)
  maxMembers · maxQuotesPerMonth · maxSharedLinks · maxItems · maxLabelScansPerMonth
  🛑 maxOrganizations 없음 — 카드 기재대로다.
```

조직 생성 한도 1/3/∞ 는 `route.ts:154` 인라인 상수에만 있다. **신설이 권장 방향이나
값은 판정 대상이다** — 인라인 1/3/∞ 와 `maxMembers` 1/3/10 이 FREE·TEAM 에서 숫자가
겹치고 ORGANIZATION 에서만 갈린다(∞ vs 10). 베낀 자국인지 의도인지는 증거가 없다.
⚠️ 신설 시 ORGANIZATION 을 ∞ 로 둘지 유한으로 둘지 **호영님 판정 필요.**

### ② `"BASIC"` 전수 — 도달 불가 분기는 **여기 하나뿐**

```
소스 전역(__tests__ 제외) grep "BASIC"  → 1건: route.ts:153
enum SubscriptionPlan (schema.prisma:49) → FREE · TEAM · ORGANIZATION
```
겹 2 는 이 파일에 고립돼 있다. 다른 지점 전파 0 — **항목 종결.**

### ④ `enforceAction` 겹침 — 이중 게이트가 **아니다**

```
:119~120 주석  "생성(POST)에서는 인증만 확인하고 enforcement 를 건너뛴다"
:185 · :190    미사용 재확인
enforceAction 호출  0건 (import 만 있고 부르지 않는다 — dead import)
let enforcement(:104)  대입 0 · 사용 0 — dead local
```

🔑 **겹치지 않아서 더 나쁘다.** 같은 주석이 `플랜 한도 체크(아래)가 실질적인 gate 역할`
이라고 선언했는데, **그 유일한 gate 가 고장나 있다.** 우회 게이트가 없으므로
유료 고객 차단에 예외 경로가 없다 — 겹 4 가 전량에 걸린다.

↳ 이 결과가 항목 3 의 의미를 바꾼다: prod 에 조직 2개+ 보유자가 **있다면**
   이 라우트를 거치지 않은 생성(시드 · 직접 DB · 다른 경로)이 있다는 뜻이다.

### 덤 — `PLAN_LIMIT_EXCEEDED` 는 **미배선**이다 (dead 아님)

```
소스 전역 grep  → 1건 (route.ts:163 발신처뿐) · 클라이언트 소비 0
```

🛑 **정정 — 앞서 "dead payload" 라고 적었으나 틀렸다.** 제거 대상이 아니다.
`PLAN_LIMIT_EXCEEDED` 는 **결제 전환 지점**이다. 문구만 띄우면 왜 막혔는지 모르고 이탈하고,
code 를 빼면 나중에 분기할 때 서버를 다시 건드려야 한다.

**판정 B (호영님 2026-08-29) — code 유지. UI 분기는 별 슬라이스.**
→ `§org-create-limit-ui` : `PLAN_LIMIT_EXCEEDED` 업그레이드 유도 분기 (named pin · vague "다음에" 금지)

### 🛑 수정 후 재측정 방법 (무엇을 바꿔서 다시 재는가)

한도 로직은 **데이터를 바꿔야만 우연한 통과와 갈린다.** 수정본이 GREEN 이어도
아래를 안 돌리면 "여전히 항상 1" 과 구분되지 않는다.

```
A  TEAM plan 조직 1개 보유 계정 → 2번째 생성  기대 201 (현행 403)   [mock 으로 닫힘]
B  FREE plan 조직 1개 보유 계정 → 2번째 생성  기대 403 PLAN_LIMIT_EXCEEDED (회귀 핀)
C  plan 미설정(subscription 행 없음)          기대 FREE 취급 · 403 — 방어 경로 보존
D  OWNER 아닌 멤버십만 보유한 FREE 사용자      기대 첫 조직 생성 201   ← 분모 오염 핀
E  남의 TEAM 조직에 초대된 FREE 사용자         기대 2번째 생성 403     ← 분자 오염 핀
```
A 만 보면 한도가 통째로 풀린 것과 구분 불가라 **B · C 가 같이 있어야 판정이다.**
D · E 는 축 판정(아래)의 핀이다 — 없으면 OWNER 필터가 걸렸는지 우연인지 안 갈린다.

🛑 **A 는 prod 에서 못 잰다.** ⑤ 실측상 유료 조직이 0이라 대상 계정이 없다.
   → **시드 이관 철회 (2026-08-29) — mock 으로 닫힘.**
   `org-create-limit-b1b.test.ts` 의 fake DB 가 `where` 절을 실제 해석하므로
   시드 요건(TEAM plan 소유자)을 흡수했다. **A 는 미측정이 아니라 GREEN 이다.**

## 실측 2026-08-29 (2) — ③ · ⑤ prod read-only

```
⑤ plan 분포   FREE 4 · TEAM 0 · ORGANIZATION 0   (총 조직 4 · 소속 보유 사용자 4)
③ 다중 소속   0행                                 (4명이 1개씩)
```

### 🛑 근거 정정 — "지금 장애" 가 아니라 "첫 결제 시 확정 차단"

유료 조직이 **아직 하나도 없다.** "유료 고객이 돈 내고 막히는 라이브 장애" 는
현시점에서 성립하지 않는다 — 결함은 실재하나 **아직 아무도 밟지 않았다.**

**그러나 우선순위는 내려가지 않는다.** ③ 0행이 우회 경로 없음을 확정했으므로
**첫 유료 전환자가 반드시 밟는다.** 돈이 들어오는 바로 그 순간 깨지는 자리다.

---

## 축 판정 (호영님 2026-08-29) — **조직 축 · OWNER 만**

`hasPro` 가 내 멤버십 **전체**를 보는 것은 **entitlement 유출**이다.
남의 유료 조직에 초대만 받아도 내 상한이 풀린다 —
**남의 조직 상태가 내 판정을 바꾸는** 형태이며, 격리 감사에서 닫은 것과 같은 형태다.

🔑 같은 표현식에 **두 번째 오답**이 붙어 있다 — 분자·분모가 같은 오염을 공유한다.

```
분자  plans (plan 파생)          남의 조직 plan 이 내 상한을 올린다
분모  existingMemberships.length 초대받은 조직이 내 생성 한도를 깎는다
                                 → FREE 사용자가 초대 한 번 받으면 자기 조직을 못 만든다
```

→ **OWNER(생성자) 역할 멤버십만 계수하고, plan 도 거기서만 파생.**
   초대 멤버십은 분자에도 분모에도 들어가지 않는다.

---

## enum 정본 실측 2026-08-29 — `3` 은 **TEAM** 에 붙는다 (선택 아님)

```
축 1  PLAN_DISPLAY (plans.ts:82~113 · §11.304)
      FREE→"Free" · TEAM→"Basic" · ORGANIZATION→"Pro"
      주석이 "PLAN_DESCRIPTOR 의 canonical label 과 동기화" 라고 선언
축 2  PLAN_LIMITS 주석 (§pricing-redesign 호영님 2026-06-27)
      TEAM 에 "Basic 팀원 5→3" · ORGANIZATION 에 "Pro 팀원 10명"
축 3  route.ts:157~158 — 고장난 코드가 의도를 들고 있다
      planName = hasPro ? "Pro" : hasBasic ? "Basic" : "Free/Starter"
      limitLabel = 무제한 / 3개 / 1개
```

세 축이 같은 사다리를 가리킨다 — **FREE 1 · TEAM(Basic) 3 · ORGANIZATION(Pro) ∞.**

🛑 **겹 2 는 오타 하나가 아니라 둘이다.**

```
"BASIC"   enum 에 없는 값 (있어야 할 건 "TEAM")
hasPro    TEAM 을 삼킨다 — Pro 는 ORGANIZATION 하나뿐이다
```
둘이 맞물려 `3` rung 을 양쪽에서 봉쇄한다. 하나만 고치면 안 열린다.

🛑 **둘의 무게가 다르다 (호영님 2026-08-29).** "하나만 고치면 안 열린다" 보다 이쪽이 실질 위험이다.

```
"BASIC"   enum 에 없어서 죽은 코드다 — 눈에 띈다. 읽으면 보인다
hasPro    살아 있는 코드가 조용히 틀린 답을 낸다
          → "BASIC" 만 고쳐도 hasPro 는 여전히 TEAM 을 ∞ 로 보낸다
```
즉 겹 2 의 절반만 수정하면 **막힘은 풀리는데 Basic 고객이 무제한을 받는다.**
증상이 사라져서 종결로 보이는 형태라 더 위험하다.

⚠️ 별건 — `schema.prisma` 의 한국어 주석이 인코딩 깨짐(`TEAM // ? ?랜`).
   enum 값 자체는 무손상이라 이 판정에 영향 없다. 이 슬라이스 밖.

---

## 판정 A (호영님 2026-08-29) — ORGANIZATION 은 **∞ 유지**

조직 개수와 멤버 수는 다른 축이다. `maxMembers` 계단(1/3/10)을 따라갈 이유가 없고,
FREE·하위 계단에서 숫자가 겹치는 것은 **베낀 자국이라는 증거지 정합의 증거가 아니다.**
ORGANIZATION 은 다법인·다사업장이 대상이라 상한을 두면 영업 협상마다 코드 변경이 붙는다.

조건 둘:
```
1  ∞ 를 Infinity / null 어느 쪽이든 명시적 sentinel 로. 매직값 금지
2  maxOrganizations 와 maxMembers 를 같은 리터럴에서 파생시키지 말 것
   — 지금 겹침이 다음 maxMembers 개정 때 조직 상한을 조용히 끌고 간다.
     그게 이번 오독의 재발 경로다
```
🔑 `Record<SubscriptionPlan, …>`(PLAN_LIMITS · PLAN_DISPLAY · PLAN_ORDER 관용)으로 가면
   조건 1이 자동 충족되고, enum 확장 시 타입이 빠진 키를 잡는다.

---

## 슬라이스 분리 — B1b / B2

B1 을 B2 에 묶으면 **판정 대기 동안 차단이 계속 산다.** 분리한다.

### B1b (지금)
```
1  findMany 에 organization 실기                (겹 1 — 지금은 plan 이 실려오지도 않는다)
   📌 정정 2026-08-29: 착수 문구는 include 였으나 실제는 select 로 갔다.
      겹 1 해소 조건(plan 을 실어온다)은 동일하고 과다조회가 0이다 (호영님 승인)
2  OWNER 역할 필터 — 계수 · plan 파생 양쪽      (축 판정)
3  plan 파생을 ternary 사슬 → enum 기반 매핑     (겹 2 두 오타 동시 해소)
4  인라인 1/3/∞ 는 이 슬라이스에서 정정         (PLAN_LIMITS 이관은 B2)
```
🛑 **B1a(겹 1 만)는 폐기됐다.** "인라인 값 안 건드림" 이 값 중립이 아니었다 —
   ternary 사슬이라 손 안 대는 것 자체가 **TEAM 에 ∞ 를 주는 선택**이었다.

### B2 (판정 A 반영 · 후속)
```
maxOrganizations 정본 신설 + route.ts 인라인 제거 (세 번째 진실 소멸)
```

### 🔑 §2b 실증 사례

이 카드가 §2b 의 실물이다. **배선 확인이 답을 냈고("구조 맞음"), 그 답을 근거로
슬라이스를 잘랐는데, 계수 축이 하나(유래 여부)뿐이라 두 번째 축
(값이 어느 rung 에 착지하는가)이 안 보였다.** 축 하나로 센 확인은 확인이 아니다.

## B1b land 2026-08-29 — 구현 · 검증

### 게이트 통과 기록 (착수 전)

```
게이트 1  planName/limitLabel 소비처   실려 있다. error 문구에 보간되고
          dashboard/organizations/page.tsx:255~260 이 그대로 실패 토스트에 띄운다
          → 지우지 않고 같은 Record 계열에서 파생시켜 살렸다
게이트 2  sentinel 옛 값 sweep          "Free/Starter" · "요금제에서는" ·
          PLAN_LIMIT_EXCEEDED · hasBasic · orgLimit 전부 0건.
          hasPro 히트 1건은 hasProduct( 부분일치 — 무관
게이트 3  OWNER 필터 레거시 안전성      🛑 착수 중 발견. OWNER 배선은
          §team-org-role-model Phase 2(2026-08-12) 이후다. 그 이전 생성분은 ADMIN 이라
          필터에 안 잡히고 계수 0 → 한도가 오히려 풀린다.
          prod 실측: OWNER 4 · ADMIN 0 · OWNER 0인 조직 0행 → 인스턴스 없음. 통과
```

### 구현 (`route.ts` · +69 / −17)

```
1  findMany 에 organization 실기      select: { organization: { select: { plan: true } } }
   (include 가 아니라 select — 과다조회 0. 겹 1 해소 조건은 동일)
2  OWNER 필터                          where: { userId, role: "OWNER" } — 계수·plan 파생 양쪽
3  ternary 사슬 → Record 매핑          MAX_ORGANIZATIONS: Record<SubscriptionPlan, number|null>
   최고 등급 선택은 PLAN_ORDER 로. 오타 둘(hasPro·"BASIC") 동시 소멸
4  인라인 값 정정                      FREE 1 · TEAM 3 · ORGANIZATION null(∞)
   📌 PLAN_LIMITS 이관은 B2 — 세 번째 진실은 아직 남아 있다
```

라벨은 `getPlanDisplayName()` 파생으로 교체. `"Free/Starter"` → `"Free"` 는
§11.304 의 `fallback "Starter" → "Free" 정합` 과 같은 방향이다.
`"무제한"` 분기는 제거했다 — `orgLimit === null` 이면 한도 초과 문구에 도달할 수 없다.
**원래도 도달 불가였다**(hasPro → Infinity → 비교가 항상 false).

### 재측정 5종 + 사다리 핀 — 10/10 GREEN

```
A  TEAM 1개 소유 → 2번째        201   (현행 결함은 403)      ← 시드 이관 철회 · mock 으로 닫힘
B  FREE 1개 소유 → 2번째        403 PLAN_LIMIT_EXCEEDED · "Free" · "1개"
C  plan 미설정                   403   FREE 취급 — 방어 경로 보존
D  OWNER 아닌 멤버십만 보유       201   첫 조직 생성 — 분모 오염 핀
E  남의 TEAM 에 초대된 FREE 소유자 403  2번째 차단 — 분자 오염 핀
+  TEAM 3개 소유 → 4번째         403 · "Basic" · "3개"       ← hasPro 삼킴 회귀 핀
+  TEAM 2개 → 3번째 201 · ORGANIZATION 5개 → 6번째 201 · 최고등급 선택 · 쿼리 배선
```

🔑 mock 이 `where` 절을 **실제로 해석한다.** 라우트가 OWNER 필터나 organization select 를
떨어뜨리면 fixture 가 통과시키는 게 아니라 시나리오가 깨진다 — D·E 가 우연한 통과와 갈린다.

### 주입 프로브 — 검출력 실증 (③ · 러너 기준: 프로젝트 러너)

```
프로브 1  where 에서 role:"OWNER" 제거      → 2 failed / 8 passed   RED
프로브 2  organization select 제거           → 6 failed / 4 passed   RED
프로브 3  TEAM rung 을 3 → null(무제한)      → 1 failed / 9 passed   RED
복원      cmp 로 원본 동일 확인
```

### 인접 회귀

```
api/organizations + organizations-list-three-column-p5   3 files · 27 tests GREEN
plans.ts  무변경 — B2 영역
```

### tsc 전수 대조 (호영님 지시 2026-08-29 — "변경 파일 0" 은 대조가 아니다)

```
baseline(HEAD~1 · route.ts 되돌리고 신규 test 격리)   27건
현재(HEAD)                                           27건
라인 단위 diff                                        0 (동일)
파일 11종 · 전부 __tests__ · src/app · src/lib 0건
  purchase-conversion 11 · phase3-sheet 3 · compare-matrix-best-highlight 2 ·
  phase3-action-bar 2 · convert-quantity-fidelity 2 · orders-budget-deduction 2 ·
  quote-drawer-qty-339 · catalog-public-ingest-phase2 · quotes-page-imports-smoke ·
  convert-pocandidate-to-orders · comparison-card-product-name-269c 각 1
```
증가 0 · **감소 0** · 파일 소실 0. diff 가 비었으므로 셋 다 같은 근거로 닫힌다.

---

## 🛑 데이터 불변식 — `OWNER 0인 조직 = 0` (호영님 지시 2026-08-29)

**주석은 발화하지 않는다.** 그리고 OWNER 필터의 안전은 코드가 아니라 **prod 데이터 상태**가
보증하고 있었다 — 2026-08-29 실측이 OWNER 4 · ADMIN 0 인 것은 백필
(`scripts/add-owner-role.mjs`)이 이미 돌았기 때문이고,
**백업 복원 · 다른 환경 · 수동 삽입 어느 쪽도 되살린다.**

```
lib     src/lib/health/owner-invariant.ts
        evaluateOwnerInvariant(n) → n === 0
        probeOwnerlessOrganizations(client) → { ok, ownerlessCount, clean } · SELECT 만
발화    GET /api/health 응답에 orgOwnership: { ok, reachable, ownerlessCount, clean }
        §migration-order-drift-guard 의 probe 관용 그대로 (count/boolean 만 노출)
복구    scripts/add-owner-role.mjs — 조직별 최초 ADMIN → OWNER 승격
```

위반 시 무슨 일이 일어나는가: OWNER 없는 조직의 소유자는 계수 0 이 되어
**한도가 조이는 게 아니라 풀리는 방향으로 뒤집힌다.**

```
단언    7 tests GREEN
프로브  불변식을 항상 성립으로      → 3 failed / 4 passed   RED
        SQL 에서 OWNER 조건 제거    → 1 failed / 6 passed   RED
        도달 실패를 clean 으로 참칭  → 1 failed / 6 passed   RED
런타임  배포될 SQL 원문을 소스에서 뽑아 prod 직접 실행 →
        ownerlessCount = 0 · clean = true   (정적 GREEN 과 별개로 실측)
```

## 관련

- `PLAN_org-management-web.md` — C1(좌석 한도)이 이 카드를 물어 올렸다
- §reachability-needs-a-different-tool — 겹 2 가 "분기를 읽었다 → 참이 되는 경우를 안 셌다" 사례
- §2b — 축 하나로 센 배선 확인이 두 번째 축을 가린 실증 사례 (위 §2b 실증 사례 절)
- §org-create-limit-ui — PLAN_LIMIT_EXCEEDED 업그레이드 유도 분기 (판정 B · named pin · 미착수)
- §prisma-comment-encoding — schema.prisma 한국어 주석 인코딩 깨짐(`TEAM // ? ?랜`). enum 값 무손상 · 슬라이스 밖 · 큐만 (호영님 2026-08-29)
