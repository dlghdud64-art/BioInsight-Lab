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

Vercel `prebuild` 가 `apps/web/vercel-migrate.js` → `prisma migrate deploy` 를 자동 실행합니다. 배포 전 로컬에서 `npx prisma migrate status` 로 pending migration 을 확인하는 습관이 안전.

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
| Vercel 배포 실패 (migration) | 로컬 migration 파일이 push 되지 않음 | `git status` 확인 → commit → push 후 재배포 |
| `prisma generate` 가 schema drift 보고 | 실 DB 와 schema 불일치 | `npx prisma migrate status` 로 확인 → `migrate deploy` 또는 `db pull` 로 동기 |
| Vercel 빌드에서 `P1000: Authentication failed` (scripts/vercel-migrate.js) | DB password 로테이션 후 Vercel env 의 `DATABASE_URL` 이 stale — **또는** `DATABASE_URL` 의 포트가 session pooler `:5432` (Vercel 빌드 서버는 session pooler 에 접근 불가) | ① Vercel env `DATABASE_URL` 의 password·포트 확인 (포트는 **`:6543`** transaction pooler 필수, 상세 §9 / ADR-002 §11.9 참조). ② 스키마 변경 없는 긴급 배포면 Vercel env 에 `SKIP_PRISMA_MIGRATE=1` 을 임시 설정해 migrate 스텝 우회. 정상화 뒤 반드시 제거. |

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

### 9.4 Vercel env cleanup (1회)

§11.13 lands 후 Vercel 의 다음 env vars 는 **제거 가능** (영향 0):
- `SKIP_PRISMA_MIGRATE` — `vercel-migrate.js` 가 더 이상 참조하지 않음
- `DIRECT_URL` — `schema.prisma` 의 `directUrl` 가 제거됨

남겨도 무해하지만, env 표면을 새 절차와 맞추기 위해 정리 권장.

### 9.5 (OBSOLETE) 옛 §9.1 / §9.2

이전 §9.1 (Non-fatal migrate + 90s timeout) 과 §9.2 (4-item 복구
체크리스트) 는 모두 build-time migrate 가 존재할 때의 운영 안전망이었다.
build-time migrate 가 폐지되어 양쪽 모두 의미 없음. 역사적 맥락은
ADR-002 §11.10 / §11.11 / §11.12 에 보존.

상세 근거·배경: `docs/decisions/ADR-002-pilot-tenant-seed.md §11.13`
(요약), `§11.9` `§11.11` `§11.12` (단계별 진단).
