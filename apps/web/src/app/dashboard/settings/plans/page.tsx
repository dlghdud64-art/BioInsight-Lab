"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import * as React from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Users,
  Building,
  Building2,
  Package,
  Calendar,
  CreditCard,
  BarChart3,
  Loader2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Crown,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  SubscriptionPlan,
  PLAN_LIMITS,
  PLAN_DISPLAY,
  PLAN_PRICES,
  PLAN_ORDER,
  ENTERPRISE_INFO,
  ANNUAL_DISCOUNT_RATE,
  getAnnualMonthlyPrice,
  getAnnualTotalPrice,
  getPlanLimits,
  getPlanDisplayName,
} from "@/lib/plans";

// ── 운영 기능 비교 목록 ──
const FEATURE_COMPARISON = [
  { key: "exportPack", label: "데이터 내보내기", desc: "Excel/PDF 일괄 내보내기" },
  { key: "approvalWorkflow", label: "전자결재 승인 라인", desc: "구매 요청 워크플로우" },
  { key: "budgetManagement", label: "예산 통합 관리", desc: "예산 배정·집행·초과 관리" },
  { key: "autoReorder", label: "자동 재주문", desc: "안전재고 기반 자동 발주" },
  { key: "advancedReports", label: "고급 리포트", desc: "맞춤 분석 및 내보내기" },
  { key: "lotManagement", label: "Lot 관리", desc: "Lot별 수량·위치·유효기한 추적" },
  { key: "auditTrail", label: "Audit Trail", desc: "변경 이력 및 감사 증적" },
  { key: "inboundEmail", label: "이메일 연동", desc: "견적 이메일 자동 처리" },
  { key: "vendorPortal", label: "벤더 포털", desc: "공급사 직접 견적 응답" },
  { key: "sso", label: "SSO (통합 인증)", desc: "SAML/OAuth 기반 로그인 — Enterprise 전용" },
  { key: "prioritySupport", label: "전담 매니저 및 SLA", desc: "우선 기술 지원 — Enterprise 전용" },
] as const;

// ── 플랜 카드 정의 ──
const PLAN_CARDS = [
  {
    id: SubscriptionPlan.FREE,
    icon: Package,
    features: [
      "개인 전용 (팀원 초대 불가)",
      "기본 검색 및 비교",
      "품목 등록 (최대 10개)",
      "기본 견적 요청",
    ],
  },
  {
    id: SubscriptionPlan.TEAM,
    icon: Users,
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
    id: SubscriptionPlan.ORGANIZATION,
    icon: Building,
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
];

export default function PlansPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isAnnual, setIsAnnual] = useState(false);

  // ── 조직 목록 ──
  const {
    data: organizationsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string })?.error ?? "조직 목록을 불러오지 못했습니다."
        );
      }
      return response.json();
    },
    enabled: status === "authenticated",
    retry: 1,
  });

  // ── 구독 정보 (단일 source of truth) ──
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["subscription", selectedOrgId],
    queryFn: async () => {
      const response = await fetch(
        `/api/organizations/${selectedOrgId}/subscription`
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedOrgId,
    retry: 1,
  });

  // ── 플랜 변경 mutation ──
  const upgradeMutation = useMutation({
    mutationFn: async ({
      organizationId,
      plan,
    }: {
      organizationId: string;
      plan: SubscriptionPlan;
    }) => {
      const response = await fetch(
        `/api/organizations/${organizationId}/subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, periodMonths: isAnnual ? 12 : 1 }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? "요금제 변경에 실패했습니다."
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      queryClient.invalidateQueries({
        queryKey: ["subscription", selectedOrgId],
      });
      toast({
        title: "플랜 변경 완료",
        description: "구독이 성공적으로 변경되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "요금제 변경 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ── 로딩/에러 상태 ──
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
              <p className="text-muted-foreground">
                구독 플랜 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const organizations = organizationsData?.organizations || [];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg =
    organizations.find((org: any) => org.id === selectedOrgId) ||
    organizations[0];

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

  // ── 현재 플랜 결정 ──
  const subscription = subscriptionData?.subscription;
  const validPlans = Object.values(SubscriptionPlan) as string[];
  const currentPlan: SubscriptionPlan =
    subscription?.plan && validPlans.includes(subscription.plan)
      ? (subscription.plan as SubscriptionPlan)
      : selectedOrg?.plan && validPlans.includes(selectedOrg.plan)
        ? (selectedOrg.plan as SubscriptionPlan)
        : SubscriptionPlan.FREE;

  const limits = getPlanLimits(currentPlan);
  const currentDisplay = PLAN_DISPLAY[currentPlan];

  // ── 구독 상세 ──
  const currentSeats =
    subscription?.currentSeats ?? (selectedOrg?.memberCount ?? 1);
  const maxSeats = limits.maxMembers;
  const nextPaymentDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // ── 가격 계산 ──
  const getDisplayPrice = (plan: SubscriptionPlan): number => {
    const base = PLAN_PRICES[plan];
    if (base === 0) return 0;
    return isAnnual ? getAnnualMonthlyPrice(plan) : base;
  };

  const formatPrice = (amount: number): string => {
    if (amount === 0) return "무료";
    return `₩${amount.toLocaleString()}`;
  };

  // ── 버튼 라벨/스타일 ──
  const getButtonInfo = (planId: SubscriptionPlan) => {
    if (planId === currentPlan) {
      return { label: "현재 사용 중", disabled: true, isUpgrade: false, isDowngrade: false };
    }
    const currentOrder = PLAN_ORDER[currentPlan];
    const targetOrder = PLAN_ORDER[planId];
    const isUpgrade = targetOrder > currentOrder;
    return {
      label: isUpgrade ? "업그레이드" : "다운그레이드",
      disabled: false,
      isUpgrade,
      isDowngrade: !isUpgrade,
    };
  };

  const handlePlanChange = (planId: SubscriptionPlan) => {
    const info = getButtonInfo(planId);
    const planName = PLAN_DISPLAY[planId].displayName;

    const msg = info.isDowngrade
      ? `${planName} 플랜으로 다운그레이드하시겠습니까?\n일부 기능이 제한될 수 있으며, 현재 데이터는 유지됩니다.`
      : `${planName} 플랜으로 업그레이드하시겠습니까?`;

    if (confirm(msg)) {
      upgradeMutation.mutate({
        organizationId: selectedOrg.id,
        plan: planId,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ── 헤더 ── */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              구독 플랜 관리
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              조직별 구독 플랜을 확인하고 변경할 수 있습니다.
            </p>
          </div>

          {/* ── 조직 선택 ── */}
          {organizations.length > 1 && (
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label
                    htmlFor="team-select"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
                  >
                    조직 선택
                  </Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger
                      id="team-select"
                      className="w-[300px] dark:bg-slate-800 dark:border-slate-700"
                    >
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

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ① 현재 구독 상태 (최상단)
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl",
                      currentPlan === SubscriptionPlan.ORGANIZATION
                        ? "bg-indigo-100 dark:bg-indigo-900/30"
                        : currentPlan === SubscriptionPlan.TEAM
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-slate-100 dark:bg-slate-800"
                    )}
                  >
                    <Crown
                      className={cn(
                        "h-5 w-5",
                        currentPlan === SubscriptionPlan.ORGANIZATION
                          ? "text-indigo-600 dark:text-indigo-400"
                          : currentPlan === SubscriptionPlan.TEAM
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 dark:text-slate-400"
                      )}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                      현재 구독
                      <Badge
                        className={cn(
                          "text-xs",
                          currentPlan === SubscriptionPlan.ORGANIZATION
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
                            : currentPlan === SubscriptionPlan.TEAM
                              ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        )}
                      >
                        {currentDisplay.displayName}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedOrg.name}
                    </CardDescription>
                  </div>
                </div>
                {currentPlan !== SubscriptionPlan.FREE && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatPrice(getDisplayPrice(currentPlan))}
                      <span className="text-sm font-normal text-slate-500 ml-1">
                        /{isAnnual ? "월" : "월"}
                      </span>
                    </p>
                    {isAnnual && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                        연간 결제 10% 할인 적용
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Package className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      현재 플랜
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentDisplay.displayName}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      결제 주기
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentPlan === SubscriptionPlan.FREE
                      ? "-"
                      : isAnnual
                        ? "연간"
                        : "월간"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      다음 결제일
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentPlan === SubscriptionPlan.FREE
                      ? "-"
                      : nextPaymentDate ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      좌석 사용량
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentSeats}명 /{" "}
                    {maxSeats === null ? "무제한" : `${maxSeats}명`}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      월간 견적
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {limits.maxQuotesPerMonth === null
                      ? "무제한"
                      : `${limits.maxQuotesPerMonth}건`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ② 결제 주기 토글
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="flex items-center justify-center">
            <div className="bg-white dark:bg-slate-900 rounded-full p-1 inline-flex border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  !isAnnual
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                월간 결제
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2",
                  isAnnual
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                연간 결제
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    isAnnual
                      ? "bg-green-500 text-white"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  )}
                >
                  10% 할인
                </span>
              </button>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ③ 플랜 카드 (Starter / Team / Business / Enterprise)
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
            {/* ── Starter / Team / Business 카드 ── */}
            {PLAN_CARDS.map((card) => {
              const display = PLAN_DISPLAY[card.id];
              const planLimits = PLAN_LIMITS[card.id];
              const isCurrentPlan = card.id === currentPlan;
              const isBusiness = card.id === SubscriptionPlan.ORGANIZATION;
              const isTeam = card.id === SubscriptionPlan.TEAM;
              const Icon = card.icon;
              const btnInfo = getButtonInfo(card.id);
              const price = getDisplayPrice(card.id);
              const originalPrice = PLAN_PRICES[card.id];

              return (
                <Card
                  key={card.id}
                  className={cn(
                    "relative flex flex-col transition-all duration-300 hover:shadow-lg dark:bg-slate-900",
                    isCurrentPlan &&
                      "ring-2 ring-emerald-500 shadow-lg border-emerald-200 dark:border-emerald-800",
                    !isCurrentPlan &&
                      display.isRecommended &&
                      "ring-2 ring-blue-500 shadow-xl border-blue-200 dark:border-blue-800",
                    !isCurrentPlan &&
                      !display.isRecommended &&
                      "border-slate-200 dark:border-slate-800"
                  )}
                >
                  {/* 현재 플랜 배지 */}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-emerald-600 text-white px-3 py-1 shadow-lg text-xs">
                        현재 플랜
                      </Badge>
                    </div>
                  )}
                  {/* Recommended 배지 */}
                  {!isCurrentPlan && display.isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-blue-600 text-white px-3 py-1 shadow-lg text-xs whitespace-nowrap">
                        연구팀·구매팀 표준 플랜
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3 pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isCurrentPlan
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : isBusiness
                              ? "bg-blue-100 dark:bg-blue-900/30"
                              : "bg-slate-100 dark:bg-slate-800"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isCurrentPlan
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isBusiness
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400"
                          )}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold dark:text-white">
                          {display.displayName}
                        </CardTitle>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                          {display.tagline}
                        </p>
                      </div>
                    </div>
                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                      {display.description}
                    </CardDescription>

                    {/* 가격 */}
                    <div className="mt-4">
                      <div className="flex items-baseline gap-1.5">
                        {isAnnual && originalPrice > 0 && (
                          <span className="text-lg text-slate-400 line-through mr-1">
                            ₩{originalPrice.toLocaleString()}
                          </span>
                        )}
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {formatPrice(price)}
                        </span>
                        {price > 0 && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            /월
                          </span>
                        )}
                      </div>
                      {isAnnual && price > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          연 {formatPrice(getAnnualTotalPrice(card.id))} (10% 할인)
                        </p>
                      )}
                    </div>

                    {/* 멤버 제한 */}
                    <div className="mt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        팀원{" "}
                        {planLimits.maxMembers === null
                          ? "무제한"
                          : planLimits.maxMembers === 1
                            ? "개인 전용"
                            : `최대 ${planLimits.maxMembers}명`}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 space-y-4">
                    {/* 기능 목록 */}
                    <div className="space-y-2.5 flex-1">
                      {card.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-start gap-2.5"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 flex-shrink-0 mt-0.5",
                              isCurrentPlan
                                ? "text-emerald-500"
                                : isBusiness
                                  ? "text-blue-500"
                                  : "text-green-500"
                            )}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 버튼 */}
                    <div className="pt-4 mt-auto">
                      {btnInfo.disabled ? (
                        <Button
                          className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-not-allowed"
                          disabled
                        >
                          현재 사용 중인 플랜
                        </Button>
                      ) : (
                        <Button
                          className={cn(
                            "w-full shadow-sm hover:shadow-md transition-all",
                            btnInfo.isDowngrade
                              ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                              : isBusiness
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                          onClick={() => handlePlanChange(card.id)}
                          disabled={upgradeMutation.isPending}
                        >
                          {upgradeMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              처리 중...
                            </>
                          ) : (
                            <>
                              {btnInfo.isUpgrade && (
                                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                              )}
                              {btnInfo.isDowngrade && (
                                <ArrowDownRight className="mr-1.5 h-4 w-4" />
                              )}
                              {btnInfo.label}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* ── Enterprise 카드 ── */}
            <Card className="relative flex flex-col border-slate-200 dark:border-slate-800 dark:bg-slate-900 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold dark:text-white">
                      {ENTERPRISE_INFO.displayName}
                    </CardTitle>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      {ENTERPRISE_INFO.tagline}
                    </p>
                  </div>
                </div>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  {ENTERPRISE_INFO.description}
                </CardDescription>

                {/* 가격 */}
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {ENTERPRISE_INFO.priceDisplay}
                  </span>
                </div>

                <div className="mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    팀원 무제한 · 전담 매니저 배정
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 space-y-4">
                <div className="space-y-2.5 flex-1">
                  {ENTERPRISE_INFO.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-500" />
                      <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 mt-auto">
                  <Button
                    variant="outline"
                    className="w-full border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => {
                      window.location.href = "/support";
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    도입 상담 문의
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ④ 기능 비교 (운영 기능 기준)
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-slate-900 dark:text-white">
                운영 기능 비교
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                Team은 협업 중심 · Business부터 조직 운영 통제가 시작됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 w-[220px]">
                        기능
                      </th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-400 w-[100px]">
                        Starter
                      </th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-400 w-[100px]">
                        Team
                      </th>
                      <th className="text-center py-3 px-3 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 w-[100px]">
                        Business
                      </th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-600 dark:text-slate-400 w-[100px]">
                        Enterprise
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 기본 정보 행 */}
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-medium text-slate-600 dark:text-slate-400">
                        팀원 수
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        1명
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        5명
                      </td>
                      <td className="text-center py-2.5 px-3 bg-blue-50/30 dark:bg-blue-900/5 text-blue-700 dark:text-blue-400 font-semibold">
                        무제한
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        무제한
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-medium text-slate-600 dark:text-slate-400">
                        품목 등록 수
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        10개
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        50개
                      </td>
                      <td className="text-center py-2.5 px-3 bg-blue-50/30 dark:bg-blue-900/5 text-blue-700 dark:text-blue-400 font-semibold">
                        무제한
                      </td>
                      <td className="text-center py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        무제한
                      </td>
                    </tr>

                    {/* 기능 비교 행 */}
                    {FEATURE_COMPARISON.map((feat) => {
                      const starterHas =
                        PLAN_LIMITS[SubscriptionPlan.FREE].features[
                          feat.key as keyof typeof PLAN_LIMITS.FREE.features
                        ] ?? false;
                      const teamHas =
                        PLAN_LIMITS[SubscriptionPlan.TEAM].features[
                          feat.key as keyof typeof PLAN_LIMITS.TEAM.features
                        ] ?? false;
                      const businessHas =
                        PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].features[
                          feat.key as keyof typeof PLAN_LIMITS.ORGANIZATION.features
                        ] ?? false;
                      // Enterprise = Business 전체 + SSO, onPremise, prioritySupport
                      const enterpriseHas = true; // Enterprise는 모든 기능 포함

                      const renderCell = (has: boolean, isBiz: boolean = false) =>
                        has ? (
                          <CheckCircle2
                            className={cn(
                              "h-4 w-4 mx-auto",
                              isBiz
                                ? "text-blue-500"
                                : "text-green-500 dark:text-green-400"
                            )}
                          />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-lg leading-none">
                            —
                          </span>
                        );

                      return (
                        <tr
                          key={feat.key}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {feat.label}
                              </span>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {feat.desc}
                              </p>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            {renderCell(starterHas)}
                          </td>
                          <td className="text-center py-2.5 px-3">
                            {renderCell(teamHas)}
                          </td>
                          <td className="text-center py-2.5 px-3 bg-blue-50/30 dark:bg-blue-900/5">
                            {renderCell(businessHas, true)}
                          </td>
                          <td className="text-center py-2.5 px-3">
                            {renderCell(enterpriseHas)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── 문의 안내 ── */}
          <Card className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    플랜 선택이 어려우신가요?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    도입 규모와 필요 기능에 맞는 플랜을 추천해드립니다.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => {
                    window.location.href = `/support?subject=${encodeURIComponent("플랜 상담 문의")}`;
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  요금 & 도입 문의
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
