import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { z } from "zod";

// Schema for quote item
const QuoteItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  catalogNumber: z.string().optional(),
  unit: z.string().default("ea"),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});

// Schema for POST /api/quotes
const CreateQuoteSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.array(QuoteItemSchema).default([]),
  guestKey: z.string().optional(), // For explicit guestKey (from X-Guest-Key header)
});

/**
 * POST /api/quotes
 * Create a new quote (supports both authenticated users and guest users)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();

    // Get or create guestKey from cookie or header
    let guestKey: string | undefined;
    const headerGuestKey = request.headers.get("X-Guest-Key");

    if (!session?.user?.id) {
      // Guest user: use guestKey
      guestKey = headerGuestKey || (await getOrCreateGuestKey());
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateQuoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, items } = validation.data;

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item) => sum + ((item.unitPrice || 0) * item.quantity), 0);

    // Create quote with items
    const quote = await db.quote.create({
      data: {
        userId: session?.user?.id || null,
        guestKey: guestKey || null,
        title: title || "새 견적요청서",
        description: description || null,
        status: "PENDING",
        currency: "KRW",
        totalAmount: totalAmount || null,
        items: {
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
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ id: quote.id, quote }, { status: 201 });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quotes
 * Get list of quotes for the authenticated user or guest
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Get guestKey if not authenticated
    let guestKey: string | undefined;
    const headerGuestKey = request.headers.get("X-Guest-Key");

    if (!session?.user?.id) {
      guestKey = headerGuestKey || (await getOrCreateGuestKey());
    }

    // Query quotes
    const quotes = await db.quote.findMany({
      where: session?.user?.id
        ? { userId: session.user.id }
        : { guestKey: guestKey || undefined },
      include: {
        items: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
