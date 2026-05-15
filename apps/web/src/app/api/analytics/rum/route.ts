import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * §11.246d-4 #rum-server-post-endpoint — 호영님 P0 §11.246d-3/-5 자연 후속.
 *
 * Strategy:
 *   - client (§11.246d-3 observeLCP + §11.246d-5 observeCLS/FID/INP) 가 측정한 4 metric
 *     을 server 로 전송 (page unload 시 navigator.sendBeacon).
 *   - server side structured log (console.log) — initial scope.
 *   - DB persistence 별도 §11.246d-4-cont 백로그 (RumMetric table + aggregate).
 *
 * canonical truth lock:
 *   - schema 변경 0 (initial scope = structured logging only)
 *   - 인증 unguarded — 모든 user (auth 없어도) RUM 전송 가능 (navigator.sendBeacon
 *     은 unauthenticated context 도 발화 = correctness 정합).
 *   - rate limit 별도 백로그 (DDoS 방어는 Vercel edge layer).
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

    // §11.246d-4 — structured log (initial scope). DB persistence 별도 백로그.
    console.log("[RUM]", JSON.stringify({
      lcp,
      cls,
      fid,
      inp,
      pathname,
      userAgent,
      sessionId,
      timestamp: new Date().toISOString(),
    }));

    // navigator.sendBeacon expects 204 No Content (response body 무시).
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[RUM] route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
