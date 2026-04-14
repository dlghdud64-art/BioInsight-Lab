import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  try {
    await (db as any).$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      hasDbUrl: !!dbUrl,
      hasDirectUrl: !!directUrl,
      dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "error",
      db: "failed",
      error: err.message,
      hasDbUrl: !!dbUrl,
      hasDirectUrl: !!directUrl,
      dbUrlPrefix: dbUrl?.slice(0, 40) + "...",
    }, { status: 500 });
  }
}
