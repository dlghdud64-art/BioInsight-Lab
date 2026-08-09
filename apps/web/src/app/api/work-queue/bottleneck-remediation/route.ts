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
    // §enforcement-handle-close-sweep — 핸들은 대상 remediationId 확정 후 생성(검증 400 은 lock 이전).
    //   create·transition 모두 body 에 remediationId 가 있으므로 per-remediation lock 이 가능하다.
    //   'unknown' 이면 deriveConcurrencyKey 가 userId 로 fallback 해, 같은 사용자가 서로 다른
    //   개선 항목을 연달아 처리할 때 5분 TTL 동안 서로를 막는다.
    const body = await request.json();
    const { action, organizationId } = body;

    if (!action || !["create", "transition"].includes(action)) {
      return NextResponse.json({ error: "action 필수 (create | transition)" }, { status: 400 });
    }

    const targetRemediationId: string | undefined =
      action === "create"
        ? (body.remediation as RemediationItem | undefined)?.remediationId
        : body.remediationId;
    if (!targetRemediationId) {
      return NextResponse.json(
        { error: action === "create" ? "remediation 필수" : "remediationId, newStatus 필수" },
        { status: 400 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: targetRemediationId,
      sourceSurface: 'web_app',
      routePath: '/work-queue/bottleneck-remediation',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { remediations: existing } = await queryBottleneckRemediationData({ organizationId });

    if (action === "create") {
      const newRemediation = body.remediation as RemediationItem;
      if (!newRemediation?.remediationId) {
        enforcement.fail();
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

      enforcement.complete({
        beforeState: { remediationId: newRemediation.remediationId, existingCount: existing.length },
        afterState: { remediationId: newRemediation.remediationId, action: 'created' },
      });
      return NextResponse.json({ success: true, remediationId: newRemediation.remediationId });
    }

    if (action === "transition") {
      const { remediationId, newStatus, note } = body;
      if (!remediationId || !newStatus) {
        enforcement.fail();
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

      enforcement.complete({
        beforeState: { remediationId, existingCount: existing.length },
        afterState: { remediationId, newStatus, action: 'transitioned' },
      });
      return NextResponse.json({ success: true });
    }

    enforcement.fail();
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    enforcement?.fail();
    console.error("[bottleneck-remediation] POST error:", error);
    const message = error instanceof Error ? error.message : "개선 항목 처리 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
