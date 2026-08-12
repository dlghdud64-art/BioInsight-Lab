# §dev-prod-db-separation — 로컬이 운영 DB 에 직결돼 있다

작성: 2026-08-10
상태: **실측 완료 / 방식 판단 대기(호영님)** — 마이그레이션 적용 보류 중
발원: §phantom-model-call 왕복 스모크 판정 중 발견

---

## 0. 실측

```
apps/web/.env        DATABASE_URL host = aws-1-ap-northeast-1.pooler.supabase.com:6543
apps/web/.env        DIRECT_URL   host = aws-1-ap-northeast-1.pooler.supabase.com:5432
apps/web/.env.local  DATABASE_URL host = (동일)
apps/web/.env.local  DIRECT_URL   host = (동일)
```

**개발 환경의 `.env` 와 `.env.local` 이 둘 다 운영 Supabase 를 가리킨다.**
로컬에서 실행되는 모든 것이 운영 데이터를 읽고 쓴다.

## 1. ⚠️ 즉시 위험 — `npm run db:migrate` 가 `prisma migrate dev` 다

```json
"db:migrate": "prisma migrate dev",
"prisma:migrate": "prisma migrate deploy",
```

`migrate dev` 는 shadow DB 를 만들고 **drift 를 감지하면 reset 을 제안**한다.
지금 `.env` 가 운영을 가리키므로 **`npm run db:migrate` 한 번이 운영 스키마를 직접 건드린다.**
DEV_RUNBOOK §9.9 에 기록된 2026-06-14 사고와 같은 경로다.

Prisma CLI 는 `.env` 만 읽고 `.env.local` 은 읽지 않는다 — 즉 Next.js 런타임과 CLI 의
접속 대상이 갈릴 수도 있는 구조이며, 지금은 둘 다 운영이다.

## 2. 이번에 함께 드러난 것 — `NODE_ENV` 기반 가드는 무력하다

`admin/seed` 의 프로덕션 가드가 `NODE_ENV === "production"` 기준이었다.
로컬은 `NODE_ENV=development` 인데 DB 는 운영이므로 **가드가 통과시키고 seed 가 운영
데이터에 upsert 된다.**

> **`NODE_ENV` 는 코드가 어디서 도는지를 말할 뿐, 데이터가 어디로 가는지를 말하지 않는다.**

→ 판정 기준을 **DB host** 로 바꿨다(`src/lib/security/production-database.ts`).
sentinel S1-c 가 `NODE_ENV` 단독 형태로의 회귀를 막는다. corrupt→RED 실증 완료.

### 같은 결함이 다른 곳에도 있는가 — 전수 계수 결과

`NODE_ENV` 참조 **36회** 중, 근처에 파괴적/쓰기 동작이 있는 파일은 **1건**
(`src/app/error.tsx` — 스택 노출 분기, 파괴적 아님 = 오탐).

**즉 `NODE_ENV` 로 파괴적 동작을 막던 지점은 `admin/seed` 가 유일했고 이미 교정했다.**
나머지 35회는 로깅·디버그 분기다.

## 3. 선결 작업 (호영님 2026-08-10)

마이그레이션 적용은 **개발 DB 분리 전까지 보류**. 설계 문서는 진행.

1. 개발용 별도 DB 확보
2. `.env` 분리 — 개발은 개발 DB, 운영 접속은 별도 파일/환경변수로만
3. 운영 스키마 변경은 `migrate deploy` 로 한정. `migrate dev` 는 운영 URL 에서 실행 불가하게
4. 실행 전 현재 운영 DB 백업 1회

## 4. 방식 실측 — 어느 쪽이 이 레포에 붙이기 쉬운가

호영님이 판단하실 근거만 정리한다(추천은 하되 결정은 아님).

| 항목 | 별도 Supabase 프로젝트 | 로컬 Postgres |
|---|---|---|
| 이 레포 준비 상태 | `.env` 값만 교체 — **추가 설치 0** | docker-compose **없음**(레포에 파일 자체가 없다). Windows 에 Postgres 직접 설치 또는 Docker Desktop 필요 |
| 접속 형태 동일성 | 운영과 동일(pooler 6543 / direct 5432) — **접속 계층 차이로 인한 사고 재현 없음** | 로컬은 단일 접속. pooler 관련 문제(예: `migrate` 가 6543 에서 멈추는 현상)가 로컬에서 재현되지 않아 **운영에서만 터진다** |
| 마이그레이션 검증 충실도 | 54개 마이그레이션을 운영과 같은 엔진/설정에서 재생 가능 | 엔진 버전·확장 설정이 갈릴 수 있음 |
| 비용 | 무료 티어 1개 추가 | 0 |
| 오프라인 작업 | 불가 | 가능 |
| 스키마 확장 의존 | 실측: 특수 확장 의존 **없음**(provider=postgresql, previewFeatures 없음) → 양쪽 다 가능 | 동일 |

**정리**: 스키마가 특수 확장을 안 쓰므로 기술적으로는 둘 다 가능하다.
다만 이 레포는 **pooler(6543)/direct(5432) 이원 접속**을 전제로 하고 그 차이가 과거 사고의
원인이었다(메모리: `migrate deploy` 는 DIRECT_URL 5432 필수). 로컬 Postgres 는 그 축을
재현하지 못한다.

→ **별도 Supabase 프로젝트 쪽이 이 레포에는 붙이기 쉽고 검증 충실도도 높다**는 것이 실측
소견이다. 결정은 호영님.

## 5. 마이그레이션 계획서 선결 조건 (명시)

스키마 상신 4종(`compliance_link` + `inventory_alert_setting` + `inventory_alert_log`
+ `quote_item_vendor_column`)의 **적용**은 위 §3 4항목이 끝난 뒤에만 진행한다.
설계·리뷰·승인은 병행 가능하다.
