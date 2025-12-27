import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/admin/inbound-emails");

/**
 * Verify user has admin access
 * TODO: Implement proper admin role check
 */
async function verifyAdminAccess(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  // For MVP, check if user role is ADMIN
  // In production, use workspace-based or organization-based admin check
  return user?.role === "ADMIN";
}

/**
 * GET /api/admin/inbound-emails
 * List inbound emails with filtering
 * Query params: status, page, limit
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "MATCHED" | "UNMATCHED" | "FAILED" | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [emails, totalCount] = await Promise.all([
      db.inboundEmail.findMany({
        where,
        include: {
          matchedQuote: {
            select: {
              id: true,
              title: true,
              userId: true,
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inboundEmail.count({ where }),
    ]);

    logger.info(`Retrieved ${emails.length} inbound emails`, {
      status,
      page,
      totalCount,
    });

    return NextResponse.json({
      emails,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    return handleApiError(error, "admin/inbound-emails");
  }
}
