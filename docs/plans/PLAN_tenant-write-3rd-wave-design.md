# §tenant-isolation 4-3 3차 설계안 — 쓰기 org 축 잔여 5건

- **Status:** 설계안 (2026-08-15) · **승인 대기, 미착수**
- **입력:** 1차 잔여에서 확정된 교훈 — **비용은 바디가 아니라 대조군을 착지 가능한 상태까지
  끌어올리는 것**. 따라서 아래 설계는 "바디 규격"이 아니라 **선결 상태**를 축으로 짰다.

---

## 0. 🔴 **유출 확정** — 실측 완료 (2026-08-15). 분류 이동: "확실한 수확" → **첫 쓰기 유출**

설계를 위해 소스를 읽다가 나왔고, **착수 전 실측으로 확정**됐다.

```ts
// src/app/api/protocol/bom/route.ts
const { title, reagents, organizationId, experimentRounds } = body;   // ← 바디에서 org 수령
...
const quote = await db.quote.create({
  data: { userId: session.user.id, organizationId, title, ... },      // ← 검증 없이 그대로 기입
});
```

**클라이언트가 보낸 `organizationId` 가 멤버십 검증 없이 `Quote` 에 기입된다.**
삭제한 `safety/spend`·`products/safety` 와 **같은 형태이되 쓰기 쪽**이다.

- 읽기 유출은 *남의 것을 보는* 것이고, 이것은 **남의 조직에 내 행을 심는** 것이다
- 성립하면 타 조직 견적 목록에 비멤버가 만든 행이 나타난다
- §unvalidated-create 와 다르다 — 저쪽은 아무 바디나 행을 만드는 것, 이쪽은 **귀속을 조작**한다

### 실측 결과 (row 판정)

| 프로브 | 결과 |
|---|---|
| 교차 (A 세션 · orgB 비멤버 · 바디에 `organizationId: orgB`) | **200 · Quote 생성 · `organizationId = orgB`** → 🔴 **유출 확정** |
| 대조 (`organizationId` 미전송 = 정상 호출부 형태) | 200 · Quote 생성 · `organizationId: null` → §org-attribution-missing |

호출부 2곳(`app/protocol/bom/page.tsx:322` · `components/protocol/protocol-upload.tsx:148`)은
**둘 다 `organizationId` 를 보내지 않는다.** 즉 이 바디 필드는 **정상 사용처가 없고
공격자만 쓰는 경로**다 → 수정 형태는 **파라미터 제거 + 세션 멤버십 도출**(work-queue 와 동일).

복원 완료(Quote 2 + QuoteListItem 삭제), 역할 원복 확인.
**재판단 트리거 발동 — 수정 배치가 나머지 4건보다 앞선다.**

---

## 1. 5건 분해 (호영님 3분류)

### ① 확실한 수확 — 드리프트 무관, 완전 판정 가능 (1건, `protocol/bom` 은 §0 으로 이동)

| 라우트 | 선결 상태 | 교차 벡터 |
|---|---|---|
| `POST /api/ingestion` | 없음 — 바디만 (`sourceType`∈EMAIL\|ATTACHMENT\|UPLOAD\|SYSTEM, `rawText`) | org 는 세션 멤버십 도출(`organizationMembers[0]`) → 교차 벡터는 **바디 주입 시도 + 도출 결과 대조** |

`ingestion` 은 **선결 상태 0**이다.

### ② 반쪽 판정 — 스코프는 지금, 착지는 드리프트 해소 후 (2건)

| 라우트 | 상태 |
|---|---|
| `POST /api/work-queue/cadence-governance` | 배치 2에서 `getCallerOrganizationId(session)` 주입 완료 (line 58) |
| `POST /api/work-queue/bottleneck-remediation` | 동일 (line 78) |

**순환 의존 해소** — §drift 규칙("격리 검증 후 드리프트 수정")과 "드리프트가 검증을 막는다"의 매듭:

두 라우트 모두 **org 도출이 서비스 계층 호출보다 앞**이다(`getCallerOrganizationId` → `enforceAction` →
`query*Data`). 즉 **교차 벡터가 enum 드리프트에 도달하기 전에 판정된다.**

> **해소 조건을 §2.5 형태로 둘로 쪼갠다:**
> - **지금 측정**: 교차 차단 — 클라가 org 를 지정할 수단이 있는지(바디/쿼리) + 세션 도출값이 쓰이는지
> - **드리프트 해소 후**: 대조군 착지 — 200 + 실제 쓰기
>
> 반쪽 판정을 **반쪽으로 기록하고 전진**한다. 분수는 `0.5/1` 이 아니라
> **"교차 판정 완료 / 착지 미판정"** 두 칸으로 적는다.

### ③ 별도 취급 — 측정 문제가 아니라 스코프 부재 후보 (1건)

`POST /api/work-queue/ops-sync` → §2 참조.

---

## 2. 선결 상태 픽스처 요건 (라우트별)

| 라우트 | 필요한 선결 상태 | 재사용 |
|---|---|---|
| `protocol/bom` | 없음 | — |
| `ingestion` | 없음 (단 org 도출을 보려면 A 가 **조직 멤버**여야 함 — 현 픽스처 충족) | 기존 |
| `cadence-governance` POST | 교차 판정: 없음 / 착지: **ActivityType enum 드리프트 해소** | — |
| `bottleneck-remediation` POST | 동일 | — |
| `ops-sync` | 없음 (라우트가 바디를 무시하고 호출자 엔티티를 동기화) | 기존 |

**1차 잔여에서 막혔던 유형과의 대비** — `bulk-po`(선택된 회신 보유 견적) ·
`organizations`(요금제 한도) 같은 **업무 상태 선결**이 3차 5건에는 **없다.**
그래서 3차는 1차 잔여보다 착지 확률이 높다.

🛑 **plan 한도 우회를 위한 픽스처 조직 plan 조작은 이번에도 하지 않는다**(승인 보류 유지) —
entitlement 판정을 조용히 바꾸는 오염 축이며 역할 승격과 같은 형태다.

---

## 3. `ops-sync` 판정 — **별건**, §unvalidated-create 아님

### 실측 사실 (2단계)

```
POST /api/work-queue/ops-sync  body:{"__invalid_probe__":true}  → 200 {"synced":1}
생성: AiActionItem { organizationId: null, userId: 호출자 } + ActivityLog
```

### 코드 확인

- 라우트의 모든 조회가 **`userId` 로 묶여 있다** — `quote.findMany({where:{userId}})`,
  `order.findMany({where:{userId}})`, `inventoryRestock.findMany({where:{inventory:{userId}}})`
  → **org 축 유출 위험 없음**
- `createWorkItem(params)` 은 `organizationId` 를 **받을 수 있는데**(service line 152·166)
  ops-sync 는 **한 번도 넘기지 않는다** → `organizationId: undefined` → null

### 판정

**§unvalidated-create 계열이 아니다.** 저쪽의 벡터는 *임의 바디*인데, ops-sync 는
**바디를 아예 읽지 않는다**(무시하고 호출자 엔티티를 동기화). 200 은 무검증 생성이 아니라
정상 동작이다.

**진짜 결함은 다른 축이다 — 귀속 부재.**

> **userId 축 라우트가 org 축 모델(`AiActionItem.organizationId`)에 행을 만들면서
> 귀속을 비워 둔다.**

결과: ① 조직 단위 집계·대시보드가 이 행들을 **못 본다**(조직 필터로 조회되지 않음),
② 누구 조직 것도 아닌 행이 쌓인다, ③ 나중에 org 필터를 강화하면 **조용히 유실**된다.

**제안: `§org-attribution-missing` 신설** — 테넌트 유출 축이 아니라 **데이터 귀속 축**.
§global-catalog-write-authz(무결성 축)·§scopekey-axis-unmeasured(사용자 축)와 같은 계열의
"A트랙이 안 닫는 축" 목록에 들어간다.

---

## 4. A트랙 종료 기준안 (실측한 쪽이 내는 안)

3차가 끝나면 남는 것은 **① 판정 불가(드리프트 잠김) ② 판정 불가(대조군 미통과)
③ 미측정 축(scopeKey 등)** 세 종류다. 각각 다른 처분을 제안한다.

### 제안하는 종료 조건

**A트랙은 "org 축 유출 0 실증 + 잔여 전건이 명시적으로 이관됨" 으로 닫는다.**
잔여 0 을 요구하지 않는다 — 그러면 드리프트 트랙이 선결이 되어 순환한다.

| 잔여 종류 | 처분 | 이관처 | 조건 |
|---|---|---|---|
| **드리프트 잠김** (대조군이 500) | §2.5 조건부로 이관 | §drift-masks-isolation | 각 경로에 **"해소 시 대조군 착지 확인"** 을 해소 조건으로 박는다. 드리프트 수정 배치가 곧 격리 완결 배치가 된다 |
| **대조군 미통과** (요금제·업무상태) | 픽스처 요건 명시 후 이관 | §tenant-isolation 후속 백로그 | 요건을 **문장으로** 남긴다(예: bulk-po = 선택된 회신 보유 견적). 요건 없이 "미측정"만 적으면 다음 사람이 처음부터 다시 판단한다 |
| **미측정 축** | 별도 카드로 이미 분리 | §scopekey-axis-unmeasured · §global-catalog-write-authz · §org-attribution-missing(신설 제안) | **A트랙 종료 문구에 "이 축들은 닫히지 않았다"를 명시**(이미 §scopekey 에 반영) |

### 닫을 때 반드시 붙는 문장

> **A트랙 GREEN 은 "org 축 격리 회귀 차단 + org 축 실측분 유출 0" 이다.
> 테넌트 격리 완료가 아니다. 닫히지 않은 축: scopeKey · 전역 카탈로그 · 귀속.
> 판정 불가 N건은 드리프트 트랙에 조건부 이관됐으며, 그 트랙이 닫히기 전까지
> org 축도 완결이 아니다.**
>
> **드리프트 조건부 이관 건은 드리프트 수정 시 대조군 착지 확인이 누락되면
> 격리가 미완인 채로 GREEN 이 된다 — 이관은 위임이지 면제가 아니다.**
> (§2.5 를 세운 이유가 이 문장이다)

### 종료 시점 분수 형식 (분모 정의 포함)

```
읽기        99/107   (분모=테넌트 접촉·미들웨어 미커버 GET 전체) · 유출 1건 수정 완료
쓰기 org 축  N/11    (분모=org 축 대상 쓰기 핸들러) · 교차만 판정 M건 별도 표기
이관         드리프트 잠김 X건 · 대조군 미통과 Y건 (요건 문장 동봉)
미측정 축     scopeKey / 전역 카탈로그 / 귀속 — 각 카드로 분리
```

---

## 5. 3차 실행 순서 (승인 시)

1. **`protocol/bom`** — org 주입 교차·대조. 선언 파일 선작성, 전역 count + 전 필드 스냅샷, 쓰기 시 즉시 복원
2. **`ingestion`** — 동일 절차
3. **`cadence-governance` · `bottleneck-remediation`** — 교차만 판정, 착지는 반쪽 기록
4. **`ops-sync`** — org 축 판정(예상: 대상 아님) + 귀속 부재 별건 등재

게이트 불변: ④ 정지 시 중단·회신 · 신규 유출은 목록만 · 수정 금지 ·
역할 승격은 라우트 단위 개폐 · 선언 파일은 프로브 전 고정.
