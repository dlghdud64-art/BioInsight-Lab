"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_INTENT_VALUES, type PlanIntent } from "@/lib/billing/plan-select";
import {
  PLAN_DESCRIPTOR,
  type PlanDescriptor,
} from "@/lib/billing/plan-descriptor";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** §11.201 — workspace.plan 영문 enum → display layer PlanIntent 매핑.
 *  canonical WorkspacePlan (FREE | TEAM | ENTERPRISE) 변경 0 — display only.
 *  TEAM 은 Lab Team 또는 R&D Operations 두 PlanIntent 와 동일 enum 매핑이지만
 *  현재 plan badge 는 enum 단위 (TEAM = "Lab Team" 또는 "R&D Operations") 결정 불가 →
 *  보수적으로 "Lab Team" 으로 매핑 (Stripe price ID 분기 별도 트랙). */
function workspacePlanToIntent(plan: string | null | undefined): PlanIntent | null {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (upper === "FREE") return "starter";
  if (upper === "TEAM") return "team";
  if (upper === "ENTERPRISE") return "enterprise";
  return null;
}

function fmt(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

/** §11.201 — descriptor.priceMonthlyKrw 표시 (월간, dashboard 는 annual toggle X). */
function formatPlanPriceText(descriptor: PlanDescriptor): {
  price: string;
  period: string;
} {
  if (descriptor.priceMonthlyKrw === null) return { price: "도입 문의", period: "" };
  if (descriptor.priceMonthlyKrw === 0) return { price: "무료", period: "" };
  return { price: fmt(descriptor.priceMonthlyKrw), period: " / 월" };
}

/** §11.201 — 운영량 / Credit 한 줄 요약 (dashboard 카드 안 정량 근거). */
function formatOperatingVolume(descriptor: PlanDescriptor): string[] {
  if (
    descriptor.operatingVolume.monthlyRfq === null ||
    descriptor.operatingVolume.monthlyPo === null ||
    descriptor.operatingVolume.inventoryItems === null
  ) {
    return ["좌석·운영량·Credit 모두 계약 기반"];
  }
  return [
    descriptor.seatsRecommended !== null
      ? `운영자 ${descriptor.seatsRecommended}명 권장`
      : "운영자 무제한 (계약)",
    `RFQ ${descriptor.operatingVolume.monthlyRfq}건 / PO ${descriptor.operatingVolume.monthlyPo}건 (월)`,
    `재고 ${descriptor.operatingVolume.inventoryItems.toLocaleString("ko-KR")} 품목`,
    descriptor.labOpsCreditMonthly !== null
      ? `LabOps Credit ${descriptor.labOpsCreditMonthly.toLocaleString("ko-KR")}/월`
      : "LabOps Credit 계약 기반",
  ];
}

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanIntent | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  // §11.201 — canonical workspace.plan fetch (settings/page.tsx 의 동일 패턴 재사용).
  //   '현재 사용 중' badge 가 logged-in user 의 실제 workspace plan 과 매칭하도록.
  const { data: workspacesData } = useQuery<{
    workspaces: Array<{ id: string; name: string; slug: string; plan?: string }>;
  }>({
    queryKey: ["dashboard-pricing-workspaces"],
    queryFn: async () => {
      const response = await fetch("/api/workspaces");
      if (!response.ok) return { workspaces: [] };
      return response.json();
    },
    staleTime: 5 * 60_000,
  });
  // 첫 워크스페이스의 plan 만 사용 (multi-workspace 분기는 별도 트랙).
  const currentIntent = workspacePlanToIntent(
    workspacesData?.workspaces?.[0]?.plan ?? null
  );

  const handlePlanSelect = useCallback(
    async (plan: PlanIntent) => {
      setSelectError(null);
      setLoadingPlan(plan);
      try {
        const res = await fetch("/api/billing/plan-select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedPlan: plan }),
        });
        if (!res.ok) {
          setSelectError(
            "플랜 선택 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          );
          return;
        }
        const data = (await res.json()) as { destination?: { url: string } };
        if (!data.destination?.url) {
          setSelectError("목적지를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        router.push(data.destination.url);
      } catch {
        setSelectError(
          "네트워크 오류로 플랜 선택을 완료할 수 없습니다. 연결 상태를 확인해 주세요."
        );
      } finally {
        setLoadingPlan(null);
      }
    },
    [router]
  );

  return (
    <div className="flex-1 space-y-12 p-4 md:p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          연구 구매 운영량에 맞는 플랜을 선택하세요
        </h2>
        <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto">
          현재 사용 중인 플랜은 강조 표시됩니다. 운영 범위가 확장되면 언제든 플랜을 변경할 수 있습니다.
        </p>
      </div>

      {/* §11.201 — 4 카드 통일 (public /pricing 과 동일 descriptor 통과). logged-in
          분기 — currentIntent 와 같은 카드는 "현재 사용 중" badge + outline button. */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {PLAN_INTENT_VALUES.map((intent) => {
          const descriptor = PLAN_DESCRIPTOR[intent];
          const isCurrent = currentIntent === intent;
          const isFeatured =
            descriptor.recommendTag !== null &&
            /단일\s*연구실/.test(descriptor.recommendTag);
          return (
            <DashboardPlanCard
              key={intent}
              descriptor={descriptor}
              isCurrent={isCurrent}
              isFeatured={isFeatured}
              loading={loadingPlan === intent}
              disabled={loadingPlan !== null && loadingPlan !== intent}
              onSelect={handlePlanSelect}
            />
          );
        })}
      </div>

      {selectError && (
        <div className="max-w-3xl mx-auto px-6 py-4 rounded-xl text-sm border border-red-200 bg-red-50 text-red-700">
          {selectError}
        </div>
      )}

    </div>
  );
}

/* ─── §11.201 — DashboardPlanCard (descriptor 통과, logged-in 분기) ─── */

function DashboardPlanCard({
  descriptor, isCurrent, isFeatured, loading, disabled, onSelect,
}: {
  descriptor: PlanDescriptor;
  isCurrent: boolean;
  isFeatured: boolean;
  loading: boolean;
  disabled: boolean;
  onSelect: (plan: PlanIntent) => void | Promise<void>;
}) {
  const { intent, label, tagline, features, ctaLabel, recommendTag } = descriptor;
  const { price, period } = formatPlanPriceText(descriptor);
  const operatingVolume = formatOperatingVolume(descriptor);

  // logged-in 분기: 현재 plan 이면 "현재 사용 중" badge + outline button (action 0).
  // 다른 plan 이면 "플랜 변경" CTA.
  const handleClick = () => {
    if (loading || disabled || isCurrent) return;
    void onSelect(intent);
  };

  return (
    <div className="relative">
      {/* §11.201 — recommendTag 한국어 (영문 popular badge 폐기). */}
      {recommendTag !== null && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-blue-600 text-white whitespace-nowrap">
          {recommendTag}
        </div>
      )}
      <Card
        className={
          isFeatured
            ? "border-blue-500 shadow-lg flex flex-col h-full"
            : isCurrent
              ? "border-emerald-400 ring-1 ring-emerald-200 flex flex-col h-full"
              : "border-bd flex flex-col h-full"
        }
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">{label}</CardTitle>
          <CardDescription className="mt-1 leading-relaxed">{tagline}</CardDescription>
          <div className="mt-4">
            <span className="text-3xl font-bold">{price}</span>
            {period && <span className="text-sm text-slate-500">{period}</span>}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {/* §11.201 — 운영량 / Credit 정량 box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
              권장 운영 범위
            </p>
            <ul className="space-y-1">
              {operatingVolume.map((line) => (
                <li key={line} className="text-[12px] leading-snug text-slate-700">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          {/* §11.201 — descriptor.features (정량 기반 — fake 무제한 0) */}
          <ul className="space-y-2 text-sm text-slate-700">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          {isCurrent ? (
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-default"
              disabled
              aria-disabled="true"
            >
              <Check className="h-4 w-4 mr-1.5 text-emerald-500" />
              현재 사용 중
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleClick}
              disabled={loading || disabled}
              aria-busy={loading || undefined}
              className={
                isFeatured
                  ? "w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                  : "w-full disabled:opacity-60"
              }
              variant={isFeatured ? "default" : "outline"}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 확인 중…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
