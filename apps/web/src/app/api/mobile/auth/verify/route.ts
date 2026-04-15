import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-jwt";

/**
 * GET /api/mobile/auth/verify
 * 모바일 JWT 토큰 유효성 확인 (가벼운 healthcheck).
 * 유효하면 200 + user 정보, 아니면 401.
 */
export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Token invalid or expired" }, { status: 401 });
  }
  return NextResponse.json({ valid: true, user });
}
