import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import Stripe from "stripe";

const logger = createLogger("api/billing/checkout");

// Initialize Stripe - use dummy key during build time
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  apiVersion: "2025-12-15.clover" as any,
});

const checkoutSchema = z.object({
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
 * POST /api/billing/checkout
 * Create Stripe checkout session for workspace subscription
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
    const { workspaceId } = checkoutSchema.parse(body);

    // Verify admin access
    const workspace = await verifyWorkspaceAdmin(workspaceId, session.user.id);

    logger.info("Creating checkout session", {
      workspaceId,
      userId: session.user.id,
      currentPlan: workspace.plan,
    });

    // Get or create Stripe customer
    let customerId = workspace.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        metadata: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          userId: session.user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID
      await db.workspace.update({
        where: { id: workspaceId },
        data: { stripeCustomerId: customerId },
      });

      logger.info("Created Stripe customer", {
        customerId,
        workspaceId,
      });
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_TEAM_MONTHLY!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspace.slug}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspace.slug}/billing?canceled=true`,
      metadata: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
      subscription_data: {
        metadata: {
          workspaceId: workspace.id,
        },
      },
    });

    logger.info("Checkout session created", {
      sessionId: checkoutSession.id,
      workspaceId,
    });

    return NextResponse.json({
      url: checkoutSession.url,
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
    return handleApiError(error, "billing/checkout");
  }
}
