"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
/* §billing-redesign P3: 게이지 규칙·기간 표기는 lib 순수모듈이 정본이다.
 *   페이지에 두면 sentinel 이 페이지 트리(셸 -> next-auth)를 끌고 들어와 게이트가
 *   환경에 인질로 잡힌다(2026-09-09 실측). 계산식 복제 금지 - 여기서 부르기만 한다. */
import {
  usageTone,
  usageNote,
  billingPeriodLabel,
  USAGE_BAR,
  USAGE_TEXT,
} from "@/lib/billing/usage-tone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Check,
  Download,
  Plus,
  Trash2,
  Building2,
  Users,
  FileText,
  ArrowUpRight,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";
// §self-shell-header — 대시보드 화면에 공개 마케팅 헤더를 쓰면
// (a) 로그인 상태에서도 "로그인 / 무료로 시작하기" 가 뜨고
// (b) 그 헤더가 `fixed h-14` 라 페이지 제목을 덮는다.
import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
/* §billing-redesign P2: 이 페이지만 구형 헤더(app/_components, 타이틀 아이콘 포함)를 써서
 *   견적 관리 등과 쉘이 달랐다. 기준 페이지가 쓰는 AppPageHeader 로 맞춘다
 *   (브레드크럼 + 플레인 타이틀 + 우측 액션, 아이콘 없음). */
import { AppPageHeader } from "@/components/layout/page-header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  resolveInvoiceStatusLabel,
  summarizeOutstanding,
} from "@/lib/billing/plan-change-claim";

// 플랜 타입
type PlanType = "FREE" | "TEAM" | "ORGANIZATION";

interface PlanInfo {
  name: string;
  nameKo: string;
  price: number | null;
  priceDisplay: string;
  maxSeats: number | null;
  maxQuotesPerMonth: number | null;
  features: string[];
}

// §11.304 — 티어명 등급화 (Starter→Free / Team→Basic / Business→Pro) 정합.
const PLAN_LABELS: Record<string, string> = {
  starter: "Free",
  team: "Basic",
  business: "Pro",
  enterprise: "Enterprise",
};

/* §billing-redesign P2: 탭 정의 단일점. `paidOnly` 는 Free 에서 내용이 **구조적으로 비는** 탭
 *   (결제 수단 0건 · 청구서 0건)을 표시한다. 사유 배지는 그 이유를 화면에 남긴다. */
const BILLING_TABS: ReadonlyArray<{
  value: string;
  label: string;
  paidOnly?: boolean;
  lockedReason?: string;
}> = [
  { value: "overview", label: "플랜" },
  { value: "methods", label: "결제 수단", paidOnly: true, lockedReason: "유료 플랜부터" },
  { value: "invoices", label: "청구 내역", paidOnly: true, lockedReason: "청구 없음" },
];

function BillingPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
  });

  // 플랜 선택 resolver 로부터 전달된 컨텍스트 파라미터 해석
  const ctxError = searchParams?.get("error");
  const ctxStatus = searchParams?.get("status");
  const ctxAction = searchParams?.get("action");
  const ctxPlan = searchParams?.get("plan");
  const ctxPlanLabel = ctxPlan ? PLAN_LABELS[ctxPlan] ?? ctxPlan : null;

  const contextBanner: {
    variant: "warning" | "info";
    title: string;
    message: string;
  } | null = (() => {
    if (ctxError === "permission_denied") {
      return {
        variant: "warning",
        title: "결제 권한이 없습니다",
        message: `${ctxPlanLabel ?? "선택하신"} 플랜으로 변경하려면 워크스페이스 Admin 권한이 필요합니다. 조직 관리자에게 요청해 주세요.`,
      };
    }
    if (ctxStatus === "already_active") {
      return {
        variant: "info",
        title: "이미 해당 플랜을 사용 중입니다",
        message: `${ctxPlanLabel ?? "선택하신"} 플랜으로 이미 구독 중이라 별도 변경이 필요하지 않습니다.`,
      };
    }
    if (ctxAction === "change_plan") {
      return {
        variant: "info",
        title: "플랜 변경",
        message: `${ctxPlanLabel ?? "선택하신"} 플랜으로 변경을 진행해 주세요. 아래 결제 수단·구독 상태를 확인하신 뒤 업그레이드하실 수 있습니다.`,
      };
    }
    return null;
  })();

  // 구독 정보 조회
  const { data: billingData, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await csrfFetch("/api/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      return res.json();
    },
  });

  /* §invite-flow Phase 2-2 후속 (리뷰 지적 2026-09-01) — **보여준 조직에 적용**.
   * GET 이 돌려준 organizationId 를 mutation 에 그대로 싣는다. 이게 없으면 서버가 그때의
   * 활성 조직으로 다시 고르는데, 읽기와 쓰기 사이에 활성 조직이 바뀌면(다른 탭 switcher)
   * 화면이 보여준 것과 다른 조직의 구독·결제 수단이 바뀐다 — 에러도 빈 화면도 없이 조용히.
   * 🛑 라우트의 hint 수용과 **짝**이다. 한쪽만 있으면 계약이 성립하지 않는다. */
  const billingOrganizationId: string | null = billingData?.organizationId ?? null;

  // 플랜 업그레이드 뮤테이션
  const upgradeMutation = useMutation({
    mutationFn: async (plan: PlanType) => {
      const res = await csrfFetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", plan, organizationId: billingOrganizationId }),
      });
      if (!res.ok) throw new Error("Upgrade failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.action === "contact_sales") {
        toast({
          title: "Enterprise 플랜",
          description: data.message,
        });
        // 이메일 링크 열기
        window.location.href = `mailto:${data.contactEmail}?subject=Enterprise 플랜 문의`;
      } else {
        toast({
          title: "업그레이드 완료",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ["billing"] });
      }
    },
    onError: () => {
      toast({
        title: "업그레이드 실패",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  // 카드 등록 뮤테이션
  const addCardMutation = useMutation({
    mutationFn: async (cardData: typeof cardForm) => {
      const res = await csrfFetch("/api/billing/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cardData, isDefault: true, organizationId: billingOrganizationId }),
      });
      if (!res.ok) throw new Error("Failed to add card");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "카드 등록 완료",
        description: "결제 수단이 등록되었습니다.",
      });
      setIsAddCardOpen(false);
      setCardForm({ cardNumber: "", expMonth: "", expYear: "", cvc: "" });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: () => {
      toast({
        title: "카드 등록 실패",
        description: "카드 정보를 확인해주세요.",
        variant: "destructive",
      });
    },
  });

  // 카드 삭제 뮤테이션
  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await csrfFetch(
        `/api/billing/payment-methods?id=${encodeURIComponent(id)}` +
          (billingOrganizationId ? `&organizationId=${encodeURIComponent(billingOrganizationId)}` : ""),
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete card");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "카드 삭제 완료",
        description: "결제 수단이 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const subscription = billingData?.subscription;
  const planInfo = billingData?.planInfo as Record<PlanType, PlanInfo> | undefined;
  const usage = billingData?.usage;
  const paymentMethods = billingData?.paymentMethods || [];
  const invoices = billingData?.invoices || [];

  const currentPlan = subscription?.plan as PlanType || "FREE";
  /* §billing-redesign P2: 탭 잠금은 플랜 entitlement 파생. Free 만 잠기는 게 아니라
   *   "유료 플랜인가" 하나로 가른다. 플랜이 늘어도 판정식이 갈라지지 않는다. */
  const paidPlan = currentPlan !== "FREE";

  /* §billing-redesign P3: 사용량 4지표 파생. 값·한도는 전부 /api/billing usage 에서 온다
   *   (그 라우트가 enforce 와 같은 계산을 쓴다 — P1). 화면은 색과 문장만 정한다. */
  const period = billingPeriodLabel();

  const usageMetrics = (() => {
    const rows: Array<{
      key: string;
      label: string;
      used: number;
      limit: number | null;
      kind: string;
      seatFull?: boolean;
    }> = [
      { key: "quotes", label: "견적 요청", used: usage?.quotesUsed ?? 0, limit: usage?.quotesLimit ?? null, kind: "요청" },
      {
        key: "seats",
        label: "운영자 시트",
        used: usage?.seatsUsed ?? 1,
        limit: usage?.seatsLimit ?? null,
        kind: "초대",
        seatFull: usage?.seatsLimit != null && (usage?.seatsUsed ?? 1) >= usage.seatsLimit,
      },
      { key: "items", label: "재고 품목", used: usage?.itemsUsed ?? 0, limit: usage?.itemsLimit ?? null, kind: "등록" },
      { key: "labelScans", label: "라벨 스캔", used: usage?.labelScansUsed ?? 0, limit: usage?.labelScansLimit ?? null, kind: "스캔" },
    ];
    return rows.map((r) => {
      const tone = usageTone(r.used, r.limit, r.seatFull);
      const note = usageNote(tone, {
        kind: r.kind,
        resetDateLabel: period.resetDateLabel,
        isSeat: r.key === "seats",
      });
      return {
        ...r,
        tone,
        note,
        limitLabel: r.limit === null ? "무제한" : String(r.limit),
      };
    });
  })();

  /* 한도 1줄 요약. 카드가 기능을 나열하지 않는 대신 숫자만 짚는다(비교표가 단일 소스). */
  const planSummaryLine = usageMetrics
    .map((m) => `${m.label} ${m.limit === null ? "무제한" : m.limit + (m.key === "quotes" || m.key === "labelScans" ? "회" : m.key === "seats" ? "명" : "품목")}`)
    .join(" · ");
  const currentPlanInfo = planInfo?.[currentPlan];

  // 카드 번호 포맷팅
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {/* §billing-redesign P2: 1000px 중앙 고정폭 제거. 다른 페이지와 같은 max-w-7xl 캔버스. */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
        <div>
          <AppPageHeader
            title="청구 및 구독"
            description="구독 플랜, 결제 수단, 청구 내역을 관리합니다."
            actions={[
              {
                label: "영업팀 문의",
                tone: "secondary",
                onClick: () => router.push("/support"),
              },
            ]}
            className="mb-5"
          />

          {contextBanner && (
            <div
              className={cn(
                "mb-6 rounded-lg border px-4 py-3 flex items-start gap-3",
                contextBanner.variant === "warning"
                  ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                  : "border-blue-300 bg-blue-50 text-blue-900"
              )}
              role="status"
            >
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">{contextBanner.title}</p>
                <p className="text-sm mt-0.5 leading-relaxed">
                  {contextBanner.message}
                </p>
              </div>
            </div>
          )}

          {/* §billing-redesign P2: 칩형(grid) → 전역 밑줄 탭 규칙.
              Free 는 결제 수단·청구 내역이 **비어 있는 탭**이라 진입 자체를 막는다.
              들어가서 빈 화면을 보는 것보다 왜 못 들어가는지가 화면에 있어야 한다.
              비활성 여부는 플랜 entitlement 에서 파생(paidPlan)한다. */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0 h-auto">
              {BILLING_TABS.map((tab) => {
                const locked = !paidPlan && tab.paidOnly;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    disabled={locked}
                    title={locked ? tab.lockedReason : undefined}
                    className="rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium text-slate-500 disabled:text-[#cbd5e1] disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    {tab.label}
                    {locked && (
                      <span className="ml-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        {tab.lockedReason}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* 플랜 탭 */}
            <TabsContent value="overview" className="space-y-6">
              {/* §billing-redesign P3: 현재 플랜(요약 1줄) + 사용량(4지표) 2열.
                  기능 나열은 여기서 뺀다 — 같은 내용이 아래 비교표에도 있어 한 화면이
                  두 번 말하고 있었다. 비교표가 단일 소스다. */}
              <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
                {/* 현재 플랜 */}
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">현재 플랜</p>
                    <p className="mt-1 text-[26px] font-extrabold leading-tight text-slate-900">
                      {currentPlanInfo?.nameKo || "Free"}
                    </p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {currentPlanInfo?.priceDisplay || "무료"}
                      {/* 청구 상태는 Invoice 실데이터에서 파생한다(하드코딩 금지 — §plan-change-claim). */}
                      {subscription?.currentPeriodEnd && (
                        <> · {summarizeOutstanding(invoices).text}</>
                      )}
                    </p>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">
                      {planSummaryLine}
                    </p>
                    {/* 결제 미연동 상태라 이 버튼의 실제 역할은 영업팀 연락이다.
                        P5 에서 업그레이드 요청 모달로 승격하되, 지금도 무반응이면 안 된다. */}
                    <Button
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => router.push("/support")}
                    >
                      Basic으로 업그레이드
                    </Button>
                  </CardContent>
                </Card>

                {/* 이번 달 사용량 */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">이번 달 사용량</p>
                      <p className="text-[11.5px] text-slate-500 tabular-nums">
                        {period.range} · 초기화 {period.resetInDays}일 후
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      {usageMetrics.map((m) => (
                        <div key={m.key}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12.5px] text-slate-600">{m.label}</span>
                            <span className={cn("text-[13px] font-bold tabular-nums", USAGE_TEXT[m.tone])}>
                              {m.used} <span className="text-slate-400 font-semibold">/ {m.limitLabel}</span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            {m.limit !== null && (
                              <div
                                className={cn("h-full rounded-full transition-all", USAGE_BAR[m.tone])}
                                style={{ width: `${Math.min(100, (m.used / Math.max(1, m.limit)) * 100)}%` }}
                              />
                            )}
                          </div>
                          {m.note && (
                            <p className={cn("mt-1 text-[11px]", m.tone === "danger" ? "text-red-700" : "text-yellow-700")}>
                              {m.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 플랜 비교 */}
              <Card>
                <CardHeader>
                  <CardTitle>플랜 업그레이드</CardTitle>
                  <CardDescription>더 많은 기능이 필요하신가요?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {planInfo && Object.entries(planInfo).map(([key, plan]) => {
                      const planKey = key as PlanType;
                      const isCurrent = currentPlan === planKey;
                      const isEnterprise = planKey === "ORGANIZATION";

                      return (
                        <Card
                          key={key}
                          className={cn(
                            "relative",
                            isCurrent && "border-blue-500 border-2"
                          )}
                        >
                          {isCurrent && (
                            <Badge className="absolute -top-2 left-4 bg-blue-600">
                              현재 플랜
                            </Badge>
                          )}
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{plan.nameKo}</CardTitle>
                            <div className="text-2xl font-bold">
                              {plan.priceDisplay}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ul className="space-y-2">
                              {plan.features.slice(0, 4).map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>

                            {!isCurrent && (
                              <Button
                                className="w-full"
                                variant={isEnterprise ? "outline" : "default"}
                                onClick={() => upgradeMutation.mutate(planKey)}
                                disabled={upgradeMutation.isPending}
                              >
                                {upgradeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isEnterprise ? (
                                  <>
                                    <Mail className="h-4 w-4 mr-2" />
                                    영업팀 문의
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="h-4 w-4 mr-2" />
                                    업그레이드
                                  </>
                                )}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 결제 수단 탭 */}
            <TabsContent value="methods" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>등록된 결제 수단</CardTitle>
                      <CardDescription>구독 결제에 사용될 카드입니다.</CardDescription>
                    </div>
                    <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          카드 추가
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>결제 카드 등록</DialogTitle>
                          <DialogDescription>
                            구독 결제에 사용할 카드 정보를 입력해주세요.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="cardNumber">카드 번호</Label>
                            <Input
                              id="cardNumber"
                              placeholder="1234 5678 9012 3456"
                              value={cardForm.cardNumber}
                              onChange={(e) =>
                                setCardForm({
                                  ...cardForm,
                                  cardNumber: formatCardNumber(e.target.value),
                                })
                              }
                              maxLength={19}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="expMonth">월</Label>
                              <Input
                                id="expMonth"
                                placeholder="MM"
                                value={cardForm.expMonth}
                                onChange={(e) =>
                                  setCardForm({ ...cardForm, expMonth: e.target.value })
                                }
                                maxLength={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="expYear">년</Label>
                              <Input
                                id="expYear"
                                placeholder="YY"
                                value={cardForm.expYear}
                                onChange={(e) =>
                                  setCardForm({ ...cardForm, expYear: e.target.value })
                                }
                                maxLength={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cvc">CVC</Label>
                              <Input
                                id="cvc"
                                placeholder="123"
                                type="password"
                                value={cardForm.cvc}
                                onChange={(e) =>
                                  setCardForm({ ...cardForm, cvc: e.target.value })
                                }
                                maxLength={4}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>데모 모드: 실제 결제가 발생하지 않습니다.</span>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddCardOpen(false)}
                          >
                            취소
                          </Button>
                          <Button
                            onClick={() => addCardMutation.mutate(cardForm)}
                            disabled={addCardMutation.isPending}
                          >
                            {addCardMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "등록하기"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>등록된 결제 수단이 없습니다.</p>
                      <p className="text-sm mt-1">카드를 등록하면 자동 결제가 가능합니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method: any) => (
                        <div
                          key={method.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-16 bg-gradient-to-r from-slate-700 to-slate-900 rounded flex items-center justify-center text-white text-xs font-bold">
                              {method.brand?.toUpperCase() || "CARD"}
                            </div>
                            <div>
                              <div className="font-medium">
                                **** **** **** {method.last4}
                              </div>
                              <div className="text-sm text-slate-500">
                                만료: {method.expMonth}/{method.expYear}
                              </div>
                            </div>
                            {method.isDefault && (
                              <Badge variant="secondary">기본</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCardMutation.mutate(method.id)}
                            disabled={deleteCardMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 청구 내역 탭 */}
            <TabsContent value="invoices" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>청구 내역</CardTitle>
                  <CardDescription>과거 결제 내역과 영수증을 확인하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>청구 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>청구서 번호</TableHead>
                          <TableHead>기간</TableHead>
                          <TableHead>금액</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead className="text-right">영수증</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice: any) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {/* 🛑 번호가 없으면 내부 id 조각을 대신 그리지 않는다 —
                                  `inv_backfill_…` 같은 내부 키가 화면에 뜬다.
                                  번호는 발행의 표지라, 미발행이면 빈 값 표기가 사실이다. */}
                              {invoice.number || "—"}
                            </TableCell>
                            <TableCell>
                              {new Date(invoice.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                              {new Date(invoice.periodEnd).toLocaleDateString("ko-KR")}
                            </TableCell>
                            <TableCell>
                              {invoice.amountDue?.toLocaleString("ko-KR")}원
                            </TableCell>
                            <TableCell>
                              {/* 🛑 이전 판본은 `PAID` 가 아니면 **enum 값을 그대로** 그렸다.
                                  지금까지 위조 PAID 만 만들어져 안 드러났을 뿐이고,
                                  미수 `DRAFT` 가 생기면 화면에 `DRAFT` 가 뜬다.
                                  §11.302 신호등: 미수·미발행은 **주의 = yellow**. */}
                              <Badge
                                variant={invoice.status === "PAID" ? "default" : "secondary"}
                                className={cn(
                                  invoice.status === "PAID" && "bg-green-100 text-green-700",
                                  (invoice.status === "DRAFT" || invoice.status === "OPEN") &&
                                    "bg-yellow-100 text-yellow-700 border-yellow-200"
                                )}
                              >
                                {resolveInvoiceStatusLabel(invoice.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!invoice.invoicePdfUrl}
                                onClick={() => {
                                  if (invoice.invoicePdfUrl) {
                                    window.open(invoice.invoicePdfUrl, "_blank");
                                  } else {
                                    toast({
                                      title: "영수증 다운로드",
                                      description: "PDF 영수증은 Stripe 연동 후 이용 가능합니다.",
                                    });
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                다운로드
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      /* 🛑 fallback 은 Suspense 경계 **밖**이라 여기에 `DashboardShell` 을 넣으면
         셸의 `useSearchParams()` 가 CSR bailout 으로 빌드를 깬다(2026-09-07 실측).
         화면 안의 로딩·빈 분기는 셸 안에 있다 — 여기는 그 경계가 열리기 전이다. */
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
