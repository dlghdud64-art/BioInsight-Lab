"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, UserPlus, Mail, Loader2, Search, Users, ShieldCheck,
  Settings, Wallet, PauseCircle, X, Send, Building2,
  FileText, Package, ShoppingCart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// 활동 피드 카테고리별 스타일
type ActivityCategory = "inventory" | "purchase" | "budget" | "team" | "approval";
const ACTIVITY_CATEGORY_STYLES: Record<ActivityCategory, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = {
  inventory: { icon: Package, bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400" },
  purchase: { icon: ShoppingCart, bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400" },
  budget: { icon: FileText, bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  approval: { icon: ShieldCheck, bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  team: { icon: UserPlus, bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400" },
};
function getActivityCategory(action: string): ActivityCategory {
  const lower = action.toLowerCase();
  if (/입고|등록|재고|파일|upload|file|lot/.test(lower)) return "inventory";
  if (/승인|approval|approve/.test(lower)) return "approval";
  if (/견적|주문|order|구매/.test(lower)) return "purchase";
  if (/예산|budget/.test(lower)) return "budget";
  if (/초대|멤버|team|member|권한/.test(lower)) return "team";
  return "inventory";
}

// 역할 라벨 매핑
const ROLE_LABELS: Record<string, string> = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
  OWNER: "소유자",
  MEMBER: "멤버",
};

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

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionDialogMember, setPermissionDialogMember] = useState<TeamMemberRow | null>(null);

  // 관리 탭 상태
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  // 조직 정보 조회
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
    name: "",
    description: "",
    slug: "",
  };

  // editName, editSlug, editDescription 초기값 세팅
  // orgLoading 중에는 fallback 빈값이 트리거되지 않도록 대기
  const lastInitializedOrgId = useRef<string | null>(null);
  useEffect(() => {
    // 실제 API 데이터가 로드되기 전(loading 중)에는 초기화 건너뜀
    if (orgLoading) return;

    const realOrg = orgsData?.organizations?.find((org: any) => org.id === params.id);
    if (!realOrg) return; // 조직을 찾지 못한 경우 초기화 건너뜀

    // 조직 전환 시 또는 최초 로드 시 폼 필드 전체 초기화
    if (lastInitializedOrgId.current !== realOrg.id) {
      lastInitializedOrgId.current = realOrg.id;
      setEditName(realOrg.name || "");
      setEditDescription(realOrg.description || "");
      setEditSlug(realOrg.slug || "");
    }
  }, [orgLoading, orgsData, params.id]);

  // 슬러그 실시간 검증 (Debounce)
  useEffect(() => {
    const raw = editSlug.toLowerCase().trim();
    if (!raw) {
      setSlugStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setSlugStatus("checking");
      try {
        const res = await fetch(
          `/api/organizations/check-slug?slug=${encodeURIComponent(raw)}&excludeOrgId=${params.id}`
        );
        const json = await res.json();
        setSlugStatus(json.available ? "available" : "unavailable");
      } catch {
        setSlugStatus("unavailable");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editSlug, params.id]);

  // 로고 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoFile(file);
    e.target.value = "";
  };

  const handleLogoRemove = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const filtered = v.replace(/[^a-z0-9-]/g, "").toLowerCase();
    setEditSlug(filtered);
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

  const members: Member[] = membersData?.members?.length > 0
    ? membersData.members.map((m: any) => ({ ...m, status: m.status || "Active" }))
    : [];

  const currentUserMember = members.find((m) => m.user?.id === session?.user?.id);
  const isAdmin = currentUserMember?.role === "ADMIN" || currentUserMember?.role === "OWNER";

  // 통계
  const totalMembers = members.length;
  const adminCount = members.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length;
  const pendingCount = members.filter((m) => m.status === "Pending").length;

  // 팀원 리스트 변환
  const teamMembers: TeamMemberRow[] = members.map((m) => {
    const name = m.user?.name || "이름 없음";
    const email = m.user?.email || "";
    const initial = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || email.slice(0, 2).toUpperCase() || "?";
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
      spent: 0,
      reagentCount: 0,
      lastActive: m.status === "Pending" ? "초대 대기" : "오늘",
    };
  });

  const filteredTeamMembers = teamMembers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  // 활동 피드 (target: 하이라이트할 대상)
  const organizationLogs: Array<{ id: string; actor: string; action: string; time: string; target?: string }> = [
    { id: "1", actor: "이매니저", action: "DMEM 시약을 5병 입고 반영했습니다.", time: "10분 전", target: "DMEM 시약" },
    { id: "2", actor: "김연구", action: "FBS 견적 요청을 제출했습니다.", time: "25분 전", target: "FBS" },
    { id: "3", actor: "박승인", action: "Pipette Tips 구매를 승인했습니다.", time: "40분 전", target: "Pipette Tips" },
    { id: "4", actor: "이매니저", action: "예산 2026 상반기 시약비를 변경했습니다.", time: "1시간 전", target: "예산 2026 상반기 시약비" },
    { id: "5", actor: "최연구원", action: "Trypsin-EDTA 재고를 등록했습니다.", time: "2시간 전", target: "Trypsin-EDTA" },
    { id: "6", actor: "이매니저", action: "김연구님의 권한을 승인자로 변경했습니다.", time: "3시간 전", target: "김연구" },
    { id: "7", actor: "시스템", action: "박신입님이 조직 초대를 수락했습니다.", time: "어제", target: "박신입" },
  ];

  // 초대 재발송
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
      toast({ title: "초대 재발송 완료", description: "초대 이메일이 재발송되었습니다." });
    },
    onError: () => toast({ title: "재발송 실패", variant: "destructive" }),
  });

  // 멤버 초대
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
      setInviteModalOpen(false);
      toast({ title: "초대 완료", description: "멤버 초대가 완료되었습니다." });
    },
    onError: (error: Error) => toast({ title: "초대 실패", description: error.message, variant: "destructive" }),
  });

  // 역할 변경
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
      toast({ title: "역할 변경 완료" });
    },
    onError: () => toast({ title: "역할 변경 실패", variant: "destructive" }),
  });

  // 멤버 제거
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/organizations/${params.id}/members?memberId=${memberId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      toast({ title: "멤버 제거 완료" });
    },
    onError: () => toast({ title: "멤버 제거 실패", variant: "destructive" }),
  });

  // 조직명 수정
  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/organizations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          slug: editSlug.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "수정 실패");
      }
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "조직 정보가 수정되었습니다." });
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingName(false);
    }
  };

  if (orgLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/organizations">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{organization.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/dashboard/settings/plans">
              <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300">
                <Wallet className="h-4 w-4 mr-1.5" />
                플랜 관리
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setInviteModalOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              멤버 초대
            </Button>
          )}
        </div>
      </div>

      {/* 조직 기본 정보 요약 카드 */}
      <Card className="bg-white rounded-xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              조직 정보
            </CardTitle>
            {(organization as any).plan && (
              <Link href="/dashboard/settings/plans">
                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer text-xs">
                  {(organization as any).plan === "ORGANIZATION" ? "Pro" : (organization as any).plan === "TEAM" ? "Basic" : "Starter"} 플랜
                </Badge>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">조직명</span>
              <p className="font-medium text-slate-900 dark:text-white mt-0.5">{organization.name}</p>
            </div>
            {(organization as any).slug && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">조직 주소</span>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5 text-xs">
                  bio-insight.lab/<span className="text-blue-600 dark:text-blue-400">{(organization as any).slug}</span>
                </p>
              </div>
            )}
            {(organization as any).createdAt && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">생성일</span>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {new Date((organization as any).createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            )}
          </div>
          {organization.description && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 text-sm">설명</span>
              <p className="text-slate-700 dark:text-slate-300 mt-0.5">{organization.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">총 멤버</CardTitle>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {totalMembers}<span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
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
              {adminCount}<span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
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
              {pendingCount}<span className="text-lg font-normal text-slate-500 dark:text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 구조 */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-400">
            조직활동
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-400">
            멤버
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-400">
              관리
            </TabsTrigger>
          )}
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="dashboard">
          <div className="space-y-4">
            <h3 className="font-bold text-lg dark:text-white">조직 활동 피드</h3>
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardContent className="p-0">
                <div className="max-h-[480px] overflow-y-auto">
                  {organizationLogs.map((log, idx) => {
                    const category = getActivityCategory(log.action);
                    const style = ACTIVITY_CATEGORY_STYLES[category];
                    const Icon = style.icon;
                    const actionParts = log.target && log.action.includes(log.target)
                      ? (() => {
                          const i = log.action.indexOf(log.target);
                          return {
                            before: log.action.slice(0, i),
                            target: log.target,
                            after: log.action.slice(i + log.target.length),
                          };
                        })()
                      : null;
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-4 p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${idx < organizationLogs.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}
                      >
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-semibold text-slate-900 dark:text-white">{log.actor}</span>
                            <span className="text-slate-500 dark:text-slate-400">님이 </span>
                            {actionParts ? (
                              <>
                                <span className="text-slate-500 dark:text-slate-400">{actionParts.before}</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{actionParts.target}</span>
                                <span className="text-slate-500 dark:text-slate-400">{actionParts.after}</span>
                              </>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">{log.action}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 멤버 탭 — 팀 권한 관리 (테이블 + 역할 선택 즉시 DB 반영) */}
        <TabsContent value="members">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-bold text-lg dark:text-white">팀 권한 관리</h3>
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              멤버별 역할을 선택하면 즉시 저장됩니다. 조직(랩실)의 시스템 접근 권한을 여기서 조정하세요.
            </p>

            {filteredTeamMembers.length === 0 ? (
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    {teamMembers.length === 0 ? "멤버가 없습니다." : "검색 조건에 맞는 멤버가 없습니다."}
                  </p>
                  {isAdmin && teamMembers.length === 0 && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setInviteModalOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      첫 멤버 초대하기
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white rounded-xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300">팀원</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300">역할</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300">상태</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 hidden md:table-cell">참여일</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">마지막 활동</TableHead>
                        {isAdmin && <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right">액션</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeamMembers.map((member) => {
                        const rawMember = member.memberId ? members.find((m) => m.id === member.memberId) : null;
                        const isPending = rawMember?.status === "Pending";
                        const isSelfAdmin = member.isMe && (member.rawRole === "ADMIN" || member.rawRole === "OWNER");
                        const canEditRole = isAdmin && !isSelfAdmin && rawMember && !isPending;
                        return (
                          <TableRow key={member.id} className="border-slate-100 dark:border-slate-800">
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 shrink-0 border border-slate-200 dark:border-slate-700">
                                  <AvatarFallback className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-sm font-medium">
                                    {member.initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {member.name}
                                    {member.isMe && <span className="text-blue-600 dark:text-blue-400 font-normal ml-1">(나)</span>}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              {canEditRole && rawMember ? (
                                <Select
                                  value={rawMember.role}
                                  onValueChange={(v) => updateRoleMutation.mutate({ memberId: rawMember.id, role: v })}
                                  disabled={updateRoleMutation.isPending}
                                >
                                  <SelectTrigger className="w-[140px] h-9 text-sm border-slate-200 dark:border-slate-700">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="VIEWER">조회자</SelectItem>
                                    <SelectItem value="REQUESTER">요청자</SelectItem>
                                    <SelectItem value="APPROVER">승인자</SelectItem>
                                    <SelectItem value="ADMIN">관리자</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {ROLE_LABELS[rawMember?.role || member.rawRole || ""] || "멤버"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-4">
                              {isPending ? (
                                <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">초대 대기</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">활동 중</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-4 hidden md:table-cell">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {rawMember?.createdAt
                                  ? new Date(rawMember.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
                                  : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 hidden lg:table-cell">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {isPending ? "-" : member.lastActive || "-"}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="py-4 text-right">
                                {rawMember && !isSelfAdmin && (
                                  <>
                                    {isPending ? (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-8" onClick={() => resendInviteMutation.mutate(rawMember.id)}>
                                          <Send className="h-4 w-4 mr-1" />재발송
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 text-red-600 dark:text-red-400" onClick={() => { if (confirm("초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id); }}>
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="ghost" size="sm" className="h-8 text-red-600 dark:text-red-400" onClick={() => { if (confirm(`${member.name}님을 제거하시겠습니까?`)) removeMemberMutation.mutate(rawMember.id); }}>
                                        <X className="h-4 w-4 mr-1" />제거
                                      </Button>
                                    )}
                                  </>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* 관리 탭 (관리자 전용) */}
        {isAdmin && (
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* 기본 정보 수정 */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base dark:text-white">조직 기본 정보</CardTitle>
                  <CardDescription className="dark:text-slate-400">조직명과 설명을 수정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 연구실 로고 업로드 */}
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt="조직 로고"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-slate-500 dark:text-slate-400">
                          {(editName || organization?.name || "조")[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg, image/png, image/webp"
                        className="hidden"
                        onChange={handleLogoSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-fit"
                      >
                        이미지 업로드
                      </Button>
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 underline underline-offset-2"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="dark:text-slate-300">조직명</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="조직명을 입력하세요"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug" className="dark:text-slate-300">조직 주소</Label>
                    <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <span className="inline-flex items-center px-3 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shrink-0">
                        bio-insight.lab/
                      </span>
                      <Input
                        id="edit-slug"
                        value={editSlug}
                        onChange={handleSlugChange}
                        placeholder="my-lab"
                        className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {slugStatus === "checking" && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">확인 중...</p>
                    )}
                    {slugStatus === "available" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">사용 가능한 주소입니다.</p>
                    )}
                    {slugStatus === "unavailable" && editSlug.trim() && (
                      <p className="text-xs text-red-600 dark:text-red-400">이미 사용 중이거나 사용할 수 없는 주소입니다.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-desc" className="dark:text-slate-300">설명 (선택)</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="조직에 대한 간단한 설명"
                      rows={3}
                      className="resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                  <Button
                    onClick={handleSaveName}
                    disabled={isSavingName || !editName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSavingName ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중...</>
                    ) : "변경 사항 저장"}
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* 멤버 초대 모달 */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">멤버 초대</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              이메일로 초대하거나 협력 조직을 연결하세요.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="email" className="mt-2">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="email" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-400">
                이메일 초대
              </TabsTrigger>
              <TabsTrigger value="org" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-400">
                협력사 연결
              </TabsTrigger>
            </TabsList>

            {/* 이메일 초대 탭 */}
            <TabsContent value="email" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="dark:text-slate-300">이메일 주소</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="invite-email"
                    type="email"
                    className="pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="colleague@univ.edu"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="dark:text-slate-300">역할</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">연구원 (조회자)</SelectItem>
                    <SelectItem value="REQUESTER">요청자</SelectItem>
                    <SelectItem value="APPROVER">승인자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!inviteEmail.trim() || inviteMemberMutation.isPending}
                onClick={() => inviteMemberMutation.mutate({ userEmail: inviteEmail.trim(), role: inviteRole })}
              >
                {inviteMemberMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />발송 중...</>
                ) : "초대 메일 발송"}
              </Button>
            </TabsContent>

            {/* 협력사 연결 탭 */}
            <TabsContent value="org" className="pt-4">
              <PartnerOrgTab
                currentOrgId={params.id}
                allOrgs={orgsData?.organizations || []}
                onLink={() => {}}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 권한 변경 모달 */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">권한 변경</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {permissionDialogMember?.name}님의 역할을 변경합니다.
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
                <Label className="text-sm font-medium dark:text-slate-300">역할</Label>
                <Select
                  value={permissionDialogMember.rawRole || "VIEWER"}
                  onValueChange={(v) => {
                    const raw = permissionDialogMember.memberId ? members.find((m) => m.id === permissionDialogMember.memberId) : null;
                    if (raw) updateRoleMutation.mutate({ memberId: raw.id, role: v });
                    setPermissionDialogOpen(false);
                  }}
                >
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-white">
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

// 협력사 연결 탭 컴포넌트
function PartnerOrgTab({
  currentOrgId,
  allOrgs,
  onLink,
}: {
  currentOrgId: string;
  allOrgs: any[];
  onLink: (orgId: string) => void;
}) {
  const otherOrgs = allOrgs.filter((org) => org.id !== currentOrgId);

  if (otherOrgs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
        <p className="text-sm">연결 가능한 협력 조직이 없습니다.</p>
        <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">다른 조직을 먼저 생성하거나 초대받아야 합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        가입된 조직을 협력 조직으로 연결합니다. 연결 시 해당 조직의 멤버가 협력 파트너로 등록됩니다.
      </p>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {otherOrgs.map((org) => (
          <div
            key={org.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium dark:text-white">{org.name}</p>
                {org.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{org.description}</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
