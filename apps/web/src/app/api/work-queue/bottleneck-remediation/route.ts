import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  queryBottleneckRemediationData,
  saveRemediationItems,
} from "@/lib/work-queue/work-queue-service";
import {
  detectBottlenecks,
  buildRemediationConsoleView,
  computeRemediationReportSignals,
} from "@/lib/work-queue/console-bottleneck-remediation";
import type { RemediationItem } from "@/lib/work-queue/console-bottleneck-remediation";

/**
 * GET /api/work-queue/bottleneck-remediation — 병목 탐지 + 개선 콘솔 뷰
 *
 * Returns: { bottlenecks, remediations, consoleView, reportSignals }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || undefined;

    const { items, logs, remediations } = await queryBottleneckRemediationData({ organizationId });
    const bottlenecks = detectBottlenecks(items, logs, remediations, session.user.id);
    const consoleView = buildRemediationConsoleView(remediations, bottlenecks);
    const reportSignals = computeRemediationReportSignals(bottlenecks, remediations);

    return NextResponse.json({
      bottlenecks,
      remediations,
      consoleView,
      reportSignals,
    });
  } catch (error) {
    console.error("[bottleneck-remediation] GET error:", error);
    return NextResponse.json(
      { error: "병목 개선 데이터 조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/work-queue/bottleneck-remediation — 개선 항목 생성/상태 변경
 *
 * Body:
 *   - action: "create" | "transition"
 *   - remediation?: RemediationItem (for create)
 *   - remediationId?: string (for transition)
 *   - newStatus?: string (for transition)
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
      routePath: '/work-queue/bottleneck-remediation',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, organizationId } = body;

    if (!action || !["create", "transition"].includes(action)) {
      return NextResponse.json({ error: "action 필수 (create | transition)" }, { status: 400 });
    }

    const { remediations: existing } = await queryBottleneckRemediationData({ organizationId });

    if (action === "create") {
      const newRemediation = body.remediation as RemediationItem;
      if (!newRemediation?.remediationId) {
        return NextResponse.json({ error: "remediation 필수" }, { status: 400 });
      }

      const updated = [...existing, newRemediation];
      await saveRemediationItems({
        remediations: updated,
        organizationId,
        actorUserId: session.user.id,
        logEvent: "REMEDIATION_CREATED",
        logMetadata: {
          remediationId: newRemediation.remediationId,
          bottleneckType: newRemediation.bottleneckType,
        },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });

      return NextResponse.json({ success: true, remediationId: newRemediation.remediationId });
    }

    if (action === "transition") {
      const { remediationId, newStatus, note } = body;
      if (!remediationId || !newStatus) {
        return NextResponse.json({ error: "remediationId, newStatus 필수" }, { status: 400 });
      }

      const updated = existing.map((r: RemediationItem) => {
        if (r.remediationId === remediationId) {
          return {
            ...r,
            status: newStatus,
            resolutionNote: newStatus === "resolved" ? (note ?? r.resolutionNote) : r.resolutionNote,
          };
        }
        return r;
      });

      await saveRemediationItems({
        remediations: updated,
        organizationId,
        actorUserId: session.user.id,
        logEvent: "REMEDIATION_STATUS_CHANGED",
        logMetadata: { remediationId, newStatus, note: note ?? "" },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[bottleneck-remediation] POST error:", error);
    const message = error instanceof Error ? error.message : "개선 항목 처리 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
