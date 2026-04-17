# Organization ↔ Workspace Backfill 실행 런북 (옵션 B)

> **대상**: 사장님 로컬 Windows 환경에서 1회성 실행
> **관련 설계 문서**: `docs/architecture/organization-workspace-bootstrap.md`
> **관련 태스크**: #19, #30–#33
> **실행 시점**: 본 런북이 포함된 배포가 프로덕션 DB 에 적용되기 "직전"

## 사전 준비

다음이 모두 준비돼 있어야 한다.

- `apps/web/.env.local` 에 `DATABASE_URL`, `DIRECT_URL` 설정
- 프로덕션 DB 백업 완료 (Supabase 관리 콘솔에서 스냅샷)
- 최신 main 브랜치 checkout

```powershell
cd C:\path\to\ai-biocompare\apps\web
git pull
pnpm install  # (새 의존성 없음, 안전망)
```

## 실행 순서 (총 6 단계)

모든 명령은 `apps/web` 디렉토리에서 실행한다. 각 단계는 앞 단계 성공을 전제로 한다.

### Step 1. Prisma Client 재생성

schema.prisma 가 바뀌었으므로 TypeScript 타입을 새로 생성한다.

```powershell
npx prisma generate
```

성공 판정: 에러 없이 `Generated Prisma Client` 로그가 나오면 OK.

### Step 2. Phase 1 마이그레이션 적용 (nullable 컬럼 추가)

`prisma/migrations/20260417120000_add_workspace_organization_id_nullable` 가 자동 적용된다.

```powershell
npx prisma migrate deploy
```

성공 판정: `All migrations have been successfully applied.` 로그. Phase 2 마이그레이션은 `apps/web/prisma/_pending_migrations/` 폴더에 격리되어 있으므로 이 단계에서 실행되지 않는다.

> **중요 — 이전 버전과의 차이**: 초기 설계에서는 `migrations/` 안에 `_pending_` 접두사만 붙이면 Prisma 가 건너뛸 것이라고 가정했으나, Prisma 는 `prisma/migrations/` 아래의 **모든 서브디렉토리**를 migration 으로 실행한다 (접두사 무관). 따라서 Phase 2 는 반드시 `prisma/_pending_migrations/` 처럼 **별도 폴더** 로 격리해야 한다.

> **이미 Phase 2 가 실패 기록으로 DB 에 남아있는 경우** (2026-04-17 배포에서 발생): `_prisma_migrations` 테이블에 실패 레코드가 있으면 이후 `migrate deploy` 가 모두 차단된다. 사전 정리 SQL 은 `docs/ops/organization-workspace-recovery-sql.md` 참조.

검증 쿼리 (psql 또는 Supabase SQL editor):

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'Workspace' AND column_name = 'organizationId';
-- 예상: organizationId | YES | text
```

### Step 3. 타입 검증 (로컬 tsc)

```powershell
npx tsc --noEmit
```

성공 판정: 에러 0. 이미 만들어놓은 `createOrganization` 트랜잭션이 새 타입(nullable organizationId)과 호환되는지 확인하는 단계이다.

### Step 4. Backfill 스크립트 실행

#### Step 4-1. Dry-run 으로 영향 범위 확인

```powershell
npx tsx scripts/backfill-organization-workspace.ts --dry-run
```

출력 예:

```
[stats] Organization 총 12 건
[stats] 이미 Workspace 연결된 Organization: 3 건
[stats] 백필 대상 Organization: 9 건
[dry-run] Organization cmXX... (호영랩) → Workspace 생성 예정 (slug≈ho-young-lab, members=2)
...
========== 요약 ==========
대상 Organization : 9 건
생성된 Workspace  : 0 건 (dry-run: 미실행)
dry-run 예정      : 9 건
실패              : 0 건
==========================
```

**주의**: 고아 Workspace (`organizationId` 가 걸려있지만 참조 Organization 이 없는 건) 경고가 뜨면 먼저 수동 정리 후 실제 실행 한다.

#### Step 4-2. 실제 실행

```powershell
npx tsx scripts/backfill-organization-workspace.ts
```

- 실행 로그는 `docs/reports/backfill-organization-workspace-<timestamp>.json` 에 저장된다.
- 생성된 Workspace ID 는 로그 파일에 기록되므로, 문제가 생겼을 때 롤백 참조용으로 사용한다.

### Step 5. 데이터 정합성 검증

다음 쿼리 두 개 모두 **0 건** 이 나와야 한다.

```sql
-- (a) NULL 이 남았는가?
SELECT COUNT(*) FROM "Workspace" WHERE "organizationId" IS NULL;

-- (b) 같은 Organization 에 Workspace 가 2 개 이상 있는가?
SELECT "organizationId", COUNT(*) AS c
FROM "Workspace"
WHERE "organizationId" IS NOT NULL
GROUP BY "organizationId"
HAVING COUNT(*) > 1;
```

둘 다 0 이 아니면 Phase 2 로 넘어가지 말고 원인 조사.

**참고 - 예상 실패 시나리오**:

- (a) > 0: `POST /api/workspaces` 로 Organization 없이 직접 만들어진 Workspace 가 존재. 해당 Workspace 의 멤버를 역으로 추적해서 본래 소속 Organization 을 수동 연결하거나, 불필요한 Workspace 는 삭제.
- (b) > 0: Organization 하나에 Workspace 가 여러 개. 가장 멤버가 많은 Workspace 를 남기고 나머지는 `organizationId = NULL` 로 내리거나 삭제.

### Step 6. Phase 2 마이그레이션 적용 (NOT NULL 승격)

> @unique 는 Phase 1 에서 이미 적용돼 있으므로, 이 단계는 NOT NULL 만 승격한다.

1. `schema.prisma` 에서 Workspace.organizationId 를 non-nullable 로 승격한다:

```prisma
model Workspace {
  // ...
-  organizationId   String?       @unique
-  organization     Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
+  organizationId   String        @unique
+  organization     Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  // ...
}
```

   그리고 `Organization` 쪽 backref 도 non-nullable 로 교체:

```prisma
model Organization {
  // ...
-  workspace          Workspace?
+  workspace          Workspace
}
```

2. 보관해둔 Phase 2 마이그레이션 디렉토리를 정식 위치로 이동:

```powershell
# 현재 위치: apps\web\prisma\_pending_migrations\20260417120100_workspace_organization_id_unique_not_null
# 이동 목적지: apps\web\prisma\migrations\20260417120100_workspace_organization_id_unique_not_null

Move-Item `
  "prisma\_pending_migrations\20260417120100_workspace_organization_id_unique_not_null" `
  "prisma\migrations\20260417120100_workspace_organization_id_unique_not_null"
```

> `_pending_migrations` 폴더가 비게 되면 그대로 둬도 무방 (향후 Phase 3+ 대기용).

3. 적용:

```powershell
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit
```

Phase 2 마이그레이션 SQL 안에 "NULL 이 남아 있으면 예외 발생" 안전장치가 들어 있으므로, Step 5 가 깨끗이 통과한 경우에만 성공한다.

### Step 7. (선택) 사장님 계정 최종 확인

`make-admin.ts` 를 다시 돌려 신규 생성된 Workspace 들에도 사장님이 멤버로 들어가 있는지 확인:

```powershell
npx tsx scripts/make-admin.ts
```

## 롤백 시나리오

### Step 4-2 (실제 backfill) 까지 진행한 상태에서 롤백

`docs/reports/backfill-organization-workspace-<timestamp>.json` 의 `entries[].workspaceId` 목록을 사용:

```sql
-- 로그에 기록된 workspace 들만 삭제 (cascade 로 WorkspaceMember 도 삭제)
DELETE FROM "Workspace"
WHERE id IN ('cmXX...', 'cmYY...', ...);
```

그 후 Phase 1 마이그레이션 revert:

```powershell
npx prisma migrate resolve --rolled-back 20260417120000_add_workspace_organization_id_nullable
-- SQL:
-- ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_organizationId_fkey";
-- DROP INDEX "Workspace_organizationId_key";
-- ALTER TABLE "Workspace" DROP COLUMN "organizationId";
```

### Step 6 까지 진행한 뒤 롤백

Phase 2 는 NOT NULL 만 적용했으므로 되돌리는 것도 단순하다:

```sql
-- NOT NULL 해제만
ALTER TABLE "Workspace" ALTER COLUMN "organizationId" DROP NOT NULL;
```

이후 필요하면 위의 Step 4-2 롤백 절차를 이어서 수행한다.

## 체크리스트 (실행 직후 서비스 검증)

- [ ] 사장님 기존 Workspace 에 여전히 접근 가능
- [ ] `/pricing` 에서 Team CTA 클릭 → `/dashboard/settings/plans?plan=team&intent=checkout&workspaceId=...` 로 정상 진입
- [ ] 신규 가입 시나리오: 테스트 계정으로 Organization 을 만들고, `/pricing` 에서 Team 결제 플로우에 도달하는지 확인
- [ ] 로그 파일 `docs/reports/backfill-*.json` 를 git 에 commit (감사 추적용)
