import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { generateShareToken } from "@/lib/api/share-token";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// Schema for POST /api/quotes/:id/share
const CreateShareSchema = z.object({
  enabled: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Helper function to check quote access.
 *
 * #quote-share-organization-scope — 3-source priority:
 *   1. user owner — quote.userId === session.user.id (기존)
 *   2. organization member — quote.organizationId 가 user 의
 *      OrganizationMember.organizationId 와 매칭 (NEW, multi-user
 *      collaboration 정합). vendor-requests cluster sweep 정합 — 같은
 *      조직 내 다른 user 의 quote 도 share 가능해야 함.
 *   3. guest key — quote.guestKey 매칭 (기존)
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

  // #quote-share-organization-scope — organization member 매칭.
  //   같은 조직 내 다른 user 의 quote 도 share 가능. user-level ownership /
  //   guest key 보존 (3-source priority chain).
  let isOrgMember = false;
  if (session?.user?.id && quote.organizationId) {
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: quote.organizationId,
      },
      select: { id: true },
    });
    isOrgMember = !!membership;
  }

  // Check if user has access (3 source priority).
  const hasAccess =
    (session?.user?.id && quote.userId === session.user.id) ||
    isOrgMember || // organizationMember 매칭 — 같은 조직 내 다른 user 의 quote 도 share 가능
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const { id } = await params;
    const { allowed, quote, error, status } = await checkQuoteAccess(id, request);

    if (!allowed || !quote) {
      return NextResponse.json({ error }, { status });
    }

    // ── Security enforcement ──
    // #quote-share-organization-scope — userId / userRole 을 session 에서
    //   forward (이전 `quote.userId` / `undefined` drift 차단). enforceAction
    //   의 actor 는 logged-in user (호영님 ADMIN → ops_admin) 이지 quote
    //   owner 가 아님. role 미forward (i.e. literal undefined) 시
    //   mapUserRole 의 fallback ['requester'] → matrix mismatch → 403
    //   (vendor-requests cluster 동일 pattern).
    const session = await auth();
    enforcement = enforceAction({
      userId: session?.user?.id ?? quote.userId,
      userRole: session?.user?.role,
      action: 'quote_share',
      targetEntityType: 'quote',
      targetEntityId: id,
      sourceSurface: 'quote-share-api',
      routePath: '/api/quotes/[id]/share',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

      enforcement.complete({
        beforeState: { enabled: existingShare.enabled, expiresAt: existingShare.expiresAt },
        afterState: { enabled: updatedShare.enabled, expiresAt: updatedShare.expiresAt },
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

    enforcement.complete({
      beforeState: { shareToken: null },
      afterState: { shareToken: newShare.shareToken, enabled: newShare.enabled },
    });

    return NextResponse.json({
      shareToken: newShare.shareToken,
      enabled: newShare.enabled,
      expiresAt: newShare.expiresAt,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${newShare.shareToken}`,
    }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const { id } = await params;
    const { allowed, quote, error, status } = await checkQuoteAccess(id, request);

    if (!allowed || !quote) {
      return NextResponse.json({ error }, { status });
    }

    // ── Security enforcement ──
    // #quote-share-organization-scope — DELETE 분기도 동일 actor forward.
    //   POST 와 동일 pattern (vendor-requests cluster sweep).
    const session = await auth();
    enforcement = enforceAction({
      userId: session?.user?.id ?? quote.userId,
      userRole: session?.user?.role,
      action: 'quote_share',
      targetEntityType: 'quote',
      targetEntityId: id,
      sourceSurface: 'quote-share-api',
      routePath: '/api/quotes/[id]/share',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    enforcement.complete({
      beforeState: { enabled: share.enabled },
      afterState: { enabled: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
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
