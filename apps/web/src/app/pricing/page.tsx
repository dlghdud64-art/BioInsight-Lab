"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Users, Building2, Building, CheckCircle2 } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TEAM_MONTHLY = 49000;
const BUSINESS_MONTHLY = 149000;

export type PlanId = "starter" | "team" | "business" | "enterprise";

export default function PricingPage() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>("business");

  const teamAnnualPerMonth = Math.round(TEAM_MONTHLY * 0.8);
  const businessAnnualPerMonth = Math.round(BUSINESS_MONTHLY * 0.8);

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "무료",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      description: "기업 도입 전 체험용. 개인 전용, 등록 품목(SKU) 최대 30개.",
      icon: Package,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "min-h-[420px]",
      buttonText: "시작하기",
      buttonVariant: "outline" as const,
      buttonHref: "/test/search",
      features: [
        "개인 전용 (팀원 초대 불가)",
        "등록 품목(SKU) 최대 30개",
        "엑셀 업로드",
        "기본 검색 및 비교",
      ],
    },
    {
      id: "team",
      name: "Team",
      price: "₩49,000",
      priceMonthly: TEAM_MONTHLY,
      priceAnnualPerMonth: teamAnnualPerMonth,
      pricePeriod: "/월",
      description: "팀 단위 협업. 공유 재고와 구매 요청 워크플로우.",
      icon: Users,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "min-h-[460px]",
      buttonText: "시작하기",
      buttonVariant: "outline" as const,
      buttonHref: "/auth/signin",
      features: [
        "팀원 공유 재고",
        "구매 요청 워크플로우",
        "팀원 5명까지",
        "등록 품목(SKU) 최대 100개",
        "엑셀 업로드 및 기본 검색",
      ],
    },
    {
      id: "business",
      name: "Business",
      price: "₩149,000",
      priceMonthly: BUSINESS_MONTHLY,
      priceAnnualPerMonth: businessAnnualPerMonth,
      pricePeriod: "/월",
      description: "기업 표준. 전자결재, MSDS, 예산 통합 및 감사 증적.",
      icon: Building,
      badge: "Best Choice",
      isRecommended: true,
      cardHeight: "min-h-[520px]",
      buttonText: "1개월 무료 체험",
      buttonVariant: "default" as const,
      buttonHref: "/auth/signin",
      features: [
        "전자결재 승인 라인 구축",
        "MSDS 자동 연동",
        "예산 통합 관리 (Audit Trail)",
        "등록 품목(SKU) 무제한",
        "팀원 무제한",
        "Lot 관리 및 재고 소진 알림",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "별도 문의",
      priceMonthly: null,
      priceAnnualPerMonth: null,
      description: "대기업/그룹사. ERP 연동, SSO, 무제한 데이터.",
      icon: Building2,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "min-h-[460px]",
      buttonText: "도입 문의하기",
      buttonVariant: "outline" as const,
      buttonHref: "/intro",
      features: [
        "ERP API 연동",
        "SSO 지원",
        "무제한 데이터 저장",
        "Business 전체 기능",
        "전담 매니저 및 SLA",
      ],
    },
  ];

  const comparisonFeatures = [
    { category: "협업 및 재고", feature: "팀원 공유 재고", starter: false, team: true, business: true, enterprise: true },
    { category: "협업 및 재고", feature: "구매 요청 워크플로우", starter: false, team: true, business: true, enterprise: true },
    { category: "협업 및 재고", feature: "등록 품목(SKU) 개수", starter: "30개", team: "100개", business: "무제한", enterprise: "무제한" },
    { category: "협업 및 재고", feature: "팀원 수", starter: "1명", team: "5명", business: "무제한", enterprise: "무제한" },
    { category: "비즈니스", feature: "전자결재 승인 라인", starter: false, team: false, business: true, enterprise: true },
    { category: "비즈니스", feature: "MSDS 자동 연동", starter: false, team: false, business: true, enterprise: true },
    { category: "비즈니스", feature: "예산 통합 관리 (Audit Trail)", starter: false, team: false, business: true, enterprise: true },
    { category: "비즈니스", feature: "Lot 관리", starter: false, team: false, business: true, enterprise: true },
    { category: "엔터프라이즈", feature: "ERP API 연동", starter: false, team: false, business: false, enterprise: true },
    { category: "엔터프라이즈", feature: "SSO 지원", starter: false, team: false, business: false, enterprise: true },
    { category: "엔터프라이즈", feature: "무제한 데이터 저장", starter: false, team: false, business: false, enterprise: true },
    { category: "보안/관리", feature: "역할 기반 접근 제어 (RBAC)", starter: false, team: true, business: true, enterprise: true },
    { category: "보안/관리", feature: "감사 로그 (Audit Log)", starter: false, team: true, business: true, enterprise: true },
    { category: "보안/관리", feature: "데이터 암호화 (저장/전송)", starter: true, team: true, business: true, enterprise: true },
    { category: "보안/관리", feature: "SLA 및 전담 지원", starter: false, team: false, business: false, enterprise: true },
  ];

  const getCheckoutUrl = useCallback(
    (planId: PlanId): string => {
      if (planId === "starter") return "/test/search";
      if (planId === "enterprise") return "/intro";
      const params = new URLSearchParams();
      params.set("plan", planId);
      params.set("annual", isAnnual ? "1" : "0");
      const callbackUrl = `/billing?${params.toString()}`;
      return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    },
    [isAnnual]
  );

  const handleCardSelect = useCallback((planId: PlanId) => {
    setSelectedPlan(planId);
  }, []);

  const handlePrimaryAction = useCallback(
    (e: React.MouseEvent, planId: PlanId) => {
      e.stopPropagation();
      const url = getCheckoutUrl(planId);
      router.push(url);
    },
    [getCheckoutUrl, router]
  );

  const renderPrice = (plan: (typeof plans)[0]) => {
    if (plan.priceMonthly == null) return plan.price;
    if (isAnnual && plan.priceAnnualPerMonth != null) {
      return (
        <span
          key={isAnnual ? "annual" : "monthly"}
          className="flex flex-col items-center gap-1 animate-in slide-in-from-bottom-2 fade-in duration-300"
        >
          <span className="text-slate-500 line-through text-lg font-normal">{plan.price}</span>
          <span className="text-2xl md:text-3xl font-bold text-slate-900">
            ₩{plan.priceAnnualPerMonth.toLocaleString()}
            <span className="text-sm font-normal text-slate-600">/월</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 ring-1 ring-green-600/20">
            연간 결제 시 20% 할인 (2개월 무료)
          </span>
        </span>
      );
    }
    return (
      <span
        key={isAnnual ? "annual" : "monthly"}
        className="animate-in slide-in-from-bottom-2 fade-in duration-300"
      >
        {plan.price}
        {plan.pricePeriod}
      </span>
    );
  };

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        <div className="pt-20 min-h-screen">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-7xl mx-auto">
              {/* Headline */}
              <div className="text-center mb-10 md:mb-12">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3">
                  기업 규모에 맞는 플랜을 선택하세요.
                </h1>
                <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto">
                  팀 협업부터 대기업 통합까지, B2B 맞춤 요금제입니다.
                </p>
              </div>

              {/* Billing Segmented Control */}
              <div className="flex items-center justify-center mb-10 md:mb-12">
                <div className="bg-slate-100 rounded-full p-1 inline-flex">
                  <button
                    type="button"
                    onClick={() => setIsAnnual(false)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                      !isAnnual
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    월간 결제
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(true)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 flex items-center gap-2",
                      isAnnual
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    연간 결제
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      20% 할인
                    </span>
                  </button>
                </div>
              </div>

              {/* Pricing Cards (radio-style selection) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-16 items-end">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  const isRecommended = plan.isRecommended;
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <Card
                      key={plan.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${plan.name} 플랜 ${isSelected ? "선택됨" : "선택하기"}`}
                      onClick={() => handleCardSelect(plan.id as PlanId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardSelect(plan.id as PlanId);
                        }
                      }}
                      className={cn(
                        "relative flex flex-col transition-all duration-300 cursor-pointer select-none",
                        plan.cardHeight,
                        plan.badge && "overflow-visible",
                        isSelected && "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700",
                        !isSelected && "hover:border-slate-300 hover:bg-slate-50/50",
                        isRecommended && !isSelected && "border-2 border-blue-200 shadow-lg scale-[1.01]",
                        isRecommended && isSelected && "border-2 border-blue-500 shadow-xl ring-2 ring-blue-500 ring-offset-2 scale-[1.02] z-10"
                      )}
                    >
                      {plan.badge && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-blue-600 text-white px-4 py-1.5 text-sm font-bold shadow-lg">
                            {plan.badge}
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                          <div
                            className={cn(
                              "p-3 rounded-full transition-colors",
                              isSelected || isRecommended ? "bg-blue-100" : "bg-slate-100"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-6 w-6",
                                isSelected || isRecommended ? "text-blue-600" : "text-slate-600"
                              )}
                            />
                          </div>
                        </div>
                        <CardTitle className="text-xl md:text-2xl font-bold mb-2">{plan.name}</CardTitle>
                        <div className="flex flex-col items-center gap-0.5 mb-2 min-h-[4.5rem] overflow-hidden">
                          <span className="text-2xl md:text-3xl font-bold text-slate-900 text-center">
                            {renderPrice(plan)}
                          </span>
                          {plan.pricePeriod && !isAnnual && (
                            <span className="text-sm text-slate-600">{plan.pricePeriod}</span>
                          )}
                        </div>
                        <CardDescription className="text-sm text-slate-600 tracking-normal leading-relaxed">
                          {plan.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col pt-0" onClick={(e) => e.stopPropagation()}>
                        <ul className="space-y-4 mb-6 flex-1">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2.5 leading-relaxed tracking-normal">
                              <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-slate-700 tracking-normal">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {isSelected ? (
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            onClick={(e) => handlePrimaryAction(e, plan.id as PlanId)}
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                            선택됨
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-slate-300 hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCardSelect(plan.id as PlanId);
                            }}
                          >
                            이 플랜 선택
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Comparison Table */}
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-8">
                  기능 비교
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold w-[180px]">구분</TableHead>
                            <TableHead className="font-semibold">기능</TableHead>
                            <TableHead className="text-center font-semibold">Starter</TableHead>
                            <TableHead className="text-center font-semibold">Team</TableHead>
                            <TableHead className="text-center font-semibold bg-blue-50/50 dark:bg-blue-950/20">Business</TableHead>
                            <TableHead className="text-center font-semibold">Enterprise</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparisonFeatures.map((item, index) => {
                            const renderCell = (value: boolean | string) =>
                              typeof value === "boolean" ? (
                                value ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )
                              ) : (
                                <span className="text-sm text-slate-700">{value}</span>
                              );
                            return (
                              <TableRow key={index}>
                                <TableCell className="text-slate-500 text-sm py-2 align-top">
                                  {item.category}
                                </TableCell>
                                <TableCell className="font-medium py-2 align-top">{item.feature}</TableCell>
                                <TableCell className="text-center py-2 align-top">{renderCell(item.starter)}</TableCell>
                                <TableCell className="text-center py-2 align-top">{renderCell(item.team)}</TableCell>
                                <TableCell className="text-center py-2 align-top bg-blue-50/30 dark:bg-blue-950/10">
                                  {renderCell(item.business)}
                                </TableCell>
                                <TableCell className="text-center py-2 align-top">{renderCell(item.enterprise)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 하단 결제 정보 요약 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
        <div className="mx-auto max-w-[90rem] px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-y-3 gap-x-12">
          <div className="space-y-0.5">
            <p className="text-sm md:text-base font-semibold text-slate-900">
              현재 적용 중인 결제 정보 요약
            </p>
            <p className="text-xs md:text-sm text-slate-500">
              선택한 플랜 기준으로 조직과 예산 한도를 한눈에 확인하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs md:text-sm">
            <div className="flex flex-col">
              <span className="text-xs md:text-sm text-slate-500 font-medium">조직:</span>
              <span className="text-sm md:text-base font-semibold text-slate-900">
                로그인 후 조직이 연동됩니다
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs md:text-sm text-slate-500 font-medium">요금제:</span>
              <span className="text-sm md:text-base font-semibold text-slate-900">
                {selectedPlan === "starter"
                  ? "Starter"
                  : selectedPlan === "team"
                  ? "Team"
                  : selectedPlan === "business"
                  ? "Business"
                  : "Enterprise"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs md:text-sm text-slate-500 font-medium">예산:</span>
              <span className="text-sm md:text-base font-semibold text-slate-900">
                도입 시 별도 협의
              </span>
            </div>
          </div>
          <div className="flex items-center">
            <Button className="px-4 md:px-6 py-2 md:py-2.5 text-base font-semibold">
              요금 & 도입 문의
            </Button>
          </div>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
