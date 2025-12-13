import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 대시보드 레이아웃 저장
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { layout } = body;

    // 사용자 설정에 레이아웃 저장 (User 모델에 settings 필드가 있다고 가정)
    // 실제로는 별도의 UserSettings 모델을 만들거나 JSON 필드에 저장
    // 여기서는 간단히 localStorage에 저장하는 것으로 대체하거나
    // 별도 테이블을 만들어야 함

    // 임시로 성공 응답만 반환
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving dashboard layout:", error);
    return NextResponse.json(
      { error: "Failed to save layout" },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 레이아웃 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 설정에서 레이아웃 조회
    // 실제로는 DB에서 조회해야 함
    // 임시로 빈 레이아웃 반환
    return NextResponse.json({ layout: null });
  } catch (error: any) {
    console.error("Error loading dashboard layout:", error);
    return NextResponse.json(
      { error: "Failed to load layout" },
      { status: 500 }
    );
  }
}

