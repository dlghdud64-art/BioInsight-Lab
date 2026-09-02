import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateDatabaseUrl } from "@/lib/health/validate-database-url";
// §migration-order-drift-guard — repo 의도(manifest) vs prod 적용(_prisma_migrations)
// 대조. SELECT만 (빌드타임 migrate 재도입 아님 — ADR-002 §11.13 보완).
import {
  probeMigrationDrift,
  type RawQueryClient,
} from "@/lib/health/migration-drift";
// §org-create-limit — 조직 소유권 불변식(OWNER 0인 조직 = 0). 위반 시 생성 한도가
// 조이는 게 아니라 푸는 방향으로 뒤집힌다. SELECT만.
import { probeOwnerlessOrganizations } from "@/lib/health/owner-invariant";
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
    const ownerProbe = await probeOwnerlessOrganizations(
      db as unknown as RawQueryClient,
    );
    const orgOwnership = ownerProbe.ok
      ? {
          ok: true,
          reachable: true,
          ownerlessCount: ownerProbe.ownerlessCount,
          clean: ownerProbe.clean,
        }
      : { ok: false, reachable: false };

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
      orgOwnership,
      hasDbUrl: !!dbUrl,
      hasDirectUrl: !!directUrl,
      dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
      // §scan-storage-deadend (2026-09-02) — OCR 이미지 저장소 진단.
      //   업로드가 실패하면 OcrJob 이 안 생기고 스캔 입고 등록이 구조적으로 막힌다.
      //   Vercel 대시보드/런타임 로그 접근 없이 원인(키 미설정 vs 토큰 부재)을 가르는 축.
      //   기존 hasDbUrl/hasDirectUrl 과 동일 형태 — 값이 아니라 존재 여부만 노출한다.
      // §scan-storage-deadend — 배포 런타임 Node 버전. @vercel/blob 2.x 가
      //   engines.node ">=20.0.0" 을 요구하므로 실제 버전이 관측돼야 판정이 가능하다.
      node: process.version,
      storage: {
        provider: process.env.STORAGE_PROVIDER || null,
        hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
        // 🛑 이름을 측정 내용과 일치시킨다(2026-09-02 정정) — 이전 `ready` 는
        //    env 존재만 보면서 "업로드 가능" 을 함의해 거짓 신호였다.
        //    실제 업로드 가능 여부는 스캔 응답의 ocrMetadata.skipReason 이 답한다
        //    (health 에서 시험 업로드를 하면 호출마다 blob 을 쓰게 되므로 하지 않는다).
        envConfigured:
          process.env.STORAGE_PROVIDER === "vercel-blob" &&
          !!process.env.BLOB_READ_WRITE_TOKEN,
      },
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
