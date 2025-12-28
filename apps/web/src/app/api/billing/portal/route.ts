import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import Stripe from "stripe";

const logger = createLogger("api/billing/portal");

// Initialize Stripe lazily to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

const portalSchema = z.object({
  workspaceId: z.string().min(1),
});

/**
 * Verify user is workspace admin
 */
async function verifyWorkspaceAdmin(workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      role: "ADMIN",
    },
    include: {
      workspace: true,
    },
  });

  if (!member) {
    throw new Error("Workspace not found or admin access required");
  }

  return member.workspace;
}

/**
 * POST /api/billing/portal
 * Create Stripe billing portal session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workspaceId } = portalSchema.parse(body);

    // Verify admin access
    const workspace = await verifyWorkspaceAdmin(workspaceId, session.user.id);

    if (!workspace.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found for this workspace" },
        { status: 400 }
      );
    }

    logger.info("Creating portal session", {
      workspaceId,
      userId: session.user.id,
      customerId: workspace.stripeCustomerId,
    });

    const stripe = getStripe();

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspace.slug}/billing`,
    });

    logger.info("Portal session created", {
      sessionId: portalSession.id,
      workspaceId,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    if ((error as Error).message.includes("admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "billing/portal");
  }
}
