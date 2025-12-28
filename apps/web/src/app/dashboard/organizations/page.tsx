"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Mail, UserPlus, Trash2, FileText, Building2 } from "lucide-react";
import { useState } from "react";
import { ORGANIZATION_ROLES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
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

export default function OrganizationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 조직 목록 조회
  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create organization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const organizations = data?.organizations || [];

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/organizations");
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-6xl mx-auto">
        <PageHeader
          title="조직 관리"
          description="조직을 생성하고 팀원들을 초대하여 함께 견적을 관리합니다."
          icon={Building2}
          iconColor="text-orange-600"
          actions={
            <CreateOrganizationDialog
              onCreate={(data) => createOrgMutation.mutate(data)}
              isCreating={createOrgMutation.isPending}
            />
          }
        />

        {isLoading ? (
          <p className="text-center text-muted-foreground py-6 md:py-8 text-xs md:text-sm">로딩 중...</p>
        ) : organizations.length === 0 ? (
          <Card className="p-3 md:p-6">
            <CardContent className="px-0 pt-0 pb-0">
              <div className="text-center py-6 md:py-8">
                <Building2 className="h-8 w-8 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">소속된 조직이 없습니다</p>
                <CreateOrganizationDialog
                  onCreate={(data) => createOrgMutation.mutate(data)}
                  isCreating={createOrgMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {organizations.map((org: any) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateOrganizationDialog({
  onCreate,
  isCreating,
}: {
  onCreate: (data: { name: string; description?: string }) => void;
  isCreating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, description });
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          새 조직 만들기
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 조직 만들기</DialogTitle>
          <DialogDescription>
            조직을 생성하여 팀원들과 함께 견적을 관리하세요
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">조직명</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 서울대학교 생명과학부"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">설명 (선택사항)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="조직에 대한 설명을 입력하세요"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationCard({ organization }: { organization: any }) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("VIEWER");

  const addMemberMutation = useMutation({
    mutationFn: async (data: { userEmail: string; role: string }) => {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setMemberEmail("");
      setMemberRole("VIEWER");
      setShowAddMember(false);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(
        `/api/organizations/${organization.id}/members?memberId=${memberId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const currentUserMember = organization.members?.find(
    (m: any) => m.user?.id === session?.user?.id
  );
  const isAdmin = currentUserMember?.role === "ADMIN";
  const canManageMembers = isAdmin || currentUserMember?.role === "APPROVER";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{organization.name}</CardTitle>
            {organization.description && (
              <CardDescription className="mt-1">{organization.description}</CardDescription>
            )}
          </div>
          {isAdmin && (
            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
              관리자
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>멤버 {organization._count?.members || organization.members?.length || 0}명</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>견적 {organization._count?.quotes || 0}개</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">멤버</p>
            {canManageMembers && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(!showAddMember)}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                초대
              </Button>
            )}
          </div>

          {showAddMember && canManageMembers && (
            <div className="p-3 bg-muted rounded-lg mb-3 space-y-2">
              <Input
                placeholder="이메일 주소"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                type="email"
              />
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORGANIZATION_ROLES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    addMemberMutation.mutate({ userEmail: memberEmail, role: memberRole });
                  }}
                  disabled={addMemberMutation.isPending || !memberEmail}
                >
                  {addMemberMutation.isPending ? "초대 중..." : "초대하기"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddMember(false);
                    setMemberEmail("");
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {organization.members?.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 bg-muted rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{member.user?.name || member.user?.email}</span>
                  <span className="text-xs text-muted-foreground">
                    ({ORGANIZATION_ROLES[member.role as keyof typeof ORGANIZATION_ROLES]})
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        updateRoleMutation.mutate({ memberId: member.id, role })
                      }
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORGANIZATION_ROLES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/dashboard/organizations/${organization.id}`)}
        >
          상세 보기
        </Button>
      </CardContent>
    </Card>
  );
}