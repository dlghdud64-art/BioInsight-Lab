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
// §11.193d Phase 3 — capability edit dialog. WORKFLOW_CAPABILITIES whitelist
// + WORKFLOW_CAPABILITY_LABEL (한국어) + resolveWorkflowCapabilities (DB 우선
// + role 기반 fallback) 를 canonical source 로 사용 — raw enum 노출 0.
import {
  WORKFLOW_CAPABILITIES,
  WORKFLOW_CAPABILITY_LABEL,
  resolveWorkflowCapabilities,
  type WorkflowCapability,
} from "@/lib/permissions/workflow-capabilities";
// §11.196f — dead lucide imports 6 symbol 제거 (BarChart3 Eye RotateCcw
//   UserCheck UserX Wallet actual 사용 0). 나머지 보존.
import {
  ArrowLeft, UserPlus, Mail, Loader2, Search, Users, ShieldCheck,
  Settings, PauseCircle, X, Send, Building2,
  FileText, Package, ShoppingCart, MoreVertical, Trash2,
  Lock, Clock, Activity, CreditCard, ClipboardCheck,
  AlertTriangle, ChevronRight, CheckCircle2, XCircle,
} from "lucide-react";
// §11.298c Radix DropdownMenu* import 제거 — ActionMenu shared 사용.
import { ActionMenu } from "@/components/inventory/action-menu";
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
  budget: { icon: FileText, bg: "bg-yellow-50", text: "text-yellow-600", label: "예산" },
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
  medium: "bg-yellow-500/60",
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

  // §11.298c member row action plain state.
  const [openMemberActionId, setOpenMemberActionId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [permissionDialogMember, setPermissionDialogMember] = useState<TeamMemberRow | null>(null);
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "pending" | "inactive">("all");
  // §org-activity-actor-filter — 카테고리 칩(멤버·권한·설정 등 항상 빈 필터) 제거 → 실제 행위자 필터.
  const [activityActorFilter, setActivityActorFilter] = useState<string>("전체");

  // 관리 탭 상태
  const [editName, setEditName] = useState("");
  // §org-management-redesign P4 — 조직 삭제(type-to-confirm) 모달 상태.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
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
  const isOwner = currentUserMember?.role === "OWNER";

  // §org-management-redesign P4 — 조직 삭제 mutation(canonical DELETE /api/organizations/[id]). 성공 시 목록 복귀.
  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/organizations/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "조직 삭제에 실패했습니다.");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: "조직 삭제 완료", description: "조직이 삭제되었습니다." });
      router.push("/dashboard/organizations");
    },
    onError: (e: Error) =>
      toast({ title: "조직 삭제 실패", description: e.message, variant: "destructive" }),
  });

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
  // §org-management-redesign P3 — 가짜 활동 데이터 제거(§11.318 honesty). org-scoped 활동/audit
  //   엔드포인트 부재 → 정직 빈 상태. 실 audit 연동은 후속(엔드포인트 신설 별 트랙).
  const organizationLogs: Array<{ id: string; actor: string; action: string; time: string; target?: string }> = [];

  // §org-activity-actor-filter — 실제 로그 행위자에서 자동 도출(가짜 이름 0). 로그 0건이면 행위자 0 → 드롭다운 미노출.
  const activityActors = ["전체", ...Array.from(new Set(organizationLogs.map((l) => l.actor)))];
  const filteredLogs = activityActorFilter === "전체"
    ? organizationLogs
    : organizationLogs.filter((log) => log.actor === activityActorFilter);

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

  // §11.193d Phase 3 — capability 토글 (workflow capabilities multi-badge).
  //   role 변경과 분리된 별도 mutation — capability 는 RBAC 와 별개 layer.
  //   PATCH /api/organizations/[id]/members/[memberId]/capabilities (Phase 2.4 alive).
  //   onSuccess: organization-members + settings-organizations 모두 invalidate
  //     → settings page 의 multi-badge 도 즉시 갱신 (canonical truth 동기화).
  const updateCapabilitiesMutation = useMutation({
    mutationFn: async ({
      memberId,
      capabilities,
    }: {
      memberId: string;
      capabilities: WorkflowCapability[];
    }) => {
      const response = await fetch(
        `/api/organizations/${params.id}/members/${memberId}/capabilities`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ capabilities }),
        },
      );
      if (!response.ok) throw new Error("Failed to update capabilities");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      queryClient.invalidateQueries({ queryKey: ["settings-organizations"] });
      toast({ title: "업무 권한 변경 완료" });
    },
    onError: () => toast({ title: "업무 권한 변경 실패", variant: "destructive" }),
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

  // §11.304 — 플랜 정보 (FREE → "Free" 정합, "Starter" → "Free" swap).
  const planLabel = (organization as any).plan === "ORGANIZATION" ? "Pro" : (organization as any).plan === "TEAM" ? "Basic" : "Free";
  const seatUsagePercent = totalMembers > 0 ? Math.min(100, Math.round((totalMembers / Math.max(totalMembers + 2, 10)) * 100)) : 0;

  // 바로 처리 항목
  // §11.303-hotfix-d — SWC parser nested generic bug 회피: Array<...
  //   React.ComponentType<{ className?: string }>> 의 nested <> 가 다음
  //   JSX `<div` 를 generic 으로 잘못 parse. React.ElementType 단일
  //   token + postfix `[]` 으로 nested generic 제거.
  const actionableItems: { label: string; count: number; icon: React.ElementType; color: string }[] = [];
  if (pendingCount > 0) actionableItems.push({ label: "초대 응답 대기", count: pendingCount, icon: Mail, color: "text-yellow-500" });
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

      {/* §org-management-redesign P3 — KPI 6박스 → 요약 한 줄 바(시안). 실 5지표 유지, 가짜 "최근 7일 활동"(mock count) 제거. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-slate-600">
          <Users className="h-4 w-4 text-blue-500" />멤버 <b className="text-slate-900">{totalMembers}</b>명
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">활성 <b className="text-slate-900">{activeCount}</b></span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">초대 대기 <b className={pendingCount > 0 ? "text-yellow-600" : "text-slate-900"}>{pendingCount}</b></span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">승인 권한 <b className="text-slate-900">{approverCount}</b></span>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-slate-600">
          <CreditCard className="h-4 w-4 text-indigo-500" /><b className="text-slate-900">{planLabel}</b> · 좌석 {seatUsagePercent}%
        </span>
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
                    <div className="bg-yellow-50 p-2 rounded-lg">
                      <Mail className="h-5 w-5 text-yellow-500" />
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
                    <p className="text-xs text-yellow-500">승인자를 지정해 주세요</p>
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
                {/* §org-management-redesign P3 — 활동 데이터 없음 정직 표기(가짜 0). */}
                {organizationLogs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">활동 내역이 아직 없습니다.</div>
                ) : organizationLogs.slice(0, 5).map((log, idx) => {
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
                        className={`h-full rounded-full transition-all ${seatUsagePercent > 80 ? "bg-yellow-500" : "bg-blue-500"}`}
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
                    {f === "pending" && <Clock className="h-3 w-3 text-yellow-500" />}
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
                                <Badge variant="secondary" className="text-xs bg-yellow-50 text-yellow-700">초대 대기</Badge>
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
                                  // §11.303-hotfix-e — JSX 주석 sibling 제거 (fragment 없이 인접하면 SWC parser fail, 진짜 root cause).
                                  <ActionMenu
                                    menuId={`org-member-${rawMember.id}`}
                                    currentOpenId={openMemberActionId}
                                    onOpenChange={setOpenMemberActionId}
                                    items={isPending ? [
                                      { label: "초대 재발송", icon: <Send className="h-4 w-4 mr-2" />, onClick: () => resendInviteMutation.mutate(rawMember.id) },
                                      { label: "초대 취소", icon: <X className="h-4 w-4 mr-2" />, danger: true, separator: true, onClick: () => { if (confirm("초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id); } },
                                    ] : [
                                      { label: "멤버 제거", icon: <Trash2 className="h-4 w-4 mr-2" />, danger: true, onClick: () => { if (confirm(`${member.name}님을 제거하시겠습니까?`)) removeMemberMutation.mutate(rawMember.id); } },
                                    ]}
                                  />
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
                  <Mail className="h-4 w-4 text-yellow-500" />
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
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <p className="text-sm text-yellow-600">승인자를 지정해 주세요</p>
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
              {/* §org-activity-actor-filter — 카테고리 칩(전체·재고·구매·예산·승인·멤버·권한·설정) 제거.
                  멤버·권한·설정은 로그가 생성되지 않아 항상 빈 결과였음(가짜 필터). 카테고리 분류는 각 로그 행
                  태그로 유지, 필터는 "누가" 중심 행위자 드롭다운으로. 실제 행위자 있을 때만 노출(가짜 컨트롤 0). */}
              {activityActors.length > 1 && (
                <Select value={activityActorFilter} onValueChange={setActivityActorFilter}>
                  <SelectTrigger className="w-[180px] h-9 text-sm border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityActors.map((a) => (
                      <SelectItem key={a} value={a}>{a === "전체" ? "전체 행위자" : a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Card className="shadow-sm border-slate-200 bg-white">
              <CardContent className="p-0">
                <div className="max-h-[560px] overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="py-12 text-center">
                      <Activity className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                      {/* §org-management-redesign P3 — 활동 데이터 없음 정직 표기(가짜 0). */}
                      <p className="text-sm text-slate-400">
                        {activityActorFilter === "전체" ? "활동 내역이 아직 없습니다" : `${activityActorFilter} 님의 활동 기록이 없습니다`}
                      </p>
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
                <CardContent>
                  {/* §org-role-matrix — 기존 역할 설명 리스트 → capability 매트릭스(조회/요청/승인/관리/삭제 누적).
                      별도 모달/surface 신규 0(기존 역할 정책 카드 강화). 정보성 표시(편집 아님). */}
                  <p className="text-xs text-slate-500 mb-3">아래로 갈수록 권한이 누적됩니다. 색이 채워진 항목이 해당 역할이 가진 권한입니다.</p>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_repeat(5,38px)] items-center bg-slate-50 border-b border-slate-200 px-3 py-2">
                      <span />
                      {["조회", "요청", "승인", "관리", "삭제"].map((c) => (
                        <span key={c} className="text-[10px] font-bold text-slate-400 text-center">{c}</span>
                      ))}
                    </div>
                    {[
                      { role: "VIEWER", desc: "조직 내 데이터 조회만 가능", caps: [1, 0, 0, 0, 0] },
                      { role: "REQUESTER", desc: "견적 요청, 재고 등록 등 요청 생성", caps: [1, 1, 0, 0, 0] },
                      { role: "APPROVER", desc: "요청된 견적/구매를 승인 또는 반려", caps: [1, 1, 1, 0, 0] },
                      { role: "ADMIN", desc: "멤버 관리, 설정 변경, 전체 운영", caps: [1, 1, 1, 1, 0] },
                      { role: "OWNER", desc: "최고 관리자. 조직 삭제, 소유권 이전", caps: [1, 1, 1, 1, 1] },
                    ].map((item) => (
                      <div key={item.role} className="grid grid-cols-[1fr_repeat(5,38px)] items-center px-3 py-2.5 border-b border-slate-100 last:border-b-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-700">{ROLE_LABELS[item.role]}</p>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-400 text-[9px] px-1.5 py-0">{item.role}</Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                        {item.caps.map((on, i) => (
                          <span
                            key={i}
                            className={`w-5 h-5 mx-auto rounded-md ${on ? "bg-emerald-500" : "bg-slate-100"}`}
                            aria-label={on ? "허용" : "미허용"}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
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
                    {/* §org-management-redesign P4 — dead button 봉합: 삭제 모달(type-to-confirm) 연결.
                        소유자만 활성(권한 게이팅 — 비소유자는 사유 표기 disabled). */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-800 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                      onClick={() => { setDeleteConfirm(""); setDeleteModalOpen(true); }}
                      disabled={!isOwner}
                      title={isOwner ? undefined : "조직 소유자만 삭제할 수 있습니다"}
                    >
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

      {/* §org-management-redesign P4 — 조직 삭제(type-to-confirm) 모달. 조직명 정확 입력 시에만 활성(오삭제 방지). */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-red-600">조직 삭제</DialogTitle>
            <DialogDescription className="text-slate-500">
              이 작업은 되돌릴 수 없습니다. 조직과 모든 데이터가 영구 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">
              확인을 위해 조직명 <b className="text-slate-900">{organization?.name}</b> 을(를) 입력하세요.
            </Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={organization?.name ?? "조직명"}
              className="bg-slate-100 border-slate-200 text-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              data-testid="org-delete-confirm"
              disabled={deleteConfirm.trim() !== (organization?.name ?? "").trim() || deleteOrgMutation.isPending}
              onClick={() => deleteOrgMutation.mutate()}
            >
              {deleteOrgMutation.isPending ? "삭제 중..." : "영구 삭제"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              {/* §11.193d Phase 3 — workflow capabilities multi-checkbox.
                  RBAC role 과 별개 layer — 1인이 동시에 운영 책임자 + 승인자
                  + 요청자 보유 가능 (호영님 prototype 시안). canonical:
                  OrganizationMember.workflowCapabilities Json. resolver 가
                  DB 우선 + role 기반 fallback. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600">
                  업무 권한 (다중 선택)
                </Label>
                <p className="text-xs text-slate-500">
                  RBAC 역할과 별개로 운영 권한을 다중 부여할 수 있습니다.
                </p>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  {(() => {
                    const raw = members.find(
                      (m) => m.id === permissionDialogMember.memberId,
                    );
                    if (!raw) {
                      return (
                        <p className="text-xs text-slate-400">
                          멤버 정보를 불러오는 중입니다.
                        </p>
                      );
                    }
                    const current = resolveWorkflowCapabilities({
                      workflowCapabilities: (raw as { workflowCapabilities?: unknown })
                        .workflowCapabilities,
                      role: raw.role,
                    });
                    const isPending = updateCapabilitiesMutation.isPending;
                    return WORKFLOW_CAPABILITIES.map((cap) => {
                      const checked = current.includes(cap);
                      return (
                        <label
                          key={cap}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={isPending}
                            onCheckedChange={(v) => {
                              const next = v
                                ? (Array.from(
                                    new Set([...current, cap]),
                                  ) as WorkflowCapability[])
                                : current.filter((c) => c !== cap);
                              updateCapabilitiesMutation.mutate({
                                memberId: raw.id,
                                capabilities: next,
                              });
                            }}
                          />
                          <span className="text-sm text-slate-700">
                            {WORKFLOW_CAPABILITY_LABEL[cap]}
                          </span>
                        </label>
                      );
                    });
                  })()}
                </div>
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
