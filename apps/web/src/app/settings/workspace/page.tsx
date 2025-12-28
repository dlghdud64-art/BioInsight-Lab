"use client";

export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Copy, Check, Clock, UserPlus, Trash2, Building2, MoreVertical, Shield, Mail, Info, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useToast } from "@/hooks/use-toast";
import { OrganizationRole } from "@prisma/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function WorkspaceSettingsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "delete" | "roleChange" | null;
    memberId?: string;
    memberName?: string;
    newRole?: OrganizationRole;
  }>({ open: false, type: null });
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

  // 멤버 목록 조회
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["organization-members", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { members: [] };
      const response = await fetch(`/api/organizations/${currentOrg.id}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!currentOrg?.id && status === "authenticated",
  });

  const members = membersData?.members || [];

  // 초대 링크 생성 API 호출
  const createInviteLinkMutation = useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      const response = await fetch(`/api/organizations/${organizationId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInDays: 7, // 7일 후 만료
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create invite link");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organization-invites", currentOrg?.id] });
      toast({
        title: "초대 링크 생성 완료",
        description: "링크가 생성되었습니다. 복사하여 공유하세요.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "초대 링크 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 초대 링크 조회
  const { data: invitesData } = useQuery({
    queryKey: ["organization-invites", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { invites: [] };
      const response = await fetch(`/api/organizations/${currentOrg.id}/invites`);
      if (!response.ok) return { invites: [] };
      return response.json();
    },
    enabled: !!currentOrg?.id && isAdmin && status === "authenticated",
  });

  const invites = invitesData?.invites || [];
  const activeInvite = invites.find((inv: any) => !inv.used && (!inv.expiresAt || new Date(inv.expiresAt) > new Date()));

  // 링크 복사
  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(token);
    toast({
      title: "링크 복사됨",
      description: "초대 링크가 클립보드에 복사되었습니다.",
    });
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // 초대 링크 생성
  const handleCreateInviteLink = () => {
    if (!currentOrg?.id) return;
    createInviteLinkMutation.mutate({ organizationId: currentOrg.id });
  };

  // 멤버 역할 변경
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrganizationRole }) => {
      const response = await fetch(`/api/organizations/${currentOrg.id}/members`, {
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
      queryClient.invalidateQueries({ queryKey: ["organization-members", currentOrg?.id] });
      toast({
        title: "역할 변경 완료",
        description: "멤버의 역할이 성공적으로 변경되었습니다.",
      });
      setConfirmDialog({ open: false, type: null });
    },
    onError: (error: Error) => {
      toast({
        title: "역할 변경 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 멤버 삭제
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(
        `/api/organizations/${currentOrg.id}/members?memberId=${memberId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", currentOrg?.id] });
      toast({
        title: "멤버 삭제 완료",
        description: "멤버가 성공적으로 제거되었습니다.",
      });
      setConfirmDialog({ open: false, type: null });
    },
    onError: (error: Error) => {
      toast({
        title: "멤버 삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (memberId: string, memberName: string, newRole: OrganizationRole) => {
    setConfirmDialog({
      open: true,
      type: "roleChange",
      memberId,
      memberName,
      newRole,
    });
  };

  const handleDeleteMember = (memberId: string, memberName: string) => {
    setConfirmDialog({
      open: true,
      type: "delete",
      memberId,
      memberName,
    });
  };

  const confirmAction = () => {
    if (confirmDialog.type === "roleChange" && confirmDialog.memberId && confirmDialog.newRole) {
      updateRoleMutation.mutate({
        memberId: confirmDialog.memberId,
        role: confirmDialog.newRole,
      });
    } else if (confirmDialog.type === "delete" && confirmDialog.memberId) {
      deleteMemberMutation.mutate(confirmDialog.memberId);
    }
  };

  // 역할 표시 이름 매핑
  const getRoleLabel = (role: OrganizationRole) => {
    const roleMap: Record<OrganizationRole, string> = {
      [OrganizationRole.ADMIN]: "admin",
      [OrganizationRole.APPROVER]: "purchaser",
      [OrganizationRole.REQUESTER]: "member",
      [OrganizationRole.VIEWER]: "safety_admin",
    };
    return roleMap[role] || role;
  };

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

    // 도메인 형식 검증
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
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
              <div className="flex items-center justify-between">
                <PageHeader
                  title="워크스페이스 설정"
                  description="멤버를 관리하고 초대 링크를 생성합니다."
                  icon={Building2}
                  iconColor="text-blue-600"
                />
              </div>

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
                            <Users className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-yellow-900 font-medium">
                              관리자 권한이 필요합니다
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              멤버 초대 및 워크스페이스 설정은 관리자만 가능합니다.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 탭 구조 */}
                  {isAdmin && (
                    <Tabs defaultValue="members" className="space-y-4">
                      <TabsList>
                        <TabsTrigger value="members">
                          <Users className="h-4 w-4 mr-2" />
                          멤버
                        </TabsTrigger>
                        <TabsTrigger value="security">
                          <Shield className="h-4 w-4 mr-2" />
                          보안
                        </TabsTrigger>
                      </TabsList>

                      {/* 멤버 탭 */}
                      <TabsContent value="members" className="space-y-6">
                        {/* 멤버 리스트 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">멤버 목록</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            현재 {members.length}명의 멤버가 있습니다.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {membersLoading ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          로딩 중...
                        </div>
                      ) : members.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          멤버가 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {members.map((member: any) => {
                            const isCurrentUser = member.userId === session?.user?.id;
                            const canEdit = isAdmin && !isCurrentUser;

                            return (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-slate-500" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {member.user?.name || member.user?.email || "알 수 없음"}
                                      {isCurrentUser && (
                                        <span className="text-xs text-muted-foreground ml-2">(나)</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {member.user?.email}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {canEdit ? (
                                    <Select
                                      value={member.role}
                                      onValueChange={(value) =>
                                        handleRoleChange(
                                          member.id,
                                          member.user?.name || member.user?.email || "멤버",
                                          value as OrganizationRole
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={OrganizationRole.ADMIN}>
                                          admin
                                        </SelectItem>
                                        <SelectItem value={OrganizationRole.APPROVER}>
                                          purchaser
                                        </SelectItem>
                                        <SelectItem value={OrganizationRole.REQUESTER}>
                                          member
                                        </SelectItem>
                                        <SelectItem value={OrganizationRole.VIEWER}>
                                          safety_admin
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge
                                      variant={
                                        member.role === OrganizationRole.ADMIN
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {getRoleLabel(member.role)}
                                    </Badge>
                                  )}
                                  {canEdit && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() =>
                                            handleDeleteMember(
                                              member.id,
                                              member.user?.name || member.user?.email || "멤버"
                                            )
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          멤버 제거
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                        {/* 초대 링크 */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold">초대 링크</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              초대 링크를 생성하여 팀원을 초대할 수 있습니다.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {activeInvite ? (
                              <div className="space-y-3">
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Check className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-900">
                                          활성 초대 링크
                                        </span>
                                      </div>
                                      <p className="text-xs text-blue-700 mb-3">
                                        {activeInvite.expiresAt
                                          ? `만료일: ${new Date(activeInvite.expiresAt).toLocaleDateString("ko-KR")}`
                                          : "만료 없음"}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${activeInvite.token}`}
                                          readOnly
                                          className="text-xs font-mono"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => copyInviteLink(activeInvite.token)}
                                        >
                                          {copiedLink === activeInvite.token ? (
                                            <Check className="h-4 w-4" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={handleCreateInviteLink}
                                  disabled={createInviteLinkMutation.isPending}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  새 초대 링크 생성
                                </Button>
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <p className="text-sm text-muted-foreground mb-4">
                                  활성 초대 링크가 없습니다.
                                </p>
                                <Button
                                  onClick={handleCreateInviteLink}
                                  disabled={createInviteLinkMutation.isPending}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  초대 링크 생성
                                </Button>
                              </div>
                            )}
                            <div className="pt-3 border-t border-slate-200">
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                초대 링크는 기본적으로 7일 후 만료됩니다.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* 보안 탭 */}
                      <TabsContent value="security" className="space-y-6">
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
                      </TabsContent>
                    </Tabs>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog({ ...confirmDialog, open })
        }
        title={
          confirmDialog.type === "delete"
            ? "멤버 제거 확인"
            : confirmDialog.type === "roleChange"
            ? "역할 변경 확인"
            : ""
        }
        description={
          confirmDialog.type === "delete"
            ? `정말로 "${confirmDialog.memberName}" 멤버를 제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
            : confirmDialog.type === "roleChange"
            ? `"${confirmDialog.memberName}"의 역할을 "${confirmDialog.newRole ? getRoleLabel(confirmDialog.newRole) : ""}"로 변경하시겠습니까?`
            : ""
        }
        confirmText={confirmDialog.type === "delete" ? "제거" : "변경"}
        variant={confirmDialog.type === "delete" ? "destructive" : "default"}
        onConfirm={confirmAction}
      />
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WorkspaceSettingsPageContent />
    </Suspense>
  );
}

