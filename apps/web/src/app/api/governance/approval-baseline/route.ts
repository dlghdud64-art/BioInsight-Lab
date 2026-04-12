/**
 * API Route: Approval Baseline Server Persistence
 *
 * GET  ?poNumber=...        — 해당 PO 의 최신 유효 baseline 조회
 * POST { snapshot }         — approval 시점 baseline 저장 (ensure 의미론)
 * DELETE ?poNumber=...      — 해당 PO 의 baseline 무효화 (soft-delete)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureApprovalBaselineServer,
  getApprovalBaselineServer,
  invalidateApprovalBaselineServer,
} from "@/lib/persistence/approval-baseline-server";

export async function GET(request: NextRequest) {
  const poNumber = request.nextUrl.searchParams.get("poNumber");
  if (!poNumber) {
    return NextResponse.json({ error: "poNumber required" }, { status: 400 });
  }

  const baseline = await getApprovalBaselineServer(poNumber);
  return NextResponse.json({ baseline });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot } = body;
    if (!snapshot?.poNumber || !snapshot?.approvalDecidedAt) {
      return NextResponse.json(
        { error: "snapshot.poNumber and snapshot.approvalDecidedAt required" },
        { status: 400 },
      );
    }

    const created = await ensureApprovalBaselineServer(snapshot);
    return NextResponse.json({ created });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const poNumber = request.nextUrl.searchParams.get("poNumber");
  if (!poNumber) {
    return NextResponse.json({ error: "poNumber required" }, { status: 400 });
  }

  await invalidateApprovalBaselineServer(poNumber);
  return NextResponse.json({ ok: true });
}
