import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";

const logger = createLogger("api/inbound/sendgrid");

// Force Node.js runtime for file upload handling
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Max file size for attachments (10MB)
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/**
 * Extract RFQ token from email "to" address
 * Pattern: rfq+<token>@inbound.domain.com
 */
function extractRfqToken(toAddress: string): string | null {
  const match = toAddress.match(/rfq\+([A-Za-z0-9_-]{16,})@/i);
  return match ? match[1] : null;
}

/**
 * Extract Message-ID from email headers
 * Falls back to hash of from+subject+timestamp if not found
 */
function extractMessageId(
  headers: string | undefined,
  from: string,
  subject: string
): string {
  if (headers) {
    // Try to find Message-ID header
    const match = headers.match(/Message-ID:\s*<([^>]+)>/im);
    if (match) {
      return match[1];
    }
  }

  // Fallback: create hash from email metadata
  const fallback = `${from}|${subject}|${Date.now()}`;
  return `synthetic-${crypto.createHash("sha256").update(fallback).digest("hex").substring(0, 32)}`;
}

/**
 * Upload attachment to Supabase Storage
 * TODO: Implement Supabase storage client
 */
async function uploadAttachment(
  file: File,
  quoteId: string,
  replyId: string
): Promise<{ bucket: string; path: string; sizeBytes: number }> {
  // For MVP, we'll skip actual upload and just return metadata
  // In production, use @supabase/storage-js to upload

  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `quote/${quoteId}/reply/${replyId}/${timestamp}_${sanitizedFileName}`;

  logger.warn("Attachment upload not implemented - storing metadata only", {
    fileName: file.name,
    size: file.size,
    path,
  });

  // TODO: Actual upload code
  // const supabase = createClient(...)
  // await supabase.storage.from('quote-replies').upload(path, file)

  return {
    bucket: "quote-replies",
    path,
    sizeBytes: file.size,
  };
}

/**
 * POST /api/inbound/sendgrid/[secret]
 * SendGrid Inbound Parse webhook endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { secret: string } }
) {
  try {
    // Verify webhook secret
    const expectedSecret = process.env.SENDGRID_INBOUND_SECRET;
    if (!expectedSecret || params.secret !== expectedSecret) {
      logger.warn("Invalid webhook secret", { providedSecret: params.secret });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();

    // Extract email fields
    const to = formData.get("to") as string;
    const from = formData.get("from") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string | null;
    const html = formData.get("html") as string | null;
    const headers = formData.get("headers") as string | undefined;
    const attachmentInfo = formData.get("attachment-info") as string | null;

    if (!to || !from || !subject) {
      logger.error("Missing required email fields", { to, from, subject });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    logger.info("Received inbound email", {
      to,
      from,
      subject: subject.substring(0, 50),
    });

    // Extract Message-ID for deduplication
    const messageId = extractMessageId(headers, from, subject);

    // Check for duplicate
    const existing = await db.inboundEmail.findUnique({
      where: { messageId },
    });

    if (existing) {
      logger.info("Duplicate email detected - skipping", { messageId });
      return NextResponse.json({ ok: true, deduped: true });
    }

    // Parse attachment metadata
    let attachmentsMeta: any[] = [];
    if (attachmentInfo) {
      try {
        const parsed = JSON.parse(attachmentInfo);
        attachmentsMeta = Object.entries(parsed).map(([key, value]: [string, any]) => ({
          filename: value.filename,
          type: value.type,
          length: value.length,
        }));
      } catch (e) {
        logger.warn("Failed to parse attachment-info", { attachmentInfo });
      }
    }

    // Extract RFQ token from "to" address
    const rfqToken = extractRfqToken(to);

    if (!rfqToken) {
      // No token found - save as unmatched
      logger.info("No RFQ token found in recipient address", { to });

      await db.inboundEmail.create({
        data: {
          provider: "sendgrid",
          messageId,
          to,
          from,
          subject,
          text,
          html,
          rawHeaders: headers ? { headers } : null,
          attachmentsMeta: attachmentsMeta.length > 0 ? attachmentsMeta : null,
          status: "UNMATCHED",
          receivedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true, matched: false });
    }

    // Look up RFQ token
    const tokenRecord = await db.quoteRfqToken.findUnique({
      where: {
        token: rfqToken,
        enabled: true, // Only match enabled tokens
      },
      include: {
        quote: true,
      },
    });

    if (!tokenRecord) {
      // Token not found or disabled - save as unmatched
      logger.info("RFQ token not found or disabled", { token: rfqToken });

      await db.inboundEmail.create({
        data: {
          provider: "sendgrid",
          messageId,
          to,
          from,
          subject,
          text,
          html,
          rawHeaders: headers ? { headers } : null,
          attachmentsMeta: attachmentsMeta.length > 0 ? attachmentsMeta : null,
          status: "UNMATCHED",
          receivedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true, matched: false });
    }

    // Check token expiration
    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      logger.info("RFQ token expired", {
        token: rfqToken,
        expiresAt: tokenRecord.expiresAt,
      });

      await db.inboundEmail.create({
        data: {
          provider: "sendgrid",
          messageId,
          to,
          from,
          subject,
          text,
          html,
          rawHeaders: headers ? { headers } : null,
          attachmentsMeta: attachmentsMeta.length > 0 ? attachmentsMeta : null,
          status: "UNMATCHED",
          receivedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true, matched: false });
    }

    // Token matched! Create QuoteReply
    const quoteId = tokenRecord.quoteId;

    logger.info("RFQ token matched", {
      token: rfqToken,
      quoteId,
      from,
    });

    // Create QuoteReply in transaction
    const reply = await db.$transaction(async (tx: any) => {
      // Create reply
      const newReply = await tx.quoteReply.create({
        data: {
          quoteId,
          fromEmail: from,
          subject,
          bodyText: text,
          bodyHtml: html,
          receivedAt: new Date(),
        },
      });

      // Process attachments
      const attachmentFiles = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("attachment") && value instanceof File) {
          attachmentFiles.push(value);
        }
      }

      logger.info(`Processing ${attachmentFiles.length} attachments`, {
        replyId: newReply.id,
      });

      for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE) {
          logger.warn("Attachment too large - skipping", {
            fileName: file.name,
            size: file.size,
          });
          continue;
        }

        try {
          // Upload to storage
          const { bucket, path, sizeBytes } = await uploadAttachment(
            file,
            quoteId,
            newReply.id
          );

          // Create attachment record
          await tx.quoteReplyAttachment.create({
            data: {
              replyId: newReply.id,
              fileName: file.name,
              contentType: file.type || "application/octet-stream",
              sizeBytes,
              bucket,
              path,
            },
          });

          logger.info("Attachment uploaded", {
            fileName: file.name,
            path,
          });
        } catch (error) {
          logger.error("Failed to upload attachment", {
            fileName: file.name,
            error,
          });
          // Continue processing other attachments
        }
      }

      // Save inbound email record
      await tx.inboundEmail.create({
        data: {
          provider: "sendgrid",
          messageId,
          to,
          from,
          subject,
          text,
          html,
          rawHeaders: headers ? { headers } : null,
          attachmentsMeta: attachmentsMeta.length > 0 ? attachmentsMeta : null,
          matchedQuoteId: quoteId,
          status: "MATCHED",
          receivedAt: new Date(),
        },
      });

      return newReply;
    });

    logger.info("Quote reply created successfully", {
      replyId: reply.id,
      quoteId,
    });

    return NextResponse.json({ ok: true, matched: true, replyId: reply.id });
  } catch (error) {
    logger.error("Webhook processing failed", { error });

    // Still return 200 to prevent SendGrid retries on permanent errors
    // Log the error for manual investigation
    return NextResponse.json(
      { ok: false, error: "Internal processing error" },
      { status: 200 } // Return 200 to avoid retries
    );
  }
}
