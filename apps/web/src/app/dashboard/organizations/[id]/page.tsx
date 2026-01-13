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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, Mail, Trash2, Loader2 } from "lucide-react";
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
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");

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

  const currentUserMember = members.find((m) => m.user?.id === session?.user?.id);
  const isAdmin = currentUserMember?.role === "ADMIN" || currentUserMember?.role === "OWNER";

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
      setIsInviteDialogOpen(false);
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
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                멤버 초대
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>멤버 초대</DialogTitle>
                <DialogDescription>
                  이메일 주소를 입력하여 새로운 멤버를 초대하세요.
                </DialogDescription>
              </DialogHeader>
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
                <div>
                  <label className="text-sm font-medium mb-2 block">이메일 주소</label>
                  <Input
                    type="email"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">권한</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">조회자</SelectItem>
                      <SelectItem value="REQUESTER">요청자</SelectItem>
                      <SelectItem value="APPROVER">승인자</SelectItem>
                      <SelectItem value="ADMIN">관리자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {inviteMemberMutation.isPending ? "초대 중..." : "초대하기"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 멤버 리스트 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>멤버 관리</CardTitle>
          <CardDescription>
            조직 멤버 목록을 확인하고 권한을 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">멤버가 없습니다.</p>
              {isAdmin && (
                <Button
                  onClick={() => setIsInviteDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  첫 멤버 초대하기
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">이름</TableHead>
                    <TableHead className="whitespace-nowrap">이메일</TableHead>
                    <TableHead className="whitespace-nowrap">권한</TableHead>
                    <TableHead className="whitespace-nowrap">상태</TableHead>
                    <TableHead className="whitespace-nowrap">가입일</TableHead>
                    {isAdmin && <TableHead className="text-right whitespace-nowrap">작업</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const statusConfig = STATUS_LABELS[member.status || "Active"] || STATUS_LABELS.Active;
                    const isCurrentUser = member.user?.id === session?.user?.id;
                    const canEdit = isAdmin && !isCurrentUser;

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={undefined} />
                              <AvatarFallback>
                                {member.user?.name?.[0] || member.user?.email?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {member.user?.name || "이름 없음"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {member.user?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[member.role] || member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant} className="text-xs">
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {format(new Date(member.createdAt), "yyyy.MM.dd", { locale: ko })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <>
                                  <Select
                                    value={member.role}
                                    onValueChange={(role) =>
                                      updateRoleMutation.mutate({ memberId: member.id, role })
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
                                    className="h-8 w-8"
                                    onClick={() => {
                                      if (confirm("정말 이 멤버를 제거하시겠습니까?")) {
                                        removeMemberMutation.mutate(member.id);
                                      }
                                    }}
                                    disabled={removeMemberMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                              {isCurrentUser && (
                                <span className="text-xs text-slate-400">본인</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

