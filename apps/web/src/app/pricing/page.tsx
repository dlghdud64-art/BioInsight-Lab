"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Users, Building2, Building, ArrowRight, ChevronDown } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TEAM_MONTHLY = 129000;
const BUSINESS_MONTHLY = 349000;

export type PlanId = "starter" | "team" | "business" | "enterprise";

type ComparisonItem =
  | { isCategoryHeader: true; label: string; tier?: "team" | "business" | "enterprise" }
  | {
      isCategoryHeader?: false;
      feature: string;
      starter: boolean | string;
      team: boolean | string;
      business: boolean | string;
      enterprise: boolean | string;
      key?: boolean;
    };

export default function PricingPage() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>("business");
  const [expandedCards, setExpandedCards] = useState<Set<PlanId>>(new Set());

  const teamAnnualPerMonth = Math.round(TEAM_MONTHLY * 0.9);
  const businessAnnualPerMonth = Math.round(BUSINESS_MONTHLY * 0.9);

  const plans = [
    {
      id: "starter" as PlanId,
      name: "Starter",
      tagline: "개인 검토와 초기 탐색",
      price: "무료",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "검색과 비교를 먼저 시작할 수 있습니다.",
      mobileHook: "검색·비교 시작",
      icon: Package,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "무료로 시작하기",
      color: "#94A3B8",
      iconBgSelected: "rgba(148,163,184,0.10)",
      features: [
        "1개 워크스페이스",
        "최대 2명",
        "검색 / 비교 시작",
        "기본 보조 기능",
      ],
    },
    {
      id: "team" as PlanId,
      name: "Team",
      tagline: "팀 협업과 요청 운영 시작",
      price: "₩129,000/월",
      priceMonthly: TEAM_MONTHLY,
      priceAnnualPerMonth: teamAnnualPerMonth,
      pricePeriod: undefined as string | undefined,
      description: "팀 단위로 비교와 견적 요청을 정리할 수 있습니다.",
      mobileHook: "팀 비교 · 요청 운영",
      icon: Users,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "Team으로 시작하기",
      color: "#67C5E0",
      iconBgSelected: "rgba(103,197,224,0.10)",
      features: [
        "최대 10명",
        "비교 / 요청 운영",
        "요청 이력 공유",
        "비교 후보 제안",
      ],
    },
    {
      id: "business" as PlanId,
      name: "Business",
      tagline: "승인·감사·재고까지 조직 운영",
      price: "₩349,000/월",
      priceMonthly: BUSINESS_MONTHLY,
      priceAnnualPerMonth: businessAnnualPerMonth,
      pricePeriod: undefined as string | undefined,
      description: "요청, 승인, 입고, 재고를 하나의 흐름으로 연결합니다.",
      mobileHook: "승인 · 재고 · AI 보조",
      icon: Building,
      badge: "조직 운영에 추천",
      isRecommended: true,
      cardHeight: "md:min-h-[540px]",
      buttonText: "Business 도입하기",
      color: "#6FA2FF",
      iconBgSelected: "rgba(111,162,255,0.10)",
      features: [
        "최대 30명",
        "승인 라인 / 감사 로그",
        "입고 / 재고 운영",
        "AI 보조 기능 포함",
      ],
    },
    {
      id: "enterprise" as PlanId,
      name: "Enterprise",
      tagline: "보안·연동·대규모 운영 표준화",
      price: "별도 문의",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "보안 정책과 시스템 연동이 필요한 조직을 위한 플랜입니다.",
      mobileHook: "SSO · API · 맞춤 자동화",
      icon: Building2,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "도입 문의하기",
      color: "#A78BFA",
      iconBgSelected: "rgba(167,139,250,0.10)",
      features: [
        "사용자 수 협의",
        "SSO / 고급 권한",
        "API / ERP 연동",
        "맞춤형 자동화 협의",
      ],
    },
  ];

  const comparisonFeatures: ComparisonItem[] = [
    { isCategoryHeader: true, label: "기본" },
    { feature: "워크스페이스", starter: "1개", team: "1개", business: "1개", enterprise: "협의", key: true },
    { feature: "사용자 수", starter: "최대 2명", team: "최대 10명", business: "최대 30명", enterprise: "협의", key: true },
    { feature: "검색 / 비교", starter: true, team: true, business: true, enterprise: true },
    { feature: "견적 요청", starter: "제한", team: true, business: true, enterprise: true },
    { feature: "요청 이력", starter: "기본", team: true, business: true, enterprise: true },
    { isCategoryHeader: true, label: "운영", tier: "business" },
    { feature: "승인 라인", starter: "—", team: "기본", business: "다단계", enterprise: "맞춤", key: true },
    { feature: "감사 로그", starter: "—", team: "제한", business: "포함", enterprise: "확장", key: true },
    { feature: "입고 / 재고", starter: "—", team: "제한", business: "포함", enterprise: "확장" },
    { isCategoryHeader: true, label: "AI 보조" },
    { feature: "AI 보조 기능", starter: "기본 보조", team: "결과 정리 / 후보 제안", business: "판단 제안 / 초안 생성 / 누락 점검", enterprise: "확장형 자동화 협의", key: true },
    { isCategoryHeader: true, label: "보안 / 연동", tier: "enterprise" },
    { feature: "SSO / 보안", starter: "—", team: "—", business: "제한", enterprise: "포함", key: true },
    { feature: "API / ERP 연동", starter: "—", team: "—", business: "제한", enterprise: "포함", key: true },
    { feature: "지원 방식", starter: "이메일 지원", team: "우선 이메일 지원", business: "우선 지원 / 온보딩", enterprise: "전담 지원 / SLA" },
  ];

  const getCheckoutUrl = useCallback(
    (planId: PlanId): string => {
      if (planId === "starter") return "/search";
      if (planId === "enterprise") return "/support";
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
          key="annual"
          className="flex flex-col items-center gap-0.5 animate-in slide-in-from-bottom-2 fade-in duration-300"
        >
          <span className="text-slate-500 line-through text-xs md:text-lg font-normal">{plan.price}</span>
          <span className="text-lg md:text-3xl font-bold text-slate-100">
            ₩{plan.priceAnnualPerMonth.toLocaleString()}
            <span className="text-[10px] md:text-sm font-normal text-slate-400">/월(연간)</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-green-500/10 px-1.5 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold text-green-400 ring-1 ring-green-500/20">
            10% 할인
          </span>
        </span>
      );
    }
    return (
      <span key="monthly" className="animate-in slide-in-from-bottom-2 fade-in duration-300">
        {plan.price}
        {plan.pricePeriod && <span className="text-[10px] md:text-sm font-normal text-slate-400">{plan.pricePeriod}</span>}
      </span>
    );
  };

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        <div className="pt-14 md:pt-20 min-h-screen">
          <div className="container mx-auto px-4 py-6 md:py-16">
            <div className="max-w-7xl mx-auto">

              {/* ── 페이지 헤드라인 ── */}
              <div className="text-center mb-4 md:mb-12">
                <h1 className="text-lg md:text-4xl lg:text-5xl font-bold text-slate-100 mb-1 md:mb-3">
                  맞는 플랜으로 시작하세요
                </h1>
                <p className="text-slate-400 text-xs md:text-lg max-w-xl mx-auto leading-relaxed">
                  개인 탐색부터 조직 운영까지, 단계별 플랜
                </p>
              </div>

              {/* ── 결제 주기 토글 ── */}
              <div className="flex items-center justify-center mb-4 md:mb-12">
                <div className="bg-el rounded-full p-0.5 md:p-1 inline-flex border border-bd">
                  <button
                    type="button"
                    onClick={() => setIsAnnual(false)}
                    className={cn(
                      "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      !isAnnual
                        ? "bg-pn shadow-sm text-slate-100"
                        : "text-slate-400 hover:text-slate-300"
                    )}
                  >
                    월간
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(true)}
                    className={cn(
                      "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent flex items-center gap-1 md:gap-2",
                      isAnnual
                        ? "bg-pn shadow-sm text-slate-100"
                        : "text-slate-400 hover:text-slate-300"
                    )}
                  >
                    연간
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-medium">
                      -10%
                    </span>
                  </button>
                </div>
              </div>

              {/* ── 가격 카드 ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 mb-10 md:mb-16 items-stretch">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  const isRecommended = plan.isRecommended;
                  const isSelected = selectedPlan === plan.id;
                  const isExpanded = expandedCards.has(plan.id);
                  const MOBILE_FEATURE_LIMIT = 3;
                  const hasMore = plan.features.length > MOBILE_FEATURE_LIMIT;

                  return (
                    <Card
                      key={plan.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${plan.name} 플랜 ${isSelected ? "선택됨" : "선택하기"}`}
                      onClick={() => handleCardSelect(plan.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardSelect(plan.id);
                        }
                      }}
                      className={cn(
                        "relative flex flex-col transition-all duration-300 cursor-pointer select-none border-bd bg-pn",
                        plan.cardHeight,
                        plan.badge && "overflow-visible",
                        isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--surface-shell)] bg-pn border-blue-500/40",
                        !isSelected && "hover:border-bs hover:bg-el",
                        isRecommended && !isSelected && "border-2 border-blue-500/40 shadow-lg md:scale-105 z-10",
                        isRecommended && isSelected && "border-2 border-blue-500/40 shadow-lg ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--surface-shell)] md:scale-105 z-10"
                      )}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs font-bold shadow-lg whitespace-nowrap">
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-1 md:pb-4 px-2.5 md:px-6 pt-3 md:pt-6">
                        <div className="hidden md:flex justify-center mb-3">
                          <div
                            className="p-3 rounded-full transition-colors bg-el"
                            style={isSelected || isRecommended ? { backgroundColor: plan.iconBgSelected } : undefined}
                          >
                            <Icon
                              className="h-6 w-6"
                              style={{ color: isSelected || isRecommended ? plan.color : "#64748B" }}
                            />
                          </div>
                        </div>

                        <CardTitle className="text-base md:text-xl font-bold mb-0.5 text-slate-100">{plan.name}</CardTitle>
                        <p className="text-[10px] md:text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 md:mb-3">
                          {plan.tagline}
                        </p>

                        <div className="flex flex-col items-center gap-0.5 mb-1 md:mb-3 min-h-[4rem] md:min-h-[5rem] overflow-hidden justify-center">
                          <span className="text-xl md:text-3xl font-bold text-slate-100 text-center">
                            {renderPrice(plan)}
                          </span>
                        </div>

                        <p className="md:hidden text-[10px] font-medium text-blue-400/80">{plan.mobileHook}</p>
                        <CardDescription className="hidden md:block text-sm text-slate-400 leading-relaxed">
                          {plan.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pt-0 px-2.5 md:px-6 pb-3 md:pb-6" onClick={(e) => e.stopPropagation()}>
                        <ul className="space-y-2 md:space-y-3 mb-3 md:mb-6 flex-1">
                          {plan.features.slice(0, isExpanded ? undefined : MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={index} className={cn(
                              "flex items-start gap-2 md:gap-2.5 leading-relaxed",
                              !isExpanded && index >= MOBILE_FEATURE_LIMIT && "hidden md:flex"
                            )}>
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5",
                                  isRecommended ? "text-blue-400" : "text-green-400"
                                )}
                              />
                              <span className="text-xs md:text-sm text-slate-300">{feature}</span>
                            </li>
                          ))}
                          {!isExpanded && plan.features.slice(MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={`desktop-${index}`} className="hidden md:flex items-start gap-2.5 leading-relaxed">
                              <Check
                                className={cn(
                                  "h-4 w-4 flex-shrink-0 mt-0.5",
                                  isRecommended ? "text-blue-400" : "text-green-400"
                                )}
                              />
                              <span className="text-sm text-slate-300">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {hasMore && (
                          <button
                            type="button"
                            className="md:hidden flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 mb-3 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCards((prev) => {
                                const next = new Set(prev);
                                if (next.has(plan.id)) next.delete(plan.id);
                                else next.add(plan.id);
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? "접기" : `기능 ${plan.features.length - MOBILE_FEATURE_LIMIT}개 더보기`}
                            <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        )}

                        {isSelected ? (
                          <Button
                            className={cn(
                              "w-full font-semibold h-9 md:h-10 text-sm",
                              plan.id === "business"
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                                : "bg-el hover:bg-st text-slate-100"
                            )}
                            onClick={(e) => handlePrimaryAction(e, plan.id)}
                          >
                            {plan.buttonText}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-bd hover:bg-el text-slate-400 hover:text-slate-200 h-9 md:h-10 text-sm bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCardSelect(plan.id);
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

              {/* ── 플랜별 기능 비교 ── */}
              <div className="mb-8">
                <div className="text-center mb-4 md:mb-6">
                  <h2 className="text-base md:text-3xl font-bold text-slate-100 mb-1 md:mb-2">
                    플랜별 기능 비교
                  </h2>

                  <div className="flex items-center justify-center gap-4 md:gap-6 mt-3 flex-wrap">
                    <span className="text-[11px] md:text-xs text-slate-500"><span className="text-slate-300 font-semibold">Starter</span> 개인 시작</span>
                    <span className="text-[11px] md:text-xs text-slate-500"><span className="text-slate-300 font-semibold">Team</span> 협업 시작</span>
                    <span className="text-[11px] md:text-xs text-slate-500"><span className="text-blue-400 font-semibold">Business</span> 조직 운영 표준</span>
                    <span className="text-[11px] md:text-xs text-slate-500"><span className="text-slate-300 font-semibold">Enterprise</span> 보안/연동/대규모</span>
                  </div>
                </div>

                {/* ── 모바일 테이블 ── */}
                <div className="md:hidden overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-bd sticky top-0 bg-sh">
                        <th className="text-left py-2 pr-2 font-semibold text-slate-400 w-[40%]">기능</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Free</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Team</th>
                        <th className="text-center py-2 px-1 font-semibold text-blue-400 w-[15%]">Biz</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Ent.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((item, index) => {
                        if ("isCategoryHeader" in item && item.isCategoryHeader) {
                          return (
                            <tr key={`mcat-${index}`} className={cn(
                              "border-t border-bd",
                              item.tier === "business" ? "bg-blue-500/5" : "bg-el/50"
                            )}>
                              <td colSpan={5} className="py-1.5 px-1">
                                <div className="flex items-center gap-1">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider",
                                    item.tier === "business" ? "text-blue-400" : item.tier === "enterprise" ? "text-violet-400" : "text-slate-500"
                                  )}>{item.label}</span>
                                  {item.tier === "business" && <span className="text-[8px] font-semibold text-blue-400 bg-blue-500/10 px-1 rounded">Biz+</span>}
                                  {item.tier === "enterprise" && <span className="text-[8px] font-semibold text-violet-400 bg-violet-500/10 px-1 rounded">Ent.</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const d = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string };
                        const mCell = (val: boolean | string, highlight?: boolean) => (
                          <td className={cn("text-center py-1.5 px-1", highlight && "bg-blue-500/5")}>
                            {typeof val === "boolean" ? (val ? <Check className="inline h-3 w-3 text-green-400" /> : <span className="text-slate-700">—</span>) : <span className="font-medium text-slate-300">{val}</span>}
                          </td>
                        );
                        return (
                          <tr key={`mrow-${index}`} className="border-b border-bd/50">
                            <td className="py-1.5 pr-2 text-slate-300 font-medium">{d.feature}</td>
                            {mCell(d.starter)}
                            {mCell(d.team)}
                            {mCell(d.business, true)}
                            {mCell(d.enterprise)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── 데스크톱 테이블 ── */}
                <Card className="overflow-hidden hidden md:block border-bd bg-pn">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-pn border-b border-bd">
                            <TableHead className="font-semibold w-[280px] py-3 pl-5 text-slate-300">기능</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-400">Starter</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-400">Team</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-blue-400">Business</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-400">Enterprise</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparisonFeatures.map((item, index) => {
                            if ("isCategoryHeader" in item && item.isCategoryHeader) {
                              const isBusinessTier = item.tier === "business";
                              const isEnterpriseTier = item.tier === "enterprise";
                              return (
                                <TableRow
                                  key={`cat-${index}`}
                                  className={cn(
                                    "border-t border-bd",
                                    isBusinessTier ? "bg-blue-500/5" : "bg-el/50"
                                  )}
                                >
                                  <TableCell colSpan={5} className="py-2 pl-5">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("text-[11px] font-bold uppercase tracking-widest", isBusinessTier ? "text-blue-400" : isEnterpriseTier ? "text-violet-400" : "text-slate-500")}>
                                        {item.label}
                                      </span>
                                      {isBusinessTier && <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">Business+</span>}
                                      {isEnterpriseTier && <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full">Enterprise</span>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            const dataItem = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string; key?: boolean };
                            const isKey = dataItem.key;
                            const renderCell = (value: boolean | string) =>
                              typeof value === "boolean" ? (value ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-slate-700 text-lg leading-none">—</span>) : <span className={cn("text-sm font-medium", value === "—" ? "text-slate-600" : "text-slate-200")}>{value}</span>;
                            return (
                              <TableRow key={index} className={cn("hover:bg-el/40 transition-colors border-b border-bd/50", isKey && "border-l-2 border-l-blue-500/50")}>
                                <TableCell className={cn("py-2.5 pl-5 text-sm font-medium", isKey ? "text-slate-100" : "text-slate-300")}>{dataItem.feature}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.starter)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.team)}</TableCell>
                                <TableCell className="text-center py-2.5 bg-blue-500/5">{renderCell(dataItem.business)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.enterprise)}</TableCell>
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

      {/* ── 하단 고정 결제 요약 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-sh/95 backdrop-blur-sm border-t border-bd">
        {/* ── 모바일 바 ── */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-100 truncate">
              {selectedPlan === "starter"
                ? "Starter · 무료"
                : selectedPlan === "team"
                ? `Team · ₩${(isAnnual ? teamAnnualPerMonth : TEAM_MONTHLY).toLocaleString()}/월`
                : selectedPlan === "business"
                ? `Business · ₩${(isAnnual ? businessAnnualPerMonth : BUSINESS_MONTHLY).toLocaleString()}/월`
                : "Enterprise · 별도 문의"}
            </span>
            {isAnnual && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 shrink-0">연간</Badge>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-500"
              onClick={() => selectedPlan && handlePrimaryAction({ stopPropagation: () => {} } as React.MouseEvent, selectedPlan)}
            >
              시작하기
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs border-bd text-slate-400 hover:text-slate-200 bg-transparent"
              onClick={() => (window.location.href = "/support")}
            >
              문의
            </Button>
          </div>
        </div>
        {/* ── 데스크톱 바 ── */}
        <div className="hidden md:flex mx-auto max-w-[90rem] px-8 py-4 items-center justify-between gap-x-12">
          <div className="space-y-0.5">
            <p className="text-base font-semibold text-slate-100">
              현재 선택된 플랜
            </p>
            <p className="text-sm text-slate-400">
              플랜을 선택 후 바로 시작하거나 도입 문의를 남겨주세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-medium">요금제</span>
              <span className="text-base font-semibold text-slate-100">
                {selectedPlan === "starter"
                  ? "Starter — 무료"
                  : selectedPlan === "team"
                  ? `Team — ₩${(isAnnual ? teamAnnualPerMonth : TEAM_MONTHLY).toLocaleString()}/월`
                  : selectedPlan === "business"
                  ? `Business — ₩${(isAnnual ? businessAnnualPerMonth : BUSINESS_MONTHLY).toLocaleString()}/월`
                  : "Enterprise — 별도 문의"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-medium">결제 주기</span>
              <span className="text-base font-semibold text-slate-100">
                {isAnnual ? "연간 결제 (10% 할인)" : "월간 결제"}
              </span>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <Button
              className="px-8 h-11 text-base font-semibold bg-blue-600 hover:bg-blue-500 whitespace-nowrap shadow-sm"
              onClick={() => (window.location.href = "/support")}
            >
              요금 & 도입 문의
            </Button>
          </div>
        </div>
      </div>

      <MainFooter />
    </MainLayout>
  );
}
