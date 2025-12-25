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

// 새 조직 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    const organization = await createOrganization(session.user.id, {
      name: name.trim(),
      description: description?.trim(),
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create organization" },
      { status: 500 }
    );
  }
}