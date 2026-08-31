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
// §org-management-web P3 — 좌석 한도 canonical (P0 C1)
import { PLAN_LIMITS, SubscriptionPlan } from "@/lib/plans";
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
import { Switch } from "@/components/ui/switch";
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
  X, Send, Building2, Trash2,
  Lock, Clock, CreditCard, ClipboardCheck,
  XCircle, Check, ShieldAlert,
} from "lucide-react";
// §approver-axis ①c 되살림 — 발화 조건이 플랜의 approvalPolicy 에 걸린다.
//   approvalPolicy = "none" 인 조직에서는 승인 단계 자체가 없어 지시가 거짓이 된다.
import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";
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
import { csrfFetch } from "@/lib/api-client";
// §approver-axis (나)-2 — 승인 권한 계수 정본 (client-safe).
import { countOrgApprovers, isOrgApprover } from "@/lib/permissions/org-approver-roles";

// 역할 라벨 매핑
// §org-management-web P4b — 역할 색 점. 드롭다운 트리거와 읽기 전용 표기가 같은 색을 쓴다.
const ROLE_DOT: Record<string, string> = {
  VIEWER: "bg-slate-400",
  REQUESTER: "bg-blue-500",
  APPROVER: "bg-emerald-500",
  ADMIN: "bg-slate-900",
  OWNER: "bg-slate-900",
  MEMBER: "bg-slate-400",
};

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

/* §invite-dead-end a (호영님 승인 2026-08-31) — 초대 진입점 정직화.
 *
 * 실측 (2026-08-31 · 코드 + prod):
 *   ① 이 화면의 초대 모달은 POST /api/organizations/[id]/members 를 부르는데
 *      그 라우트에 POST 핸들러가 없다 (GET·PATCH·DELETE 만). 발송 버튼 = dead button.
 *   ② 초대 재발송이 부르는 /members/resend-invite 라우트는 존재하지 않는다.
 *   ③ 실제 초대 API(/api/organizations/[id]/invites)는 토큰을 만들지만 수락 화면
 *      /invite/[token] 이 없다 (prod 404) — §onboarding-blocker #7 의도된 미완.
 *      invite-accept-pairing 센티널이 "수락 화면 없는 동안 초대 UI 렌더 금지" 를 강제한다.
 *
 * 처방: 진입점 3곳(헤더 멤버 초대 · 승인·초대 탭 새 초대 · 멤버 탭 첫 멤버 초대하기)을
 *   **disabled + 사유** 로 둔다. 모달·mutation 코드는 지우지 않는다 — b 트랙(수락 화면 +
 *   OrganizationMember 생성 + 좌석 게이트)이 서면 이 플래그 하나로 복원한다.
 *   🛑 b 없이 이 플래그를 true 로 올리면 dead button 이 그대로 되살아난다. */
const INVITE_AVAILABLE = false;
const INVITE_UNAVAILABLE_REASON = "초대 수락 화면 준비 중입니다. 초대 기능은 곧 열립니다.";

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
  // §org-role-review (호영님 2026-06-27) — 헤더 "권한 검토" → 역할 매트릭스 + 멤버 권한 모달.
  const [roleReviewOpen, setRoleReviewOpen] = useState(false);
  // §org-management-web P2 — 상태 필터에서 "장기 미접속" 제거.
  //   추적 배선이 없어 항상 0건이던 dead filter 였다(옛 :343 `return false`).
  //   lastActive 배선이 생기면 그때 복원한다 — 없는 사실을 칩으로 세지 않는다.
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "pending">("all");
  // §org-management-web P2 — 탭은 controlled state.
  //   🛑 옛 축은 document.querySelector('[data-state][value="..."]').click() 였다.
  //      DOM 을 때려 탭을 바꾸면 React 가 모르는 전이가 생기고, 딥링크·뒤로가기가 안 선다.
  const [activeTab, setActiveTab] = useState("overview");
  // §org-management-web P4b — 변경 즉시 저장 후 행에 "✓ 저장됨" 1.5초.
  //   toast 만으로는 **어느 행이** 저장됐는지 안 보인다.
  const [savedMemberId, setSavedMemberId] = useState<string | null>(null);
  // §approver-axis (다) — P4b "역할 열 강조" 은퇴 (호영님 판정 2026-08-26).
  //   roleColumnHint 의 유일한 setter 는 "승인자 지정" CTA 였고, (다)가 그 CTA 를
  //   실행 불가능한 지시로 판정해 제거했다. 남겨두면 항상 false 인 분기가 된다.
  //   🔑 원래 있던 dead 분기를 청소하는 게 아니라 **이 슬라이스가 만든 잔해**다.
  //      자기가 만든 잔해를 다음 슬라이스로 넘기면 범위 보존이 아니라 부채 이전이다.
  //   (나)에서 승인자 축이 서면 배선은 그때 새로 한다.

  // 관리 탭 상태
  const [editName, setEditName] = useState("");
  // §org-management-redesign P4 — 조직 삭제(type-to-confirm) 모달 상태.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  // §global-toast 1b — 같은 화면 단순 저장은 toast 금지, 버튼 "✓ 저장됨" 1.5초 전환.
  const [saveFlash, setSaveFlash] = useState(false);
  // §org-settings-redesign — 초대 정책 (즉시 적용). null = 기본값.
  const [policyFlash, setPolicyFlash] = useState(false);
  // §org-settings QA 실측 결함 수정 — 연속 변경이 서버 중복 가드("처리 중인 동일 요청")에
  // 막혀 UI/DB 조용한 불일치가 남았다. in-flight 동안 컨트롤 disabled(직렬화) +
  // 낙관적 로컬 반영(느린 목록 refetch 를 기다리지 않음) + 실패 시 서버 진실로 스냅백.
  const [policySaving, setPolicySaving] = useState(false);
  const [localPolicy, setLocalPolicy] = useState<Record<string, unknown> | null>(null);
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
      const res = await csrfFetch(`/api/organizations/${params.id}`, { method: "DELETE" });
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
  // §approver-axis (나)-2 (2026-08-30) — adminCount 은퇴.
  //   유일 소비처가 아래 "승인 권한 보유자 (approverCount + adminCount)" 합산이었는데,
  //   approverCount 가 A축(APPROVER·ADMIN·OWNER)으로 넓어지면 그 합은 **중복 계수**다.
  //   축이 하나로 서면 더할 것이 없다 — 변수째 걷는다.
  const pendingCount = members.filter((m) => m.status === "Pending").length;
  // §approver-axis (나)-2 — APPROVER 단독 계수를 A축(정본)으로 통일.
  //   이전에는 이 화면의 KPI 가 APPROVER 만 세고, 같은 화면 아래 "승인 권한 보유자" 는
  //   APPROVER+ADMIN+OWNER 를 세어 **한 화면 안에서 두 수가 달랐다.**
  const approverCount = countOrgApprovers(members);

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
    return true;
  });

  // 활동 피드 (target: 하이라이트할 대상)
  // §org-management-redesign P3 — 가짜 활동 데이터 제거(§11.318 honesty). org-scoped 활동/audit
  //   엔드포인트 부재 → 정직 빈 상태. 실 audit 연동은 후속(엔드포인트 신설 별 트랙).
  const organizationLogs: Array<{ id: string; actor: string; action: string; time: string; target?: string }> = [];

  // 초대 재발송
  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await csrfFetch(`/api/organizations/${params.id}/members/resend-invite`, {
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
      const response = await csrfFetch(`/api/organizations/${params.id}/members`, {
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
      const response = await csrfFetch(`/api/organizations/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", params.id] });
      toast({ title: "역할 변경 완료" });
      setSavedMemberId(variables.memberId);
      setTimeout(() => setSavedMemberId((cur) => (cur === variables.memberId ? null : cur)), 1500);
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
      const response = await csrfFetch(
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
      const response = await csrfFetch(`/api/organizations/${params.id}/members?memberId=${memberId}`, { method: "DELETE" });
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
  // §org-settings-redesign — 초대 정책 파생값 (서버 null → 현행 기본과 동일).
  const effectivePolicy = {
    defaultRole: "VIEWER",
    expiresInDays: 7,
    adminOnlyInvite: true,
    ...((organization as any)?.invitePolicy && typeof (organization as any).invitePolicy === "object"
      ? (organization as any).invitePolicy
      : {}),
    ...(localPolicy ?? {}),
  } as { defaultRole: string; expiresInDays: number; adminOnlyInvite: boolean };

  // 정책 변경 즉시 적용 — PATCH invitePolicy (서버가 기존 정책 위에 병합).
  const handlePolicyChange = async (patch: Partial<typeof effectivePolicy>) => {
    if (policySaving) return; // 직렬화 — 서버 중복 가드와의 충돌 원천 차단
    setPolicySaving(true);
    setLocalPolicy((prev) => ({ ...(prev ?? {}), ...patch })); // 낙관적 반영 (즉시 표시)
    try {
      const res = await csrfFetch(`/api/organizations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: organization?.name ?? editName, invitePolicy: patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "정책 저장에 실패했습니다.");
      }
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setPolicyFlash(true);
      setTimeout(() => setPolicyFlash(false), 1500);
    } catch (e: any) {
      // 실패 시 낙관값 제거 → 서버 진실로 스냅백 (조용한 UI/DB 불일치 금지)
      setLocalPolicy(null);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "정책 저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setPolicySaving(false);
    }
  };

  // §org-settings-redesign — dirty 시에만 저장 버튼 활성 (변경 없으면 disabled).
  const isBasicDirty = !!organization && (
    editName.trim() !== (organization.name || "") ||
    editDescription.trim() !== (organization.description || "") ||
    editSlug.trim() !== (organization.slug || "")
  );

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSavingName(true);
    try {
      const res = await csrfFetch(`/api/organizations/${params.id}`, {
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
      // §global-toast 1b — 성공 toast 제거: 같은 화면 완료 저장은 버튼 전환으로 알린다.
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
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
  // §org-management-web P3 — 좌석 한도는 PLAN_LIMITS 가 canonical 이다.
  //   🛑 옛 축은 Math.max(totalMembers + 2, 10) 이라는 **추정 공식**이었다 — 멤버가 늘면
  //      분모도 같이 늘어 사용률이 영원히 100% 에 안 닿는 가짜 게이지였다.
  //   🛑 Organization.maxMembers 컬럼은 쓰지 않는다 — 생산자 0 · 소비자 0 인 dead column 이고,
  //      살리면 PLAN_LIMITS 와 진실이 둘이 된다 (P0 C1 판정 2026-08-24).
  const seatLimit = PLAN_LIMITS[(organization as any).plan as SubscriptionPlan]?.maxMembers ?? null;
  const seatUsagePercent = seatLimit && seatLimit > 0
    ? Math.min(100, Math.round((totalMembers / seatLimit) * 100))
    : 0;
  // §org-management-web v2 후속 (호영님 배포본 QA 2026-08-31) — 게이지 앰버는 **초과**에만.
  //   Free 는 maxMembers 1 이라 정상 상태가 곧 100% 다. 100% 를 앰버로 칠하면 Free 단일
  //   사용자에게 상시 경고색이 뜬다 — 사실(꽉 찼다)을 경보(문제다)로 승격시키는 셈.
  //   앰버 = 상태 전용 토큰이므로 실제 이상(한도 초과)에만 쓴다. 꽉 찬 것은 블루로 사실만 말한다.
  const seatOver = seatLimit !== null && seatLimit > 0 && totalMembers > seatLimit;

  // 바로 처리 항목
  // §11.303-hotfix-d — SWC parser nested generic bug 회피: Array<...
  //   React.ComponentType<{ className?: string }>> 의 nested <> 가 다음
  //   JSX `<div` 를 generic 으로 잘못 parse. React.ElementType 단일
  //   token + postfix `[]` 으로 nested generic 제거.
  // §org-management-web P4a — 처리 항목은 **결과**와 **행동**을 함께 말한다.
  //   숫자만 보여주면 "그래서 무엇이 문제인가" 를 사용자가 추론해야 한다.
  const actionableItems: {
    label: string; consequence: string; count: number;
    icon: React.ElementType; color: string; actionLabel: string; onAction: () => void;
  }[] = [];
  if (pendingCount > 0) actionableItems.push({
    label: "초대 응답 대기", consequence: "초대받은 멤버가 아직 참여하지 않았습니다",
    count: pendingCount, icon: Mail, color: "text-yellow-500",
    actionLabel: "초대 확인", onAction: () => setActiveTab("invites"),
  });
  /* §approver-axis ①c 되살림 (호영님 판정 2026-08-30) — **(다) 근거 소멸**.
   *
   * (다)가 이 항목을 내린 이유는 "끝까지 따라가 APPROVER 를 줘도 승인이 안 열린다"
   * 였다(승인 라우트가 TeamRole.ADMIN 을 봤고 prod Team 0). (나)-1b 가 그 게이트를
   * 조직 축으로 교체했고, tvkl 3단 실측(3569ede8)으로 도달을 확인했다:
   *   ① 역할 변경이 APPROVER 를 실제로 쓴다 ② 부여받은 계정이 승인 게이트를 통과한다
   *   ③ 예산 게이트까지 도달한다(auditEvent 생성)
   * → 되살림의 조건은 "게이트가 열렸다" 가 아니라 **"지시를 따라가면 끝까지 도달한다"**
   *   이고, 그것이 성립했다.
   *
   * 🛑 그러나 조건 없이 되살리면 (다)를 만든 원인을 재생산한다. 실측이 문구보다 큰
   *   사실을 하나 더 줬다 — **승인권자 0이 항상 문제인 게 아니다.**
   *     approvalPolicy = "none"  (FREE · Basic)      승인 단계 자체가 없다.
   *                                                  요청이 멈추지 않는다 → 지시가 거짓.
   *     approvalPolicy = in_app_approval             승인권자 0이면 요청이 PENDING 에서
   *       (ORGANIZATION · Enterprise)                **멈춘다** → 지시가 참.
   *   prod T1 이 정확히 전자다(FREE · 승인권자 1). 거기에 이 경보를 띄우면 틀린 경보다.
   *
   * 🛑 옛 consequence `구매 요청이 승인 단계 없이 통과됩니다` 는 **사실이 반대**였다.
   *   멈추는 것이지 통과하는 것이 아니다. 그 문안은 되살리지 않는다(sentinel 금지 유지). */
  const approvalPolicy = resolveApprovalPolicyForPlan((organization as any).plan);
  /* §org-management-web v2-1 (호영님 2026-08-30 리뷰) — KPI 앰버와 처리 항목 큐는
   *   **같은 상태(approverGap)에서 파생**된다. 배포본에서 KPI 는 앰버인데 큐는
   *   "없습니다" 인 모순이 확인됐다 — 두 표면이 다른 조건을 보고 있었기 때문이다.
   *   approvalPolicy = "none"(FREE·Basic)이면 승인 단계 자체가 없어 gap 이 아니다
   *   — 큐만이 아니라 KPI 앰버 톤도 함께 꺼진다. */
  const approverGap = approvalPolicy !== "none" && approverCount === 0;
  if (approverGap) actionableItems.push({
    label: "승인자 미지정",
    consequence: "승인할 사람이 없어 요청이 멈춥니다",
    count: 1, icon: ShieldAlert, color: "text-yellow-600",
    actionLabel: "승인자 지정", onAction: () => setActiveTab("members"),
  });

  return (
    /* §org-management-web P6 — 좌우 여백 부재 봉합.
     * §dashboard-padding-unify(2026-07-04) 가 셸 <main> 의 uniform 패딩을 걷어내며
     * "각 페이지가 자기 패딩을 갖는다" 로 바꿨는데, 이 페이지는 그때 패딩을 못 받았다.
     * 실측(2026-08-25 프로덕션): 콘텐츠 left=256 (사이드바 우측 끝과 동일) · pL/pR=0.
     * 리스트 페이지(organizations/page.tsx:343)와 동일 래퍼로 맞춘다. */
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-6">
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
            {/* §org-management-web P3 — 헤더 메타.
                🛑 핸드오프 §2 는 "조직 주소 + 생성일" 이었으나 Organization 스키마에
                   물리 주소 필드가 없다(slug 는 URL 식별자다). 없는 사실을 표기하지 않는다
                   — 생성일만 넣는다 (호영님 판정 2026-08-24). */}
            {(organization as any).createdAt && (
              <p className="text-xs text-slate-400 mt-1 tabular-nums">
                생성일 {new Date((organization as any).createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
        </div>
        {/* 상단 CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              {/* §org-management-web P3 — CTA 는 주 1 + 보조 1 두 개다.
                  삭제 2건과 그 대체:
                    초대 관리    → KPI "초대 대기" 카드가 승인·초대 탭 직행 (화면 내 정보 중복 제거)
                    플랜/좌석 보기 → KPI 4번째 카드에 흡수(게이지 + 변경 링크) */}
              <Button
                disabled={!INVITE_AVAILABLE}
                title={INVITE_AVAILABLE ? undefined : INVITE_UNAVAILABLE_REASON}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                onClick={() => setInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                멤버 초대
              </Button>
              <Button
                variant="outline"
                className="border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => setRoleReviewOpen(true)}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                권한 검토
              </Button>
              {!INVITE_AVAILABLE && (
                <p className="basis-full text-right text-[11px] text-slate-400">{INVITE_UNAVAILABLE_REASON}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* §org-role-review — 권한 검토 모달: 실 멤버 권한 + 역할별 권한 범위 매트릭스(정보성, 편집 아님). */}
      <Dialog open={roleReviewOpen} onOpenChange={setRoleReviewOpen}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />권한 검토
            </DialogTitle>
            <DialogDescription>멤버별 역할과 역할별 권한 범위를 확인합니다.</DialogDescription>
          </DialogHeader>

          {/* 멤버 권한 — 실 멤버 데이터 */}
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">멤버 권한 <span className="text-slate-400">({teamMembers.length})</span></p>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {teamMembers.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">멤버가 없습니다.</p>
              ) : (
                teamMembers.map((m) => (
                  <div key={m.memberId} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{m.initial}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.name}{m.isMe && <span className="text-[10px] text-blue-500 ml-1">(나)</span>}</p>
                      <p className="text-xs text-slate-400 truncate">{m.email}</p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs flex-shrink-0">{ROLE_LABELS[m.rawRole || ""] ?? m.rawRole ?? "—"}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 역할별 권한 범위 — 누적 매트릭스(정보성) */}
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-1">역할별 권한 범위</p>
            <p className="text-[11px] text-slate-500 mb-2">아래로 갈수록 권한이 누적됩니다. 색이 채워진 항목이 해당 역할이 가진 권한입니다.</p>
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
                    <span key={i} className={`w-5 h-5 mx-auto rounded-md ${on ? "bg-emerald-500" : "bg-slate-100"}`} aria-label={on ? "허용" : "미허용"} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setRoleReviewOpen(false)}>닫기</Button>
            {isAdmin && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setRoleReviewOpen(false); setActiveTab("members"); }}>
                멤버 역할 편집
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* §org-management-web P6 은퇴 (호영님 판정 2026-08-25 · 실측 QA):
       *   §org-management-redesign P3 의 "요약 한 줄 바" 를 제거한다.
       *
       * 왜: 바로 아래 KPI 4카드가 **같은 4축을 다 말하면서** 행동까지 갖는다
       *   (초대 대기 → 탭 직행 · 승인 권한 → "지정 필요" 배지 · 플랜 → 게이지 + 변경 링크).
       *   요약 바는 그 부분집합을 행동 없이 12px 위에서 반복했다. 프로덕션 화면에서
       *   같은 숫자 네 개가 위아래로 두 번 찍혔다.
       *
       * 축 손실 0 확인 (이게 은퇴를 안전하게 만드는 근거다):
       *   멤버·초대 대기·승인 권한·플랜 → KPI 4카드가 그대로 든다.
       *   "활성" 만 KPI 에 없는데, activeCount = members.filter(status !== "Pending")
       *   이고 pendingCount = members.filter(status === "Pending") 라
       *   activeCount === totalMembers - pendingCount 로 **완전 파생**이다(:332-335).
       *   멤버 탭 필터 칩에도 활성 축이 그대로 있다. 새 사실을 잃지 않는다.
       *
       * 잠금: 이 은퇴만 하면 새 결정이 무잠금이 된다(§verification-loss-three-paths 2번).
       *   org-detail-redesign-p3 · org-redesign-smoke-p5 의 요약 바 단언을 은퇴시키고
       *   같은 자리에 역방향 잠금(요약 바 복귀 시 RED)을 넣었다. */}

      {/* §org-management-web P3 — KPI 4카드.
          헤더에서 뺀 두 CTA 가 여기로 들어온다: 초대 대기 카드가 탭 직행,
          플랜·좌석 카드가 게이지 + 변경 링크. 상단 1행 좌측 쏠림도 여기서 해소된다. */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-semibold text-slate-600">멤버</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalMembers}</p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors"
          onClick={() => setActiveTab("invites")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-yellow-500" />
              <p className="text-xs font-semibold text-slate-600">초대 대기</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{pendingCount}</p>
            <p className="text-xs text-slate-400 mt-1">승인 및 초대 열기 ›</p>
          </CardContent>
        </Card>

        <Card className={`shadow-sm bg-white ${approverGap ? "border-yellow-300" : "border-slate-200"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className={`h-4 w-4 ${approverGap ? "text-yellow-500" : "text-emerald-500"}`} />
              <p className="text-xs font-semibold text-slate-600">승인 권한</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{approverCount}</p>
              {/* §approver-axis (다) — "지정 필요" 배지 제거. 지정 수단이 없다.
                  수(approverCount)와 주의 톤은 표시형이라 그대로 둔다. */}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-semibold text-slate-600">{planLabel} 플랜</p>
              </div>
              <Link href="/dashboard/settings/plans" className="text-xs text-blue-600 hover:underline">
                변경 ›
              </Link>
            </div>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              {totalMembers} / {seatLimit ?? "무제한"} 좌석
            </p>
            {seatLimit !== null && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${seatOver ? "bg-yellow-500" : "bg-blue-500"}`}
                  style={{ width: `${seatUsagePercent}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 탭 구조 — 5탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* §org-management-web P3 — 밑줄형 탭. C2 정본 = analytics(9042c438) 2.5px #2563eb
            (호영님 판정 2026-08-24 · 최신 · 목적 일치 · 핸드오프 일치). */}
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0">
          <TabsTrigger value="overview" className="rounded-none border-b-[2.5px] border-transparent px-3 pb-2 text-slate-500 data-[state=active]:border-[#2563eb] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            개요
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-none border-b-[2.5px] border-transparent px-3 pb-2 text-slate-500 data-[state=active]:border-[#2563eb] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            멤버 및 접근
          </TabsTrigger>
          <TabsTrigger value="invites" className="rounded-none border-b-[2.5px] border-transparent px-3 pb-2 text-slate-500 data-[state=active]:border-[#2563eb] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            승인 및 초대
          </TabsTrigger>
          {/* §org-management-web v2-3 (호영님 2026-08-30 리뷰) — "활동 및 감사" 탭 은퇴.
              사이드바 전역 통합 로그(/dashboard/audit)와 중복인 빈 껍데기였다(org-scoped
              엔드포인트 부재 → 항상 빈 상태). 조직 활동은 개요의 최근 활동 요약 +
              전체 활동 로그 딥링크(조직 필터)가 대체한다. 5탭 → 4탭. */}
          {isAdmin && (
            <TabsTrigger value="settings" className="rounded-none border-b-[2.5px] border-transparent px-3 pb-2 text-slate-500 data-[state=active]:border-[#2563eb] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              정책 및 설정
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== 개요 탭 ===== */}
        <TabsContent value="overview">
          {/* §org-management-web P4a — 2열 그리드(1fr + 380px).
              🛑 기존 정적 3카드(멤버 현황 / 초대 상태 / 승인 체계)는 삭제하고 우측 구성 요약이 흡수한다.
                 "관리자 N명" 요약 칩도 그 카드 안에 있었다 — 핸드오프 §4 는 멤버 탭 소관으로 적었지만
                 실물은 개요 탭이었다 (실측이 문서를 정정 · P2 노트).
              🛑 플랜 카드는 여기 두지 않는다 — P3 에서 KPI 4번째 카드가 이미 흡수했다.
                 다시 두면 핸드오프 §2 가 "플랜/좌석 보기" 를 지운 이유(화면 내 정보 중복)를
                 그대로 재생산한다 (실측이 문서를 정정 2건째). */}
          {/* §org-management-web v2-1·v2-2 (호영님 2026-08-30 리뷰) —
              ① 처리 항목 0건이면 **카드째 미노출** (빈 박스 금지 — §1 규칙의 상세 탭 적용).
                 카드가 빠지면 2열을 유지할 좌측이 없으므로 그리드도 1열로 접는다.
              ② 두 카드는 같은 그리드 행에 직접 놓는다(중간 래퍼 제거) — grid 기본
                 stretch 로 같은 시작선·같은 높이. items-start 가 높이 불일치의 원인이었다. */}
          <div className={`grid gap-4 ${actionableItems.length > 0 ? "lg:grid-cols-[1fr_380px]" : ""}`}>
            {/* 좌 — 바로 처리할 항목 (0건 미노출) */}
            {actionableItems.length > 0 && (
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">바로 처리할 항목</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {actionableItems.map((item, idx) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-yellow-200 bg-yellow-50/40 p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 rounded bg-white border border-yellow-200 p-1">
                              <ItemIcon className={`h-4 w-4 ${item.color}`} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {item.label} <span className="tabular-nums text-slate-500">{item.count}건</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">{item.consequence}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="shrink-0 border-slate-200 text-slate-700 hover:bg-white" onClick={item.onAction}>
                            {item.actionLabel}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 우 — 최근 활동 (구성 요약 은퇴로 이 자리를 승계).
                🛑 구성 요약 카드는 은퇴했다 — 멤버·초대 대기·승인자 세 축을 KPI 4카드가
                   이미 들고 있어 같은 값을 한 화면에 두 번 그리고 있었다 (P6 실측).
                   3축을 빼면 그 카드에 남는 것이 0 이라 카드째 은퇴다.
                   2열(1fr_380px)은 P4a 결정이라 유지하고, 우측을 최근 활동이 승계한다. */}
                <Card className="shadow-sm border-slate-200 bg-white">
                  <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-semibold text-slate-900">최근 활동</CardTitle>
                    {/* §org-management-web v2-3 — 활동 및 감사 탭 은퇴. 전체 로그는
                        사이드바 전역 통합 로그(/dashboard/audit)가 정본이다 — 조직 필터
                        쿼리(org)를 실어 딥링크한다. */}
                    <Link
                      href={`/dashboard/audit?org=${params.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      전체 활동 로그 ›
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {organizationLogs.length === 0 ? (
                      /* §11.318 honesty 승계 — org-scoped 활동 엔드포인트가 아직 없다.
                         가짜 피드를 만들지 않고 없다는 사실을 그대로 적는다. */
                      <p className="text-sm text-slate-400 py-2">아직 기록된 활동이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {organizationLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{log.actor} · {log.action}</span>
                            <span className="text-slate-400 tabular-nums">{log.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
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
              {(["all", "active", "pending"] as const).map((f) => {
                const labels: Record<string, string> = { all: "전체", active: "활성", pending: "초대 대기" };
                const counts: Record<string, number> = {
                  all: totalMembers,
                  active: activeCount,
                  pending: pendingCount,
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
                    {labels[f]} <span className="font-bold">{counts[f]}</span>
                  </button>
                );
              })}
            </div>

            {/* §org-management-web v2-4 (호영님 2026-08-30 리뷰) — 역할별 세그먼트 칩
                ("관리자 1명" 등) 제거: 역할 분포는 테이블 역할 열이 이미 행 단위로
                말한다. 테이블 위 회색 칩 부유가 §4 "관리자 N명 요약 칩 제거" 의 실물. */}

            {/* §org-management-web P6 (호영님 판정 2026-08-25) — 캡션이 없는 것을 가리키지 않는다.
              * 관리 컬럼은 본인 행에서 "-" 다(:1167). 멤버가 본인뿐이면 그 열에 메뉴가 하나도
              * 없는데 캡션은 "관리 컬럼의 메뉴에서 …처리하세요" 라고 안내했다 — 거짓 안내다.
              * 자기 외 행이 하나라도 있을 때만(초대 대기 행 포함 — members 에 함께 담긴다) 뒷문장을 켠다. */}
            <p className="text-xs text-slate-500">
              멤버별 역할을 선택하면 즉시 저장됩니다.
              {totalMembers > 1 && " 관리 컬럼의 메뉴에서 초대 재발송, 멤버 제거 등 운영 액션을 처리하세요."}
            </p>

            {filteredTeamMembers.length === 0 ? (
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 text-slate-600 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">
                    {teamMembers.length === 0 ? "멤버가 없습니다." : "검색 조건에 맞는 멤버가 없습니다."}
                  </p>
                  {isAdmin && teamMembers.length === 0 && (
                    <>
                      <Button
                        disabled={!INVITE_AVAILABLE}
                        title={INVITE_AVAILABLE ? undefined : INVITE_UNAVAILABLE_REASON}
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => setInviteModalOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        첫 멤버 초대하기
                      </Button>
                      {!INVITE_AVAILABLE && (
                        <p className="mt-2 text-[11px] text-slate-400">{INVITE_UNAVAILABLE_REASON}</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* v2-4 — 흰 카드 래핑(보더 #e2e8f0=slate-200 + radius 14) — 핸드오프 §6.4 */
              <Card className="bg-white rounded-[14px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100/50 border-slate-200">
                        <TableHead className="font-semibold text-slate-600">팀원</TableHead>
                        <TableHead className="font-semibold text-slate-600">역할</TableHead>
                        <TableHead className="font-semibold text-slate-600">상태</TableHead>
                        <TableHead className="font-semibold text-slate-600 hidden md:table-cell">참여일</TableHead>
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
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={rawMember.role}
                                    onValueChange={(v) => updateRoleMutation.mutate({ memberId: rawMember.id, role: v })}
                                    disabled={updateRoleMutation.isPending}
                                  >
                                    <SelectTrigger className="w-[150px] h-9 text-sm border-slate-200">
                                      <span className={`h-2 w-2 rounded-full shrink-0 ${ROLE_DOT[rawMember.role] || "bg-slate-400"}`} />
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(["VIEWER", "REQUESTER", "APPROVER", "ADMIN"] as const).map((r) => (
                                        <SelectItem key={r} value={r}>
                                          <span className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${ROLE_DOT[r]}`} />
                                            {ROLE_LABELS[r]}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {savedMemberId === rawMember.id && (
                                    <span className="text-xs font-medium text-emerald-600 whitespace-nowrap">✓ 저장됨</span>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className="flex items-center gap-2 text-sm text-slate-600">
                                    <span className={`h-2 w-2 rounded-full ${ROLE_DOT[rawMember?.role || member.rawRole || ""] || "bg-slate-400"}`} />
                                    {ROLE_LABELS[rawMember?.role || member.rawRole || ""] || "멤버"}
                                  </span>
                                  {isSelfAdmin && (
                                    <span className="mt-0.5 block text-[11px] text-slate-400">본인 역할 변경 불가</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-4">
                              {isPending ? (
                                <Badge variant="secondary" className="text-xs bg-yellow-50 text-yellow-700">초대 대기</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700">활성</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-4 hidden md:table-cell">
                              <span className="text-xs text-slate-400">
                                {rawMember?.createdAt
                                  ? new Date(rawMember.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
                                  : "-"}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="py-4 text-right">
                                {member.rawRole === "OWNER" ? (
                                  <Lock className="h-4 w-4 text-slate-600 mx-auto" />
                                ) : rawMember && !isSelfAdmin && isPending ? (
                                  /* §org-management-web P4b — 초대 대기 행은 ⋮ 안에 숨기지 않는다.
                                     재발송·취소는 이 행에서 할 일의 전부라 한 단계를 더 거칠 이유가 없다. */
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-8 border-slate-200 text-slate-600 hover:bg-slate-100"
                                      onClick={() => resendInviteMutation.mutate(rawMember.id)}
                                    >
                                      <Send className="h-3.5 w-3.5 mr-1" />초대 재발송
                                    </Button>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={() => { if (confirm("초대를 취소하시겠습니까?")) removeMemberMutation.mutate(rawMember.id); }}
                                    >
                                      <X className="h-3.5 w-3.5 mr-1" />초대 취소
                                    </Button>
                                  </div>
                                ) : rawMember && !isSelfAdmin ? (
                                  // §11.303-hotfix-e — JSX 주석 sibling 제거 (fragment 없이 인접하면 SWC parser fail, 진짜 root cause).
                                  <ActionMenu
                                    menuId={`org-member-${rawMember.id}`}
                                    currentOpenId={openMemberActionId}
                                    onOpenChange={setOpenMemberActionId}
                                    items={[
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
            {/* §org-management-web v2-5 (호영님 2026-08-30 리뷰) — 탭 헤더의 "새 초대"
                버튼 제거: 페이지 헤더 "멤버 초대" 와 중복이었다. 탭 내 초대 진입은
                0건 접힌 행 안의 1개만 남긴다. */}
            <h3 className="font-bold text-lg text-slate-900">승인 및 초대 관리</h3>

            {/* 초대 대기 목록 — 0건이면 접힌 1줄 (빈 안내문 카드로 큰 공간 점유 금지) */}
            {pendingCount === 0 ? (
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-4 w-4 text-slate-400" />
                    초대 대기 없음
                    {!INVITE_AVAILABLE && (
                      <span className="text-[11px] text-slate-400">· {INVITE_UNAVAILABLE_REASON}</span>
                    )}
                  </p>
                  {isAdmin && (
                    <Button
                      size="sm"
                      disabled={!INVITE_AVAILABLE}
                      title={INVITE_AVAILABLE ? undefined : INVITE_UNAVAILABLE_REASON}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setInviteModalOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      새 초대
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
            <Card className="shadow-sm border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-yellow-500" />
                  초대 대기 ({pendingCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            )}

            {/* 승인자 현황 */}
            <Card className="shadow-sm border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  승인 권한 보유자 ({approverCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {countOrgApprovers(members) === 0 ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    {/* §approver-axis (다) — "지정해 주세요" 는 실행 불가능한 지시였다.
                        조직 범위에 지정 수단이 없으므로 사실만 적는다. */}
                    <p className="text-sm text-slate-400">승인 권한을 가진 멤버가 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.filter((m) => isOrgApprover(m.role)).map((m) => {
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
                  {/* §org-settings-redesign — 아바타 52px + 버튼 1행 */}
                  <div className="flex items-center gap-3">
                    <div className="w-[52px] h-[52px] shrink-0 rounded-full border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt="조직 로고"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-slate-400">
                          {(editName || organization?.name || "조")[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
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
                      className="bg-white border-slate-200 text-slate-900"
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
                        className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white text-slate-900"
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
                      rows={2}
                      className="resize-y bg-white border-slate-200 text-slate-900"
                    />
                  </div>
                  <Button
                    onClick={handleSaveName}
                    disabled={isSavingName || saveFlash || !editName.trim() || !isBasicDirty}
                    className={saveFlash
                      ? "border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] hover:bg-[#f0fdf4]"
                      : "bg-blue-600 hover:bg-blue-700 text-slate-900"}
                  >
                    {isSavingName ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />저장 중...</>
                    ) : saveFlash ? (
                      <><Check className="mr-2 h-4 w-4" />저장됨</>
                    ) : "변경 사항 저장"}
                  </Button>
                </CardContent>
              </Card>

              {/* 초대 정책 */}
              {/* §org-settings-redesign — 정책 행: 즉시 적용 · 드롭다운/스위치 실컨트롤 (정적 pill 대체) */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base text-slate-900">초대 정책</CardTitle>
                    <CardDescription className="text-slate-400">새 멤버 초대 시 적용되는 기본 정책입니다. 변경 즉시 적용됩니다.</CardDescription>
                  </div>
                  {policyFlash && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-xs font-medium text-[#15803d]">
                      <Check className="h-3 w-3" />저장됨
                    </span>
                  )}
                </CardHeader>
                <CardContent className="divide-y divide-[#f1f5f9]">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">기본 역할</p>
                      <p className="text-[11.5px] text-slate-500">새 초대 멤버에게 부여되는 기본 역할</p>
                    </div>
                    <Select
                      value={effectivePolicy.defaultRole}
                      onValueChange={(v) => handlePolicyChange({ defaultRole: v })}
                      disabled={policySaving}
                    >
                      <SelectTrigger className="w-[168px] bg-white border-slate-200 focus:ring-[rgba(37,99,235,.25)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[13px] border-slate-200 p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
                        {[
                          { v: "VIEWER", name: "조회자", dot: "#64748b", desc: "견적·재고 열람만 가능" },
                          { v: "REQUESTER", name: "요청자", dot: "#2563eb", desc: "구매 요청 생성 가능" },
                          { v: "APPROVER", name: "승인자", dot: "#7c3aed", desc: "요청 검토·승인 가능" },
                          // 관리자 점 = 먹색 slate-900 — amber 금지 조항 준수 (호영님 판정 8/21 · 핸드오프 #b45309 대체)
                          { v: "ADMIN", name: "관리자", dot: "#0f172a", desc: "조직·멤버·정책 관리" },
                        ].map((r) => (
                          <SelectItem key={r.v} value={r.v} className="rounded-lg data-[state=checked]:bg-[#eff6ff] focus:bg-[#f8fafc]">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.dot }} />
                              <span className="flex flex-col text-left">
                                <span className="text-[12.5px] font-bold leading-tight">{r.name}</span>
                                <span className="text-[11px] text-slate-500 leading-tight">{r.desc}</span>
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">초대 만료 기간</p>
                      <p className="text-[11.5px] text-slate-500">응답 없는 초대가 자동 만료되는 기간</p>
                    </div>
                    <Select
                      value={String(effectivePolicy.expiresInDays)}
                      onValueChange={(v) => handlePolicyChange({ expiresInDays: Number(v) })}
                      disabled={policySaving}
                    >
                      <SelectTrigger className="w-[112px] bg-white border-slate-200 focus:ring-[rgba(37,99,235,.25)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[13px] border-slate-200 p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
                        {[1, 3, 7, 14, 30].map((d) => (
                          <SelectItem key={d} value={String(d)} className="rounded-lg data-[state=checked]:bg-[#eff6ff] focus:bg-[#f8fafc]">
                            <span className="text-[12.5px] font-bold">{d}일</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">관리자만 초대 가능</p>
                      <p className="text-[11.5px] text-slate-500">끄면 일반 멤버도 새 멤버를 초대할 수 있습니다</p>
                    </div>
                    <Switch
                      checked={effectivePolicy.adminOnlyInvite}
                      onCheckedChange={(v) => handlePolicyChange({ adminOnlyInvite: v })}
                      disabled={policySaving}
                      className="data-[state=checked]:bg-[#2563eb] data-[state=unchecked]:bg-[#e2e8f0]"
                    />
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

              {/* §org-management-web v2-6 (호영님 2026-08-30 리뷰) — 과채색 제거.
                  레드 보더 박스 중첩 + 레드 타이틀·아이콘은 위험을 두 번 세 번 외치는
                  장식이었다. 일반 흰 카드 + 제목 일반 톤 + 설명 1줄, 레드는 우측
                  아웃라인 버튼 1개만. 위험의 실질 방어는 type-to-confirm 모달이 담당. */}
              <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">조직 삭제</p>
                    <p className="text-xs text-slate-500 mt-0.5">조직과 모든 데이터가 영구적으로 삭제됩니다.</p>
                  </div>
                  {/* §org-management-redesign P4 — dead button 봉합: 삭제 모달(type-to-confirm) 연결.
                      소유자만 활성(권한 게이팅 — 비소유자는 사유 표기 disabled). */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => { setDeleteConfirm(""); setDeleteModalOpen(true); }}
                    disabled={!isOwner}
                    title={isOwner ? undefined : "조직 소유자만 삭제할 수 있습니다"}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    조직 삭제
                  </Button>
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
              className="bg-white border-slate-200 text-slate-900"
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
                  <SelectTrigger className="border-slate-200 text-slate-900">
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
