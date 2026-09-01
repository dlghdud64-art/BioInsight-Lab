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
// §scan-recognition-upgrade P1 — lot 출처 canonical. coa_ocr 은 OcrJob lineage 필수.
const LOT_SOURCES = new Set(["vendor_reply", "coa_ocr", "manual"]);

interface InspectItemInput {
  itemId: string;
  inspectedQuantity?: number | null;
  decision?: string | null;
  discrepancyAction?: string | null;
  discrepancyReason?: string | null;
  // §scan-recognition-upgrade P1 — COA 확정 경로(additive · 미전달 시 무접촉).
  lotNumber?: string | null;
  expiryDate?: string | null;
  lotSource?: string | null;
  coaOcrJobId?: string | null;
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
      // vendor 는 §P4 템플릿 학습(vendorKey) 용 — 조회만.
      include: { items: true, vendor: { select: { name: true } } },
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

      // §scan-recognition-upgrade P1 — lot 출처 검증.
      if (input.lotSource != null && !LOT_SOURCES.has(input.lotSource)) {
        return NextResponse.json(
          { error: "lot 출처 값이 올바르지 않습니다.", code: "INVALID_LOT_SOURCE" },
          { status: 422 },
        );
      }
      // coa_ocr 확정은 OcrJob 역추적 없이 저장 불가 — lineage 강제(추적 불가 결과 금지).
      if (input.lotSource === "coa_ocr" && !input.coaOcrJobId) {
        return NextResponse.json(
          { error: "COA 인식 확정은 인식 작업 id(coaOcrJobId)가 필요합니다.", code: "COA_JOB_REQUIRED" },
          { status: 400 },
        );
      }
      if (input.expiryDate != null && Number.isNaN(new Date(input.expiryDate).getTime())) {
        return NextResponse.json(
          { error: "유효기간 형식이 올바르지 않습니다.", code: "INVALID_EXPIRY" },
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
            // §scan-recognition-upgrade P1 — additive: 미전달 필드는 무접촉(구 호출부 무회귀).
            ...(input.lotNumber !== undefined ? { lotNumber: input.lotNumber } : {}),
            ...(input.expiryDate !== undefined
              ? { expiryDate: input.expiryDate == null ? null : new Date(input.expiryDate) }
              : {}),
            ...(input.lotSource !== undefined ? { lotSource: input.lotSource } : {}),
            ...(input.coaOcrJobId !== undefined ? { coaOcrJobId: input.coaOcrJobId } : {}),
          },
        }),
      ),
    );

    // §scan-recognition-upgrade P4 — 확정 경로 학습(best-effort · 응답 비차단).
    //   COA 인식 확정(lotSource=coa_ocr)에서 사람이 보정한 필드만 템플릿으로 저장.
    //   인식 응답 경로에는 학습 0 — 확정 없는 자동 학습 금지.
    //
    // §P4-fix (호영님 실측 2026-08-31): 학습 입력은 **문서 원문**이어야 한다.
    //   Tier 1(Gemini) 의 OcrResult.rawText 는 모델이 뱉은 JSON(gemini-label-parser
    //   `rawText: jsonStr`) 이라 앵커가 출력 스키마(`"lotNumber": "`)로 굳는다 —
    //   전 공급사 동일 앵커 오학습 + 2회차엔 파서가 이미 뽑은 값을 되돌려주는 무효 힌트.
    //   실원문은 Tier 2(Cloud Vision fullTextAnnotation.text) 뿐이므로 provider 로 거른다.
    //   Gemini 단독 경로는 학습 skip — 원문이 없으니 배우지 않는다(지어내지 않는다).
    try {
      for (const input of inputs) {
        if (input.lotSource !== "coa_ocr" || !input.coaOcrJobId) continue;
        const jobRow = await db.ocrJob.findUnique({
          where: { id: input.coaOcrJobId },
          select: { finalResult: { select: { rawText: true, parsedFields: true, provider: true } } },
        });
        const finalResult = jobRow?.finalResult;
        if (finalResult?.provider !== "CLOUD_VISION_CLAUDE") continue; // 원문 없음 → 학습 skip
        const parsed = finalResult.parsedFields as
          | { lotNo?: string | null; expirationDate?: string | null }
          | null
          | undefined;
        const { recordVendorTemplates } = await import("@/lib/ocr/vendor-template-store");
        await recordVendorTemplates({
          organizationId: draft.organizationId ?? null,
          vendorName: draft.vendor?.name ?? null,
          docType: "coa",
          rawText: finalResult.rawText ?? null,
          confirmedFields: { lot: input.lotNumber ?? null, expiry: input.expiryDate ?? null },
          ocrFields: { lot: parsed?.lotNo ?? null, expiry: parsed?.expirationDate ?? null },
        });
      }
    } catch (learnErr) {
      console.warn("[inspect] template learn skipped:", (learnErr as Error).message);
    }

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
        lotSource: true,
        coaOcrJobId: true,
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
