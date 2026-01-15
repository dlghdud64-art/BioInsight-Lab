"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Mail, UserPlus, Trash2, FileText, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ORGANIZATION_ROLES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  // 로컬 상태로 조직 목록 관리
  const [organizations, setOrganizations] = useState<any[]>([
    { id: 1, name: "BioInsight Lab", description: "메인 연구소", members: [], _count: { members: 12, quotes: 5 } },
  ]);

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

  // 서버 데이터가 로드되면 로컬 상태 업데이트
  useEffect(() => {
    if (data?.organizations) {
      setOrganizations(data.organizations);
    }
  }, [data]);

  // 조직 생성 Mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      // 디버깅용: 전송 데이터 로그
      console.log("📤 조직 생성 전송 데이터:", data);

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // 서버 응답에서 에러 메시지 파싱
        let errorMessage = "조직 생성에 실패했습니다.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error("❌ API 에러 응답:", errorData);
        } catch (parseError) {
          // JSON 파싱 실패 시 상태 코드 기반 메시지
          console.error("❌ 응답 파싱 실패:", parseError);
          if (response.status === 401) {
            errorMessage = "로그인이 필요합니다.";
          } else if (response.status === 400) {
            errorMessage = "입력값을 확인해주세요.";
          } else if (response.status === 500) {
            errorMessage = "서버 오류가 발생했습니다.";
          }
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  // 조직 생성 핸들러
  const handleCreateOrg = (data: { name: string; description?: string }) => {
    // 새로운 조직 객체 생성
    const newOrg = {
      id: Date.now(), // 임시 ID
      name: data.name,
      description: data.description || "",
      members: [],
      _count: {
        members: 1,
        quotes: 0,
      },
    };

    // 로컬 상태에 즉시 추가 (리스트 앞에)
    setOrganizations((prev) => [newOrg, ...prev]);

    // Toast 메시지 표시
    toast({
      title: "생성 완료",
      description: "새로운 조직이 생성되었습니다.",
    });

    // 서버에 저장 시도 (선택적)
    createOrgMutation.mutate(data, {
      onSuccess: (response) => {
        // 서버 응답이 오면 ID 업데이트
        setOrganizations((prev) =>
          prev.map((org) => (org.id === newOrg.id ? response.organization : org))
        );
      },
      onError: (error: Error) => {
        // 실패 시 롤백
        setOrganizations((prev) => prev.filter((org) => org.id !== newOrg.id));
        
        // 구체적인 에러 메시지 표시
        console.error("❌ 조직 생성 실패:", error);
        toast({
          title: "생성 실패",
          description: error.message || "조직 생성에 실패했습니다. 다시 시도해주세요.",
          variant: "destructive",
        });
      },
    });
  };

  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
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
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="조직 관리"
          description="조직을 생성하고 팀원들을 초대하여 함께 견적을 관리합니다."
          icon={Building2}
          iconColor="text-orange-600"
          actions={
            <CreateOrganizationDialog
              onCreate={handleCreateOrg}
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
                  onCreate={handleCreateOrg}
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
    if (!name.trim()) return;
    
    const formData = {
      name: name.trim(),
      description: description.trim(),
    };
    
    // 디버깅용: 폼 제출 데이터 로그
    console.log("📝 폼 제출 데이터:", formData);
    
    // 조직 생성
    onCreate(formData);
    
    // 입력 필드 초기화 및 모달 닫기
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