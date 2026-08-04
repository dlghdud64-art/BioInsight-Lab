import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateDatabaseUrl } from "@/lib/health/validate-database-url";
// §migration-order-drift-guard — repo 의도(manifest) vs prod 적용(_prisma_migrations)
// 대조. SELECT만 (빌드타임 migrate 재도입 아님 — ADR-002 §11.13 보완).
import {
  probeMigrationDrift,
  type RawQueryClient,
} from "@/lib/health/migration-drift";
import migrationManifest from "@/generated/migration-manifest.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  // #P01-followup-health-precheck (ADR-002 §11.14): structural URL
  // validation before Prisma even tries to connect. Lets operators
  // tell "DATABASE_URL is malformed" apart from "DB unreachable" or
  // "Prisma client misconfigured" with a single probe — exact failure
  // class that took minutes to triage in the §11.14 incident.
  const urlCheck = validateDatabaseUrl(dbUrl);
  if (!urlCheck.ok) {
    return NextResponse.json(
      {
        status: "error",
        db: "url-malformed",
        urlOk: false,
        urlIssue: urlCheck.reason,
        hasDbUrl: !!dbUrl,
        hasDirectUrl: !!directUrl,
        dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
      },
      { status: 500 },
    );
  }

  try {
    await (db as any).$queryRaw`SELECT 1`;
    const userCount = await (db as any).user.count();
    const orgCount = await (db as any).organization.count();

    // §migration-order-drift-guard — count/boolean만 노출 (migration 이름
    // 목록은 스키마 정보 leak → operator smoke 전용). probe 실패는
    // { ok:false, reachable:false } 로 additive 노출, status 의미 불변.
    const probe = await probeMigrationDrift(
      db as unknown as RawQueryClient,
      migrationManifest,
    );
    const migrations = probe.ok
      ? {
          ok: true,
          reachable: true,
          pendingCount: probe.drift.pending.length,
          unknownCount: probe.drift.unknown.length,
          unfinishedCount: probe.drift.unfinishedCount,
          rolledBackCount: probe.drift.rolledBackCount,
          clean: probe.drift.clean,
          manifestGeneratedAt: probe.manifestGeneratedAt,
        }
      : { ok: false, reachable: false };

    return NextResponse.json({
      status: "ok",
      db: "connected",
      urlOk: true,
      userCount,
      orgCount,
      migrations,
      hasDbUrl: !!dbUrl,
      hasDirectUrl: !!directUrl,
      dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        db: "failed",
        // urlOk:true means the URL was structurally valid but the
        // connect / query still failed — credentials wrong, host
        // unreachable, schema drift, etc. Different operator action
        // than the "url-malformed" branch above.
        urlOk: true,
        error: err.message,
        hasDbUrl: !!dbUrl,
        hasDirectUrl: !!directUrl,
        dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
      },
      { status: 500 },
    );
  }
}
