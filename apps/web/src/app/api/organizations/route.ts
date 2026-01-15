import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOrganization } from "@/lib/api/organizations";

// ì¬ì©ìê° ììë ì¡°ì§ ëª©ë¡ ì¡°í
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ì¬ì©ìê° ë©¤ë²ë¡ ììë ì¡°ì§ ì¡°í
    const memberships = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: {
          include: {
            subscription: true,
            members: true,
          },
        },
      },
    });

    // 타입 에러 수정: m 파라미터에 타입 명시
    const organizations = memberships.map((m: any) => m.organization);

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

// 새 조직 생성 (RLS 권한 문제 해결)
export async function POST(request: NextRequest) {
  try {
    // 1. 사용자 확인
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    // 입력 검증
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // 2. 조직 생성 및 멤버 등록 (트랜잭션으로 처리)
    const organization = await createOrganization(session.user.id, {
      name: name.trim(),
      description: description?.trim(),
    });

    // 3. 성공 응답 반환
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
    console.error("[Organization API] Error creating organization:", error);
    
    // Prisma 에러 처리
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "이미 존재하는 조직 이름입니다." },
        { status: 409 }
      );
    }

    // 일반 에러 처리
    return NextResponse.json(
      { 
        error: error.message || "Failed to create organization",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}