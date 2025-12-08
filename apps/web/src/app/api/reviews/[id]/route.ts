import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteReview } from "@/lib/api/reviews";

// 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteReview(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting review:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete review" },
      { status: 500 }
    );
  }
}
