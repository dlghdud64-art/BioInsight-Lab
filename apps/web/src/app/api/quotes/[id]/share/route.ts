import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { generateShareToken } from "@/lib/api/share-token";
import { z } from "zod";

// Schema for POST /api/quotes/:id/share
const CreateShareSchema = z.object({
  enabled: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Helper function to check quote access (owner or guestKey match)
 */
async function checkQuoteAccess(quoteId: string, request: NextRequest) {
  const session = await auth();
  const headerGuestKey = request.headers.get("X-Guest-Key");

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
  });

  if (!quote) {
    return { allowed: false, quote: null, error: "Quote not found", status: 404 };
  }

  // Check if user has access
  const hasAccess =
    (session?.user?.id && quote.userId === session.user.id) ||
    (quote.guestKey && (quote.guestKey === headerGuestKey || quote.guestKey === (await getOrCreateGuestKey())));

  if (!hasAccess) {
    return { allowed: false, quote: null, error: "Forbidden", status: 403 };
  }

  return { allowed: true, quote, error: null, status: 200 };
}

/**
 * POST /api/quotes/:id/share
 * Create or update share link for a quote
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allowed, quote, error, status } = await checkQuoteAccess(id, request);

    if (!allowed || !quote) {
      return NextResponse.json({ error }, { status });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { enabled, expiresInDays } = validation.data;

    // Calculate expiration date
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Check if share already exists
    const existingShare = await db.quoteShare.findUnique({
      where: { quoteId: id },
    });

    if (existingShare) {
      // Update existing share
      const updatedShare = await db.quoteShare.update({
        where: { quoteId: id },
        data: {
          enabled,
          expiresAt,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        shareToken: updatedShare.shareToken,
        enabled: updatedShare.enabled,
        expiresAt: updatedShare.expiresAt,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${updatedShare.shareToken}`,
      });
    }

    // Create new share
    const shareToken = generateShareToken();

    const newShare = await db.quoteShare.create({
      data: {
        quoteId: id,
        shareToken,
        enabled,
        expiresAt,
      },
    });

    return NextResponse.json({
      shareToken: newShare.shareToken,
      enabled: newShare.enabled,
      expiresAt: newShare.expiresAt,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${newShare.shareToken}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating share:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes/:id/share
 * Disable share link for a quote
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allowed, error, status } = await checkQuoteAccess(id, request);

    if (!allowed) {
      return NextResponse.json({ error }, { status });
    }

    // Find and disable share
    const share = await db.quoteShare.findUnique({
      where: { quoteId: id },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Disable instead of delete (soft delete)
    await db.quoteShare.update({
      where: { quoteId: id },
      data: {
        enabled: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting share:", error);
    return NextResponse.json(
      { error: "Failed to delete share" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quotes/:id/share
 * Get share information for a quote
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allowed, error, status } = await checkQuoteAccess(id, request);

    if (!allowed) {
      return NextResponse.json({ error }, { status });
    }

    const share = await db.quoteShare.findUnique({
      where: { quoteId: id },
    });

    if (!share) {
      return NextResponse.json({ share: null });
    }

    return NextResponse.json({
      share: {
        shareToken: share.shareToken,
        enabled: share.enabled,
        expiresAt: share.expiresAt,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${share.shareToken}`,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching share:", error);
    return NextResponse.json(
      { error: "Failed to fetch share" },
      { status: 500 }
    );
  }
}
