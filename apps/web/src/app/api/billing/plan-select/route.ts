/**
 * POST /api/billing/plan-select
 *
 * pricing 카드 CTA 단일 진입점.
 * 세션 / 워크스페이스 / 권한 / 구독 상태를 종합 판단하여 올바른 목적지를 반환한다.
 *
 * 요청 바디:
 *  { selectedPlan: "starter" | "team" | "business" | "enterprise",
 *    currentWorkspaceId?: string | null }
 *
 * 응답:
 *  200 { destination: PlanSelectionDestination }
 *  400 { error: "invalid_plan" }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { handleApiError } from "@/lib/api-error-handler";
import {
  PLAN_INTENT_VALUES,
  resolvePlanSelectionDestination,
  type PlanIntent,
} from "@/lib/billing/plan-select";

const schema = z.object({
  selectedPlan: z.enum(PLAN_INTENT_VALUES as unknown as [PlanIntent, ...PlanIntent[]]),
  currentWorkspaceId: z.string().nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_plan", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const destination = await resolvePlanSelectionDestination({
      session,
      selectedPlan: parsed.data.selectedPlan,
      currentWorkspaceId: parsed.data.currentWorkspaceId ?? null,
    });

    return NextResponse.json({ destination });
  } catch (error) {
    return handleApiError(error, "api/billing/plan-select");
  }
}
