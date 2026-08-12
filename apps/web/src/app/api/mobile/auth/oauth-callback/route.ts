import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SignJWT } from "jose";

/**
 * POST /api/mobile/auth/oauth-callback
 *
 * 모바일 Google OAuth callback.
 * 모바일에서 받은 authorization code를 Google에서 토큰으로 교환하고,
 * 사용자를 조회/생성한 뒤 mobile JWT를 발급한다.
 *
 * 흐름:
 * 1. code + codeVerifier → Google token endpoint에서 id_token 교환
 * 2. id_token에서 email/name/picture 추출
 * 3. DB에서 사용자 조회 (없으면 생성)
 * 4. mobile accessToken + refreshToken 발급
 */

const jwtSecretRaw = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET;
if (!jwtSecretRaw) {
  throw new Error("[FATAL] MOBILE_JWT_SECRET 또는 AUTH_SECRET 필요");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

async function signToken(payload: object, expiresIn: string) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, codeVerifier, redirectUri } = body;

    if (!code) {
      return NextResponse.json({ error: "Authorization code가 필요합니다." }, { status: 400 });
    }

    // 1. Google에서 code → token 교환
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error("[mobile/oauth-callback] Google token exchange failed:", err);
      return NextResponse.json(
        { error: "Google 인증에 실패했습니다." },
        { status: 401 },
      );
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return NextResponse.json({ error: "id_token을 받지 못했습니다." }, { status: 401 });
    }

    // 2. id_token 디코딩 (Google id_token은 JWT — payload만 추출)
    const payloadBase64 = idToken.split(".")[1];
    const payloadJson = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8"),
    );

    const email = payloadJson.email as string;
    const name = payloadJson.name as string | undefined;
    const picture = payloadJson.picture as string | undefined;

    if (!email) {
      return NextResponse.json({ error: "이메일 정보를 가져올 수 없습니다." }, { status: 401 });
    }

    // 3. DB에서 사용자 조회 또는 생성
    let user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, role: true, image: true },
    });

    if (!user) {
      // 웹 NextAuth OAuth와 같은 방식으로 사용자 생성
      user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          name: name ?? email.split("@")[0],
          image: picture ?? null,
        },
        select: { id: true, email: true, name: true, role: true, image: true },
      });
    }

    // 4. Mobile JWT 발급
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signToken(tokenPayload, "1h"),
      signToken({ sub: user.id }, "30d"),
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
  } catch (error: any) {
    console.error("[mobile/oauth-callback] Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
