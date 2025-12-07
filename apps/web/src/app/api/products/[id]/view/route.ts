import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordProductView } from "@/lib/api/search-history";

// 제품 조회 기록
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id || null;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const query = body.query || "";

    await recordProductView(userId, id, query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording product view:", error);
    return NextResponse.json(
      { error: "Failed to record product view" },
      { status: 500 }
    );
  }
}



