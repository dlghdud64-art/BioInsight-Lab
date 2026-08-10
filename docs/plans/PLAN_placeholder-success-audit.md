# §placeholder-success-audit — 저장하지 않고 성공을 반환하는 표면 전수

작성: 2026-08-10
상태: 1건 처리 완료 / 2건 대기 / 전수 조사 미착수
발원: §enforcement-handle-close-sweep 배치11

---

## 0. 정의 — 세는 방식 (계수 고정)

배치별로 숫자가 흔들리지 않도록 **검출 조건을 먼저 고정한다.**

**검출 조건 (AND):**

1. 같은 함수(라우트 핸들러 또는 핸들러) 안에 다음 계열 주석이 있다:
   `TODO: Implement` · `TODO: Save` · `TODO: Delete` · `TODO: Persist`
   (대소문자 무시, `// TODO:` / `/* TODO:` 양쪽)
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
| `vendor/requests/[id]/respond` | 구매자는 회신을 못 받고, 벤더는 답했다고 알거나 원인 모를 실패만 본다. 양쪽 다 침묵의 원인을 모른다 | **불가** | sweep 에서 분리, 즉시 처리 (완료) |
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

⚠️ 이 라우트는 이제 `enforceAction` 을 쓰지 않는 POST 라우트다 →
§enforcement-coverage-gap E7 1단계에서 목록에 잡힐 것이다. **정상이다**
(501 고정 응답이라 집행할 mutation 이 없다). 분류는 E7 계수 이후.

## 4. 대기 — templates 2건

sweep 종료 후 §2 의 3단계를 동일하게 적용한다.

- `templates` POST — `TODO: Save to database`, `template-${Date.now()}` 가짜 id 반환
- `templates/[id]` DELETE — `TODO: Delete from database`

현재는 §enforcement-handle-close-sweep 배치11 에서 `fail()` 로 닫고 사유 주석만
남긴 상태다. **결함은 존치 중.**

## 5. 전수 조사 (미착수)

§0 의 검출 조건으로 `src/app/api/**` 전수. 배치12 에서도 추가 검출이 예상된다.
조사 결과는 이 문서 §6 에 표로 누적한다.
