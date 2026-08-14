# §placeholder-success-audit — 저장하지 않고 성공을 반환하는 표면 전수

작성: 2026-08-10
상태: 1건 처리 완료 / **확인된 4건 이상 존치** / 전수 조사 미착수
발원: §enforcement-handle-close-sweep 배치11

---

## 0. 정의 — **정의 기반 계수 폐기** (호영님 2026-08-10)

⚠️ **최초 방침(문자열 표지로 계수 고정)은 폐기됐다.** 첫 적용에서 바로 깨졌기 때문이다
(`dashboard/layout` 의 한국어 주석). 원인은 표지 목록이 짧아서가 아니라
**스텁이 자연어 주석에 살고 자연어는 열거가 끝나지 않기 때문**이다. 표지를 늘려도
다음에 또 깨진다.

**바뀐 규칙:**

- 이 문서의 모든 숫자는 **하한(lower bound)** 으로 표기한다. "5건" 이 아니라 **"확인된 5건 이상"**.
- 아래 표지 목록은 **탐색 보조**로만 쓴다. **계수의 근거로 쓰지 않는다.**
- 확장 전후 숫자를 비교하지 않는다.
- 진짜 계수가 필요해지면 정규식이 아니라 **"쓰기를 표방하는 라우트가 실제로 쓰는가"**
  를 검증하는 sentinel 이어야 한다. **지금 만들지 않는다** — E7 숫자를 본 뒤 함께 설계.

### 탐색 보조 표지 (계수 근거 아님)

**탐색 조건 (AND) — 후보를 찾는 용도:**

1. 같은 함수(라우트 핸들러) 안에 **미구현 표지**가 있다:
   - 영문: `TODO: Implement` · `TODO: Save` · `TODO: Delete` · `TODO: Persist`
     (대소문자 무시, `// TODO:` / `/* TODO:` 양쪽)
   - **한국어**: `임시로` · `실제로는 ... 해야` · `Mock response` · `더미`

   ⚠️ **2026-08-10 정의 확장.** 최초 정의는 `TODO:` 영문만 셌다. 배치12 에서
   `dashboard/layout` POST 가 `// 임시로 성공 응답만 반환` 이라 **최초 정의로는
   검출되지 않았다**(육안으로 잡혔다). 계수가 흔들리지 않으려면 표지 목록에
   한국어 관용구가 반드시 들어가야 한다. 이 확장 이전 숫자와는 직접 비교 불가.
2. **같은 함수 안에** 성공 신호가 있다:
   `success: true` · 2xx `NextResponse.json(...)` 로 생성 객체를 반환 · `{ ok: true }`
3. 그 함수 안에 `db.*.{create|update|upsert|delete|createMany|updateMany|deleteMany}`
   호출이 **하나도 없다**.

**세지 않는 것 (오검출 배제):**

- 조건부 쓰기가 있는데 특정 분기에서만 쓰기가 없는 경우 → 별건(허위 audit 문제).
  이건 §enforcement-handle-close-sweep 의 complete/fail 분기 기준으로 이미 다룬다.
- 외부 API 호출로 부작용이 나가는 경우(결제·메일) → DB 쓰기가 없어도 실제 효과가 있다.
  별도 분류: **외부 부작용형**. 계수는 따로 낸다.
- 읽기 전용 라우트의 `success: true` → 쓰기를 주장하지 않으므로 해당 없음.

**단위:** route 파일이 아니라 **핸들러(메서드) 단위**로 센다.
한 파일에 POST 스텁과 정상 GET 이 함께 있으면 1건이다.

## 1. 피해 성격에 따른 분리 (호영님 2026-08-10 판단)

같은 "placeholder success" 라도 **자기교정 여부**가 다르면 처리 순위가 다르다.

| route | 피해 | 자기교정 | 처리 |
|---|---|---|---|
| `vendor/requests/[id]/respond` | **양방향 정보 단절** — 벤더는 재시도 수단이 없고 구매자는 요청 도달 여부조차 모른다 | 불가 | 분리 → 501 → **경로 폐기**(§3-4) |
| `templates` POST | 가짜 id 로 목록에 그려질 수 있으나 새로고침하면 사라진다 | 가능 | 이 트랙에서 sweep 종료 후 |
| `templates/[id]` DELETE | 지웠다고 표시되나 새로고침하면 살아 있다 | 가능 | 동일 |

기준: **자기 데이터를 다음 로드에서 스스로 확인할 수 있으면 자기교정 가능**,
두 당사자 사이의 침묵이면 불가.

## 2. 표준 처리 3단계

1. **표면 미생성** — `disabled` 가 아니라 아예 만들지 않는다.
   눌러서 성공(또는 실패)을 보는 경로가 존재하면 안 된다.
2. **성공 반환 제거** — 라우트가 501 + 미구현 코드로 응답한다.
   UI 차단만으로는 부족하다(모바일·외부 호출자).
3. **sentinel** — `success: true` 부정 단언 + 표면 미생성 단언 + corrupt→RED 실증.

## 3. 처리 완료 — `vendor/requests/[id]/respond` (2026-08-10)

### 3-1. 실측 보정 — 원 보고가 부정확했다

배치11 보고에서 "저장 없이 `success: true` 를 반환한다" 고 적었으나, 실제로는
**항상 500 이었다.**

- 라우트 zod 스키마: `z.object({ items: z.record(...) })`
- UI 가 보내는 본문: `{ responses: [...] }`
- → `respondSchema.parse(body)` 가 ZodError → catch → 500 "Failed to submit response"

즉 성공 응답조차 도달하지 않았고, 벤더는 "전송 실패" 토스트를 봤다.
피해 성격이 "조용한 성공" 이 아니라 **"원인 불명의 실패"** 다.
구매자가 회신을 못 받는다는 결과는 같지만, 벤더 쪽은 침묵이 아니라 실패를 본다.

### 3-2. 더 중요한 실측 — 동작하는 경로가 따로 있다

`/api/vendor-requests/[token]/response` 는 **정상 구현돼 있다**:
`quoteVendorResponseItem.upsert` + `quoteVendorRequest.update` (트랜잭션).
`src/app/vendor/[token]/page.tsx` 가 이걸 쓴다.

즉 벤더 회신 기능 자체는 존재하며, **로그인 포털 경로(`/vendor/requests/[id]`)만
토큰 경로와 통합되지 않은 채 남아 있었다.** §vendor-request-respond 는
"처음부터 구현" 이 아니라 "포털 경로를 토큰 경로에 통합" 이다 — 규모가 훨씬 작다.

### 3-3. 적용

- `src/app/vendor/requests/[id]/page.tsx` — `QuoteForm` 렌더 제거(미생성),
  `handleQuoteSubmit` 제거. 요청 품목은 계속 읽을 수 있게 남기고,
  "이 화면에서는 아직 견적을 회신할 수 없습니다 / 요청 메일의 회신 링크를
  사용해 주세요" 안내를 둔다(빈 화면 금지, 실제 경로 지시).
- `src/app/api/vendor/requests/[id]/respond/route.ts` — 501 +
  `VENDOR_RESPOND_NOT_IMPLEMENTED`. `success: true` 제거. 스키마·enforceAction 제거
  (미구현 엔드포인트가 lock 을 잡을 이유가 없다).
- `src/__tests__/ops/vendor-respond-not-implemented.test.ts` — V1~V4.
  corrupt→RED 실증: 성공 반환 복원 + QuoteForm 재삽입 시 3 assertion RED.

### 3-4. ⚠️ 후속 — 501 이 아니라 **삭제**로 종결됐다 (2026-08-10, 같은 날)

위 501 처리 직후 실측에서 **같은 포털 경로의 detail GET 도 하드코딩 mock** 임이
드러났다(인증 없이 실재하지 않는 조직명을 렌더). 호영님 결정으로 포털 RFQ 경로
전체를 폐기했다 — 501 로 남기면 다음 사람이 "구현하면 되겠네" 로 읽는다.

- 라우트·화면·컴포넌트 삭제, 진입 경로 제거
- 이 sentinel(`vendor-respond-not-implemented.test.ts`)은 폐기 sentinel
  (`vendor-portal-rfq-retired.test.ts`)로 **대체**됐다
- 상세: `PLAN_route-duplication.md` §1

**분리 근거도 정정한다.** 처음에 "자기교정 불가" 라고 적었으나 실측 후 정확한 근거는
**양방향 정보 단절**이다 — 벤더는 재시도할 수단이 없고 구매자는 요청이 도달했는지조차
모른다. 원래 근거는 틀렸고 결론만 우연히 같았다(호영님 2026-08-10).

## 4. 대기 — templates 2건

sweep 종료 후 §2 의 3단계를 동일하게 적용한다.

- `templates` POST — `TODO: Save to database`, `template-${Date.now()}` 가짜 id 반환
- `templates/[id]` DELETE — `TODO: Delete from database`

현재는 §enforcement-handle-close-sweep 배치11 에서 `fail()` 로 닫고 사유 주석만
남긴 상태다. **결함은 존치 중.**

## 4-1. 배치12 신규 검출 2건 (2026-08-10)

| route | 실태 | 자기교정 |
|---|---|---|
| `dashboard/layout` POST | `// 임시로 성공 응답만 반환` — 레이아웃을 저장하지 않고 `success: true` | 가능 (다음 로드에서 레이아웃이 안 돌아옴) |
| `export/presets` POST | `TODO: Save to database` — `preset-${Date.now()}` 가짜 id 반환 | 가능 (`templates` POST 와 동일 패턴) |

둘 다 sweep 에서는 `fail()` 로 닫고 사유 주석만 남겼다. **결함 존치.**

**확인된 5건 이상** — 처리 완료 1(`vendor/requests/[id]/respond`), 존치 4
(`templates` POST · `templates/[id]` DELETE · `dashboard/layout` POST ·
`export/presets` POST). 존치 4건은 전부 자기교정 가능 클래스다(§1 기준).

`export/presets` 는 GET 쪽에도 `TODO: Fetch from database` 가 있다 — 읽기라
이 정의의 검출 대상은 아니지만 같은 미구현 세트다.

## 5. 전수 조사 — **동결** (호영님 2026-08-12, 실사용자 트래픽 이후)

§0 의 검출 조건으로 `src/app/api/**` 전수. 배치12 에서도 추가 검출이 예상된다.
조사 결과는 이 문서 §6 에 표로 누적한다.

---

## ⚠️ 재개 시 **재정렬 지시** — 건별이 아니라 **경로별로 묶는다** (호영님 2026-08-12)

> **플레이스홀더의 등급은 그 자체가 아니라 그 아래에 무엇이 걸려 있는지가 정한다.**

이 트랙은 전수 분류하면서 **각 건을 홀로 채점**했다. 그래서
`entityCapabilities: []` 가 낮게 매겨졌다 — 배치 10 에서 "미완성 기능" 으로 분류하고
TODO 로 넘겼다.

**지금 보니 그것은 테넌트 격리 폴백의 마지막 관문이다**
(§tenant-isolation-placeholder). 같은 코드, 같은 문자열, **다른 무게** —
바뀐 것은 그 아래에 무엇이 있는지 알게 된 것뿐이다.

**규칙:**
> 같은 요청 경로에 플레이스홀더가 둘 이상 겹치면 등급은 **합산이 아니라 곱**이다.
> 하나가 통과시키고 다른 하나가 판정하지 않으면 **게이트 전체가 사라진다.**

**재개 시 할 일:** 동결해 둔 전수 목록을 **경로별로 다시 묶는다.**
건별 등급이 아니라 **"같은 요청 경로에 몇 개가 겹치는지"** 로 재정렬한다.
⚠️ 이것은 **새 실측이 아니라 이미 가진 목록의 재정렬**이다.

---

## 5. 새 형태 — **팬텀 파라미터** (2026-08-14, §tenant-isolation A3 #12 실물)

지금까지 이 카드가 다룬 것은 "저장하지 않고 성공을 반환"이었다. 여기 **다른 형태**가 있다.

```ts
// src/lib/api/organizations.ts (교정 전)
export async function getOrganizationById(id: string, userId?: string) {
  return await db.organization.findUnique({ where: { id }, include: { members: ... } });
  //                                                ↑ userId 를 받아놓고 **한 번도 쓰지 않는다**
}
```

호출부는 이렇게 읽힌다:

```ts
const organization = await getOrganizationById(id, session.user.id);  // ← 스코프된 것처럼 보인다
```

**실측**: 조직 A 사용자(RESEARCHER, B 비멤버) → `GET /api/organizations/{B}` → **200 +
B 조직 객체 + 멤버 명부(이름·이메일)**.

### 왜 별도로 기록하는가

검사 **부재**와 성격이 다르다.

| 형태 | 리뷰에서 보이는가 |
|---|---|
| 검사 부재 (work-queue 4건 — 쿼리 파라미터 무검증) | 보인다. 검사가 없으니 없다고 읽힌다 |
| **팬텀 파라미터** (이 건) | **안 보인다.** 호출부가 `session.user.id` 를 넘기므로 스코프된 것으로 읽힌다 |

수동 분류 406건도 이것을 놓쳤다. 잡은 것은 §tenant-isolation A4 단언이다
(헬퍼 본문을 인라인해 마커를 찾으므로 "파라미터를 받았다"가 아니라 "쓰였다"를 본다).

### 규칙

> **인자를 받아놓고 쓰지 않는 함수는 그 인자가 판정에 쓰인다는 거짓 신호를 호출부에 준다.**
> 권한·스코프 관련 인자는 **쓰거나, 받지 않거나** 둘 중 하나여야 한다.

교정: `userId` 를 실제 멤버십 판정에 사용하고, 비멤버는 `forbidden` 으로 갈라
호출부가 403/404 를 구분하게 했다. 호출부는 1곳(`api/organizations/[id]` GET)이며
전수 확인했다 — 다른 노출 경로 없음.
