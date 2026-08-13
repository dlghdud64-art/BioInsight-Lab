# §team-org-role-model — 팀/조직 권한 모델 이원화 (등재만, 동결)

작성: 2026-08-12
상태: **등재 + 동결** (호영님 2026-08-12) — 실사용자 트래픽 이후 재개. 설계·실측 모두 미착수.
발원: §enum-input-validation role 교정 중 `TeamRole`/`OrganizationRole` 혼동 발견

---

## 0. 관측된 사실 (교정 완료분)

`team/[id]/members` PATCH 와 `team/invite` POST 가 같은 형태로 잘못돼 있었다:

```ts
if (role !== TeamRole.ADMIN && role !== TeamRole.ADMIN)   // 같은 값 두 번
    → "Forbidden: Only ADMIN or OWNER can change roles"    // OWNER 는 TeamRole 에 없다
```

`TeamRole = ADMIN | MEMBER | VIEWER` (OWNER 없음), `OrganizationRole` 에는 OWNER 있음.
원래 `!== OWNER` 였을 자리가 enum 에 값이 없어 ADMIN 으로 치환되고 문구만 남은 흔적.
중복 조건·거짓 문구는 정리했고 **동작(ADMIN 보호)은 유지**했다.

## 1. ⚠️ 열린 질문 — ADMIN 강등 데드락 가능성 (미실측)

정리된 동작을 합치면: 역할 변경 권한 = 팀 ADMIN 만, ADMIN 은 변경 불가.
→ **ADMIN 을 강등할 수 있는 사람이 아무도 없을 수 있다.** 잘못 부여된 ADMIN 회수 경로 0,
퇴사자가 팀 ADMIN 이면 그대로 남는다.

재개 시 실측 3건 (호영님 지시분, 동결로 미수행):
1. 조직 OWNER 가 팀 멤버 역할을 바꾸는 별도 경로가 있는가 — 있으면 데드락 아님
2. 없다면 현재 ADMIN 강등 수단이 실제로 0 인지
3. 팀 생성자가 자동 ADMIN 이 되는가 — 최초 ADMIN 은 어떻게 정해지는가

0 으로 확인되면 결함 존치이며, 조직 OWNER 에게 팀 역할 변경 권한을 주는 최소 교정을 상신.

---

## 1-A. 실측 결과 (2026-08-12) — **데드락 확정. 예상보다 나쁘다**

호영님 지시로 3건 실측(교정 금지, 관측만). **결론: 데드락이며, 강등뿐 아니라
제거·팀 폐기까지 전부 막혀 있다.**

### Q1. 조직 OWNER 의 별도 경로 — **없음 (0)**

`teamMember` 쓰기 지점은 repo 전체에 **3곳뿐**이고 전부 팀 ADMIN 게이트다.

| 지점 | 게이트 |
|---|---|
| `api/team/invite/route.ts:99` (create) | 팀 ADMIN |
| `api/team/[id]/members/route.ts:169` (update) | 팀 ADMIN |
| `api/team/[id]/members/route.ts:288` (delete) | 팀 ADMIN |

`src/app/api/team/` 전체에서 `OrganizationRole` import 0, 조직 멤버십 조회 0.
**`OWNER` 는 주석과 에러 문구에만 등장한다** — 판정에 쓰이는 곳이 없다.

### Q2. ADMIN 강등 수단 — **0. 그리고 제거도 0**

```
PATCH  대상이 ADMIN → 400 "ADMIN 역할은 변경할 수 없습니다."   (members:160)
DELETE 대상이 ADMIN → 400 "Cannot remove OWNER"              (members:271)
DELETE 대상이 자기 자신 → 400 "Cannot remove yourself"        (members:279)
```

**강등 불가 + 제거 불가 + 자진 사퇴 불가.** 셋이 겹쳐 회수 경로가 완전히 닫힌다.

`team.delete` 라우트도 **존재하지 않는다** — 팀을 폐기해 우회하는 최후 수단조차 없다.

### Q3. 최초 ADMIN — **팀 생성자가 자동 ADMIN**

`api/team/route.ts:100` — `team.create` 시 `members.create { userId: session.user.id,
role: TeamRole.ADMIN }`. 조건 없음. **누구나 팀을 만들면 회수 불가능한 ADMIN 이 된다.**

(주석은 *"생성자를 OWNER로 추가"* 라 적혀 있으나 실제 값은 `ADMIN` 이다 — TeamRole 에
OWNER 는 없다. 문구 drift 가 여기도 있다.)

### 운영 영향

- 퇴사자가 팀 ADMIN 이면 **회수 경로 0**. 계정을 지우지 않는 한 그대로 남는다
- ADMIN 이 여러 명이어도 **서로 강등할 수 없다** (대상이 ADMIN 이면 무조건 400)
- 잘못 부여된 ADMIN 을 되돌리는 방법이 **DB 직접 수정뿐**

→ 동작 유지가 아니라 **결함 존치**다.

### 부수 발견 — DELETE 게이트에 중복 조건이 남아 있다

`members/route.ts:252` — `userMember.role !== ADMIN && userMember.role !== ADMIN`
(**같은 값 두 번**). PATCH 쪽은 2026-08-10 에 정리됐으나 **DELETE 는 누락**됐다.
현재 동작은 우연히 옳다(ADMIN 만 통과) — 다만 OWNER 를 넣으려 한 자리가 그대로 비어 있다.

---

## 1-B. 상신 — 최소 교정안 (착수 전 승인 대기)

> 지시대로 **지금 고치지 않았다.** 아래는 상신이며 코드 변경 0.

**제안: 조직 `OWNER` 에게 팀 역할 변경 권한을 준다.** 최소 범위로 한정한다.

1. `members` PATCH/DELETE 게이트를 `팀 ADMIN` **또는** `해당 팀이 속한 조직의 OWNER` 로 확장
2. 대상이 ADMIN 일 때의 400 을, **조직 OWNER 가 요청한 경우에만** 통과시킨다
   (팀 ADMIN 끼리는 여전히 서로 못 바꾼다 — 기존 의도 보존)
3. `Team` ↔ `Organization` 연결이 스키마에 있는지 **선행 확인 필요** — 없으면
   이 교정은 스키마 변경을 동반하며 §schema-proposal 계열로 올라간다

⚠️ 3번이 미확인이라 비용이 두 갈래다. 승인 시 그것부터 실측한다.

대안(더 작음): 마지막 ADMIN 이 아닐 때 **자기 자신을 강등**할 수 있게 허용.
회수는 못 하지만 퇴사자 본인이 정리할 수는 있다. 데드락의 절반만 푼다.

---

## 1-C. 작은 안 — **착수 완료** (호영님 승인 2026-08-12)

| 계약 | 구현 |
|---|---|
| 자기 강등 허용 | PATCH — 대상이 ADMIN 이고 **본인**이며 `adminCount > 1` 일 때 통과 |
| 자기 나가기 허용 | DELETE — 동일 조건 (나가기가 없으면 강등을 풀어도 갇힌다) |
| 마지막 ADMIN 보호 | `adminCount <= 1` → 400 `LAST_TEAM_ADMIN` (주인 없는 팀이 더 나쁘다) |
| 남의 ADMIN 불가 | 강등·제거 모두 거부 — 기존 의도 보존 |
| 문구가 출구를 알린다 | *"마지막 관리자는 역할을 변경할 수 없습니다. **다른 관리자를 먼저 지정하세요.**"* |
| 유령 역할 제거 | `Cannot remove OWNER` · `Only ADMIN or OWNER` 폐기 — TeamRole 에 OWNER 는 없다 |
| 중복 조건 정리 | DELETE `!== ADMIN && !== ADMIN` → 단일 조건. **동작 불변**(둘 다 ADMIN 만 통과) |

sentinel: `src/__tests__/ops/team-admin-deadlock.test.ts` (T0~T6, 9 assertions).
corrupt→RED 실증 — `adminCount <= 1` 무력화 + 중복 조건 부활 주입 시 2 failed.

### 🛑 한계 — 이것은 완화이지 해결이 아니다

**이미 퇴사한 사람은 로그인하지 않는다.** 본인만 자기 역할을 바꿀 수 있으므로,
퇴사자가 팀 ADMIN 인 상황은 **여전히 회수 불가**다. 데드락의 절반만 풀렸다.
큰 안이 필요한 이유가 정확히 그것이다.

---

## 1-D. 큰 안 — 실측 결과. **스키마 변경은 없으나 그게 문제가 아니다**

### 연결은 있다

```prisma
model Team {
  organizationId String?   // FK to Organization (null = standalone team)
  organization   Organization? @relation(...)
}
model Organization { teams Team[] }
```

→ **스키마 변경 불요.** §schema-proposal 4종에 합류시킬 필요 없다.

### 그런데 채워지지 않는다 ⚠️

`api/team/route.ts:100` 팀 생성이 **`organizationId` 를 설정하지 않는다.**
`src/app/api/team/` 전체에서 `organizationId` 참조 **0**.

**즉 API 로 만든 팀은 전부 standalone(null) 이고, 조직 OWNER 권한을 부여해도
적용 대상이 0 이다.** 큰 안의 선결 조건은 스키마가 아니라 **팀 생성이 소속 조직을
기록하게 만드는 것**이다.

### 큰 안 재정의 (승인 대기)

1. **선결** — 팀 생성 시 `organizationId` 기록. 생성자의 조직 멤버십에서 도출.
   조직이 여럿이면 선택이 필요하고, 없으면 standalone 유지(현행)
2. 그 위에 조직 `OWNER` 의 팀 역할 변경 권한. 대상이 ADMIN 일 때의 400 을
   **조직 OWNER 요청에 한해** 통과. 팀 ADMIN 끼리는 여전히 불가
3. **기존 standalone 팀은 1 로 구제되지 않는다** — 이미 만들어진 팀의
   `organizationId` 를 채우는 backfill 이 별도로 필요하다(실사용자 0 인 지금이 가장 싸다)

⚠️ 3 이 왕복 이후 데이터 상태에 달려 있다.

---

## 1-E. 실측 ①② (2026-08-12, 운영 DB **read-only**. 쓰기 0)

### ① Team 현황 — **0행**

| 항목 | 값 |
|---|---|
| Team 전체 | **0** |
| `organizationId IS NULL` | 0 |
| TeamMember 전체 | 0 |

→ **backfill 단계가 사라진다.** 그리고 `nullable → required` 마이그레이션 비용도
**사실상 0** 이다(빈 테이블). 지금이 가장 싼 시점이라는 판단이 데이터로 확인됐다.

### ② 다중 소속 — **스키마상 가능. 데이터로는 판별 불가**

```prisma
model OrganizationMember { @@unique([userId, organizationId]) }   // userId 단독 unique 없음
model User { organizationMembers OrganizationMember[] }
```

| 항목 | 값 |
|---|---|
| OrganizationMember 행 | **1** |
| distinct user | 1 |
| 2개 이상 조직에 속한 사용자 | 0 |
| 사용자당 최대 조직 수 | 1 |

⚠️ **표본이 1행이다. "데이터에 다중 소속이 없다" 는 "불가능하다" 가 아니다.**
스키마는 허용하고, **코드는 양쪽으로 갈려 있다**:

- 복수 전제: `dashboard/stats/route.ts:66` — `orgIds = memberships.map(...)` → `{ in: orgIds }`
- 단일 가정: `activity-logs`·`ai-actions` 등 다수 — `organizationMember.findFirst` 로
  **임의의 조직 하나**를 집는다 (다중 소속 시 어느 조직인지 미정 — 별건 결함 후보)

→ **"조직이 여럿이면 선택 필요" 분기는 사라지지 않는다.** ②의 답으로 1단계 비용이
줄어들기를 기대했으나, 줄지 않았다. 팀 생성 시 조직 선택 UI 가 필요하다.

---

## 1-F. `String?` 판정 — **의도가 아니라 미완이다**

standalone 팀 시나리오를 뒷받침하는 근거가 **스키마 주석 한 줄(`null = standalone team`)
뿐**이고, 반증이 셋이다.

| # | 근거 | 함의 |
|---|---|---|
| 1 | 팀 생성이 `organizationId` 를 **설정하지 않는다** (`api/team/route.ts:100`) | 의도된 standalone 이 아니라 **채우는 코드가 없다** |
| 2 | `organizationId === null` 을 다루는 분기가 **어디에도 없다** (전수 0) | standalone 을 위해 설계된 동작이 0 |
| 3 | 🛑 `budgets/route.ts:268` — `where: { id: teamId, organizationId: resolvedOrganizationId }` | **standalone 팀은 예산에 연결될 수 없다.** `resolvedTeamId = null` 로 조용히 떨어진다 |

**3 이 결정적이다.** `Team.budgets Budget[]` 관계가 스키마에 있는데, API 로 만든 팀은
전부 standalone 이므로 **팀 예산 기능이 구조적으로 죽어 있다.** 조용한 실패다
(에러 없이 teamId 만 사라진다).

### 권고 — `required` 로 전환

- Team 0행이므로 마이그레이션 비용 ~0
- **required 면 "채워지지 않는" 상태가 구조적으로 불가능해진다** — 지금 결함의 뿌리가 사라진다
- 팀 예산 경로도 함께 살아난다

⚠️ 남는 질문 1건: **조직에 속하지 않은 사용자가 팀을 만들 수 있어야 하는가.**
required 로 가면 "팀 생성 = 조직 소속 필요" 가 된다. 현행 UI 에 조직 선택이 없으므로
어느 쪽이든 팀 생성 화면 변경이 따른다(②에서 이미 필요해진 것과 같은 작업).

---

## 1-G. 순서 (실측 반영, 승인 대기)

```
[nullable → required 판정]
  → 팀 생성에 조직 선택 + organizationId 기록   (①② 로 UI 작업 확정)
  → 조직 OWNER 의 팀 역할 변경 권한
  → backfill  ❌ 삭제됨 (Team 0행)
```

backfill 이 사라졌으므로 **이 트랙 전체가 운영 DB 쓰기 없이 끝난다** —
개발 DB 분리를 기다릴 이유가 없다.

---

## 1-H. 실측 ③④ (2026-08-12) — 가입 시 조직 · 조직 전환기

### ③ 가입 시 조직 자동 생성 — **없다**

`src/auth.ts` 에 organization 참조 **0**. 조직 생성 경로는
`POST /api/organizations` → `lib/api/organizations.ts` **명시 호출뿐**이다.

→ **조직에 속하지 않은 사용자가 존재할 수 있다.** `required` 전환 시
"팀 생성 = 조직 소속 필요" 가 되므로 **온보딩에 조직 생성 단계가 필요**하다.
→ §onboarding-blocker 등재.

### 🛑 ③-A 파생 발견 — **아무도 `OWNER` 가 되지 않는다**

큰 안은 "조직 `OWNER` 에게 팀 역할 변경 권한" 인데, **그 OWNER 가 실재하지 않는다.**

| 지점 | 성격 |
|---|---|
| `lib/api/organizations.ts` — 조직 생성자 upsert | `role: "ADMIN"` ← **DB 에 실제로 쓰이는 값** |
| `dashboard/organizations/page.tsx:273` — `role: "OWNER"` | **클라이언트 로컬 상태**(`setOrganizations`)일 뿐. DB 아님 |
| `approver-routing.ts:118` · 역할 설명표 2곳 | 전부 **읽기**(where 필터 / 안내 문구) |

`role: OWNER` 를 **DB 에 쓰는 코드는 repo 전수 0** 이다.

**파급 2건:**
1. **거짓 표시** — 조직을 만들면 화면에는 `OWNER` 로 보이는데 DB 는 `ADMIN` 이다
   (§fabricated-data-surface 계열)
2. **결재 라우팅 무력** — `approver-routing.ts` 의 OWNER 기반 승인자 선택이
   **항상 fallback 으로 빠진다**. 조용한 실패다

→ **큰 안을 그대로 구현하면 dead code 가 된다.** 권한을 줘도 가진 사람이 0 이다.

**상신 — 큰 안 대상 재선정 (승인 필요):**
- (가) 대상을 **조직 `ADMIN`** 으로 — 실재하는 역할이라 즉시 동작. 다만 조직 ADMIN 은
  여러 명일 수 있어 "최고 관리자" 의미가 약해진다
- (나) **OWNER 부여 경로를 먼저 만든다** — 조직 생성자를 OWNER 로. 근본적이나
  기존 판정 지점(`{ in: [OWNER, ADMIN] }` 다수)의 의미가 바뀌므로 범위가 커진다

⚠️ 어느 쪽이든 §team-org-role-model 밖의 결정이다.

### ④ 조직 전환기 — **있다. 다중 소속은 제품 기능이다**

`components/workspace/workspace-switcher.tsx` — 조직 전환기
(`currentOrganizationId` / `onOrganizationChange` / `OrganizationRole`).

**도달성 확인: 6개 라이브 페이지에 렌더**된다 —
`admin/safety` · `dashboard/safety-spend` · `settings/audit` · `settings/billing` ·
`settings/security` · `settings/workspace`.
`selectedOrgId` 상태를 가진 화면은 **8개**다.

→ **"스키마가 허용한다" 를 넘어 "제품이 지원한다" 가 확인됐다.**
→ 팀 생성 시 **조직 선택 UI 가 실제 비용**이다. 자동 도출로 둘 수 없다.
→ §org-scope-ambiguity 는 잠재 결함이 아니라 **이미 발생 중인 결함**이다.

---

## 1-I. 실측 ⑤ — `=== "ADMIN"` 단독 판정 지점 (2026-08-12)

호영님 분기 기준: *"없다 → OWNER 추가는 동작 불변, 비용은 한 줄.
있다 → 그 지점들은 OWNER 를 배제하므로 실해. 목록을 뽑아 보고."*

### 답: **있다. 서버 게이트 13곳 + 클라이언트 판정 3곳**

`{ in: ["OWNER", "ADMIN"] }` 형태만 있었다면 비용은 한 줄이었을 것이다. 그러나
**OWNER 를 빠뜨린 판정이 별도로 존재**하고, 거기서는 OWNER 가 **거부**된다.

#### 서버 게이트 — OWNER 403 (실해)

| # | 지점 | 형태 |
|---|---|---|
| 1 | `api/safety-spend/route.ts:33` | `ADMIN \|\| APPROVER \|\| VIEWER` |
| 2 | `api/safety-spend/unmapped/route.ts:32` | 〃 |
| 3 | `api/safety/spend/export/route.ts:35` | 〃 |
| 4 | `api/safety/spend/map/route.ts:71` | 〃 |
| 5 | `api/safety/spend/summary/route.ts:36` | 〃 |
| 6 | `api/safety/spend/unmapped/route.ts:36` | 〃 |
| 7 | `api/products/[id]/safety/route.ts:77` | `in: [ADMIN, VIEWER]` |
| 8 | `api/products/[id]/sds/route.ts:178` | `ADMIN \|\| VIEWER` |
| 9 | `api/safety/products/route.ts:48` | 〃 |
| 10 | `api/safety/sds/route.ts:24` | `in: [ADMIN, VIEWER]` |
| 11 | `api/sds/[id]/apply/route.ts:77` | 〃 |
| 12 | `api/sds/[id]/extract/route.ts:61` | 〃 |
| 13 | `api/organizations/[id]/security/route.ts:90` | `role: ADMIN` **단독 where** |

#### 클라이언트 판정 — OWNER 가 권한 없음으로 표시

| 지점 | 변수 |
|---|---|
| `app/admin/safety/page.tsx:83` | `isSafetyAdmin` |
| `app/settings/audit/page.tsx:77` | `isAdmin` |
| `app/settings/security/page.tsx:52` | `isAdmin` |

#### 대상 아님 (혼동 주의)

- `api/workspaces/[id]/*` 3곳 · `lib/auth/scope.ts:181` · `lib/billing/plan-select.ts:148`
  → **`WorkspaceMember`** 다. 별도 모델·별도 enum. OWNER 도입과 무관
- `api/budgets/[id]/route.ts:17` → `OWNER || ADMIN` 이라 정상 (오탐)
- `settings/workspace/page.tsx:485` → 이미 `isOwner` 분기 보유

### ⚠️ 부수 발견 — `VIEWER` 가 safety_admin 으로 과적재돼 있다

7~12번 계열의 주석이 명시한다: **`// VIEWER = safety_admin`**.
안전 표면에서 `OrganizationRole.VIEWER` 를 "조회 전용" 이 아니라 **"안전 관리자"** 로
쓰고 있다. 그래서 그 게이트가 `[ADMIN, VIEWER]` 인 것이며, OWNER 누락도 이 과적재와
같은 뿌리로 보인다(역할 축이 두 개인데 enum 이 하나다).

→ §org-scope-ambiguity 로 넘긴다. 이번 (나) 범위에서 건드리지 않는다.

### 범위 재판정 (승인 대기)

(나)의 비용이 `organizations.ts` 한 줄이 아니다. **최소 2단계**다.

1. **선행** — 위 13곳(서버)에 OWNER 를 더한다. **동작 확대만 발생**하고 축소는 없다
   (지금 통과하는 사람은 그대로 통과, OWNER 만 추가로 통과)
2. 그다음 조직 생성자 → `OWNER` 한 줄

⚠️ **순서를 뒤집으면 안 된다.** OWNER 를 먼저 만들면, 그 순간부터 조직 생성자가
안전 지출·SDS·보안 설정 13개 표면에서 **403 을 받는다.** 지금은 ADMIN 이라 통과하고
있으므로, **OWNER 도입이 곧 권한 상실**이 되는 역전이 일어난다.

클라이언트 3곳은 서버와 같은 배포에 넣는다(서버만 열면 UI 가 여전히 막는다).

### Phase 1 — **착수 완료** (2026-08-12)

서버 13 + 클라이언트 3 = **16곳에 `OWNER` 추가.** 동작 확대만, 축소 0.
VIEWER 과적재는 **건드리지 않았다**(두 축을 한 커밋에 섞으면 판독 불가).

sentinel `src/__tests__/ops/org-role-owner-inclusion.test.ts` (O1~O4, 6 assertions).
corrupt→RED 3종 실증 — 배열에서 OWNER 제거 / 단독 where 복원 / 교정 지점 회귀
→ 각각 정확히 RED.

**재발 차단이 이 sentinel 의 본체다.** O1(`in:[]` 배열에 ADMIN 있으면 OWNER 필수)과
O2(`role: ADMIN` 단독 where 금지)는 목록이 아니라 **형태**를 잠근다 — 다음에 누가
새 판정을 추가해도 걸린다.

### ⚠️ 실측 ⑤ 정정 — 16곳이 아니라 **17곳이었다** (1곳은 dead file)

Phase 1 재sweep 에서 1곳이 더 나왔다:
`src/components/upgrade/upgrade-modal.tsx:55` — `userRole === OrganizationRole.ADMIN`.

**첫 sweep 이 변수명 패턴(`member|membership|orgMember|mem`)에 묶여 `userRole` 을
놓쳤다.** §3-1-1(리터럴 전수 grep)의 식별자판(版) 사각이다 — 값뿐 아니라 **타입명으로도**
훑어야 했다(`OrganizationRole.ADMIN` 전수).

**고치지 않았다.** 이 파일은 **importer 0 = dead file** 이고, 라이브 판본은
`components/billing/upgrade-modal.tsx` 로 거기엔 이 판정 자체가 없다. dead file 을
고치는 것은 §render-reachability 위반(2026-08-06 재발 사고와 동형)이다.
→ sentinel 의 `DEAD_FILE_EXCEPTIONS` 에 사유와 함께 기록했고, 파일이 되살아나면
예외에서 빼고 고쳐야 한다. **dead file 자체의 정리는 별건.**

## 2. 재개 시 실측 항목 (설계 전 — 설계는 그 다음)

- 두 enum 이 각각 어느 판정 지점에서 쓰이는가
- 같은 표면에서 둘 다 보는 곳이 있는가 (있으면 우선순위가 정의됐는가)
- 한쪽 enum 으로 다른 쪽을 판정하는 곳이 있는가

이는 §audit-foundation 과 같은 층위의 설계 작업이다 — 순서는 재개 시 호영님이 정한다.
