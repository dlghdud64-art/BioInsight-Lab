"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Users, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, PLAN_LIMITS, getPlanLimits } from "@/lib/plans";

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/settings/plans");
    return null;
  }

  const organizations = organizationsData?.organizations || [];

  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Free / Beta",
      description: "테스트 및 파일럿용 무료 플랜",
      icon: Users,
      price: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Team",
      description: "연구실/팀 단위 플랜",
      icon: Users,
      price: 50000, // 월 5만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Organization / Enterprise",
      description: "회사/병원 단위 플랜",
      icon: Building2,
      price: 200000, // 월 20만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">구독 플랜 관리</h1>
          <p className="text-muted-foreground mt-1">
            조직별 구독 플랜을 확인하고 업그레이드할 수 있습니다.
          </p>
        </div>

        {organizations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">소속된 조직이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {organizations.map((org: any) => {
              const currentPlan = org.plan || SubscriptionPlan.FREE;
              const limits = getPlanLimits(currentPlan);

              return (
                <Card key={org.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{org.name}</CardTitle>
                        <CardDescription>{org.description || "조직 설명 없음"}</CardDescription>
                      </div>
                      <Badge variant={currentPlan === SubscriptionPlan.ORGANIZATION ? "default" : "outline"}>
                        {currentPlan === SubscriptionPlan.FREE && "Free"}
                        {currentPlan === SubscriptionPlan.TEAM && "Team"}
                        {currentPlan === SubscriptionPlan.ORGANIZATION && "Enterprise"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 현재 플랜 정보 */}
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <h3 className="font-semibold mb-2">현재 플랜: {plans.find((p) => p.id === currentPlan)?.name}</h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">최대 멤버:</span>{" "}
                            <span className="font-medium">
                              {limits.maxMembers === null ? "무제한" : `${limits.maxMembers}명`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">월별 리스트:</span>{" "}
                            <span className="font-medium">
                              {limits.maxQuotesPerMonth === null ? "무제한" : `${limits.maxQuotesPerMonth}개`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">공유 링크:</span>{" "}
                            <span className="font-medium">
                              {limits.maxSharedLinks === null ? "무제한" : `${limits.maxSharedLinks}개`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 플랜 비교 */}
                      <div>
                        <h3 className="font-semibold mb-3">플랜 비교</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {plans.map((plan) => {
                            const isCurrentPlan = plan.id === currentPlan;
                            const Icon = plan.icon;

                            return (
                              <Card
                                key={plan.id}
                                className={isCurrentPlan ? "border-primary border-2" : ""}
                              >
                                <CardHeader>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-5 w-5" />
                                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                                  </div>
                                  <CardDescription>{plan.description}</CardDescription>
                                  <div className="mt-2">
                                    <span className="text-2xl font-bold">
                                      {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                                    </span>
                                    {plan.price > 0 && (
                                      <span className="text-sm text-muted-foreground">/월</span>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.advancedReports ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>고급 리포트</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.budgetManagement ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>예산 관리</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.autoReorder ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>자동 재주문</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.vendorPortal ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>벤더 포털</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.sso ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>SSO</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.prioritySupport ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>우선 지원</span>
                                    </div>
                                  </div>
                                  {!isCurrentPlan && (
                                    <Button
                                      className="w-full mt-4"
                                      onClick={() => {
                                        if (confirm(`${plan.name} 플랜으로 업그레이드하시겠습니까?`)) {
                                          upgradeMutation.mutate({
                                            organizationId: org.id,
                                            plan: plan.id,
                                          });
                                        }
                                      }}
                                      disabled={upgradeMutation.isPending}
                                    >
                                      {upgradeMutation.isPending ? "처리 중..." : "업그레이드"}
                                    </Button>
                                  )}
                                  {isCurrentPlan && (
                                    <div className="mt-4 text-center text-sm text-muted-foreground">
                                      현재 플랜
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Users, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, PLAN_LIMITS, getPlanLimits } from "@/lib/plans";

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/settings/plans");
    return null;
  }

  const organizations = organizationsData?.organizations || [];

  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Free / Beta",
      description: "테스트 및 파일럿용 무료 플랜",
      icon: Users,
      price: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Team",
      description: "연구실/팀 단위 플랜",
      icon: Users,
      price: 50000, // 월 5만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Organization / Enterprise",
      description: "회사/병원 단위 플랜",
      icon: Building2,
      price: 200000, // 월 20만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">구독 플랜 관리</h1>
          <p className="text-muted-foreground mt-1">
            조직별 구독 플랜을 확인하고 업그레이드할 수 있습니다.
          </p>
        </div>

        {organizations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">소속된 조직이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {organizations.map((org: any) => {
              const currentPlan = org.plan || SubscriptionPlan.FREE;
              const limits = getPlanLimits(currentPlan);

              return (
                <Card key={org.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{org.name}</CardTitle>
                        <CardDescription>{org.description || "조직 설명 없음"}</CardDescription>
                      </div>
                      <Badge variant={currentPlan === SubscriptionPlan.ORGANIZATION ? "default" : "outline"}>
                        {currentPlan === SubscriptionPlan.FREE && "Free"}
                        {currentPlan === SubscriptionPlan.TEAM && "Team"}
                        {currentPlan === SubscriptionPlan.ORGANIZATION && "Enterprise"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 현재 플랜 정보 */}
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <h3 className="font-semibold mb-2">현재 플랜: {plans.find((p) => p.id === currentPlan)?.name}</h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">최대 멤버:</span>{" "}
                            <span className="font-medium">
                              {limits.maxMembers === null ? "무제한" : `${limits.maxMembers}명`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">월별 리스트:</span>{" "}
                            <span className="font-medium">
                              {limits.maxQuotesPerMonth === null ? "무제한" : `${limits.maxQuotesPerMonth}개`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">공유 링크:</span>{" "}
                            <span className="font-medium">
                              {limits.maxSharedLinks === null ? "무제한" : `${limits.maxSharedLinks}개`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 플랜 비교 */}
                      <div>
                        <h3 className="font-semibold mb-3">플랜 비교</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {plans.map((plan) => {
                            const isCurrentPlan = plan.id === currentPlan;
                            const Icon = plan.icon;

                            return (
                              <Card
                                key={plan.id}
                                className={isCurrentPlan ? "border-primary border-2" : ""}
                              >
                                <CardHeader>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-5 w-5" />
                                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                                  </div>
                                  <CardDescription>{plan.description}</CardDescription>
                                  <div className="mt-2">
                                    <span className="text-2xl font-bold">
                                      {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                                    </span>
                                    {plan.price > 0 && (
                                      <span className="text-sm text-muted-foreground">/월</span>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.advancedReports ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>고급 리포트</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.budgetManagement ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>예산 관리</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.autoReorder ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>자동 재주문</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.vendorPortal ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>벤더 포털</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.sso ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>SSO</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.prioritySupport ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>우선 지원</span>
                                    </div>
                                  </div>
                                  {!isCurrentPlan && (
                                    <Button
                                      className="w-full mt-4"
                                      onClick={() => {
                                        if (confirm(`${plan.name} 플랜으로 업그레이드하시겠습니까?`)) {
                                          upgradeMutation.mutate({
                                            organizationId: org.id,
                                            plan: plan.id,
                                          });
                                        }
                                      }}
                                      disabled={upgradeMutation.isPending}
                                    >
                                      {upgradeMutation.isPending ? "처리 중..." : "업그레이드"}
                                    </Button>
                                  )}
                                  {isCurrentPlan && (
                                    <div className="mt-4 text-center text-sm text-muted-foreground">
                                      현재 플랜
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Users, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, PLAN_LIMITS, getPlanLimits } from "@/lib/plans";

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/settings/plans");
    return null;
  }

  const organizations = organizationsData?.organizations || [];

  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Free / Beta",
      description: "테스트 및 파일럿용 무료 플랜",
      icon: Users,
      price: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Team",
      description: "연구실/팀 단위 플랜",
      icon: Users,
      price: 50000, // 월 5만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Organization / Enterprise",
      description: "회사/병원 단위 플랜",
      icon: Building2,
      price: 200000, // 월 20만원 (예시)
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">구독 플랜 관리</h1>
          <p className="text-muted-foreground mt-1">
            조직별 구독 플랜을 확인하고 업그레이드할 수 있습니다.
          </p>
        </div>

        {organizations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">소속된 조직이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {organizations.map((org: any) => {
              const currentPlan = org.plan || SubscriptionPlan.FREE;
              const limits = getPlanLimits(currentPlan);

              return (
                <Card key={org.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{org.name}</CardTitle>
                        <CardDescription>{org.description || "조직 설명 없음"}</CardDescription>
                      </div>
                      <Badge variant={currentPlan === SubscriptionPlan.ORGANIZATION ? "default" : "outline"}>
                        {currentPlan === SubscriptionPlan.FREE && "Free"}
                        {currentPlan === SubscriptionPlan.TEAM && "Team"}
                        {currentPlan === SubscriptionPlan.ORGANIZATION && "Enterprise"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 현재 플랜 정보 */}
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <h3 className="font-semibold mb-2">현재 플랜: {plans.find((p) => p.id === currentPlan)?.name}</h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">최대 멤버:</span>{" "}
                            <span className="font-medium">
                              {limits.maxMembers === null ? "무제한" : `${limits.maxMembers}명`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">월별 리스트:</span>{" "}
                            <span className="font-medium">
                              {limits.maxQuotesPerMonth === null ? "무제한" : `${limits.maxQuotesPerMonth}개`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">공유 링크:</span>{" "}
                            <span className="font-medium">
                              {limits.maxSharedLinks === null ? "무제한" : `${limits.maxSharedLinks}개`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 플랜 비교 */}
                      <div>
                        <h3 className="font-semibold mb-3">플랜 비교</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {plans.map((plan) => {
                            const isCurrentPlan = plan.id === currentPlan;
                            const Icon = plan.icon;

                            return (
                              <Card
                                key={plan.id}
                                className={isCurrentPlan ? "border-primary border-2" : ""}
                              >
                                <CardHeader>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-5 w-5" />
                                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                                  </div>
                                  <CardDescription>{plan.description}</CardDescription>
                                  <div className="mt-2">
                                    <span className="text-2xl font-bold">
                                      {plan.price === 0 ? "무료" : `₩${plan.price.toLocaleString()}`}
                                    </span>
                                    {plan.price > 0 && (
                                      <span className="text-sm text-muted-foreground">/월</span>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.advancedReports ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>고급 리포트</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.budgetManagement ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>예산 관리</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.autoReorder ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>자동 재주문</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.vendorPortal ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>벤더 포털</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.sso ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>SSO</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {plan.features.features.prioritySupport ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span>우선 지원</span>
                                    </div>
                                  </div>
                                  {!isCurrentPlan && (
                                    <Button
                                      className="w-full mt-4"
                                      onClick={() => {
                                        if (confirm(`${plan.name} 플랜으로 업그레이드하시겠습니까?`)) {
                                          upgradeMutation.mutate({
                                            organizationId: org.id,
                                            plan: plan.id,
                                          });
                                        }
                                      }}
                                      disabled={upgradeMutation.isPending}
                                    >
                                      {upgradeMutation.isPending ? "처리 중..." : "업그레이드"}
                                    </Button>
                                  )}
                                  {isCurrentPlan && (
                                    <div className="mt-4 text-center text-sm text-muted-foreground">
                                      현재 플랜
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}




