import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/charts
 * Get chart data for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch real chart data from database
    // Mock data for last 30 days RFQ trend
    const rfqTrend = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
        .toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
      count: Math.floor(Math.random() * 20) + 5,
    }));

    // Mock user distribution
    const userDistribution = [
      { name: "Researcher", value: 856 },
      { name: "Vendor", value: 234 },
      { name: "Admin", value: 12 },
      { name: "Guest", value: 145 },
    ];

    return NextResponse.json({
      charts: {
        rfqTrend,
        userDistribution,
      },
    });
  } catch (error) {
    console.error("[Admin Charts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch charts" },
      { status: 500 }
    );
  }
}

