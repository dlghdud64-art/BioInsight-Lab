import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryCadenceGovernanceData, logCadenceStepCompletion } from "@/lib/work-queue/work-queue-service";
import { generateGovernanceReport } from "@/lib/work-queue/console-cadence-governance";

/**
 * GET /api/work-queue/cadence-governance — 거버넌스 보고서 조회
 *
 * Query params:
 *   - organizationId?: string
 *
 * Returns: GovernanceReport
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || undefined;

    const { items, logs } = await queryCadenceGovernanceData({ organizationId });
    const report = generateGovernanceReport(items, logs, session.user.id);

    return NextResponse.json(report);
  } catch (error) {
    console.error("[cadence-governance] GET error:", error);
    return NextResponse.json(
      { error: "거버넌스 보고서 조회 실패" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-queue/cadence-governance — 케이던스 단계 완료 기록
 *
 * Body:
 *   - stepId: string (required)
 *   - note?: string
 *   - organizationId?: string
 */
export async function POST(request: NextRequest) {
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
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/work-queue/cadence-governance',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stepId, note, organizationId } = body;

    if (!stepId || typeof stepId !== "string") {
      return NextResponse.json({ error: "stepId 필수" }, { status: 400 });
    }

    const validSteps = ["start_of_day_review", "midday_escalation_check", "end_of_day_carryover", "weekly_bottleneck_review"];
    if (!validSteps.includes(stepId)) {
      return NextResponse.json({ error: "유효하지 않은 케이던스 단계" }, { status: 400 });
    }

    await logCadenceStepCompletion({
      stepId,
      actorUserId: session.user.id,
      organizationId,
      note,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cadence-governance] POST error:", error);
    const message = error instanceof Error ? error.message : "케이던스 단계 기록 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
