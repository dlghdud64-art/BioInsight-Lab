import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/requests
 * Get vendor's quote requests
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get vendor from session/token
    // TODO: Filter by status from query params
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    console.log("Fetching vendor requests, status:", status);

    // Mock data for now
    const mockRequests = [
      {
        id: "req-1",
        quoteTitle: "Cell Culture 시약 견적",
        requesterName: "김연구",
        organizationName: "서울대학교 생명과학연구소",
        status: "PENDING",
        requestedAt: new Date(),
        itemCount: 5,
      },
      {
        id: "req-2",
        quoteTitle: "PCR 실험 소모품",
        requesterName: "이박사",
        organizationName: "KAIST 바이오연구소",
        status: "PENDING",
        requestedAt: new Date(Date.now() - 86400000),
        itemCount: 8,
      },
      {
        id: "req-3",
        quoteTitle: "Western Blot 시약",
        requesterName: "박교수",
        organizationName: "연세대학교 의생명연구소",
        status: "RESPONDED",
        requestedAt: new Date(Date.now() - 172800000),
        itemCount: 12,
      },
    ];

    const filteredRequests = status && status !== "ALL"
      ? mockRequests.filter((r: any) => r.status === status)
      : mockRequests;

    return NextResponse.json({
      requests: filteredRequests,
    });
  } catch (error) {
    console.error("Fetch vendor requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

