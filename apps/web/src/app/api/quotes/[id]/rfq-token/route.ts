import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { buildRfqReplyAddress } from "@/lib/email/rfq-reply-address";

const logger = createLogger("api/quotes/[id]/rfq-token");

/**
 * Generate URL-safe random token
 * Length: 32-48 characters (base64url encoded)
 */
function generateRfqToken(): string {
  // Generate 32 random bytes -> base64url encode -> 43 chars
  return crypto
    .randomBytes(32)
    .toString("base64url")
    .substring(0, 48); // Ensure max 48 chars
}

/**
 * Verify user has access to quote.
 *
 * #quote-multi-user-ownership-sweep-final — 2-source ownership: user owner OR
 * organization member. multi-user collaboration 정합 (vendor-requests cluster
 * sub-trial sweep, ADR-002).
 */
async function verifyQuoteAccess(quoteId: string, userId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, userId: true, organizationId: true },
  });

  if (!quote) {
    throw new Error("Quote not found or access denied");
  }

  const isOwner = quote.userId === userId;
  let isOrgMember = false;
  if (!isOwner && quote.organizationId) {
    const membership = await db.organizationMember.findFirst({
      where: { userId, organizationId: quote.organizationId },
      select: { id: true },
    });
    isOrgMember = !!membership;
  }

  if (!isOwner && !isOrgMember) {
    throw new Error("Quote not found or access denied");
  }

  return quote;
}

/**
 * POST /api/quotes/[id]/rfq-token
 * Generate or retrieve RFQ token for email-based vendor replies
 * One token per quote - if exists, return existing; otherwise create new
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const quoteId = params.id;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_update',
      targetEntityType: 'quote',
      targetEntityId: quoteId,
      sourceSurface: 'quote-rfq-token-api',
      routePath: '/api/quotes/[id]/rfq-token',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Verify access
    await verifyQuoteAccess(quoteId, session.user.id);

    // Check for existing token
    let rfqToken = await db.quoteRfqToken.findUnique({
      where: { quoteId },
    });

    if (rfqToken) {
      logger.info(`Returning existing RFQ token for quote ${quoteId}`);

      // Build reply address (§inbound-rfq-autocapture P1 — 공용 빌더 DRY, placeholder 제거)
      const replyAddress = buildRfqReplyAddress(rfqToken.token);

      return NextResponse.json({
        token: rfqToken.token,
        replyAddress,
        enabled: rfqToken.enabled,
        expiresAt: rfqToken.expiresAt,
        createdAt: rfqToken.createdAt,
      });
    }

    // Create new token
    const token = generateRfqToken();

    rfqToken = await db.quoteRfqToken.create({
      data: {
        quoteId,
        token,
        enabled: true,
      },
    });

    logger.info(`Created new RFQ token for quote ${quoteId}`, {
      tokenLength: token.length,
    });

    // Build reply address (§inbound-rfq-autocapture P1 — 공용 빌더, fallback labaxis.co.kr)
    const replyAddress = buildRfqReplyAddress(rfqToken.token);

    enforcement.complete({});

    return NextResponse.json(
      {
        token: rfqToken.token,
        replyAddress,
        enabled: rfqToken.enabled,
        expiresAt: rfqToken.expiresAt,
        createdAt: rfqToken.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    enforcement?.fail();
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "quotes/[id]/rfq-token");
  }
}

/**
 * GET /api/quotes/[id]/rfq-token
 * Retrieve existing RFQ token if it exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const quoteId = params.id;

    // Verify access
    await verifyQuoteAccess(quoteId, session.user.id);

    // Get existing token
    const rfqToken = await db.quoteRfqToken.findUnique({
      where: { quoteId },
    });

    if (!rfqToken) {
      return NextResponse.json(
        { error: "No RFQ token found for this quote" },
        { status: 404 }
      );
    }

    // Build reply address (§inbound-rfq-autocapture P1 — 공용 빌더, fallback labaxis.co.kr)
    const replyAddress = buildRfqReplyAddress(rfqToken.token);

    return NextResponse.json({
      token: rfqToken.token,
      replyAddress,
      enabled: rfqToken.enabled,
      expiresAt: rfqToken.expiresAt,
      createdAt: rfqToken.createdAt,
    });
  } catch (error) {
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "quotes/[id]/rfq-token");
  }
}

/**
 * PATCH /api/quotes/[id]/rfq-token
 * Update RFQ token settings (enable/disable)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const quoteId = params.id;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_update',
      targetEntityType: 'quote',
      targetEntityId: quoteId,
      sourceSurface: 'quote-rfq-token-api',
      routePath: '/api/quotes/[id]/rfq-token',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Verify access
    await verifyQuoteAccess(quoteId, session.user.id);

    const body = await request.json();
    const { enabled, expiresAt } = body;

    // Update token
    const rfqToken = await db.quoteRfqToken.update({
      where: { quoteId },
      data: {
        ...(typeof enabled === "boolean" ? { enabled } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      },
    });

    logger.info(`Updated RFQ token settings for quote ${quoteId}`, {
      enabled: rfqToken.enabled,
    });

    // Build reply address (§inbound-rfq-autocapture P1 — 공용 빌더, fallback labaxis.co.kr)
    const replyAddress = buildRfqReplyAddress(rfqToken.token);

    enforcement.complete({});

    return NextResponse.json({
      token: rfqToken.token,
      replyAddress,
      enabled: rfqToken.enabled,
      expiresAt: rfqToken.expiresAt,
      createdAt: rfqToken.createdAt,
    });
  } catch (error) {
    enforcement?.fail();
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "quotes/[id]/rfq-token");
  }
}
