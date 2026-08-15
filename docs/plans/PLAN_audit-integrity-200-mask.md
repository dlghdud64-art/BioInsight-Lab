# §audit-integrity-200-mask — 감사 기록 실패가 성공 응답 뒤로 사라진다

- **Status:** 🔴 실패 주입 확진 (2026-08-15) · 선언 `DECLARATION_D4.json` 🔒
- **축:** 격리(tenant)가 아니라 **감사 무결성**. GMP/ALCOA+ 축에서 별도 카드.
- **호영님 판단:** D3 보다 **먼저**. D3 가 8경로를 살리면, 죽어 있어서 문제가 안 되던
  경로들이 **감사 공백을 만들면서 200 을 반환하기 시작한다**. D1c 에서 `deleteMany` 를
  먼저 트랜잭션화한 것과 같은 구조 — **드리프트 수정이 잠재 위험을 활성화한다.**

---

## 0. 결론

**실패 주입 2/2 확진.** 감사 쓰기가 실패해도 라우트는 `200 {"success":true}` 를 반환한다.

봉투에 `logged` 라고 적혀 있는데 기록이 0이면 **부재보다 나쁘다** — 없는 걸 있다고 선언한 것이다.

## 1. 모집단 — 헬퍼 이름에서 출발하지 않았다

`createActivityLogServer`·`logStateTransition` 를 먼저 정하고 grep 하면 **세 번째 이름을 못 본다**
(enum 스윕 조건 2 와 같은 이유). 수집 순서:

```
1차: 반환 Promise 가 버려지는 호출 전역 수집   → 217건  (감사 여부 무관, 형태만)
2차: 그중 DB 쓰기에 도달                      →  18건
3차: 감사·규제 기록 축으로 분류                →  16건  (심각도 축, 모집단 축 아님)
```

분모: 스캔파일 2003 · 함수정의 6647.

### ① 호출부 미-await — 18건 / 16 감사축

| | 호출 | 위치 | 쓰기 |
|---|---|---|---|
| 감사 | `createActivityLogServer` | `admin/quotes/[id]/items:111` · `orders:288` · `quotes:323` · `quotes/[id]:72,510,630` · `quotes/[id]/status:194` · `quotes/[id]/versions:136` · `shared-lists:222` | ActivityLog |
| 감사 | `createAuditLog` | `organizations/[id]/sso:171` · `quotes/[id]:532,646` | AuditLog · DataAuditLog |
| 감사 | `logStateTransition` | `orders:309` · `quotes/[id]/status:215` | ActivityLog |
| 감사 | `syncCompareToWorkQueue` | `dashboard/stats:634` | AiActionItem · ActivityLog |
| 감사 | `logBriefInjectionAudit` | `lib/ai/operational-brief-narrative:199` | AuditLog · DataAuditLog |
| — | `runCatalogIngest` · `processExtractionAsync` | `cron/catalog-ingest:43` · `sds/[id]/extract:97` | 비감사 |

### ② 정의부 삼키는 catch — **감사 헬퍼 6개가 전부 삼킨다**

```
createActivityLog        lib/activity-log.ts              → console.warn 후 계속
createActivityLog        lib/api/activity-logs.ts         → console.error 후 return null
createActivityLogServer  lib/api/activity-logs.ts         → console.error 후 return null
createAuditLog           lib/audit/audit-logger.ts        → console.error 후 계속
logStateTransition       lib/operations/state-transition-logger.ts → console.warn
logCTAExecution          lib/operations/state-transition-logger.ts → console.warn
```

🛑 **이게 ① 보다 무겁다.** `await` 를 붙여도 결과가 같다 — 헬퍼가 내부에서 삼키고
`null` 을 반환하므로 **호출부가 실패를 알 방법이 없다**.

> **감사 기록 실패는 어느 경로로도 응답에 반영되지 않는다.**

## 2. 판정 — 실패 주입으로만

정상 경로에서는 안 보인다(D1b P5 확정). 주입 방식·대상·복원을 선언에 박고 잠갔다.

| 주입 | 가설 | 위치 | 응답 | 판정 |
|---|---|---|---|---|
| INJ-1 | ②형태 — 내부 catch 가 삼킴 | `try` 블록 **안쪽** | **200** | 🔴 확진 |
| INJ-2 | ①형태 — 내부 catch **우회**, 호출부 `.catch()` 가 삼킴 | 함수 본문 첫 줄 | **200** | 🔴 확진 |

주입 1건씩 · 복원 `git checkout` 후 `git status` 잔여 0 확인 · 정온 하한 1890ms · 선언 밖 변경 0.

### 🔑 델타 +1 이 소실을 가렸다 — ② 비대칭의 실증

주입 중에도 파생 델타는 **`ActivityLog:6→7`(+1)** 이었다. 실패한 것은
`createActivityLogServer` 이고, **주입하지 않은** `logStateTransition` 이 1건을 남겼기 때문이다.

```
D1b P5 (정상)   ActivityLog 3→5   (+2, 두 헬퍼 모두 착지)
D4 주입         ActivityLog 6→7   (+1, 한 건 소실)
```

> **델타가 0 이 아니어도 감사 기록은 소실된다.**
> "델타 ≥1 = 완전 손실 배제일 뿐 해소가 아니다" 가 수치로 확인됐다.
> +1 과 +2 의 차이는 **정상 기준선을 알아야만** 보인다.

## 3. 수집기 자기검증

| 수집기 | 알려진 건 | 결과 |
|---|---|---|
| ① | `quotes/[id]/status` 2건 | **2/2 HIT** (1차 1/2 → 파서 결함 교정 후) |
| ② | `cadence-governance` 기전 | **HIT** (정의부 기준) |

🔴 **① 1차 미스 원인:** `function f(params: { ... })` 에서 **파라미터 타입 리터럴을
함수 본문으로** 잡았다. 본문에 쓰기가 없으니 2차에서 탈락했다.

🔴 **② 자기검증 자체가 틀렸다:** `cadence` 라는 **소비자 파일명**으로 찾아 1차 MISS.
삼키는 catch 는 **정의부**(`lib/api/activity-logs.ts`)에 있다.
→ 아래 귀속 규칙을 **자기검증 안에서 위반**했다. 규칙을 쓰는 배치에서 같은 실수가 났다.

## 4. 미해소 — 이 배치가 닫지 않는 것

- **수정 안 함.** 확진만 했다. 수정 방향(감사 실패를 응답에 반영할지, 별도 큐로 뺄지)은 설계 판단
- **①·② 외 형태** — 예: 감사 쓰기를 아예 호출하지 않는 경로. 이 수집기로는 안 보인다
- **비-감사 미-await 2건**(`runCatalogIngest`·`processExtractionAsync`) — 축이 다르다
- ②의 181건 중 **감사축 146건** 은 헬퍼 6개 외에도 넓게 퍼져 있다. 개별 판정 미수행

## 5. D3 와의 순서 — 근거

D3 는 8경로를 살린다. 그 경로들이 살아나는 순간 **감사 공백을 만들면서 200 을 반환**한다.
지금은 500 이라 도달하지 못해 문제가 드러나지 않을 뿐이다.

> D1c 의 `deleteMany` 와 **같은 구조**: 드리프트 수정이 잠재 위험을 활성화한다.
> 그래서 D4 가 D3 보다 먼저다.

## 5.5 수정 설계안 — §audit-integrity-fix (2026-08-15)

호영님 방향: **(다) 경로별 분리. 단 선행 수정 1건이 갈래보다 먼저다.**

```
1단계: 헬퍼 6개 rethrow — 실패가 호출부에 도달하게만 한다
2단계: 호출부 정책 — (가) fail-closed / (나) 가시화
```

(가) 경계 = **"기록이 없으면 행위를 재구성할 수 없느냐"** (규제 항목 여부 아님).
상태 전이 · 재고 이동 · 권한 변경 · SDS·제품 등록·변경 · 외부 발송.

🔴 tsc 파급 **실측 0건** (6/6 적용, 27→27) — rethrow 는 타입에 안 보인다.
정적 게이트가 0의 보호를 준다는 뜻이고, **실패 주입이 유일한 게이트**다.

## 6. 관계

- §drift-masks-isolation §1.9 — 200 위장. 이 카드가 그 축의 전수·확진판
- §drift-track-scoping — D3 순서 근거
- §drift-pair-rederivation §7 — 도출기 채택 기준(corrupt 단독 불가)
