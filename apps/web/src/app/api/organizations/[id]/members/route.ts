import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addOrganizationMember,
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from "@/lib/api/organizations";

// 조직 멤버 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { userEmail, role } = body;

    if (!userEmail || !role) {
      return NextResponse.json(
        { error: "userEmail and role are required" },
        { status: 400 }
      );
    }

    const member = await addOrganizationMember(id, session.user.id, {
      userEmail,
      role,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding organization member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add member" },
      { status: 500 }
    );
  }
}

// 조직 멤버 역할 변경