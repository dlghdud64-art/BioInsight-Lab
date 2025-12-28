import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/activity
 * Get recent activity logs
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch real activity from database
    // Mock data
    const activities = [
      {
        id: "act-1",
        type: "user_signup",
        description: "신규 사용자 가입: 김연구 (서울대학교)",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        status: "완료",
      },
      {
        id: "act-2",
        type: "rfq_created",
        description: "견적 요청 생성: Cell Culture 시약 (5개 품목)",
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        status: "진행중",
      },
      {
        id: "act-3",
        type: "quote_submitted",
        description: "견적 제출: Thermo Fisher Scientific",
        timestamp: new Date(Date.now() - 1000 * 60 * 120),
        status: "완료",
      },
      {
        id: "act-4",
        type: "user_signup",
        description: "신규 사용자 가입: 이박사 (KAIST)",
        timestamp: new Date(Date.now() - 1000 * 60 * 180),
        status: "완료",
      },
      {
        id: "act-5",
        type: "rfq_created",
        description: "견적 요청 생성: PCR 실험 소모품 (8개 품목)",
        timestamp: new Date(Date.now() - 1000 * 60 * 240),
        status: "진행중",
      },
    ];

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("[Admin Activity] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

