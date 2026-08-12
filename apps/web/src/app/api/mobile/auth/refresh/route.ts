import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jwtVerify, SignJWT } from "jose";

const jwtSecretRaw = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET;
if (!jwtSecretRaw) {
  throw new Error(
    "[FATAL] MOBILE_JWT_SECRET 또는 AUTH_SECRET 환경변수가 설정되지 않았습니다."
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

/**
 * POST /api/mobile/auth/refresh
 * 리프레시 토큰으로 액세스 토큰 갱신
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json() as { refreshToken?: string };

    if (!refreshToken) {
      return NextResponse.json({ error: "리프레시 토큰이 없습니다." }, { status: 400 });
    }

    // 리프레시 토큰 검증
    let payload: { sub?: string };
    try {
      const { payload: p } = await jwtVerify(refreshToken, JWT_SECRET);
      payload = p as { sub?: string };
    } catch {
      return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
    }

    if (!payload.sub) {
      return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
    }

    // 사용자 조회
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
    }

    // 새 액세스 토큰 발급
    const accessToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    return NextResponse.json({ accessToken });
  } catch (error) {
    console.error("[mobile/auth/refresh] Error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
