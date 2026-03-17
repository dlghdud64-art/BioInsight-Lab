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

const TEAM_MONTHLY = 49000;
const BUSINESS_MONTHLY = 149000;

export type PlanId = "starter" | "team" | "business" | "enterprise";

// ── 비교 테이블 row 타입 ────────────────────────────────────────────
type ComparisonItem =
  | { isCategoryHeader: true; label: string; tier?: "team" | "business" | "enterprise" }
  | {
      isCategoryHeader?: false;
      feature: string;
      starter: boolean | string;
      team: boolean | string;
      business: boolean | string;
      enterprise: boolean | string;
    };

export default function PricingPage() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>("business");
  const [expandedCards, setExpandedCards] = useState<Set<PlanId>>(new Set());

  const teamAnnualPerMonth = Math.round(TEAM_MONTHLY * 0.9);
  const businessAnnualPerMonth = Math.round(BUSINESS_MONTHLY * 0.9);

  // ── 플랜 정의 ─────────────────────────────────────────────────────
  const plans = [
    {
      id: "starter" as PlanId,
      name: "Starter",
      tagline: "개인 시작",
      price: "무료",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "개인 연구자와 초기 검토를 위한 시작 플랜",
      mobileHook: "혼자 검색·비교",
      icon: Package,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[420px]",
      buttonText: "무료로 시작하기",
      features: [
        "개인 전용 (팀원 초대 불가)",
        "기본 검색 및 비교",
        "품목 등록 (최대 10개)",
        "기본 견적 요청",
      ],
    },
    {
      id: "team" as PlanId,
      name: "Team",
      tagline: "협업 시작",
      price: "₩49,000",
      priceMonthly: TEAM_MONTHLY,
      priceAnnualPerMonth: teamAnnualPerMonth,
      pricePeriod: "/월",
      description: "소규모 연구팀 협업을 위한 플랜",
      mobileHook: "팀 공유 · 구매 요청",
      icon: Users,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[500px]",
      buttonText: "팀으로 시작하기",
      features: [
        "팀원 5명까지",
        "팀원 공유 재고",
        "후보 품목 공유",
        "구매 요청 워크플로우",
        "품목 등록 (최대 50개)",
        "엑셀 업로드 · CSV 내보내기",
        "대체품 추천",
      ],
    },
    {
      id: "business" as PlanId,
      name: "Business",
      tagline: "조직 운영 표준",
      price: "₩149,000",
      priceMonthly: BUSINESS_MONTHLY,
      priceAnnualPerMonth: businessAnnualPerMonth,
      pricePeriod: "/월",
      description: "승인과 예산 관리가 필요한 조직용 표준 플랜",
      mobileHook: "승인 · 예산 · 감사 추적",
      icon: Building,
      badge: "연구팀·구매팀 표준 플랜",
      isRecommended: true,
      cardHeight: "md:min-h-[580px]",
      buttonText: "Business 시작하기",
      features: [
        "팀원 무제한",
        "전자결재 승인 라인",
        "예산 통합 관리",
        "Audit Trail",
        "MSDS 자동 연동",
        "Lot 관리 · 재고 소진 알림",
        "관리자 운영 대시보드",
        "품목 등록 무제한",
      ],
    },
    {
      id: "enterprise" as PlanId,
      name: "Enterprise",
      tagline: "기관 도입",
      price: "별도 문의",
      priceMonthly: null as number | null,
      priceAnnualPerMonth: null as number | null,
      pricePeriod: undefined as string | undefined,
      description: "보안·연동·대규모 운영이 필요한 기관용 플랜",
      mobileHook: "ERP · SSO · 전담 매니저",
      icon: Building2,
      badge: null as string | null,
      isRecommended: false,
      cardHeight: "md:min-h-[500px]",
      buttonText: "도입 상담 문의",
      features: [
        "Business 전체 기능",
        "ERP API 연동",
        "SSO 지원",
        "무제한 데이터 저장",
        "전담 매니저 및 SLA",
        "조직 맞춤 구축 지원",
      ],
    },
  ];

  // ── 비교 테이블 데이터 ─────────────────────────────────────────────
  // 카테고리 구조: Team = 검색·협업·요청, Business = 운영·문서, Enterprise = 보안/연동
  const comparisonFeatures: ComparisonItem[] = [
    // ── 검색 및 비교
    { isCategoryHeader: true, label: "검색 및 비교" },
    { feature: "기본 검색 및 비교", starter: true, team: true, business: true, enterprise: true },
    { feature: "확장 검색 (제조사·CAS No.·프로토콜)", starter: false, team: true, business: true, enterprise: true },
    { feature: "대체품 추천", starter: false, team: true, business: true, enterprise: true },

    // ── 협업
    { isCategoryHeader: true, label: "협업" },
    { feature: "팀원 수", starter: "1명", team: "5명", business: "무제한", enterprise: "무제한" },
    { feature: "팀원 공유 재고", starter: false, team: true, business: true, enterprise: true },
    { feature: "후보 품목 공유", starter: false, team: true, business: true, enterprise: true },
    { feature: "품목 등록 수", starter: "10개", team: "50개", business: "무제한", enterprise: "무제한" },

    // ── 요청 및 공유
    { isCategoryHeader: true, label: "요청 및 공유" },
    { feature: "기본 견적 요청", starter: true, team: true, business: true, enterprise: true },
    { feature: "구매 요청 워크플로우", starter: false, team: true, business: true, enterprise: true },
    { feature: "요청 공유 링크", starter: false, team: true, business: true, enterprise: true },
    { feature: "엑셀 업로드", starter: false, team: true, business: true, enterprise: true },
    { feature: "CSV 내보내기", starter: false, team: true, business: true, enterprise: true },

    // ── 운영 및 통제 (Business+)
    { isCategoryHeader: true, label: "운영 및 통제", tier: "business" },
    { feature: "전자결재 승인 라인", starter: false, team: false, business: true, enterprise: true },
    { feature: "예산 통합 관리", starter: false, team: false, business: true, enterprise: true },
    { feature: "재고 소진 알림", starter: false, team: false, business: true, enterprise: true },
    { feature: "관리자 운영 대시보드", starter: false, team: false, business: true, enterprise: true },
    { feature: "팀원 권한 관리 (RBAC)", starter: false, team: false, business: true, enterprise: true },

    // ── 문서 및 이력 관리 (Business+)
    { isCategoryHeader: true, label: "문서 및 이력 관리", tier: "business" },
    { feature: "Audit Trail", starter: false, team: false, business: true, enterprise: true },
    { feature: "MSDS 자동 연동", starter: false, team: false, business: true, enterprise: true },
    { feature: "Lot 관리", starter: false, team: false, business: true, enterprise: true },
    { feature: "구매 이력 추적", starter: false, team: false, business: true, enterprise: true },

    // ── 보안 / 연동 (Enterprise)
    { isCategoryHeader: true, label: "보안 / 연동", tier: "enterprise" },
    { feature: "데이터 암호화 (저장/전송)", starter: true, team: true, business: true, enterprise: true },
    { feature: "ERP API 연동", starter: false, team: false, business: false, enterprise: true },
    { feature: "SSO 지원", starter: false, team: false, business: false, enterprise: true },
    { feature: "무제한 데이터 저장", starter: false, team: false, business: false, enterprise: true },
    { feature: "전담 매니저 및 SLA", starter: false, team: false, business: false, enterprise: true },
  ];

  const getCheckoutUrl = useCallback(
    (planId: PlanId): string => {
      if (planId === "starter") return "/test/search";
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
          <span className="text-slate-400 line-through text-xs md:text-lg font-normal">{plan.price}</span>
          <span className="text-lg md:text-3xl font-bold text-slate-900">
            ₩{plan.priceAnnualPerMonth.toLocaleString()}
            <span className="text-[10px] md:text-sm font-normal text-slate-600">/월</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-green-50 px-1.5 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold text-green-700 ring-1 ring-green-600/10">
            10% 할인
          </span>
        </span>
      );
    }
    return (
      <span key="monthly" className="animate-in slide-in-from-bottom-2 fade-in duration-300">
        {plan.price}
        {plan.pricePeriod}
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
                <h1 className="text-lg md:text-4xl lg:text-5xl font-bold text-slate-900 mb-1 md:mb-3">
                  맞는 플랜으로 시작하세요
                </h1>
                <p className="text-slate-600 text-xs md:text-lg max-w-xl mx-auto leading-relaxed">
                  개인 탐색부터 조직 운영까지, 단계별 플랜
                </p>
              </div>

              {/* ── 결제 주기 토글 ── */}
              <div className="flex items-center justify-center mb-4 md:mb-12">
                <div className="bg-slate-100 rounded-full p-0.5 md:p-1 inline-flex">
                  <button
                    type="button"
                    onClick={() => setIsAnnual(false)}
                    className={cn(
                      "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                      !isAnnual
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    월간
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnnual(true)}
                    className={cn(
                      "px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 flex items-center gap-1 md:gap-2",
                      isAnnual
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    연간
                    <span className="bg-slate-200 text-slate-600 text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-medium">
                      -10%
                    </span>
                  </button>
                </div>
              </div>

              {/* ── 가격 카드 ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 mb-10 md:mb-16 items-stretch lg:items-end">
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
                        isSelected && "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50 border-blue-300",
                        !isSelected && "hover:border-slate-300 hover:bg-slate-50/50",
                        isRecommended && !isSelected && "border-2 border-blue-200 shadow-2xl md:scale-105 z-10",
                        isRecommended && isSelected && "border-2 border-blue-500 shadow-2xl ring-2 ring-blue-500 ring-offset-2 md:scale-105 z-10"
                      )}
                    >
                      {/* 뱃지 */}
                      {plan.badge && (
                        <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs font-bold shadow-lg whitespace-nowrap">
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-1 md:pb-4 px-2.5 md:px-6 pt-3 md:pt-6">
                        {/* 아이콘 — 모바일 숨김 */}
                        <div className="hidden md:flex justify-center mb-3">
                          <div
                            className={cn(
                              "p-3 rounded-full transition-colors",
                              isSelected || isRecommended ? "bg-blue-100" : "bg-slate-100"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-6 w-6",
                                isSelected || isRecommended ? "text-blue-600" : "text-slate-500"
                              )}
                            />
                          </div>
                        </div>

                        {/* 플랜명 + 티어 레이블 */}
                        <CardTitle className="text-lg md:text-2xl font-bold mb-0.5">{plan.name}</CardTitle>
                        <p className="text-[10px] md:text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 md:mb-3">
                          {plan.tagline}
                        </p>

                        {/* 가격 */}
                        <div className="flex flex-col items-center gap-0.5 mb-1 md:mb-3 min-h-[4rem] md:min-h-[5rem] overflow-hidden justify-center">
                          <span className="text-xl md:text-3xl font-bold text-slate-900 text-center">
                            {renderPrice(plan)}
                          </span>
                          {plan.pricePeriod && !isAnnual && (
                            <span className="text-xs md:text-sm text-slate-500">{plan.pricePeriod}</span>
                          )}
                        </div>

                        {/* 모바일: 핵심 전환 이유 1줄 / 데스크톱: 풀 설명 */}
                        <p className="md:hidden text-[10px] font-medium text-blue-600/80">{plan.mobileHook}</p>
                        <CardDescription className="hidden md:block text-sm text-slate-600 leading-relaxed">
                          {plan.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pt-0 px-2.5 md:px-6 pb-3 md:pb-6" onClick={(e) => e.stopPropagation()}>
                        {/* 기능 목록 — 모바일: 4개까지 + 더보기 */}
                        <ul className="space-y-2 md:space-y-3 mb-3 md:mb-6 flex-1">
                          {plan.features.slice(0, isExpanded ? undefined : MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={index} className={cn(
                              "flex items-start gap-2 md:gap-2.5 leading-relaxed",
                              // 모바일에서 LIMIT 이후는 md에서만 보이게 하지 않고, isExpanded로 제어
                              !isExpanded && index >= MOBILE_FEATURE_LIMIT && "hidden md:flex"
                            )}>
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5",
                                  isRecommended ? "text-blue-600" : "text-green-600"
                                )}
                              />
                              <span className="text-xs md:text-sm text-slate-700">{feature}</span>
                            </li>
                          ))}
                          {/* 데스크톱에서만 보이는 나머지 (expand 안 돼도) */}
                          {!isExpanded && plan.features.slice(MOBILE_FEATURE_LIMIT).map((feature, index) => (
                            <li key={`desktop-${index}`} className="hidden md:flex items-start gap-2.5 leading-relaxed">
                              <Check
                                className={cn(
                                  "h-4 w-4 flex-shrink-0 mt-0.5",
                                  isRecommended ? "text-blue-600" : "text-green-600"
                                )}
                              />
                              <span className="text-sm text-slate-700">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {/* 모바일 기능 더보기 토글 */}
                        {hasMore && (
                          <button
                            type="button"
                            className="md:hidden flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 mb-3 transition-colors"
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

                        {/* CTA 버튼 */}
                        {isSelected ? (
                          <Button
                            className={cn(
                              "w-full font-semibold h-9 md:h-10 text-sm",
                              plan.id === "business"
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                : "bg-slate-800 hover:bg-slate-700 text-white"
                            )}
                            onClick={(e) => handlePrimaryAction(e, plan.id)}
                          >
                            {plan.buttonText}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 h-9 md:h-10 text-sm"
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
                  <h2 className="text-base md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">
                    플랜별 기능 비교
                  </h2>
                  <p className="text-[11px] md:text-sm text-slate-500">
                    Team은 협업 · Business부터 운영 통제
                  </p>
                </div>

                {/* ── 모바일: 컴팩트 테이블 (축약 헤더 고정) ── */}
                <div className="md:hidden overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 sticky top-0 bg-white">
                        <th className="text-left py-2 pr-2 font-semibold text-slate-600 w-[40%]">기능</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Free</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Team</th>
                        <th className="text-center py-2 px-1 font-semibold text-blue-700 bg-blue-50/50 w-[15%]">Biz</th>
                        <th className="text-center py-2 px-1 font-semibold text-slate-500 w-[15%]">Ent.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((item, index) => {
                        if ("isCategoryHeader" in item && item.isCategoryHeader) {
                          return (
                            <tr key={`mcat-${index}`} className={cn(
                              "border-t",
                              item.tier === "business" ? "bg-blue-50/30" : item.tier === "enterprise" ? "bg-slate-50" : "bg-slate-50/50"
                            )}>
                              <td colSpan={5} className="py-1.5 px-1">
                                <div className="flex items-center gap-1">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider",
                                    item.tier === "business" ? "text-blue-600" : item.tier === "enterprise" ? "text-slate-500" : "text-slate-400"
                                  )}>{item.label}</span>
                                  {item.tier === "business" && <span className="text-[8px] font-semibold text-blue-600 bg-blue-100 px-1 rounded">Biz+</span>}
                                  {item.tier === "enterprise" && <span className="text-[8px] font-semibold text-slate-500 bg-slate-200 px-1 rounded">Ent.</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const d = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string };
                        const mCell = (val: boolean | string, highlight?: boolean) => (
                          <td className={cn("text-center py-1.5 px-1", highlight && "bg-blue-50/20")}>
                            {typeof val === "boolean" ? (val ? <Check className="inline h-3 w-3 text-green-600" /> : <span className="text-slate-300">—</span>) : <span className="font-medium text-slate-700">{val}</span>}
                          </td>
                        );
                        return (
                          <tr key={`mrow-${index}`} className="border-b border-slate-100">
                            <td className="py-1.5 pr-2 text-slate-700 font-medium">{d.feature}</td>
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

                {/* ── 데스크톱: 기존 테이블 ── */}
                <Card className="overflow-hidden hidden md:block">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="font-semibold w-[240px] py-3 pl-5 text-slate-700">기능</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-700">Starter</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-700">Team</TableHead>
                            <TableHead className="text-center font-semibold py-3 bg-blue-50 text-blue-800">Business</TableHead>
                            <TableHead className="text-center font-semibold py-3 text-slate-700">Enterprise</TableHead>
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
                                    "border-t border-slate-200",
                                    isBusinessTier ? "bg-blue-50/50" : isEnterpriseTier ? "bg-slate-100/70" : "bg-slate-50/50"
                                  )}
                                >
                                  <TableCell colSpan={5} className="py-2 pl-5">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("text-[11px] font-bold uppercase tracking-widest", isBusinessTier ? "text-blue-600" : isEnterpriseTier ? "text-slate-500" : "text-slate-400")}>
                                        {item.label}
                                      </span>
                                      {isBusinessTier && <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full">Business+</span>}
                                      {isEnterpriseTier && <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-full">Enterprise</span>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            const dataItem = item as { feature: string; starter: boolean | string; team: boolean | string; business: boolean | string; enterprise: boolean | string };
                            const renderCell = (value: boolean | string) =>
                              typeof value === "boolean" ? (value ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-slate-300 text-lg leading-none">—</span>) : <span className="text-sm font-medium text-slate-700">{value}</span>;
                            return (
                              <TableRow key={index} className="hover:bg-slate-50/40 transition-colors">
                                <TableCell className="py-2.5 pl-5 text-sm text-slate-700 font-medium">{dataItem.feature}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.starter)}</TableCell>
                                <TableCell className="text-center py-2.5">{renderCell(dataItem.team)}</TableCell>
                                <TableCell className="text-center py-2.5 bg-blue-50/20">{renderCell(dataItem.business)}</TableCell>
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
      {/* 모바일: 1줄 컴팩트 / 데스크톱: 풀 레이아웃 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
        {/* ── 모바일 바 ── */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-900 truncate">
              {selectedPlan === "starter"
                ? "Starter · 무료"
                : selectedPlan === "team"
                ? `Team · ₩${(isAnnual ? teamAnnualPerMonth : TEAM_MONTHLY).toLocaleString()}/월`
                : selectedPlan === "business"
                ? `Business · ₩${(isAnnual ? businessAnnualPerMonth : BUSINESS_MONTHLY).toLocaleString()}/월`
                : "Enterprise · 별도 문의"}
            </span>
            {isAnnual && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 shrink-0">연간</Badge>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700"
              onClick={() => selectedPlan && handlePrimaryAction({ stopPropagation: () => {} } as React.MouseEvent, selectedPlan)}
            >
              시작하기
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs border-slate-200"
              onClick={() => (window.location.href = "/support")}
            >
              문의
            </Button>
          </div>
        </div>
        {/* ── 데스크톱 바 ── */}
        <div className="hidden md:flex mx-auto max-w-[90rem] px-8 py-4 items-center justify-between gap-x-12">
          <div className="space-y-0.5">
            <p className="text-base font-semibold text-slate-900">
              현재 선택된 플랜
            </p>
            <p className="text-sm text-slate-500">
              플랜을 선택 후 바로 시작하거나 도입 문의를 남겨주세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-medium">요금제</span>
              <span className="text-base font-semibold text-slate-900">
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
              <span className="text-base font-semibold text-slate-900">
                {isAnnual ? "연간 결제 (10% 할인)" : "월간 결제"}
              </span>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <Button
              className="px-8 h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700 whitespace-nowrap shadow-sm"
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
