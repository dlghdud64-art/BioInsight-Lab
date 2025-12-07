import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 사용자가 소속된 조직 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 멤버로 소속된 조직 조회
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

    const organizations = memberships.map((m) => m.organization);

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
