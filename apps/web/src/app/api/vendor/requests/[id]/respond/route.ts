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
    const { id } = await params;
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (vendor) — params id 확정 이후로 핸들 이동.
      //   ⚠️ 이 라우트는 아직 DB 쓰기가 없다(아래 TODO). 따라서 complete() 가 아니라
      //     fail() 로 닫는다 — 저장되지 않은 응답을 감사에 남기면 허위 기록이 된다.
      targetEntityId: id,
      sourceSurface: 'vendor_portal',
      routePath: '/vendor/requests/id/respond',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    // ⚠️ 위 TODO 가 남아 있는 한 이 라우트는 DB 쓰기가 0이다 → fail().
    //    (성공 응답 자체의 정합성 문제는 sweep 범위 밖 — 별도 트랙으로 상신)
    enforcement.fail();
    return NextResponse.json({
      success: true,
      message: "Response submitted successfully",
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Submit response error:", error);
    return NextResponse.json(
      { error: "Failed to submit response" },
      { status: 500 }
    );
  }
}

