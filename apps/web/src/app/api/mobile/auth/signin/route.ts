import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET || "bioinsight-mobile-secret-key"
);
const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES = "30d";

async function signToken(payload: object, expiresIn: string) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

/**
 * POST /api/mobile/auth/signin
 * 모바일 앱 전용 로그인 엔드포인트
 * - 이메일 기반 인증 (현재는 이메일 존재 여부만 확인 - OAuth 전용 환경)
 * - 실제 운영 시 password 필드 추가 및 bcrypt 검증 필요
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // DB에서 사용자 조회
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
      },
    });

    if (!user) {
      // 보안상 동일한 에러 메시지 반환
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // NOTE: 현재 시스템은 Google OAuth 전용입니다.
    // 실제 비밀번호 필드가 추가되면 아래 주석을 해제하여 bcrypt 검증을 추가하세요:
    //
    // import bcrypt from "bcryptjs";
    // const isValid = await bcrypt.compare(password, user.passwordHash);
    // if (!isValid) {
    //   return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    // }
    //
    // 임시: 개발 환경에서는 특정 테스트 비밀번호 허용
    const isDev = process.env.NODE_ENV !== "production";
    const TEMP_DEV_PASSWORD = process.env.MOBILE_DEV_PASSWORD || "bioinsight2024";

    if (!isDev || password !== TEMP_DEV_PASSWORD) {
      if (!isDev) {
        return NextResponse.json(
          { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    // JWT 토큰 발급
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signToken(tokenPayload, ACCESS_TOKEN_EXPIRES),
      signToken({ sub: user.id }, REFRESH_TOKEN_EXPIRES),
    ]);

    return NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("[mobile/auth/signin] Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
