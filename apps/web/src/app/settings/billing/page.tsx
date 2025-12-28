"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, CreditCard, Zap, Loader2, ExternalLink } from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionPlan, PLAN_LIMITS } from "@/lib/plans";

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

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations.find((org: any) => 
    org.id === selectedOrgId || (!selectedOrgId && org.id)
  ) || organizations[0];

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
      const response = await fetch("/api/billing/checkout", {
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
      console.error("Upgrade error:", error);
      toast({
        title: "오류",
        description: "업그레이드 프로세스를 시작할 수 없습니다.",
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
      const response = await fetch("/api/billing/portal", {
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
      console.error("Portal error:", error);
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
      [SubscriptionPlan.FREE]: { label: "Free", color: "bg-gray-100 text-gray-800" },
      [SubscriptionPlan.TEAM]: { label: "Team", color: "bg-blue-100 text-blue-800" },
      [SubscriptionPlan.ORGANIZATION]: { label: "Organization", color: "bg-purple-100 text-purple-800" },
    };
    const { label, color } = config[planType];
    return <Badge className={color}>{label}</Badge>;
  };

  if (status === "loading" || orgsLoading) {
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
    <div className="min-h-screen bg-slate-50">
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
              <WorkspaceSwitcher
                value={currentOrg.id}
                onValueChange={(id) => {
                  setSelectedOrgId(id);
                  router.push(`/settings/billing?org=${id}`);
                }}
              />
            )}

            {/* 현재 플랜 */}
            <Card>
              <CardHeader>
                <CardTitle>현재 플랜</CardTitle>
                <CardDescription>
                  {currentOrg.name}의 구독 상태
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold">
                      {getPlanBadge(plan)}
                    </div>
                    {billingStatus && getStatusBadge(billingStatus)}
                  </div>
                  <div className="flex gap-2">
                    {plan === SubscriptionPlan.FREE && (
                      <Button
                        onClick={() => handleUpgrade(SubscriptionPlan.TEAM)}
                        disabled={isUpgrading}
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

                {/* 플랜 제한 표시 */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">멤버 수</div>
                    <div className="text-xl font-semibold">
                      {limits.maxMembers || "무제한"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">월 견적 요청</div>
                    <div className="text-xl font-semibold">
                      {limits.maxQuotesPerMonth || "무제한"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">공유 링크</div>
                    <div className="text-xl font-semibold">
                      {limits.maxSharedLinks || "무제한"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 기능 비교 */}
            <Card>
              <CardHeader>
                <CardTitle>플랜별 기능</CardTitle>
                <CardDescription>
                  각 플랜에서 사용할 수 있는 기능을 확인하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">기능</TableHead>
                      <TableHead className="text-center">Free</TableHead>
                      <TableHead className="text-center">Team</TableHead>
                      <TableHead className="text-center">Organization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Export Pack (구매팀 제출용)</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.exportPack ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">인바운드 이메일</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.inboundEmail ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">고급 리포트</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.advancedReports ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">예산 관리</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.budgetManagement ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">자동 재주문</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.autoReorder ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">벤더 포털</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.vendorPortal ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">SSO 인증</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.sso ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">우선 지원</TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.FREE.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.TEAM.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {PLAN_LIMITS.ORGANIZATION.features.prioritySupport ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 업그레이드 안내 */}
            {plan !== SubscriptionPlan.ORGANIZATION && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        {plan === SubscriptionPlan.FREE ? "Team 플랜으로 업그레이드" : "Organization 플랜으로 업그레이드"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {plan === SubscriptionPlan.FREE 
                          ? "더 많은 멤버와 견적 요청, 고급 기능을 사용하세요."
                          : "무제한 멤버, 벤더 포털, SSO 등 엔터프라이즈 기능을 사용하세요."}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleUpgrade(
                        plan === SubscriptionPlan.FREE 
                          ? SubscriptionPlan.TEAM 
                          : SubscriptionPlan.ORGANIZATION
                      )}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "업그레이드"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
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

