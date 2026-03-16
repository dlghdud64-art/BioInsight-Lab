/**
 * GET /api/compare-sessions/[id] — 비교 세션 조회
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.compareSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error, "GET /api/compare-sessions/[id]");
  }
}
