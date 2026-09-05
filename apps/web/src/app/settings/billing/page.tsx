"use client";

export const dynamic = 'force-dynamic';

import { csrfFetch } from "@/lib/api-client";
import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, CreditCard, Zap, Loader2, ExternalLink } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionPlan, PLAN_LIMITS, PLAN_DISPLAY } from "@/lib/plans";
import { useActiveOrganization } from "@/hooks/use-active-organization";

function BillingPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  // 사용자의 조직 목록 조회
  const { data: organizationsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const { organizationId: activeOrganizationId, isLoading: activeOrgLoading } =
    useActiveOrganization();
  const organizations = organizationsData?.organizations || [];
  /* §invite-flow Phase 2-9 — 사용자가 고르지 않았을 때의 기본값은 "첫 조직" 이 아니라
   * **활성 조직**이다. 이 화면은 WorkspaceSwitcher 로 조직을 **표시**하므로, 보여주는 값이
   * 서버 판정과 어긋나면 그게 곧 "화면이 보여준 조직 != 적용된 조직" 이다.
   * 🔑 `organizations[0]` 을 fallback 으로도 남기지 않는다 — 남기면 활성 조직 로딩 중에
   *    첫 조직이 잠깐 보였다가 바뀌는 flash 가 생기고, 그 순간 사용자는 틀린 조직을 본다.
   *    대신 아래 로딩 가드에 `activeOrgLoading` 을 넣어 결정될 때까지 기다린다. */
  const effectiveOrgId = selectedOrgId || activeOrganizationId || "";
  const currentOrg =
    organizations.find((org: any) => org.id === effectiveOrgId) ?? null;

  // 현재 조직의 구독 정보 조회
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["organization-subscription", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const response = await fetch(`/api/organizations/${currentOrg.id}/subscription`);
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
    enabled: !!currentOrg?.id,
  });

  const plan = (subscriptionData?.plan as SubscriptionPlan) || SubscriptionPlan.FREE;
  const billingStatus = subscriptionData?.billingStatus || null;
  const limits = PLAN_LIMITS[plan];

  // 업그레이드 처리
  const handleUpgrade = async (targetPlan: SubscriptionPlan) => {
    if (!currentOrg?.id) return;

    try {
      setIsUpgrading(true);
      const response = await csrfFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentOrg.id,
          plan: targetPlan,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      /* §checkout-two-paths (2026-09-05) — **사유를 말한다.**
       * prod 실측: `/api/health` → `billing.stripeConfigured: false`
       * (`hasTeamPriceId` · `hasWebhookSecret` 도 false). 즉 이 경로는 키가 없어
       * **호출 시점에 반드시 실패**한다 — `billing/checkout` 이 키 부재 시
       * `sk_test_placeholder_will_fail` 로 기동하기 때문에 실패가 여기서만 드러난다.
       * "프로세스를 시작할 수 없습니다" 는 사실이지만 **원인을 말하지 않아**
       * 사용자가 자기 문제(카드·네트워크)로 읽는다.
       * 🛑 문구를 health 실측값에 배선하지 않는다 — 화면이 매 렌더마다 health 를 부르면
       *   그게 새 결합이다(호영님 지시). 결제가 배선되면 이 문구도 함께 바뀌고,
       *   그 순서는 `regression/checkout-two-paths.test.ts` 가 지킨다. */
      toast({
        title: "결제 연동 준비 중입니다",
        description:
          "아직 카드 결제를 받을 수 없습니다 · 플랜 변경이 필요하시면 문의해 주세요.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  // 결제 관리 포털
  const handleManageBilling = async () => {
    if (!currentOrg?.id) return;

    try {
      setIsManaging(true);
      const response = await csrfFetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentOrg.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to create portal session");

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "결제 관리 포털을 열 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsManaging(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      ACTIVE: { label: "활성", variant: "default" },
      TRIALING: { label: "체험 중", variant: "secondary" },
      PAST_DUE: { label: "연체", variant: "destructive" },
      CANCELED: { label: "취소됨", variant: "secondary" },
    };

    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlanBadge = (planType: SubscriptionPlan) => {
    const config = {
      [SubscriptionPlan.FREE]: { label: PLAN_DISPLAY[SubscriptionPlan.FREE].displayName, color: "bg-el text-slate-200" },
      [SubscriptionPlan.TEAM]: { label: PLAN_DISPLAY[SubscriptionPlan.TEAM].displayName, color: "bg-blue-100 text-blue-800" },
      [SubscriptionPlan.ORGANIZATION]: { label: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].displayName, color: "bg-indigo-100 text-indigo-800" },
    };
    const { label, color } = config[planType];
    return <Badge className={color}>{label}</Badge>;
  };

  if (status === "loading" || orgsLoading || activeOrgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session || !currentOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>조직을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pg">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1">
          <PageHeader
            title="플랜 및 결제"
            description="현재 플랜을 확인하고 업그레이드하세요."
          />
          <div className="p-6 space-y-6 max-w-6xl">
            {/* 조직 선택 */}
            {organizations.length > 1 && (
              <div className="mb-4">
                <WorkspaceSwitcher
                  currentOrganizationId={currentOrg.id}
                  onOrganizationChange={(id: string) => {
                    setSelectedOrgId(id);
                    router.push(`/settings/billing?org=${id}`);
                  }}
                />
              </div>
            )}

            {/* 현재 플랜 - 리스트 스타일 */}
            <div className="bg-pn border border-bd shadow-sm">
              <div className="border-b border-bd px-4 py-3">
                <h2 className="font-semibold text-slate-100">현재 플랜</h2>
                <p className="text-sm text-slate-600 mt-1">{currentOrg.name}</p>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getPlanBadge(plan)}
                    {billingStatus && getStatusBadge(billingStatus)}
                  </div>
                  <div className="flex gap-2">
                    {plan === SubscriptionPlan.FREE && (
                      <Button
                        onClick={() => handleUpgrade(SubscriptionPlan.TEAM)}
                        disabled={isUpgrading}
                        size="sm"
                      >
                        {isUpgrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Team으로 업그레이드
                          </>
                        )}
                      </Button>
                    )}
                    {plan !== SubscriptionPlan.FREE && (
                      <Button
                        variant="outline"
                        onClick={handleManageBilling}
                        disabled={isManaging}
                        size="sm"
                      >
                        {isManaging ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            결제 관리
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* 플랜 제한 - 테이블 스타일 */}
                <div className="border-t border-bd pt-4">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium p-3">멤버 수</TableCell>
                        <TableCell className="p-3 text-right">{limits.maxMembers || "무제한"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium p-3">월 견적 요청</TableCell>
                        <TableCell className="p-3 text-right">{limits.maxQuotesPerMonth || "무제한"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium p-3">공유 링크</TableCell>
                        <TableCell className="p-3 text-right">{limits.maxSharedLinks || "무제한"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* 기능 비교 */}
            <div className="bg-pn border border-bd shadow-sm">
              <div className="border-b border-bd px-4 py-3">
                <h2 className="font-semibold text-slate-100">플랜별 기능</h2>
                <p className="text-sm text-slate-600 mt-1">각 플랜에서 사용할 수 있는 기능을 확인하세요.</p>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2 p-3">기능</TableHead>
                      <TableHead className="text-center p-3">Starter</TableHead>
                      <TableHead className="text-center p-3">Team</TableHead>
                      <TableHead className="text-center p-3">Business</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium p-3">Export Pack (구매팀 제출용)</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">인바운드 이메일</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">고급 리포트</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">예산 관리</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">자동 재주문</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">벤더 포털</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">SSO 인증</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium p-3">우선 지원</TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.FREE.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.TEAM.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center p-3">
                        {PLAN_LIMITS.ORGANIZATION.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 업그레이드 안내 */}
            {plan !== SubscriptionPlan.ORGANIZATION && (
              <div className="bg-blue-50 border border-blue-200 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base mb-1">
                      {plan === SubscriptionPlan.FREE ? "Team 플랜으로 업그레이드" : "Business 플랜으로 업그레이드"}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {plan === SubscriptionPlan.FREE
                        ? "팀원 공유 재고, 구매 요청 워크플로우 등 협업 기능을 사용하세요."
                        : "무제한 멤버, 전자결재 승인 라인, 예산 통합 관리 등 조직 운영 기능을 사용하세요."}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleUpgrade(
                      plan === SubscriptionPlan.FREE 
                        ? SubscriptionPlan.TEAM 
                        : SubscriptionPlan.ORGANIZATION
                    )}
                    disabled={isUpgrading}
                    size="sm"
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "업그레이드"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BillingPageContent />
    </Suspense>
  );
}

