import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidVendorRequestToken } from "@/lib/api/vendor-request-token";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { z } from "zod";

// Schema for vendor response item
const ResponseItemSchema = z.object({
  quoteItemId: z.string(),
  unitPrice: z.number().int().nonnegative().optional(),
  currency: z.string().default("KRW"),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.number().int().positive().optional(),
  vendorSku: z.string().optional(),
  notes: z.string().optional(),
});

const SubmitResponseSchema = z.object({
  items: z.array(ResponseItemSchema).min(1),
  vendorName: z.string().optional(),
});

/**
 * POST /api/vendor-requests/:token/response
 * Submit vendor response (public endpoint)
 */
export async function POST(
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
    const rateLimitKey = `vendor-response:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      interval: 60 * 1000,
      maxRequests: 10, // Stricter limit for submissions
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // Find vendor request
    const vendorRequest = await db.quoteVendorRequest.findUnique({
      where: { token },
    });

    if (!vendorRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check if expired
    if (vendorRequest.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This request has expired" },
        { status: 410 }
      );
    }

    // Check if cancelled
    if (vendorRequest.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This request has been cancelled" },
        { status: 410 }
      );
    }

    // Check if already responded and handle edit limits
    const isEdit = vendorRequest.status === "RESPONDED";

    if (isEdit) {
      // Check if edit limit exceeded
      if (vendorRequest.responseEditCount >= vendorRequest.responseEditLimit) {
        return NextResponse.json(
          {
            error: "Edit limit exceeded. No further modifications are allowed.",
            editCount: vendorRequest.responseEditCount,
            editLimit: vendorRequest.responseEditLimit,
          },
          { status: 403 }
        );
      }
    }

    // Parse snapshot data
    const snapshot = vendorRequest.snapshot as {
      quoteId: string;
      items: Array<{
        quoteItemId: string;
      }>;
    };

    // Parse and validate request body
    const body = await request.json();
    const validation = SubmitResponseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { items, vendorName } = validation.data;

    // Validate all quote item IDs against snapshot (not live quote)
    const snapshotItemIds = snapshot.items.map((item: any) => item.quoteItemId);
    const invalidItems = items.filter((item: any) => !snapshotItemIds.includes(item.quoteItemId));

    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "Invalid quote item IDs. Items do not match the original request.", invalidItems },
        { status: 400 }
      );
    }

    // Get existing response items for comparison (if editing)
    let changedItemCount = 0;
    if (isEdit) {
      const existingItems = await db.quoteVendorResponseItem.findMany({
        where: { vendorRequestId: vendorRequest.id },
      });

      // Count changed items
      items.forEach((newItem: any) => {
        const existing = existingItems.find((e: any) => e.quoteItemId === newItem.quoteItemId);
        if (!existing ||
            existing.unitPrice !== newItem.unitPrice ||
            existing.leadTimeDays !== newItem.leadTimeDays ||
            existing.moq !== newItem.moq ||
            existing.vendorSku !== newItem.vendorSku) {
          changedItemCount++;
        }
      });
    }

    // Create/update response items
    await db.$transaction(async (tx: any) => {
      // Upsert response items
      for (const item of items) {
        await tx.quoteVendorResponseItem.upsert({
          where: {
            vendorRequestId_quoteItemId: {
              vendorRequestId: vendorRequest.id,
              quoteItemId: item.quoteItemId,
            },
          },
          create: {
            vendorRequestId: vendorRequest.id,
            quoteItemId: item.quoteItemId,
            unitPrice: item.unitPrice,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays,
            moq: item.moq,
            vendorSku: item.vendorSku,
            notes: item.notes,
          },
          update: {
            unitPrice: item.unitPrice,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays,
            moq: item.moq,
            vendorSku: item.vendorSku,
            notes: item.notes,
            updatedAt: new Date(),
          },
        });
      }

      // Update vendor request status
      if (isEdit) {
        // Editing: increment edit count, keep original respondedAt
        await tx.quoteVendorRequest.update({
          where: { id: vendorRequest.id },
          data: {
            responseEditCount: vendorRequest.responseEditCount + 1,
            ...(vendorName && { vendorName }),
          },
        });
      } else {
        // Initial submission: set status and respondedAt
        await tx.quoteVendorRequest.update({
          where: { id: vendorRequest.id },
          data: {
            status: "RESPONDED",
            respondedAt: new Date(),
            ...(vendorName && { vendorName }),
          },
        });
      }
    });

    if (isEdit) {
      console.log(`Vendor response edited for request ${vendorRequest.id} (edit ${vendorRequest.responseEditCount + 1}/${vendorRequest.responseEditLimit}, ${changedItemCount} items changed)`);
    } else {
      console.log(`Vendor response submitted for request ${vendorRequest.id}`);
    }

    return NextResponse.json({
      ok: true,
      isEdit,
      respondedAt: vendorRequest.respondedAt || new Date(),
      editCount: isEdit ? vendorRequest.responseEditCount + 1 : 0,
      editLimit: vendorRequest.responseEditLimit,
      changedItemCount: isEdit ? changedItemCount : items.length,
      message: isEdit
        ? `견적 회신이 수정되었습니다. (${vendorRequest.responseEditCount + 1}/${vendorRequest.responseEditLimit}회 수정)`
        : "견적 회신이 성공적으로 제출되었습니다.",
    });
  } catch (error) {
    console.error("Error submitting vendor response:", error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}
