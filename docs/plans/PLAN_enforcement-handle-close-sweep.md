# §enforcement-handle-close-sweep — enforceAction 핸들 누수 전수 교정

작성: 2026-08-10 (operator shell 실측 기록)
상태: **종료 (74 → 0, 2026-08-10)**

---

## 0. 배경

`enforceAction()` 이 돌려주는 `InlineEnforcementHandle` 은 반드시 닫아야 한다.

- `complete({beforeState, afterState})` — audit envelope 기록 + mutation lock 해제
- `fail()` — lock 해제 (audit 미기록)

닫지 않으면 두 가지가 동시에 깨진다.

1. mutation lock 이 `ACTIVE_MUTATION_TTL_MS`(5분)까지 잡혀 같은 키의 재요청이
   `concurrent_mutation` 으로 거부된다.
2. 성공 audit envelope 이 생성되지 않는다.

⚠️ **근거 정정 (2026-08-10, §audit-taxonomy-review 착수 실측).** 위 2번을 sweep 내내
"누가 무엇을 바꿨는지 추적이 불가능하다" 로 서술했는데, 그건 **지속 저장을 전제한
표현**이었고 현재는 성립하지 않는다. `appendAuditEnvelope` 는 모듈 수준 in-memory
배열(`auditStore`, MAX 10000, FIFO)에만 쌓이고 DB 로 가지 않는다 — 람다와 함께 사라진다.
**1번(lock 누수)은 실재했고 그 교정은 온전히 유효하다.** 2번의 실제 성과는
"호출 지점이 올바르게 정렬됐다" 까지이며, 기록이 남으려면 §audit-persistence-gap 이
해결돼야 한다.

2026-08-09 실측: 149 route 중 **74 route** 가 핸들을 닫지 않았다.

## 1. complete / fail 판정 기준

**선언이 아니라 실제 쓰기 발생 여부로 판정한다.**

| 상황 | 판정 |
|---|---|
| DB 쓰기 실재 | `complete({beforeState, afterState})` |
| 읽기 전용 · 추출 전용 · 서명 URL 발급 | `fail()` (lock 만 해제) |
| 쓰기가 조건부 (성공 행 0 가능) | 분기 — 쓰기 0 이면 `fail()` |
| early-return (400/403/404) | `fail()` |
| catch | `enforcement?.fail()` |

조건부의 실제 사례: `purchases/import` 는 행 단위 `create` 라 성공 행이 0 이면
쓰기가 하나도 없다. 무조건 `complete()` 하면 **없던 변경을 기록하는 허위 audit** 이
된다. 반대로 `purchases/import-file` 은 `ImportJob` create/update 가 행 결과와
무관하게 항상 실행되므로 무조건 `complete()` 가 맞다.

## 2. ratchet sentinel

`apps/web/src/__tests__/ops/enforcement-handle-close.test.ts`

- 하드코딩 파일 목록이 아니라 **glob 수집** — 새 route 도 자동으로 걸린다.
- `LEGACY_UNCLOSED` 는 **줄어들기만 한다**. 고쳐진 항목이 목록에 남아 있으면 E2 가 RED.
- E1 신규 누수 0 / E2 ratchet / E3 catch 최소 1 / E4 제품 쓰기 품질 / E6 post-lock 자체 return catch.

### 2-1. ratchet 이 실제로 게이트로 작동한 실증 (2026-08-10, 배치9)

**이 sweep 에서 ratchet 을 세운 값어치를 판단하는 근거이므로 남긴다.**

배치9(datasheet 3 + sds 3) 에서 `LEGACY_UNCLOSED` 6줄을 제거하고 첫 실행했더니
**E1 이 RED** 로 떨어졌다.

```
+ [ "src/app/api/datasheet/extract-pdf/route.ts" ]
```

원인은 편집 유실이었다. 6개 중 `datasheet/extract-pdf` 만 `fail()` 삽입이 실제로
파일에 반영되지 않았는데, 목록에서는 이미 빠져 있었다. 즉 **"고쳤다고 선언했지만
실제로는 안 고쳐진" 상태**였고, sentinel 이 그 불일치를 그대로 드러냈다.

의미:

- ratchet 은 장식이 아니다. 목록 정리(선언)와 코드 수정(실재)이 어긋나면 GREEN 이 안 난다.
- 이 클래스는 **다른 어떤 게이트도 잡지 못한다**. tsc·build 는 통과하고(문법·타입 정상),
  vitest 의 다른 파일도 통과한다. 누락된 것은 "없는 코드" 라서 정적 오류가 아니다.
- 목록을 사람이 손으로 유지하는 구조였다면 stale 한 채로 조용히 넘어갔을 것이다.

## 3. 편집 절차 (강제)

### 3-1. 앵커 유일성 사전 검증

치환 전 `count(anchor) == 1` 을 강제한다. 1이 아니면 멈추고 앵커를 넓힌 뒤 재시도한다.
**조용히 첫 매칭을 쓰지 않는다.**

근거: 2026-08-09 products 배치에서 비고유 앵커로 `complete()` 를 401 응답 앞에
오배치했다. 그때는 TDZ 를 만들어 build 가 잡았지만, **위치만 어긋나고 문법·타입이
성립하는 오배치라면 tsc·build·vitest 를 전부 통과하고 런타임에만 틀린다.**
게이트가 잡아준 게 아니라 운이 좋았다.

발동 실적: 누적 9회 (datasheet/extract, sds/[id]/extract, shared-lists/[publicId],
compliance-links/[id], templates/[id] 등
— 대부분 한 파일에 GET/POST/PATCH/DELETE 핸들러가 동일 검증문을 공유하는 경우).

### 3-2. 삽입 내용 검증 — 유일성 검증만으로는 부족하다

**앵커 유일성 검증기는 "어디에 넣을지" 만 검증하고 "무엇을 넣을지" 는 검증하지 않는다.**

2026-08-10 배치9 에서 존재하지 않는 프로퍼티(`targetEntityType_note: undefined as never`)를
삽입한 사고가 났다. 이번엔 타입 오류라 tsc 가 잡았지만, **유효한 프로퍼티에 틀린 값을
넣었다면 어떤 게이트도 잡지 못한다.**

따라서 치환 후 반드시:

1. `git diff --ignore-cr-at-eol -U0` 로 **삽입된 실제 라인**을 눈으로 대조한다
   (이 repo 는 CRLF 라 옵션 없이는 파일 전체가 변경으로 뜬다).
2. 삽입 지점이 의도한 분기인지, 값이 의도한 값인지 확인한다.

### 3-3. 복구·재시도 편집도 동일 절차 (2026-08-10 추가)

위 사고는 **정상 편집이 아니라 복구 편집에서 났다.** 잘못 들어간 것을 급히 되돌리는
자리는 절차를 건너뛰기 가장 쉬운 자리다.

**후속 트랙의 복구·재시도·되돌리기 편집도 3-1·3-2 를 예외 없이 거친다.**
"방금 넣은 걸 빼는 것뿐" 이라는 이유로 생략하지 않는다.

## 4. 배치 진행 기록

| 배치 | 도메인 | 남은 수 |
|---|---|---|
| — | 실측 baseline | 74 |
| 1 | work-queue 7 | 67 |
| 2 | inventory 5 | 62 |
| 3 | products 5 | 57 |
| 4 | quotes 5 | 52 |
| 5 | ai 4 | 48 |
| 6 | ai-actions 4 | 44 |
| 7 | analytics 4 | 40 |
| 8 | protocol 4 | 36 |
| 9 | datasheet 3 + sds 3 | 30 |
| 10 | purchases 3 + shared-lists 3 | 24 |
| 11 | vendor 3 + compliance-links 2 + recommendations 2 + templates 2 | 15 |
| 12 | 기타 15 | **0** |

### 누적 지표

- **E6 검출 14건** (배치12 신규 0) — ops-execute 1, scan-label 1, products 3, inventory/bulk 1,
  protocol 3, datasheet/extract-url 3, compliance-links 2(POST·PATCH 의 URL 검증 catch).
  E3(`some()`) 로는 원리상 잡히지 않는 클래스이며, E6 를 신설한 근거가 실적으로 확인됐다.
- **앵커 사전 정지 12회** (배치12: canary-control catch, subscription 404, reviews id)
- **mojibake 한글 주석 3파일** (배치12 에서 admin/seed 추가 발견) — sweep 중 수정하지 않는다(diff 부풀림 회피). 별도 트랙.
- **죽은 재검사 제거 15건** (배치12 +8: canary-control, billing, billing/portal,
  cart, dashboard/layout, po-candidates, reviews/[id], safety/spend/map) — `sds/[id]/apply`, `shared-lists/bulk`, `shared-lists/[publicId]`,
  `vendor/premium`, `compliance-links` POST, `compliance-links/[id]` PATCH,
  `recommendations/feedback`.
  같은 핸들러 안에서 401 을 두 번 검사하던 코드. ⚠️ work-queue 3파일의 유사 패턴은
  **별개 GET/POST 핸들러**라 정상이었고 건드리지 않았다 — 중복처럼 보인다고 지우면 안 된다.

## 5. 관측된 구조적 문제 (개별 교정 대상 아님)

### 5-1. `targetEntityId: 'unknown'` 의 lock 입도

`deriveConcurrencyKey` 는 `${action}:${routePath}:${targetEntityId !== 'unknown' ? targetEntityId : userId}`
다. `'unknown'` 은 전역 공용 lock 이 아니라 **per-user fallback** 이고 routePath 로
route 간 충돌도 막힌다(§11.369-3).

다만 그 결과 **같은 사용자가 같은 route 로 서로 다른 대상을 동시에 조작하면 서로를 막는다.**
예: `shared-lists/[publicId]` PATCH 로 공유 링크 A 와 B 를 동시에 수정하면 뒤엣것이
`concurrent_mutation`. 실사용 빈도는 낮지만 오작동은 맞다.

해소는 `targetEntityId` 를 실제 id 로 올리는 것인데, 그러려면 `targetEntityType` 이
맞아야 한다(§6). 즉 **taxonomy 정리가 선행 조건**이다. sweep 범위에서 손대지 않는다.

### 5-2. action 명칭 불일치

`shared-lists/bulk` 는 DELETE 인데 `action: 'sensitive_data_import'` 다.
`action` 도 `checkServerAuthorization` 입력이므로 임의 변경 금지. §audit-taxonomy-review 로 이관.

### 5-3. 배치11 에서 드러난 별건 결함 (sweep 범위 밖 — 상신)

#### (가) placeholder success 3건 — DB 쓰기가 아예 없는데 성공을 반환한다

| route | 상태 |
|---|---|
| `vendor/requests/[id]/respond` | `TODO: Implement actual logic` — 응답을 저장하지 않고 `success: true` |
| `templates` POST | `TODO: Save to database` — `template-${Date.now()}` 로 **가짜 id 를 만들어** 반환 |
| `templates/[id]` DELETE | `TODO: Delete from database` — 아무것도 지우지 않고 `success: true` |

CLAUDE.md 의 **"placeholder success 금지"** 정면 위반이다. 특히 첫 번째는 벤더가
견적 응답을 제출했다고 믿게 만든다(운영 신뢰 손상). sweep 에서는 셋 다 `fail()` 로
닫고 사유를 코드 주석에 남겼을 뿐, **결함 자체는 그대로다.**

#### (나) `compliance-links/[id]` DELETE 에 enforceAction 부재

같은 파일의 PATCH 는 enforceAction 을 쓰는데 **DELETE 는 안 쓴다.**
파괴적 연산이 비파괴적 연산보다 통제가 약하다. ratchet sentinel 은
`enforceAction(` 을 쓰는 route 만 수집하므로 **이 클래스는 구조적으로 안 잡힌다** —
"enforceAction 을 아예 안 쓰는 mutation route" 전수 조사가 별도로 필요하다.

## 5-4. 배치12 관측 — 별건 상신 2종

### (다) `admin/seed` 프로덕션 도달 가능 (호영님 지시 실측 항목)

- 라우트 **자체에는 role 가드도 NODE_ENV 가드도 없다.**
- 다만 `src/middleware.ts` 가 `/api/admin/*` 를 **중앙에서 ADMIN deny-by-default**
  로 막는다(matcher `/api/:path*` 확인). 따라서 **ADMIN 만 도달 가능**하다.
- 판정: 임의 사용자 도달은 **불가**. 그러나 프로덕션 DB 에 데모 벤더·제품을
  upsert 하는 동작이 확인 절차 없이 한 번의 POST 로 실행된다.
  → **§admin-seed-prod-guard** 로 상신(NODE_ENV 가드 또는 명시 확인 게이트).

### (라) `billing/portal` — 외부 부작용형 감사 누락

로컬 DB 쓰기는 0 이지만 `stripe.billingPortal.sessions.create` 로 **외부 결제
포털 세션을 실제로 만든다.** 판정 기준(쓰기 실재 여부)대로 `fail()` 로 닫았으므로
그 외부 행위는 audit envelope 에 남지 않는다. 코드 주석에 사유를 명시했다.
→ **§billing-audit-gap** 으로 상신.

## 6. sweep 마감 — 닫힌 것과 닫히지 않은 것

### 닫힌 것

**`enforceAction` 을 쓰는 route 의 핸들 마감 74/74.** ratchet `LEGACY_UNCLOSED` 0.
E1(신규 누수 0) · E2(ratchet) · E3 · E4 · E6 전건 GREEN.

### 닫히지 않은 것 (명시)

| 항목 | 상태 | 트랙 |
|---|---|---|
| `enforceAction` 을 **아예 안 쓰는** mutation route | **미측정** — ratchet 이 원리상 못 본다 | §enforcement-coverage-gap (E7 1단계) |
| placeholder success | 1건 처리 / **4건 결함 존치** | §placeholder-success-audit |
| `targetEntityType` 오분류 31+건 | audit 기록만 오염, 현재 접근 판정 무영향 | §audit-taxonomy-review (1순위) |
| mojibake 한글 주석 3파일 | 미수정 | 별도 |
| audit envelope 지속 저장 | **부재** (in-memory only) | §audit-persistence-gap |
| `admin/seed` 프로덕션 가드 | ADMIN 게이트만 존재 | §admin-seed-prod-guard |
| `billing/portal` 외부 부작용 감사 | 미기록 | §billing-audit-gap |

**"핸들 마감 완료" 는 "권한 집행 완료" 가 아니다.** 위 표를 빼고 읽으면 과장이 된다.

### 최종 지표

- E6 검출 **14건** — E3(`some()`)로는 원리상 못 잡는 클래스. E6 신설 근거가 실적으로 확인됐다.
- 앵커 사전 정지 **12회**
- 죽은 재검사 제거 **15건**
- ratchet 실증 사례 **1건** (배치9 — §2-1)
- taxonomy 후보 **31+건**
- mojibake 미수정 **3파일**
- **선판정 오차율 10/23 (43%)** — 아래 §5-5

## 5-5. 선판정 오차율과 방향 (다음 트랙의 신뢰도 근거)

호영님 선판정표 대비 실측 불일치를 기록한다. 다음 트랙에서 선판정을 어느 정도
신뢰할지 정하는 근거다.

| 배치 | 가설 수 | 불일치 | 방향 |
|---|---|---|---|
| 11 | 9 | **4** | 전부 "쓰기 있음 → 실제 없음" (한쪽 쏠림) |
| 12 | 14 (가설 없음 1건 제외) | **6** | "없음→있음" 3 · "있음→없음" 3 (**균형**) |
| 계 | 23 | **10 (43%)** | — |

**배치12 가 배치11 의 쏠림 가설을 검증했다.** 배치12 는 의도적으로 "쓰기 없음"
방향으로 7건을 걸었는데, 오차가 3:3 으로 갈렸다. 즉 배치11 의 4/4 쏠림은
**체계적 편향이 아니라 그 배치 대상(respond·templates)의 네이밍 특성**이었다.

오차의 실제 원인은 방향이 아니라 **"이름이 구현을 증언하지 못한다"** 는 것이다:
- `safety/spend/map` — "map" 이 조회처럼 읽히지만 `purchaseRecord.update` 를 한다
- `admin/canary-control` — "control" 이 쓰기처럼 읽히지만 JSON 을 계산해 반환만 한다
- `dashboard/layout` POST · `export/presets` POST — 저장 이름인데 저장하지 않는다

→ 근거 등급 `[이름]` 은 **뒤집힐 확률 약 절반**으로 취급해야 한다. 배치12 에서
`[이름]` 등급 9건 중 5건이 틀렸고, `[구조]` 등급 5건은 **전건 적중**했다.

## 7. 후속 트랙

- **§audit-taxonomy-review** — `targetEntityType` 3클래스 정리.
  누적 후보 31건. **sweep 종료 직후 1순위**(호영님 2026-08-10). 자세한 것은 `PLAN_audit-taxonomy-review.md`.
- **§placeholder-success-audit** (신규) — §5-3(가). 스텁 3건 + 전수 조사.
- **§enforcement-coverage-gap** (신규) — §5-3(나). enforceAction 을 **쓰지 않는**
  mutation route 전수. 현재 ratchet 은 이 클래스를 볼 수 없다.
- **§sentinel-ast-migration** — 정규식 기반 sentinel 은 문법 변형에 구조적으로 취약하다.
  E3 는 두 번 틀렸고(둘 다 오탐 방향), E6 는 optional catch binding 을 처음에 놓쳤다.
  중괄호 매칭으로 임시 보강했으나 근본 해법은 AST 파싱이다.

## 8. Rollback

각 배치는 단일 커밋이다. `git revert` 로 route 를 원복하면 `LEGACY_UNCLOSED` 에
해당 경로를 재등재해야 한다 — E2 가 이를 강제하므로 빠뜨리면 RED 로 드러난다.
