"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Building2, Zap, Layers, ArrowRight } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PricingPage() {
  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "무료",
      description: "초기 랩실용. 개인 전용 (팀원 초대 불가), 재고 최대 100개.",
      icon: Package,
      badge: null as string | null,
      badgeVariant: "secondary" as const,
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
      buttonDisabled: false,
      buttonHref: "/test/search",
      features: [
        "개인 전용 (팀원 초대 불가)",
        "재고 최대 100개",
        "엑셀 업로드",
        "기본 검색",
      ],
    },
    {
      id: "basic",
      name: "Basic",
      price: "₩29,000",
      pricePeriod: "/월",
      description: "소규모 랩실용. 재고 500개, 재고 예측 알림, 팀원 3명까지.",
      icon: Layers,
      badge: null as string | null,
      badgeVariant: "secondary" as const,
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
      buttonDisabled: false,
      buttonHref: "/auth/signin",
      features: [
        "재고 최대 500개",
        "재고 예측 알림",
        "팀원 3명",
        "엑셀 업로드",
        "기본 검색",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: "₩69,000",
      pricePeriod: "/월",
      description: "대학/벤처용. 재고 무제한, Lot 관리, 예산 분석, 감사 증적(Audit Trail) 포함.",
      icon: Zap,
      badge: "Best Choice",
      badgeVariant: "default" as const,
      buttonText: "1개월 무료 체험",
      buttonVariant: "default" as const,
      buttonDisabled: false,
      buttonHref: "/auth/signin",
      isRecommended: true,
      features: [
        "재고 무제한",
        "Lot 관리",
        "예산 분석",
        "감사 증적 (Audit Trail)",
        "팀원 초대",
        "재고 소진 알림",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "도입 문의",
      description: "대기업/산학협력단용. Pro 기능 + 단일 세금계산서(통합 정산), ERP 연동 포함.",
      icon: Building2,
      badge: null as string | null,
      badgeVariant: "secondary" as const,
      buttonText: "도입 문의하기",
      buttonVariant: "outline" as const,
      buttonDisabled: false,
      buttonHref: "/intro",
      features: [
        "Pro 전체 기능",
        "단일 세금계산서 (통합 정산)",
        "ERP 연동",
        "전담 매니저",
        "SSO/권한 관리",
      ],
    },
  ];

  const comparisonFeatures = [
    { feature: "인벤토리 관리", starter: true, basic: true, pro: true, enterprise: true },
    { feature: "엑셀 업로드", starter: true, basic: true, pro: true, enterprise: true },
    { feature: "기본 검색", starter: true, basic: true, pro: true, enterprise: true },
    { feature: "재고 개수", starter: "100개", basic: "500개", pro: "무제한", enterprise: "무제한" },
    { feature: "팀원 수", starter: "1명", basic: "3명", pro: "무제한", enterprise: "무제한" },
    { feature: "재고 예측 알림", starter: false, basic: true, pro: true, enterprise: true },
    { feature: "Lot 관리", starter: false, basic: false, pro: true, enterprise: true },
    { feature: "예산 분석", starter: false, basic: false, pro: true, enterprise: true },
    { feature: "감사 증적 (Audit Trail)", starter: false, basic: false, pro: true, enterprise: true },
    { feature: "단일 세금계산서 (통합 정산)", starter: false, basic: false, pro: false, enterprise: true },
    { feature: "ERP 연동", starter: false, basic: false, pro: false, enterprise: true },
    { feature: "전담 매니저", starter: false, basic: false, pro: false, enterprise: true },
  ];

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        <div className="pt-20 min-h-screen">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-7xl mx-auto">
            {/* Headline */}
            <div className="text-center mb-12 md:mb-16">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                연구실 규모에 맞는 최적의 플랜을 선택하세요.
              </h1>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-16 items-stretch pt-8">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isRecommended = plan.isRecommended;

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col h-full",
                      plan.badge && "overflow-visible",
                      isRecommended && "border-2 border-blue-500 shadow-xl ring-2 ring-blue-500/20"
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
                        <div className={cn(
                          "p-3 rounded-full",
                          isRecommended ? "bg-blue-100" : "bg-slate-100"
                        )}>
                          <Icon className={cn(
                            "h-6 w-6",
                            isRecommended ? "text-blue-600" : "text-slate-600"
                          )} />
                        </div>
                      </div>
                      <CardTitle className="text-xl md:text-2xl font-bold mb-2">
                        {plan.name}
                      </CardTitle>
                      <div className="flex items-baseline justify-center gap-1 mb-2">
                        <span className="text-3xl md:text-4xl font-bold text-slate-900">
                          {plan.price}
                        </span>
                        {plan.pricePeriod && (
                          <span className="text-sm text-slate-600">
                            {plan.pricePeriod}
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-sm text-slate-600">
                        {plan.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-3 mb-6 flex-1">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={plan.buttonVariant}
                        className={cn(
                          "w-full",
                          isRecommended && "bg-blue-600 hover:bg-blue-700 text-white",
                          plan.buttonVariant === "outline" && !isRecommended && "border-slate-300 hover:bg-slate-50"
                        )}
                        disabled={plan.buttonDisabled}
                        asChild
                      >
                        <Link href={plan.buttonHref} className="flex items-center justify-center gap-2">
                          {plan.buttonText}
                          {(plan.buttonText === "Get Started" || plan.buttonVariant === "default") && (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </Link>
                      </Button>
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
                          <TableHead className="font-semibold">기능</TableHead>
                          <TableHead className="text-center">Starter</TableHead>
                          <TableHead className="text-center">Basic</TableHead>
                          <TableHead className="text-center">Pro</TableHead>
                          <TableHead className="text-center">Enterprise</TableHead>
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
                              <TableCell className="font-medium">{item.feature}</TableCell>
                              <TableCell className="text-center">{renderCell(item.starter)}</TableCell>
                              <TableCell className="text-center">{renderCell(item.basic)}</TableCell>
                              <TableCell className="text-center">{renderCell(item.pro)}</TableCell>
                              <TableCell className="text-center">{renderCell(item.enterprise)}</TableCell>
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
      <MainFooter />
    </MainLayout>
  );
}
