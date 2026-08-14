# §tenant-isolation-placeholder — 미완성 코드가 **보안 게이트 자리**에 앉아 있다

- **Status:** 실측 완료 (2026-08-14) · **fail-open 확정** · **교정 금지(설계 승인 대기)**
  - 운영 실유출 **0**(조직 2개 중 멤버 보유 1개) → **사고 대응 아님, 결함 등급**
  - 등급이 바꾼 것은 순위가 아니라 **문제의 위치**다 → §7~§10
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
- §quote-listitems-include-drift — **수정 순서가 이 트랙 뒤로 잠긴다**(그 문서 §0)

---

## 7. 실측 결과 (2026-08-14) — **fail-open 확정**

### 7.1 로그 4값 (개발 DB, 조직 A/B 교차 요청)

```
[TENANT-ISO-PROBE] a_actor_organizationId="default-org"  b_target_organizationId="default-org"
                   c_hasEntityCapability=true            d_entityCapabilities_length=0
                   org_compare_equal=true                org_gate_result=true
```

정적 뒷받침: `src/app/api` 의 `enforceAction` 호출부 **170개 중 `organizationId` 를
넘기는 곳 0개**. `withEnforcement` 의 `extractOrgId` 는 **사용처 0**(정의 파일 자신뿐).
→ `config.organizationId || actorContext.organizationId` 폴백이 (a)를 (b)에 그대로
재사용한다. **(a)≡(b) 는 구조적 항등이며, 이 게이트는 조직을 거절할 수 없다.**

§3의 fail-closed 갈래는 **성립 불가**로 확정 — (a)≠(b) 가 비교된 흔적 0.

### 7.2 실제 데이터 이동

- **읽기**: `GET /api/quotes/[id]/status` → **200 + 타 조직 견적 데이터**(status·전이목록·타임스탬프).
  A는 B 조직 비멤버(`organizationMember` 조회 null 확증).
- **쓰기**: 같은 라우트 PATCH 에서 **조직 게이트 통과 로그 확인**, 그 뒤 라우트 내부
  Prisma 오류(§quote-listitems-include-drift)로 중단 → **row 변화 0, 판정 불가**.
  막은 것은 격리가 아니라 **깨진 쿼리**다.

### 7.3 등급

**fail-open** → 출시 차단 사유. 단 운영 실유출은 **0**:

```
운영(ref xhidy…): Organization 2 / User 3 / 멤버십 보유 user 1
  org-bioinsight-lab      멤버 0 · 리소스 0        ← 빈 껍데기
  cmqp6tp920001…("Test")  멤버 1(ADMIN) · quote 4
  조직 미소속 리소스: quote 3 · inventory 10 (userId 축)
```

"조직 2개 이상 **+ 각각 활성 사용자**" 미충족 → **소급 로그 조사 착수 사유 없음.**

## 8. 문제의 위치 — 게이트가 아니라 라우트

격리를 지탱하는 유일한 실체는 **라우트별 개별 소유권/멤버십 검사**다.
따라서 구멍 크기 = **자체 검사가 없는 핸들러 수**이며, 아래가 전수 분류 결과다.

핸들러 406개(= `src/app/api` 전 export handler) 정적 3분류 → 후보 18건 **전건 수동 검증**:

| 판정 | 수 | 근거 |
|---|---|---|
| 검사 있음 | 254 | 멤버십 조회 / session.user.id 비교 / scopeKey·guestKey 스코프 |
| 검사 없음이나 **테넌트 엔티티 미접촉** | 127 | translate·protocol·parse 등 무상태 유틸 |
| **유출면(수동 확정)** | **11** | §8.1 |
| 오탐(수동 기각) | 5 | reorder-recommendation·responses/[responseId]·vendor/insights·sourcing/recommend·check-slug |
| 설계상 공개(토큰=자격) | 2 | `share/[token]` · `receiving/[token]` |

### 🛑 8.0 정정 (2026-08-14, 런타임 재검증) — §8.1 의 11건은 **틀렸다**

§8.1 은 **라우트 레벨만 보고** 만든 목록이라 `middleware.ts` 의 실질 방어층을 누락했다.
probe-a(RESEARCHER)로 재실측한 결과:

| 원 번호 | 실측 | 재분류 |
|---|---|---|
| #3·#4·#5·#6·#7 (`/api/admin/*`) | **403** "관리자 권한이 필요합니다" | 미들웨어 차단 → **유출 아님**(A2: ops_admin 전역 축) |
| #8 `safety/spend` | 500 (`purchaseDate` 부재) | 호출부 0 → **삭제 완료** |
| #9 `products/safety` | 500 (`PurchaseRecord.organizationId` 부재) | 호출부 0 → **삭제 완료** |
| #10 `organizations/[id]/security` | 500 (`allowedEmailDomains` 부재) | **호출부 4** → 삭제 불가, A3 |
| #1 `GET /api/quotes/[id]/status` | **200 + 타 조직 데이터** | ✅ 살아있는 행 단위 유출 |
| #2 `PATCH /api/quotes/[id]/status` | 게이트 통과, 500로만 정지 | ✅ 드리프트 해제 즉시 착지 |
| #11 `GET /api/analytics/kpi` | **200**, 전 조직 집계 | ✅ 집계 단위 유출 (아래 주의) |

**고객 도달 유출 = #1·#2·#11 3건.** 나머지는 스태프 게이트 뒤이거나 드리프트로 죽어 있다.

⚠️ #11 은 성격이 다르다 — 호출 화면이 `src/app/admin/analytics/page.tsx`(내부 콘솔)인데
**API 경로가 `/api/admin/` 이 아니라 미들웨어 admin 게이트가 안 덮는다.**
페이지는 잠겼고 API 는 열린 형태다. 따라서 org 필터가 아니라 **라우트에 역할 검사 추가**가
정답이다(A2 와 같은 결론, 다른 시행 방법).

1차 오독(역할 게이트 조기 반환 → "경로 미도달")과 합쳐 **연속 2회 등급 오류**.
원인과 재발 방지는 §measurement-layer-blindness 로 승격했다.

### 8.1 유출면 초안 11건 — ⚠️ **§8.0 으로 정정됨. 아래는 라우트 레벨 가설이며 판정 아님**

| # | 핸들러 | 노출 | 상태 |
|---|---|---|---|
| 1 | `GET /api/quotes/[id]/status` | 타 조직 견적 상태 | **실측 200 확인** |
| 2 | `PATCH /api/quotes/[id]/status` | 타 조직 견적 쓰기 | 게이트 통과, 500로만 정지 |
| 3 | `PATCH /api/admin/quotes/[id]/items` | 타 조직 견적 품목·총액 쓰기 | 검사 0, 500로만 정지 |
| 4 | `GET /api/admin/quotes/[id]` | 임의 견적 상세 (**역할 검사조차 없음**) | 500로만 정지 |
| 5 | `GET /api/admin/quotes` | **전 조직** 견적 목록 | ADMIN 역할만, org 필터 0 |
| 6 | `GET /api/admin/orders` | **전 조직** 주문 목록 | 동일 |
| 7 | `GET /api/admin/orders/[id]/status` | 임의 주문 상태 | 동일 |
| 8 | `GET /api/safety/spend` | **쿼리스트링 `organizationId` 그대로 where** → 타 조직 구매이력 전량 | 검사 0 |
| 9 | `GET /api/products/safety` | 동일 패턴(`organizationId` 쿼리 파라미터) | 검사 0 |
| 10 | `GET /api/organizations/[id]/security` | 임의 조직 `allowedEmailDomains` | 인증만 |
| 11 | `GET /api/analytics/kpi` | 전 조직 집계(사용자수·이벤트수) | 조직 필터 0 |

⚠️ **5·6·7 은 역할(ADMIN)만 보고 조직을 보지 않는다.** 어느 조직의 ADMIN이든 전
조직 데이터를 읽는다 — §authorization-dual-axis 가 말한 "축이 둘인데 한쪽만 본다"의 실물.

### 8.2 이 목록의 신뢰 한계 (명시)

- 후보 18건은 1:1 수동 검증(오탐 5건 기각). **"검사 있음" 254건은 미검증** —
  검사가 *다른 엔티티*를 지키는 형태(quotes/[id]/status 가 만약 무관한 userId 비교를
  갖고 있었다면 own 으로 오분류됐을 것)는 정적으로 못 거른다.
- "테넌트 미접촉" 127건도 미검증 — raw SQL·헬퍼 경유 접근은 정규식이 놓친다.
- **최종 닫기는 정적 분류가 아니라 교차조직 런타임 스윕**이어야 한다(§10).

## 9. 수정 설계안 — **단일 배치 금지, 2단** (승인 대기, 미착수)

### 9.0 선결 — 세션에 org 가 없다

JWT 클레임에 조직이 없다(`session.user` = id·role·email). 그리고
`ServerActorContext.organizationId: string` 은 **단수**라 다중 소속을 표현할 수 없다.
→ 타입을 `organizationIds: readonly string[]` 로 넓히는 것이 선결이며 이것만으로 별도 스텝.

### 9.1 최소 diff 방향 재검토 — 호출부 170곳 수정은 **불필요할 수 있다**

당초 안(호출부마다 org 전달)은 배치가 크고, 더 나쁘게는 **대부분의 호출부가
`enforceAction` 을 리소스 `findUnique` 보다 먼저** 호출한다(핸들 open 순서) — 전달할
org 를 그 시점에 아직 모른다. 순서 재배치까지 하면 배치가 폭발한다.

대안: **`enforceAction` 을 async 화하고 `targetEntityType` + `targetEntityId` 로
org 를 내부에서 1회 조회**한다. 호출부는 `await` 추가만. (b)가 비로소 **리소스의 실제
org** 가 된다.
- 비용: `targetEntityType`(22종) → Prisma 모델 매핑 테이블 1개
- 🛑 **의존**: 그 매핑은 현재 **오분류 22건**(§audit-taxonomy-review)을 그대로 상속한다.
  `server-enforcement-middleware.ts:146` 주석이 지정한 선결 순서와 **정확히 같은 지점**이다.
  → §audit-taxonomy-review 가 이 방향의 **선결**로 승격된다.

### 9.2 2단 전개

- **(a) soft_enforce** — 폴백 제거 + (b) 실제 리소스 org 주입. 불일치 시 **거절하지 않고
  경고 로그만** 남기고 통과. 게이트 결과 불변 → RED 0, 롤백 = 플래그 되돌리기.
- **(b) 경로 묶음 투입** — quotes → inventory → budgets → admin → governance 순으로
  경고를 0으로 만든다. 경고가 나오는 경로가 곧 §8.1 목록의 검증이다.
- **(c) full_enforce** — 경고 0 도달 후 거절 활성.

**전환 게이트:** soft 로그에 **(a)≠(b) 가 실제로 찍히는지**. 안 찍히면 org 주입이
안 된 것이고, 그 상태의 full 전환은 지금과 동일한 항등 비교를 이름만 바꿔 재생산한다.

## 9.5 A트랙 진행 (2026-08-14, 호영님 조정 지시)

- **A1 삭제 완료** — `api/safety/spend/route.ts`(루트), `api/products/safety/route.ts`.
  호출부 0 + 상시 500 + 유출 형태 = 살릴 근거 0. 하위 라우트
  (`spend/summary`·`unmapped`·`map`·`export`)는 **삭제 대상 아님, A5 스윕 대상으로 유지**
  — 루트가 죽어 있었다는 것이 하위의 안전 근거가 되지 않는다.
- **#10 판정: 삭제 불가 → A3** — 호출부 4곳(`settings/security`, `settings/workspace`),
  테스트 2건 참조. 다만 `allowedEmailDomains` 부재로 **상시 500** →
  **보안 설정 화면이 운영에서 동작하지 않는다**(§drift-masks-isolation §2).
- **#11 판정: 내부 콘솔 API 이나 미들웨어 미커버** → 라우트 역할 검사 추가(§8.0 주의).
- **A2 종결** — `/api/admin/*` 는 ops_admin 전역 축. 근거: 미들웨어
  deny-by-default + 호출부가 `src/app/admin/**` 단독 + `User.role` 승격 경로 부재
  (운영 ADMIN 2명 전원 내부 스태프). 부트스트랩 역설 미해당.

## 10. 다음 순서

1. ~~운영 조직 수~~ ✅ 완료 → 결함 등급
2. ~~구멍 전수~~ ✅ §8.1 (11건, 수동 확정)
3. **설계 승인 대기** — §9. 승인 전 착수 금지
4. 교차조직 **런타임 스윕**으로 §8.2 잔여 위험 닫기
5. §2 딥링크 (뒤로 밀림)

### 픽스처 (재측정용 유지)

개발 DB: `PROBE-ORG-A/B`, `probe-a/b@labaxis.test`, `ORG-B-SECRET-{QUOTE,LOCATION,NOTES}`.
🛑 **재측정 직전 절차**: `probe-a` 의 `User.role` 을 **RESEARCHER 로 원복**할 것.
ADMIN 으로 두면 역할 게이트가 조용히 열려 **조직 게이트 단독 판정이 아니게 된다**
(이번 1차 측정에서 실제로 역할 게이트가 먼저 막아 비교문 미도달이 발생했다).
현재 상태는 원복 완료(RESEARCHER).
