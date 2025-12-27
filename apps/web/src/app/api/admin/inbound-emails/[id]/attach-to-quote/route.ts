import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api/admin/inbound-emails/[id]/attach-to-quote");

const attachSchema = z.object({
  quoteId: z.string().min(1, "quoteId is required"),
});

/**
 * Verify user has admin access
 */
async function verifyAdminAccess(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  return user?.role === "ADMIN";
}

/**
 * POST /api/admin/inbound-emails/[id]/attach-to-quote
 * Manually attach unmatched email to a quote
 * Body: { quoteId }
 */
export async function POST(
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

    // Verify admin access
    const isAdmin = await verifyAdminAccess(session.user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const emailId = params.id;
    const body = await request.json();
    const { quoteId } = attachSchema.parse(body);

    // Get inbound email
    const inboundEmail = await db.inboundEmail.findUnique({
      where: { id: emailId },
    });

    if (!inboundEmail) {
      return NextResponse.json(
        { error: "Inbound email not found" },
        { status: 404 }
      );
    }

    // Verify quote exists
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    // Check if already matched to a different quote
    if (inboundEmail.status === "MATCHED" && inboundEmail.matchedQuoteId !== quoteId) {
      logger.warn("Email already matched to different quote", {
        emailId,
        currentQuoteId: inboundEmail.matchedQuoteId,
        newQuoteId: quoteId,
      });
    }

    // Create QuoteReply and update InboundEmail
    const result = await db.$transaction(async (tx) => {
      // Create reply
      const reply = await tx.quoteReply.create({
        data: {
          quoteId,
          fromEmail: inboundEmail.from,
          subject: inboundEmail.subject,
          bodyText: inboundEmail.text,
          bodyHtml: inboundEmail.html,
          receivedAt: inboundEmail.receivedAt,
        },
      });

      // Update inbound email status
      await tx.inboundEmail.update({
        where: { id: emailId },
        data: {
          matchedQuoteId: quoteId,
          status: "MATCHED",
        },
      });

      logger.info("Manually attached email to quote", {
        emailId,
        quoteId,
        replyId: reply.id,
        adminUserId: session.user.id,
      });

      return reply;
    });

    return NextResponse.json({
      success: true,
      replyId: result.id,
      quoteId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "admin/inbound-emails/[id]/attach-to-quote");
  }
}
