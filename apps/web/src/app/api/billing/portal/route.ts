import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import Stripe from "stripe";

const logger = createLogger("api/billing/portal");

// Initialize Stripe — 환경변수 필수
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[billing/portal] STRIPE_SECRET_KEY 미설정 — 결제 기능 비활성화");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_will_fail", {
  apiVersion: "2025-12-15.clover" as any,
});

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const { workspaceId } = portalSchema.parse(body);
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (기타) — workspaceId 확정 이후로 핸들 이동.
      //   ⚠️ 이 라우트는 로컬 DB 쓰기가 0 이지만 **외부 부작용이 있다**:
      //     stripe.billingPortal.sessions.create 로 결제 포털 세션을 실제로 만든다.
      //     fail() 로 닫으므로 그 외부 행위는 audit envelope 에 남지 않는다.
      //     → §billing-audit-gap 으로 상신(외부 부작용형 감사 누락).
      targetEntityId: workspaceId,
      sourceSurface: 'web_app',
      routePath: '/billing/portal',
    });
    if (!enforcement.allowed) return enforcement.deny();


    // Verify admin access
    const workspace = await verifyWorkspaceAdmin(workspaceId, session.user.id);

    if (!workspace.stripeCustomerId) {
      enforcement.fail();
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

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${workspace.slug}/billing`,
    });

    logger.info("Portal session created", {
      sessionId: portalSession.id,
      workspaceId,
    });

    // 로컬 쓰기 0 → complete() 는 하지 않는다. 외부 부작용은 §billing-audit-gap.
    enforcement.fail();
    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    // 403/400 분기도 이 catch 안에서 return 하므로 최상단에서 한 번만 닫는다.
    enforcement?.fail();
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
