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

## 2. 재개 시 실측 항목 (설계 전 — 설계는 그 다음)

- 두 enum 이 각각 어느 판정 지점에서 쓰이는가
- 같은 표면에서 둘 다 보는 곳이 있는가 (있으면 우선순위가 정의됐는가)
- 한쪽 enum 으로 다른 쪽을 판정하는 곳이 있는가

이는 §audit-foundation 과 같은 층위의 설계 작업이다 — 순서는 재개 시 호영님이 정한다.
