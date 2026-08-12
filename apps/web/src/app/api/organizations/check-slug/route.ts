import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 시스템 예약어 블랙리스트 (슬러그로 사용 불가)
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "settings",
  "login",
  "logout",
  "signup",
  "register",
  "auth",
  "www",
  "mail",
  "help",
  "support",
  "billing",
  "pricing",
  "about",
  "contact",
  "blog",
  "docs",
  "legal",
  "privacy",
  "terms",
  "status",
  "account",
  "profile",
  "organization",
  "organizations",
  "team",
  "teams",
  "invite",
  "public",
  "static",
  "assets",
  "images",
  "files",
  "uploads",
  "root",
  "null",
  "undefined",
  "true",
  "false",
  "bioinsight",
  "bioinsightlab",
]);

// 슬러그 유효성 검사 정규식: 소문자 영문, 숫자, 하이픈만 허용, 3-32자
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

// GET /api/organizations/check-slug?slug={slug}&excludeOrgId={orgId}
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug")?.toLowerCase().trim();
    const excludeOrgId = searchParams.get("excludeOrgId"); // 수정 시 자신 제외

    if (!slug) {
      return NextResponse.json(
        { available: false, reason: "slug 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    // 1) 형식 검증 (3~32자, 소문자·숫자·하이픈, 앞뒤 하이픈 금지)
    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json({
        available: false,
        reason:
          "슬러그는 3~32자의 소문자 영문, 숫자, 하이픈(-)만 사용할 수 있으며, 앞뒤에 하이픈을 쓸 수 없습니다.",
      });
    }

    // 연속 하이픈 금지
    if (slug.includes("--")) {
      return NextResponse.json({
        available: false,
        reason: "슬러그에 연속된 하이픈(--)을 사용할 수 없습니다.",
      });
    }

    // 2) 예약어 확인
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({
        available: false,
        reason: `'${slug}'는 시스템 예약어로 사용할 수 없습니다.`,
      });
    }

    // 3) DB 중복 확인
    const existing = await db.organization.findFirst({
      where: {
        slug,
        ...(excludeOrgId ? { id: { not: excludeOrgId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        reason: `'${slug}'는 이미 사용 중인 주소입니다.`,
      });
    }

    return NextResponse.json({ available: true, slug });
  } catch (error: any) {
    console.error("[check-slug] Error:", error);
    return NextResponse.json(
      { error: error.message || "슬러그 확인에 실패했습니다." },
      { status: 500 }
    );
  }
}
