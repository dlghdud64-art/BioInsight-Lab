# LabAxis Web — Dev Runbook

> **Scope:** `apps/web` 개발자 데일리 명령 reference.
> **Last Updated:** 2026-04-18 (Jest → Vitest 단일화 완료 시점)
>
> 이 문서는 daily-use runbook 입니다. 설계 근거 / PRD 는 `docs/PRD*.md`, `docs/billing-lifecycle.md` 쪽을 보세요.

---

## 1. 최초 셋업

```powershell
# 레포 루트 기준
npm install
```

- `apps/web/package.json` 의 `postinstall: prisma generate` hook 이 자동으로 Prisma Client 를 만듭니다.
- `.env` 는 `apps/web/.env` 에 `DATABASE_URL` 포함 필수. 누락 시 Prisma generate 가 멈춥니다.

---

## 2. 테스트 (Vitest 단일 runner)

Jest 는 2026-04-18 부로 완전 제거되었습니다. 모든 테스트는 **Vitest** 로 돌립니다.

```powershell
# apps/web 기준
cd apps\web

# 1회 실행 (CI 와 동일)
npm run test

# watch 모드
npx vitest

# 특정 파일만
npx vitest run src/__tests__/lib/api/products.test.ts

# UI 대시보드
npx vitest --ui
```

### 2.1 새 테스트 작성 규칙

- `import { describe, it, expect, vi } from "vitest";` 만 사용. `@jest/globals` 는 금지.
- `vi.fn()` / `vi.mock()` / `vi.spyOn()` 사용. `jest.*` 는 금지.
- `vitest.config.ts` 의 `globals: true` 설정으로 `describe / it / expect` 는 import 없이도 동작하지만, 명시적 import 를 권장합니다 (타입·lint 안정성).
- 타입 캐스팅 시 `vi.Mock` 대신 `import { type Mock } from "vitest"` → `as Mock<typeof fn>`. 애매하면 `as any` 로 피해가되 `@ts-nocheck` 남발은 지양.
- next-auth 를 쓰는 페이지/API 테스트는 vitest alias 로 자동 mock 됩니다. 별도 mock 코드 불필요 (`apps/web/src/__mocks__/auth.ts`, `__mocks__/next-auth.ts` 참고).

### 2.2 정적 잔여물 점검 (새 PR 전 한 번)

```powershell
# 아래 셋 모두 0 이어야 함
Select-String -Path apps\web\src -Pattern "@jest/globals" -Recurse
Select-String -Path apps\web\src -Pattern "\bjest\.(fn|mock|spyOn|clearAllMocks)\b" -Recurse
Select-String -Path apps\web\src -Pattern "require\(""vitest""\)" -Recurse
```

Linux / mac 이라면:

```bash
grep -rl "@jest/globals" apps/web/src/
grep -rlE "\bjest\.(fn|mock|spyOn|clearAllMocks)\b" apps/web/src/
grep -rlE 'require\("vitest"\)' apps/web/src/
```

---

## 3. Prisma

### 3.1 일상 명령

```powershell
cd apps\web

# schema.prisma 변경 후 Client 재생성
npm run db:generate

# 새 migration 생성 (dev DB 에 즉시 적용 + migration 파일 생성)
npx prisma migrate dev --name <change_summary>

# 프로덕션/CI 에서 migration 적용만
#
# 🛑 반드시 5432 세션 풀러로 실행한다 (§migrate-pooler-deadlock, 2026-08-12).
#    schema.prisma 에 directUrl 이 없어(ADR-002 §11.13) migrate 는 DATABASE_URL 을 쓰는데,
#    그 값이 6543 transaction pooler 면 advisory lock 을 못 잡아 **무한 대기**한다.
#    ⚠️ 에러도 타임아웃도 없다 — 무출력으로 매달린다. "느린가 보다" 로 읽힌다.
#
#    실행 형태 (DATABASE_URL 을 DIRECT_URL 값으로 덮어쓴다):
#      DATABASE_URL="<DIRECT_URL 값 = ...:5432/postgres>" npx prisma migrate deploy
#
# 🛑 새 DB 를 세울 때는 마이그레이션 **전에** 확장을 먼저 만든다
#    (§migration-extension-gap): CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
#    마이그레이션 파일에 CREATE EXTENSION 이 없어 0_init 이 42704 로 실패한다.
npm run prisma:migrate

# 실 DB vs schema.prisma 상태 비교
npx prisma migrate status

# 실 DB 를 schema 로 역동기 (주의: 수동 검증 후 사용)
npx prisma db pull
```

### 3.2 PR 체크리스트 (schema 변경 시)

- [ ] `apps/web/prisma/schema.prisma` 변경분과 `apps/web/prisma/migrations/<ts>_*` migration 파일이 **쌍으로** 커밋되었는가
- [ ] enum 을 추가/삭제했다면 DB 에 이미 반영된 enum 값과 일치하는가 (`npx prisma migrate status`)
- [ ] `npm run db:generate` 후 `npx tsc --noEmit` 통과
- [ ] `NOT NULL` 추가 시: 기존 row 에 기본값이 있는지 / backfill 스크립트가 있는지

### 3.3 배포 경로

🛑 **push·배포는 마이그레이션을 적용하지 않는다.** `vercel-migrate.js` 는 2026-04-25(ADR-002 §11.13)
부터 **NO-OP** 이고 빌드는 DB 에 접속하지 않는다. DDL 은 §9 의 operator-shell 절차 단독이다.

⚠️ 이 절은 2026-08-22 까지 *"Vercel prebuild 가 자동 실행합니다"* 로 남아 있었고,
   그 문장을 근거로 **DDL 없이 코드만 배포해 프로덕션 P2022 를 냈다.**
   §9.1 이 경계하는 *"Vercel 이 자동 migrate 한다"는 false promise* 가 **바로 이 줄이었다** —
   §9 는 고쳐졌는데 §3.3 이 옛 약속을 들고 있었다.
   🔑 문서가 자기모순일 때 **읽는 사람은 먼저 만난 절을 믿는다.**

배포 순서: **code → migrate(§9) → verify → push → promote**

---

## 4. 타입 / 린트

```powershell
cd apps\web
npx tsc --noEmit
npm run lint          # 설정되어 있다면
```

- 새 파일에 `@ts-nocheck` 을 넣지 마세요. 기존 94개는 순차 정리 중입니다.
- `any` 는 허용하되, 한 PR 내에서 5개 이상 추가되면 타입을 재설계하세요.

---

## 5. 자주 막히는 에러

| 증상 | 원인 | 해결 |
| :--- | :--- | :--- |
| `Cannot find module '@prisma/client'` | `postinstall` 이 실패했거나 `DATABASE_URL` 누락 | `apps/web/.env` 확인 → `npm run db:generate` 수동 실행 |
| `ERR_REQUIRE_ESM` on `vitest` | test 파일이 CJS `require("vitest")` 사용 | `import { ... } from "vitest"` 로 교체 |
| `@jest/globals` parse error | Jest 잔재 | 이 문서 §2.1 grep 명령 실행 후 발견된 파일 포팅 |
| `toBeInTheDocument is not a function` | vitest.setup 이 로드되지 않음 | `apps/web/vitest.config.ts` 의 `setupFiles` 확인 |
| 배포 후 lambda 가 `P2021`/`P2022` (테이블·컬럼 없음) | **push 는 migration 을 적용하지 않는다** — 빌드는 DB 무접촉(§9.4). schema 만 배포되고 DDL 미적용 | §9.2 순서 복구: operator shell 에서 `prisma migrate deploy`(`:5432`) → `npm run smoke:migration` → `/api/health` `clean:true` 확인 |
| `prisma generate` 가 schema drift 보고 | 실 DB 와 schema 불일치 | `npx prisma migrate status` 로 확인 → `migrate deploy` 또는 `db pull` 로 동기 |
| ~~Vercel 빌드에서 `P1000: Authentication failed` (scripts/vercel-migrate.js)~~ | **OBSOLETE 2026-04-25 (ADR-002 §11.13).** build-time migrate 자체가 폐지되어 빌드는 DB 에 접속하지 않는다 — `vercel-migrate.js` 는 NO-OP 로그 2줄만 출력 | 이 증상은 더 이상 발생하지 않는다. `SKIP_PRISMA_MIGRATE` 우회도 폐지(스크립트가 참조하지 않음). schema 적용은 §9.2 operator-shell 절차 단독이며 **DDL 포트는 session pooler `:5432`**(`:6543` 은 advisory-lock 미지원 → DDL 락/실패) |
| 안전 대시보드에서 **"MSDS 등록" 버튼이 안 보임** / 업로드 시 `403 SDS_UPLOAD_FORBIDDEN` | **권한 부족이며 정상 동작이다** (§sds-upload-role-gate, 2026-08-09). `docType=sds` 업로드는 **global ADMIN · SUPPLIER · 조직 ADMIN/VIEWER(safety_admin)** 합집합만 허용한다. 조직 미소속 RESEARCHER 는 대상이 아니다 — 버튼도 렌더되지 않는다(disabled 아님, 미생성) | **조직 가입이 선결 조건**: 해당 사용자를 조직에 `ADMIN` 또는 `VIEWER`(=safety_admin) 로 추가하면 즉시 열린다. 또는 권한자가 대신 등록. ⚠️ **COA(시험성적서)는 무관** — `docType=coa` 는 role 게이트가 없고 입고 lot 소유권만 본다(재고 패널에서 RESEARCHER 도 자기 lot COA 업로드 가능). "안전 문서를 못 올린다"는 문의가 오면 먼저 sds/coa 중 무엇인지부터 가릴 것 |

---

## 6. 참고

- Plan: `docs/plans/PLAN_test-runner-and-prisma-stabilization.md`
- Billing lifecycle: `docs/billing-lifecycle.md`
- 결제 교체 (deferred): `docs/plans/PLAN_toss-payments-migration.md`

---

## 7. Isolated WRITE smoke env 네이밍 (ADR-001 Option B)

`#26 S01/S02/S03` write smoke 는 production DATABASE_URL 과 **다른** Supabase test
project 를 타겟팅한다. 네이밍·분리 규칙은 `apps/web/scripts/smoke/guard.ts` 가
강제한다. 상세 체크리스트는 `docs/decisions/ADR-001-provisioning-checklist.md`.

| Env name | 성격 | 저장 위치 |
| --- | --- | --- |
| `DATABASE_URL_SMOKE` | test project 전체 connection string | **secret** — 로컬 shell 또는 gitignored `.env.smoke` 만. checked-in `.env` 금지 |
| `SMOKE_DB_PROJECT_REF` | test project-ref (식별용 단일 값) | 공개 가능 |
| `ALLOWED_SMOKE_DB_SENTINELS` | 허용 project-ref 리스트 (콤마 구분) | 공개 가능 |
| `PRODUCTION_DB_PROJECT_REF` | self-guard 용 production project-ref | 공개 가능 (식별용) |

Smoke runner 는 `assertSmokeDatabaseTarget()` 를 진입부에서 호출한다. guard 는
fail-closed — DATABASE_URL_SMOKE 미설정, allow list 부재, production-ref 가 allow
list 에 섞여 있는 경우 모두 즉시 abort 한다.

---

## 8. Pilot tenant env 네이밍 (ADR-002 Option C)

`#P01` pilot 운영은 **production DB 에 sentinel 로 격리된 pilot tenant** 를 seed
한다. 네이밍·가드는 `apps/web/scripts/pilot/guard.ts` 가 강제하며, 상세 결정
근거는 `docs/decisions/ADR-002-pilot-tenant-seed.md`.

§7 smoke 와 **env 이름이 전혀 겹치지 않도록** 설계되어 있어 실수로 두 트랙이
섞이는 것을 구조적으로 차단한다. allow-list 의미가 반대이므로(smoke 는
production-ref 를 차단, pilot 은 production-ref 가 있어야만 통과) 특히 주의.

| Env name | 성격 | 저장 위치 |
| --- | --- | --- |
| `DATABASE_URL_PILOT` | pilot target (production DB) 전체 connection string. **포트는 반드시 `:5432` (session pooler).** transaction pooler `:6543` 는 Prisma `$transaction` 과 충돌 — ADR-002 §11.7 참조. | **secret** — 로컬 shell 또는 gitignored `.env.pilot` 만. checked-in `.env` 금지 |
| `ALLOWED_PILOT_DB_SENTINELS` | 허용 project-ref 리스트 (콤마 구분). production ref 가 반드시 포함 | 공개 가능 |
| `PILOT_REQUIRES_EXPLICIT_OPT_IN` | 정확 일치 필요한 opt-in 토큰. 현재 값: `YES-SEED-PRODUCTION-PILOT-2026` | 공개 가능 (식별용) |
| `PILOT_OWNER_USER_ID_OVERRIDE` | §11.2 deviation 전용. 생산 외 DB(smoke 등)에서 owner cuid 가 다를 때만 설정 | 공개 가능 |

실행 순서:

```sh
# 1. Seed (idempotent upsert chain under $transaction)
pnpm -C apps/web tsx scripts/pilot/pilot-seed.ts

# 2. Cleanup dry-run (present=true/false 리스트만, 삭제 없음)
pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts

# 3. 실제 삭제
pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts --apply
```

Pilot runner 는 `assertPilotDatabaseTarget()` 를 진입부에서 호출한다. guard 는
fail-closed — opt-in 토큰 불일치, DATABASE_URL_PILOT 미설정, URL 의 project-ref
가 allow list 에 없는 경우 모두 즉시 abort 한다. 이후 `pilot.ts` 의
`PILOT_OWNER_PROTECTION` 가 cleanup 진입 시 로그로 출력되어 "User row 는 절대
삭제되지 않는다" 는 원칙을 운영 로그에서 재확인할 수 있게 한다.

**포트 주의 (ADR-002 §11.7 / §11.9)**: guard 는 port 를 검사하지 않는다. 세
경로별 포트 사용은 다음과 같이 **완전히 분리**된다:

| 경로 | 포트 | 이유 |
| --- | --- | --- |
| Operator shell — `pilot-seed.ts` / `pilot-cleanup.ts` 등 `tsx scripts/...` | **`:5432`** (session pooler) | Prisma `$transaction([...])` 는 sticky connection 요구. transaction pooler 는 statement 단위 분산으로 세션 락 깨짐. |
| ~~Vercel build-time — `scripts/vercel-migrate.js`~~ | ~~`:6543`~~ | **OBSOLETE 2026-04-25 (§9, ADR-002 §11.13).** Vercel build 인프라에서 양쪽 풀러 모두 unreachable 가 검증되어 build-time migrate 자체를 폐지함. `vercel-migrate.js` 는 no-op log 만 출력. migrate 는 §9 의 operator-shell 절차로만 실행. |
| App runtime — Next.js serverless functions (`apps/web/src/app/api/**`) | **`:6543`** | 기존 convention. 변경 없음. |

즉 session pooler 는 **오직 operator shell 의 pilot seed/cleanup 시점에만**
쓰이고, 나머지는 전부 transaction pooler. pilot 실행 시 `DATABASE_URL_PILOT`
의 포트가 `:5432` 인지 반드시 확인할 것. Vercel env 의 `DATABASE_URL` 은
`:6543` 이어야 한다.

---

## 9. Schema migration — operator-shell only (γ-shell, 2026-04-25)

ADR-002 §11.13 결정: **Vercel build-time `prisma migrate deploy` 는 영구
폐지**. 모든 schema migration 은 operator shell 에서 직접 실행한다.

### 9.1 왜 이렇게 갔는가

§11.9 → §11.10 → §11.11 → §11.12 검증 결과 Supabase 풀러 (`:5432`,
`:6543` 모두) 가 Vercel build 인프라에서 unreachable 임이 field-validated.
build-time migrate 는 `[prebuild] TIMED OUT after 90s — continuing build` 만
출력하고 production schema 에는 아무것도 적용되지 않는 상태가 6주 가까이
지속됐다. 이를 "Vercel 이 자동 migrate 한다"는 false promise 로 두기보다
**code → migrate → verify → push** 라는 명시적 절차로 바꿔 canonical truth
를 회복한다. 이미 `pilot-seed.ts` / `pilot-cleanup.ts` / `#26 S01-S03`
write-chain smoke 에서 검증된 동일 패턴.

### 9.1a 🛑 0단계 — 대상 DB 정체 확인 (2026-08-22 사고)

```
DDL 을 넣기 전에 **어느 DB 에 넣는지** 확정한다. 로컬 .env 는 프로덕션이 아닐 수 있다.
```

2026-08-22 실측: 로컬 `.env` 의 DIRECT_URL 은 **개발 DB**(ref `tvkl…pzqr` @ aws-0)였고
프로덕션은 **다른 프로젝트**(ref `xhid…dhsw` @ aws-1)였다. ref 도 리전 클러스터도 달랐다.

🛑 **적용도 검증도 같은 잘못된 대상을 봤다.**
```
migrate deploy        로컬 .env → 개발 DB   "성공"
information_schema    로컬 .env → 개발 DB   "컬럼 있음"
런타임                프로덕션 env → 다른 DB  P2022 컬럼 없음
```
두 번 확인했으나 **축이 하나**라 교차검증이 성립하지 않았다.

**처방 — 검증 출력은 접속 대상을 스스로 단언한다:**
```sh
# 컬럼 확인과 **동시에** 어느 DB 를 본 것인지 같이 찍는다
select current_database() as db,
       split_part(current_setting('log_line_prefix', true), '', 1) as _,
       (select count(*) from information_schema.columns
        where table_name='Organization' and column_name='invitePolicy') as col;
```
+ 접속 URL 의 **ref 앞4·뒤4** 를 출력에 병기한다(값 전체 금지).
  기대 ref 와 다르면 **그 자리에서 중단**한다.

🔑 이건 §gate-script-silent-fail 의 *"검증은 대상에 닿았음을 스스로 단언한다"* 의 DB 판이다.
   게이트는 "무엇을 봤는가", DB 검증은 "어디를 봤는가" 를 자기 안에 담아야 한다.

### 9.2 표준 절차 (schema 변경 시)

1. **로컬에서 schema 변경 + 마이그레이션 생성:**
   ```sh
   # apps/web/prisma/schema.prisma 수정
   pnpm -C apps/web prisma migrate dev --name <짧은_변경_요약>
   ```
   → `apps/web/prisma/migrations/<ts>_<name>/migration.sql` 생성됨.
   생성된 SQL 을 사람이 직접 검토.

2. **변경 + 마이그레이션 파일을 같이 commit:**
   ```sh
   git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/<ts>_<name>/
   git commit -m "schema: <change>"
   ```
   아직 push 하지 않는다.

3. **Production DB 에 직접 apply (operator shell):**
   ```sh
   # apps/web/.env 가 production DATABASE_URL 을 가리키고 있는지 확인
   pnpm -C apps/web prisma:migrate     # = prisma migrate deploy
   ```
   `npm run prisma:migrate` 도 동일.

   > ⚠️ **연결 경로 (2026-07-04 §cas-hazard-classification 학습):** `migrate deploy` 의
   > DDL 은 **session pooler `:5432`** 로 실행해야 한다. transaction pooler `:6543`
   > 는 advisory-lock 미지원 → DDL 실패/락. 또한 `.env.local` 의 direct host
   > `db.<project-ref>.supabase.co:5432` 는 **unreachable**(Supabase IPv4 direct
   > deprecated → P1001, DB 무변경). 표준 override:
   > ```sh
   > DATABASE_URL="postgresql://…@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" \
   >   pnpm -C apps/web exec prisma migrate deploy
   > ```
   > (= `DATABASE_URL_PILOT` 과 동일 session pooler host. §9 pooler 표 참조.)

4. **Smoke probe 로 적용 확인:**
   - 영향받은 route 1~2개를 직접 호출 (예: `/api/health`, 또는 변경된
     entity 의 list/detail endpoint)
   - 기대 응답 / 타입이 새 스키마와 일치하는지 확인

5. **그 뒤에 push:**
   ```sh
   git push origin main
   ```
   Vercel 이 새 build 를 시작하지만 prebuild step 은 no-op 이므로
   `[prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002
   §11.13).` 한 줄만 출력하고 빠르게 통과. 새 코드는 이미 migrated
   schema 위에서 실행된다.

### 9.3 안전 가드

- **순서 위반 금지**: code 가 먼저 production 에 배포되고 schema 는
  나중에 migrate 되면, lambda 가 P2021/P2003 같은 schema-drift 에러로
  500 을 던진다. 반드시 `migrate → verify → push` 순서.
- **Operator 단독 실행**: `prisma migrate deploy` 는 production DB 를
  직접 변경한다. CI 자동화 없이 호영이 직접 실행하는 것이 §11.13 결정의
  핵심 (가시성 + 책임 명시).
- **DATABASE_URL 안전 체크**: 실행 전 `apps/web/.env` 의
  `DATABASE_URL` 의 project-ref 가 `xhidynwpkqeaojuudhsw` 인지 확인.
  smoke / pilot DB 와 혼동 방지는 `pilot-guard.ts` / `smoke-guard.ts`
  패턴을 참고하면 좋지만 schema migrate 자체에는 그런 guard 가 없다.
- **롤백**: `prisma migrate resolve --rolled-back <migration_name>` +
  보정 마이그레이션 작성. Prisma 는 자동 down migration 을 제공하지
  않으므로 backup-first 를 권장.

### 9.4 env 스코프 — Vercel 과 operator 로컬은 **반대다** (§migration-rollout-gate, 2026-08-08)

⚠️ 이 절은 스코프를 혼동하면 정반대 사고를 낸다. 두 표면을 분리해서 읽을 것.

| 스코프 | `DIRECT_URL` | `SKIP_PRISMA_MIGRATE` | 근거 |
| :--- | :--- | :--- | :--- |
| **Vercel env (배포)** | **불필요 · 제거 완료. 재추가 금지** | **불필요 · 제거 완료** | 배포 코드에 두 값을 읽는 주체 0. `schema.prisma` 의 `directUrl` 제거(ADR-002 §11.13), `vercel-migrate.js` 는 NO-OP. **실측 2026-08-08: prod `/api/health` → `hasDirectUrl: false`** |
| **operator 로컬 `.env`** | **유지 필수** | 불필요 | `migrate deploy` 의 DDL 은 session pooler `:5432` 로만 작동(§9.2 step 3)하고, `npm run smoke:migration` 은 `.env` 의 `DIRECT_URL` 을 **우선 로드**해 `:5432` 를 선검증한다(§9.10-2) |

- **Vercel 에 재추가 금지**: 과거 재추가/정리 과정에서 `DATABASE_URL` 값이 함께
  변형되는 사고 전례가 있다. 배포 표면에는 읽는 주체가 없으므로 얻는 것이 0.
- **로컬에서 제거 금지**: 제거하면 drift 게이트가 `DATABASE_URL`(`:6543`)로
  떨어져 **상시 exit 2 (STOP)** 가 된다. §9.5 step 1 의
  `$env:DATABASE_URL = $env:DIRECT_URL` 우회도 동일 의존.

**빌드는 DB 에 접촉하지 않는다 — `push` ≠ `migration 적용`.**
실증(2026-08-08 배포 `dpl_213TwWpVJPw8RKnHPBMAmyhuwd3q`, commit `c476c2b`):
빌드 로그는 `npm install` → `npm run build` → `web@0.1.0 prebuild` →
`[prebuild] vercel-migrate.js is a NO-OP` 경로만 실행한다. 적용 확인 절차는
신설하지 않는다 — **§9.10 의 가드 3종(HEAD 일치 · `smoke:migration` ·
`/api/health` `clean:true`)이 이미 정본**이다.

> 📌 (2026-08-08 정리) repo 루트의 `vercel.json` 은 삭제됐다. Vercel 프로젝트의
> Root Directory 가 `apps/web` 이라 `apps/web/vercel.json` 이 유효 판본이고,
> 루트 파일의 `buildCommand`(`npx prisma migrate deploy` 포함)는 빌드 로그에
> 출현한 적이 없다(미사용 실증). 무효 키 `rootDirectory` 를 담고 있어 애초에
> 의도대로 동작하지 않았다. 만약 Root Directory 를 repo root 로 되돌린다면
> 아래를 복구하되 **`migrate deploy` 는 넣지 말 것**:
> ```json
> { "buildCommand": "npx prisma generate && npm run build",
>   "installCommand": "npm install", "framework": "nextjs",
>   "outputDirectory": "apps/web/.next" }
> ```

### 9.5 Drift 검증 절차 (post-deploy 게이트, 2026-06-13)

§detail-page P2 세션(`§detail-page COA/SDS 경계`) 에서 누적 drift(OcrCacheHit·
GovernanceEvent false-alarm·SDSDocument.docType 미배포·pending 8건) 봉합 과정에서
확정된 표준 검증 절차. **각 deploy 직후 다음 3 게이트를 반드시 수행한다.**

```sh
# (1) project-ref 가드 — DATABASE_URL 의 project-ref 가 prod 인지 직접 echo
$env:DATABASE_URL = $env:DIRECT_URL  # operator-shell 우회 (Supabase pooler:5432)
# echo / Korean 1줄 확인: postgres.<project-ref>:...@aws-1-...pooler.supabase.com:5432

# (2) migrate status — "Database schema is up to date!" 확인
pnpm -C apps/web prisma migrate status

# (3) migrate diff — 빈 스크립트 = drift 0
pnpm -C apps/web prisma migrate diff \
  --from-url $env:DATABASE_URL \
  --to-schema-datamodel apps/web/prisma/schema.prisma --script
# 기대: "-- This is an empty migration." 1줄
```

**잔여 diff ≠ 0 = STOP**. 잔여 op 의 출처가 (a) Prisma 비관리 객체(CHECK constraint 등) 인지 (b) 미발견 drift 인지 식별 후 처리.

**A 트랙 (db push 잔재 봉합) 패턴**: schema↔prod 불일치가 발견되면 `migrate diff --script` 출력을 그대로 신규 migration 폴더에 박는다. `prisma migrate dev` 는 Supabase pgvector + Prisma shadow DB 호환 이슈(`type "vector" does not exist`)로 실패하므로 **수동 폴더 + diff 출력 복붙** 이 표준 우회. 사후 게이트(위 3건) 로 shadow-replay 검증 상실을 보완한다.

### 9.6 Prisma 비관리 CHECK constraint — 부채 노트

`schema.prisma` 는 SQL `CHECK constraint` 를 표현하지 못한다. `§detail-page P2`
의 `SDSDocument_coa_lot_check` (`docType ∈ {'sds','coa'}` 강제 + COA/SDS 경계) 는
migration.sql 에 직접 박혔으며, 향후 다음 시나리오에 주의:

- **현재 (Prisma 5.22)**: `migrate diff` 가 CHECK 자체를 introspection 안 함 →
  drift 로 감지 안 됨. 추가/유지 안전. (실증 2026-06-13)
- **미래 Prisma 버전**: CHECK introspection 추가 가능성 있음. 만약 추가되면
  `migrate diff` 가 "schema 에 CHECK 없음 / prod 에 CHECK 있음" 으로 잡고 DROP
  을 제안. 이때 **반드시 DROP 무시 후 보존**. 구조적 방어(미스매치 차단) 값어치
  가 Prisma drift 부채 보다 큼.
- **docType 값 확장 (예: msds/spec)**: CHECK 동반 갱신 필수. 미갱신 시 신규
  docType INSERT 전면 차단. schema.prisma SDSDocument.docType 라인 주석에도 동일
  가드 박혀있음.

### 9.7 인프라 트랙 — shadowDatabaseUrl(pgvector 활성 DB)

`migrate dev` 정공법 복귀를 위해 `shadowDatabaseUrl` 에 pgvector extension 활성
DB 를 가리키도록 설정 권장. 수동 폴더 + 복붙 우회는 1~2회는 안전하나 반복 누적
시 shadow-replay 검증 상실이 부채. 별 트랙 (P-band-infra-shadow-pgvector) 로 분리.

### 9.8 (OBSOLETE) 옛 §9.1 / §9.2

이전 §9.1 (Non-fatal migrate + 90s timeout) 과 §9.2 (4-item 복구
체크리스트) 는 모두 build-time migrate 가 존재할 때의 운영 안전망이었다.
build-time migrate 가 폐지되어 양쪽 모두 의미 없음. 역사적 맥락은
ADR-002 §11.10 / §11.11 / §11.12 에 보존.

### 9.9 🛑 인시던트 — prod DATA WIPE (2026-06-14) + 하드 가드

> ⚠️ **2026-08-10 — 같은 경로로 두 번째.** §9.10 참조.
> 로컬 `.env`/`.env.local` 이 **둘 다 운영 Supabase** 를 가리키고 있었고,
> `db:migrate` 스크립트가 `prisma migrate dev` 였다. 즉 이 사고 경로가 그대로
> 재현 가능한 상태로 남아 있었다. 이번에는 터지기 전에 가드를 넣었다.


**무슨 일**: sandbox(cowork)에서 잔여 drift 확인용으로
`prisma migrate diff --from-migrations <dir> --shadow-database-url=$DIRECT_URL`
를 실행했다. `--from-migrations` 는 shadow DB 를 **드롭·리셋 후 migration replay**
한다. `$DIRECT_URL` 이 prod(`xhidynwpkqeaojuudhsw`)였으므로 **prod 전 테이블이
DROP→빈 재생성 = 전 데이터 소실**. `_prisma_migrations` 도 함께 초기화됐다.
Free 플랜이라 PITR/백업 없음 → 정상 복구 불가. dev 데이터였기에 `db push` +
`seed` 재구성으로 수습.

**근접 원인**: §9.5 의 안전한 drift 체크는 `migrate diff --from-url $env:DATABASE_URL`
(read-only introspection) 인데, 위험한 `--from-migrations --shadow-database-url`
(shadow 리셋·replay) 변형을 쓰고 그 shadow 를 prod 로 가리킨 것.

**하드 가드 (위반 금지)**:
1. **drift 체크는 `--from-url` 만.** §9.5 패턴 고수. `--from-migrations
   --shadow-database-url=<prod>` 절대 금지 — shadow 를 리셋하므로 prod 를
   가리키면 전소한다. shadow 가 필요하면 throwaway DB 만(§9.7).
2. **sandbox(cowork)는 prod DB 명령 금지.** migrate / db push / diff(shadow) /
   resolve 등 prod 접속 쓰기·리셋 명령은 **클로드코드 operator-shell 단독**.
   sandbox 는 코드만(schema·seed·sentinel·계획). prod read-only 조회도 가급적
   operator-shell 로.
3. **파괴적 명령 = 명시 "진행" 게이트.** `--force-reset` / `--accept-data-loss` /
   `migrate reset` / `db push` 는 실행 전 호영 명시 승인 + project-ref echo
   (§9.3) 확인.
4. **db push 흐름 ↔ migrate deploy 충돌.** `db push` 는 `_prisma_migrations`
   를 안 건드린다. db push 로 스키마를 맞춘 뒤 `migrate deploy` 를 돌리면 기록
   불일치로 충돌. db push 사용 시 migrate deploy 금지(또는 사전
   `resolve --applied` 로 기록 정합).
5. **sandbox 공유 node_modules 에 패키지 설치 금지.** `npm install` / `pnpm add`
   등은 호영 Windows 설치본을 오염시킨다(버전 불일치 react 유입 → `npm run build`
   가 `/404·/500` prerender 에서 useContext null 로 실패 = pre-push hook 불능,
   2026-06-14 2차 사고). 조회 도구(pg 등)가 필요하면 sandbox 격리 임시
   디렉토리(`/tmp/...`)에 설치하거나 operator-shell 에 위임. 복구는 클린
   재설치(`rm -rf node_modules apps/web/node_modules; npm install`).

**복구 기록 (2026-06-14)**: `db push --accept-data-loss`(force-reset 불요 — 데이터
이미 0) → `seed`(데모 + PBS lot 2건) → count 검증(User2 / Product9 /
ProductInventory9 / InventoryRestock2 / partnershipTier 복원 / restockId 유지).
잔여: `_prisma_migrations` 1행 → 객체 실재 확인 후 `resolve --applied` 정합은
별 트랙(prod write 게이트).

상세 근거·배경: `docs/decisions/ADR-002-pilot-tenant-seed.md §11.13`
(요약), `§11.9` `§11.11` `§11.12` (단계별 진단).


### 9.10 🛑 로컬 → 운영 DB 직결 (§dev-prod-db-separation, 2026-08-10)

**실측**

```
apps/web/.env        DATABASE_URL / DIRECT_URL host = *.pooler.supabase.com (운영)
apps/web/.env.local  동일
package.json         "db:migrate": "prisma migrate dev"
```

`npm run db:migrate` 한 번이 운영 스키마를 직접 건드린다. `migrate dev` 는 shadow DB 를
만들고 drift 를 감지하면 **reset 을 제안**한다 — §9.9 와 같은 경로다.

**부수 발견 — `NODE_ENV` 기반 가드는 무력하다**

`admin/seed` 의 프로덕션 가드가 `NODE_ENV === "production"` 기준이었다. 로컬은
`NODE_ENV=development` 인데 DB 는 운영이므로 가드가 통과시켰다.

> **`NODE_ENV` 는 코드가 어디서 도는지를 말할 뿐, 데이터가 어디로 가는지를 말하지 않는다.**

**적용한 가드**

| 대상 | 내용 |
|---|---|
| `src/lib/security/production-database.ts` | 단일 판정기. `DATABASE_URL` **과 `DIRECT_URL` 둘 다** 검사(마이그레이션은 DIRECT_URL 을 쓴다) |
| `admin/seed` | 판정 기준을 `NODE_ENV` → `requiresDestructiveConfirmation()` 로 교체 |
| `scripts/db-guard.ts` | `db:migrate` / `db:seed` 앞단. 운영 host 면 exit 1 로 체인 중단. 판정 규칙을 **재구현하지 않고 재사용** |
| sentinel | `admin-seed-prod-guard`(S1-c/S1-d) · `db-guard-migrate`(G1~G4). 각각 corrupt→RED 실증 |

**운영 스키마 변경 경로 (유일)**

```bash
npm run prisma:migrate     # = prisma migrate deploy (생성된 마이그레이션 적용만)
```

DIRECT_URL(5432, Session Pooler) 필수. `migrate dev` / `db push` 는 운영에서 금지.

**선결 조건 — 마이그레이션 적용 보류**

개발 DB 분리 완료 전까지 신규 스키마 적용은 보류한다. 상세는
`docs/plans/PLAN_dev-prod-db-separation.md`.

### 9.10 마이그레이션 순서 역전·silent gap 가드 (§migration-order-drift-guard, 2026-08-04)

**인시던트 (2026-08-01→08-04)**: `20260731120000_receiving_document` 가 08-01
13:51 UTC 커밋됐으나, 08-01 16:19 UTC 의 deploy 는 **그 폴더가 없는 트리**에서
실행되어 `20260801120000_receiving_inspection_decision` 만 적용됐다(prod
`_prisma_migrations` 실측: 전 행 steps=1, resolve 조작 아님). 결과: 0731 이
3일 pending 잠복 — 라이브 `db.receivingDocument.*` 라우트가 부재 테이블을
참조하는 runtime gap 장전 상태. 08-04 §pocandidate-root-fix Phase 2 deploy 가
발견·해소.

**교훈 — §9.5 게이트의 맹점**: `migrate status` / `migrate diff` 는 **현재
워크트리 기준**이다. 워크트리가 origin/main HEAD 와 다르면(병렬 워크트리·미pull)
게이트가 통과해도 main 기준 drift 가 존재할 수 있다. 0801 deploy 가 정확히
이 경로였다.

**가드 3종 (2026-08-04 도입):**

1. **deploy 전 HEAD 일치 확인 (절차, §9.2 step 3 앞에 삽입):**
   ```sh
   git fetch origin && git status   # "up to date with origin/main" 확인
   git log --oneline -1 origin/main # 적용하려는 migration 커밋이 포함됐는지 확인
   ```
   병렬 워크트리에서 migrate deploy 금지 — deploy 는 main HEAD 트리에서만.

2. **operator smoke 1명령 (push 전·deploy 후 언제든):**
   ```sh
   npm run smoke:migration --prefix apps/web
   # (= tsx scripts/smoke/migration-drift.ts — 런너 중립 스크립트.
   #  operator 셸은 npm 설치본이라 `pnpm exec tsx` 는 미해석(P4 실측),
   #  직접 실행은 apps/web 에서 `npx tsx scripts/smoke/migration-drift.ts`)
   ```
   .env 의 DIRECT_URL 로드 → `:5432` 선검증(6543 즉시 STOP) → 마스킹 echo →
   `_prisma_migrations` **직접 SELECT**(30s timeout) → 런타임 probe 와 동일
   모듈(computeMigrationDrift)로 대조 → pending/unknown **이름 전체** 출력
   (operator 전용). exit 0 = clean, 1 = drift, 2 = env 위반, 3 = 미도달.
   읽기전용 — migrate 실행·resolve 0.

   > ⚠️ v1(.cjs, `prisma migrate status` 래퍼)은 폐기 — P4 prod 실증
   > (2026-08-04)에서 `migrate status` CLI 가 operator 환경 **5432 에서도
   > 90s hang**(§9.5 step 2 도 동일 한계 상속). drift 검사는 직접 쿼리가
   > 표준. `migrate status` hang 시 이 스크립트로 대체할 것.

3. **배포 후 자동 감시 — `/api/health` `migrations` 필드:**
   prebuild 가 repo migration 폴더 전수를 manifest 로 산출
   (`scripts/generate-migration-manifest.cjs` → `src/generated/migration-manifest.json`,
   DB 무접촉·ADR-002 §11.13 무저촉)하고, runtime 이 `_prisma_migrations` 를
   읽기전용 SELECT 로 대조한다. `pendingCount`/`unknownCount`/`unfinishedCount`/
   `rolledBackCount`/`clean` (count/boolean 만 — 이름 목록은 스키마 정보 leak 이라
   smoke 전용). **워크트리 상태와 무관하게 "배포된 코드 기준 의도 vs prod 적용"**
   을 보므로 §9.5 맹점을 메운다. probe 실패는 `{ok:false, reachable:false}` 로
   drift 0 과 절대 혼동되지 않는다. §9.2 step 4 smoke probe 에서 이 필드의
   `clean:true` 를 확인할 것.

**명명 규칙**: migration 폴더 타임스탬프 수기 백데이트 금지 — §9.5 A-트랙
수동 폴더 생성 시에도 **현재 UTC** `date -u +%Y%m%d%H%M%S` 를 쓴다. 백데이트는
이름 정렬과 적용 순서를 어긋나게 해 이번 "역전 착시"를 재생산한다.

계획·실측 근거: `docs/plans/PLAN_migration-order-drift-guard.md` (Phase 0
타임라인·prod SELECT 원문 포함).
