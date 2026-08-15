# §audit-integrity-fix — 감사 무결성 수정 설계안

- **Status:** 🟡 설계안 (2026-08-15). 구현 0. 호영님 검토 대기
- **선행 확진:** §audit-integrity-200-mask (실패 주입 2/2)
- **방향 확정 (호영님):** (다) 경로별 분리. **단 선행 수정 1건이 갈래보다 먼저다.**

---

## 0. 순서 — 정의부가 먼저다

```
1단계: 헬퍼 6개 — 내부 catch 제거 또는 rethrow. 실패가 호출부에 도달하게만 한다
2단계: 호출부 정책 — 경로별 (가) fail-closed / (나) 가시화
```

지금 구조는 헬퍼가 catch 하고 `null` 을 반환해서 **호출부가 실패를 알 방법이 없다.**
어떤 정책을 얹어도 **정책이 작동할 정보 자체가 없다.**

🛑 **소비자 146건 개별 판정을 하지 않는다.** 정의부 6개로 덮인다 —
그게 정의부 귀속 규칙의 실제 효용이다.

## 1. 🔴 tsc 파급 — **실측 0건**

6개 정의부를 전부 rethrow 로 바꾸고 측정한 뒤 되돌렸다(복원 clean 확인).

```
적용        6/6
tsc 오류    27 → 27
신규        0        (분모 = 저장소 전체·검증 자산 포함)
```

> **rethrow 는 타입에 보이지 않는다.**

`.catch()` 가 붙은 호출은 여전히 타입이 맞고, `await` 없는 호출도 마찬가지다.
`return null` 을 없애 반환 타입이 좁아져도 `if (!result)` 식 소비는 통과한다.

⚠️ **이게 이 배치의 가장 중요한 실측이다.** 파급이 없다는 뜻이 **아니라**,
파급이 **전부 런타임에만 나타난다**는 뜻이다.

- **정적 게이트(tsc)는 이 변경에 대해 0의 보호를 제공한다**
- 따라서 **실패 주입 런타임 프로브가 유일한 게이트**다
- §runtime-beats-static-gate 의 새 사례로 등재

⚠️ 측정 중 앵커 4/6 이 CRLF 로 불일치했다. 저장소 줄끝이 파일마다 섞여 있다 —
치환 배치에서 `\r?\n` 정합을 기본으로 둔다.

## 2. (가) 경로 — 호영님 경계 적용

> 판단 기준은 "규제 항목이냐" 가 아니라 **"기록이 없으면 행위를 재구성할 수 없느냐"**.

### 실측 모집단

```
헬퍼 호출부 총계 102건 / 정의부 4파일 제외한 src 전체
  createAuditLog 46 · createActivityLog 40 · createActivityLogServer 10
  · logStateTransition 6 · logCTAExecution 0
```

📌 `logCTAExecution` 은 **호출부 0**. 정의부만 있고 소비자가 없다 — 별건으로 존폐 판단.

### 분류

| | 건수 / 파일 | 비고 |
|---|---|---|
| **(가) fail-closed** | **69건 / 41파일** | 경로 패턴으로 확정 |
| (나) 가시화 | 0건 | 패턴 매칭 0 |
| 미분류 | 33건 / 18파일 | 경계 수동 적용 필요 |

🛑 **(나) 가 0 이다.** 감사 헬퍼는 조회·리포트 경로에서 거의 호출되지 않고,
**쓰기·전이 경로에 몰려 있다.** (다) 안이 실질적으로 (가) 단일에 가깝다.

(가) 69건 내역 (축별):
- **상태 전이** — `quotes/[id]/status` · `admin/orders/[id]/status` · `receiving-drafts/[id]/{approve,reject}` · `ai-actions/[id]/approve`(9) 등
- **재고 이동** — `inventory/{[id],[id]/restock,[id]/use,[id]/inspection,dispatch-batch,smart-receiving}` · `lib/ai/inventory-restock-detector`
- **권한 변경** — `organizations/[id]/{members,security,sso}` · `admin/users/invite` · `workspaces/[id]/members/[memberId]`
- **SDS·제품** — `products/[id]/{sds,inspection}` · `safety/sds/bulk/commit`
- **외부 발송** — `orders/[id]/send-email` · `quotes/[id]/{vendor-requests,vendor-replies}` · `shared-lists` · `vendor/quotes/[quoteId]/response` · `ai-actions/generate/vendor-email-draft`

미분류 33건에 경계를 적용하면 대부분 (가) 로 간다:
`admin/users/[id]/{approval,approval-policy,restore}`(권한) · `organization-vendor(-products)`(제품 정보) ·
`cron/user-soft-delete-purge`(되돌릴 수 없음) · `workspaces/[id]`(조직).
**(나) 후보는 `safety/spend/summary`·`safety-spend` 2건 정도**다.

⚠️ 이 분류는 **경로 패턴 도출**이다. 판정이 아니다 — 확정 전 호영님 확인 필요.

## 3. (나) 처리 — 큐는 이 배치 밖

재시도 큐는 인프라 작업이다. 이 배치의 중간 조치:

```
실패를 삼키지 않고 stderr + 메트릭으로 가시화만. 응답은 유지.
```

큐는 **별도 카드**로 연다.

## 4. 프로브 계획 — 실패 주입, 선언 잠금

주입 방식·대상·복원을 선언에 박고 잠근다. **선언 밖 주입은 ④ 정지.**
주입은 한 번에 하나, 주입 상태로 다른 프로브를 이어 돌리지 않는다.

| ID | 대상 | 주입 | 기대 |
|---|---|---|---|
| FIX-P1 | `quotes/[id]/status` PATCH — (가) | 헬퍼 내부 throw | **5xx** (현재 200) |
| FIX-P2 | `inventory/[id]/use` — (가) 재고 이동 | 동일 | **5xx** |
| FIX-P3 | `organizations/[id]/members` — (가) 권한 | 동일 | **5xx** |
| FIX-P4 | `safety-spend` GET — (나) | 동일 | **200 + stderr 가시화** |
| FIX-P5 | 회귀 — 주입 없이 (가) 4경로 | 없음 | 200 + 파생 델타 = **정상 기준선** |

- 정온 하한 1890ms · 판정 게이트 코드화(UNCLASSIFIED) · 계측기 자기검증 선행
- 대량 스윕과 상태 변경을 같은 실행에 넣지 않는다(풀 고갈 규칙)
- **델타는 기준선 대비로만 읽는다** — FIX-P5 로 정상 기준선을 먼저 잡는다

## 4.5 🔴 선결 확인 — 감사 쓰기는 업무 트랜잭션에 **편입되어 있지 않다** (실측)

호영님 지적이 맞다. 실측 결과:

```
감사 호출 총계                       102건 / 59파일
  $transaction 콜백 안(어휘적)        15건
  실제 tx/txClient 전달               5건   ← 편입된 것은 이것뿐
  편입률                              5/102 (4.9%)

감사 호출부 파일 59개 중
  $transaction 을 쓰는 파일           18
  업무 쓰기가 트랜잭션 밖인 파일      41
```

🛑 **10건은 편입된 것처럼 보이지만 아니다.** `$transaction` 콜백 **안**에 있으면서
전역 `db` 를 쓴다 — Prisma 에서 이건 **별도 커넥션·트랜잭션 밖** 실행이다.
읽는 사람은 편입으로 읽고, 실제로는 아니다. 미편입보다 나쁜 형태다.

### 따라서 호영님이 제시한 커밋 순서가 맞다

```
커밋 1: 감사 쓰기를 업무 트랜잭션에 편입
커밋 2: 정의부 6개 rethrow
커밋 3: 호출부 (나) 2건 opt-out
```

편입 없이 rethrow 만 하면:
```
업무 쓰기 커밋 → 감사 실패 → 5xx → 클라 재시도 → 중복 생성
→ 감사에는 없고 데이터에는 둘 있음
```
지금은 200 이라 안 보이던 문제가 5xx 로 바꾸는 순간 열린다.
D1c 의 `deleteMany` 와 동일 구조 — 뒤 커밋이 활성화하는 위험을 앞 커밋이 닫는다.

### ⚠️ 커밋 1 의 규모 — 작지 않다

| 헬퍼 | 호출 | 클라이언트 주입 | 필요 작업 |
|---|---|---|---|
| `createActivityLog` | 40 | ✅ `txClient` 파라미터 존재 | 호출부에서 넘기기만 |
| `createActivityLogServer` | 10 | ✅ `db` 파라미터 존재 | 호출부에서 `tx` 넘기기 |
| `createAuditLog` | 46 | ❌ **없음** (`db` 직접 import) | **시그니처 변경** |
| `logStateTransition` | 6 | ❌ **없음** | **시그니처 변경** |

- 시그니처 변경 대상 **52/102**
- **41파일은 업무 쓰기 자체가 트랜잭션 밖**이라 트랜잭션을 새로 만들어야 한다

→ 커밋 1 을 문자 그대로 하면 **59파일 · 97 호출 · 트랜잭션 경계 신설 41파일** 이다.
  범위 재단이 필요하다(§4.6).

## 4.6 커밋 1 분할 — 범위 논쟁 접음 (호영님 2026-08-15)

(가) 한정안을 고르면 미분류 33 이 기본값 fail-closed 로 (가) 에 흡수된다:

```
(가) 69 + 미분류 31 = 100 호출
(나) 2                          ← safety/spend/summary · safety-spend
전면안 102 와 차이 2건
```

**2안과 1안이 같은 배치다.** 범위 논쟁을 접고 전면으로 가되 **커밋 1 을 쪼갠다** —
실제 위험은 (가)/(나) 경계가 아니라 **41파일 트랜잭션 신설을 단일 커밋에 담는 것**이다.

```
1a  createAuditLog 시그니처에 tx 파라미터 추가 (optional)
    → 호출부 미변경. tsc 파급 0. 회귀면 0
1b  트랜잭션 보유 18파일 15호출 편입 + 팬텀 10건 교정
1c  트랜잭션 미보유 41파일 — 경계 신설. 파일 그룹으로 재분할
```

1a 를 optional 로 먼저 내면 1b·1c 가 **각각 독립 revert** 가능해진다.

### 📌 정정 — 주입 지점이 없던 것은 `createAuditLog` 하나뿐

`logStateTransition` 은 **이미** `txClient?: Prisma.TransactionClient` 를 받고
`createActivityLog` 로 전달까지 한다. 앞서 "없음" 으로 적은 것은 **오독**이다.

| 헬퍼 | 호출 | 주입 지점 |
|---|---|---|
| `createActivityLog` | 40 | ✅ `txClient` |
| `createActivityLogServer` | 10 | ✅ `db` 파라미터 |
| `logStateTransition` | 6 | ✅ `txClient` (정정) |
| `createAuditLog` | 46 | 🆕 커밋 1a 에서 신설 |

→ 시그니처 변경 대상은 **52 가 아니라 46**. 1a 의 범위가 그만큼 작다.

## 4.7 🔴 §4.5 실측 정정 (커밋 1b 중 발견)

§4.5 의 "편입 5/102 · 팬텀 10" 은 **틀렸다**. 재측정:

```
              앞 보고      재측정
감사 호출     102          99      ← lib/audit.ts 는 정의부다. 호출부로 셌었다
편입          5            15
팬텀          10           **1**
트랜잭션 밖   —            84      ← 실제 공백은 여기다
```

원인 둘:
1. **인자 스캔 창을 400자로 잘랐다** — 긴 호출의 두 번째 인자 `tx` 를 못 봤다
2. **`createAuditLog` 가 두 개인데 이름으로 뭉쳤다**

| 정의부 | 쓰기 | tx 파라미터 | import 파일 |
|---|---|---|---|
| `lib/audit.ts` | `DataAuditLog` | ✅ **이미 보유** | 23 |
| `lib/audit/audit-logger.ts` | `AuditLog` | 1a 에서 신설 | 20 |

→ 귀속 오류 **4회차**. 앞 3회는 소비자↔정의부였고, 이번은 **동명이인 정의부 2개**다.
  이름이 같으면 같은 함수라고 읽었다.

### 정의부별 실측 (99건)

```
createActivityLog        ← activity-log.ts            40 · tx안 5 · 편입 4
createActivityLogServer  ← api/activity-logs.ts       10 · tx안 0 · 편입 0
createAuditLog           ← audit.ts (DataAuditLog)    18 · tx안 8 · 편입 9
createAuditLog           ← audit/audit-logger.ts      19 · tx안 0 · 편입 0
logStateTransition       ← state-transition-logger     2 · tx안 0 · 편입 0
(import 미확인)                                        10
```

### 함의 — 1b 가 작아지고 1c 가 커진다

- **1b = 팬텀 1건 + 단언 + 롤백 프로브.** 8건은 이미 편입돼 있었다
- **1c = 84건** — 업무 쓰기 자체가 트랜잭션 밖인 경로. 중복 생성 위험은 **여기** 있다

## 4.8 커밋 1b 결과

### 팬텀 1건 교정

`lib/work-queue/work-queue-service.ts:1004` — `$transaction` 콜백 안에서 전역 `db`.
`, tx` 전달로 교정.

### 단언 — `src/__tests__/security/transaction-enrollment.test.ts`

`$transaction` **콜백 형태** 스코프 안의 전역 `db` 참조 = 0. corrupt→RED 실증 포함.

⚠️ **1차 실행이 오탐 2건**을 냈다 — 배열 형태 `db.$transaction([ db.a.update(), ... ])` 를
콜백 형태와 못 갈랐다. Prisma 배치 API 는 전역 클라이언트 연산 배열을 한 트랜잭션으로
실행하므로 거기서 전역 `db` 는 정상이다.

> **corrupt→RED 는 탐지를 증명할 뿐 정밀도를 증명하지 않는다.**
> 오탐 0 실증(배열 형태 케이스)을 같은 테스트에 넣었다.

등급 한계는 파일 상단에 명시했다 — 정적 스캔이고, 헬퍼 경유 간접 경로는 안 보인다.
**편입의 유일한 판정은 런타임 롤백 프로브다.**

### 롤백 프로브 — 편입 실증 (선언 `DECLARATION_1b.json` 🔒)

| | 주입 | 응답 | 수량 | 감사 델타 | 판정 |
|---|---|---|---|---|---|
| 1B-CONTROL | 없음 | 200 | 7→6 | ≥1 | ✅ 경로가 산다 |
| 1B-ROLLBACK | tx 콜백 끝 throw | 500 | **6→6** | **0** | ✅ **편입 확인** |

주입 위치는 감사 쓰기 **뒤**, 커밋 **전**. 감사 행이 업무와 함께 롤백됐다.
복원은 **픽스처 스냅샷 기준**(정합 추론 아님) · 주입 파일 git clean 확인.

## 4.9 `activity-log-stubs.ts` — dead 확정, 분모 정정

importer **0**. 파일 주석 자체가 "이 파일의 함수는 아직 어디에서도 호출되지 않음" 이고
실측이 일치한다(§render-reachability).

```
(가) 100 → 94 활성 + 6 dead
```

스텁이면 rethrow 대상에서 실질적으로 빠진다 — **던질 것이 없다**.
존폐는 별건. 정정 7회차를 미리 막는 쪽으로 분모를 지금 고친다.

## 4.10 1c 분류 — 1c-A / 1c-B (2026-08-15, 구현 0)

"파일 그룹으로 순차" 는 분류 없이 배치를 여는 것이다. 성격이 둘 섞여 있음을 이미
아는데 그대로 쪼개면 **배치마다 후자가 튀어나온다**. 가르는 것 자체를 배치로 했다.

```
트랜잭션 밖 감사 호출  83건
  dead (activity-log-stubs, importer 0)   6
  활성                                    77
    1c-A 업무 쓰기 단일 → 감사 트랙 안    36 / 27파일
    1c-B → §write-atomicity-missing       41 / 27파일
         └ 확정 다단계 27 · 보수 14 (스코프 해석 실패 6 + 해석 불가 심볼 8)
```

### 🛑 커밋 2 범위 = **1c-A 편입 완료분만**

1c-B 경로의 감사 rethrow 는 보류한다 —
**업무 원자성이 없는 경로에 fail-closed 를 얹으면 업무 쓰기 일부만 커밋된 상태에서
5xx 가 나간다. 지금보다 나쁘다.**

### 도출기 교정 — 1차 실행은 변별력이 0 이었다

1차: "헬퍼 호출이 있으면 보수적으로 1c-B" → **45건이 한 바구니**에 몰렸다(1c-A 8건).
2차: 헬퍼를 **전이 해석**(깊이 5)해 실제 업무 쓰기 도달 여부로 판정 → 1c-A 36 / 1c-B 41.

> 보수 기본값은 안전하지만, **보수가 다수가 되면 분류가 아니라 유보**다.
> 확정과 보수를 같은 숫자로 보고하지 않는다.

## 4.11 정정 4회차 — 귀속 규칙 확장 (동명이인 정의부)

> **귀속은 이름이 아니라 정의부 경로로 한다. 동명 심볼은 별개로 센다.**
> 도출기는 **import 원점까지 해석**하고, 못 하면 그 사실을 결과에 명시한다.

| 이름 | 정의부 | 쓰기 | tx 파라미터 | import 파일 |
|---|---|---|---|---|
| `createAuditLog` | `lib/audit.ts` | **DataAuditLog** | ✅ 원래 있었다 | 23 |
| `createAuditLog` | `lib/audit/audit-logger.ts` | **AuditLog** | 1a 에서 신설 | 20 |

🛑 **다음 세션이 `createAuditLog` 를 단일 함수로 읽으면 5회차다.**

### 부수 확인 — 커밋 1a 는 유효했다

1a 가 파라미터를 넣은 것은 `audit-logger.ts` 쪽이고, 그쪽은 **실제로 없었다**
(`export async function createAuditLog(params: AuditLogParams) {`).
`lib/audit.ts` 가 이미 갖고 있던 것과 무관하다 → **1a 유효**.

## 4.12 커밋 1c-A-2 — 🔴 미착수 (변형기 결함 2건 선결)

2회 시도, 2회 전량 복원. 인계: `HANDOFF_audit-integrity-2026-08-15.md`

| 시도 | 결과 | 잡은 것 |
|---|---|---|
| 1차 (게이트 0) | 6파일 구문 파손. tsc 27**→21** | 사람이 분포를 의심 |
| 2차 (게이트 3중) | 3파일 신규 오류 + 11파일 소멸 | **게이트3** |

변형기 `apps/web/_enroll_tx.cjs` 결함:
1. **복원 누락 — 원인 미확정.** 게이트3 실패 시 3파일이 복원되지 않았다.
   복원 검증(바이트 대조)이 없어 조용히 남았다
2. **`{}` 가드 과도.** `between` 에 중괄호가 하나만 있어도 건너뛴다 → 10파일 "대상 없음"

🛑 잔여 3파일은 게이트1·2 를 통과하고 기대출력과 바이트 일치했으나 **채택하지 않았다** —
셋 다 **같은 변형기의 산물**이고 독립 근거가 아니다. 게이트3 은 그 배치에 RED 를 냈다.

## 5. 롤백 경로

```
커밋 1a: createAuditLog tx 파라미터 (optional)   ← 호출부 미변경
커밋 1b: 트랜잭션 보유 18파일 편입 + 팬텀 10 교정
커밋 1c: 트랜잭션 미보유 41파일 경계 신설         ← 파일 그룹 재분할
커밋 2 : 정의부 6개 rethrow
커밋 3 : (나) opt-out                             ← D3 완료 후로 이관
```

revert 순서는 **역순 강제**(3 → 2 → 1c → 1b → 1a).
커밋 1a 만 되돌리면 1b·1c 의 호출부가 존재하지 않는 파라미터를 넘긴다.

### ✅ 배포 트레이드오프 — 앞선 서술을 정정한다

"감사 DB 장애 시 (가) 100경로 동시 5xx" 는 **실제 위험이 아니다**(2026-08-15 정정).
감사 테이블은 업무 쓰기와 **같은 DB** 다 — DB 가 죽으면 업무 쓰기가 **먼저** 죽는다.

감사만 실패하는 경우는 **스키마 드리프트 · 제약 위반 · enum 값 부재**이고,
그건 이 트랙이 방금 실증한 형태다:

> `ActivityType` 에 `ITEM_*`·`CADENCE_*` **12값이 없어서** 감사가 0건인데 200 이 나가고 있었다.

> **fail-closed 는 새 위험을 만드는 게 아니라 기존 위험을 보이게 만든다.**

## 6. 이 설계안이 닫지 않는 것

- 재시도 큐 (별도 카드)
- ~~`logCTAExecution` 존폐~~ → **삭제 가능 확인** (2026-08-15):
  정적 호출부 0 · 동적/문자열 참조 0 (유일 히트는 `lib/compare-workspace/00-workspace-ia.ts:133`
  의 **설명 문자열** `"logStateTransition / logCTAExecution"` — 호출 아님).
  `safety/spend`·`products/safety` 삭제와 같은 절차로 진행 가능
- 미분류 33건 최종 귀속 (경계 수동 적용)
- 감사 테이블 자체의 가용성·이중화

## 7. 관계

- §audit-integrity-200-mask — 확진판
- §runtime-beats-static-gate — tsc 신규 0 이 새 사례
- §drift-track-scoping — D3 전에 이 수정이 끝나야 한다
