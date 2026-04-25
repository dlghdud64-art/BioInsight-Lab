import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateDatabaseUrl } from "@/lib/health/validate-database-url";

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
    return NextResponse.json({
      status: "ok",
      db: "connected",
      urlOk: true,
      userCount,
      orgCount,
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
