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
