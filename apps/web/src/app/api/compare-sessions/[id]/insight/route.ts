/**
 * POST /api/compare-sessions/[id]/insight — AI insight 생성
 *
 * §11.250g #compare-completed-notification-dispatch — dead path audit P1 첫 cluster.
 *   insight 생성 완료 직후 COMPARE_COMPLETED dispatch + push.
 *   recipient = compareSession.userId. push type "compare" → mobile /(tabs)/index deep-link.
 *   §11.229b-5/-6 + §11.250a/cd/b 패턴 정확 reuse.
 */
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateCompareInsight } from "@/lib/compare-workspace/compare-insight-generator";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";
import { dispatchNotificationEvent } from "@/lib/notifications/event-dispatcher";
import { sendPushNotification } from "@/lib/notifications/push-sender";

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
      targetEntityType: 'compare_session',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/compare-sessions/id/insight',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { id } = await params;
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const { sourceProductName, targetProductName, diffIndex } = body;

    const compareSession = await db.compareSession.findUnique({
      where: { id },
    });

    if (!compareSession) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const diffResults = compareSession.diffResult as any[];
    if (!diffResults || !Array.isArray(diffResults)) {
      return NextResponse.json(
        { error: "비교 결과가 없습니다. 먼저 비교를 실행하세요." },
        { status: 400 }
      );
    }

    const idx = diffIndex ?? 0;
    const diffResult = diffResults[idx];
    if (!diffResult) {
      return NextResponse.json(
        { error: "해당 비교 결과를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // AI insight 생성
    const insight = await generateCompareInsight(
      diffResult,
      sourceProductName || "기준 제품",
      targetProductName || "비교 대상"
    );

    // 세션에 저장
    await db.compareSession.update({
      where: { id },
      data: { aiInsight: insight as any },
    });

    // Activity log
    await createActivityLog({
      activityType: "AI_TASK_CREATED",
      entityType: "COMPARE_SESSION",
      entityId: id,
      taskType: "COMPARE_INSIGHT",
      userId,
      organizationId: compareSession.organizationId,
      metadata: {
        diffIndex: idx,
        keyChangesCount: insight.keyChanges.length,
        actionsCount: insight.recommendedActions.length,
      },
    });

    // §11.250g — COMPARE_COMPLETED dispatch + push.
    //   recipient = compareSession.userId. mobile push deep-link → /(tabs)/index.
    //   guest session (userId null) skip. dispatch + push 각각 try/catch graceful.
    //   §11.229b-5/-6 + §11.250a/cd/b 패턴 정확 reuse.
    if (compareSession.userId) {
      // inApp dispatch
      try {
        await dispatchNotificationEvent({
          eventType: "COMPARE_COMPLETED",
          entityType: "COMPARE",
          entityId: id,
          triggeredBy: session.user.id,
          recipients: [{ userId: compareSession.userId }],
          metadata: {
            sourceProductName: sourceProductName ?? "기준 제품",
            targetProductName: targetProductName ?? "비교 대상",
            diffIndex: idx,
            keyChangesCount: insight.keyChanges.length,
            actionsCount: insight.recommendedActions.length,
          },
        });
      } catch (notifErr) {
        // graceful — mutation 정합 유지
        console.error("[compare-sessions/insight] COMPARE_COMPLETED notification 발송 실패:", notifErr);
      }

      // Expo OS-level push
      try {
        await sendPushNotification(compareSession.userId, {
          title: "AI 비교 분석 완료",
          body: `${sourceProductName ?? "기준"} vs ${targetProductName ?? "비교"} — 핵심 변화 ${insight.keyChanges.length}건, 권장 조치 ${insight.recommendedActions.length}건`,
          data: {
            type: "compare",
            id,
            keyChangesCount: insight.keyChanges.length,
          },
        }, "COMPARE_COMPLETED");
      } catch (pushErr) {
        // graceful — mutation 정합 유지
        console.error("[compare-sessions/insight] COMPARE_COMPLETED push notification 실패:", pushErr);
      }
    }

    return NextResponse.json({ insight });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions/[id]/insight");
  }
}
