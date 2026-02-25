"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, UserPlus, Mail, Trash2, Loader2, Search, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// 역할 라벨 매핑
const ROLE_LABELS: Record<string, string> = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
  OWNER: "소유자",
  MEMBER: "멤버",
};

// 팀원 리스트용 플랫 데이터 타입 (동적 매핑 / 추후 API 데이터로 대체)
interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  initial: string;
  isMe: boolean;
  memberId?: string;
  rawRole?: string;
  status?: string;
}

// 상태 라벨 매핑
const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Active: { label: "활성", variant: "default" },
  Pending: { label: "대기중", variant: "secondary" },
  Inactive: { label: "비활성", variant: "outline" },
};

interface Member {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  role: string;
  status?: string;
  createdAt: string;
}

export default function OrganizationDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // 조직 정보 조회 (조직 목록에서 필터링)
  const { data: orgsData, isLoading: orgLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
  });

  const organization = orgsData?.organizations?.find((org: any) => org.id === params.id) || {
    id: params.id,
    name: "BioInsight Lab",
    description: "메인 연구소",
  };

  // 멤버 목록 조회
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["organization-members", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${params.id}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
  });

  // Mock Data (실제 API 데이터가 없을 때 사용)
  const mockMembers: Member[] = [
    {
      id: "1",
      user: { id: "1", name: "김연구", email: "kim@lab.com" },
      role: "ADMIN",
      status: "Active",
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      user: { id: "2", name: "이매니저", email: "lee@lab.com" },
      role: "APPROVER",
      status: "Active",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      user: { id: "3", name: "박인턴", email: "park@lab.com" },
      role: "VIEWER",
      status: "Pending",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4",
      user: { id: "4", name: "최연구원", email: "choi@lab.com" },
      role: "REQUESTER",
      status: "Active",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];


  const members: Member[] = membersData?.members?.length > 0 
    ? membersData.members.map((m: any) => ({
        ...m,
        status: m.status || "Active",
      }))
    : mockMembers;

  // 팀원 데이터 배열 (API 멤버 → 플랫 구조 매핑, 없으면 가상 데이터 사용)
  const teamMembers: TeamMemberRow[] = members.length > 0
    ? members.map((m) => {
        const name = m.user?.name || "이름 없음";
        const email = m.user?.email || "";
        const initial =
          name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ||
          email.slice(0, 2).toUpperCase() ||
          "?";
        const isAdminRole = m.role === "ADMIN" || m.role === "OWNER";
        return {
          id: m.id,
          name,
          email,
          role: isAdminRole ? "admin" : "member",
          initial,
          isMe: m.user?.id === session?.user?.id,
          memberId: m.id,
          rawRole: m.role,
          status: m.status,
        };
      })
    : [
        { id: "1", name: "이호영", email: "hoyoung@bioinsight.com", role: "admin" as const, initial: "HY", isMe: true },
        { id: "2", name: "김연구", email: "research.kim@bioinsight.com", role: "member" as const, initial: "KR", isMe: false },
        { id: "3", name: "박조교", email: "ta.park@bioinsight.com", role: "member" as const, initial: "PJ", isMe: false },
      ];

  // 권한에 따라 뱃지를 자동으로 반환하는 헬퍼
  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge variant="outline" dot="purple" className="border-purple-200 bg-purple-50 text-purple-700">
          관리자
        </Badge>
      );
    }
    return (
      <Badge variant="outline" dot="slate" className="border-slate-200 bg-slate-100 text-slate-600">
        연구원
      </Badge>
    );
  };

  const currentUserMember = members.find((m) => m.user?.id === session?.user?.id);
  const isAdmin = currentUserMember?.role === "ADMIN" || currentUserMember?.role === "OWNER";

  // 통계 계산
  const totalMembers = members.length;
  const adminCount = members.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length;
  const pendingCount = members.filter((m) => m.status === "Pending").length;

  // 필터링된 멤버 (members 기반, mutations용)
  const filteredMembers = members.filter((member) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        member.user?.name?.toLowerCase().includes(query) ||
        member.user?.email?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (roleFilter !== "all") {
      if (roleFilter === "admin" && member.role !== "ADMIN" && member.role !== "OWNER") return false;
      if (roleFilter === "member" && (member.role === "ADMIN" || member.role === "OWNER")) return false;
      if (roleFilter !== "admin" && roleFilter !== "member" && member.role !== roleFilter) return false;
    }
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    return true;
  });

  // 팀원 리스트용 필터 (teamMembers 기반, 검색만 적용)
  const filteredTeamMembers = teamMembers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  // 초대 재발송 Mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/organizations/${params.id}/members/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!response.ok) throw new Error("Failed to resend invite");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      toast({
        title: "초대 재발송 완료",
        description: "초대 이메일이 재발송되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "재발송 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 멤버 초대 Mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { userEmail: string; role: string }) => {
      const response = await fetch(`/api/organizations/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      setInviteEmail("");
      setInviteRole("VIEWER");
      toast({
        title: "초대 완료",
        description: "멤버 초대가 완료되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "초대 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 역할 변경 Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/organizations/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      toast({
        title: "역할 변경 완료",
        description: "멤버의 역할이 성공적으로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "역할 변경 실패",
        description: "역할 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 멤버 제거 Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(
        `/api/organizations/${params.id}/members?memberId=${memberId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      toast({
        title: "멤버 제거 완료",
        description: "멤버가 성공적으로 제거되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "멤버 제거 실패",
        description: "멤버 제거에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  if (orgLoading || membersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organizations">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-sm text-slate-500 mt-1">{organization.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
            <Link href="#invite-form">
              <UserPlus className="h-4 w-4 mr-2" />
              멤버 초대
            </Link>
          </Button>
        )}
      </div>

      {/* 멤버 요약 KPI 카드 */}
      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">총 멤버</CardTitle>
            <div className="bg-blue-50 p-2 rounded-full">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {totalMembers}
              <span className="text-lg font-normal text-slate-500 ml-1">명</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">관리자</CardTitle>
            <div className="bg-purple-50 p-2 rounded-full">
              <Shield className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {adminCount}
              <span className="text-lg font-normal text-slate-500 ml-1">명</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">초대 대기</CardTitle>
            <div className="bg-orange-50 p-2 rounded-full">
              <Mail className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {pendingCount}
              <span className="text-lg font-normal text-slate-500 ml-1">명</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 좌측: 초대 폼 | 우측: 팀원 리스트 (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 좌측: 새 팀원 초대 폼 */}
        {isAdmin && (
          <Card id="invite-form" className="md:col-span-1 shadow-sm h-fit border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">새 팀원 초대</CardTitle>
              <CardDescription>초대 링크가 이메일로 발송됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inviteEmail.trim()) return;
                  inviteMemberMutation.mutate({
                    userEmail: inviteEmail.trim(),
                    role: inviteRole,
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">이메일 주소</label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      className="pl-9"
                      placeholder="colleague@univ.edu"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">부여할 권한</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="h-10 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">연구원 (조회자)</SelectItem>
                      <SelectItem value="REQUESTER">요청자</SelectItem>
                      <SelectItem value="APPROVER">승인자</SelectItem>
                      <SelectItem value="ADMIN">관리자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={inviteMemberMutation.isPending}
                >
                  {inviteMemberMutation.isPending ? "발송 중..." : "초대 메일 발송하기"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 우측: 팀원 리스트 */}
        <Card className={`${isAdmin ? "md:col-span-2" : "md:col-span-3"} shadow-sm border-slate-200`}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">현재 소속 팀원 ({teamMembers.length}명)</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="이름, 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredTeamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">
                  {teamMembers.length === 0 ? "멤버가 없습니다." : "검색 조건에 맞는 멤버가 없습니다."}
                </p>
                {isAdmin && teamMembers.length === 0 && (
                  <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="#invite-form">
                      <UserPlus className="h-4 w-4 mr-2" />
                      첫 멤버 초대하기
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              filteredTeamMembers.map((member) => {
                const rawMember = member.memberId ? members.find((m) => m.id === member.memberId) : null;
                const canEdit = isAdmin && !member.isMe && rawMember;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-full font-bold flex items-center justify-center shrink-0 ${
                          member.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {member.initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {member.name}
                          {member.isMe && <span className="text-blue-600 font-normal ml-1">(나)</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {getRoleBadge(member.role)}
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          {canEdit && rawMember && (
                            <>
                              {rawMember.status === "Pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => resendInviteMutation.mutate(rawMember.id)}
                                  disabled={resendInviteMutation.isPending}
                                  title="초대 재발송"
                                >
                                  재발송
                                </Button>
                              )}
                              <Select
                                value={rawMember.role}
                                onValueChange={(role) =>
                                  updateRoleMutation.mutate({ memberId: rawMember.id, role })
                                }
                                disabled={updateRoleMutation.isPending}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIEWER">조회자</SelectItem>
                                  <SelectItem value="REQUESTER">요청자</SelectItem>
                                  <SelectItem value="APPROVER">승인자</SelectItem>
                                  <SelectItem value="ADMIN">관리자</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-700"
                                onClick={() => {
                                  if (confirm("정말 이 멤버를 제거하시겠습니까?")) {
                                    removeMemberMutation.mutate(rawMember.id);
                                  }
                                }}
                                disabled={removeMemberMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {member.isMe && <span className="text-xs text-slate-400">본인</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

