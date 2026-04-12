/**
 * API Route: Review Queue Draft Server Persistence
 *
 * GET                    — 현재 유저의 review queue draft 조회
 * POST   { items }      — 현재 유저의 review queue draft 저장 (upsert)
 * DELETE                 — 현재 유저의 review queue draft 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  persistReviewQueueDraftServer,
  loadReviewQueueDraftServer,
  clearReviewQueueDraftServer,
} from "@/lib/persistence/review-queue-server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await loadReviewQueueDraftServer(session.user.id);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items (array) required" },
        { status: 400 },
      );
    }

    await persistReviewQueueDraftServer(session.user.id, items);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearReviewQueueDraftServer(session.user.id);
  return NextResponse.json({ ok: true });
}
