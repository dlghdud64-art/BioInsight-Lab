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
  FileText, Package, ShoppingCart, MoreVertical, Trash2, RotateCcw, UserX,
  Lock, Clock, UserCheck, Activity, CreditCard, ClipboardCheck, Eye,
  AlertTriangle, ChevronRight, BarChart3, CheckCircle2, XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
type ActivityCategory = "inventory" | "purchase" | "budget" | "team" | "approval" | "member" | "permission" | "quote" | "settings";
const ACTIVITY_CATEGORY_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; label: string }> = {
  inventory: { icon: Package, bg: "bg-teal-50", text: "text-teal-600", label: "재고" },
  purchase: { icon: ShoppingCart, bg: "bg-blue-50", text: "text-blue-600", label: "구매" },
  budget: { icon: FileText, bg: "bg-amber-50", text: "text-amber-600", label: "예산" },
  approval: { icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-600", label: "승인" },
  team: { icon: UserPlus, bg: "bg-purple-50", text: "text-purple-600", label: "멤버" },
  member: { icon: Users, bg: "bg-indigo-50", text: "text-indigo-600", label: "멤버" },
  permission: { icon: ShieldCheck, bg: "bg-violet-50", text: "text-violet-600", label: "권한" },
  quote: { icon: FileText, bg: "bg-cyan-50", text: "text-cyan-600", label: "견적" },
  settings: { icon: Settings, bg: "bg-slate-100", text: "text-slate-500", label: "설정" },
};
function getActivityCategory(action: string): string {
  const lower = action.toLowerCase();
  if (/입고|등록|재고|파일|upload|file|lot/.test(lower)) return "inventory";
  if (/승인|approval|approve/.test(lower)) return "approval";
  if (/견적|주문|order|구매/.test(lower)) return "purchase";
  if (/예산|budget/.test(lower)) return "budget";
  if (/초대|멤버|team|member/.test(lower)) return "team";
  if (/권한|role|permission/.test(lower)) return "permission";
  if (/설정|setting/.test(lower)) return "settings";
  return "inventory";
}

// 활동 중요도 판정
function getActivityImportance(action: string): "high" | "medium" | "low" {
  const lower = action.toLowerCase();
  if (/승인|권한|제거|삭제|변경/.test(lower)) return "high";
  if (/초대|견적|주문/.test(lower)) return "medium";
  return "low";
}
const IMPORTANCE_DOT: Record<string, string> = {
  high: "bg-red-500/70",
  medium: "bg-amber-500/60",
  low: "bg-slate-500/50",
};

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
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "pending" | "inactive">("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

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
  const activeCount = members.filter((m) => m.status !== "Pending").length;
  const adminCount = members.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length;
  const pendingCount = members.filter((m) => m.status === "Pending").length;
  const approverCount = members.filter((m) => m.role === "APPROVER").length;

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
    // 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
    }
    // 상태 필터
    if (memberStatusFilter === "active") return m.status !== "Pending";
    if (memberStatusFilter === "pending") return m.status === "Pending";
    if (memberStatusFilter === "inactive") return false; // 장기 미접속 로직 확장 가능
    return true;
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

  // 활동 필터
  const filteredLogs = activityTypeFilter === "all"
    ? organizationLogs
    : organizationLogs.filter((log) => getActivityCategory(log.action) === activityTypeFilter);

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

  // 플랜 정보
  const planLabel = (organization as any).plan === "ORGANIZATION" ? "Pro" : (organization as any).plan === "TEAM" ? "Basic" : "Starter";
  const seatUsagePercent = totalMembers > 0 ? Math.min(100, Math.round((totalMembers / Math.max(totalMembers + 2, 10)) * 100)) : 0;

  // 바로 처리 항목
  const actionableItems: Array<{ label: string; count: number; icon: React.ComponentType<{ className?: string }>; color: string }> = [];
  if (pendingCount > 0) actionableItems.push({ label: "초대 응답 대기", count: pendingCount, icon: Mail, color: "text-amber-500" });
  if (approverCount === 0 && totalMembers > 1) actionableItems.push({ label: "승인자 미지정", count: 1, icon: AlertTriangle, color: "text-red-500" });

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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-sm text-slate-400 mt-0.5">{organization.description}</p>
            )}
          </div>
        </div>
        {/* 상단 CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 font-medium"
                onClick={() => setInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                멤버 초대
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  const tabEl = document.querySelector('[data-state][value="invites"]') as HTMLElement;
                  tabEl?.click();
                }}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                초대 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  const tabEl = document.querySelector('[data-state][value="members"]') as HTMLElement;
                  tabEl?.click();
                }}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                권한 검토
              </Button>
            </>
          )}
          <Link href="/dashboard/settings/plans">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <CreditCard className="h-4 w-4 mr-1.5" />
              플랜/좌석 보기
            </Button>
          </Link>
        </div>
      </div>

      {/* 6칸 KPI strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* 총 멤버 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">총 멤버</span>
              <div className="bg-blue-50 p-1.5 rounded-full">
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalMembers}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span></p>
            <p className="text-[11px] text-slate-500 mt-1">조직 전체 인원</p>
          </CardContent>
        </Card>
        {/* 활성 멤버 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">활성 멤버</span>
              <div className="bg-emerald-50 p-1.5 rounded-full">
                <span className="block h-3.5 w-3.5 rounded-full bg-emerald-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{activeCount}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span></p>
            <p className="text-[11px] text-slate-500 mt-1">현재 활동 중</p>
          </CardContent>
        </Card>
        {/* 초대 대기 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">초대 대기</span>
              <div className="bg-amber-50 p-1.5 rounded-full">
                <Mail className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{pendingCount}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span></p>
            <p className="text-[11px] text-amber-500 mt-1">{pendingCount > 0 ? "응답 대기 중" : "대기 없음"}</p>
          </CardContent>
        </Card>
        {/* 승인 필요 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">승인 필요</span>
              <div className="bg-blue-50 p-1.5 rounded-full">
                <ClipboardCheck className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{approverCount}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span></p>
            <p className="text-[11px] text-slate-500 mt-1">승인 권한 보유자</p>
          </CardContent>
        </Card>
        {/* 최근 7일 활동 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">최근 7일 활동</span>
              <div className="bg-violet-50 p-1.5 rounded-full">
                <Activity className="h-3.5 w-3.5 text-violet-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{organizationLogs.length}<span className="text-sm font-normal text-slate-400 ml-0.5">건</span></p>
            <p className="text-[11px] text-slate-500 mt-1">조직 내 이벤트</p>
          </CardContent>
        </Card>
        {/* 플랜 상태 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">플랜 상태</span>
              <div className="bg-indigo-50 p-1.5 rounded-full">
                <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{planLabel}</p>
            <p className="text-[11px] text-slate-500 mt-1">좌석 {seatUsagePercent}% 사용</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 구조 — 5탭 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
            개요
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
            멤버 및 접근
          </TabsTrigger>
          <TabsTrigger value="invites" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
            승인 및 초대
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
            활동 및 감사
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
              정책 및 설정
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== 개요 탭 ===== */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {/* 운영 요약 */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">멤버 현황</p>
                      <p className="text-xs text-slate-400">활성 {activeCount}명 / 전체 {totalMembers}명</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(
                      members.reduce((acc: Record<string, number>, m) => {
                        acc[m.role] = (acc[m.role] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([role, count]) => (
                      <Badge key={role} variant="secondary" className="text-[11px] bg-slate-100 text-slate-600">
                        {ROLE_LABELS[role] || role} {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-amber-50 p-2 rounded-lg">
                      <Mail className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">초대 상태</p>
                      <p className="text-xs text-slate-400">{pendingCount > 0 ? `${pendingCount}건 응답 대기` : "대기 없음"}</p>
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <div className="space-y-1">
                      {teamMembers.filter((m) => m.status === "Pending").slice(0, 3).map((m) => (
                        <p key={m.id} className="text-xs text-slate-400 truncate">{m.email}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">승인 체계</p>
                      <p className="text-xs text-slate-400">승인자 {approverCount}명 / 관리자 {adminCount}명</p>
                    </div>
                  </div>
                  {approverCount === 0 && totalMembers > 1 && (
                    <p className="text-xs text-amber-500">승인자를 지정해 주세요</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 최근 활동 5건 */}
            <Card className="shadow-sm border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">최근 활동</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {organizationLogs.slice(0, 5).map((log, idx) => {
                  const category = getActivityCategory(log.action);
                  const style = ACTIVITY_CATEGORY_STYLES[category] || ACTIVITY_CATEGORY_STYLES.inventory;
                  const Icon = style.icon;
                  const importance = getActivityImportance(log.action);
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
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-100/30 ${idx < 4 ? "border-b border-slate-200" : ""}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${IMPORTANCE_DOT[importance]}`} />
                      <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">
                          <span className="font-medium text-slate-900/90">{log.actor}</span>
                          <span className="text-slate-400">님이 </span>
                          {actionParts ? (
                            <>
                              <span className="text-slate-400">{actionParts.before}</span>
                              <span className="text-blue-500 font-medium">{actionParts.target}</span>
                              <span className="text-slate-400">{actionParts.after}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">{log.action}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0">{log.time}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 바로 처리할 항목 + 플랜/좌석 사용률 */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* 바로 처리할 항목 */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">바로 처리할 항목</CardTitle>
                </CardHeader>
                <CardContent>
                  {actionableItems.length === 0 ? (
                    <div className="flex items-center gap-2 py-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <p className="text-sm text-slate-400">처리할 항목이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {actionableItems.map((item, idx) => {
                        const ItemIcon = item.icon;
                        return (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-100/30">
                            <div className="flex items-center gap-2.5">
                              <ItemIcon className={`h-4 w-4 ${item.color}`} />
                              <span className="text-sm text-slate-600">{item.label}</span>
                            </div>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{item.count}건</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 플랜/좌석 사용률 */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">플랜 및 좌석 사용률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{planLabel} 플랜</p>
                      <p className="text-xs text-slate-400">{totalMembers}명 사용 중</p>
                    </div>
                    <Link href="/dashboard/settings/plans">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs">
                        변경
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">좌석 사용률</span>
                      <span className="text-xs font-medium text-slate-600">{seatUsagePercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${seatUsagePercent > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                        style={{ width: `${seatUsagePercent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ===== 멤버 및 접근 탭 ===== */}
        <TabsContent value="members">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-bold text-lg text-slate-900">팀 권한 관리</h3>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="이름, 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm border-slate-200 border-slate-200"
                />
              </div>
            </div>

            {/* 상태 필터 + 역할별 세그먼트 */}
            <div className="flex flex-wrap gap-2">
              {(["all", "active", "pending", "inactive"] as const).map((f) => {
                const labels: Record<string, string> = { all: "전체", active: "활성", pending: "초대 대기", inactive: "장기 미접속" };
                const counts: Record<string, number> = {
                  all: totalMembers,
                  active: activeCount,
                  pending: pendingCount,
                  inactive: 0,
                };
                return (
                  <button
                    key={f}
                    onClick={() => setMemberStatusFilter(f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      memberStatusFilter === f
                        ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                        : "bg-slate-100/50 border-slate-200 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                    }`}
                  >
                    {f === "active" && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                    {f === "pending" && <Clock className="h-3 w-3 text-amber-500" />}
                    {f === "inactive" && <PauseCircle className="h-3 w-3 text-slate-500" />}
                    {labels[f]} <span className="font-bold">{counts[f]}</span>
                  </button>
                );
              })}
            </div>

            {/* 역할별 세그먼트 표시 */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(
                members.reduce((acc: Record<string, number>, m) => {
                  acc[m.role] = (acc[m.role] || 0) + 1;
                  return acc;
                }, {})
              ).map(([role, count]) => (
                <div key={role} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/50 border border-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs text-slate-400">{ROLE_LABELS[role] || role}</span>
                  <span className="text-xs font-bold text-slate-600">{count}명</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              멤버별 역할을 선택하면 즉시 저장됩니다. 관리 컬럼의 메뉴에서 초대 재발송, 멤버 제거 등 운영 액션을 처리하세요.
            </p>

            {filteredTeamMembers.length === 0 ? (
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 text-slate-600 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">
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
              <Card className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100/50 border-slate-200">
                        <TableHead className="font-semibold text-slate-600">팀원</TableHead>
                        <TableHead className="font-semibold text-slate-600">역할</TableHead>
                        <TableHead className="font-semibold text-slate-600">상태</TableHead>
                        <TableHead className="font-semibold text-slate-600 hidden md:table-cell">참여일</TableHead>
                        <TableHead className="font-semibold text-slate-600 hidden lg:table-cell">마지막 활동</TableHead>
                        {isAdmin && <TableHead className="font-semibold text-slate-600 text-right w-[60px]">관리</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeamMembers.map((member) => {
                        const rawMember = member.memberId ? members.find((m) => m.id === member.memberId) : null;
                        const isPending = rawMember?.status === "Pending";
                        const isSelfAdmin = member.isMe && (member.rawRole === "ADMIN" || member.rawRole === "OWNER");
                        const canEditRole = isAdmin && !isSelfAdmin && rawMember && !isPending;
                        return (
                          <TableRow key={member.id} className="border-slate-200">
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 shrink-0 border border-slate-200 border-slate-200">
                                  <AvatarFallback className="bg-slate-100 text-slate-400 text-sm font-medium">
                                    {member.initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {member.name}
                                    {member.isMe && <span className="text-blue-600 font-normal ml-1">(나)</span>}
                                  </p>
                                  <p className="text-xs text-slate-400">{member.email}</p>
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
                                  <SelectTrigger className="w-[140px] h-9 text-sm border-slate-200 border-slate-200">
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
                                <span className="text-sm text-slate-600">
                                  {ROLE_LABELS[rawMember?.role || member.rawRole || ""] || "멤버"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-4">
                              {isPending ? (
                                <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">초대 대기</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700">활동 중</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-4 hidden md:table-cell">
                              <span className="text-xs text-slate-400">
                                {rawMember?.createdAt
                                  ? new Date(rawMember.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
                                  : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 hidden lg:table-cell">
                              <span className="text-xs text-slate-400">
                                {isPending ? "-" : member.lastActive || "-"}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="py-4 text-right">
                                {member.rawRole === "OWNER" ? (
                                  <Lock className="h-4 w-4 text-slate-600 mx-auto" />
                                ) : rawMember && !isSelfAdmin ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      {isPending ? (
                                        <>
                                          <DropdownMenuItem onClick={() => resendInviteMutation.mutate(rawMember.id)}>
                                            <Send className="h-4 w-4 mr-2" />초대 재발송
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-red-400"
                                            onClick={() => { if (confirm("초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id); }}
                                          >
                                            <X className="h-4 w-4 mr-2" />초대 취소
                                          </DropdownMenuItem>
                                        </>
                                      ) : (
                                        <>
                                          <DropdownMenuItem
                                            className="text-red-400"
                                            onClick={() => { if (confirm(`${member.name}님을 제거하시겠습니까?`)) removeMemberMutation.mutate(rawMember.id); }}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />멤버 제거
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : isSelfAdmin ? (
                                  <span className="text-[10px] text-slate-400">-</span>
                                ) : null}
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

        {/* ===== 승인 및 초대 탭 ===== */}
        <TabsContent value="invites">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">승인 및 초대 관리</h3>
              {isAdmin && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-slate-900"
                  onClick={() => setInviteModalOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  새 초대
                </Button>
              )}
            </div>

            {/* 초대 대기 목록 */}
            <Card className="shadow-sm border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-500" />
                  초대 대기 ({pendingCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCount === 0 ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm text-slate-400">대기 중인 초대가 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.filter((m) => m.status === "Pending").map((member) => {
                      const rawMember = member.memberId ? members.find((m) => m.id === member.memberId) : null;
                      return (
                        <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-100/30">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-slate-200">
                              <AvatarFallback className="bg-slate-100 text-slate-400 text-xs">{member.initial}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{member.email}</p>
                              <p className="text-xs text-slate-500">
                                역할: {ROLE_LABELS[member.rawRole || ""] || "멤버"}
                                {rawMember?.createdAt && (
                                  <> / 초대일: {new Date(rawMember.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</>
                                )}
                              </p>
                            </div>
                          </div>
                          {isAdmin && rawMember && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-slate-200 text-slate-600"
                                onClick={() => resendInviteMutation.mutate(rawMember.id)}
                                disabled={resendInviteMutation.isPending}
                              >
                                <Send className="h-3.5 w-3.5 mr-1" />재발송
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-red-400 hover:text-red-300"
                                onClick={() => { if (confirm("초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id); }}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 승인자 현황 */}
            <Card className="shadow-sm border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  승인 권한 보유자 ({approverCount + adminCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {members.filter((m) => m.role === "APPROVER" || m.role === "ADMIN" || m.role === "OWNER").length === 0 ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <p className="text-sm text-amber-600">승인자를 지정해 주세요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.filter((m) => m.role === "APPROVER" || m.role === "ADMIN" || m.role === "OWNER").map((m) => {
                      const name = m.user?.name || "이름 없음";
                      const initial = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                      return (
                        <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-slate-200">
                              <AvatarFallback className="bg-slate-100 text-slate-400 text-xs">{initial}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{name}</p>
                              <p className="text-xs text-slate-500">{m.user?.email}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">{ROLE_LABELS[m.role]}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== 활동 및 감사 탭 ===== */}
        <TabsContent value="activity">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-bold text-lg text-slate-900">활동 및 감사 로그</h3>
            </div>

            {/* 유형별 필터 */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "전체" },
                { key: "inventory", label: "재고" },
                { key: "purchase", label: "구매" },
                { key: "budget", label: "예산" },
                { key: "approval", label: "승인" },
                { key: "team", label: "멤버" },
                { key: "permission", label: "권한" },
                { key: "settings", label: "설정" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActivityTypeFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    activityTypeFilter === f.key
                      ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                      : "bg-slate-100/50 border-slate-200 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Card className="shadow-sm border-slate-200 bg-white">
              <CardContent className="p-0">
                <div className="max-h-[560px] overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="py-12 text-center">
                      <Activity className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">해당 유형의 활동이 없습니다</p>
                    </div>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const category = getActivityCategory(log.action);
                      const style = ACTIVITY_CATEGORY_STYLES[category] || ACTIVITY_CATEGORY_STYLES.inventory;
                      const Icon = style.icon;
                      const importance = getActivityImportance(log.action);
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
                          className={`flex items-start gap-4 p-4 transition-colors hover:bg-slate-100/30 ${idx < filteredLogs.length - 1 ? "border-b border-slate-200" : ""}`}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 mt-2.5 ${IMPORTANCE_DOT[importance]}`} />
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0">{style.label}</Badge>
                            </div>
                            <p className="text-sm">
                              <span className="font-medium text-slate-900/90">{log.actor}</span>
                              <span className="text-slate-400">님이 </span>
                              {actionParts ? (
                                <>
                                  <span className="text-slate-400">{actionParts.before}</span>
                                  <span className="text-blue-600 font-medium">{actionParts.target}</span>
                                  <span className="text-slate-400">{actionParts.after}</span>
                                </>
                              ) : (
                                <span className="text-slate-400">{log.action}</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{log.time}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== 정책 및 설정 탭 (관리자 전용) ===== */}
        {isAdmin && (
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* 기본 정보 수정 */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">조직 기본 정보</CardTitle>
                  <CardDescription className="text-slate-400">조직명과 설명을 수정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 연구실 로고 업로드 */}
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 shrink-0 rounded-full border border-slate-200 border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt="조직 로고"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">
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
                        className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-slate-600">조직명</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="조직명을 입력하세요"
                      className="bg-slate-100 border-slate-200 text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug" className="text-slate-600">조직 주소</Label>
                    <div className="flex rounded-md border border-slate-200 border-slate-200 overflow-hidden">
                      <span className="inline-flex items-center px-3 text-sm text-slate-400 bg-slate-100 border-r border-slate-200 border-slate-200 shrink-0">
                        bio-insight.lab/
                      </span>
                      <Input
                        id="edit-slug"
                        value={editSlug}
                        onChange={handleSlugChange}
                        placeholder="my-lab"
                        className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-slate-100 text-slate-900"
                      />
                    </div>
                    {slugStatus === "checking" && (
                      <p className="text-xs text-slate-400">확인 중...</p>
                    )}
                    {slugStatus === "available" && (
                      <p className="text-xs text-emerald-600">사용 가능한 주소입니다.</p>
                    )}
                    {slugStatus === "unavailable" && editSlug.trim() && (
                      <p className="text-xs text-red-400">이미 사용 중이거나 사용할 수 없는 주소입니다.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-desc" className="text-slate-600">설명 (선택)</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="조직에 대한 간단한 설명"
                      rows={3}
                      className="resize-none bg-slate-100 border-slate-200 text-slate-900"
                    />
                  </div>
                  <Button
                    onClick={handleSaveName}
                    disabled={isSavingName || !editName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-slate-900"
                  >
                    {isSavingName ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중...</>
                    ) : "변경 사항 저장"}
                  </Button>
                </CardContent>
              </Card>

              {/* 초대 정책 */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">초대 정책</CardTitle>
                  <CardDescription className="text-slate-400">새 멤버 초대 시 적용되는 기본 정책입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">기본 역할</p>
                      <p className="text-xs text-slate-500">새 초대 멤버에게 부여되는 기본 역할</p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">조회자</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">초대 만료 기간</p>
                      <p className="text-xs text-slate-500">응답 없는 초대가 자동 만료되는 기간</p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">7일</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">관리자만 초대 가능</p>
                      <p className="text-xs text-slate-500">관리자/소유자만 새 멤버를 초대할 수 있음</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 text-xs">활성</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 역할 정책 */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">역할 정책</CardTitle>
                  <CardDescription className="text-slate-400">역할별 권한 범위를 정의합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { role: "VIEWER", desc: "조직 내 데이터 조회만 가능" },
                    { role: "REQUESTER", desc: "견적 요청, 재고 등록 등 요청 생성 가능" },
                    { role: "APPROVER", desc: "요청된 견적/구매를 승인 또는 반려" },
                    { role: "ADMIN", desc: "멤버 관리, 설정 변경, 전체 운영 관리" },
                    { role: "OWNER", desc: "최고 관리자. 조직 삭제, 소유권 이전 가능" },
                  ].map((item) => (
                    <div key={item.role} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">{ROLE_LABELS[item.role]}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-xs">{item.role}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 위험 작업 */}
              <Card className="shadow-sm border border-red-900/30 bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    위험 작업
                  </CardTitle>
                  <CardDescription className="text-slate-500">되돌릴 수 없는 작업입니다. 신중하게 진행하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-red-900/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600">조직 삭제</p>
                      <p className="text-xs text-slate-500">조직과 모든 데이터가 영구적으로 삭제됩니다.</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-red-800 text-red-400 hover:bg-red-950/30 hover:text-red-300" disabled>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      조직 삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* 멤버 초대 모달 */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">멤버 초대</DialogTitle>
            <DialogDescription className="text-slate-500">
              이메일로 초대하거나 협력 조직을 연결하세요.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="email" className="mt-2">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100">
              <TabsTrigger value="email" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                이메일 초대
              </TabsTrigger>
              <TabsTrigger value="org" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500">
                협력사 연결
              </TabsTrigger>
            </TabsList>

            {/* 이메일 초대 탭 */}
            <TabsContent value="email" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-sm font-semibold text-slate-700">이메일 주소</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="invite-email"
                    type="email"
                    className="pl-9 bg-white border-slate-200 text-slate-900 h-11 rounded-xl"
                    placeholder="colleague@univ.edu"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">역할</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="bg-white border-slate-200 text-slate-900 h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="VIEWER">연구원 (조회자)</SelectItem>
                    <SelectItem value="REQUESTER">요청자</SelectItem>
                    <SelectItem value="APPROVER">승인자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
        <DialogContent className="sm:max-w-[400px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">권한 변경</DialogTitle>
            <DialogDescription className="text-slate-500">
              {permissionDialogMember?.name}님의 역할을 변경합니다.
            </DialogDescription>
          </DialogHeader>
          {permissionDialogMember && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {permissionDialogMember.initial}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-slate-900">{permissionDialogMember.name}</p>
                  <p className="text-xs text-slate-500">{permissionDialogMember.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600">역할</Label>
                <Select
                  value={permissionDialogMember.rawRole || "VIEWER"}
                  onValueChange={(v) => {
                    const raw = permissionDialogMember.memberId ? members.find((m) => m.id === permissionDialogMember.memberId) : null;
                    if (raw) updateRoleMutation.mutate({ memberId: raw.id, role: v });
                    setPermissionDialogOpen(false);
                  }}
                >
                  <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-900">
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
      <div className="text-center py-8 text-slate-400">
        <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-600" />
        <p className="text-sm">연결 가능한 협력 조직이 없습니다.</p>
        <p className="text-xs mt-1 text-slate-500">다른 조직을 먼저 생성하거나 초대받아야 합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        가입된 조직을 협력 조직으로 연결합니다. 연결 시 해당 조직의 멤버가 협력 파트너로 등록됩니다.
      </p>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {otherOrgs.map((org) => (
          <div
            key={org.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 border-slate-200 p-3 hover:bg-slate-100/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-900/30 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{org.name}</p>
                {org.description && (
                  <p className="text-xs text-slate-400 truncate max-w-[180px]">{org.description}</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs border-slate-200 text-slate-500"
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
