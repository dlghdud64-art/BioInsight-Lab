# CARD · §approver-axis-splits — 한 화면에서 "승인 권한" 이 0 과 1 로 갈린다

- 상태: 🔴 미판정 (호영님 판정 2026-08-25 — "먼저 API 실측 후 판정")
- 발단: §org-management-web P6 실측 QA · 호영님 화면 확인
- 묶음: 이월 항목 "승인자 축 API 확장" 단독 — GET `route.ts:65` map
  - 🛑 정정 2026-08-29: 앞서 여기에 `C1(plan 응답 실기)` 를 같이 적었으나 **오류**다.
    `PLAN_org-management-web` §C1 자기 정정이 이미 "응답 확장 불필요 · API 변경 0" 으로 닫았다
  - 🛑 정정 2026-08-29: §org-create-limit-always-free 는 **묶지 않는다.** 저쪽은 POST `:151` map 이라 같은 자리가 아니다 (근거: `PLAN_org-management-web.md` 승인자 축 이월 절)

## 증상 (프로덕션 실측 2026-08-25 · 조직 "Test" · 멤버 1명 ADMIN)

같은 페이지 안에서 같은 라벨이 두 값을 말한다.

```
개요 탭 KPI 카드        승인 권한  0   + 앰버 테두리 + "지정 필요" 배지
개요 탭 처리 항목        "승인자 미지정 — 구매 요청이 승인 단계 없이 통과됩니다"
승인 및 초대 탭          승인 권한 보유자 (1)   ← young a · 관리자 배지
```

## 원인 (page.tsx:333-336)

```ts
const adminCount    = members.filter(m => m.role === "ADMIN" || m.role === "OWNER").length;
const approverCount = members.filter(m => m.role === "APPROVER").length;
```

| 표면 | 쓰는 식 | 값 |
| :--- | :--- | :--- |
| KPI 카드 (:797) | `approverCount` | 0 |
| 처리 항목 (:601) | `approverCount === 0 && totalMembers > 1` | 발화 |
| 승인·초대 탭 (:1268) | `approverCount + adminCount` | 1 |

탭 쪽 `+adminCount` 가 먼저 있었고, §org-management-web P3 가 KPI 카드와 처리 항목을
**좁은 축으로** 새로 얹으며 갈라짐이 화면에 드러났다. 형제 슬롯을 안 셌다.

## 왜 지금 고르지 않는가

"관리자가 승인자인가" 는 UI 판단이 아니라 **승인 경로의 사실**이다.
코드에서 둘 중 하나를 고르면 화면은 일치하지만, 고른 쪽이 실제 승인 동작과
다르면 더 나쁜 거짓이 된다 — 지금은 최소한 화면이 불일치로 신호를 주고 있다.

⚠️ 특히 앰버 "지정 필요" 는 **관리자가 실제로 승인할 수 있다면 거짓 경보**다.
거짓 경보를 지우려고 축을 넓히는 것과, 진짜로 승인자가 없어서 경보하는 것은 다르다.

## 판정 방법 (실측 절차)

소스가 아니라 **승인 경로 API 가 누구를 통과시키는지**가 결정적 축이다.

1. 승인 판정이 실제로 일어나는 지점을 찾는다 — 구매 요청 승인 라우트/서비스.
   `grep -rn "APPROVER" apps/web/src/app/api/ apps/web/src/lib/` 로 시작하되,
   **역할 문자열이 나오는 곳이 아니라 그 값으로 분기하는 곳**을 센다.
   (§reachability — 존재를 본 도구와 도달을 본 도구가 달라야 한다.)
2. ADMIN/OWNER 이 그 분기를 통과하는지 본다. 세 갈래다:
   - 통과한다 → canonical 은 `APPROVER + ADMIN/OWNER`. KPI·처리 항목을 넓힌다.
   - 통과 못 한다 → canonical 은 `APPROVER` 만. 탭의 `+adminCount` 를 좁힌다.
   - 승인 경로가 아직 없다 → **두 표면 다 사실을 못 말한다.** 그때는 숫자를 고르는
     게 아니라 "승인 경로 미구현" 을 정직하게 표기하는 문제가 된다.
3. 고른 축을 **한 곳에서만 계산**한다. 지금처럼 세 표면이 각자 세면 또 갈라진다.
   `approverCount` 파생을 단일점으로 올리고 세 표면이 그것을 소비하게 한다.
4. sentinel: 세 표면이 **같은 식별자**를 쓴다는 것을 출현 수로 잠근다.
   (P6 의 스켈레톤 건과 같은 형태 — 문자열 일치를 계수로 핀하면 한쪽만 바뀌어도 RED.)

## 지금 화면에 남아 있는 것 (알고 남긴다)

봉합 전까지 KPI 는 0, 탭은 1 로 계속 갈린다. 앰버 경보도 그대로 뜬다.
조용히 한쪽으로 맞추지 않는다 — 맞추는 순간 불일치 신호가 사라지고,
틀린 쪽으로 맞췄을 때 그것을 알려줄 것이 없어진다.

---

## 같은 자리에 묶인 것 — 구성 요약 카드 중복 (2026-08-26 · P6 QA 재실측 중 발견)

요약 바를 은퇴시키자 그 아래 겹이 드러났다. **개요 탭에서 두 카드가 같은 세 축을 말한다.**

```
KPI 4카드      멤버 1 · 초대 대기 0 · 승인 권한 0 · Free 1/1 좌석
구성 요약 카드  멤버 1명 · 초대 대기 0명 · 승인자 0명      ← 개요 탭 우측 (P4a 신설)
```

P4a 가 "정적 3카드 흡수" 로 만든 카드다. 그때는 **요약 바 + KPI + 구성 요약 세 겹**이었고
요약 바를 걷어내며 두 겹이 됐다 — 은퇴 판단이 맞았다는 방증이면서, **같은 판단이 한 겹
더 필요하다**는 뜻이기도 하다.

🛑 **여기 묶는 이유 — 라벨이 갈린 것이 이 카드의 문제 자체다.**

```
KPI        "승인 권한"    approverCount            = 0
구성 요약   "승인자"       approverCount            = 0   (같은 값 · 다른 이름)
승인·초대 탭 "승인 권한 보유자" approverCount+adminCount = 1
```

세 표면이 **두 개의 이름**과 **두 개의 값**을 쓴다. 지금 중복만 걷어내면 남는 쪽의
라벨과 축을 그때 정해야 하고, 그건 이 카드의 판정과 같은 결정이다. 따로 하면 두 번
건드린다 — 축을 정한 뒤 그 축을 쓰는 표면을 함께 정리한다.

### 착수 시 추가 항목

```
5  세 표면의 라벨을 하나로 — "승인 권한" vs "승인자" 중 정본을 정한다.
   축(누구를 세는가)과 이름(뭐라 부르는가)은 다른 결정이지만 같이 land 해야 한다.
6  중복 제거 방향 판정 — KPI 4카드를 남기고 구성 요약에서 3축을 빼는 쪽이 자연스럽다.
   (KPI 는 P3 에서 상단 고정 · 구성 요약은 우측 보조) 다만 구성 요약이 3축을 잃으면
   그 카드에 무엇이 남는지 먼저 세고 판정한다 — 빈 카드가 되면 카드째 은퇴다.
```

⚠️ 이 중복은 **두 카드가 세로로 인접해야만 보인다.** 소스에서는 서로 다른 블록이라
읽어서는 안 나오고, sentinel 도 각자 자기 카드만 본다. 화면에서만 나오는 부류라
여기 적어두지 않으면 다음 세션이 또 화면에서 처음 발견한다.

---

## 판정 절차 2번 세 갈래 중 **세 번째**가 실측으로 성립했다 (2026-08-26)

이 카드가 처음부터 열어둔 갈래다 — "승인 경로가 아직 없다 → 두 표면 다 사실을 못
말한다. 그때는 숫자를 고르는 게 아니라 정직하게 표기하는 문제가 된다."

### 범위 실측 — Team ⊂ Organization (경쟁 축이 아니다)

```
model Team          organizationId String   🔑 required (§team-org-role-model 3c · 2026-08-12)
                    onDelete: Cascade
model TeamMember    별 테이블 · role TeamRole
model OrganizationMember  별 테이블 · role OrganizationRole
model PurchaseRequest  teamId String?  ← nullable · team-scoped
```

두 enum 은 **충돌이 아니라 다른 범위를 센다.** `TeamRole.ADMIN` 은 "이 팀의 관리자"
이고 조직 화면이 말하는 "승인 권한" 은 조직 범위다.

🛑 **그래서 "실 게이트를 조직 화면의 정본으로" 라는 갈래는 오답이다.**
   처방이 enum 통합이 아니라 **범위 정정**으로 바뀐다.

### prod 실측 (read-only · ref xhid…dhsw 일치 확인)

```
Team                0
TeamMember          0
OrganizationMember  1
PurchaseRequest 총  0   (teamId 있음 0 · null 0)
```

`Team 0 · TeamMember 0` 이면 `TeamRole.ADMIN` 을 가진 사람이 **존재할 수 없고**,
`api/request/[id]/approve` 는 누구에게도 200 을 낼 수 없다.

🔑 **"미구현" 이 아니라 "도달 가능한 상태 부재" 다.** 코드는 있다 — 라우트도 게이트도
정상이고, 그 게이트를 통과할 수 있는 주체가 아직 데이터에 없을 뿐이다.
(cf. §reachability — 존재를 본 도구와 도달을 본 도구가 다르다. 여기서는 코드가 존재이고
데이터가 도달이다.)

### 부수 결함 — 조직 범위 요청은 승인 불가

```
api/request/[id]/approve/route.ts:113
  teamId: purchaseRequest.teamId || ""     ← null 이면 빈 문자열
  → userId_teamId 매칭 0 → 항상 403
```

`PurchaseRequest.teamId` 가 nullable 이므로 팀에 안 매달린 요청은 승인 경로가 없다.
현재 prod PurchaseRequest 0 건이라 **도달 불가**다 — 지금 고칠 자리가 아니라 위 범위
판정과 함께 결정할 자리다.

## 판정 (호영님 2026-08-26) — (다) → (나) 순서

```
(다) 먼저   승인 체계가 아직 없다는 사실을 표기하고 숫자 표면을 내린다
            🛑 지금 앰버 경보는 "승인자를 지정하라" 고 말하는데 조직 범위에 지정 수단이
               없다. APPROVER 를 줘도 승인 라우트는 TeamRole 을 본다.
               **지시가 실행 불가능한 경보는 숫자가 틀린 것보다 무겁다.**
(나) 다음   조직 화면의 "승인 권한" 라벨을 범위에 맞게 정정 (enum 무접촉)
(가) 보류   조직 범위 승인 게이트 신설 — 팀 기능이 실제로 서는 시점의 결정
```

### ⚠️ 승인 범위 ≠ 실행 범위 (2026-08-30 · 기록 대상)

```
승인된 것   "겹 2 = 같은 파생을 두 번 그리지 않는다" — 중복 제거
실행된 것   구성 요약 **패널 은퇴** + 최근 활동 우측 승계 (레이아웃 변경 포함)
```

카드 항목 6 절차("3축을 빼면 무엇이 남는지 먼저 센다 — 0 이면 카드째 은퇴")를 따랐고
P4a 2열 유지 근거도 성립해 **결과는 수용**됐다. 다만 승인 범위와 실행 범위가 달랐다.

🔑 결과가 옳아도 경계가 움직인 것은 기록 대상이다. 다음에 같은 형태가 오면 —
   절차가 승인 범위를 넘어서는 결론으로 이어질 때, 실행 전에 그 사실을 먼저 올린다.
   "절차대로 했더니 범위가 넓어졌다" 는 승인 없이 넓혀도 된다는 뜻이 아니다.

### §2b 사례 3 이 자기 커밋 해시 위에서 재현됐다 (2026-08-30)

로컬 세션이 "오늘 이 세션에서 소스를 직접 커밋한 이력" 으로 여섯 건을 올렸고,
호영님이 받으신 착지 보고 다섯 건과 **교집합이 0** 이었다.

```
로컬 세션 목록   07df15d3 … 9a30d7d9   2026-08-23 ~ 08-26
호영님 수령분     ec25d690 … b5c76b83   2026-08-29 ~ 08-30
```

🔑 **둘 다 참이었다.** 목록이 틀린 게 아니라 **창이 달랐다** — 3~7일 차이.
로컬 세션은 시간창을 안 재고 "오늘 이 세션" 이라는 창을 씌웠고, 호영님이 낸 세 갈래
(다른 세션 / 보고가 일부 / 실재하지 않음)는 셋 다 "목록 자체가 틀렸다" 를 전제해
정답이 없었다. **양쪽이 같은 축(시점)을 안 셌다.**

🛑 그 다섯 중 `531d676f` 의 제목이 `§2b 사례 3` 이다. 시점 축을 안 세서 생긴 규칙이
   **자기 커밋 해시 위에서 다시 재현됐다.** 조문이 있다는 것과 그 조문이 적용되는 자리를
   알아본다는 것은 다른 일이다.

부수 — 그 목록을 근거로 "커밋 권한 분담" 해석을 뒤집으려 했던 것도 약한 자리였다.
분담의 근거는 **CLAUDE.md L323 하나**이고, 커밋 이력은 근거가 아니라 정황이다.

---

## §purchase-request-org-axis — 소속 축 신설 (2026-08-30 · (가) DDL 슬라이스)

### 🛑 이 슬라이스의 존재 근거 — 한 문장

> **예산 검증이 필요한 유일한 경로가 소속 축 부재로 그 검증을 건너뛰고 있었다.**

다음 세션이 "왜 nullable 이 아니라 NOT NULL 인가" 를 물으면 이 문장이 답이다.

```
quoteId 를 채우는 유일한 생성 지점   work-queue/purchase-conversion request-approval
그 지점이 채우는 teamId              없음
승인 라우트 :156                     orgId = purchaseRequest.team?.organizationId → undefined
승인 라우트 :184                     if (orgId && quoteId) { …예산 검증… }  → 통째로 스킵
```

소속 축 부재가 곧 **예산 통제 부재**였다. nullable 로 넣으면 코드 7곳의 방어
(`?? ""` · `if(...)`)가 그대로 살아 "없는 필드" 가 "null 일 수 있는 필드" 로 바뀔 뿐이다.

### 소생 검증 대상 — 두 건, 방향이 반대다

```
:546   죽어 있던 경로가 살아난다
       if (purchaseRequest.organizationId) — 항상 거짓이라 예산 경고 브로드캐스트가
       아무에게도 안 갔다. 필드가 서면 처음으로 돈다.
③ 경로  건너뛰던 게이트가 처음으로 걸린다
       teamId 없음 → orgId undefined → 예산 검증 스킵이던 경로가, organizationId
       NOT NULL 이 서는 순간 예산 게이트를 **실제로 통과해야** 한다.
```

🔑 둘 다 **검증된 적 없는 코드가 처음 발화하는 자리**다. "고쳤다" 가 아니라
"이제 돌기 시작한다" 이므로 재측정이 필요하다.

재측정 시나리오 (필수)

```
③ 경로 생성 → 승인 → 예산 게이트 발화        ← 가장 중요한 경로에서 첫 발화
:546 예산 경고 브로드캐스트 수신 확인          ← OWNER+ADMIN 에게 실제로 가는가
```

### 파생/판정 축 (조문 — sentinel 로 잠금)

```
파생  teamId 있음  organizationId = team.organizationId   조건 3 이 정의상 성립
      teamId 없음  서버 파생 (workspace 축)
판정  전 경로 공통  요청자의 organizationMember 존재
🔑 파생은 team/workspace 축, 판정은 organizationMember 축.
   귀속 정확 != 행위 허용 — team 멤버십만 보면 A 조직 멤버가 B 조직 산하 팀의
   teamId 로 남의 조직에 예산 요청을 만들 수 있다 (protocol/bom 격리 감사와 같은 축).
```

### 부수 기록

```
§4-a-2 두 번째 방어   조건 3 부정 단언을 파일 전역으로 걸었더니 :75 의 살아 있어야 할
                     인벤토리 접근 검증이 걸렸다. 창을 create 블록으로 좁혔다 —
                     결정은 "요청 행의 org 가 team 에서 온다" 이지 "파일에
                     inventory.organizationId 가 없다" 가 아니다. (조항 land 이틀 안 2회)
heredoc 함정 재발     `<<'PYEOF'` 안의 `\n` 이 실제 줄바꿈으로 들어가 정규식이 깨졌다.
                     오늘 여러 번 반복 — 형태다. 편집은 heredoc 대신 Edit 도구를 쓴다.
B 폐기 도달 경로      A/B 판정 근거 1(ADMIN → LAB_MANAGER 는 실험실 운영 역할이지 예산
                     권한이 아니다)이 이미 "경쟁 축이 아니다" 를 가리켰는데, 그것을 B 기각
                     근거로만 쓰고 후보 제외까지 안 갔다. 답은 맞았는데 도달 경로가 한 칸
                     짧았다 — **목록에 있으니 후보로 취급한 것**이다.
ADMIN 1 실측          prod OrganizationMember = ADMIN 1명. B 였으면 이 조직은 승인 0으로
                     남는다. 근거 2(OWNER 1명 실패 모드)가 이미 실현된 형태다.
```

---

## §2b 사례 5 — 대상 DB 오측 (2026-08-30 · (나)-1 판정 재료 정정)

`§purchase-request-org-axis` DDL 을 적용하려다 **살아 있는 DB 가 둘**임을 발견했다.
`.env` 는 테스트 DB(tvkl) 를 가리키고 프로덕션은 xhid 다. `_prisma_migrations` 최신 3건이
같아 **이력으로는 안 갈렸고**, `/api/health` 의 `userCount 3 · orgCount 2` 대조로 확정했다.

### 소급 대조 — 무엇이 어느 DB 였나

```
✅ ADMIN 1                        xhid  (prod 실측 맞음)
✅ Team 0 · TeamMember 0          xhid  (tvkl 은 1/1)
🛑 OWNER 4 · ADMIN 0 · ownerless 0  tvkl  → "레거시 위험 인스턴스 0" 결론 무효
🛑 prod 유료 조직 0                 tvkl  → 실 prod 는 유료 1 (BioInsight · ORGANIZATION)
⚪ PurchaseRequest 0 · CategoryBudget 0   양쪽 0 — 값으로는 구분 불가(결론 무손상)
```

구조 원인: 인자 없는 `new PrismaClient()` 가 이 세션에서 **127회**. 인자가 없으면 `.env`
= 테스트 DB 다. **대상 선택이 매번 암묵이었다.**

### (나)-1 판정 재료 — xhid 재실측

```
Organization 2 · User 3 · Team 0 · TeamMember 0 · CategoryBudget 0 · PurchaseRequest 0
T1 (FREE · 06-22)   멤버 1  dlg***@gmail.com  ADMIN → **OWNER 승격 완료**
BioInsight (ORGANIZATION · 06-13)  멤버 0
승인권자 총계        1명 (A축 APPROVER|ADMIN|OWNER · B축 ADMIN|OWNER 어느 쪽이든 동일)
🔑 앞선 A/B 판정은 이 실측 위에서도 뒤집히지 않는다.
```

### B1b 레거시 위험 — 원리가 아니라 prod 에서 살아 있었다

```
T1 은 OWNER 배선(2026-08-12) 이전 생성분이라 유일 소유자가 ADMIN 이었다
→ where { userId, role: "OWNER" } 가 0건 → currentOrgCount 0 · plan FREE(한도 1)
→ 0 >= 1 이 거짓 → **FREE 한도 1인데 2번째 조직 생성이 열려 있었다**
```

처방 (호영님 판정): **계수는 안 건드린다.** ADMIN 을 포함으로 넓히면 B1b 가 닫은
초대 오염(남의 조직 ADMIN 초대가 내 한도에 계수)이 되돌아온다 — **축은 맞고 데이터가 틀렸다.**
데이터 정정으로 닫고 재발은 `/api/health` `ownerlessCount` 불변식이 감시한다.
실행: 1행 UPDATE + `AuditLog(PERMISSION_CHANGED)` 1행 · `ownerlessCount 2 → 1` 발화 확인.

🔑 이 불변식이 옳았다는 것이 오히려 실증됐다 — "데이터가 보증하던 안전" 은 실제로는
   없었고, 런타임 프로브가 그것을 발화해 잡아냈다.

### BioInsight Research Lab — 생성 경로 결함이 아니다

가설(멤버 0인 조직 = 생성 경로가 OWNER 멤버십 없이 조직을 만들 수 있었다)은 **기각**된다.
이 행은 **생성 라우트를 거친 적이 없다.**

```
id = "org-bioinsight-lab"        cuid 가 아니다 (T1 은 cmqp6tp92…)
User 2명도 수기 id                user-bioinsight-admin · user-bioinsight-researcher
                                 Account 0 · Session 0 · emailVerified 없음 → 로그인 이력 0
같은 계열                         Product 200/200 · ProductInventory 9/10 이 수기 id
정의처                            prisma/seed.ts:443-449 (plan: "ORGANIZATION" 도 시드 값)
🛑 seed.ts 는 organizationMember 를 **아예 만들지 않는다** (grep 0건)
   → 멤버 0 은 생성 경로 결함이 아니라 **시드 누락**이다.
updatedAt 2026-07-05 09:59       migration 20260705120000_org_safety_categories 와 일치
                                 (사람이 만진 흔적이 아니라 DDL 이 건드린 자국)
```

⚠️ 수동 플랜 부여 가설도 기각된다 — `plan=ORGANIZATION` 이 시드 파일에 박혀 있다.
   다만 **이 조직을 어떻게 할지(정리/보존)는 여전히 제품 판단**이다. 실행 안 함.

### 📌 알려진 잔여 · 큐 (2026-08-30)

```
ownerlessCount 1   org-bioinsight-lab (prisma/seed.ts:443 데모 시드)
                   🛑 사유를 붙여 둔다. 사유 없는 1 이 남으면 불변식 발화가 노이즈로
                     늙고, 노이즈가 된 경보는 (다) 에서 내린 앰버와 같은 부류가 된다.
                   판정 기준: 2 이상 = 새 위반. 1 이어도 사유가 다르면 새 위반.
                   해소 선행 조건: 데모·파일럿 표면의 org-bioinsight-lab 참조 전수.

큐 1  seed.ts 결함  prisma/seed.ts 가 Organization 을 만들며 organizationMember 를
                   아예 만들지 않는다 → 시드 조직이 태생적으로 ownerless 다. 별 슬라이스.
큐 2  PrismaClient  ref 를 출력하고 시작하는 스크립트 헬퍼로 무인자 호출을 유도. §2c 구조 원인.
큐 3  vercel 로그   창 6분(배포 07:43 ~ DDL 07:49) 실패 요청 유무 — **미확인 유지**.
                   MCP 미인증이라 잴 수단이 없다. "실패 0" 이 아니라 "못 잼" 이다.
                   호영님이 대화형에서 인증 처리 후 재측정.

폐기  scripts/add-owner-role.mjs — 삭제(2026-08-30). §2c 위반 4건.
      수리 큐가 아니라 삭제다 — 존재하는 한 다음 세션이 "도구가 있다" 는 이유로 집는다.
```

---

## §purchase-request-org-axis #실재화 (2026-08-30 · 유령 6곳 → 봉합 걷기)

### 🛑 새 발견 — 죽어 있던 통제가 **둘**이었다

nullable 이 아니라 NOT NULL 이어야 했던 근거가 하나 더 나왔다.

```
예산 통제        orgId(team 경유) undefined → if (orgId && quoteId) 스킵      [기지]
개인 결재 한도    purchaseRequest.organizationId ?? "" → findFirst null
                → approvalLimit null(=무제한) → checkApprovalLimit 전부 통과   [신규]
```

`:137` 의 `?? ""` 는 방어처럼 보이지만 **한도 게이트를 통째로 무력화하는 봉합**이었다.
`§S2 #approval-limit-server-enforce` 는 audit S2 HIGH 로 세운 통제인데,
"권한 보유 actor 가 자기 한도 초과 건을 직접 승인하던 우회를 닫는다" 던 그 게이트가
**소속 축 부재로 열려 있었다.** 서로 다른 통제축 2개가 같은 뿌리로 죽어 있었다.

### 계수가 세 번 움직였다 — 축과 시점을 함께 적는다

```
7곳   직접 6 + team 경유 1(:156)     단위가 섞였다 (§2b 사례 2)
6곳   직접 읽기만 · 봉합 제거 **전**   88da2db7^ 과 이 슬라이스 착수 시점
5곳   직접 읽기만 · 봉합 제거 **후**   지금. 6번째는 항상-거짓 분기 자신이었다
```

🔑 6 → 5 는 결함이 아니라 **이 슬라이스의 산물**이다. 사라진 하나가
`if (purchaseRequest.organizationId)` — 읽기이면서 동시에 도달을 막던 분기다.
🛑 "줄었으니 회귀" 로 읽으면 봉합을 되돌린다. RED 를 볼 때 "무엇이 나빠졌나" 전에
**"무엇이 좋아졌나"** 를 먼저 묻는다(§sweep).

### 봉합 2건 제거 = 소생 5지점

```
:137  ?? "" 제거                 → 개인 결재 한도 게이트가 실제로 발화
:546  항상-거짓 if 제거           → OWNER+ADMIN 예산 경고 브로드캐스트가 처음 도달 가능
:241  POCandidate 조회 필터        🛑 undefined 는 Prisma where 에서 **조건이 통째로 생략**된다.
                                 값이 안 들어간 게 아니라 필터가 없었다 — 다른 조직 후보까지 잡혔다.
:312  POCandidate 생성에 org 기록   이전에는 NULL 로 들어갔다
:330  convertPOCandidatesToOrders 인자에 org 전달
```

### 🛑 순서 정정 — ③ 예산 게이트 첫 발화는 이 슬라이스에서 **검증 불가**

```
③ 경로는 teamId 를 안 채운다
승인 라우트 :113  teamId: purchaseRequest.teamId || ""  → teamMember 없음
           :121  role !== TeamRole.ADMIN               → **403**
→ 예산 게이트(:184) 앞에서 끊긴다. 소생 여부를 잴 수 없다.
```

⚠️ "7곳 실재화(③ 예산 게이트 첫 발화 포함)" 은 **(나)-1 선행이 필수**다.
`:156`(team 경유 → 직결)만 바꿔도 안 된다 — 승인 자체가 403 이라 게이트에 도달을 못 한다.
→ ③ 발화 실측은 **(나)-1 완료 직후**로 이월. 기록으로 두지 않고 sentinel 긍정 단언으로
  코드에 붙여 뒀다((나)-1 이 배선을 바꾸면 그 단언이 RED 로 떨어져 실측 시점을 알린다).

### 잔여 데이터 — 조치 불필요로 닫는다

```
prod POCandidate 3행 · organizationId 전부 NULL
  → 2026-06-13 시드(BioInsight 계열)이고 **quoteId 도 NULL** 이다.
    :241 은 quoteId 로도 거르므로 필터 실재화가 이 3행을 새로 고아로 만들지 않는다.
    (필터가 살아나며 기존 행이 안 잡히게 되는 위험을 먼저 셌고, 해당 없음)
prod Order 2행 · PurchaseRequest 0행
```

### 게이트

```
sentinel  purchase-request-org-axis-realized.test.ts  10/10 GREEN
프로브    12/12 검출 · 대조군 GREEN · 바이트 무손상
          🔑 러너 기준 = **프로젝트 러너**(cwd=apps/web · vitest.config.ts 적용)
스코프    3923 passed / 2 failed + 수집실패 1
          (pretendard · sds · compare-sync `Cannot find module '@/lib/db'`)
          셋 다 내 변경 이전부터 — 88da2db7^ 대조 및 무관 import 확인
tsc       27 불변
```
