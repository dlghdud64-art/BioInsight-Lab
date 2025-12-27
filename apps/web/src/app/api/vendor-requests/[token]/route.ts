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
        quote: {
          include: {
            items: {
              orderBy: {
                lineNumber: "asc",
              },
            },
          },
        },
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

    // Return safe data (no internal info)
    return NextResponse.json(
      {
        vendorRequest: {
          id: vendorRequest.id,
          vendorName: vendorRequest.vendorName,
          message: vendorRequest.message,
          status: vendorRequest.status,
          expiresAt: vendorRequest.expiresAt,
          respondedAt: vendorRequest.respondedAt,
        },
        quote: {
          id: vendorRequest.quote.id,
          title: vendorRequest.quote.title,
          currency: vendorRequest.quote.currency,
        },
        items: vendorRequest.quote.items.map((item) => ({
          id: item.id,
          lineNumber: item.lineNumber,
          name: item.name,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          unit: item.unit,
          quantity: item.quantity,
          // Find existing response for this item
          existingResponse: vendorRequest.responseItems.find(
            (r) => r.quoteItemId === item.id
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
