/**
 * §receiving-inspection-decision (T2) — PATCH /api/receiving-drafts/[id]/inspect
 *
 * 검수 판정 저장(임시 저장 겸용). 재고 반영과 분리된 순수 기록 경로다.
 *   · 판정 미완 상태로도 저장 가능 → 중간 이탈 후 복귀 시 잔존(핸드오프 §2 "임시 저장").
 *   · 여기서는 재고를 건드리지 않는다. 반영은 approve 트랜잭션 단일 경로(이중 반영 방지).
 *
 * 저장 항목(라인 단위):
 *   inspectedQuantity(검수 실측) · decision(PASS|FAIL) · discrepancyAction(RESHIP|PARTIAL|RETURN) · discrepancyReason
 *   ※ receivedQuantity(공급사 회신값)는 불변 — 덮어쓰지 않는다(GMP 추적성).
 *
 * 검증:
 *   · 불일치(실측 ≠ 발주)면 discrepancyAction + discrepancyReason 필수 → 422.
 *   · 이미 재고 반영된 라인(restockedAt != null)은 수정 거부 → 409(사후 조작 차단).
 *
 * ownership: draft.userId 또는 organizationMember (approve 라우트 패턴 정합).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DECISIONS = new Set(["PASS", "FAIL"]);
const DISCREPANCY_ACTIONS = new Set(["RESHIP", "PARTIAL", "RETURN"]);

interface InspectItemInput {
  itemId: string;
  inspectedQuantity?: number | null;
  decision?: string | null;
  discrepancyAction?: string | null;
  discrepancyReason?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    const draft = await db.receivingDraft.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!draft) {
      return NextResponse.json({ error: "입고안을 찾을 수 없습니다." }, { status: 404 });
    }

    const isOwner = draft.userId === userId;
    let isOrgMember = false;
    if (!isOwner && draft.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId, organizationId: draft.organizationId },
        select: { id: true },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (draft.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "검토 대기 상태의 입고안만 검수할 수 있습니다.", status: draft.status },
        { status: 409 },
      );
    }

    const body = (await request.json()) as { items?: InspectItemInput[] };
    const inputs = Array.isArray(body?.items) ? body.items : [];
    if (inputs.length === 0) {
      return NextResponse.json({ error: "저장할 항목이 없습니다.", code: "NO_ITEMS" }, { status: 400 });
    }

    const itemMap = new Map(draft.items.map((it: { id: string }) => [it.id, it]));

    // 사전 검증 — 하나라도 실패하면 전부 저장하지 않는다(부분 저장으로 인한 상태 혼선 방지).
    for (const input of inputs) {
      const item = itemMap.get(input.itemId) as
        | { id: string; expectedQuantity: number | null; restockedAt: Date | null }
        | undefined;
      if (!item) {
        return NextResponse.json(
          { error: "해당 입고안의 품목이 아닙니다.", code: "ITEM_MISMATCH", itemId: input.itemId },
          { status: 422 },
        );
      }
      if (item.restockedAt) {
        return NextResponse.json(
          { error: "이미 재고에 반영된 품목은 수정할 수 없습니다.", code: "ALREADY_RESTOCKED", itemId: input.itemId },
          { status: 409 },
        );
      }
      if (input.decision != null && !DECISIONS.has(input.decision)) {
        return NextResponse.json(
          { error: "판정 값이 올바르지 않습니다.", code: "INVALID_DECISION" },
          { status: 422 },
        );
      }
      if (input.discrepancyAction != null && !DISCREPANCY_ACTIONS.has(input.discrepancyAction)) {
        return NextResponse.json(
          { error: "불일치 처리 방식이 올바르지 않습니다.", code: "INVALID_DISCREPANCY_ACTION" },
          { status: 422 },
        );
      }
      if (input.inspectedQuantity != null && input.inspectedQuantity < 0) {
        return NextResponse.json(
          { error: "수령 수량은 0 이상이어야 합니다.", code: "INVALID_QUANTITY" },
          { status: 422 },
        );
      }

      // 불일치 판정 시 처리 경로·사유 필수 — 판정(decision) 확정 시에만 강제(임시 저장은 통과).
      const expected = item.expectedQuantity ?? null;
      const inspected = input.inspectedQuantity ?? null;
      const mismatched = expected != null && inspected != null && inspected !== expected;
      if (input.decision != null && mismatched) {
        if (!input.discrepancyAction) {
          return NextResponse.json(
            { error: "수량 불일치는 처리 방식(재배송·부분 입고·반품) 선택이 필요합니다.", code: "DISCREPANCY_ACTION_REQUIRED", itemId: input.itemId },
            { status: 422 },
          );
        }
        if (!input.discrepancyReason || !input.discrepancyReason.trim()) {
          return NextResponse.json(
            { error: "수량 불일치는 사유 입력이 필요합니다.", code: "DISCREPANCY_REASON_REQUIRED", itemId: input.itemId },
            { status: 422 },
          );
        }
      }
    }

    // 저장 — 전건 통과 후에만.
    const now = new Date();
    await db.$transaction(
      inputs.map((input) =>
        db.receivingDraftItem.update({
          where: { id: input.itemId },
          data: {
            inspectedQuantity: input.inspectedQuantity ?? null,
            decision: input.decision ?? null,
            decidedAt: input.decision ? now : null,
            decidedById: input.decision ? userId : null,
            discrepancyAction: input.discrepancyAction ?? null,
            discrepancyReason: input.discrepancyReason?.trim() || null,
          },
        }),
      ),
    );

    const items = await db.receivingDraftItem.findMany({
      where: { receivingDraftId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        expectedQuantity: true,
        receivedQuantity: true,
        inspectedQuantity: true,
        unit: true,
        lotNumber: true,
        expiryDate: true,
        decision: true,
        decidedAt: true,
        discrepancyAction: true,
        discrepancyReason: true,
        restockedAt: true,
      },
    });

    const decidedCount = items.filter((it: { decision: string | null }) => it.decision != null).length;

    return NextResponse.json({ items, decidedCount, totalCount: items.length });
  } catch (error) {
    console.error("[receiving-drafts/inspect/PATCH]", error);
    return NextResponse.json({ error: "검수 내용을 저장하지 못했습니다." }, { status: 500 });
  }
}
