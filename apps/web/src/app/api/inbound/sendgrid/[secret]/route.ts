import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";
import {
  uploadQuoteReplyAttachment,
  AttachmentStorageNotConfiguredError,
} from "@/lib/email/quote-reply-attachment-storage";

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
          // §inbound-rfq-autocapture P2 — 실제 object storage 업로드(메타-only placeholder 제거).
          //   storage 성공 시에만 QuoteReplyAttachment 생성 → 누락을 fake success 로 가리지 않음.
          const buffer = Buffer.from(await file.arrayBuffer());
          const { bucket, path, sizeBytes } = await uploadQuoteReplyAttachment({
            buffer,
            filename: file.name,
            quoteId,
            replyId: newReply.id,
            contentType: file.type || "application/octet-stream",
          });

          // Create attachment record (실 bucket/path — 업로드 성공 시에만)
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

          logger.info("Attachment uploaded", { fileName: file.name, path });
        } catch (error) {
          // §inbound-rfq-autocapture P2 — storage 미설정/실패 시 placeholder success 금지.
          //   QuoteReply 는 보존(원문 InboundEmail 도 보존)하되, 첨부는 명시 skip + 명확 로그.
          //   인프라(STORAGE_PROVIDER/bucket) 준비 후 원본에서 재처리 가능(누락을 silent 로 숨기지 않음).
          if (error instanceof AttachmentStorageNotConfiguredError) {
            logger.warn("Attachment storage 미설정 — 첨부 skip(메타 placeholder 생성 안 함)", {
              fileName: file.name,
              replyId: newReply.id,
            });
          } else {
            logger.error("Attachment 업로드 실패 — skip", {
              fileName: file.name,
              replyId: newReply.id,
              error,
            });
          }
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
