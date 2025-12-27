import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidShareToken } from "@/lib/api/share-token";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

/**
 * GET /api/share/:token
 * Get read-only quote data via share token
 * Rate limited: 60 requests per minute per IP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token format
    if (!isValidShareToken(token)) {
      return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
    }

    // Rate limiting (60 requests per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimitKey = `share:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      interval: 60 * 1000, // 1 minute
      maxRequests: 60,
    });

    // Add rate limit headers
    const headers = new Headers({
      "X-RateLimit-Limit": rateLimit.limit.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": new Date(rateLimit.reset).toISOString(),
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers,
        }
      );
    }

    // Find share by token
    const share = await db.quoteShare.findUnique({
      where: { shareToken: token },
      include: {
        quote: {
          include: {
            items: {
              orderBy: {
                lineNumber: "asc",
              },
            },
            vendors: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: "Share not found" },
        { status: 404, headers }
      );
    }

    // Check if share is enabled
    if (!share.enabled) {
      return NextResponse.json(
        { error: "This share link has been disabled" },
        { status: 404, headers }
      );
    }

    // Check if share is expired
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This share link has expired" },
        { status: 404, headers }
      );
    }

    // Increment view count (async, non-blocking)
    db.sharedList.updateMany({
      where: { quoteId: share.quoteId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    }).catch((error: any) => {
      console.error("Failed to increment view count:", error);
    });

    // Return read-only quote data
    const { quote } = share;

    return NextResponse.json(
      {
        quote: {
          id: quote.id,
          title: quote.title,
          description: quote.description,
          status: quote.status,
          currency: quote.currency,
          totalAmount: quote.totalAmount,
          items: quote.items.map((item) => ({
            id: item.id,
            lineNumber: item.lineNumber,
            productId: item.productId,
            name: item.name,
            brand: item.brand,
            catalogNumber: item.catalogNumber,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            currency: item.currency,
            notes: item.notes,
          })),
          vendors: quote.vendors?.map((vendor) => ({
            id: vendor.id,
            vendorName: vendor.vendorName,
            email: vendor.email,
            country: vendor.country,
          })) || [],
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
        },
        share: {
          expiresAt: share.expiresAt,
          createdAt: share.createdAt,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching shared quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared quote" },
      { status: 500 }
    );
  }
}
