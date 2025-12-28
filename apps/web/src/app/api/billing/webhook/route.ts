import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import Stripe from "stripe";

const logger = createLogger("api/billing/webhook");

// Extended Stripe Subscription type with current_period_end
interface StripeSubscriptionExtended extends Stripe.Subscription {
  current_period_end: number;
}

// Initialize Stripe lazily to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

// Force Node.js runtime for raw body access
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handle subscription created/updated event
 */
async function handleSubscriptionChange(
  subscription: Stripe.Subscription
): Promise<void> {
  const workspaceId = subscription.metadata.workspaceId;

  if (!workspaceId) {
    logger.warn("Subscription missing workspaceId metadata", {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Determine plan and billing status based on subscription status
  let plan: "FREE" | "TEAM" | "ENTERPRISE" = "FREE";
  let billingStatus: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | null = null;

  switch (subscription.status) {
    case "active":
      plan = "TEAM";
      billingStatus = "ACTIVE";
      break;
    case "trialing":
      plan = "TEAM";
      billingStatus = "TRIALING";
      break;
    case "past_due":
      plan = "TEAM"; // Keep TEAM but flag as past_due
      billingStatus = "PAST_DUE";
      break;
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      plan = "FREE";
      billingStatus = "CANCELED";
      break;
    case "incomplete":
    case "paused":
      // Don't change plan for these statuses
      billingStatus = subscription.status === "paused" ? "CANCELED" : null;
      break;
  }

  const updateData: any = {
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id,
    stripeCurrentPeriodEnd: new Date((subscription as unknown as StripeSubscriptionExtended).current_period_end * 1000),
    billingStatus,
  };

  // Only update plan if we determined a new one
  if (subscription.status === "active" || subscription.status === "trialing") {
    updateData.plan = plan;
  } else if (subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "incomplete_expired") {
    updateData.plan = "FREE";
  }

  await db.workspace.update({
    where: { id: workspaceId },
    data: updateData,
  });

  logger.info("Updated workspace subscription", {
    workspaceId,
    subscriptionId: subscription.id,
    status: subscription.status,
    plan,
    billingStatus,
  });
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const workspaceId = subscription.metadata.workspaceId;

  if (!workspaceId) {
    logger.warn("Subscription missing workspaceId metadata", {
      subscriptionId: subscription.id,
    });
    return;
  }

  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: "FREE",
      billingStatus: "CANCELED",
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  });

  logger.info("Workspace downgraded to FREE plan", {
    workspaceId,
    subscriptionId: subscription.id,
  });
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const workspaceId = session.metadata?.workspaceId;

  if (!workspaceId) {
    logger.warn("Checkout session missing workspaceId metadata", {
      sessionId: session.id,
    });
    return;
  }

  // Get subscription details
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logger.warn("Checkout session missing subscription", {
      sessionId: session.id,
    });
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update workspace with subscription info
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date((subscription as unknown as StripeSubscriptionExtended).current_period_end * 1000),
      plan: "TEAM",
      billingStatus: subscription.status === "trialing" ? "TRIALING" : "ACTIVE",
    },
  });

  logger.info("Checkout completed - workspace upgraded to TEAM", {
    workspaceId,
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const workspaceId = subscription.metadata.workspaceId;

  if (!workspaceId) {
    return;
  }

  // Update billing status to active on successful payment
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      billingStatus: "ACTIVE",
      plan: "TEAM",
      stripeCurrentPeriodEnd: new Date((subscription as unknown as StripeSubscriptionExtended).current_period_end * 1000),
    },
  });

  logger.info("Invoice payment succeeded", {
    workspaceId,
    invoiceId: invoice.id,
    subscriptionId,
  });
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const workspaceId = subscription.metadata.workspaceId;

  if (!workspaceId) {
    return;
  }

  // Mark as past_due but keep TEAM plan (grace period)
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      billingStatus: "PAST_DUE",
    },
  });

  logger.warn("Invoice payment failed", {
    workspaceId,
    invoiceId: invoice.id,
    subscriptionId,
  });
}

/**
 * POST /api/billing/webhook
 * Stripe webhook handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.error("Missing Stripe signature");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    const stripe = getStripe();
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      logger.error("Webhook signature verification failed", { error: err });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    logger.info("Webhook received", {
      type: event.type,
      id: event.id,
    });

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info("Unhandled webhook event type", { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook processing failed", { error });
    // Return 200 to prevent Stripe retries on permanent errors
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 200 }
    );
  }
}
