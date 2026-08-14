# §tenant-isolation-placeholder — 미완성 코드가 **보안 게이트 자리**에 앉아 있다

- **Status:** 등재 (2026-08-12) · **교정 금지** · ⚠️ **방향 미판정 — 다음 세션 첫 실측**
- **성격:** §authorization-dual-axis 와 **다른 문제**다. 저쪽은 *설계 미비*(축이 둘인데
  한쪽만 본다)이고, 이쪽은 **미완성 코드가 격리 판정 자리에 그대로 있다**는 것이다.
  성격이 다르면 거처도 달라야 한다(호영님).

---

## 1. 발견

`src/lib/security/server-enforcement-middleware.ts:144`

```ts
organizationId: 'default-org', // TODO: 실제 org 조회 (Batch 2에서 DB 연결)
```

이 값이 흘러가는 곳 — `server-authorization-guard.ts:270`

```ts
function isOrganizationAuthorized(actor, targetOrganizationId) {
  if (actor.organizationId === targetOrganizationId) return true;   // ← 한쪽이 상수
  return actor.entityCapabilities.some(cap =>
    cap.scope === 'organization' && cap.scopeId === targetOrganizationId);
}
```

**테넌트 격리 비교의 한쪽이 모든 사용자에게 같은 상수다.**

## 2. 왜 무거운가

> 비교문은 실행되고, 로그도 남고, 코드 리뷰에서는 **격리가 있어 보인다.**
> 그런데 판정하지 않는다. (호영님)

우리가 이 세션 내내 잡아온 **§placeholder-success 와 같은 형태**인데,
이번엔 대상이 **멀티테넌트 격리**다. **B2B SaaS 에서 이보다 무거운 자리는 없다.**

## 3. 🛑 방향을 아직 모른다 — 이것이 이 문서의 핵심

두 갈래이고, **어느 쪽인지에 따라 우선순위가 뒤바뀐다.**

| 갈래 | 내용 | 결과 | 순위 |
|---|---|---|---|
| **fail-open** | 양쪽이 상수라 항상 통과 / 또는 이 비교에 **도달하지 못하고** 통과 | **테넌트 누수** | 🛑 **§2 딥링크보다 앞. 출시 차단 사유** |
| **fail-closed** | actor 는 상수, target 은 실제 id → **항상 불일치** → capability 폴백 | **가짜 게이트**이되 데이터는 안 샌다 | §2 뒤 |

⚠️ 관련 사실 하나 — `hasEntityCapability()` 는 `entityCapabilities: []` 가 하드코딩돼
**항상 true 를 반환**한다(`server-enforcement-middleware.ts:146` 인근 TODO).
그렇다면 위 폴백이 **무조건 통과**로 귀결될 수 있다. 그 경우 fail-open 이다.
**추정이며 실측 전이다.**

## 4. 다음 세션 **첫 실측** (호영님 지시)

> `isOrganizationAuthorized` 의 비교가 실제로 어느 방향으로 결정되는가.
> 양쪽 피연산자가 **런타임에** 각각 무엇인지, 그리고 비교 결과가 요청을 **실제로 막은
> 적이 있는지**. **코드 독해가 아니라 다른 조직 리소스에 실제로 요청을 넣어서 확인.**

측정 방법(제안):
1. 개발 DB 에 **조직 2개 + 각 조직 사용자 1명**을 만든다
2. 조직 A 사용자 세션으로 **조직 B 의 리소스**에 요청한다(읽기·쓰기 각 1건)
3. 결과가 **차단(403)인지 통과인지** 기록한다 — 통과면 **fail-open 확정**
4. 동시에 `actor.organizationId` 와 `targetOrganizationId` 의 **실제 런타임 값**을 남긴다

### ✅ 순위 확정 (호영님 2026-08-12, 잠정 순위 **철회**)

> **다음 세션 첫 줄은 이 실측이다. §2 는 그 결과를 보고 정한다.**

철회 근거: **플레이스홀더 둘이 같은 경로에 겹쳐 있고, 둘 다 통과 방향으로 고장나
있다면 fail-open 이 더 유력하다.**
   ① `actor.organizationId = 'default-org'` (비교의 한쪽이 상수)
   ② `entityCapabilities: []` → `hasEntityCapability()` **항상 true** (폴백이 무조건 통과)

⚠️ 실측 추가 요구 — **양쪽 피연산자의 런타임 값을 로그로 남길 것.**
   차단/통과 **결과만 보면 다른 이유로 막혔을 때 격리가 작동한 것으로 오독한다.**
   왕복 4단계에서 **500 을 403 으로 착각할 뻔한 것과 같은 함정**이다.

## 5. 지금 하지 않는 것

- **교정 금지.** 방향을 모른 채 고치면 어느 쪽을 고쳤는지도 모른다
- 검증 도구 신설 금지(검증 인프라 확장은 동결 중) — **실제 요청으로** 잰다

## 6. 관계

- §authorization-dual-axis — 같은 파일에서 만나지만 **다른 문제**다
- §audit-taxonomy-review — `organizationId` TODO 옆 주석이 그 트랙을 선결로 지정한다
- §placeholder-success-audit — **형태가 같다.** 실행되고 기록되지만 판정하지 않는다
