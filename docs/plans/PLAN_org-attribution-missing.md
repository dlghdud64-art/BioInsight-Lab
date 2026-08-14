# §org-attribution-missing — 조직 축 모델에 귀속 없이 행이 쌓인다

- **Status:** 등재 (2026-08-15) · **미수정** · 축: **데이터 귀속** (유출 축 아님)
- **발견 경위:** §tenant-isolation 4-3 (`ops-sync`) + 3차 (`protocol/bom` 대조군)
- **"A트랙이 안 닫는 축" 4번째** — scopeKey · 전역 카탈로그 · 귀속

---

## 0. 형태

> **`userId` 축 라우트가 org 축 모델에 행을 만들면서 `organizationId` 를 비워 둔다.**

유출이 아니다. 그러나 결과는 조용하고 누적된다:

1. 조직 단위 집계·대시보드가 이 행들을 **못 본다**(org 필터로 조회되지 않음)
2. **누구 조직 것도 아닌 행**이 쌓인다
3. 나중에 org 필터를 강화하면 **조용히 유실**된다

## 1. 확인된 2건 (실측)

| 경로 | 모델 | 관측 |
|---|---|---|
| `POST /api/work-queue/ops-sync` | `AiActionItem` | `organizationId: null` 로 생성. `createWorkItem` 은 org 를 **받을 수 있는데**(work-queue-service:152·166) 라우트가 넘기지 않는다 |
| `POST /api/protocol/bom` (정상 경로) | `Quote` | 호출부 2곳이 `organizationId` 를 안 보내므로 **null 로 생성**된다 |

⚠️ `protocol/bom` 은 §tenant-isolation 3차에서 **유출도 확정**됐다(바디 주입).
같은 라우트가 **주입은 받고 정상 귀속은 안 한다** — 한 번의 수정으로 둘 다 닫힌다
(세션 멤버십 도출로 교체).

## 2. 🛑 B트랙 선결 점검 항목

> **B트랙(`enforceAction` async 화 + org 내부 조회)이 바로 "org 필터 강화"다.**

B트랙이 org 판정을 실제로 켜는 순간, `organizationId: null` 행들은
**어느 조직에서도 안 보이게 된다**(또는 deny-by-default 폴백에 걸린다).

**B트랙 착수 전 이 카드를 먼저 점검한다** — 귀속 없는 기존 행의 처리(백필/보류)를
정하지 않고 켜면 데이터가 조용히 사라진 것처럼 보인다.

## 3. 관계

- §tenant-isolation-placeholder — 발원지. A트랙이 닫지 않는 축
- §scopekey-axis-unmeasured · §global-catalog-write-authz — 같은 계열(닫히지 않는 축)
- §unvalidated-create — **다르다.** 저쪽 벡터는 임의 바디, 이쪽은 귀속 누락
