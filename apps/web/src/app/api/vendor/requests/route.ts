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
        quoteTitle: "2024 Q1 시약 구매",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        itemCount: 5,
        updatedAt: new Date(),
      },
      {
        id: "req-2",
        quoteTitle: "Cell Culture 소모품",
        status: "RESPONDED",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        itemCount: 12,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "req-3",
        quoteTitle: "PCR 장비 및 소모품",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        itemCount: 8,
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];

    const filteredRequests = status && status !== "ALL"
      ? mockRequests.filter((r) => r.status === status)
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

