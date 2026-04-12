/**
 * /api/po-candidates — PO Conversion Candidates CRUD
 *
 * GET    ?stage=po_conversion_candidate   — 현재 user 의 후보 목록
 * POST   { ...POCandidateCreateInput }    — 후보 생성
 * PATCH  { id, stage, approvalStatus? }   — stage 업데이트
 * DELETE ?id=xxx                          — 후보 삭제
 *
 * Seed data 는 prisma/seed.ts 에서 관리.
 * 이 route 는 runtime auto-seed 를 하지 않는다.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listPOCandidates,
  createPOCandidate,
  updatePOCandidateStage,
  deletePOCandidate,
  type POCandidateCreateInput,
} from "@/lib/persistence/po-candidate-server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stage = req.nextUrl.searchParams.get("stage") ?? undefined;
    const orgId = req.nextUrl.searchParams.get("organizationId") ?? undefined;

    const candidates = await listPOCandidates(session.user.id, { stage, organizationId: orgId });
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[po-candidates] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input: POCandidateCreateInput = {
      ...body,
      userId: session.user.id,
    };

    const created = await createPOCandidate(input);
    return NextResponse.json({ candidate: created }, { status: 201 });
  } catch (err) {
    console.error("[po-candidates] POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, stage, approvalStatus } = body;

    if (!id || !stage) {
      return NextResponse.json({ error: "id and stage required" }, { status: 400 });
    }

    const updated = await updatePOCandidateStage(id, stage, { approvalStatus });
    return NextResponse.json({ candidate: updated });
  } catch (err) {
    console.error("[po-candidates] PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await deletePOCandidate(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[po-candidates] DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
