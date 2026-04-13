import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const respondSchema = z.object({
  items: z.record(z.object({
    unitPrice: z.number().optional(),
    leadTime: z.string().optional(),
    moq: z.number().optional(),
    notes: z.string().optional(),
  })),
});

/**
 * POST /api/vendor/requests/[id]/respond
 * Submit vendor response to quote request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: 'unknown',
      sourceSurface: 'vendor_portal',
      routePath: '/vendor/requests/id/respond',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { id } = await params;
    const body = await request.json();
    const { items } = respondSchema.parse(body);

    console.log("Submitting vendor response for request:", id);
    console.log("Items:", items);

    // TODO: Implement actual logic
    // 1. Validate vendor has permission
    // 2. Check request not expired
    // 3. Save responses to DB
    // 4. Update request status to RESPONDED
    // 5. Notify requester

    return NextResponse.json({
      success: true,
      message: "Response submitted successfully",
    });
  } catch (error) {
    console.error("Submit response error:", error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}

