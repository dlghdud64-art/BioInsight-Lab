"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Building2, Crown } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { SubscriptionPlan, PLAN_LIMITS } from "@/lib/plans";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 사용자의 조직 목록 조회
  const { data: organizationsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];

  const plans = [
    {
      id: SubscriptionPlan.FREE,
      name: "Free / Beta",
      description: "기능 체험 및 파일럿 목적",
      icon: Users,
      price: 0,
      features: PLAN_LIMITS[SubscriptionPlan.FREE],
      badge: "현재",
    },
    {
      id: SubscriptionPlan.TEAM,
      name: "Team",
      description: "연구실/팀 단위 플랜",
      icon: Users,
      price: 50000,
      features: PLAN_LIMITS[SubscriptionPlan.TEAM],
    },
    {
      id: SubscriptionPlan.ORGANIZATION,
      name: "Organization / Enterprise",
      description: "회사/병원 단위 플랜",
      icon: Building2,
      price: 200000,
      features: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION],
    },
  ];

  const handleUpgrade = (planId: SubscriptionPlan) => {
    if (status === "authenticated" && organizations.length > 0) {
      router.push(`/dashboard/settings/plans`);
    } else {
      router.push("/auth/signin?callbackUrl=/dashboard/organizations");
    }
  };

  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              요금제
            </h1>
            <p className="text-lg text-slate-600">
              팀에 맞는 플랜을 선택하세요
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative ${
                    plan.id === SubscriptionPlan.TEAM
                      ? "border-blue-500 border-2 shadow-lg"
                      : "border-slate-200"
                  }`}
                >
                  {plan.id === SubscriptionPlan.TEAM && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white px-3 py-1">
                        추천
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-6 w-6 text-slate-600" />
                      <CardTitle className="text-xl font-bold">
                        {plan.name}
                      </CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-3xl font-bold">
                        {plan.price === 0
                          ? "무료"
                          : `₩${plan.price.toLocaleString()}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          /월
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>
                          최대 멤버:{" "}
                          {plan.features.maxMembers === null
                            ? "무제한"
                            : `${plan.features.maxMembers}명`}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>
                          월별 견적:{" "}
                          {plan.features.maxQuotesPerMonth === null
                            ? "무제한"
                            : `${plan.features.maxQuotesPerMonth}개`}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>
                          공유 링크:{" "}
                          {plan.features.maxSharedLinks === null
                            ? "무제한"
                            : `${plan.features.maxSharedLinks}개`}
                        </span>
                      </li>
                      {plan.features.features.advancedReports && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>고급 리포트</span>
                        </li>
                      )}
                      {plan.features.features.budgetManagement && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>예산 관리</span>
                        </li>
                      )}
                    </ul>
                    <Button
                      className="w-full"
                      variant={
                        plan.id === SubscriptionPlan.TEAM
                          ? "default"
                          : "outline"
                      }
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {plan.price === 0 ? "현재 플랜" : "시작하기"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-slate-600 mb-4">
              현재는 <strong className="text-slate-900">Beta 무료</strong>로
              모든 기능을 체험할 수 있습니다.
            </p>
            {status === "authenticated" && organizations.length > 0 && (
              <Link href="/dashboard/settings/plans">
                <Button variant="outline">구독 관리로 이동</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}





