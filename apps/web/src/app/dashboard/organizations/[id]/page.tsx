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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, UserPlus, Mail, Trash2, Loader2, Search, Users, ShieldCheck, MoreVertical, X, Send, FileText, Shield, Settings, Wallet, PauseCircle } from "lucide-react";
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
  spent?: number;
  reagentCount?: number;
  lastActive?: string;
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
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionDialogMember, setPermissionDialogMember] = useState<TeamMemberRow | null>(null);

  const openPermissionDialog = (member: TeamMemberRow) => {
    setPermissionDialogMember(member);
    setPermissionDialogOpen(true);
  };

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

  // Mock: 멤버별 최근 7일 지출액, 담당 시약 수 (추후 API 연동)
  const memberStats: Record<string, { spent: number; reagentCount: number }> = {
    "1": { spent: 4200000, reagentCount: 28 },
    "2": { spent: 1850000, reagentCount: 12 },
    "3": { spent: 0, reagentCount: 0 },
    "4": { spent: 890000, reagentCount: 7 },
  };

  // Mock: 조직 활동 로그
  const organizationLogs = [
    { id: "1", actor: "이매니저", action: "DMEM 시약을 5병 입고했습니다.", time: "10분 전" },
    { id: "2", actor: "김연구", action: "FBS 견적 요청을 제출했습니다.", time: "25분 전" },
    { id: "3", actor: "최연구원", action: "Pipette Tips 재고를 2개 등록했습니다.", time: "1시간 전" },
    { id: "4", actor: "이매니저", action: "예산 2026 상반기 시약비를 승인했습니다.", time: "2시간 전" },
    { id: "5", actor: "김연구", action: "Conical Tube 50ml을 발주했습니다.", time: "어제" },
  ];

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
        const stats = memberStats[m.id] || { spent: 0, reagentCount: 0 };
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
          spent: stats.spent,
          reagentCount: stats.reagentCount,
          lastActive: m.status === "Pending" ? "초대 대기" : "오늘",
        };
      })
    : [
        { id: "1", name: "이호영", email: "hoyoung@bioinsight.com", role: "admin" as const, initial: "HY", isMe: true, spent: 4200000, reagentCount: 28, lastActive: "오늘" },
        { id: "2", name: "김연구", email: "research.kim@bioinsight.com", role: "member" as const, initial: "KR", isMe: false, spent: 1850000, reagentCount: 12, lastActive: "25분 전" },
        { id: "3", name: "박조교", email: "ta.park@bioinsight.com", role: "member" as const, initial: "PJ", isMe: false, spent: 890000, reagentCount: 7, lastActive: "1시간 전" },
      ];

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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{organization.description}</p>
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
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">총 멤버</CardTitle>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {totalMembers}
              <span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">관리자</CardTitle>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded-full">
              <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {adminCount}
              <span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">초대 대기</CardTitle>
            <div className="bg-orange-50 dark:bg-orange-900/30 p-2 rounded-full">
              <Mail className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {pendingCount}
              <span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 초대 폼 (관리자 전용) */}
      {isAdmin && (
        <Card id="invite-form" className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg dark:text-white">새 팀원 초대</CardTitle>
            <CardDescription className="dark:text-slate-400">초대 링크가 이메일로 발송됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                inviteMemberMutation.mutate({ userEmail: inviteEmail.trim(), role: inviteRole });
              }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="colleague@univ.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-full sm:w-[180px] border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">연구원 (조회자)</SelectItem>
                  <SelectItem value="REQUESTER">요청자</SelectItem>
                  <SelectItem value="APPROVER">승인자</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={inviteMemberMutation.isPending}>
                {inviteMemberMutation.isPending ? "발송 중..." : "초대 메일 발송"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 멤버 관리 + 활동 피드 그리드 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg dark:text-white">멤버 관리 ({filteredTeamMembers.length})</h3>
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="이름, 이메일 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {filteredTeamMembers.length === 0 ? (
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 mb-4">
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
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTeamMembers.map((member) => {
                const rawMember = member.memberId ? members.find((m) => m.id === member.memberId) : null;
                const canEdit = isAdmin && !member.isMe && rawMember;
                const isPending = rawMember?.status === "Pending";

                return (
                  <Card
                    key={member.id}
                    className="hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all cursor-pointer border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <Avatar className="h-10 w-10 shrink-0 border border-slate-200 dark:border-slate-700">
                          <AvatarFallback
                            className={
                              member.role === "admin"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }
                          >
                            {member.initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-sm dark:text-white truncate">
                            {member.name}
                            {member.isMe && <span className="text-blue-600 dark:text-blue-400 font-normal ml-1">(나)</span>}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            최근 활동: {member.lastActive}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 sm:gap-8 text-right shrink-0">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">최근 7일 지출</p>
                          <p className="text-sm font-bold dark:text-blue-400">
                            ₩ {(member.spent ?? 0).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">담당 시약</p>
                          <p className="text-sm font-bold dark:text-white">{(member.reagentCount ?? 0)}개</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {ROLE_LABELS[rawMember?.role || member.rawRole || ""] || (member.role === "admin" ? "관리자" : "연구원")}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {isAdmin && canEdit && rawMember && !isPending && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="권한 수정"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPermissionDialog(member);
                                }}
                              >
                                <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="예산 할당"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({ title: "예산 할당", description: `${member.name}님에게 예산을 할당합니다. (준비 중)` });
                                }}
                              >
                                <Wallet className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="활동 일시정지"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({ title: "활동 일시정지", description: `${member.name}님의 활동을 일시정지합니다. (준비 중)` });
                                }}
                              >
                                <PauseCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              </Button>
                            </>
                          )}
                          {isAdmin && canEdit && rawMember && isPending && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                                title="초대 취소"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("정말 이 초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id);
                                }}
                                disabled={removeMemberMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                                title="초대장 재발송"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resendInviteMutation.mutate(rawMember.id);
                                }}
                                disabled={resendInviteMutation.isPending}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {isAdmin && member.isMe && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="상세 권한 설정"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPermissionDialog(member);
                                }}
                              >
                                <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              </Button>
                              <span className="text-xs text-slate-400 dark:text-slate-500">본인</span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 조직 활동 피드 */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg dark:text-white">조직 활동 피드</h3>
          <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
                {organizationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <p className="text-sm text-slate-900 dark:text-white">
                      <span className="font-semibold">{log.actor}</span>님이 {log.action}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 상세 권한 설정 팝업 */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">상세 권한 설정</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {permissionDialogMember?.name}님의 조직 내 권한을 설정합니다.
            </DialogDescription>
          </DialogHeader>
          {permissionDialogMember && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {permissionDialogMember.initial}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold dark:text-white">{permissionDialogMember.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{permissionDialogMember.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-slate-300">역할</label>
                <Select
                  value={permissionDialogMember.rawRole || "VIEWER"}
                  onValueChange={(v) => {
                    const raw = permissionDialogMember.memberId ? members.find((m) => m.id === permissionDialogMember.memberId) : null;
                    if (raw) updateRoleMutation.mutate({ memberId: raw.id, role: v });
                    setPermissionDialogOpen(false);
                  }}
                >
                  <SelectTrigger className="border-slate-200 dark:border-slate-700">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

