/**
 * apps/web/src/app/api/ai-actions/generate/quote-rationale/route.ts
 *
 * α-F (ADR-002 §11.25). Persists an LLM-backed one-liner rationale
 * for a single supplier option on a quote. The resolver reads
 * AiActionItem(type: RATIONALE_SUMMARY) on subsequent loads and uses
 * it as the rationale (falling back to the v0 placeholder when no
 * RATIONALE_SUMMARY row exists yet).
 *
 * Request:
 *   POST /api/ai-actions/generate/quote-rationale
 *   body: {
 *     quoteId:        string,   // related quote
 *     optionId:       string,   // resolver's aiOptions[].id (vendor.id / reply.id / vendorRequest.id)
 *     supplierName:   string,
 *     replied:        boolean,
 *     price?:         number | null,
 *     leadDays?:      number | null,
 *     moq?:           number | null,
 *     currency?:      string,           // default "KRW"
 *     quoteTitle:     string,
 *     totalSuppliers: number,
 *   }
 *
 * Response (200):
 *   {
 *     success: true,
 *     data: {
 *       aiActionId:  string,
 *       rationale:   string[],       // never empty — placeholder on fallback
 *       aiModel:     string | null,
 *       fromCache:   boolean,        // true when an existing RATIONALE_SUMMARY row was reused
 *     }
 *   }
 *
 * Auth: session + enforceAction. Each generation is scoped to the
 * quote owner. Placeholder fallback (LLM key missing / failure) is
 * still persisted so the resolver always has a row to read.
 *
 * Lock-release discipline (§11.21): every 4xx return below the
 * enforceAction line calls enforcement.fail().
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { buildRationale } from "@/lib/ai/build-rationale";
import {
  enforceAction,
  type InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";

const bodySchema = z.object({
  quoteId: z.string().min(1),
  optionId: z.string().min(1),
  supplierName: z.string().min(1).max(200),
  replied: z.boolean(),
  price: z.number().nullable().optional(),
  leadDays: z.number().int().nullable().optional(),
  moq: z.number().int().nullable().optional(),
  currency: z.string().max(8).optional(),
  quoteTitle: z.string().max(500),
  totalSuppliers: z.number().int().min(0).max(50),
});

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "ai_action_create",
      targetEntityType: "ai_action",
      targetEntityId: "rationale-summary",
      sourceSurface: "purchase-conversion-rail",
      routePath: "/api/ai-actions/generate/quote-rationale",
    });
    if (!enforcement.allowed) return enforcement.deny();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      enforcement.fail();
      return NextResponse.json(
        { success: false, error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      enforcement.fail();
      return NextResponse.json(
        {
          success: false,
          error: "잘못된 요청 형식입니다.",
          code: "INVALID_INPUT",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Ownership: the quote must exist and be owned by the caller.
    const quote = await db.quote.findUnique({
      where: { id: input.quoteId },
      select: { id: true, userId: true, organizationId: true },
    });
    if (!quote || quote.userId !== session.user.id) {
      enforcement.fail();
      return NextResponse.json(
        { success: false, error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Cache-by-option: if a RATIONALE_SUMMARY row already exists for
    // this (quote, option), reuse it instead of paying for another
    // LLM call. The frontend can pass `?force=1` if the operator
    // wants a regeneration; v0 keeps it always-cached.
    const existing = await db.aiActionItem.findFirst({
      where: {
        userId: session.user.id,
        type: "RATIONALE_SUMMARY",
        relatedEntityType: "QUOTE",
        relatedEntityId: input.quoteId,
        // payload.optionId match is done in app code below — we don't
        // have a typed JSON path operator here without leaking the
        // Prisma raw query; instead findMany + filter is fine because
        // a single quote rarely has more than 5-10 of these.
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        payload: true,
        result: true,
        aiModel: true,
      },
    });
    if (
      existing &&
      typeof existing.payload === "object" &&
      existing.payload !== null &&
      (existing.payload as any).optionId === input.optionId &&
      typeof existing.result === "object" &&
      existing.result !== null &&
      Array.isArray((existing.result as any).rationale)
    ) {
      enforcement.complete({
        beforeState: { quoteId: input.quoteId, optionId: input.optionId },
        afterState: { aiActionId: existing.id, fromCache: true },
      });
      return NextResponse.json({
        success: true,
        data: {
          aiActionId: existing.id,
          rationale: (existing.result as any).rationale as string[],
          aiModel: existing.aiModel ?? null,
          fromCache: true,
        },
      });
    }

    // No cached row — call the utility (which already encapsulates
    // the LLM + fallback) and persist the result.
    const r = await buildRationale({
      supplierName: input.supplierName,
      replied: input.replied,
      price: input.price ?? null,
      leadDays: input.leadDays ?? null,
      moq: input.moq ?? null,
      currency: input.currency,
      context: {
        quoteTitle: input.quoteTitle,
        totalSuppliers: input.totalSuppliers,
      },
    });

    const aiAction = await db.aiActionItem.create({
      data: {
        type: "RATIONALE_SUMMARY",
        status: "APPROVED", // v0: rationale is read-only, no approval workflow
        priority: "LOW",
        taskStatus: "COMPLETED",
        approvalStatus: "NOT_REQUIRED",
        userId: session.user.id,
        organizationId: quote.organizationId,
        title: `AI 선택안 — ${input.supplierName}`,
        summary: (r.rationale[0] ?? "").slice(0, 200),
        payload: {
          optionId: input.optionId,
          supplierName: input.supplierName,
          replied: input.replied,
          price: input.price ?? null,
          leadDays: input.leadDays ?? null,
          moq: input.moq ?? null,
        },
        result: {
          rationale: r.rationale,
        },
        relatedEntityType: "QUOTE",
        relatedEntityId: input.quoteId,
        aiModel: r.aiModel,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
      },
      select: { id: true },
    });

    enforcement.complete({
      beforeState: { quoteId: input.quoteId, optionId: input.optionId },
      afterState: { aiActionId: aiAction.id, fromCache: false },
    });

    return NextResponse.json({
      success: true,
      data: {
        aiActionId: aiAction.id,
        rationale: r.rationale,
        aiModel: r.aiModel,
        fromCache: false,
      },
    });
  } catch (error: any) {
    if (enforcement) enforcement.fail();
    console.error(
      "[POST /api/ai-actions/generate/quote-rationale] error:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: "AI 근거 생성 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
