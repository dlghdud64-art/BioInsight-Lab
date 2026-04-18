/**
 * /pricing/continue
 *
 * 로그인 후 돌아와 선택했던 plan intent 를 다시 resolve 해서
 * 올바른 목적지로 서버에서 즉시 리다이렉트한다.
 *
 * 이 페이지는 render UI 가 거의 없고, plan query 가 없거나 깨진 경우에만
 * /pricing 으로 다시 보낸다.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  resolvePlanSelectionDestination,
  PLAN_INTENT_VALUES,
  type PlanIntent,
} from "@/lib/billing/plan-select";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ plan?: string | string[]; workspaceId?: string | string[] }>;
};

export default async function PricingContinuePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const rawPlan = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const rawWorkspace = Array.isArray(params.workspaceId)
    ? params.workspaceId[0]
    : params.workspaceId;

  const plan = (PLAN_INTENT_VALUES as readonly string[]).includes(rawPlan ?? "")
    ? (rawPlan as PlanIntent)
    : null;

  if (!plan) {
    redirect("/pricing");
  }

  const session = await auth();
  const destination = await resolvePlanSelectionDestination({
    session,
    selectedPlan: plan,
    currentWorkspaceId: rawWorkspace ?? null,
  });

  redirect(destination.url);
}
