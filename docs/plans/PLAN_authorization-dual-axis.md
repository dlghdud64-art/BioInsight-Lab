# §authorization-dual-axis — 권한 축이 둘인데 서로 대화하지 않는다

- **Status:** 등재 (2026-08-12) · **교정 금지** · 실측 1건 완료
- **발견 경위:** §team-create-bootstrap 교정 후, `['ops_admin']` 단독 액션 13개 목록을
  보다 호영님이 세운 가설. **실측으로 확정됐다.**

---

## 1. 가설 (호영님 2026-08-12)

> **권한 축이 두 개고, 서로 대화하지 않는다.**
>
> - `User.role` (RESEARCHER/ADMIN → requester/ops_admin) — **전역 축**
> - `OrganizationMember.role` (OWNER/ADMIN/…) — **조직 축**
>
> `authorization-guard` 는 전역 축만 본다. **조직 OWNER 라는 사실이 판정에 안 들어간다.**

## 2. 실측 — **확정. 조직 역할은 판정에 없다**

`src/lib/security/server-authorization-guard.ts` 전수:

| 찾은 것 | 결과 |
|---|---|
| `OrganizationRole` 참조 | **0** |
| `OrganizationMember` 참조 | **0** |
| `organizationId` 참조 | 2곳 — `ServerActorContext.organizationId`(:34), `isOrganizationAuthorized`(:274) |

즉 **조직 "소속"은 테넌트 격리에만 쓰이고, 조직 "역할"은 어디에도 쓰이지 않는다.**
판정은 오직 `mapUserRole(User.role)` → `SystemRole` 로만 이뤄진다.

→ **가설 확정.** 축은 둘이고, 판정기는 한쪽만 본다.

### 2-A. 🛑 그 옆에서 하나 더 — 조직 **소속**조차 하드코딩이다

`server-enforcement-middleware.ts:144`

```ts
organizationId: 'default-org', // TODO: 실제 org 조회 (Batch 2에서 DB 연결)
```

`isOrganizationAuthorized` 가 비교하는 `actor.organizationId` 는 **모든 사용자에게
같은 상수**다. 즉 그 테넌트 격리 비교는 **실질적으로 판정하지 않는다**
(같은 상수끼리 비교하거나, 실제 org id 와 달라 항상 capability 폴백으로 간다).

⚠️ 그 TODO 옆 주석은 §audit-taxonomy-review 를 선결로 지정하고 있다 —
**이 트랙과 그 트랙이 같은 지점에서 만난다.**

## 3. 함의 — 부트스트랩 역설은 **원인이 아니라 증상**이다

`team_create` 교정은 증상 하나를 막은 것이다. 목록에 이런 것들이 섞여 있다:

```
member_role_change · member_capabilities_change · organization_security_change
```

**전부 조직 소유자가 당연히 해야 할 일인데 `ops_admin` 을 요구한다.**
조직 축이 판정에 없으니, 조직 OWNER 여도 전역 `RESEARCHER` 면 막힌다.

→ **13개 중 상당수가 같은 뿌리에서 나온 발현일 수 있다.**
   하나씩 여는 것은 두더지잡기다(호영님).

### `['ops_admin']` 단독 13개 (2026-08-12 실측, 고치지 않음)

`order_status_change` · `ai_ops_control` · `email_draft_approve` ·
`member_role_change` · `member_capabilities_change` · `organization_security_change` ·
`team_manage` · `workspace_manage` · `budget_delete` · `billing_checkout` ·
`billing_payment_method` · `governance_data_mutation` · `sensitive_data_delete`

📌 눈에 걸리는 것: **`billing_checkout`** — 첫 결제도 `ops_admin` 이면
`team_create` 와 같은 부트스트랩 역설일 수 있다(미판정).

## 4. 지금 하지 않는 것

**교정하지 않는다**(호영님). 이번 세션에서는 **판정만 받고 닫는다.**

착수하면 큰 안이다 — 판정기에 조직 축을 들이는 것은
① `ServerActorContext` 에 실제 조직 멤버십을 채우고(2-A 의 TODO),
② 액션별로 "전역 축만 / 조직 축만 / 둘 중 하나면 통과" 를 정하고,
③ 13개를 그 기준으로 재분류하는 작업이다.

⚠️ **우선순위: §2 딥링크보다 뒤다**(호영님) — 권한 축은 구조 문제라 크지만,
**고객이 견적을 못 보내는 것은 지금 문제**다.

## 5. 관계

- §team-create-bootstrap — 이 트랙의 **첫 증상**. 교정 완료(누락 보정)
- §audit-taxonomy-review — 2-A 의 TODO 가 그 트랙을 선결로 지정한다
- §onboarding-blocker #8 — 같은 증상의 게이트 등재
