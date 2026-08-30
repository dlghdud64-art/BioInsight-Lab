# HANDOFF 2026-08-30 — §org-create-limit 계보 종결 · 신설 조항 7건 · 이월 7건

이 세션은 조항이 많이 열렸다. **인계가 실물이다** — 다음 세션은 커밋 메시지를
역순으로 읽지 않으므로 여기서 한 번에 받는다.

---

## 0. 상태 줄

```
HEAD        9ae1c17f  feat(organizations): §approver-axis ①c 되살림
동기        main ↔ origin/main 일치 (ahead/behind 0)
tsc         27  (세션 내내 불변 — 기준선)
기존 실패   2  pretendard-font-prebuild-314d · sds-document-model-348b1
            🔑 둘 다 이 세션 이전부터. 88da2db7^ 스키마 대조 + import 무관 확인 완료.
            매 슬라이스마다 **변경 전후 실패 파일 집합 diff** 로 신규 0 을 확인했다.
DB          prod = xhid…dhsw · test = tvkl…pzqr
            🛑 `.env` 는 **test** 를 가리킨다. prod 는 명시 override 로만.
마이그레이션  20260830120000_purchase_request_organization_id — 양쪽 적용 완료
```

착지 커밋 10건 (`401b5cb8..9ae1c17f`):

```
88da2db7  (가) DDL — PurchaseRequest.organizationId NOT NULL + 생성 3지점
3f76d28d  §2b 사례 5 — prod 오측 정정 · 대상 DB 조항 신설
ba0755c8  백필 도구 폐기·삭제 + 복구 경로 정정 · 잔여 1 사유 명시
2b312086  #실재화 — 봉합 2건 제거 · 죽어 있던 통제 2축 소생
89d1580e  (나)-1a — 소속 축 직결 (team 경유 제거)
70d9d3f5  (나)-1b — 승인 게이트 축 교체 (TeamRole → 조직 A축)
7ff1b085  #카테고리축-부재 — 후보 3 정직 표기 + tx 타이핑 + ③ 도달 실측 종결
61b6127e  (나)-2 — 표면 통일 (정의 5개 → 정본 1개)
3569ede8  §4c 차단 개정 · 주석 제거본 조항 일반화 · 되살림 실측 선언
9ae1c17f  ①c 되살림 — (다) 근거 소멸 + 발화 조건 신설
```

---

## 1. 종결 — §org-create-limit 계보 (B1b → B2 → DDL → (나) → ①c)

시작은 "승인권자 숫자가 화면마다 다르다" 였다. **숫자를 고르는 문제가 아니었다.**

```
B1b   조직 생성 한도 계수 축 교정 (OWNER-only · 초대 오염 차단)
B2    한도 정본을 PLAN_LIMITS 로 (세 번째 진실 소멸)
 ↓
(다)  실행 불가능한 지시 5곳 내림 — "APPROVER 를 줘도 승인이 안 열린다"
      🔑 "미구현" 이 아니라 **도달 가능한 상태 부재** 였다. 코드는 있었다.
 ↓
(가)  DDL — PurchaseRequest.organizationId NOT NULL
      🛑 존재 근거 한 문장: **예산 검증이 필요한 유일한 경로가 소속 축 부재로
        그 검증을 건너뛰고 있었다.**
      실재화에서 하나 더: 개인 결재 한도(§S2)도 같은 뿌리로 죽어 있었다.
      → 성격이 다른 통제축 **둘**이 컬럼 하나가 없어서 동시에 없었다.
 ↓
(나)-1a  소속 축 직결 (team 경유 → organizationId · 타임존 포함)
(나)-1b  게이트 축 교체 (TeamRole.ADMIN → APPROVER·ADMIN·OWNER)
         prod Team 0 · TeamMember 0 — 옛 게이트로는 **아무도 승인할 수 없었다**
(나)-2   표면 통일 — 정의 5개 → 정본 1개 (client-safe 모듈)
 ↓
①c    조건부 되살림 — approvalPolicy !== "none" && approverCount === 0
```

### 왜 조건 분기 하나로 닫혔는가

(다)가 지시를 내린 이유는 "끝이 비었다" 였고, (나)가 끝을 채웠다. 그런데 되살림의
조건은 "게이트가 열렸다" 가 아니라 **"지시를 따라가면 끝까지 도달한다"** 였다.
tvkl 3단 실측으로 도달을 확인한 뒤, 실측이 문구보다 큰 사실을 하나 더 줬다 —
**승인권자 0이 항상 문제가 아니다.**

```
approvalPolicy = "none" (FREE·Basic)     승인 단계 자체가 없다 → 요청이 안 멈춘다
approvalPolicy = in_app_approval          승인권자 0이면 PENDING 에서 **멈춘다**
prod T1 이 전자다 — 거기 띄우면 그것도 틀린 경보다.
```

🔑 시작 판정("숫자를 고르는 문제가 아니다")이 실측 세 바퀴를 돌아 **조건 분기 하나**로
닫혔다. 정의를 하나로 모으는 것만으로는 부족했고, 그 정의가 **언제 참인지**가 남아 있었다.

### 정본 위치 (다음 세션이 먼저 볼 것)

```
승인 권한 역할 집합   src/lib/permissions/org-approver-roles.ts   ← 정본. 사본 금지.
                     ORG_APPROVER_ROLES · isOrgApprover · countOrgApprovers
                     🔑 client-safe (Prisma 미포함). approver-routing 은 재수출만.
소비자 5             api/organizations · dashboard/organizations(목록·상세) ·
                     lib/operations/cta-helpers · api/quotes/[id] canApprove ·
                     api/request/[id]/approve (서버 게이트)
발화 조건 소유자      __tests__/dashboard/organizations-approver-alarm-retired.test.ts
                     🛑 p4a 는 재핀하지 않는다 — 같은 사실을 두 곳이 말하면
                       다음 갈라짐의 씨앗이다(이 트랙의 출발점이 정확히 그것이었다).
```

---

## 2. 신설 조항 전수 (7건) — 위치와 한 줄 요약

전부 `docs/handoff/HANDOFF_2026-08-26-negative-assertion-and-screen-check.md` 안에 있다.

| 조항 | 한 줄 | 위치 |
| :--- | :--- | :--- |
| §2b 사례 5 | **대상**도 세는 축이다 — 살아 있는 DB 가 둘이었고 이력이 같아 이력으로는 안 갈렸다 | `### 사례 5 — 대상` |
| §2c | `target-must-be-fixed-outside-the-db` — DB 를 근거로 쓰는 실측·DDL 은 실행 전 ref 를 **DB 밖 정합**으로 확정한다. 기본값은 test 로 둔다 | `## 2c.` |
| §2c 부속 | 오측이 하나 판명되면 **같은 창에서 잰 값 전부**가 재대조 대상이다 | `## 2c.` 안 |
| §2d | `additive-ddl-applies-before-push` — ADR-002 구조에서 push→배포→apply 는 창을 필연으로 만든다. additive 는 **apply → push** | `## 2d.` |
| §2e | 선언 게이트 절차 — 복원은 생성 플래그가 아니라 **id 목록 기준으로 무조건**, 실행 앞에도 한 번. 실행 중 선언 수정 금지 | `## 2e.` |
| §4b | 게이트 **판독 필터**가 실패 축을 통과시키지 않으면 GREEN 으로 읽힌다 (`Test Files` 필수) + **두 결함이 만나면 각각보다 훨씬 늦게 드러난다** | `## 4b.` |
| §4c | heredoc 이 정규식을 깬다 — **조항이 아니라 차단**. 정규식 포함 파일 생성/수정은 Write/Edit 도구로만 | `## 4c.` |
| §4d | `gate-must-assert-its-own-tree` — 게이트는 자기가 재는 트리가 **변경본**임을 먼저 단언한다. stash 로 감싸지 않는다 | `## 4d.` |
| §4-a-2 3-d | 프로브 baseline 이 0인지 확인하고 **중단 가능**해야 한다. `-1`(안 읽힘)은 "실패 0" 이 아니다 | `### 4-a-2.` |
| §4-a-2 3-c 개정 | 대조군 grep 0 을 **도구가 강제**한다 — 프로브가 자체 grep 하고 0이 아니면 시작 거부 | `### 4-a-2.` |
| §sweep 추가 | 옛 값 sweep 은 **바꾼 것 전부**로 건다 — 메서드명 포함 | `## 3.` |

메모리 조항 1건도 일반화됐다:

```
feedback_negative_sentinel_strip_comments
  → 소스 grep 단언은 **긍정·부정 불문** 주석 제거본 위에서 본다.
    주석은 코드가 아니므로 어느 방향 단언에도 매칭 대상이 아니다.
    🛑 예고된 자기소멸 단언이 조용하면 그것 자체가 결함 신호다.
```

### 조항이 방어로 기능한 사례 4건 (사후 기록 아님)

```
§2b        tsc 27→6 을 "개선" 으로 안 읽었다 — JSX 파스 중단이었다
§4-a-2     부정 단언이 결정보다 넓어 멀쩡한 검증을 잠글 뻔한 것을 2회 잡았다
OWNER 불변식  "데이터가 보증한다" 던 안전이 처음부터 없었음을 프로브가 발화로 드러냈다
§sweep     계수 6→5 를 "회귀" 로 안 읽었다 — 봉합을 되돌릴 뻔했다
축 미해결 sentinel  4건 전부 예고대로 RED → 교체 지점을 게이트가 가리켰다
```

🔑 **미해결을 침묵이 아니라 단언으로 들었기 때문에 닫히는 순간 소리가 났다.**
   반대 사례도 같은 세션에 있다 — 승계 근거 주석의 옛 토큰이 긍정 단언을 통과시켜
   예고된 RED 가 **안 났다**(위 메모리 조항이 그 처방이다).

---

## 3. 이월 7건 — 각 선행 조건

### 호영님 몫 (2)

```
1. vercel 로그 인증        MCP 미인증이라 창 6분(배포 07:43 ~ DDL 07:49) 실패 요청
                          유무를 **잴 수단이 없다.** "실패 0" 이 아니라 "못 잼" 으로
                          열어 둔다. 대화형에서 인증 후 알려주시면 그때 재서 닫는다.
2. BioInsight 처분         org-bioinsight-lab 은 prisma/seed.ts:443 시드로 판명(수기 id ·
                          Account/Session 0 · plan 도 시드 값 · updatedAt 은 DDL 자국).
                          🛑 선행: 데모·파일럿 표면의 org-bioinsight-lab 참조 전수.
                          그때까지 ownerlessCount 1 은 "알려진 잔여" 로 사유가 붙어 있다
                          (owner-invariant.ts 헤더 · 카드). 2 이상이면 새 위반.
```

### 새 세션 몫 (5)

```
큐 A  admin/orders/[id]/status runTransaction 타이핑
      선행 조건: **독립 큐가 아니다.** 다음에 그 라우트를 건드리는 슬라이스가
        타이핑을 선행으로 든다. 손으로 쓴 tx 인터페이스(RestoreTx · budgetEvent
        구조타입)가 Prisma.TransactionClient 를 안 받는다 — 2건 실측 확인.
      🔑 근거: `tx: any` 가 실제로 결함을 가렸다(Product 에 없는 필드 select).
        같은 가림막이 그 콜백 안에 살아 있다.

큐 B  POCandidateRow ↔ Prisma POCandidate 형태 통일
      선행 조건: po-candidate-server 소비자 전수 확인.
      갈리는 필드는 expectedDelivery: string|null vs Date|null 하나이고 런타임은
      통과한다(Prisma 가 DateTime 에 ISO 문자열 수용). 현재 push 지점 1곳 캐스트 +
      큐 B 참조 주석.

큐 C  Product.normalizedCategoryId FK (후보 1)
      선행 조건: **CategoryBudget 실사용 트랙이 열릴 때.** 독립 큐가 아니다.
      지금은 후보 3(정직 표기)으로 닫혀 있다 — prod SpendingCategory 0 ·
      CategoryBudget 0 · Product 314. 열 때 314행 백필 정책이 함께 필요하다.
      🔑 sentinel 이 역방향으로 잠갔다 — Product 에 그 필드가 생기면 RED 가 나고,
        그게 이 트랙 개시 신호다.

큐 D  prisma/seed.ts 가 Organization 을 만들며 organizationMember 를 **아예 만들지
      않는다**(grep 0) → 시드 조직이 태생적으로 ownerless.
      선행 조건: 없음(독립). BioInsight 처분과는 별개 — 그건 데이터, 이건 시드 코드.

큐 E  PrismaClient ref-출력 헬퍼
      선행 조건: 없음(독립). 근거: 이 세션 트랜스크립트에서 인자 없는
      `new PrismaClient()` 가 **127회**. 인자가 없으면 `.env`(테스트 DB)로 간다 —
      §2c 사고의 구조 원인이다. ref 를 먼저 출력하고 시작하는 헬퍼로 유도한다.
```

### 오늘 열린 것 2건 (조항으로 닫았고, 도구화가 남았다)

```
① 대조군 grep 0 자동화     §4-a-2 3-c 개정대로 **프로브 스크립트가 자체 grep** 하고
                          0이 아니면 시작 거부. 조항은 썼고 **도구는 아직 없다.**
                          선행 조건: 없음. 다음 프로브 작성 시 그 형태로 시작한다.
                          🛑 4회 전부 "이번엔 안 물리겠지" 였고 4회 전부 물렸다.
② 게이트 트리 단언         §4d 대로 게이트 실행 전 트리가 변경본임을 단언.
                          stash 로 감싸지 않는다(타임아웃 시 pop 이 안 돈다 — 실제 발생).
                          선행 조건: 없음. 전후 비교는 커밋 전후나 워크트리로.
```

---

## 4. 다음 세션이 착수 전에 볼 세 줄

```
1. `.env` 는 **테스트 DB** 다. prod 작업은 명시 override + /api/health 대조(§2c).
2. 정규식이 들어가는 편집은 **heredoc 을 쓰지 않는다** — Write/Edit 도구로만(§4c).
3. 게이트를 읽기 전에 **자기가 재는 트리가 변경본인지** 단언한다(§4d).
```

카드 정본: `docs/handoff/CARD_approver-axis-splits-in-one-screen.md`
조항 정본: `docs/handoff/HANDOFF_2026-08-26-negative-assertion-and-screen-check.md`
선언 이력: `docs/plans/DECLARATION_org-axis-1b-tvkl.json`(1차 · 오류 포함 보존) ·
`DECLARATION_org-axis-1b-tvkl-2.json` · `DECLARATION_approver-grant-e2e-tvkl.json`
