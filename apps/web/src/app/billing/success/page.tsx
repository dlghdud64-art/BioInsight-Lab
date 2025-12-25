"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Users, ArrowRight, FileText, DollarSign } from "lucide-react";
import Link from "next/link";
import { MainHeader } from "@/app/_components/main-header";
import { MainLayout } from "@/app/_components/main-layout";
import { MainFooter } from "@/app/_components/main-footer";
import { SubscriptionPlan } from "@/lib/plans";

export default function BillingSuccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organization_id");
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // 현재 조직 정보 조회
  const { data: organizationData, isLoading } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const response = await fetch(`/api/organizations/${organizationId}/subscription`);
      if (!response.ok) throw new Error("Failed to fetch organization");
      return response.json();
    },
    enabled: !!organizationId && status === "authenticated",
  });

  // 구독 상태 확인 (TEAM 활성화 여부)
  useEffect(() => {
    if (organizationData?.organization) {
      const plan = organizationData.organization.plan;
      const subscription = organizationData.subscription;
      
      // TEAM 플랜이고 구독이 활성화되어 있으면 확인 완료
      if (plan === SubscriptionPlan.TEAM || plan === SubscriptionPlan.ORGANIZATION) {
        if (subscription?.status === "active") {
          setIsCheckingStatus(false);
        } else {
          // 구독 정보가 아직 업데이트되지 않았을 수 있으므로 잠시 대기
          setTimeout(() => {
            setIsCheckingStatus(false);
          }, 2000);
        }
      } else {
        setIsCheckingStatus(false);
      }
    }
  }, [organizationData]);

  const organization = organizationData?.organization;
  const isTeamActive = organization?.plan === SubscriptionPlan.TEAM || organization?.plan === SubscriptionPlan.ORGANIZATION;

  if (status === "loading" || isLoading) {
    return (
      <MainLayout>
        <MainHeader />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-muted-foreground mt-4">로딩 중...</p>
          </div>
        </div>
        <MainFooter />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-900">
                업그레이드 완료
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {organization ? (
                  <>
                    <span className="font-semibold text-slate-900">{organization.name}</span> 워크스페이스가 성공적으로 업그레이드되었습니다.
                  </>
                ) : (
                  "결제가 완료되었습니다."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 구독 상태 확인 중 */}
              {isCheckingStatus ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    구독 상태를 확인하는 중...
                  </p>
                </div>
              ) : (
                <>
                  {/* TEAM 활성화 안내 */}
                  {isTeamActive && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-blue-900 mb-1">
                            TEAM 플랜이 활성화되었습니다!
                          </h3>
                          <p className="text-sm text-blue-700">
                            이제 팀원을 초대하고 협업 기능을 사용할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 다음 액션 카드 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900">다음 단계</h3>
                    <div className="grid gap-3">
                      <Link href="/dashboard">
                        <Button className="w-full justify-between" size="lg">
                          <span>대시보드로 이동</span>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      {isTeamActive && (
                        <Link href="/settings/workspace">
                          <Button variant="outline" className="w-full justify-between" size="lg">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>멤버 초대하기</span>
                            </div>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* 추가 정보 */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <Link href="/dashboard/budget" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
                        <DollarSign className="h-4 w-4" />
                        <span>구매내역/예산 보기</span>
                      </Link>
                      <Link href="/dashboard/settings/plans" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
                        <FileText className="h-4 w-4" />
                        <span>구독 관리</span>
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}



