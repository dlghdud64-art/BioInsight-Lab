"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { Shield, Key, FileText, AlertCircle, CheckCircle2, Loader2, Save, Eye, Download, Users, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function EnterpriseSettingsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // 조직 목록 조회
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = selectedOrgId
    ? organizations.find((org: any) => org.id === selectedOrgId)
    : organizations[0];

  // SSO 설정 조회
  const { data: ssoData, isLoading: ssoLoading } = useQuery({
    queryKey: ["sso-config", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const response = await fetch(`/api/organizations/${currentOrg.id}/sso`);
      if (!response.ok) throw new Error("Failed to fetch SSO config");
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  // SSO 설정 업데이트
  const ssoMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/organizations/${currentOrg.id}/sso`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update SSO config");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-config", currentOrg?.id] });
      toast({
        title: "SSO 설정 저장 완료",
        description: "SSO 설정이 성공적으로 업데이트되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "SSO 설정 저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 감사 로그 조회
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery({
    queryKey: ["audit-logs", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { logs: [], total: 0 };
      const response = await fetch(
        `/api/audit-logs?organizationId=${currentOrg.id}&limit=50`
      );
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  const auditLogs = auditLogsData?.logs || [];

  // SSO 설정 상태
  const [ssoEnabled, setSsoEnabled] = useState(ssoData?.ssoEnabled || false);
  const [ssoProvider, setSsoProvider] = useState(ssoData?.ssoProvider || "");
  const [ssoMetadataUrl, setSsoMetadataUrl] = useState(ssoData?.ssoMetadataUrl || "");
  const [ssoEntityId, setSsoEntityId] = useState(ssoData?.ssoEntityId || "");
  const [ssoCertificate, setSsoCertificate] = useState("");

  // SSO 데이터가 로드되면 상태 업데이트
  useEffect(() => {
    if (ssoData) {
      setSsoEnabled(ssoData.ssoEnabled || false);
      setSsoProvider(ssoData.ssoProvider || "");
      setSsoMetadataUrl(ssoData.ssoMetadataUrl || "");
      setSsoEntityId(ssoData.ssoEntityId || "");
    }
  }, [ssoData]);

  const handleSaveSSO = () => {
    ssoMutation.mutate({
      ssoEnabled,
      ssoProvider: ssoEnabled ? ssoProvider : null,
      ssoMetadataUrl: ssoEnabled ? ssoMetadataUrl : null,
      ssoEntityId: ssoEnabled ? ssoEntityId : null,
      ssoCertificate: ssoEnabled && ssoCertificate ? ssoCertificate : null,
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <div className="text-center py-8 md:py-12 text-xs md:text-sm">로딩 중...</div>
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
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
              <PageHeader
                title="Enterprise 설정"
                description="SSO 연동, 감사 로그, 권한 관리 등 Enterprise 기능을 설정합니다."
                icon={Shield}
                iconColor="text-purple-600"
              />

              {/* 조직 선택 */}
              {organizations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">조직 선택</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={currentOrg?.id || ""}
                      onValueChange={setSelectedOrgId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org: any) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {currentOrg && (
                <Tabs defaultValue="sso" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="sso">
                      <Key className="h-4 w-4 mr-2" />
                      SSO 설정
                    </TabsTrigger>
                    <TabsTrigger value="audit">
                      <FileText className="h-4 w-4 mr-2" />
                      감사 로그
                    </TabsTrigger>
                    <TabsTrigger value="permissions">
                      <Shield className="h-4 w-4 mr-2" />
                      권한 관리
                    </TabsTrigger>
                  </TabsList>

                  {/* SSO 설정 탭 */}
                  <TabsContent value="sso" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold">SSO (Single Sign-On) 설정</CardTitle>
                            <CardDescription>
                              조직의 SSO를 설정하여 통합 인증을 활성화합니다.
                            </CardDescription>
                          </div>
                          <Switch
                            checked={ssoEnabled}
                            onCheckedChange={setSsoEnabled}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {ssoEnabled && (
                          <>
                            <div>
                              <Label htmlFor="sso-provider">SSO 제공자</Label>
                              <Select value={ssoProvider} onValueChange={setSsoProvider}>
                                <SelectTrigger id="sso-provider">
                                  <SelectValue placeholder="SSO 제공자 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="saml">SAML 2.0</SelectItem>
                                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                                  <SelectItem value="okta">Okta</SelectItem>
                                  <SelectItem value="azure">Azure AD</SelectItem>
                                  <SelectItem value="google_workspace">Google Workspace</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {ssoProvider === "saml" && (
                              <>
                                <div>
                                  <Label htmlFor="sso-metadata-url">SAML Metadata URL</Label>
                                  <Input
                                    id="sso-metadata-url"
                                    value={ssoMetadataUrl}
                                    onChange={(e) => setSsoMetadataUrl(e.target.value)}
                                    placeholder="https://example.com/saml/metadata"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="sso-entity-id">SAML Entity ID</Label>
                                  <Input
                                    id="sso-entity-id"
                                    value={ssoEntityId}
                                    onChange={(e) => setSsoEntityId(e.target.value)}
                                    placeholder="urn:example:sp"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="sso-certificate">SAML 인증서 (선택사항)</Label>
                                  <Textarea
                                    id="sso-certificate"
                                    value={ssoCertificate}
                                    onChange={(e) => setSsoCertificate(e.target.value)}
                                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                                    rows={5}
                                  />
                                </div>
                              </>
                            )}

                            {(ssoProvider === "oauth" || ssoProvider === "okta" || ssoProvider === "azure" || ssoProvider === "google_workspace") && (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                                  <div className="text-sm text-blue-700">
                                    <p className="font-medium mb-1">OAuth 설정</p>
                                    <p>OAuth 설정은 조직 관리자에게 문의하거나 별도 설정이 필요합니다.</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveSSO}
                                disabled={ssoMutation.isPending}
                              >
                                {ssoMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    저장 중...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-2" />
                                    저장
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        )}

                        {!ssoEnabled && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                            SSO를 활성화하려면 위의 스위치를 켜주세요.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 감사 로그 탭 */}
                  <TabsContent value="audit" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold">감사 로그</CardTitle>
                            <CardDescription>
                              조직의 모든 보안 이벤트와 변경 사항을 추적합니다.
                            </CardDescription>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            내보내기
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {auditLogsLoading ? (
                          <div className="text-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                          </div>
                        ) : auditLogs.length === 0 ? (
                          <div className="text-center py-12 text-slate-500">
                            감사 로그가 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {auditLogs.map((log: any) => {
                              const eventTypeLabels: Record<string, string> = {
                                USER_LOGIN: "사용자 로그인",
                                USER_LOGOUT: "사용자 로그아웃",
                                USER_CREATED: "사용자 생성",
                                USER_UPDATED: "사용자 수정",
                                USER_DELETED: "사용자 삭제",
                                PERMISSION_CHANGED: "권한 변경",
                                SETTINGS_CHANGED: "설정 변경",
                                DATA_EXPORTED: "데이터 내보내기",
                                DATA_IMPORTED: "데이터 가져오기",
                                SSO_CONFIGURED: "SSO 설정",
                                ORGANIZATION_CREATED: "조직 생성",
                                ORGANIZATION_UPDATED: "조직 수정",
                                ORGANIZATION_DELETED: "조직 삭제",
                              };

                              return (
                                <div
                                  key={log.id}
                                  className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  <div className={`p-2 rounded-lg ${
                                    log.success
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}>
                                    {log.success ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        {eventTypeLabels[log.eventType] || log.eventType}
                                      </Badge>
                                      <span className="text-xs text-slate-500">
                                        {log.action}
                                      </span>
                                    </div>
                                    <div className="text-sm text-slate-700 mb-2">
                                      {log.user && (
                                        <span className="font-medium">{log.user.name || log.user.email}</span>
                                      )}
                                      {log.entityType && (
                                        <span className="text-slate-500 ml-2">
                                          • {log.entityType}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss", { locale: ko })}
                                    </div>
                                    {log.errorMessage && (
                                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                                        {log.errorMessage}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 권한 관리 탭 */}
                  <TabsContent value="permissions" className="space-y-4">
                    {/* 역할별 권한 설명 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">역할별 권한</CardTitle>
                        <CardDescription>
                          각 역할이 가진 권한을 확인하세요.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                          <div className="p-3 border rounded-lg">
                            <div className="font-semibold text-xs md:text-sm mb-2">VIEWER</div>
                            <ul className="text-[10px] md:text-xs text-slate-600 space-y-1">
                              <li>✓ 견적 조회</li>
                              <li>✓ 제품 검색</li>
                              <li>✓ 비교 테이블 조회</li>
                            </ul>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="font-semibold text-xs md:text-sm mb-2">REQUESTER</div>
                            <ul className="text-[10px] md:text-xs text-slate-600 space-y-1">
                              <li>✓ VIEWER 권한</li>
                              <li>✓ 견적 생성/수정</li>
                              <li>✓ 공유 링크 생성</li>
                            </ul>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <div className="font-semibold text-xs md:text-sm mb-2">APPROVER</div>
                            <ul className="text-[10px] md:text-xs text-slate-600 space-y-1">
                              <li>✓ REQUESTER 권한</li>
                              <li>✓ 견적 승인</li>
                              <li>✓ 예산 조회</li>
                            </ul>
                          </div>
                          <div className="p-3 border rounded-lg bg-purple-50">
                            <div className="font-semibold text-xs md:text-sm mb-2">ADMIN</div>
                            <ul className="text-[10px] md:text-xs text-slate-600 space-y-1">
                              <li>✓ 모든 권한</li>
                              <li>✓ 멤버 관리</li>
                              <li>✓ SSO 설정</li>
                              <li>✓ 조직 설정</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 조직 멤버 목록 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">조직 멤버 권한 관리</CardTitle>
                        <CardDescription>
                          멤버의 역할을 변경하여 권한을 관리합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <OrganizationMembersPermissions organizationId={currentOrg.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {!currentOrg && (
                <Card>
                  <CardContent className="py-12 text-center text-slate-500">
                    조직이 없습니다. 먼저 조직을 생성해주세요.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 조직 멤버 권한 관리 컴포넌트
function OrganizationMembersPermissions({ organizationId }: { organizationId: string }) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 조직 멤버 조회
  const { data: membersData, isLoading } = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!organizationId,
  });

  const members = membersData?.members || [];
  const currentUserMember = members.find((m: any) => m.user?.id === session?.user?.id);
  const isAdmin = currentUserMember?.role === "ADMIN";

  // 역할 업데이트
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      toast({
        title: "역할 변경 완료",
        description: "멤버의 역할이 성공적으로 변경되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "역할 변경 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const roleLabels: Record<string, string> = {
    VIEWER: "조회자",
    REQUESTER: "요청자",
    APPROVER: "승인자",
    ADMIN: "관리자",
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-xs md:text-sm">멤버가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs md:text-sm">멤버</TableHead>
              <TableHead className="text-xs md:text-sm">이메일</TableHead>
              <TableHead className="text-xs md:text-sm">현재 역할</TableHead>
              <TableHead className="text-xs md:text-sm text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member: any) => (
              <TableRow key={member.id}>
                <TableCell className="text-xs md:text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 md:h-4 md:w-4 text-slate-400" />
                    <span className="font-medium">{member.user?.name || "이름 없음"}</span>
                    {member.user?.id === session?.user?.id && (
                      <Badge variant="secondary" className="text-[9px] md:text-xs">본인</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs md:text-sm text-slate-600">
                  {member.user?.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={member.role === "ADMIN" ? "default" : "outline"}
                    className="text-[9px] md:text-xs"
                  >
                    {roleLabels[member.role] || member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && member.user?.id !== session?.user?.id && (
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        updateRoleMutation.mutate({ memberId: member.id, role })
                      }
                      disabled={updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {member.user?.id === session?.user?.id && (
                    <span className="text-[10px] md:text-xs text-slate-500">변경 불가</span>
                  )}
                  {!isAdmin && (
                    <span className="text-[10px] md:text-xs text-slate-500">권한 없음</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs md:text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
        <p className="font-medium mb-1">💡 참고</p>
        <ul className="list-disc list-inside space-y-1 text-[10px] md:text-xs">
          <li>관리자만 멤버의 역할을 변경할 수 있습니다.</li>
          <li>본인의 역할은 변경할 수 없습니다.</li>
          <li>멤버 초대는{" "}
            <a
              href="/dashboard/organizations"
              className="text-blue-600 hover:underline"
            >
              조직 관리 페이지
            </a>
            에서 할 수 있습니다.
          </li>
        </ul>
      </div>
    </div>
  );
}

