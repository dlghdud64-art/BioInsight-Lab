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

## 관련

- `PLAN_org-management-web.md` — C1(좌석 한도)이 이 카드를 물어 올렸다
- §reachability-needs-a-different-tool — 겹 2 가 "분기를 읽었다 → 참이 되는 경우를 안 셌다" 사례
