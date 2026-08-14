# §phantom-field-surface — 없는 **필드·컬럼**을 쓰는 라이브 표면

- **Status:** 등재 (2026-08-12, 왕복 검증 4단계 실측) · 교정 미착수 · **전수 스캔 안 함**
- **성격:** §phantom-model-call 의 **필드판**. 세 번째 사례가 나와 **패턴으로 확정**.

---

## 0. 🛑 운영에서도 깨져 있다

개발 DB 는 운영 스키마를 **정확히 재현**했다(replay 후 columns 1326 / enums 43 /
indexes 511 — 세 축 모두 차이 0). 따라서 아래 500 들은 **개발에서만 그런 것이 아니라
지금 라이브 결함**이다.

## 1. 실측 (2026-08-12, 왕복 검증 4단계)

조직 OWNER 세션으로 세 갈래 대표 1곳씩 호출했다.

| 갈래 | 결과 | 원인 |
|---|---|---|
| SDS (`[ADMIN, VIEWER]` 형) | **200** | 정상 — Phase 1 이 실제로 열렸다 |
| 안전지출 (`ADMIN\|\|APPROVER\|\|VIEWER` 형) | **500** | `api/safety-spend/route.ts:105` `$queryRawUnsafe` → `column "totalAmount" does not exist` (42703) |
| 보안설정 (`role` 단독 where 형) | **500** | `api/organizations/[id]/security/route.ts:29` → `Unknown field allowedEmailDomains for select statement on model Organization` |

⚠️ **셋 다 403 이 아니다.** 권한 게이트(Phase 1)는 세 갈래 모두 통과했고,
둘은 **그 뒤에서** 깨졌다. 권한 결함과 섞어 읽지 말 것.

## 2. 패턴 확정 — `db` 가 `any` 인 비용이 **세 층**에서 다 드러났다

| # | 사례 | 층 |
|---|---|---|
| 1 | `complianceLink` · `quoteList` · `inventory` 등 | **모델** 이름이 없다 |
| 2 | `ssoEnabled`/`ssoConfig` 외 4개 (§sso-phantom-wiring) | **필드** 가 없다 (Prisma select/update) |
| 3 | `allowedEmailDomains` · `totalAmount` (이 문서) | **필드/컬럼** 이 없다 (select · **raw SQL**) |

세 번째 사례가 나왔으므로 **국소가 아니라 패턴**이다.
§db-any-escape-hatch 의 근거가 하나 더 쌓였다.

## 3. 탐지 경로가 갈린다 — **이 문서의 실질적 가치**

| 유형 | 탐지 | 사례 |
|---|---|---|
| **모델 없음** | ✅ §phantom-model-call sentinel 이 잡는다 | `complianceLink` |
| **필드 없음 (Prisma select/update)** | 🛑 **sentinel 사각** — Prisma 가 **런타임에** 거부 | `allowedEmailDomains` |
| **컬럼 없음 (raw SQL)** | 🛑 **완전 사각** — 타입 검사를 통째로 우회 | `totalAmount` |

**두 번째·세 번째를 잡을 방법이 지금 없다.**
- 2번은 Prisma 클라이언트 타입을 쓰면(`dbTyped`) 컴파일에 걸리나, `db`(any)를 쓰는 한 안 걸린다
- 3번은 `dbTyped` 로도 못 잡는다. SQL 문자열이라 **DB 스키마와 대조하지 않으면 알 수 없다**

## 4. §raw-sql-audit — 추정이 **실증**으로 바뀌었다

그 트랙은 `$queryRawUnsafe` 90 + `$executeRawUnsafe` 46 = **136회**를 계수하고
*"이 sentinel 의 사각지대"* 라고 경고만 해 두었다. 착수 근거가 **추정**이었다.

**`totalAmount` 가 그 사각에서 나온 실제 결함이다.** 이제 근거는 실증이다.
(다만 그 트랙의 본체는 여전히 주입 위험이며, 이 사례는 "정합성" 축의 추가 근거다.)

## 5. 하지 않은 것

**전수 스캔을 하지 않았다**(호영님 판단 — 별도 트랙 크기).
위 두 건은 **표본**이며 상한이 아니다. 다른 표면에 더 있을 것이다.

## 6. 착수 시 고려

- 2번 유형: `db` → `dbTyped` 전환이 입구다(§phantom-model-call 과 같은 처방)
- 3번 유형: raw SQL 이 참조하는 컬럼을 **schema.prisma 와 대조하는 sentinel** 이
  필요하다. 문자열 파싱이라 정밀도가 낮을 수 있으니 **하한 보고 금지**(§3-4) 규율을
  먼저 정해야 한다
