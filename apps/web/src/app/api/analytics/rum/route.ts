import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * §11.246d-4 #rum-server-post-endpoint — 호영님 P0 §11.246d-3/-5 자연 후속.
 *
 * §11.246d-4-cont #rum-metric-db-persistence — RumMetric model 영속화 추가.
 *   try/catch 안 db.rumMetric.create — DB write 실패 시 console.log fallback
 *   (silent degrade, 회귀 0). aggregate p75 view 별도 백로그.
 *
 * Strategy:
 *   - client (§11.246d-3 observeLCP + §11.246d-5 observeCLS/FID/INP) 가 측정한 4 metric
 *     을 server 로 전송 (page unload 시 navigator.sendBeacon).
 *   - server side zod validation → db.rumMetric.create (성공 시 row 1 INSERT).
 *   - DB write 실패 시 structured log (console.log) fallback (silent degrade).
 *
 * canonical truth lock:
 *   - §11.246d-4 zod RumMetricSchema 시그니처 보존 (4 metric optional + pathname/userAgent/sessionId optional).
 *   - 인증 unguarded — 모든 user (auth 없어도) RUM 전송 가능.
 *   - rate limit 별도 백로그 (DDoS 방어는 Vercel edge layer).
 *   - DB row = canonical truth (immutable measurement). UI 변경 0 (silent infra).
 */

const RumMetricSchema = z.object({
  // 4 metric 모두 optional — browser 미지원 환경 graceful fallback.
  lcp: z.number().nonnegative().optional(),
  cls: z.number().nonnegative().optional(),
  fid: z.number().nonnegative().optional(),
  inp: z.number().nonnegative().optional(),
  // navigation context (URL pathname, user agent string)
  pathname: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  // session marker (anonymous, optional)
  sessionId: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // navigator.sendBeacon 은 Content-Type 으로 text/plain 또는 application/json 전송.
    // text/plain 시도 → fallback to json.
    const text = await request.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = RumMetricSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid RUM payload", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { lcp, cls, fid, inp, pathname, userAgent, sessionId } = validation.data;

    // §11.246d-4-cont — DB persist (silent degrade on failure).
    //   try/catch 안 db.rumMetric.create — Prisma generate 미완 / DB 미가용 시
    //   console.log fallback 으로 회귀 0. user-facing 영향 0 (silent infra).
    try {
      await db.rumMetric.create({
        data: {
          lcp,
          cls,
          fid,
          inp,
          pathname,
          userAgent,
          sessionId,
        },
      });
    } catch (dbError) {
      // §11.246d-4 fallback — structured log when DB write fails.
      console.log("[RUM]", JSON.stringify({
        lcp,
        cls,
        fid,
        inp,
        pathname,
        userAgent,
        sessionId,
        timestamp: new Date().toISOString(),
        dbError: dbError instanceof Error ? dbError.message : String(dbError),
      }));
    }

    // navigator.sendBeacon expects 204 No Content (response body 무시).
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[RUM] route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
