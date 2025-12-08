import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrganizationById,
  updateOrganization,
} from "@/lib/api/organizations";

// 조직 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const organization = await getOrganizationById(id, session.user.id);
    return NextResponse.json({ organization });
  } catch (error: any) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// 조직 정보 수정