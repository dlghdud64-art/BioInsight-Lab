import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";
import { sendEmail } from "@/lib/email/sender";
import { generateVendorQuoteRequestEmail } from "@/lib/email/vendor-request-templates";
import { z } from "zod";

// Schema for POST /api/quotes/:id/vendor-requests
const VendorSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
});

const CreateVendorRequestsSchema = z.object({
  vendors: z.array(VendorSchema).min(1, "At least one vendor required"),
  message: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

/**
 * Helper function to check quote access
 */
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
 * POST /api/quotes/:id/vendor-requests
 * Create vendor quote requests and send emails
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
    const validation = CreateVendorRequestsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { vendors, message, expiresInDays } = validation.data;

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Create snapshot of current quote state
    const snapshot = {
      quoteId: quote.id,
      title: quote.title,
      createdAt: quote.createdAt.toISOString(),
      items: quote.items.map((item) => ({
        quoteItemId: item.id,
        lineNumber: item.lineNumber,
        productName: item.name || "",
        brand: item.brand || "",
        catalogNumber: item.catalogNumber || "",
        quantity: item.quantity,
        unit: item.unit || "ea",
        currentPrice: item.price || null,
        packSize: item.packSize || null,
        notes: item.notes || null,
      })),
    };

    // Create vendor requests
    const createdRequests = [];
    const emailResults = [];

    for (const vendor of vendors) {
      // Generate unique token
      const token = generateVendorRequestToken();

      // Create vendor request with snapshot
      const vendorRequest = await db.quoteVendorRequest.create({
        data: {
          quoteId: id,
          vendorEmail: vendor.email,
          vendorName: vendor.name || null,
          message: message || null,
          token,
          status: "SENT",
          expiresAt,
          snapshot,
        },
      });

      createdRequests.push({
        id: vendorRequest.id,
        vendorEmail: vendorRequest.vendorEmail,
        vendorName: vendorRequest.vendorName,
        token: vendorRequest.token,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vendor/${vendorRequest.token}`,
        status: vendorRequest.status,
        expiresAt: vendorRequest.expiresAt,
        createdAt: vendorRequest.createdAt,
      });

      // Send email
      try {
        const emailTemplate = generateVendorQuoteRequestEmail({
          vendorName: vendor.name,
          quoteTitle: quote.title,
          itemCount: quote.items.length,
          message: message,
          responseUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vendor/${vendorRequest.token}`,
          expiresAt,
        });

        await sendEmail({
          to: vendor.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });

        emailResults.push({ email: vendor.email, success: true });
        console.log(`Vendor request email sent to ${vendor.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${vendor.email}:`, emailError);
        emailResults.push({
          email: vendor.email,
          success: false,
          error: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      createdRequests,
      emailResults,
      summary: {
        total: vendors.length,
        emailsSent: emailResults.filter((r) => r.success).length,
        emailsFailed: emailResults.filter((r) => !r.success).length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor requests:", error);
    return NextResponse.json(
      { error: "Failed to create vendor requests" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quotes/:id/vendor-requests
 * Get all vendor requests for a quote
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

    const vendorRequests = await db.quoteVendorRequest.findMany({
      where: { quoteId: id },
      include: {
        responseItems: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Check for expired requests and update status
    const now = new Date();
    for (const vendorRequest of vendorRequests) {
      if (vendorRequest.status === "SENT" && vendorRequest.expiresAt < now) {
        await db.quoteVendorRequest.update({
          where: { id: vendorRequest.id },
          data: { status: "EXPIRED" },
        });
        vendorRequest.status = "EXPIRED";
      }
    }

    // Return vendor requests with snapshot info for internal comparison
    return NextResponse.json({
      vendorRequests: vendorRequests.map((vr) => ({
        ...vr,
        // Include snapshot for internal UI to use frozen item list
        snapshot: vr.snapshot,
      })),
    });
  } catch (error) {
    console.error("Error fetching vendor requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor requests" },
      { status: 500 }
    );
  }
}
