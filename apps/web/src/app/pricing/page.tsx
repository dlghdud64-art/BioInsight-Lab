"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Users, Building2, Building, ArrowRight, ChevronDown } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
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
  const [showFullTable, setShowFullTable] = useState(false);

  const teamAnnualPerMonth = Math.round(TEAM_MONTHLY * 0.9);
  const businessAnnualPerMonth = Math.round(BUSINESS_MONTHLY * 0.9);

  const plans = [
    {
      id: "starter" as PlanId,
      name: "Starter",
      tagline: "개인 탐색 · 비교",
      audience: "개인 연구자/담당자가 제품을 검색하고 비교하는 단계",
      price: "무료",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "제품 검색, 사양 비교, 견적 리스트 작성을 직접 시작할 수 있습니다.",
      mobileHook: "검색·비교 시작",
      icon: Package,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "무료 시작",
      ctaStyle: "outline" as "outline" | "primary" | "contact",
      color: "#94A3B8",
      iconBgSelected: "rgba(148,163,184,0.10)",
      keyDiffs: [
        "사용자 2명 · 워크스페이스 1개",
        "검색 · 비교 · 견적 리스트",
        "AI 결과 정리 수준",
      ],
      features: [
        "워크스페이스 1개 · 사용자 2명",
        "시약·장비 검색 및 사양 비교",
        "견적 요청 리스트 생성",
        "AI 기본 보조 (결과 정리)",
      ],
    },
    {
      id: "team" as PlanId,
      name: "Team",
      tagline: "팀 단위 견적 운영",
      audience: "연구실/팀에서 견적 요청을 공유하고 이력을 관리할 때",
      price: "₩129,000/월",
      priceMonthly: TEAM_MONTHLY,
      priceAnnualPerMonth: teamAnnualPerMonth,
      pricePeriod: undefined as string | undefined,
      description: "팀 워크스페이스에서 견적 요청 → 비교 → 이력 관리를 함께 운영합니다.",
      mobileHook: "팀 요청 · 이력 운영",
      icon: Users,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "팀 도입 시작",
      ctaStyle: "primary" as "outline" | "primary" | "contact",
      color: "#67C5E0",
      iconBgSelected: "rgba(103,197,224,0.10)",
      keyDiffs: [
        "사용자 10명 · 팀 워크스페이스",
        "견적 요청 운영 · 이력 공유",
        "AI 후보 제안 · 비교 정리",
      ],
      features: [
        "사용자 최대 10명",
        "견적 요청 운영 및 이력 공유",
        "비교 후보 AI 제안",
        "팀 워크스페이스 공동 관리",
      ],
    },
    {
      id: "business" as PlanId,
      name: "Business",
      tagline: "조직 구매 운영 표준",
      audience: "승인 → 발주 → 입고 → 재고까지 조직 전체 구매 흐름을 운영할 때",
      price: "₩349,000/월",
      priceMonthly: BUSINESS_MONTHLY,
      priceAnnualPerMonth: businessAnnualPerMonth,
      pricePeriod: undefined as string | undefined,
      description: "견적 → 승인 → 발주 → 입고 → 재고를 하나의 운영 흐름으로 연결합니다.",
      mobileHook: "승인 · 발주 · 재고 운영",
      icon: Building,
      badge: "조직 운영에 추천",
      isRecommended: true,
      cardHeight: "md:min-h-[540px]",
      buttonText: "운영 도입 문의",
      ctaStyle: "primary" as "outline" | "primary" | "contact",
      color: "#6FA2FF",
      iconBgSelected: "rgba(111,162,255,0.10)",
      keyDiffs: [
        "사용자 30명 · 다단계 승인",
        "발주 · 입고 · Lot · 재고 운영",
        "AI 판단 보조 · 초안 · 누락 점검",
      ],
      features: [
        "사용자 최대 30명",
        "다단계 승인 라인 · 감사 로그",
        "입고 · Lot · 재고 운영",
        "AI 판단 보조 · 초안 생성 · 누락 점검",
      ],
    },
    {
      id: "enterprise" as PlanId,
      name: "Enterprise",
      tagline: "보안 · 연동 · 대규모",
      audience: "SSO, ERP 연동, 전담 지원 등 보안/규정 요건이 있는 대규모 조직",
      price: "별도 문의",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "SSO, ERP 연동, 전담 지원 등 보안/규정 요건이 있는 조직을 위한 구조입니다.",
      mobileHook: "SSO · ERP · 전담 지원",
      icon: Building2,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[540px]",
      buttonText: "상담 요청",
      ctaStyle: "contact" as "outline" | "primary" | "contact",
      color: "#A78BFA",
      iconBgSelected: "rgba(167,139,250,0.10)",
      keyDiffs: [
        "사용자 수 · 워크스페이스 협의",
        "SSO · API · ERP 연동",
        "전담 지원 · SLA · 맞춤 자동화",
      ],
      features: [
        "사용자 수 · 워크스페이스 협의",
        "SSO · 고급 권한 · 감사 확장",
        "API · ERP · 그룹웨어 연동",
        "전담 지원 · SLA · 맞춤 자동화",
      ],
    },
  ];

  // 핵심 결정표 — 의사결정에 영향을 주는 6행만
  const keyComparisonFeatures: ComparisonItem[] = [
    { feature: "사용자 수", starter: "최대 2명", team: "최대 10명", business: "최대 30명", enterprise: "협의", key: true },
    { feature: "견적 요청 운영", starter: "제한", team: true, business: true, enterprise: true, key: true },
    { feature: "승인 라인", starter: "—", team: "단일 승인", business: "다단계", enterprise: "맞춤", key: true },
    { feature: "발주 · 입고 · 재고", starter: "—", team: "제한", business: "포함", enterprise: "확장", key: true },
    { feature: "AI 보조 범위", starter: "결과 정리", team: "후보 제안", business: "판단 보조 · 초안", enterprise: "맞춤 자동화", key: true },
    { feature: "SSO · API · ERP", starter: "—", team: "—", business: "기본", enterprise: "포함", key: true },
  ];

  // 전체 기능표 — 상세 확인용
  const comparisonFeatures: ComparisonItem[] = [
    { isCategoryHeader: true, label: "규모 · 접근" },
    { feature: "워크스페이스", starter: "1개", team: "1개", business: "1개", enterprise: "협의" },
    { feature: "사용자 수", starter: "최대 2명", team: "최대 10명", business: "최대 30명", enterprise: "협의", key: true },
    { isCategoryHeader: true, label: "탐색 · 요청" },
    { feature: "시약/장비 검색 · 비교", starter: true, team: true, business: true, enterprise: true },
    { feature: "견적 요청 운영", starter: "제한", team: true, business: true, enterprise: true },
    { feature: "요청 이력 · 공유", starter: "기본", team: "팀 공유", business: "조직 전체", enterprise: "조직 전체" },
    { isCategoryHeader: true, label: "구매 운영", tier: "business" },
    { feature: "승인 라인", starter: "—", team: "단일 승인", business: "다단계", enterprise: "맞춤", key: true },
    { feature: "발주 · 입고 · Lot 관리", starter: "—", team: "제한", business: "포함", enterprise: "확장", key: true },
    { feature: "재고 · 소진 추적", starter: "—", team: "제한", business: "포함", enterprise: "확장" },
    { feature: "감사 로그", starter: "—", team: "기본", business: "포함", enterprise: "확장" },
    { isCategoryHeader: true, label: "AI 보조" },
    { feature: "AI 보조 범위", starter: "결과 정리", team: "후보 제안 · 비교 정리", business: "판단 보조 · 초안 생성 · 누락 점검", enterprise: "확장형 자동화 협의", key: true },
    { isCategoryHeader: true, label: "보안 · 연동", tier: "enterprise" },
    { feature: "SSO · 권한 관리", starter: "—", team: "—", business: "기본", enterprise: "포함", key: true },
    { feature: "API · ERP 연동", starter: "—", team: "—", business: "제한", enterprise: "포함", key: true },
    { feature: "도입 지원", starter: "이메일", team: "우선 이메일", business: "온보딩 · 우선 지원", enterprise: "전담 지원 · SLA" },
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
          <span style={{ color: "#94A3B8" }} className="line-through text-xs md:text-lg font-normal">{plan.price}</span>
          <span className="text-lg md:text-3xl font-bold" style={{ color: "#0F1728" }}>
            ₩{plan.priceAnnualPerMonth.toLocaleString()}
            <span className="text-[10px] md:text-sm font-normal" style={{ color: "#7B8796" }}>/월(연간)</span>
          </span>
          <span className="inline-flex items-center rounded-md px-1.5 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold" style={{ backgroundColor: "rgba(22,163,74,0.08)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.15)" }}>
            10% 할인
          </span>
        </span>
      );
    }
    return (
      <span key="monthly" className="animate-in slide-in-from-bottom-2 fade-in duration-300">
        {plan.price}
        {plan.pricePeriod && <span className="text-[10px] md:text-sm font-normal" style={{ color: "#7B8796" }}>{plan.pricePeriod}</span>}
      </span>
    );
  };

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#EAF1F8" }}>
      <MainHeader />
      {/* ── Hero: compact pricing hero ── */}
      <section
        className="pt-14 pb-10 md:pt-20 md:pb-14"
        style={{
          background: "linear-gradient(180deg, #071A33 0%, #0D2A50 40%, #1A2D4D 70%, #3A4F6E 90%, #EAF1F8 100%)",
        }}
      >
        <div className="container mx-auto px-4 pt-6 md:pt-10">
          <div className="max-w-7xl mx-auto">
            {/* ── 페이지 헤드라인 ── */}
            <div className="text-center mb-4 md:mb-10">
              <h1 className="text-lg md:text-4xl lg:text-5xl font-bold mb-1 md:mb-3" style={{ color: "#F1F5F9" }}>
                우리 조직에 맞는 도입 구조
              </h1>
              <p className="text-xs md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#94A3B8" }}>
                탐색 단계부터 조직 전체 운영까지 — 현재 업무 범위에 맞춰 시작하고, 필요할 때 확장하세요
              </p>
            </div>

            {/* ── 결제 주기 토글 ── */}
            <div className="flex items-center justify-center mb-4 md:mb-8">
              <div className="rounded-full p-0.5 md:p-1 inline-flex" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className={cn(
                    "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    !isAnnual
                      ? "shadow-sm"
                      : ""
                  )}
                  style={!isAnnual ? { backgroundColor: "rgba(255,255,255,0.15)", color: "#F1F5F9" } : { color: "#94A3B8" }}
                >
                  월간
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className={cn(
                    "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent flex items-center gap-1 md:gap-2",
                    isAnnual
                      ? "shadow-sm"
                      : ""
                  )}
                  style={isAnnual ? { backgroundColor: "rgba(255,255,255,0.15)", color: "#F1F5F9" } : { color: "#94A3B8" }}
                >
                  연간
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-medium">
                    -10%
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content surface ── */}
      <div style={{ backgroundColor: "#EAF1F8" }}>
        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="max-w-7xl mx-auto">

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
                        "relative flex flex-col transition-all duration-300 cursor-pointer select-none",
                        plan.cardHeight,
                        plan.badge && "overflow-visible",
                        isRecommended && "md:scale-105 z-10"
                      )}
                      style={{
                        backgroundColor: "#F6F9FC",
                        border: isSelected
                          ? "2px solid rgba(37,99,235,0.5)"
                          : isRecommended
                          ? "2px solid rgba(37,99,235,0.35)"
                          : "1px solid #D7E0EB",
                        boxShadow: isSelected
                          ? "0 0 0 3px rgba(37,99,235,0.15), 0 4px 20px rgba(37,99,235,0.08)"
                          : isRecommended
                          ? "0 4px 20px rgba(37,99,235,0.08)"
                          : "0 1px 4px rgba(0,0,0,0.03)",
                        borderRadius: "12px",
                      }}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs font-bold shadow-lg whitespace-nowrap">
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-1 md:pb-3 px-2.5 md:px-6 pt-3 md:pt-6">
                        {/* 대상 조직 — 가장 먼저 읽히는 요소 */}
                        <p className="text-[10px] md:text-xs font-bold mb-1.5 md:mb-2" style={{ color: plan.color }}>
                          {plan.tagline}
                        </p>

                        <div className="hidden md:flex justify-center mb-2">
                          <div
                            className="p-2.5 rounded-full transition-colors"
                            style={{ backgroundColor: isSelected || isRecommended ? plan.iconBgSelected : "#EAF1F8" }}
                          >
                            <Icon
                              className="h-5 w-5"
                              style={{ color: isSelected || isRecommended ? plan.color : "#64748B" }}
                            />
                          </div>
                        </div>

                        <CardTitle className="text-base md:text-xl font-bold mb-0.5" style={{ color: "#0F1728" }}>{plan.name}</CardTitle>

                        <div className="flex flex-col items-center gap-0.5 mb-1.5 md:mb-2 min-h-[3.5rem] md:min-h-[4.5rem] overflow-hidden justify-center">
                          <span className="text-xl md:text-3xl font-bold text-center" style={{ color: "#0F1728" }}>
                            {renderPrice(plan)}
                          </span>
                        </div>

                        {/* 대상 조직 설명 — 가격 아래 */}
                        <p className="hidden md:block text-xs leading-relaxed mb-2" style={{ color: "#7B8796" }}>
                          {plan.audience}
                        </p>
                        <p className="md:hidden text-[10px] font-medium" style={{ color: plan.color }}>{plan.mobileHook}</p>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pt-0 px-2.5 md:px-6 pb-3 md:pb-6" onClick={(e) => e.stopPropagation()}>
                        {/* 핵심 차이 3줄 — 결정 기준 */}
                        <div className="mb-2.5 md:mb-4 pb-2.5 md:pb-3" style={{ borderBottom: "1px solid #E3EAF4" }}>
                          {plan.keyDiffs.map((diff, i) => (
                            <div key={i} className="flex items-center gap-1.5 md:gap-2 py-0.5">
                              <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                              <span className="text-[11px] md:text-xs font-medium" style={{ color: "#334155" }}>{diff}</span>
                            </div>
                          ))}
                        </div>

                        {/* 세부 기능 — 보조 정보 */}
                        <ul className="space-y-1.5 md:space-y-2 mb-3 md:mb-5 flex-1">
                          {plan.features.slice(0, isExpanded ? undefined : MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={index} className={cn(
                              "flex items-start gap-2 md:gap-2 leading-relaxed",
                              !isExpanded && index >= MOBILE_FEATURE_LIMIT && "hidden md:flex"
                            )}>
                              <Check
                                className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0 mt-0.5"
                                style={{ color: isRecommended ? "#2563EB" : "#16A34A" }}
                              />
                              <span className="text-[11px] md:text-xs" style={{ color: "#556070" }}>{feature}</span>
                            </li>
                          ))}
                          {!isExpanded && plan.features.slice(MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={`desktop-${index}`} className="hidden md:flex items-start gap-2 leading-relaxed">
                              <Check
                                className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                                style={{ color: isRecommended ? "#2563EB" : "#16A34A" }}
                              />
                              <span className="text-xs" style={{ color: "#556070" }}>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {hasMore && (
                          <button
                            type="button"
                            className="md:hidden flex items-center justify-center gap-1 text-[11px] mb-3 transition-colors"
                            style={{ color: "#7B8796" }}
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

                        {/* Fix 5: 플랜별 CTA — 도입 방식이 즉시 드러남 */}
                        {isSelected ? (
                          <Button
                            className="w-full font-semibold h-9 md:h-10 text-sm"
                            style={
                              plan.ctaStyle === "primary"
                                ? { backgroundColor: "#2F6BFF", color: "#FFFFFF", boxShadow: "0 1px 8px rgba(47,107,255,0.22)" }
                                : plan.ctaStyle === "contact"
                                ? { backgroundColor: "#7C3AED", color: "#FFFFFF" }
                                : { backgroundColor: "#EAF1F8", color: "#0F1728", border: "1px solid #D7E0EB" }
                            }
                            onClick={(e) => handlePrimaryAction(e, plan.id)}
                          >
                            {plan.buttonText}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full h-9 md:h-10 text-sm"
                            style={{ borderColor: "#E3EAF4", color: "#556070", backgroundColor: "transparent" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCardSelect(plan.id);
                            }}
                          >
                            {plan.buttonText}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* ── 도입 기준 가이드 ── */}
              <div className="mb-6 md:mb-10 rounded-2xl px-5 py-5 md:px-8 md:py-7" style={{ backgroundColor: "#F6F9FC", border: "1px solid #D7E0EB" }}>
                <h3 className="text-sm md:text-base font-bold mb-3" style={{ color: "#0F1728" }}>어떤 플랜이 맞을까요?</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-5 text-xs md:text-sm" style={{ color: "#556070" }}>
                  <div>
                    <span className="font-semibold" style={{ color: "#64748B" }}>Starter</span>
                    <p className="mt-0.5 leading-relaxed">개인이 제품을 검색하고 비교하는 단계. 구매 프로세스 없이 탐색만 필요할 때.</p>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: "#0E7490" }}>Team</span>
                    <p className="mt-0.5 leading-relaxed">연구실/팀 단위로 견적 요청을 함께 관리하고, 이력을 공유해야 할 때.</p>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: "#2563EB" }}>Business</span>
                    <p className="mt-0.5 leading-relaxed">승인 → 발주 → 입고 → 재고까지 조직 전체 구매 흐름을 운영해야 할 때.</p>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: "#7C3AED" }}>Enterprise</span>
                    <p className="mt-0.5 leading-relaxed">SSO, ERP 연동, 전담 지원 등 보안·규정 요건이 있는 대규모 조직.</p>
                  </div>
                </div>
              </div>

              {/* ═══ 핵심 결정표 — 10초 비교 ═══ */}
              <div className="mb-6 md:mb-10">
                <div className="text-center mb-4 md:mb-6">
                  <h2 className="text-base md:text-2xl font-bold mb-1" style={{ color: "#0F1728" }}>
                    핵심 비교 — 어떤 범위가 필요한가요?
                  </h2>
                  <p className="text-xs md:text-sm" style={{ color: "#7B8796" }}>
                    아래 6가지 기준만으로 플랜을 좁힐 수 있습니다
                  </p>
                </div>

                <Card className="overflow-hidden" style={{ backgroundColor: "#F6F9FC", border: "1px solid #D7E0EB", borderRadius: "12px" }}>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow style={{ backgroundColor: "#F6F9FC", borderBottom: "2px solid #D7E0EB" }}>
                            <TableHead className="font-bold w-[200px] md:w-[280px] py-3 pl-4 md:pl-5 text-xs md:text-sm" style={{ color: "#0F1728" }}>비교 기준</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-[11px] md:text-sm" style={{ color: "#94A3B8" }}>Starter</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-[11px] md:text-sm" style={{ color: "#0E7490" }}>Team</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-[11px] md:text-sm" style={{ color: "#2563EB" }}>Business</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-[11px] md:text-sm" style={{ color: "#7C3AED" }}>Enterprise</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {keyComparisonFeatures.map((item, index) => {
                            if ("isCategoryHeader" in item && item.isCategoryHeader) return null;
                            const d = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string };
                            const renderCell = (value: boolean | string) =>
                              typeof value === "boolean" ? (value ? <Check className="h-3.5 w-3.5 md:h-4 md:w-4 mx-auto" style={{ color: "#16A34A" }} /> : <span style={{ color: "#CBD5E1" }}>—</span>) : <span className="text-[11px] md:text-sm font-medium" style={{ color: value === "—" ? "#CBD5E1" : "#334155" }}>{value}</span>;
                            return (
                              <TableRow key={`key-${index}`} style={{ borderBottom: "1px solid #E3EAF4" }}>
                                <TableCell className="py-2.5 pl-4 md:pl-5 text-xs md:text-sm font-semibold" style={{ color: "#0F1728" }}>{d.feature}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(d.starter)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(d.team)}</TableCell>
                                <TableCell className="text-center py-2.5" style={{ backgroundColor: "rgba(37,99,235,0.04)" }}>{renderCell(d.business)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(d.enterprise)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ═══ 전체 기능 비교 — 접기 가능 ═══ */}
              <div className="mb-8">
                <div className="flex items-center justify-center mb-4">
                  <button
                    type="button"
                    onClick={() => setShowFullTable(!showFullTable)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ color: "#556070", backgroundColor: showFullTable ? "#EAF1F8" : "transparent", border: "1px solid #D7E0EB" }}
                  >
                    {showFullTable ? "전체 기능 비교 접기" : "전체 기능 비교 펼치기"}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showFullTable && "rotate-180")} />
                  </button>
                </div>

                {showFullTable && <>
                {/* ── 모바일 테이블 ── */}
                <div className="md:hidden overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-[11px]" style={{ backgroundColor: "#F6F9FC" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #D7E0EB", backgroundColor: "#F6F9FC" }}>
                        <th className="text-left py-2 pr-2 font-semibold w-[40%]" style={{ color: "#556070" }}>기능</th>
                        <th className="text-center py-2 px-1 font-semibold w-[15%]" style={{ color: "#7B8796" }}>Free</th>
                        <th className="text-center py-2 px-1 font-semibold w-[15%]" style={{ color: "#7B8796" }}>Team</th>
                        <th className="text-center py-2 px-1 font-semibold w-[15%]" style={{ color: "#2563EB" }}>Biz</th>
                        <th className="text-center py-2 px-1 font-semibold w-[15%]" style={{ color: "#7B8796" }}>Ent.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((item, index) => {
                        if ("isCategoryHeader" in item && item.isCategoryHeader) {
                          return (
                            <tr key={`mcat-${index}`} style={{ borderTop: "1px solid #D7E0EB", backgroundColor: item.tier === "business" ? "rgba(37,99,235,0.04)" : "#EAF1F8" }}>
                              <td colSpan={5} className="py-1.5 px-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: item.tier === "business" ? "#2563EB" : item.tier === "enterprise" ? "#7C3AED" : "#64748B" }}>{item.label}</span>
                                  {item.tier === "business" && <span className="text-[8px] font-semibold px-1 rounded" style={{ color: "#2563EB", backgroundColor: "rgba(37,99,235,0.08)" }}>Biz+</span>}
                                  {item.tier === "enterprise" && <span className="text-[8px] font-semibold px-1 rounded" style={{ color: "#7C3AED", backgroundColor: "rgba(124,58,237,0.08)" }}>Ent.</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const d = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string };
                        const mCell = (val: boolean | string, highlight?: boolean) => (
                          <td className="text-center py-1.5 px-1" style={highlight ? { backgroundColor: "rgba(37,99,235,0.04)" } : undefined}>
                            {typeof val === "boolean" ? (val ? <Check className="inline h-3 w-3" style={{ color: "#16A34A" }} /> : <span style={{ color: "#CBD5E1" }}>—</span>) : <span className="font-medium" style={{ color: "#334155" }}>{val}</span>}
                          </td>
                        );
                        return (
                          <tr key={`mrow-${index}`} style={{ borderBottom: "1px solid rgba(227,234,244,0.5)" }}>
                            <td className="py-1.5 pr-2 font-medium" style={{ color: "#334155" }}>{d.feature}</td>
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
                <Card className="overflow-hidden hidden md:block" style={{ backgroundColor: "#F6F9FC", border: "1px solid #D7E0EB", borderRadius: "12px" }}>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow style={{ backgroundColor: "#F6F9FC", borderBottom: "1px solid #D7E0EB" }}>
                            <TableHead className="font-semibold w-[280px] py-3 pl-5" style={{ color: "#556070" }}>기능</TableHead>
                            <TableHead className="text-center font-semibold py-3" style={{ color: "#7B8796" }}>Starter</TableHead>
                            <TableHead className="text-center font-semibold py-3" style={{ color: "#7B8796" }}>Team</TableHead>
                            <TableHead className="text-center font-semibold py-3" style={{ color: "#2563EB" }}>Business</TableHead>
                            <TableHead className="text-center font-semibold py-3" style={{ color: "#7B8796" }}>Enterprise</TableHead>
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
                                  style={{ borderTop: "1px solid #D7E0EB", backgroundColor: isBusinessTier ? "rgba(37,99,235,0.04)" : "#F8FAFC" }}
                                >
                                  <TableCell colSpan={5} className="py-2 pl-5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: isBusinessTier ? "#2563EB" : isEnterpriseTier ? "#7C3AED" : "#64748B" }}>
                                        {item.label}
                                      </span>
                                      {isBusinessTier && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "#2563EB", backgroundColor: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>Business+</span>}
                                      {isEnterpriseTier && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "#7C3AED", backgroundColor: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>Enterprise</span>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            const dataItem = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string; key?: boolean };
                            const isKey = dataItem.key;
                            const renderCell = (value: boolean | string) =>
                              typeof value === "boolean" ? (value ? <Check className="h-4 w-4 mx-auto" style={{ color: "#16A34A" }} /> : <span className="text-lg leading-none" style={{ color: "#CBD5E1" }}>—</span>) : <span className={cn("text-sm font-medium")} style={{ color: value === "—" ? "#CBD5E1" : "#334155" }}>{value}</span>;
                            return (
                              <TableRow key={index} className="transition-colors" style={{ borderBottom: "1px solid rgba(227,234,244,0.5)", borderLeft: isKey ? "2px solid rgba(37,99,235,0.35)" : undefined }}>
                                <TableCell className="py-2.5 pl-5 text-sm font-medium" style={{ color: isKey ? "#0F1728" : "#334155" }}>{dataItem.feature}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.starter)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.team)}</TableCell>
                                <TableCell className="text-center py-2.5" style={{ backgroundColor: "rgba(37,99,235,0.04)" }}>{renderCell(dataItem.business)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.enterprise)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
                </>}
              </div>

            </div>
          </div>
        </div>

      {/* ── Conversion band ── */}
      <section style={{ backgroundColor: "#DCE5F0" }}>
        <div className="mx-auto max-w-[1120px] px-4 py-12 md:py-16">
          <div className="rounded-2xl px-8 pt-12 pb-10 md:px-20 md:pt-16 md:pb-14 text-center" style={{ backgroundColor: "#F6F9FC", border: "1px solid #D7E0EB", boxShadow: "0 1px 4px rgba(15,23,42,0.04), 0 4px 20px rgba(51,65,85,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2563EB" }}>Get Started</p>
            <h2 className="text-xl md:text-[28px] font-bold mb-3" style={{ color: "#0F1728", lineHeight: 1.3 }}>
              도입 문의 또는 무료 체험으로 시작하세요
            </h2>
            <p className="text-sm md:text-base mb-8 max-w-lg mx-auto" style={{ color: "#556070", lineHeight: 1.7 }}>
              현재 업무 범위에 맞는 플랜을 선택하고, 운영에 바로 연결할 수 있습니다.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                className="h-12 px-10 text-[15px] font-bold rounded-lg shadow-sm"
                style={{ backgroundColor: "#2F6BFF", color: "#FFFFFF" }}
                onClick={() => (window.location.href = "/search")}
              >
                무료로 시작하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                className="h-12 px-10 text-[15px] font-semibold rounded-lg"
                style={{ borderColor: "#D0DAE8", color: "#334155", backgroundColor: "transparent" }}
                onClick={() => (window.location.href = "/support")}
              >
                도입 문의
              </Button>
            </div>
            <p className="mt-6 text-[12px]" style={{ color: "#94A3B8" }}>
              현재 Beta 기간 중 모든 기능을 무료로 체험할 수 있습니다
            </p>
          </div>
        </div>
      </section>

      {/* ── Light → Footer Bridge (채도 낮은 청회색 전이) ── */}
      <div
        aria-hidden="true"
        style={{
          height: 120,
          background:
            "linear-gradient(180deg, #DCE5F0 0%, #c0cdd8 12%, #a0b0c0 26%, #8498ac 40%, #687f96 54%, #506880 66%, #3b536c 78%, #283f58 88%, #182d45 95%, #071A33 100%)",
        }}
      />

      {/* ── 하단 고정 결제 요약 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-sm" style={{ backgroundColor: "rgba(246,249,252,0.95)", borderTop: "1px solid #D7E0EB" }}>
        {/* ── 모바일 바 ── */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold truncate" style={{ color: "#0F1728" }}>
              {selectedPlan === "starter"
                ? "Starter · 무료"
                : selectedPlan === "team"
                ? `Team · ₩${(isAnnual ? teamAnnualPerMonth : TEAM_MONTHLY).toLocaleString()}/월`
                : selectedPlan === "business"
                ? `Business · ₩${(isAnnual ? businessAnnualPerMonth : BUSINESS_MONTHLY).toLocaleString()}/월`
                : "Enterprise · 별도 문의"}
            </span>
            {isAnnual && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0" style={{ backgroundColor: "rgba(22,163,74,0.08)", color: "#16A34A" }}>연간</Badge>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold"
              style={{ backgroundColor: "#2F6BFF", color: "#FFFFFF" }}
              onClick={() => selectedPlan && handlePrimaryAction({ stopPropagation: () => {} } as React.MouseEvent, selectedPlan)}
            >
              시작하기
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              style={{ borderColor: "#E3EAF4", color: "#556070", backgroundColor: "transparent" }}
              onClick={() => (window.location.href = "/support")}
            >
              문의
            </Button>
          </div>
        </div>
        {/* ── 데스크톱 바 ── */}
        <div className="hidden md:flex mx-auto max-w-[90rem] px-8 py-4 items-center justify-between gap-x-12">
          <div className="space-y-0.5">
            <p className="text-base font-semibold" style={{ color: "#0F1728" }}>
              현재 선택된 플랜
            </p>
            <p className="text-sm" style={{ color: "#556070" }}>
              플랜을 선택 후 바로 시작하거나 도입 문의를 남겨주세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs font-medium" style={{ color: "#7B8796" }}>요금제</span>
              <span className="text-base font-semibold" style={{ color: "#0F1728" }}>
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
              <span className="text-xs font-medium" style={{ color: "#7B8796" }}>결제 주기</span>
              <span className="text-base font-semibold" style={{ color: "#0F1728" }}>
                {isAnnual ? "연간 결제 (10% 할인)" : "월간 결제"}
              </span>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <Button
              className="px-8 h-11 text-base font-semibold whitespace-nowrap shadow-sm"
              style={{ backgroundColor: "#2F6BFF", color: "#FFFFFF" }}
              onClick={() => (window.location.href = "/support")}
            >
              요금 & 도입 문의
            </Button>
          </div>
        </div>
      </div>

      <MainFooter />
    </div>
  );
}
