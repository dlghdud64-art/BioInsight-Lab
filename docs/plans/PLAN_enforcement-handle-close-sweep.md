# §enforcement-handle-close-sweep — enforceAction 핸들 누수 전수 교정

작성: 2026-08-10 (operator shell 실측 기록)
상태: 진행 중 (74 → 24)

---

## 0. 배경

`enforceAction()` 이 돌려주는 `InlineEnforcementHandle` 은 반드시 닫아야 한다.

- `complete({beforeState, afterState})` — audit envelope 기록 + mutation lock 해제
- `fail()` — lock 해제 (audit 미기록)

닫지 않으면 두 가지가 동시에 깨진다.

1. mutation lock 이 `ACTIVE_MUTATION_TTL_MS`(5분)까지 잡혀 같은 키의 재요청이
   `concurrent_mutation` 으로 거부된다.
2. 성공 audit 이 남지 않아 "누가 무엇을 바꿨는지" 추적이 불가능하다.

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

발동 실적: 누적 7회 (datasheet/extract, sds/[id]/extract, shared-lists/[publicId] 등
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

**남은 24건에서 복구·재시도·되돌리기 편집도 3-1·3-2 를 예외 없이 거친다.**
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

### 누적 지표

- **E6 검출 12건** — ops-execute 1, scan-label 1, products 3, inventory/bulk 1,
  protocol 3, datasheet/extract-url 3.
  E3(`some()`) 로는 원리상 잡히지 않는 클래스이며, E6 를 신설한 근거가 실적으로 확인됐다.
- **앵커 사전 정지 7회**
- **mojibake 한글 주석 2파일** — sweep 중 수정하지 않는다(diff 부풀림 회피). 별도 트랙.
- **죽은 재검사 제거 3건** — `sds/[id]/apply`, `shared-lists/bulk`, `shared-lists/[publicId]`.
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

## 6. 후속 트랙

- **§audit-taxonomy-review** — `targetEntityType` 3클래스 정리.
  누적 후보 22건. 자세한 것은 `PLAN_audit-taxonomy-review.md`.
- **§sentinel-ast-migration** — 정규식 기반 sentinel 은 문법 변형에 구조적으로 취약하다.
  E3 는 두 번 틀렸고(둘 다 오탐 방향), E6 는 optional catch binding 을 처음에 놓쳤다.
  중괄호 매칭으로 임시 보강했으나 근본 해법은 AST 파싱이다.

## 7. Rollback

각 배치는 단일 커밋이다. `git revert` 로 route 를 원복하면 `LEGACY_UNCLOSED` 에
해당 경로를 재등재해야 한다 — E2 가 이를 강제하므로 빠뜨리면 RED 로 드러난다.
