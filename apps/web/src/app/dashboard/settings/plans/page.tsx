"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Users, Building2, Calendar, CreditCard, BarChart3, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, PLAN_LIMITS, getPlanLimits } from "@/lib/plans";

// 플랜 우선순위 (업그레이드/다운그레이드 판별)
const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.TEAM]: 1,
  [SubscriptionPlan.ORGANIZATION]: 2,
};

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isAnnual, setIsAnnual] = useState(false);

  // 사용자의 조직 목록 조회
  const { data: organizationsData, isLoading, isError } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string })?.error ?? "조직 목록을 불러오지 못했습니다.");
      }
      return response.json();
    },
    enabled: status === "authenticated",
    retry: 1,
  });

  // 선택된 조직의 구독 정보 조회 (단일 source of truth)
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["subscription", selectedOrgId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${selectedOrgId}/subscription`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedOrgId,
    retry: 1,
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ organizationId, plan }: { organizationId: string; plan: SubscriptionPlan }) => {
      const response = await fetch(`/api/organizations/${organizationId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, periodMonths: isAnnual ? 12 : 1 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "요금제 변경에 실패했습니다.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["subscription", selectedOrgId] });
      toast({ title: "플랜 변경 완료", description: "구독이 성공적으로 변경되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "요금제 변경 실패", description: error.message, variant: "destructive" });
    },
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">구독 플랜 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const organizations = organizationsData?.organizations || [];

  // 선택된 조직이 없으면 첫 번째 조직을 기본값으로 설정
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find((org: any) => org.id === selectedOrgId) || organizations[0];

  if (!selectedOrg) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">소속된 조직이 없습니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 구독 데이터 기반 현재 플랜 결정 (단일 source of truth)
  const subscription = subscriptionData?.subscription;
  const validPlans = Object.values(SubscriptionPlan) as string[];
  const currentPlan: SubscriptionPlan = subscription?.plan && validPlans.includes(subscription.plan)
    ? (subscription.plan as SubscriptionPlan)
    : selectedOrg?.plan && validPlans.includes(selectedOrg.plan)
      ? (selectedOrg.plan as SubscriptionPlan)
      : SubscriptionPlan.FREE;
  const limits = getPlanLimits(currentPlan);

  // 구독 상세 정보
  const currentSeats = subscription?.currentSeats ?? (selectedOrg?.memberCount ?? 1);
  const maxSeats = limits.maxMembers;
  const nextPaymentDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  // 플랜 정의
  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Starter",
      description: "기능 체험 및 파일럿용 무료 플랜",
      icon: Users,
      price: 0,
      annualPrice: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Basic",
      description: "소규모 랩실용. 재고 예측 알림, 예산 관리, 팀 협업.",
      icon: Users,
      price: 29000,
      annualPrice: 278400,
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Pro",
      description: "대학/벤처용. 무제한 재고, SSO, 감사 증적, 우선 지원.",
      icon: Building2,
      price: 69000,
      annualPrice: 662400,
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  const getDisplayPrice = (plan: typeof plans[0]) => {
    if (plan.price === 0) return 0;
    return isAnnual ? plan.annualPrice : plan.price;
  };

  // 운영 기능 기준 기능 목록 (우선순위 정렬)
  const featureList = [
    { key: "budgetManagement", label: "예산 관리", desc: "예산 배정·집행·초과 관리" },
    { key: "autoReorder", label: "자동 재주문", desc: "안전재고 기반 자동 발주" },
    { key: "advancedReports", label: "고급 리포트", desc: "맞춤 분석 및 내보내기" },
    { key: "inboundEmail", label: "이메일 연동", desc: "견적 이메일 자동 처리" },
    { key: "vendorPortal", label: "벤더 포털", desc: "공급사 직접 견적 응답" },
    { key: "sso", label: "SSO (통합 인증)", desc: "SAML/OAuth 기반 로그인" },
    { key: "prioritySupport", label: "우선 지원", desc: "전담 기술 지원" },
    { key: "exportPack", label: "데이터 내보내기", desc: "Excel/PDF 일괄 내보내기" },
  ];

  // 버튼 라벨 결정 (업그레이드/다운그레이드)
  const getButtonLabel = (planId: SubscriptionPlan) => {
    if (planId === currentPlan) return "현재 사용 중";
    const currentOrder = PLAN_ORDER[currentPlan];
    const targetOrder = PLAN_ORDER[planId];
    return targetOrder > currentOrder ? "업그레이드" : "다운그레이드";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              구독 플랜 관리
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              조직별 구독 플랜을 확인하고 변경할 수 있습니다.
            </p>
          </div>

          {/* Team Switcher */}
          {organizations.length > 1 && (
            <Card className="mb-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label htmlFor="team-select" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    조직 선택
                  </Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger id="team-select" className="w-[300px] dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="조직을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org: any) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 연간/월간 결제 토글 */}
          <div className="mb-6 flex items-center justify-center gap-4">
            <Label htmlFor="billing-toggle" className={`text-sm font-medium cursor-pointer ${!isAnnual ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
              월간 결제
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="billing-toggle" className={`text-sm font-medium cursor-pointer ${isAnnual ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                연간 결제
              </Label>
              {isAnnual && (
                <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs">
                  20% 할인
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlan;
              const isTeamPlan = plan.id === SubscriptionPlan.TEAM;
              const isOrgPlan = plan.id === SubscriptionPlan.ORGANIZATION;
              const Icon = plan.icon;
              const displayPrice = getDisplayPrice(plan);
              const buttonLabel = getButtonLabel(plan.id);
              const isDowngrade = PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan];

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col transition-all duration-300 hover:shadow-xl dark:bg-slate-900",
                    isCurrentPlan && "ring-2 ring-emerald-500 shadow-lg",
                    !isCurrentPlan && isTeamPlan && "ring-2 ring-blue-500 shadow-lg",
                    !isCurrentPlan && isOrgPlan && "ring-2 ring-indigo-400 shadow-lg",
                  )}
                >
                  {/* Most Popular Badge */}
                  {isTeamPlan && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 shadow-lg">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[11px]">
                        현재 플랜
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isCurrentPlan ? "bg-emerald-100 dark:bg-emerald-900/30" : isTeamPlan ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-100 dark:bg-slate-800"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5",
                          isCurrentPlan ? "text-emerald-600 dark:text-emerald-400" : isTeamPlan ? "text-blue-600" : "text-slate-600 dark:text-slate-400"
                        )} />
                      </div>
                      <CardTitle className="text-xl font-bold dark:text-white">{plan.name}</CardTitle>
                    </div>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                      {plan.description}
                    </CardDescription>

                    {/* 멤버 제한 */}
                    <div className="mt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        팀원 {plan.features.maxMembers === null ? "무제한" : `최대 ${plan.features.maxMembers}명`}
                      </span>
                    </div>

                    {/* 가격 */}
                    <div className="mt-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                          {displayPrice === 0 ? "무료" : `₩${displayPrice.toLocaleString()}`}
                        </span>
                        {displayPrice > 0 && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            /{isAnnual ? "년" : "월"}
                          </span>
                        )}
                      </div>
                      {isAnnual && displayPrice > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          월 ₩{Math.round(displayPrice / 12).toLocaleString()}로 계산
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 space-y-4">
                    {/* 기능 목록 */}
                    <div className="space-y-2.5">
                      {featureList.map((feature) => {
                        const hasFeature = plan.features?.features?.[feature.key as keyof typeof plan.features.features] ?? false;
                        return (
                          <div key={feature.key} className="flex items-start gap-2.5">
                            {hasFeature ? (
                              <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <X className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className={cn(
                                "text-sm leading-tight",
                                hasFeature ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                              )}>
                                {feature.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 버튼 */}
                    <div className="pt-4 mt-auto">
                      {isCurrentPlan ? (
                        <Button
                          className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-not-allowed"
                          disabled
                        >
                          현재 사용 중인 플랜
                        </Button>
                      ) : (
                        <Button
                          className={cn(
                            "w-full shadow-lg hover:shadow-xl transition-all",
                            isDowngrade
                              ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                              : isTeamPlan
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                          onClick={() => {
                            const msg = isDowngrade
                              ? `${plan.name} 플랜으로 다운그레이드하시겠습니까? 일부 기능이 제한됩니다.`
                              : `${plan.name} 플랜으로 업그레이드하시겠습니까?`;
                            if (confirm(msg)) {
                              upgradeMutation.mutate({
                                organizationId: selectedOrg.id,
                                plan: plan.id,
                              });
                            }
                          }}
                          disabled={upgradeMutation.isPending}
                        >
                          {upgradeMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />처리 중...</>
                          ) : buttonLabel}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 현재 플랜 정보 요약 (보강) */}
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    현재 플랜 정보
                    <Badge className={cn(
                      "text-xs ml-1",
                      currentPlan === SubscriptionPlan.ORGANIZATION
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
                        : currentPlan === SubscriptionPlan.TEAM
                          ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    )}>
                      {plans.find((p) => p.id === currentPlan)?.name}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedOrg.name}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">결제 주기</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentPlan === SubscriptionPlan.FREE ? "-" : subscription?.currentPeriodEnd ? (isAnnual ? "연간" : "월간") : "월간"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">다음 결제일</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentPlan === SubscriptionPlan.FREE ? "-" : nextPaymentDate ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">좌석 사용량</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentSeats}명 / {maxSeats === null ? "무제한" : `${maxSeats}명`}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">월간 견적</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {limits.maxQuotesPerMonth === null ? "무제한" : `${limits.maxQuotesPerMonth}건`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
