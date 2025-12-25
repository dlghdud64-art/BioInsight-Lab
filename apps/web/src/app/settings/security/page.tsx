"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, X, Mail, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { OrganizationRole } from "@prisma/client";

export default function SecuritySettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [domainInput, setDomainInput] = useState("");

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

  // 현재 사용자의 역할 확인
  const currentMembership = currentOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const isAdmin = currentMembership?.role === OrganizationRole.ADMIN;

  // 보안 설정 조회
  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ["organization-security", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { allowedEmailDomains: [] };
      const response = await fetch(`/api/organizations/${currentOrg.id}/security`);
      if (!response.ok) return { allowedEmailDomains: [] };
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  const allowedDomains = securityData?.allowedEmailDomains || [];

  // 보안 설정 저장
  const saveSecurityMutation = useMutation({
    mutationFn: async ({ organizationId, allowedEmailDomains }: { organizationId: string; allowedEmailDomains: string[] }) => {
      const response = await fetch(`/api/organizations/${organizationId}/security`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedEmailDomains }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save security settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-security", currentOrg?.id] });
      toast({
        title: "보안 설정 저장 완료",
        description: "이메일 도메인 제한이 업데이트되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addDomain = () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;

    // 도메인 형식 검증 (간단한 검증)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(domain)) {
      toast({
        title: "유효하지 않은 도메인",
        description: "올바른 도메인 형식을 입력해주세요. (예: example.com)",
        variant: "destructive",
      });
      return;
    }

    if (allowedDomains.includes(domain)) {
      toast({
        title: "이미 추가된 도메인",
        description: "이 도메인은 이미 목록에 있습니다.",
        variant: "destructive",
      });
      return;
    }

    const newDomains = [...allowedDomains, domain];
    if (currentOrg?.id) {
      saveSecurityMutation.mutate({
        organizationId: currentOrg.id,
        allowedEmailDomains: newDomains,
      });
    }
    setDomainInput("");
  };

  const removeDomain = (domain: string) => {
    const newDomains = allowedDomains.filter((d: string) => d !== domain);
    if (currentOrg?.id) {
      saveSecurityMutation.mutate({
        organizationId: currentOrg.id,
        allowedEmailDomains: newDomains,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDomain();
    }
  };

  if (status === "loading" || orgsLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">워크스페이스가 없습니다.</p>
                  <Button onClick={() => router.push("/dashboard/organizations")}>
                    워크스페이스 생성하기
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <PageHeader
                title="보안 설정"
                description="이메일 도메인 제한 및 보안 정책을 관리합니다."
                icon={Shield}
                iconColor="text-purple-600"
              />

              {/* 워크스페이스 선택 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">워크스페이스 선택</CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkspaceSwitcher
                    currentOrganizationId={selectedOrgId}
                    onOrganizationChange={setSelectedOrgId}
                    showActions={false}
                  />
                </CardContent>
              </Card>

              {currentOrg && (
                <>
                  {/* 권한 안내 */}
                  {!isAdmin && (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-yellow-100 p-2">
                            <Shield className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-yellow-900 font-medium">
                              관리자 권한이 필요합니다
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              보안 설정은 관리자만 변경할 수 있습니다.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 이메일 도메인 제한 */}
                  {isAdmin && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">허용된 이메일 도메인</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          회사 이메일 도메인만 허용하도록 설정할 수 있습니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-blue-900 font-medium mb-1">
                                이메일 도메인 제한
                              </p>
                              <p className="text-xs text-blue-700">
                                지정된 도메인의 이메일 주소만 워크스페이스에 초대할 수 있습니다.
                                예: example.com을 추가하면 user@example.com만 허용됩니다.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 도메인 입력 */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="example.com"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="flex-1"
                          />
                          <Button
                            onClick={addDomain}
                            disabled={saveSecurityMutation.isPending || !domainInput.trim()}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            추가
                          </Button>
                        </div>

                        {/* 도메인 목록 */}
                        {securityLoading ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            로딩 중...
                          </div>
                        ) : allowedDomains.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-slate-200 rounded-lg">
                            <Mail className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                            <p>허용된 도메인이 없습니다.</p>
                            <p className="text-xs mt-1">모든 이메일 도메인이 허용됩니다.</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {allowedDomains.map((domain: string) => (
                              <Badge
                                key={domain}
                                variant="secondary"
                                className="px-3 py-1 text-sm flex items-center gap-2"
                              >
                                <span>{domain}</span>
                                <button
                                  onClick={() => removeDomain(domain)}
                                  className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                  aria-label={`${domain} 제거`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



