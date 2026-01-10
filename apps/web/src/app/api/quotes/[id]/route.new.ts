import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { z } from "zod";

// Helper function to check access (owner or guestKey match)
async function checkQuoteAccess(quoteId: string, request: NextRequest) {
  const session = await auth();
  const headerGuestKey = request.headers.get("X-Guest-Key");

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        orderBy: {
          lineNumber: "asc",
        },
      },
    },
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
 * GET /api/quotes/:id
 * Get a specific quote (supports both authenticated users and guest users)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allowed, quote, error, status } = await checkQuoteAccess(id, request);

    if (!allowed || !quote) {
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// Schema for PATCH /api/quotes/:id
const UpdateQuoteSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "RESPONDED", "COMPLETED", "PURCHASED", "CANCELLED"]).optional(),
  items: z.array(z.object({
    id: z.string().optional(), // Existing item ID (for update)
    productId: z.string().optional(),
    name: z.string().min(1),
    brand: z.string().optional(),
    catalogNumber: z.string().optional(),
    unit: z.string().default("ea"),
    quantity: z.number().int().positive().default(1),
    unitPrice: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    raw: z.record(z.unknown()).optional(),
  })).optional(),
});

/**
 * PATCH /api/quotes/:id
 * Update a quote (title, status, items)
 * Items are replaced entirely (upsert strategy)
 */
export async function PATCH(
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
    const validation = UpdateQuoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, status: newStatus, items } = validation.data;

    // Update quote
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (newStatus !== undefined) updateData.status = newStatus;

    // If items are provided, replace all items
    if (items) {
      // Delete all existing items
      await db.quoteListItem.deleteMany({
        where: { quoteId: id },
      });

      // Calculate new total
      const totalAmount = items.reduce((sum: number, item) => sum + ((item.unitPrice || 0) * item.quantity), 0);
      updateData.totalAmount = totalAmount;

      // Create new items
      updateData.items = {
        create: items.map((item: any, index: number) => ({
          productId: item.productId || null,
          lineNumber: index + 1,
          name: item.name,
          brand: item.brand || null,
          catalogNumber: item.catalogNumber || null,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice || null,
          lineTotal: item.unitPrice ? item.unitPrice * item.quantity : null,
          currency: "KRW",
          notes: item.notes || null,
          raw: item.raw || null,
        })),
      };
    }

    const updatedQuote = await db.quote.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
    });

    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes/:id
 * Delete a quote
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

    await db.quote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}
