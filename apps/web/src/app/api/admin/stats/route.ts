import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch real stats from database with auth check
    // Mock data
    const stats = {
      totalUsers: 1247,
      monthlyRFQs: 184,
      activeQuotes: 42,
      revenue: 28500000, // 28.5M KRW
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[Admin Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
