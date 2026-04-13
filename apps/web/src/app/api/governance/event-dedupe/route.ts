/**
 * API Route: Governance Event Dedupe Server Persistence
 *
 * POST /check    — shouldPublish 확인
 * POST /mark     — markPublished 기록
 * DELETE ?poNumber=... — 특정 PO 의 dedupe 기록 삭제
 * POST /purge    — 만료 레코드 정리
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  shouldPublishServer,
  markPublishedServer,
  clearDedupeForPoServer,
  purgeExpiredDedupeRecords,
} from "@/lib/persistence/governance-event-dedupe-server";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { action, poNumber, eventType, signatureKey, ttlMs, key } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: key || poNumber || 'unknown',
      sourceSurface: 'governance-event-dedupe-api',
      routePath: '/api/governance/event-dedupe',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (action === "check") {
      if (!poNumber || !eventType || !signatureKey) {
        return NextResponse.json(
          { error: "poNumber, eventType, signatureKey required" },
          { status: 400 },
        );
      }
      const canPublish = await shouldPublishServer(poNumber, eventType, signatureKey);
      return NextResponse.json({ canPublish });
    }

    if (action === "mark") {
      if (!poNumber || !eventType || !signatureKey) {
        return NextResponse.json(
          { error: "poNumber, eventType, signatureKey required" },
          { status: 400 },
        );
      }
      await markPublishedServer(poNumber, eventType, signatureKey, ttlMs);
      return NextResponse.json({ ok: true });
    }

    if (action === "purge") {
      const purged = await purgeExpiredDedupeRecords();
      enforcement.complete({});
      return NextResponse.json({ purged });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    enforcement?.fail();
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const poNumber = request.nextUrl.searchParams.get("poNumber");
    if (!poNumber) {
      return NextResponse.json({ error: "poNumber required" }, { status: 400 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: poNumber || 'unknown',
      sourceSurface: 'governance-event-dedupe-api',
      routePath: '/api/governance/event-dedupe',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await clearDedupeForPoServer(poNumber);
    enforcement.complete({});
    return NextResponse.json({ ok: true });
  } catch (error) {
    enforcement?.fail();
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
