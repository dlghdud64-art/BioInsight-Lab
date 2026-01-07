"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Settings,
  Trash2,
  Shield,
  User,
  ArrowLeft,
} from "lucide-react";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { useToast } from "@/hooks/use-toast";
import { TeamRole } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "소유자",
  ADMIN: "관리자",
  MEMBER: "멤버",
  VIEWER: "조회자",
};

export default function TeamSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>(TeamRole.MEMBER);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // 팀 목록 조회
  const { data: teamsData, isLoading } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const teams = teamsData?.teams || [];
  const currentTeam = teams[0]; // 첫 번째 팀 사용 (향후 팀 선택 기능 추가 가능)

  // 팀 멤버 조회
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam?.id) return { members: [] };
      const response = await fetch(`/api/team/${currentTeam.id}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!currentTeam?.id && status === "authenticated",
  });

  const members = membersData?.members || [];
  const currentUserMember = members.find((m: any) => m.userId === session?.user?.id);
  const isAdmin = currentUserMember?.role === TeamRole.ADMIN || currentUserMember?.role === TeamRole.OWNER;

  // 초대 코드 생성 (간단한 토큰 기반)
  const inviteCode = currentTeam ? `TEAM-${currentTeam.id.slice(0, 8).toUpperCase()}` : null;

  // 초대 코드 복사
  const copyInviteCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(inviteCode);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "복사 완료",
        description: "초대 코드가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 멤버 초대
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: TeamRole }) => {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: currentTeam.id,
          email,
          role,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", currentTeam?.id] });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole(TeamRole.MEMBER);
      toast({
        title: "초대 완료",
        description: "멤버가 성공적으로 초대되었습니다.",
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

  // 역할 변경
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TeamRole }) => {
      // TODO: API 엔드포인트 구현 필요
      const response = await fetch(`/api/team/${currentTeam.id}/members`, {
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
      queryClient.invalidateQueries({ queryKey: ["team-members", currentTeam?.id] });
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

  // 멤버 제거
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      // TODO: API 엔드포인트 구현 필요
      const response = await fetch(`/api/team/${currentTeam.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", currentTeam?.id] });
      setShowRemoveDialog(false);
      setSelectedMember(null);
      toast({
        title: "멤버 제거 완료",
        description: "멤버가 성공적으로 제거되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "멤버 제거 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty State: 팀이 없을 때
  if (!currentTeam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="border-2 border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">아직 혼자 연구하시나요?</h2>
                <p className="text-muted-foreground mb-6">
                  팀을 만들어 동료들과 함께 연구하세요. 인벤토리를 공유하고 협업할 수 있습니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      // 팀 생성 API 호출
                      fetch("/api/team", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: `${session?.user?.name || "My"} Lab`,
                          description: "우리 랩의 공유 인벤토리",
                        }),
                      })
                        .then((res) => res.json())
                        .then(() => {
                          queryClient.invalidateQueries({ queryKey: ["user-teams"] });
                          toast({
                            title: "팀 생성 완료",
                            description: "팀이 성공적으로 생성되었습니다.",
                          });
                        })
                        .catch((error) => {
                          toast({
                            title: "팀 생성 실패",
                            description: error.message,
                            variant: "destructive",
                          });
                        });
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    팀 만들기
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/team/join")}>
                    <Users className="h-4 w-4 mr-2" />
                    팀 합류하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 pt-14">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <Link href="/dashboard/inventory">
                    <Button variant="ghost" size="sm" className="mb-2">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      돌아가기
                    </Button>
                  </Link>
                  <h1 className="text-3xl font-bold">팀 설정</h1>
                  <p className="text-muted-foreground mt-1">
                    {currentTeam.name}
                  </p>
                </div>
              </div>

              {/* 초대하기 */}
              <Card>
                <CardHeader>
                  <CardTitle>초대하기</CardTitle>
                  <CardDescription>
                    이 코드를 동료에게 공유하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={inviteCode || ""}
                      readOnly
                      className="font-mono text-lg"
                    />
                    <Button
                      onClick={copyInviteCode}
                      variant={copiedCode === inviteCode ? "default" : "outline"}
                      className="flex-shrink-0"
                    >
                      {copiedCode === inviteCode ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          복사
                        </>
                      )}
                    </Button>
                  </div>
                  <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto">
                        <UserPlus className="h-4 w-4 mr-2" />
                        이메일로 초대하기
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>멤버 초대</DialogTitle>
                        <DialogDescription>
                          이메일 주소로 팀 멤버를 초대하세요
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">이메일</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">역할</Label>
                          <Select
                            value={inviteRole}
                            onValueChange={(value) => setInviteRole(value as TeamRole)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={TeamRole.MEMBER}>멤버</SelectItem>
                              <SelectItem value={TeamRole.ADMIN}>관리자</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowInviteDialog(false)}
                            className="flex-1"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={() => {
                              if (!inviteEmail) {
                                toast({
                                  title: "이메일을 입력하세요",
                                  variant: "destructive",
                                });
                                return;
                              }
                              inviteMemberMutation.mutate({
                                email: inviteEmail,
                                role: inviteRole,
                              });
                            }}
                            disabled={inviteMemberMutation.isPending}
                            className="flex-1"
                          >
                            {inviteMemberMutation.isPending ? "초대 중..." : "초대하기"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* 멤버 리스트 */}
              <Card>
                <CardHeader>
                  <CardTitle>멤버 리스트</CardTitle>
                  <CardDescription>
                    {members.length}명의 멤버
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {membersLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">로딩 중...</p>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">멤버가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member: any) => {
                        const isCurrentUser = member.userId === session?.user?.id;
                        const canEdit = isAdmin && !isCurrentUser && member.role !== TeamRole.OWNER;
                        const canRemove = isAdmin && !isCurrentUser && member.role !== TeamRole.OWNER;

                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar>
                                <AvatarImage src={member.image || undefined} />
                                <AvatarFallback>
                                  {member.name?.[0] || member.email[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {member.name || member.email}
                                  </p>
                                  {isCurrentUser && (
                                    <Badge variant="secondary" className="text-xs">
                                      나
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEdit ? (
                                <Select
                                  value={member.role}
                                  onValueChange={(value) => {
                                    updateRoleMutation.mutate({
                                      memberId: member.id,
                                      role: value as TeamRole,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={TeamRole.MEMBER}>멤버</SelectItem>
                                    <SelectItem value={TeamRole.ADMIN}>관리자</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline">
                                  {ROLE_LABELS[member.role as TeamRole]}
                                </Badge>
                              )}
                              {canRemove && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setShowRemoveDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* 멤버 제거 확인 다이얼로그 */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버 제거</DialogTitle>
            <DialogDescription>
              정말로 {selectedMember?.name || selectedMember?.email}님을 팀에서 제거하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveDialog(false);
                setSelectedMember(null);
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedMember) {
                  removeMemberMutation.mutate(selectedMember.id);
                }
              }}
              disabled={removeMemberMutation.isPending}
              className="flex-1"
            >
              {removeMemberMutation.isPending ? "제거 중..." : "제거하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

