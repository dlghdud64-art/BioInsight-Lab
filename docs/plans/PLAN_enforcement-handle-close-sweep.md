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

#### 3-1-1. 옛 값은 **리터럴로** 전수 grep 한다 (2026-08-12 추가)

> **값을 바꾸기 전, 옛 값을 문자열 그대로 전수 grep 한다.
> 컴포넌트명·기호명이 아니라 리터럴로.**

3-1 이 "어디에 넣을지" 를 지킨다면 이것은 **"무엇이 그 값을 이미 잠그고 있는지"** 를
지킨다. 같은 사각의 반대쪽이다.

실증 (§sourcing-quote-flow v1.1, 2026-08-12): 섹션 여백 `mt-6` → `mt-5` 를 넣으며
옛 값 grep 을 **컴포넌트명(`PersonalizedRecommendations`)으로만** 돌렸다.
`mt-6` 을 잠근 sentinel(`product-detail-sian-flat.test.ts:93`)은 **컴포넌트명으로는
찾을 수 없다** — 클래스 문자열로만 잡힌다. 전체 스위트 게이트가 신규 실패 1파일로
잡아냈고, **부분 실행이었으면 놓쳤다.**

적용: 값·문구·클래스·상수를 바꿀 때 `grep -rn "<옛 값 리터럴>" src/__tests__` 를
**변경 전에** 돌린다. 이름으로 찾은 결과는 리터럴 검색을 대신하지 못한다.
(메모리 규칙 `sentinel 옛 값 전수 sweep` 의 집행 형태 — "리터럴로" 가 빠져 있었다.)

##### 두 번째 얼굴 — **타입 참조로도 훑는다** (2026-08-12 추가)

> 값이 아니라 **판정**을 바꿀 때는 리터럴이 아니라 **타입·enum 참조**가 검색 키다.
> `grep -rn "OrganizationRole.ADMIN" src` 처럼 **타입명 전수**로 훑는다.

실증 (§team-org-role-model Phase 1): 조직 role 판정 지점을 세면서 변수명 패턴
(`member|membership|orgMember|mem`)으로 grep 했다. `userRole === OrganizationRole.ADMIN`
한 곳이 **변수명이 달라서** 빠졌고, 16곳으로 보고했다가 Phase 1 재sweep 에서 17곳으로
정정했다.

**같은 규칙의 두 얼굴이다:**
- `mt-6` 같은 **값** 변경 → **리터럴**이 답
- `OrganizationRole.ADMIN` 같은 **판정** 변경 → **타입 참조**가 답

공통 원리: **변수명·컴포넌트명 같은 "부르는 이름" 으로 훑지 않는다.** 그것은 자유롭게
바뀌므로 누락이 구조적으로 발생한다. 바뀌지 않는 축(리터럴 값 / 타입·enum 참조)으로 훑는다.

##### 세 번째 얼굴 — **제외 필터가 대상을 삼킨다** (2026-08-12 추가)

> **다른 모델·다른 축을 걸러내려는 필터가, 경로·파일명에 같은 단어가 든
> 진짜 대상까지 지운다.**
> 제외는 **의미 단위**로 한다(모델명·import 확인). **경로 문자열로 하지 않는다.**

실증 (§team-org-role-model Phase 1): 잔여 확인 grep 에서 `WorkspaceMember`
(별도 모델·별도 enum)를 제외하려고 `grep -viE "workspace"` 를 걸었다.
그 필터가 **`components/workspace/workspace-switcher.tsx` 까지 함께 지웠다** —
경로에 "workspace" 가 들어 있을 뿐, 내용은 **`OrganizationRole` 판정**이었다.

결과: Phase 1 이 16곳으로 끝난 줄 알았으나 실제는 17곳이었고, Phase 2 로 OWNER 가
실재하게 되자 **그 1곳이 활성 결함이 됐다**(조직 생성자가 멤버 뷰를 본다, 라이브 6페이지).

⚠️ 이 형태가 특히 나쁜 이유: **제외는 결과에 흔적을 남기지 않는다.**
누락된 항목은 목록에 안 나오므로 "전수 확인했다" 가 성립해 버린다.
(§3-4 무음 실패의 **검색판**이다.)

적용:
- 제외는 `grep -v` 경로 문자열이 아니라 **파일 내용으로 판정한다**
  (예: `WorkspaceMember` / `workspaceId` import·참조 여부)
- 제외한 항목의 **개수와 목록을 출력해 눈으로 본다** — 조용히 빼지 않는다

**세 얼굴이 한 규칙이다: 값은 리터럴로 / 판정은 타입 참조로 / 제외는 의미로.**

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

### 3-4. 부정 단언은 **주석 제거본**에 건다 — 표준 절차 (2026-08-10 승격)

**모든 sentinel 의 부정 단언(`not.toMatch` / `filesContaining` 등)은
`stripComments()` 적용본에 걸어야 한다.**

```ts
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
```

승격 근거 — **자기 주석에 걸린 사고가 두 번** 났다:

1. product-detail 계열 — 금지 문구를 설명하는 주석이 부정 단언에 매칭돼,
   구현자가 주석을 지워 통과시킬 수 있는 구조가 됐다.
2. `vendor-portal-rfq-retired` (2026-08-10) — **폐기 사유를 적은 주석**이
   "조작 리터럴이 없다" 단언에 걸려 첫 실행이 RED. 설명을 쓸수록 RED 가 되는 구조다.

두 번 반복됐으므로 개별 실수가 아니라 **절차 결함**으로 본다.
sentinel 을 새로 쓸 때 stripComments 는 선택이 아니라 기본형이다.

⚠️ 함께 지킬 것: 부정 단언은 **근접도(`{0,N}` 상한)가 아니라 구조로** 검사한다.
문자열 거리로 판정하면 코드 재배치만으로 통과한다(E3 가 두 번 오탐한 원인).

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

## 5-6. sweep 이 검사하지 않았던 것 (2026-08-12 정리 — 마감의 정당성은 미검증이었다)

sweep 은 "닫지 않은 74건" 만 다뤘다. 아래 두 클래스는 **설계 범위 밖**이었고,
둘 다 sweep 종료 후 실측에서 실제 결함으로 드러났다.

| 클래스 | 규모 | 실증 | 커버 |
|---|---|---|---|
| **잘못 닫은** 핸들러 — 이미 complete() 를 부르지만 쓰기가 없어 그 호출이 거짓인 경우 | 95건 미검사 | `analytics/ai-insight` (complete() 를 lock 해제 용도로 오용) | **E8 신설** |
| **애초에 동작하지 않는** 라우트 — 핸들은 닫지만 유령 모델을 호출해 항상 실패 | 6종 20회 | `compliance-links`(모델 부재), `quote-lists`(모델명 오기) | §phantom-model-call P1 |

교훈: **"닫는가" 와 "동작하는가" 와 "정당한가" 는 세 개의 다른 질문**이다.
sweep 은 첫 번째만 물었다.

#### 네 번째 질문 — **"도달하는가"** (2026-08-12 추가, 호영님)

> **판정을 고쳤으면 그 판정에 도달하는지를 따로 확인한다.
> 라우트 위에 middleware·layout·guard 가 있을 수 있고,
> 그것들은 라우트 코드를 읽어서는 보이지 않는다.**

§render-reachability 와 **같은 뿌리**다 — 저것은 **화면**의 도달성, 이것은 **판정**의
도달성이다. 둘 다 "내가 고친 코드가 실행되는가" 를 묻는다.

이 세션에서 "형태가 맞다 ≠ 동작한다" 가 **네 번** 나왔고, 매번 **다른 층**이었다:

| # | 층 | 사례 |
|---|---|---|
| 1 | **파일 도달성** | dead file 수정 + sentinel false-GREEN (2026-08-06 재발) |
| 2 | **모델 실재** | `db` 가 `any` 라 유령 모델 호출이 컴파일됨 (§phantom-model-call) |
| 3 | **런타임 값** | sentinel·build GREEN 인데 computed style·DB 실재는 달랐다 |
| 4 | **상위 게이트** | `middleware.ts` admin deny-by-default 가 라우트 판정보다 앞에 있다 (§team-org-role-model Phase 2) |

4번이 특히 위험한 이유: **라우트 파일만 읽으면 존재 자체가 보이지 않는다.**
grep 대상이 그 파일에 없으므로 "전수 확인했다" 는 보고가 성립해 버린다.

##### 편집 도구 자체가 계약을 깬다 — Windows 개행 번역 (2026-08-12 추가)

> **python `io.open(p, "w")` 는 Windows 에서 `\n` 을 `\r\n` 으로 번역한다.**
> 파일 전체가 CRLF 로 바뀐다. 편집 스크립트를 쓸 때는 **`newline=""`** 로 열거나
> 바이너리(`"rb"`/`"wb"`)로 다룬다.

실증: §onboarding-blocker #7 작업에서 초대 UI 블록을 python 으로 삭제했더니
`settings/workspace/page.tsx` 가 **742 CRLF** 로 바뀌어 §11.303-hotfix
("CRLF 0 회귀 차단")가 RED 가 됐다. **편집 내용은 옳았고 도구가 계약을 깼다.**

⚠️ 이 클래스는 `tsc`·`build` 를 통과한다 — 개행은 문법이 아니다.
**전체 스위트 게이트만이 잡는다.** (이번에도 게이트가 잡았다.)

##### 짝 — **"내가 붙인 것이 어디까지 끌려가는가"** (2026-08-12 추가)

> **import 체인은 아래로만 흐르지 않는다.**
> `middleware` → `auth` → 새 모듈처럼, **상위가 이미 나를 참조하고 있으면
> 내가 붙인 의존이 상위 번들로 올라간다.**

"도달하는가" 가 *내가 고친 코드가 실행되는가* 라면, 이것은 *내가 붙인 코드가
어디까지 실려 가는가* 다. 같은 질문의 반대 방향이다.

실증 (§onboarding-blocker 3a): `auth.ts` 에 `createOrganization` 을 붙였더니
`middleware.ts → @/auth → lib/api/organizations → lib/workspace/slug → node:crypto`
가 되어 **Edge 런타임 빌드가 깨졌다**(`UnhandledSchemeError`).

⚠️ 이 클래스가 위험한 이유: **sentinel 도 vitest 도 통과하고 빌드에서만 드러난다.**
정적 계약은 "형태가 맞다" 만 보므로 번들 경계를 못 본다.

체크리스트 한 줄:
> **`auth.ts` · `middleware.ts` 체인에 모듈을 추가할 때는 Edge 호환 여부를 먼저 본다**
> (`node:` 스킴 import 금지 — 전역 Web Crypto 등으로 대체).

적용: 권한·게이트·판정을 고칠 때 아래를 **함께** 확인한다.
- `src/middleware.ts` 의 경로 매칭 (deny-by-default 구간에 들어가는가)
- 상위 `layout.tsx` 의 리다이렉트·세션 가드
- 라우트 내부의 **다른** 판정(같은 파일 안 2중 게이트)
- 최종 확인은 **정적으로 끝나지 않는다** — 실제 세션·DB 로 호출하는 왕복 검증 항목으로 넘긴다

### E8 — complete() 정당성 ratchet (0 에서 시작)

`enforcement-complete-legitimacy.test.ts`. 직접 쓰기 + **import 헬퍼 1~2단계 해석**으로
쓰기 유무를 판정하고, 쓰기 없는 핸들러의 complete() 를 offender 로 잡는다.

판정기 한계는 테스트 주석에 선언했다: 3단계 이상 경유 · 동적 디스패치(모듈 수준
인스턴스 — `ingestion` 의 `gateway.execute` 가 실례, 수동 실측 예외 목록 등재) ·
alias. 한계로 인한 오판은 **오탐(false RED) 방향**이라 안전하다.

작성 중 공허 GREEN 을 **두 번** 만났고 corrupt→RED 가 잡아냈다:
① `db` import 를 헬퍼로 해석 → `lib/db.ts` 폴백 stub 의 `$transaction` 정의가
   전 핸들러에 쓰기를 인정 → DB 클라이언트 모듈 제외로 교정.
② `WRITE_RE` 에 `dbTyped` 누락 → 방금 교정한 typed 호출이 안 보임 → 오탐 2건으로 드러남.

### 3-4. ⚠️ 상위 규칙 — 무음 실패 금지 (2026-08-12, 세 번째 사례에서 확정)

> **검증 도구는 아무것도 하지 않았을 때 조용히 통과해서는 안 된다.
> 대상 0건은 성공이 아니라 실패다.**

세 번 같은 형태로 당했다. 개별 규칙이 아니라 상위 규칙으로 둔다 —
**네 번째가 나올 때 알아볼 수 있어야 한다.**

| # | 도구 | 무음 실패 형태 | 결과 | 교정 |
|---|---|---|---|---|
| 1 | 소스 스캐너 | UTF-16/BOM 파일을 **읽지 못함** | 그 파일의 위반이 0 으로 세어짐 = 거짓 GREEN | 인코딩 감지 + `§source-encoding-drift` ratchet. 읽기 실패를 skip 하지 않고 실패시킨다 |
| 2 | 정규식 파서 | 중첩 중괄호에서 **끊김** | 13건 미파싱을 "하한" 으로 보고 (실제 규모 미상) | 중괄호 매칭으로 교체 → 미파싱 0 |
| 3 | corrupt 스크립트 | 앵커 소멸로 **0회 치환** 후 통과 | "corrupt 했는데 GREEN" 이 판정기 결함처럼 보임 (실제로는 corrupt 자체가 안 됨) | 치환 전 `count(anchor)` 검증, 0 이면 중단. 무단언 `replace` 금지 |

공통 구조: **도구가 대상을 찾지 못한 것과 위반이 없는 것을 구분하지 않았다.**
둘은 정반대인데 출력이 같았다.

적용 형태:
- 스캔 sentinel: 파일 수·수집 건수 하한 단언(공허 GREEN 방지) **+ 읽기 실패 자체를 실패로**
- 파서: 파싱 실패 건수를 0 으로 단언 (하한 보고로 넘기지 않는다)
- 편집·corrupt 스크립트: 앵커 count 사전 검증 (`safe_edit` 와 동일 규율)

E8 작성 중에도 같은 구조가 두 번 더 나왔다(§5-6) — `db` import 오해석으로 전 핸들러에
쓰기를 인정, `WRITE_RE` 의 `dbTyped` 누락. 둘 다 corrupt→RED 가 잡았다.

### 3-5. ⚠️ 상위 규칙 — flaky 는 결함 후보다 (2026-08-12, 호영님 확정)

> **flaky 는 원인 규명 전까지 결함 후보로 취급한다. 재시도로 통과시키지 않는다.**

§3-4 가 "도구가 침묵하는 실패" 라면 이것은 **"제품이 간헐적으로 실패하는데 테스트 탓으로
돌리는" 실패**다. 구조는 같다 — 실패 신호를 신호가 아닌 것으로 재분류한다.

실증 (§execution-id-collision):

| 항목 | 내용 |
|---|---|
| 증상 | `dispatch-execution-handoff` H5 가 전체 스위트 4회 중 1회 실패. 재실행하면 통과 |
| 통상 처리 | "flaky" 라벨 → 재시도 → 초록. 250 기지선 안에서도 이 형태로 오래 잠겨 있었다 |
| 실제 원인 | `` `exec_${Date.now().toString(36)}` `` — **같은 밀리초 안이면 두 execution 이 같은 id 를 받는다** |
| 결함 등급 | 제품 결함. 발송·입고 이력이 뒤섞인다. 구매 운영에서 **회수 불가** |
| 왜 위장됐나 | 시간 의존이라 **머신 속도·부하에 따라 드러난다.** 느린 CI 에선 안 보이고 빠른 로컬에서 터진다 |

**시간 의존 코드는 flaky 로 위장하기에 가장 좋은 자리다.** 간헐 실패를 만나면 먼저
`Date.now()` / 타이머 / 순서 의존을 의심한다.

적용 형태:
- 간헐 실패는 **재시도 금지.** `retry` 옵션·`test.retry`·CI 재실행으로 넘기지 않는다
- 원인 규명 전까지 기지선(`test-baseline.json`)에 넣어 잠그지 않는다 — 잠그면 결함이 부채로 둔갑한다
- 규명 후에는 원인을 **부정 단언으로 고정**한다 (여기선 `src/__tests__/ops/execution-id-collision.test.ts`)

#### 3-5-1. 집행 수단 — 기지선은 손으로 줄인다 (`--update` 금지)

> **차이를 먼저 읽고, 그 항목만 손으로 뺀다.**
> `npm run test:gate -- --update` 는 신규 실패를 기지선에 넣는 용도로 쓰지 않는다.

§3-5 는 판단 기준이고 이것은 **집행 수단**이다. `--update` 는 정확히
"원인 규명 전 기지선에 넣기" 를 **자동화하는 명령**이다. 현재 상태를 그대로 덮어쓰므로,
그 순간 흔들린 테스트가 무엇이든 조용히 부채로 편입된다.

실증 (2026-08-12, §execution-id-collision): `--update` 대신 게이트를 먼저 그냥 돌렸다.
출력은 `신규 실패 0 / stale 1` 이었고, 그 1건이 H5 임을 확인한 뒤 **그 한 줄만** 제거했다.
`--update` 를 썼다면 같은 결과가 나왔겠지만 **그 사실을 확인하지 못한 채** 나왔을 것이다.

절차:
1. `npm run test:gate` (플래그 없이) — 신규/stale 을 **읽는다**
2. 신규 실패가 있으면 → 기지선이 아니라 **그 실패를 다룬다** (§3-5)
3. stale 만 남으면 → `test-baseline.json` 에서 **그 줄만** 손으로 지우고 카운트를 맞춘다
4. 감액 사유를 `_comment` 감액 이력에 한 줄 남긴다 (왜 빠졌는가 — 고쳐서인가, 넘어가서인가)

**규칙과 그 규칙을 무력화하는 도구가 같은 저장소에 있으면 언젠가 쓴다**(호영님).
그래서 `scripts/suite-gate.ts` 의 `--update` 자체를 잠갔다 — **감액(파일 제거)만 허용**하고,
신규 실패를 기지선에 넣으려면 `--allow-new --reason="…"` 을 명시해야 한다. 사유는
기지선 파일 `_admissions` 에 기록으로 남는다. 문서 규칙만으로는 도구를 이기지 못한다.

가드 실증 (§3-4 준수 — 작동하지 않는 가드는 가드가 아니다):
현재 실패 중인 1건을 기지선에서 일부러 빼서 "신규 실패" 로 보이게 만든 뒤
`--update` 를 실행했다. 결과 — **거부(exit 1)** + 대상 파일 지목 + `test-baseline.json`
**바이트 무변경**(`cmp` 확인). 즉 거부가 메시지에 그치지 않고 실제 쓰기를 막았다.

## 6. sweep 마감 — 닫힌 것과 닫히지 않은 것

### 닫힌 것

**`enforceAction` 을 쓰는 route 의 핸들 마감 74/74.** ratchet `LEGACY_UNCLOSED` 0.
E1(신규 누수 0) · E2(ratchet) · E3 · E4 · E6 전건 GREEN.

### 닫히지 않은 것 (명시)

| 항목 | 상태 | 트랙 |
|---|---|---|
| `enforceAction` 을 **아예 안 쓰는** mutation route | **미측정** — ratchet 이 원리상 못 본다 | §enforcement-coverage-gap (E7 — **동결**) |
| **잘못 닫은**(쓰기 없는 complete) 핸들러 | 1건 실증·교정, 나머지는 E8 이 이후 감시 | E8 (§5-6) |
| 마감의 정당성 | §5-6 — "닫는가" 만 물었고 "정당한가" 는 설계 범위 밖이었다 | E8 + §phantom-model-call |
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
- **§sentinel-ast-migration** (동결 유지 · **근거 갱신 2026-08-12**) —
  정규식 기반 sentinel 은 문법 변형에 구조적으로 취약하다.
  E3 는 두 번 틀렸고(둘 다 오탐 방향), E6 는 optional catch binding 을 처음에 놓쳤고,
  E8 은 `dbTyped` 를 빠뜨려 오탐 2건을 냈다.
  **결정적 근거는 숫자다: 전체 스위트 실패 250건 중 245건(98%)이 정적 sentinel 의
  stale 계약이다**(§test-baseline-debt §4-4). UI 가 **정상적으로 진화하면** 자동으로 깨진다 —
  이번 세션에 만든 20여 개도 같은 운명이다. 취향이 아니라 245라는 실측이 근거다.

## 8. Rollback

각 배치는 단일 커밋이다. `git revert` 로 route 를 원복하면 `LEGACY_UNCLOSED` 에
해당 경로를 재등재해야 한다 — E2 가 이를 강제하므로 빠뜨리면 RED 로 드러난다.
