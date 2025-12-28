import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/vendor/stats
 * Get vendor dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch real stats from database
    // Mock data for now
    const stats = {
      pendingRequests: 12,
      completedQuotes: 45,
      monthlyRevenue: 125000000, // 125M KRW
      responseRate: 94.5,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[Vendor Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
