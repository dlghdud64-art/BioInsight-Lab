/**
 * API Route: Governance Event Dedupe Server Persistence
 *
 * POST /check    — shouldPublish 확인
 * POST /mark     — markPublished 기록
 * DELETE ?poNumber=... — 특정 PO 의 dedupe 기록 삭제
 * POST /purge    — 만료 레코드 정리
 */

import { NextRequest, NextResponse } from "next/server";
import {
  shouldPublishServer,
  markPublishedServer,
  clearDedupeForPoServer,
  purgeExpiredDedupeRecords,
} from "@/lib/persistence/governance-event-dedupe-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, poNumber, eventType, signatureKey, ttlMs } = body;

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
      return NextResponse.json({ purged });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const poNumber = request.nextUrl.searchParams.get("poNumber");
  if (!poNumber) {
    return NextResponse.json({ error: "poNumber required" }, { status: 400 });
  }

  await clearDedupeForPoServer(poNumber);
  return NextResponse.json({ ok: true });
}
