# Phase 2 마이그레이션 실패 기록 정리 SQL (2026-04-17 배포 사고 대응)

> **언제 이 문서가 필요한가**
> 2026-04-17 배포 (`dpl_3bfnN3LUHpKZYVg4rBhLWGp2h3v6`, commit `9db22af3`) 에서 Phase 2 마이그레이션이 프로덕션 DB 에 실행되어 `_prisma_migrations` 테이블에 실패 기록이 남은 상태.
>
> 그 결과 `prisma migrate deploy` 가 계속 "이전 마이그레이션이 실패 상태라 진행 불가" 를 반환하며, Vercel 빌드도 동일한 이유로 프리빌드 단계에서 죽는다. 이 문서의 SQL 로 실패 기록을 먼저 정리해야 다음 배포가 녹색으로 통과한다.

## 배경

Phase 1 (`20260417120000_add_workspace_organization_id_nullable`) 은 **성공 반영** 되었다.
따라서 프로덕션 DB 의 Workspace 테이블에는 이미 다음이 적용된 상태다.

- `organizationId TEXT` (nullable) 컬럼
- `Workspace_organizationId_key` UNIQUE INDEX
- `Workspace_organizationId_fkey` Organization 참조 FK (CASCADE)

Phase 2 (`_pending_phase2_workspace_organization_id_unique_not_null`) 는 안전장치(`RAISE EXCEPTION`) 가 발동하여 실제 `ALTER TABLE ... SET NOT NULL` 은 실행되지 않았다. 그러나 **`_prisma_migrations` 에는 failed 레코드가 기록됨**.

## Supabase SQL Editor 에서 실행할 SQL

### Step A — 현재 상태 확인 (실행 전)

```sql
-- 어떤 마이그레이션이 어떤 상태로 기록돼 있나?
SELECT
  migration_name,
  applied_steps_count,
  finished_at,
  started_at,
  logs,
  rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 10;
```

예상 결과: 가장 위 두 줄이 아래와 비슷해야 한다.

| migration_name | finished_at | rolled_back_at |
|---|---|---|
| `_pending_phase2_workspace_organization_id_unique_not_null` | NULL (실패) | NULL |
| `20260417120000_add_workspace_organization_id_nullable` | <timestamp> | NULL |

### Step B — Phase 2 실패 기록 "rolled_back" 으로 표시

Prisma 공식 회복 절차는 `prisma migrate resolve --rolled-back <name>` 이지만, Vercel 환경에서는 이 명령을 실행할 방법이 없다. 대신 Supabase SQL Editor 에서 동등한 효과의 UPDATE 를 수행한다.

```sql
-- Phase 2 실패 레코드를 rolled_back 으로 마킹
UPDATE "_prisma_migrations"
SET
  rolled_back_at = NOW(),
  logs = COALESCE(logs, '') ||
         E'\n[recovery 2026-04-17] Phase 2 was moved out of migrations/ folder; ' ||
         'this record is marked rolled_back so subsequent deploys can proceed.'
WHERE migration_name = '_pending_phase2_workspace_organization_id_unique_not_null'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL;

-- 영향받은 행 수를 확인 (1 이어야 정상)
-- 0 이라면 이미 처리된 상태거나 migration_name 이 다름 → Step A 쿼리 재확인
```

### Step C — 정리 후 재확인

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%workspace_organization_id%'
ORDER BY started_at DESC;
```

예상 결과:

| migration_name | finished_at | rolled_back_at |
|---|---|---|
| `_pending_phase2_workspace_organization_id_unique_not_null` | NULL | <방금 찍은 timestamp> |
| `20260417120000_add_workspace_organization_id_nullable` | <timestamp> | NULL |

### Step D — 안전 확인

Phase 1 이 적용되었으나 Phase 2 (NOT NULL) 는 적용되지 않았음을 확정:

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'Workspace' AND column_name = 'organizationId';
-- 예상: organizationId | YES | text
```

`YES` 가 나와야 한다. `NO` 가 나온다면 Phase 2 가 실제로 적용돼버린 것이므로 추가 조사 필요 (빌드 로그 상으로는 실행되지 않았으나, 혹시 모를 상황 대비).

## 이후 단계

Step A~D 가 모두 정상 통과하면,

1. Phase 2 폴더가 `prisma/_pending_migrations/` 로 이동된 커밋을 `main` 에 푸시
2. Vercel 재배포 → 빌드 성공 예상
3. 런북 `organization-workspace-backfill-runbook.md` Step 4 (backfill) 부터 이어서 진행

## 왜 이 사고가 났는가 (post-mortem 요약)

런북 초판에서 `_pending_` 접두사를 붙이면 Prisma 가 migration 으로 인식하지 않을 것이라 가정했으나, Prisma 의 migration discovery 는 **접두사 패턴을 체크하지 않고** `prisma/migrations/` 아래의 모든 서브디렉토리를 실행 대상으로 본다. 따라서 "pending" 상태 보관 용도로는 **`migrations/` 폴더 바깥**에 별도 디렉토리를 두는 방법만 유효하다.

대응 완료 사항:
- Phase 2 → `prisma/_pending_migrations/20260417120100_workspace_organization_id_unique_not_null/` 로 이동
- 런북 Step 2 경고문 추가, Step 6 이동 명령을 `Rename-Item` → `Move-Item` 으로 변경

교훈: "설계상 실행되지 않을 것" 이라는 가정은 반드시 개발 DB 에서 한 번 검증한 뒤에만 프로덕션 배포에 포함시킨다.
