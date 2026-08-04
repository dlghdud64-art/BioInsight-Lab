/**
 * §migration-order-drift-guard — migration drift 계산·probe 서비스.
 *
 * canonical truth: prod `_prisma_migrations`(적용 사실) + repo `prisma/migrations/`
 * 폴더 집합(의도). 이 서비스의 출력은 둘의 대조 결과인 derived projection이며
 * truth를 대체하지 않는다.
 *
 * ⛔ 이 모듈은 SELECT만 한다. migrate 실행·resolve·쓰기 경로 일체 금지
 *    (빌드타임 migrate 재도입 금지 — ADR-002 §11.13).
 *
 * prior art 관계: `scripts/smoke/migrate-revision-diff.ts`(ADR-001 §7,
 * smoke DB 전용)의 diffMigrationSets와 집합 대조 취지는 동일하나 재사용하지
 * 않는다 — (a) 그 모듈은 smoke guard(assertSmokeDatabaseTarget)와 결합돼
 * 앱 번들에 끌려오면 안 되고, (b) 본 서비스는 rolled_back/unfinished 행
 * 의미론과 false-ok probe 계약이 추가로 필요하다. 집합 계약 변경 시 양쪽
 * 동기화 확인할 것.
 *
 * 계약 (계획서 §12 Phase 0 확정):
 *   C1 관측: pending = M − A, unknown = A − M, unfinished/rolled_back count 상시.
 *   C2 rolled-back 행은 적용이 아니다 — pending에 남는다.
 *   C3 false-ok 차단: 도달 불가는 { ok:false, reachable:false } — clean 위장 금지.
 */

/** 빌드 시 생성되는 manifest (scripts/generate-migration-manifest.cjs 산출) */
export interface MigrationManifest {
  /** repo prisma/migrations/ 폴더명 전수, 이름 오름차순 */
  migrations: string[];
  /** manifest 생성 시각 (ISO) — stale 판별용 메타 */
  generatedAt: string;
}

/** `_prisma_migrations` 행의 drift 판정에 필요한 최소 컬럼 */
export interface AppliedMigrationRow {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
}

export interface MigrationDrift {
  /** repo에 있으나 prod에 적용 안 됨 (M − A). silent gap 시그니처 */
  pending: string[];
  /** prod에 적용됐으나 repo manifest에 없음 (A − M). 부분 시야 deploy 시그니처 */
  unknown: string[];
  /** 정상 적용 행 수 (finished + not rolled back) */
  appliedCount: number;
  /** finished_at null && rolled_back_at null — 진행 중/중단 */
  unfinishedCount: number;
  /** rolled_back_at 존재 */
  rolledBackCount: number;
  /** pending·unknown·unfinished·rolledBack 전부 0 */
  clean: boolean;
}

/** probe 결과 — false-ok 차단: 도달 불가는 drift 0과 절대 혼동되지 않는다 */
export type MigrationDriftProbe =
  | { ok: true; reachable: true; drift: MigrationDrift; manifestGeneratedAt: string }
  | { ok: false; reachable: false; error: string };

/** $queryRaw 가능한 최소 클라이언트 (Prisma db 또는 mock) */
export interface RawQueryClient {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
}

/**
 * 순수 계산 — manifest 집합 vs 적용 행 집합.
 * rolled-back 행은 "적용됨"으로 치지 않는다(재적용 대상 → pending에 남아야 함).
 */
export function computeMigrationDrift(
  manifest: MigrationManifest,
  appliedRows: AppliedMigrationRow[],
): MigrationDrift {
  // C2 — rolled-back 행은 적용으로 치지 않는다 (재적용 대상).
  const rolledBack = appliedRows.filter((r) => r.rolled_back_at != null);
  const unfinished = appliedRows.filter(
    (r) => r.rolled_back_at == null && r.finished_at == null,
  );
  const effectivelyApplied = appliedRows.filter(
    (r) => r.rolled_back_at == null && r.finished_at != null,
  );

  const appliedSet = new Set(effectivelyApplied.map((r) => r.migration_name));
  const manifestSet = new Set(manifest.migrations);

  // C1 — pending = M − A (이름 오름차순), unknown = A − M.
  const pending = manifest.migrations
    .filter((name) => !appliedSet.has(name))
    .sort();
  const unknown = effectivelyApplied
    .map((r) => r.migration_name)
    .filter((name) => !manifestSet.has(name))
    .sort();

  const drift: MigrationDrift = {
    pending,
    unknown,
    appliedCount: effectivelyApplied.length,
    unfinishedCount: unfinished.length,
    rolledBackCount: rolledBack.length,
    clean:
      pending.length === 0 &&
      unknown.length === 0 &&
      unfinished.length === 0 &&
      rolledBack.length === 0,
  };
  return drift;
}

/**
 * runtime probe — `_prisma_migrations` 읽기전용 SELECT 후 compute 위임.
 * 실패 시 반드시 { ok:false, reachable:false } — drift 0으로 위장 금지.
 */
export async function probeMigrationDrift(
  client: RawQueryClient,
  manifest: MigrationManifest,
): Promise<MigrationDriftProbe> {
  try {
    // 읽기전용 SELECT — 컬럼 최소 의존 (Prisma 5.22 내부 테이블).
    const rows = await client.$queryRawUnsafe<AppliedMigrationRow[]>(
      `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
    );
    return {
      ok: true,
      reachable: true,
      drift: computeMigrationDrift(manifest, rows),
      manifestGeneratedAt: manifest.generatedAt,
    };
  } catch (err: unknown) {
    // C3 — 도달 불가/쿼리 실패는 clean과 절대 혼동되지 않는다.
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reachable: false, error: message };
  }
}
