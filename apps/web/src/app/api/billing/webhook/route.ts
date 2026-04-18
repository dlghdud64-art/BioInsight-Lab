import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import Stripe from "stripe";

const logger = createLogger("api/billing/webhook");

// Extended Stripe Subscription type with current_period_end
interface StripeSubscriptionExtended extends Stripe.Subscription {
  current_period_end: number;
}

// Initialize Stripe — 환경변수 필수
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[billing/webhook] STRIPE_SECRET_KEY 미설정 — 결제 기능 비활성화");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_will_fail", {
  apiVersion: "2025-12-15.clover" as any,
});

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

    // ============================================================
    // 멱등성 가드 (Task #40) — Stripe 공식 권장 create-first 패턴
    // ============================================================
    // Stripe 는 at-least-once delivery 이므로 같은 event 를 여러 번 보낼 수 있다
    // (network retry, replay, redelivery). event.id 를 PK 로 insert 를 먼저 시도하고,
    // UNIQUE constraint violation (P2002) 이 나면 중복으로 간주하고 skip 한다.
    // findUnique → process → create 패턴보다 race condition 에 안전하다.
    // 참조: https://docs.stripe.com/webhooks (Handle duplicate events)
    try {
      await db.stripeEvent.create({
        data: {
          eventId: event.id,
          type: event.type,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        logger.info("Duplicate webhook event skipped", {
          eventId: event.id,
          type: event.type,
        });
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err; // DB 장애 등 예상외 에러는 아래 catch 로 올려 보냄
    }

    // ============================================================
    // 이벤트 처리 (여기부터는 이 event.id 가 최초 1 회 처리 보장)
    // ============================================================
    try {
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
    } catch (handlerError) {
      // 핸들러 처리 실패 — StripeEvent row 를 롤백해서 Stripe 재시도를 받을 수 있게 한다
      await db.stripeEvent
        .delete({ where: { eventId: event.id } })
        .catch((rollbackErr) => {
          logger.error("Failed to rollback StripeEvent after handler error", {
            eventId: event.id,
            rollbackErr,
          });
        });
      throw handlerError; // 바깥 catch 로 올려서 500 반환 (Stripe 가 재시도)
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook processing failed", { error });
    // 내부 처리 실패는 500 반환 — Stripe 가 자동 재시도 (at-least-once delivery)
    // 서명 검증 실패 (400) 는 위에서 이미 처리됨
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
