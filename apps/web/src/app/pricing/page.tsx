"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Users, Building2, Sparkles, Zap, Shield, CreditCard, FileText, BarChart3 } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PricingPage() {
  const plans = [
    {
      id: "seed",
      name: "씨앗 (Seed)",
      price: "무료",
      description: "개인 연구원 및 소규모 랩",
      icon: Package,
      badge: "현재 사용 중",
      badgeVariant: "secondary" as const,
      buttonText: "현재 사용 중",
      buttonVariant: "outline" as const,
      buttonDisabled: true,
      features: [
        "인벤토리 100개",
        "엑셀 업로드",
        "기본 검색",
      ],
    },
    {
      id: "growth",
      name: "성장 (Growth)",
      price: "₩29,000",
      pricePeriod: "/월",
      description: "협업이 필요한 5~10인 팀",
      icon: Users,
      badge: "⭐ 추천",
      badgeVariant: "default" as const,
      buttonText: "1개월 무료 체험",
      buttonVariant: "default" as const,
      buttonDisabled: false,
      isRecommended: true,
      features: [
        "무제한 인벤토리",
        "팀원 초대",
        "재고 소진 알림 (배터리)",
      ],
    },
    {
      id: "pro",
      name: "프로 (Pro)",
      price: "문의",
      description: "체계적인 예산 관리가 필요한 기업/센터",
      icon: Building2,
      buttonText: "도입 문의하기",
      buttonVariant: "outline" as const,
      buttonDisabled: false,
      features: [
        "연구비 지갑 (Grant)",
        "승인 결재 시스템",
        "전담 매니저",
      ],
    },
  ];

  const comparisonFeatures = [
    { feature: "인벤토리 관리", seed: true, growth: true, pro: true },
    { feature: "엑셀 업로드", seed: true, growth: true, pro: true },
    { feature: "기본 검색", seed: true, growth: true, pro: true },
    { feature: "인벤토리 개수", seed: "100개", growth: "무제한", pro: "무제한" },
    { feature: "팀원 초대", seed: false, growth: true, pro: true },
    { feature: "재고 소진 알림", seed: false, growth: true, pro: true },
    { feature: "연구비 지갑 (Grant)", seed: false, growth: false, pro: true },
    { feature: "승인 결재 시스템", seed: false, growth: false, pro: true },
    { feature: "전담 매니저", seed: false, growth: false, pro: true },
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isRecommended = plan.isRecommended;

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col",
                      isRecommended && "border-2 border-blue-500 shadow-lg"
                    )}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white px-3 py-1">
                          Best Choice
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
                      {plan.badge && (
                        <div className="mt-3">
                          <Badge variant={plan.badgeVariant} className="text-xs">
                            {plan.badge}
                          </Badge>
                        </div>
                      )}
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
                      >
                        {plan.buttonText}
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
                          <TableHead className="text-center">씨앗 (Seed)</TableHead>
                          <TableHead className="text-center">성장 (Growth)</TableHead>
                          <TableHead className="text-center">프로 (Pro)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonFeatures.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.feature}</TableCell>
                            <TableCell className="text-center">
                              {typeof item.seed === "boolean" ? (
                                item.seed ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )
                              ) : (
                                <span className="text-sm text-slate-700">{item.seed}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {typeof item.growth === "boolean" ? (
                                item.growth ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )
                              ) : (
                                <span className="text-sm text-slate-700">{item.growth}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {typeof item.pro === "boolean" ? (
                                item.pro ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )
                              ) : (
                                <span className="text-sm text-slate-700">{item.pro}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
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
