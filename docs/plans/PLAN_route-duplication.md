# §route-duplication — 같은 도메인 행위에 경로가 둘

작성: 2026-08-10
상태: 사례 1건 처리 완료. **전수 조사는 하지 않는다**(범위 폭발) — 사례가 하나 더
나오면 그때 착수.
발원: §placeholder-success-audit → 벤더 견적 회신 실측

---

## 0. 클래스 정의

**같은 도메인 행위에 대해 둘 이상의 경로가 각자 라우트를 갖고 각자 진화한 상태.**

단순 중복 코드가 아니다. 두 경로가 **서로 다른 완성도**를 갖게 되고, 그 사실이
어느 쪽에서도 드러나지 않는다는 것이 이 클래스의 해악이다.

## 1. 사례 1 — 벤더 견적 회신 (2026-08-10 처리 완료)

### 1-1. 상태

| 경로 | 구현 |
|---|---|
| 토큰 경로 `/api/vendor-requests/[token]/response` | **정상.** `quoteVendorResponseItem.upsert` + `quoteVendorRequest.update` 트랜잭션. 화면 `/vendor/[token]` |
| 로그인 포털 경로 `/api/vendor/requests/*` | **하드코딩 mock.** 인증도 DB 조회도 없음 |

### 1-2. **이 클래스의 전형적 진행** — 미구현 쪽이 mock 으로 채워진다

다음 사례에서 바로 알아볼 수 있도록 진행 형태를 기록한다.

1. 두 경로가 생긴다 (토큰형 = 이메일 배포용, 로그인형 = 포털용).
2. 한쪽만 구현된다.
3. **미구현 쪽이 비어 있지 않고 mock 으로 채워진다** — 화면을 만들어야 하니
   그럴듯한 데이터가 필요했고, 그것이 그대로 남았다.
4. mock 이 남아 있는 한 "미구현" 으로 보이지 않는다. **화면이 동작하는 것처럼 보인다.**
5. 실제로는 존재하지 않는 거래 상대를 렌더한다.

실측된 조작 데이터: `Cell Culture 시약 견적` / `서울대학교 생명과학연구소` /
`KAIST 바이오연구소` / `연세대학교 의생명연구소` / `김연구` `이박사` `박교수`.
**인증 없이** 누구에게나, 아무 id 에나 같은 값을 돌려줬다.

> 이 단계 4가 핵심이다. placeholder success 는 "눌렀는데 저장이 안 된다" 로
> 드러날 여지라도 있지만, mock 목록은 **아무 행동 없이도 이미 거짓**이다.

### 1-3. 처리 — 포털 RFQ 경로 폐기, 토큰 경로가 canonical

호영님 결정 근거 3:

1. 포털을 구현하려면 벤더 신원 ↔ `vendorEmail` 매핑이 필요하고, 그건 SUPPLIER 계정
   발급 체계의 하위 과제다(§supplier-product-ownership-scope 에서 "발급 전 선결"
   로 이미 묶인 문제). 계정 체계가 서기 전에는 포털 회신이 성립할 수 없다.
2. 토큰 경로는 동작하고 이메일로 배포된다. 벤더에게 회신 수단이 **이미 있다** —
   없는 걸 만드는 게 아니라 중복 경로를 지우는 것이다.
3. 현 상태 유지 비용이 **조작 데이터 렌더**다. 폐기가 가장 싸고 가장 정직하다.

**501 로 남기지 않는다** — 라우트가 남으면 다음 사람이 "구현하면 되겠네" 로 읽는다.

### 1-4. 삭제 목록

| 파일 | 사유 |
|---|---|
| `api/vendor/requests/route.ts` | mock 목록(조직 3곳 조작) |
| `api/vendor/requests/[id]/route.ts` | mock 상세 |
| `api/vendor/requests/[id]/respond/route.ts` | 회신 스텁(직전 커밋에서 501 처리했으나 짝이 사라져 함께 삭제) |
| `api/vendor/stats/route.ts` | mock KPI(고정 숫자). 삭제 과정에서 **두 번째 소비처 발견** — 아래 |
| `app/vendor/requests/[id]/page.tsx` | 포털 상세 화면 |
| `components/vendor/quote-form.tsx` | 회신 입력 폼(사용처가 위 화면 1곳) |
| `__tests__/ops/vendor-respond-not-implemented.test.ts` | 501 상태를 잠그던 sentinel — 폐기로 대체 |

**대체/수정**

- `app/vendor/page.tsx` → 목록을 만들지 않고 토큰 경로를 안내하는 화면으로 교체.
- `app/vendor/dashboard/page.tsx` → `/vendor` 리다이렉트. 라우트를 지우지 않은 이유는
  사이드바와 로그인 이후 경로가 이 주소를 가리켜 404 를 만들지 않기 위함.
- `app/vendor/_components/vendor-sidebar.tsx` → `Quote Requests` 항목 제거.
- `app/dashboard/vendor/quotes/page.tsx` → **mock KPI 카드 4개 제거**
  (총 견적 요청 / 총 응답 / 응답률 / 총 거래 금액). `/api/vendor/stats` 의
  두 번째 소비처였고, 고정 숫자를 실적처럼 렌더하고 있었다.

### 1-5. sentinel

`src/__tests__/ops/vendor-portal-rfq-retired.test.ts` — R1~R4.

- R1 폐기 경로 6개가 재생성되지 않는다
- R2 조작 데이터 리터럴 4종이 소스에 없다 (**주석 제거본**에 대해 검사)
- R3 진입 경로(사이드바·API 호출)가 없다 + 진입 화면이 목록을 만들지 않는다
- R4 canonical 토큰 경로 무손상 (upsert/update + `/vendor/[token]` 화면)

corrupt→RED 실증 2회: `stats` 라우트 재생성 → R1 RED / 조작 문자열을 코드에
삽입 → R2 RED. 원복 후 15 passed.

## 2. 후속 트랙 재정의

- **§vendor-request-respond 폐기** → **§vendor-portal-identity** 로 대체.
  벤더 로그인 계정 체계가 서면 그때 포털을 **새로 설계**한다.
  지금 것을 되살리는 트랙이 아니다.

## 3. 전수 조사는 하지 않는다

호영님 지시: 범위 폭발을 피한다. **사례가 하나 더 나오면 그때 착수.**
그때를 위해 §1-2 의 진행 형태를 남겼다.

## 4. 이번에 건드리지 않은 인접 결함 (보고만)

- `vendor-sidebar` 의 `My Products`(`/vendor/products`) · `Settings`(`/vendor/settings`)
  는 **대응 페이지가 존재하지 않는다** → 클릭 시 404. 이번 폐기 범위 밖이라 두었다.
- `/api/vendor` 하위 나머지(`info` `insights` `quotes` `billing` `premium`
  `quotes/[quoteId]/response` `auth/send-link`)는 **전부 DB 기반**임을 실측했다.
  mock 은 이번에 지운 3개(`requests` `requests/[id]` `stats`)뿐이었다.
