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
import { CheckCircle2, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, PLAN_LIMITS, getPlanLimits } from "@/lib/plans";

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isAnnual, setIsAnnual] = useState(false);

  // 사용자의 조직 목록 및 구독 정보 조회
  const { data: organizationsData, isLoading } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ organizationId, plan }: { organizationId: string; plan: SubscriptionPlan }) => {
      const response = await fetch(`/api/organizations/${organizationId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, periodMonths: 1 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upgrade plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast({
        title: "플랜 업그레이드 완료",
        description: "구독이 성공적으로 업그레이드되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "업그레이드 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/settings/plans");
  //   return null;
  // }

  const organizations = organizationsData?.organizations || [];

  // 선택된 조직이 없으면 첫 번째 조직을 기본값으로 설정
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find((org: any) => org.id === selectedOrgId) || organizations[0];

  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Free / Beta",
      description: "기능 체험 및 파일럿용 무료 플랜",
      icon: Users,
      price: 0,
      annualPrice: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Team",
      description: "연구실/팀 단위 플랜",
      icon: Users,
      price: 50000, // 월 5만원
      annualPrice: 480000, // 연간 48만원 (20% 할인)
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Organization / Enterprise",
      description: "회사/병원 단위 플랜",
      icon: Building2,
      price: 200000, // 월 20만원
      annualPrice: 1920000, // 연간 192만원 (20% 할인)
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  const getDisplayPrice = (plan: typeof plans[0]) => {
    if (plan.price === 0) return 0;
    return isAnnual ? plan.annualPrice : plan.price;
  };

  const getPriceLabel = (plan: typeof plans[0]) => {
    if (plan.price === 0) return "무료";
    return isAnnual ? "연간" : "월간";
  };

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

  const currentPlan = selectedOrg.plan || SubscriptionPlan.FREE;
  const limits = getPlanLimits(currentPlan);

  // 기능 목록 정의
  const featureList = [
    { key: "advancedReports", label: "고급 리포트" },
    { key: "budgetManagement", label: "예산 관리" },
    { key: "autoReorder", label: "자동 재주문" },
    { key: "vendorPortal", label: "벤더 포털" },
    { key: "inboundEmail", label: "이메일 연동" },
    { key: "sso", label: "SSO" },
    { key: "onPremise", label: "온프레미스 옵션" },
    { key: "prioritySupport", label: "우선 지원" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
              구독 플랜 관리
            </h1>
            <p className="text-slate-600">
              조직별 구독 플랜을 확인하고 업그레이드할 수 있습니다.
            </p>
          </div>

          {/* Team Switcher */}
          {organizations.length > 1 && (
            <Card className="mb-6 bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label htmlFor="team-select" className="text-sm font-medium text-slate-700">
                    구독을 관리할 팀 선택
                  </Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger id="team-select" className="w-[300px]">
                      <SelectValue placeholder="팀을 선택하세요" />
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
            <Label htmlFor="billing-toggle" className={`text-sm font-medium cursor-pointer ${!isAnnual ? "text-slate-900" : "text-slate-400"}`}>
              월간 결제
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="billing-toggle" className={`text-sm font-medium cursor-pointer ${isAnnual ? "text-slate-900" : "text-slate-400"}`}>
                연간 결제
              </Label>
              {isAnnual && (
                <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                  20% 할인
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlan;
              const isTeamPlan = plan.id === SubscriptionPlan.TEAM;
              const Icon = plan.icon;
              const displayPrice = getDisplayPrice(plan);
              const priceLabel = getPriceLabel(plan);

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative transition-all duration-300 hover:shadow-xl",
                    isTeamPlan && "scale-105 ring-2 ring-blue-500 shadow-lg",
                    isCurrentPlan && !isTeamPlan && "border-2 border-slate-300"
                  )}
                >
                  {/* Most Popular Badge */}
                  {isTeamPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 shadow-lg">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isTeamPlan ? "bg-blue-100" : "bg-slate-100"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5",
                          isTeamPlan ? "text-blue-600" : "text-slate-600"
                        )} />
                      </div>
                      <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">{plan.description}</CardDescription>
                    
                    {/* 가격 */}
                    <div className="mt-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-900">
                          {displayPrice === 0 ? "무료" : `₩${displayPrice.toLocaleString()}`}
                        </span>
                        {displayPrice > 0 && (
                          <span className="text-sm text-slate-500">
                            /{isAnnual ? "년" : "월"}
                          </span>
                        )}
                      </div>
                      {isAnnual && displayPrice > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          월 ₩{(displayPrice / 12).toLocaleString()}로 계산
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* 기능 목록 */}
                    <div className="space-y-3">
                      {featureList.map((feature) => {
                        const hasFeature = plan.features.features[feature.key as keyof typeof plan.features.features];
                        return (
                          <div key={feature.key} className="flex items-center gap-3">
                            {hasFeature ? (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            ) : (
                              <span className="h-5 w-5 flex-shrink-0" />
                            )}
                            <span className={cn(
                              "text-sm",
                              hasFeature ? "text-slate-900" : "text-gray-400"
                            )}>
                              {feature.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 버튼 */}
                    <div className="pt-4">
                      {isCurrentPlan ? (
                        <Button
                          className="w-full bg-gray-100 text-gray-500 hover:bg-gray-100 cursor-default"
                          disabled
                        >
                          현재 플랜
                        </Button>
                      ) : (
                        <Button
                          className={cn(
                            "w-full text-white shadow-lg hover:shadow-xl transition-all",
                            isTeamPlan
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          )}
                          onClick={() => {
                            if (confirm(`${plan.name} 플랜으로 업그레이드하시겠습니까?`)) {
                              upgradeMutation.mutate({
                                organizationId: selectedOrg.id,
                                plan: plan.id,
                              });
                            }
                          }}
                          disabled={upgradeMutation.isPending}
                        >
                          {upgradeMutation.isPending ? "처리 중..." : "업그레이드"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 현재 플랜 정보 요약 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">현재 플랜 정보</CardTitle>
              <CardDescription>
                {selectedOrg.name} - {plans.find((p) => p.id === currentPlan)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">최대 멤버:</span>{" "}
                  <span className="font-medium text-slate-900">
                    {limits.maxMembers === null ? "무제한" : `${limits.maxMembers}명`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">월별 리스트:</span>{" "}
                  <span className="font-medium text-slate-900">
                    {limits.maxQuotesPerMonth === null ? "무제한" : `${limits.maxQuotesPerMonth}개`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">공유 링크:</span>{" "}
                  <span className="font-medium text-slate-900">
                    {limits.maxSharedLinks === null ? "무제한" : `${limits.maxSharedLinks}개`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

