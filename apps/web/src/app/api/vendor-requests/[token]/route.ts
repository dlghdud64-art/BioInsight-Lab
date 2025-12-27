import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidVendorRequestToken } from "@/lib/api/vendor-request-token";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

/**
 * GET /api/vendor-requests/:token
 * Get vendor request details (public endpoint)
 * Rate limited: 60 requests per minute per IP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token format
    if (!isValidVendorRequestToken(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitKey = `vendor-request:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      interval: 60 * 1000,
      maxRequests: 60,
    });

    const headers = new Headers({
      "X-RateLimit-Limit": rateLimit.limit.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": new Date(rateLimit.reset).toISOString(),
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers }
      );
    }

    // Find vendor request
    const vendorRequest = await db.quoteVendorRequest.findUnique({
      where: { token },
      include: {
        responseItems: true,
      },
    });

    if (!vendorRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404, headers }
      );
    }

    // Check if expired
    if (vendorRequest.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This request has expired", isExpired: true },
        { status: 410, headers }
      );
    }

    // Check if cancelled
    if (vendorRequest.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This request has been cancelled" },
        { status: 410, headers }
      );
    }

    // Parse snapshot data
    const snapshot = vendorRequest.snapshot as {
      quoteId: string;
      title: string;
      createdAt: string;
      items: Array<{
        quoteItemId: string;
        lineNumber: number;
        productName: string;
        brand: string;
        catalogNumber: string;
        quantity: number;
        unit: string;
        currentPrice: number | null;
        packSize: string | null;
        notes: string | null;
      }>;
    };

    // Check if editing is allowed
    const canEdit = vendorRequest.status === "RESPONDED" &&
                    vendorRequest.responseEditCount < vendorRequest.responseEditLimit;

    // Return safe data from snapshot (frozen at request time)
    return NextResponse.json(
      {
        vendorRequest: {
          id: vendorRequest.id,
          vendorName: vendorRequest.vendorName,
          message: vendorRequest.message,
          status: vendorRequest.status,
          expiresAt: vendorRequest.expiresAt,
          respondedAt: vendorRequest.respondedAt,
          snapshotCreatedAt: vendorRequest.snapshotCreatedAt,
          responseEditCount: vendorRequest.responseEditCount,
          responseEditLimit: vendorRequest.responseEditLimit,
          canEdit,
        },
        quote: {
          id: snapshot.quoteId,
          title: snapshot.title,
          currency: "KRW", // Default from snapshot
        },
        items: snapshot.items.map((item: any) => ({
          id: item.quoteItemId,
          lineNumber: item.lineNumber,
          name: item.productName,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          unit: item.unit,
          quantity: item.quantity,
          // Find existing response for this item
          existingResponse: vendorRequest.responseItems.find(
            (r: any) => r.quoteItemId === item.quoteItemId
          ) || null,
        })),
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching vendor request:", error);
    return NextResponse.json(
      { error: "Failed to fetch request" },
      { status: 500 }
    );
  }
}
