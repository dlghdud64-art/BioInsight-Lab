/**
 * API Route: Outbound History Server Persistence
 *
 * GET    ?poId=...              — 해당 PO 의 outbound history 조회
 * POST   { poId, history }      — 해당 PO 의 outbound history 저장 (replace 의미론)
 * DELETE ?poId=...              — 해당 PO 의 outbound history 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  persistOutboundHistoryServer,
  loadOutboundHistoryServer,
  clearOutboundHistoryServer,
} from "@/lib/persistence/outbound-history-server";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export async function GET(request: NextRequest) {
  const poId = request.nextUrl.searchParams.get("poId");
  if (!poId) {
    return NextResponse.json({ error: "poId required" }, { status: 400 });
  }

  const history = await loadOutboundHistoryServer(poId);
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { poId, history } = body;
    if (!poId || !Array.isArray(history)) {
      return NextResponse.json(
        { error: "poId (string) and history (array) required" },
        { status: 400 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: poId || 'unknown',
      sourceSurface: 'outbound-history-api',
      routePath: '/api/governance/outbound-history',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await persistOutboundHistoryServer(poId, history);
    enforcement.complete({});
    return NextResponse.json({ ok: true });
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

    const poId = request.nextUrl.searchParams.get("poId");
    if (!poId) {
      return NextResponse.json({ error: "poId required" }, { status: 400 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'governance_data_mutation',
      targetEntityType: 'governance',
      targetEntityId: poId || 'unknown',
      sourceSurface: 'outbound-history-api',
      routePath: '/api/governance/outbound-history',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await clearOutboundHistoryServer(poId);
    enforcement.complete({});
    return NextResponse.json({ ok: true });
  } catch (error) {
    enforcement?.fail();
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
