/**
 * API Route: Outbound History Server Persistence
 *
 * GET    ?poId=...              — 해당 PO 의 outbound history 조회
 * POST   { poId, history }      — 해당 PO 의 outbound history 저장 (replace 의미론)
 * DELETE ?poId=...              — 해당 PO 의 outbound history 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import {
  persistOutboundHistoryServer,
  loadOutboundHistoryServer,
  clearOutboundHistoryServer,
} from "@/lib/persistence/outbound-history-server";

export async function GET(request: NextRequest) {
  const poId = request.nextUrl.searchParams.get("poId");
  if (!poId) {
    return NextResponse.json({ error: "poId required" }, { status: 400 });
  }

  const history = await loadOutboundHistoryServer(poId);
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poId, history } = body;
    if (!poId || !Array.isArray(history)) {
      return NextResponse.json(
        { error: "poId (string) and history (array) required" },
        { status: 400 },
      );
    }

    await persistOutboundHistoryServer(poId, history);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const poId = request.nextUrl.searchParams.get("poId");
  if (!poId) {
    return NextResponse.json({ error: "poId required" }, { status: 400 });
  }

  await clearOutboundHistoryServer(poId);
  return NextResponse.json({ ok: true });
}
