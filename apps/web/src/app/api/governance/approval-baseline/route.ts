/**
 * API Route: Approval Baseline Server Persistence
 *
 * GET  ?poNumber=...        — 해당 PO 의 최신 유효 baseline 조회
 * POST { snapshot }         — approval 시점 baseline 저장 (ensure 의미론)
 * DELETE ?poNumber=...      — 해당 PO 의 baseline 무효화 (soft-delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureApprovalBaselineServer,
  getApprovalBaselineServer,
  invalidateApprovalBaselineServer,
} from "@/lib/persistence/approval-baseline-server";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export async function GET(request: NextRequest) {
  const poNumber = request.nextUrl.searchParams.get("poNumber");
  if (!poNumber) {
    return NextResponse.json({ error: "poNumber required" }, { status: 400 });
  }

  const baseline = await getApprovalBaselineServer(poNumber);
  return NextResponse.json({ baseline });
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: 'approval-baseline',
      sourceSurface: 'approval-baseline-api',
      routePath: '/api/governance/approval-baseline',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { snapshot } = body;
    if (!snapshot?.poNumber || !snapshot?.approvalDecidedAt) {
      return NextResponse.json(
        { error: "snapshot.poNumber and snapshot.approvalDecidedAt required" },
        { status: 400 },
      );
    }

    const created = await ensureApprovalBaselineServer(snapshot);
    enforcement.complete({ beforeState: {}, afterState: { poNumber: snapshot.poNumber } });
    return NextResponse.json({ created });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: 'approval-baseline',
      sourceSurface: 'approval-baseline-api',
      routePath: '/api/governance/approval-baseline',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const poNumber = request.nextUrl.searchParams.get("poNumber");
    if (!poNumber) {
      return NextResponse.json({ error: "poNumber required" }, { status: 400 });
    }

    await invalidateApprovalBaselineServer(poNumber);
    enforcement.complete({ beforeState: { poNumber }, afterState: undefined });
    return NextResponse.json({ ok: true });
  } catch (error) {
    enforcement?.fail();
    throw error;
  }
}
