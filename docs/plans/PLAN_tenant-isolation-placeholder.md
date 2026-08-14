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

## 9.6 A트랙 배치 2 완료 (2026-08-14)

| 항목 | 처리 | 교차조직 실측 |
|---|---|---|
| #10 `organizations/[id]/security` GET | 형제 `safety-settings` GET 패턴 승계 | 403 · 동일조직 500(드리프트 유지) |
| #11 `analytics/kpi` | `/api/admin/analytics/kpi` 이설 + 호출부 1곳 | 구 경로 404 · 신 경로 RESEARCHER 403(미들웨어) / ADMIN 200 · **콘솔 화면 렌더 확인** |
| #12 `getOrganizationById` | 팬텀 파라미터 교정 (호출부 1곳 전수) | 403 · name·plan·멤버명부 노출 0 · 동일조직 200 |
| work-queue 4건 | 클라 `organizationId` **제거** → 세션 멤버십 도출 | 파라미터 무시 확인 · 3건은 드리프트 500(판정 유예) |
| A4 단언 | `__tests__/security/tenant-scope-coverage.test.ts` | RED 0 · 자기검증 GREEN |

### A4 가 수동 분류를 이겼다

406건 수동 분류가 놓친 **6건을 단언이 찾았다**(#12 + work-queue 5핸들러).
그중 #12 는 §placeholder-success §5 "팬텀 파라미터"로 별도 등재 — 검사 부재가 아니라
**검사가 있는 것처럼 보이는 부재**라 리뷰가 통과시킨다.

corrupt→RED 실증 2건(각각):
- 라우트 검사 경로 — `quotes/[id]/status` GET 스코프 호출 제거 → RED
- 미들웨어 커버 경로 — `middleware.ts` 의 `/api/admin/` 리터럴 변경 → RED(미분류 11건으로 증가)

두 번째가 커버집합이 **하드코딩이 아니라 도출값**임을 증명한다.

### 미실증으로 남은 것 (안전으로 승격 금지)

work-queue 는 개발 DB 에 해당 데이터가 0이라 `items: []` 만 나왔다.
**무검증 통과는 확인됐고 body 유출은 미실증**이다. 3건은 드리프트 500 으로 판정 유예.

## 9.7 A5 1차 스윕 + 배치 3 (2026-08-14)

### A5 — A4 **반증** 시도 (보완 아님)

프레임: "남은 걸 확인한다"가 아니라 **단언이 '검사 있음'으로 오분류한 곳을 찾는다.**
각 경로를 교차(orgB)+대조(orgA) 쌍으로 호출해 ①유출 ②그 검사가 **요청 리소스의 org 를
봤는지** 를 함께 판정했다(cross·control 이 둘 다 막히면 org 판별이 아니다).

| 판정 | 수 |
|---|---|
| ✅ org 판별 확인 (교차 차단 + 대조 통과) | 12 |
| ✅ 목록 혼입 없음 / 차단 | 10 |
| 🔴 **유출** | **1** |
| ⚠️ 판정 불가 (드리프트 500) | 1 |
| ⚠️ 미측정 (픽스처 타입/메서드 불일치) | 6 |

커버리지 **59개 고유 라우트 중 30개(42%)** — 종료 근거로 쓰지 않는다.
드리프트 비율 3% → 드리프트 트랙을 앞당길 사유 없음(현 순서 유지).

### 배치 3-A — `organizations/[id]/members` GET

```ts
db.organizationMember.findMany({ where: { organizationId: id } })  // ← 호출자 판정 없음
```

임의 조직 멤버 명부(id·name·email)가 아무 로그인 사용자에게 반환됐다.
**A4 는 이것을 신뢰 高(A티어)로 분류했다** — `organizationMember` 접촉을 판정으로 읽었다.

교정: 멤버십을 **먼저** 판정(존재 오라클 차단, #12 형제와 동일 축).
실측 — 교차 403·명부 노출 0 / 대조 200 / 미존재 org 는 members·organizations 양쪽 다 403(형제 정합).

### 배치 3-B — 마커 의미론 교정

멤버십 계열 마커를 **`userId` 동반 `findFirst`/`findUnique`** 로 한정.
`findMany({ where: { organizationId } })` 는 검사 불인정.

**교정 후 RED 증가 0** — 나머지 후보들은 다른 마커(헬퍼 경유 멤버십 검사 등)로 이미
검사가 확인됐다. 배치 2 의 (나) baseline 딜레마는 발생하지 않았다.

corrupt→RED 3건(마커 의미론이 바뀌었으므로 기존 2건 재실행 + 신규 1건):
- 라우트 검사 제거 → RED
- 미들웨어 리터럴 변경 → RED
- **신규**: `findMany` 만 남기고 판정 제거 → RED (교정이 실제로 먹었음의 증거)

### 잔여 위험 — 정적으로는 못 닫는다

마커 **공존**은 그 검사가 **대상 엔티티를 지킨다**는 증명이 아니다.
`scopedWhereVar`(`where: { … userId … }`)는 239건 중 220건에 등장하는 최다 마커이고
느슨하다. 단독 의존 핸들러 20건(scopedWhereVar 6 · createScoped 5 · guestKeyScoped 4 ·
scopeKeyScoped 2 · vendorSelfScope 2 · idCompare 1)이 **배치 4 우선순위**다.
이 잔여는 런타임 스윕으로만 닫힌다.

## 9.8 배치 4-1 · 4-2 (2026-08-14) — **신규 유출 0**

축을 섞지 않고 각각 판정했다(org / guestKey / vendor-email / userId).

### 4-1 미측정 6건 재측정 — 전건 해소

| 경로 | 축 | 결과 |
|---|---|---|
| `receiving/documents/[id]` | org | ✅ 판별 확인 — **`[id]` 는 문서가 아니라 주문 id** 였다(1차 픽스처 오류) |
| `orders/[id]/generate-pdf` | org | ✅ 판별 확인 |
| `quotes/[id]/rfq-token` | org | ✅ 판별 확인 — 대조군에 토큰 선발급하니 확정됨 |
| `quote-lists/[id]` | **guestKey** | ✅ 판별 확인 (교차 404 / 대조 200) |
| `quote-lists/[id]/export` | **guestKey** | ✅ 판별 확인 |
| `organization-vendors/[id]` | — | GET 핸들러 부재(405). PATCH·DELETE 뿐 → **4-3 이관** |

⚠️ guestKey 축은 org 축과 **다른 격리 축**이다. 결과를 org 축과 합산하지 않는다.

### 4-2 단독 마커 GET

| 경로 | 단독 마커 | 결과 |
|---|---|---|
| `ai-actions/[id]` | idCompare | ✅ 판별 확인(교차 403 / 대조 200) |
| `quotes/my` | scopedWhereVar | ✅ 판별 확인 — `quoteNumber != null` 필터 때문에 1차가 공백이었다. 양쪽에 번호 부여 후 **A 것만 나오고 B 것은 안 나옴** 실증 |
| `team` | scopedWhereVar | 구조 스코프 `where: { userId }` 확인 + 혼입 0 (대조 데이터 공백 — 강한 실증 아님) |
| `inventory/reorder-recommendation` | scopeKeyScoped | 혼입 0, 데이터 공백 → **미실증** |
| `sourcing/recommend` | scopeKeyScoped | 유효 productId 로 200, 혼입 0, purchaseRecord 공백 → **미실증** |
| `vendor/insights` · `vendor/quotes` | vendorSelfScope | 자기 vendor 로 고정 확인(응답에 자기 vendorId). 타 벤더 데이터 부재 → **유출 미실증** |

`scopedWhereVar` 단독 6건 중 GET 은 2건(`quotes/my`·`team`)뿐이고 나머지 4건은 POST →
**4-3 대상**이다. 즉 최다·최약 마커의 위험 대부분이 아직 쓰기 쪽에 남아 있다.

### 남은 미실증 (안전으로 승격 금지)

`reorder-recommendation` · `sourcing/recommend` · `vendor/*` 는 **대조 데이터를 만들지
못해** 유출을 실증도 반증도 못 했다. purchaseRecord·vendor quote 픽스처가 필요하다.

## 9.9 배치 4-3 1단계 (2026-08-14)

### 🛑 1단계 전제가 깨졌다

"잘못된 바디면 DB 를 안 건드린다"는 전제로 설계했으나 **프로브가 실제로 썼다**:
`quote 6→8`(POST /api/quote-lists 가 201 생성), `orgVendor 2→1`(DELETE 대조군이 실제 삭제).
스냅샷이 없었으면 모르고 넘어갔다. → **스냅샷·복원을 모든 프로브에 무조건 적용**으로 절차 변경.

⚠️ 그 스냅샷조차 불완전했다 — `products/[id]/inspection` 이 만든 `Inspection` 행은
스냅샷 테이블 목록에 없어 **diff 0 으로 오판**됐다. 스냅샷 범위는 **대상 라우트가 쓰는
테이블**을 포함해야 한다.

### 403 4분류 (23 프로브)

| 판정 | 수 |
|---|---|
| 역할게이트(enforceAction) 우선 — **org 판별 아님** | 9 |
| 바디 검증 우선 → 2단계 필요 | 6 |
| ✅ org 판별 확인 | 2 (`organization-vendors/[id]` PATCH·DELETE) |
| 드리프트 500 | 2 |
| 🔴 무검증 통과(생성) | 1 (`POST /api/quote-lists`) |
| 미측정(픽스처 오류) | 3 |

**정정**: `products/[id]/inspection` 을 처음 "✅ org 판별"로 집계했으나 **오분류**다.
`fill()` 이 `[id]` 를 `PRODUCT_ID` 리터럴로 남겨 교차·대조가 같은 URL 이었다.
→ 프로브 스크립트에 **치환 실패 가드**(대문자 플레이스홀더·`[...]` 잔존 시 프로브 중단)를
넣고 가드 자체를 의도적 실패로 검증했다(✅ 동작 확인).

### 미측정 3건 재실행 결과

| 경로 | 결과 |
|---|---|
| `POST /api/products/{pid}/inspection` | **201 생성** — 무검증 create (§unvalidated-create 편입) |
| `POST /api/products/{pid}/sds` | 403 역할게이트 — org 미판정 |
| `PUT /api/quote-lists/[id]` | **guestKey 축 판별 확인** — 교차 404·row 불변 / 대조 200·row 변경(복원함) |

### 부수 발견 — lock 누수 (테넌트 축 아님)

`PUT /api/quote-lists/[id]` 의 404 조기 반환이 `enforcement.fail()` 을 부르지 않아
**동시성 lock 이 누수된다.** 동일 요청 2회차부터 409 가 고정되고 서버 재시작 전까지 풀리지
않는다(재현 확정 — 재시작 후 1회차 404, 2회차 즉시 409).
§11.369 백로그의 후보 해법 2("route handler finally 에서 항상 failMutation")에 해당하는
**결정적 재현 사례**다. cold-kill 이 아니라 **정상 경로**에서 난다.

### 커버리지 (분모 명시)

```
쓰기  23/131  (제외 7 포함) — 우선순위 집합만 측정, 강한 마커 보유 108건 미측정
읽기  30/59   (A5 1차, 신뢰 低 티어 고유 라우트 기준)
```

2단계 실측 대상 **15건** = 바디 검증 우선 6 + 역할게이트 우선 9.

## 9.10 배치 4-3 2단계 — **④ 정지로 중단** (2026-08-14)

### 정지 사유: **①의 도출 실패**

```
G2 POST /api/work-queue/ops-sync [ADMIN] → 200 {"synced":1}
  ① 도출 테이블: (없음)
  ② 전역 count diff: ActivityLog 3→4, AiActionItem 2→3
  → 도출 목록 밖 테이블이 변경됨 = ①의 실패
```

①(라우트 소스 정규식으로 `db.<model>.create|update|delete` 추출)이 **빈 목록**을 냈다.
이 라우트는 `work-queue-service` 헬퍼를 거쳐 쓰기 때문이다 — 호영님이 착수 전 지적한
**헬퍼 경유 쓰기**가 정확히 그대로 실현됐다.

**②(전역 count 스냅샷)가 즉시 잡았다.** ①만 있었으면 이 쓰기는 "변경 없음"으로 기록되고
넘어갔을 것이다 — 1단계에서 `Inspection` 을 놓친 것과 같은 형태(**이번 세션 5번째**).
전역 안전망은 비용 대비 확실하다는 판단이 실측으로 확인됐다.

복원 완료 — `AiActionItem` 1행, `ActivityLog` 1행 삭제(생성 행은 `organizationId: null`,
`userId` = 호출자, 즉 **교차 조직 쓰기 아님**).

### 정지 시점까지의 결과 (14 프로브)

| 층 | 수 | 비고 |
|---|---|---|
| 바디 검증 | 5 | `orders/draft`, `inventory/dispatch-batch`, `bottleneck-remediation`, `cadence-governance`, `protocol/bom`[ADMIN] |
| 역할게이트 | 4 | 승격 전 4건 전부 — 승격 후 층이 바뀌는 것을 쌍으로 확인 |
| 라우트 검사 | 2 | `POST /api/organizations` 403, `quote-lists/[id]/items` 404 |
| 401(선결 헤더 부재) | 2 | `purchases/import`·`import-file` [ADMIN] — `x-guest-key` 필요 |
| 통과(!) | 1 | `ops-sync` [ADMIN] — **정지 지점** |

**신규 테넌트 유출 0.** `ops-sync` 의 쓰기는 호출자 자신에게 귀속됐다.

### 승격 전후 쌍이 보여준 것

`protocol/bom` 은 RESEARCHER 에서 **역할게이트**, ADMIN 에서 **바디 검증** —
층이 바뀐다. 승격 없이 측정했다면 "인가가 앞선다"로 기록되고 **org 축은 영원히 안 재진다**.
배치 1에서 확인한 함정이 쓰기에서도 같은 모양으로 나타난다.

### 커버리지 (분모 명시)

```
쓰기  G1 6/6 완료 · G2 4/9 (정지) · 전체 우선순위 23/131 (제외 7 포함)
읽기  30/59
```

### 재개 조건 → **① 폐기 확정** (호영님 승인 2026-08-14)

①(정규식 도출)은 **판정 근거에서 폐기**한다. 복원 대상 후보 힌트로만 잔존.
정지·판정은 **②(전역 count)** 로만 한다. 도출이 틀려도 판정은 안 틀리는 성질이
이번 자리에서 실증됐다.

### 🛑 ②의 한계 — 수정형(UPDATE) 구간에서는 안전망이 아니다

> **전역 count 는 생성·삭제만 잡는다. UPDATE 는 행 수가 안 변하므로 diff 0 이다.**

따라서 프로브 순서상 **수정형 구간에 들어가면 ②는 무력**하고,
**대상 row 전체 필드 스냅샷**이 유일한 근거가 된다. 그 구간에서는:

1. 프로브 전에 대상 row 의 **전 필드**를 뜬다(부분 select 금지 — 안 뜬 필드의 변경은 안 보인다)
2. 프로브 후 전 필드 재조회 → 필드 단위 diff
3. `updatedAt` 만 바뀌어도 **쓰기 발생**으로 취급한다(무해해 보여도 경로가 열렸다는 증거)

⚠️ 대상 row 를 **미리 알 수 없는** 수정형(예: where 조건으로 다건 UPDATE)은
이 방법으로도 못 덮는다. 그런 라우트는 **판정 불가로 남기고** 별도 설계 없이 넘어가지 않는다.

수정형 진입 전 **회신 1회** 를 절차로 둔다(호영님 지시).

## 9.11 배치 4-3 2단계 재개 (G2 잔여) — 정지 없음, **수정형 직전 정지**

① 폐기 후 ②(전역 count) 단독 판정으로 10 프로브. **전역 diff 전건 0 — 쓰기 0.**

| 라우트 | RESEARCHER | ADMIN |
|---|---|---|
| `work-queue/purchase-conversion/bulk-po` | 역할게이트 | 404 라우트 검사 |
| `ingestion` | 역할게이트 | 400 바디 검증 |
| `inventory/auto-reorder` | 역할게이트 | **200 통과** (dryRun, 쓰기 0) |
| `inventory/import/commit` | 역할게이트 | 401 `fileId is required` |
| `purchases/import` (+guest-key) | — | 401 `rows array is required` |
| `purchases/import-file` (+guest-key) | — | 500 — **멀티파트 미충족**(드리프트 아님, 요청 형식 문제) |

### 🛑 이번 2단계의 실질 결론 — **쓰기 org 축은 여전히 미판정이다**

층은 갈렸지만 **org 판별에 도달한 프로브가 0건**이다. 전부 그 앞 층
(역할게이트 → 바디 검증 → 선결 헤더/파일)에서 멈춘다.

`bulk-po` [ADMIN] 이 orgB 견적 id 로 404 를 냈으나 **대조군(orgA)을 안 쳐서
org 판별인지 단순 미발견인지 못 가른다** — 미판정으로 남긴다.

쓰기 org 축을 실제로 재려면 **유효 바디 + 선결 조건(guest-key·fileId·multipart 업로드)**
까지 갖춘 픽스처가 필요하다. 이것이 4-3 의 진짜 비용이며, 1·2단계는 그 앞 층을
걷어낸 것까지다.

### 커버리지 (분모 명시)

```
쓰기(층 식별)  G1 6/6 · G2 9/9(수정형 1건 제외 → 8/9 측정, 1건 정지)
쓰기(org 축 판정)  **0/15** ← 이 분수가 실제 상태다
전체 우선순위     23/131 (제외 7 포함)
읽기              30/59
```

### ✋ 수정형 진입 전 정지

다음 대상 `PATCH /api/products/[id]/safety` 는 **수정형**이다.
②(전역 count)는 UPDATE 를 못 잡으므로(§9.10 한계) 여기서 멈추고 설계를 재확인한다.

## 9.12 쓰기 15건 — **org 축 대상 여부 판정** (실측 전 선결, 호영님 지시)

지금까지 15건을 **전부 org 축 대상으로 가정하고** 세었다. 그 가정은 실측되지 않았다.
쓰기 모델의 스코프 컬럼으로 먼저 가른다 — **"대상 아님"도 판정 결과다.**

### 스코프 컬럼 실측 (schema.prisma)

| 모델 | organizationId | scopeKey | userId |
|---|---|---|---|
| `PurchaseRecord` | ❌ | ✅ | ❌ |
| `ImportJob` | ❌ | ✅ | ❌ |
| `Product` | ❌ | ❌ | ❌ (전역 카탈로그) |
| `InventoryUsage` | ❌ | ❌ | ✅ |
| `Quote` · `ProductInventory` · `Order` · `IngestionEntry` · `AiActionItem` | ✅ | — | ✅ |

### 판정 — 4건은 **org 축 대상 아님**

| 라우트 | 쓰기 모델 | 판정 |
|---|---|---|
| `POST /api/orders/draft` | `PurchaseRecord` | **scopeKey 축** — org 축 대상 아님 |
| `POST /api/purchases/import` | `PurchaseRecord`·`ImportJob` | **scopeKey 축** — 대상 아님 |
| `POST /api/purchases/import-file` | 동일 | **scopeKey 축** — 대상 아님 |
| `PATCH /api/products/[id]/safety` | `Product` | **전역 카탈로그** — org 축 대상 아님.<br>단 *"아무 사용자가 전역 카탈로그 안전정보를 고칠 수 있는가"* 는 **별개 문제**로 남긴다 |

→ 쓰기 org 축 분모는 **15 → 11**. 이 4건을 org 축으로 쟀다면 "판별 없음"을
**유출로 오독**했을 것이다(이번 세션 오독 형태와 동일).

🛑 **제외 4건은 사라진 것이 아니라 축이 바뀐 것이다.**
`scopeKey` 축 3건 → §scopekey-axis-unmeasured (미측정) ·
전역 카탈로그 1건 → §global-catalog-write-authz (데이터 무결성 축).

> **A트랙 종료 조건 명시: A트랙이 닫는 것은 org 축뿐이다.
> `scopeKey` 축은 미측정으로 남는다. A트랙 GREEN 은 "테넌트 격리 완료"가 아니다.**

⚠️ `inventory/import/commit` 은 `ImportJob`(scopeKey) **와** `ProductInventory`(org) 를
둘 다 쓴다 — **혼합 축**. org 축 대상으로 남기되 판정 시 어느 모델이 변했는지 구분한다.

## 9.13 판정 기준 재확인 (상시)

> **대조군 없이 낸 404·403 은 판정으로 세지 않는다.**
> 교차만 차단된 것은 org 판별의 증거가 아니다 — 단순 미발견·다른 층 차단과 구분 불가.
> (`bulk-po` [ADMIN] 404 를 미판정으로 남긴 근거)

## 9.14 배치 4-3 1차 4건 — **쓰기 org 축 첫 판정** (2026-08-14)

역할게이트를 ADMIN 으로 열어 org 축을 단독 판정. 게이트 전체 적용
(전 필드 스냅샷 + 전역 count → 프로브 → diff → 복원 → diff 0).

| 프로브 | 결과 | 판정 |
|---|---|---|
| `dispatch-batch` **교차**(B재고) | 422 · `itemErrors[].reason = "권한이 없습니다."` | — |
| `dispatch-batch` **대조**(A재고) | 200 · `InventoryUsage +1`, `invA` 필드 변경 | **✅ org 판별 확인** |
| `bulk-po` 교차(B견적) | 404 | — |
| `bulk-po` 대조(A견적) | 409 `ORDER_EXISTS` | ⚠️ **판정 불가** — 대조군 미통과 |
| `quote-lists/items` · `organizations` | 미실행 | ④ 정지로 중단 |

### ✅ 0/11 에서 벗어났다 — `dispatch-batch` 1건

쓰기 쪽에서 **처음으로** org 판별이 확인됐다. 교차가 `"권한이 없습니다"` 로 막히고
대조가 통과하며 실제로 썼다 — 쌍이 성립한다.

### ④ 정지 — 대조군의 **의도된 쓰기**

정지는 `dispatch-batch 대조`(200)에서 발생했다. 이것은 결함이 아니라 **설계상 예상된
쓰기**다. 그러나 게이트는 "쓰기 발생 시 정지"만 알고 **의도/비의도를 구분하지 못한다**.
복원 완료(`InventoryUsage` 1행 삭제, `invA.currentQuantity` 6→7, `DataAuditLog` 1행 삭제).

→ 다음 설계 보강: 대조군 프로브는 **쓰기를 예상 항목으로 선언**하고, 선언과 다른 변경만
정지 사유로 삼는다. 선언 없는 변경은 지금처럼 정지.

### `bulk-po` 판정 불가 — 픽스처 오염

대조군 A 견적에 **B4 시드가 이미 주문을 만들어 둬서** `ORDER_EXISTS` 로 막혔다.
교차 404 만으로는 판정하지 않는다(§9.13). 다음 회차에 **주문 없는 신규 A 견적**을
전용 픽스처로 만들어 재측정한다.

### 커버리지

```
쓰기 org 축 판정   1/11   (dispatch-batch ✅)
                  판정 불가 1 (bulk-po) · 미실행 2
```

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
