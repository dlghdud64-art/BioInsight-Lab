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
    const body = await request.json();
    const { stepId, note, organizationId } = body;

    if (!stepId || typeof stepId !== "string") {
      return NextResponse.json({ error: "stepId 필수" }, { status: 400 });
    }

    const validSteps = ["start_of_day_review", "midday_escalation_check", "end_of_day_carryover", "weekly_bottleneck_review"];
    if (!validSteps.includes(stepId)) {
      return NextResponse.json({ error: "유효하지 않은 케이던스 단계" }, { status: 400 });
    }

    // §enforcement-handle-close-sweep — 핸들은 stepId 확정 후 생성(검증 400 은 lock 이전).
    //   stepId 는 엔티티 인스턴스가 아니라 케이던스 단계 enum 이다. 키에 넣으면 per-step 분리가 되어
    //   서로 다른 단계를 연달아 기록할 수 있고, 같은 단계 중복 기록은 계속 막힌다(의도된 double-submit 보호).
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: stepId,
      sourceSurface: 'web_app',
      routePath: '/api/work-queue/cadence-governance',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await logCadenceStepCompletion({
      stepId,
      actorUserId: session.user.id,
      organizationId,
      note,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    enforcement.complete({
      beforeState: { stepId, organizationId },
      afterState: { stepId, status: 'logged' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("[cadence-governance] POST error:", error);
    const message = error instanceof Error ? error.message : "케이던스 단계 기록 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
