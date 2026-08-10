# §enforcement-coverage-gap — enforceAction 을 아예 쓰지 않는 mutation route

작성: 2026-08-10
상태: 등재 (E7 1단계 미착수)
발원: §enforcement-handle-close-sweep 배치11

---

## 0. 왜 이 트랙이 필요한가 — sweep 마감 조건 정정

§enforcement-handle-close-sweep 의 ratchet sentinel 은 **`enforceAction(` 을 쓰는
route 만 glob 수집**한다. 따라서 **enforceAction 을 아예 쓰지 않는 mutation route 는
원리상 0 으로 보인다.**

이 상태로 sweep 을 닫으면 **"핸들 마감 완료" 가 "권한 집행 완료" 로 읽힌다.**
마감 문서가 사실을 과장하게 되므로, sweep 종료 문서는 반드시
"닫힌 것 / 닫히지 않은 것" 을 분리해 쓴다.

## 1. 근거 사례 — `compliance-links/[id]` (2026-08-10 확정)

이 클래스의 첫 확정 사례다.

| 메서드 | enforceAction |
|---|---|
| `PATCH` (링크 수정) | **있음** |
| `DELETE` (링크 삭제) | **없음** |

같은 파일 안에서, **더 파괴적인 연산이 덜 파괴적인 연산보다 통제가 약하다.**
이것이 설계가 아니라 **누락**이라는 증거다 — 의도적 예외라면 PATCH 도 빼거나
DELETE 쪽에 사유가 남아 있어야 한다. 둘 다 없다.

ratchet 은 이 파일을 "핸들을 닫는 route" 로 GREEN 판정한다. PATCH 만 보기 때문이다.

## 2. E7 1단계 — **계수만** (교정 금지)

호영님 지시(2026-08-10): 규모를 모르는 상태에서 교정에 들어가면 sweep 이 두 배가 된다.
**숫자를 먼저 보고 우선순위를 정한다.**

### 범위

`src/app/api/**/route.ts` 중 mutation 메서드(`POST` / `PATCH` / `PUT` / `DELETE`)를
export 하면서 `enforceAction(` 이 **없는** 파일.

### 구조

E1/E2 와 동일한 ratchet:

- glob 수집 → `LEGACY_NO_ENFORCE` 목록으로 고정
- **신규 0** 단언 (목록 밖에서 새로 생기면 RED)
- 목록은 줄어들기만 한다 (고쳐진 항목이 남아 있으면 RED)
- corrupt→RED 실증 포함

### 1단계에서 하지 않는 것

- **교정하지 않는다.**
- **분류하지 않는다.** 정당한 예외(공개 조회 후 리다이렉트, webhook, 토큰 검증형,
  501 고정 응답 등)가 섞일 것이 확실하지만, **1단계에서는 전부 목록에 넣는다.**
  분류는 숫자를 본 뒤다. 미리 걸러내면 규모가 과소평가된다.

### 이미 알려진 목록 후보

- `src/app/api/compliance-links/[id]/route.ts` — DELETE (§1)
- `src/app/api/vendor/requests/[id]/respond/route.ts` — POST.
  단 501 고정 응답이라 집행할 mutation 이 없다(§placeholder-success-audit §3-3).
  그래도 1단계에서는 **목록에 넣는다** — 분류는 나중.

## 3. 실행 순서

호영님 확정(2026-08-10): sweep 종료 후
**① §audit-taxonomy-review 타입 체계 설계 → ② 이 트랙 E7 계수 → ③ 나머지.**

## 4. 배치 12 와 묶지 않는 이유

E7 은 sweep 의 마지막 배치가 아니라 **별도 단일 작업**이다.
배치12(기타 15건)는 기존 ratchet 을 0 으로 만드는 일이고,
E7 은 **새 측정면을 여는 일**이다. 섞으면 어느 쪽 숫자가 움직였는지 판독이 흐려진다.
