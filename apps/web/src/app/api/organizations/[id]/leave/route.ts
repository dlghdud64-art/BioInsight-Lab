import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { leaveOrganization } from "@/lib/api/organizations";

// ì¡°ì§ íí´
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
    await leaveOrganization(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error leaving organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to leave organization" },
      { status: 500 }
    );
  }
}
