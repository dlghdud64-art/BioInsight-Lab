"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Users, Loader2, ChevronDown, ChevronRight, ExternalLink, UserPlus, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrgRow {
  id: string | number;
  name: string;
  description: string;
  memberCount: number;
  adminCount: number;
  pendingCount: number;
  plan: string;
  role: string;
}

/* ------------------------------------------------------------------ */
/*  Role helpers                                                       */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<string, string> = {
  OWNER: "소유자",
  ADMIN: "관리자",
  APPROVER: "승인자",
  REQUESTER: "요청자",
  VIEWER: "조회자",
};

const ROLE_COLOR: Record<string, string> = {
  OWNER: "border-amber-700 bg-amber-950/40 text-amber-300",
  ADMIN: "border-indigo-700 bg-indigo-950/40 text-indigo-300",
  APPROVER: "border-purple-700 bg-purple-950/40 text-purple-300",
  REQUESTER: "border-blue-700 bg-blue-950/40 text-blue-300",
  VIEWER: "border-slate-700 bg-slate-800 text-slate-400",
};

function roleBadge(role: string) {
  const label = ROLE_LABEL[role] ?? role;
  const color = ROLE_COLOR[role] ?? ROLE_COLOR.VIEWER;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${color}`}>
      {label}
    </Badge>
  );
}

function planBadge(plan: string) {
  const label = plan === "ORGANIZATION" ? "Pro" : plan === "TEAM" ? "Basic" : "Starter";
  const color =
    plan === "ORGANIZATION"
      ? "border-indigo-800 bg-indigo-950/40 text-indigo-300"
      : plan === "TEAM"
        ? "border-blue-800 bg-blue-950/40 text-blue-300"
        : "border-slate-700 bg-slate-800 text-slate-400";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${color}`}>
      {label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Mapper                                                             */
/* ------------------------------------------------------------------ */

function mapOrg(org: any): OrgRow {
  return {
    id: org.id,
    name: org.name ?? "",
    description: org.description ?? "",
    memberCount: org.memberCount ?? (Array.isArray(org.members) ? org.members.length : 0),
    adminCount: org.adminCount ?? 0,
    pendingCount: org.pendingCount ?? 0,
    plan: org.plan ?? "FREE",
    role: org.role ?? "VIEWER",
  };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function OrganizationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [formData, setFormData] = useState({ name: "", description: "", organizationType: "" });

  /* ---------- data fetching ---------- */

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setIsFetching(false);
      return;
    }

    let cancelled = false;

    const fetchOrganizations = async () => {
      try {
        setIsFetching(true);
        const res = await fetch("/api/organizations");
        if (!res.ok) throw new Error(`Failed to fetch organizations: ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          const raw = Array.isArray(json.organizations) ? json.organizations : [];
          setOrganizations(raw.map(mapOrg));
        }
      } catch (error) {
        console.error("[OrganizationsPage] Error fetching organizations:", error);
        if (!cancelled) {
          setOrganizations([]);
          toast({
            title: "조직 목록을 불러오지 못했습니다.",
            description: "잠시 후 다시 시도해주세요.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    fetchOrganizations();
    return () => { cancelled = true; };
  }, [status, toast]);

  /* ---------- create org ---------- */

  const handleCreateOrg = async () => {
    if (!formData.name.trim()) {
      toast({ title: "입력 필요", description: "조직 이름을 입력해주세요.", variant: "destructive" });
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          organizationType: formData.organizationType.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          (json as any)?.error ??
          (json as any)?.details ??
          "조직 생성 중 오류가 발생했습니다.";
        toast({ title: "조직 생성 실패", description: message, variant: "destructive" });
        return;
      }

      const createdOrg = (json as any).organization;
      const newOrgId: string | null = createdOrg?.id ?? null;

      const mapped: OrgRow = {
        id: newOrgId ?? String(Date.now()),
        name: createdOrg?.name ?? formData.name.trim(),
        description: createdOrg?.description ?? formData.description.trim() ?? "",
        memberCount: Array.isArray(createdOrg?.members) ? createdOrg.members.length : 1,
        adminCount: 1,
        pendingCount: 0,
        plan: createdOrg?.plan ?? "FREE",
        role: "OWNER",
      };
      setOrganizations((prev) => [mapped, ...prev]);

      toast({ title: "조직 생성 완료", description: "새로운 조직이 성공적으로 생성되었습니다." });
      setIsOpen(false);
      setFormData({ name: "", description: "", organizationType: "" });

      if (newOrgId) router.push(`/dashboard/organizations/${newOrgId}`);
    } catch (error) {
      console.error("[OrganizationsPage] Unexpected error creating organization:", error);
      toast({ title: "조직 생성 실패", description: "통신이 일시적으로 원활하지 않습니다.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  /* ---------- expand/collapse ---------- */

  const toggleExpand = (id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- computed ---------- */

  const totalMembers = organizations.reduce((s, o) => s + o.memberCount, 0);
  const totalPending = organizations.reduce((s, o) => s + o.pendingCount, 0);
  const myRoles = [...new Set(organizations.map((o) => o.role))];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-8 space-y-5">

        {/* ── Summary strip ─────────────────────────────── */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mr-2">총 조직</span>
                <span className="font-semibold text-slate-100">{organizations.length}</span>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mr-2">총 멤버</span>
                <span className="font-semibold text-slate-100">{totalMembers}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mr-1">내 역할</span>
                {myRoles.length > 0
                  ? myRoles.map((r) => <span key={r}>{roleBadge(r)}</span>)
                  : <span className="text-slate-400 text-xs">-</span>}
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs shrink-0"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> 조직 생성
            </Button>
          </div>
        </div>

        {/* ── Create organization dialog ────────────────── */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>새 조직 만들기</DialogTitle>
              <DialogDescription>
                연구실이나 팀의 이름을 입력하여 새로운 워크스페이스를 만듭니다.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">
                  조직 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="org-name"
                  placeholder="예: 생명공학연구소 1팀"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type">조직 유형</Label>
                <Select
                  value={formData.organizationType || undefined}
                  onValueChange={(v) => setFormData({ ...formData, organizationType: v })}
                >
                  <SelectTrigger id="org-type">
                    <SelectValue placeholder="조직 유형을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R&D 연구소">R&D 연구소</SelectItem>
                    <SelectItem value="QC/QA 품질관리">QC/QA 품질관리</SelectItem>
                    <SelectItem value="시험·검사 기관">시험·검사 기관</SelectItem>
                    <SelectItem value="대학 연구실">대학 연구실</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-desc">간단한 설명 (선택)</Label>
                <Input
                  id="org-desc"
                  placeholder="예: 단백질 구조 분석 프로젝트 팀"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>
                취소
              </Button>
              <Button onClick={handleCreateOrg} disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
                {isCreating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 생성 중...</>
                ) : (
                  "조직 생성"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Main content ──────────────────────────────── */}
        {isFetching ? (
          <LoadingSkeleton />
        ) : organizations.length === 0 ? (
          <EmptyState onOpen={() => setIsOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* -- Left: Organization table -- */}
            <div className="space-y-0 rounded-md border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">조직 운영 현황</span>
              </div>

              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px_120px] gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-900">
                <span>조직</span>
                <span className="text-center">멤버</span>
                <span className="text-center">승인권자</span>
                <span className="text-center">플랜</span>
                <span className="text-right">액션</span>
              </div>

              {/* Organization rows */}
              {organizations.map((org) => (
                <OrgRowItem
                  key={org.id}
                  org={org}
                  expanded={expandedIds.has(org.id)}
                  onToggle={() => toggleExpand(org.id)}
                  onNavigate={() => router.push(`/dashboard/organizations/${org.id}`)}
                />
              ))}
            </div>

            {/* -- Right: Side panel -- */}
            <div className="space-y-4">
              {/* Pending invites */}
              <SidePanel title="초대 대기 목록">
                {totalPending === 0 ? (
                  <p className="text-xs text-slate-500 py-2">대기 중인 초대가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {organizations
                      .filter((o) => o.pendingCount > 0)
                      .map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                          <span className="text-slate-300 truncate max-w-[160px]">{o.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-orange-800 bg-orange-950/40 text-orange-300 text-[10px] px-1.5 py-0">
                              {o.pendingCount}건 대기
                            </Badge>
                            <button
                              onClick={() => router.push(`/dashboard/organizations/${o.id}`)}
                              className="text-blue-400 hover:text-blue-300 text-[10px] underline underline-offset-2"
                            >
                              확인
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </SidePanel>

              {/* Recent role changes */}
              <SidePanel title="최근 역할 변경 로그">
                <p className="text-xs text-slate-500 py-2">역할 변경 이력이 없습니다.</p>
              </SidePanel>

              {/* Inactive members warning */}
              <SidePanel title="비활성 멤버 경고">
                <div className="flex items-start gap-2 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500">
                    장기 미접속 멤버 정보는 각 조직 관리 페이지에서 확인할 수 있습니다.
                  </p>
                </div>
              </SidePanel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function OrgRowItem({
  org,
  expanded,
  onToggle,
  onNavigate,
}: {
  org: OrgRow;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const approverCount = org.adminCount;
  const router = useRouter();

  return (
    <div className="border-b border-slate-800 last:border-0">
      {/* Main row */}
      <div
        className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_80px_120px] gap-2 px-4 py-3 items-center hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* Org name + role */}
        <div className="flex items-center gap-2 min-w-0">
          <button className="shrink-0 text-slate-500">
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <span className="text-sm font-medium text-slate-100 truncate">{org.name}</span>
          {roleBadge(org.role)}
        </div>

        {/* Member count */}
        <div className="hidden sm:flex items-center justify-center gap-1 text-xs text-slate-300">
          <Users className="h-3 w-3 text-slate-500" />
          {org.memberCount}
        </div>

        {/* Approver count */}
        <div className="hidden sm:flex items-center justify-center text-xs text-slate-300">
          {approverCount}
        </div>

        {/* Plan */}
        <div className="hidden sm:flex justify-center">
          {planBadge(org.plan)}
        </div>

        {/* Actions */}
        <div className="hidden sm:flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800"
            onClick={onNavigate}
          >
            관리 <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800"
            onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
          >
            <UserPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pl-10 space-y-2 bg-slate-900/50">
          {/* Mobile-only stats */}
          <div className="sm:hidden flex flex-wrap gap-3 text-xs text-slate-400 mb-2">
            <span>멤버 {org.memberCount}</span>
            <span>승인권자 {approverCount}</span>
            {planBadge(org.plan)}
          </div>

          {org.description && (
            <p className="text-xs text-slate-400">{org.description}</p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>초대 대기: {org.pendingCount}건</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> 최근 활동: -
            </span>
          </div>

          {/* Mobile actions */}
          <div className="sm:hidden flex gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800"
              onClick={onNavigate}
            >
              관리 <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800"
              onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
            >
              <UserPlus className="h-3 w-3 mr-1" /> 멤버 초대
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-800">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="px-3 py-1.5">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-4 w-4 rounded bg-slate-800" />
          <div className="h-4 w-40 rounded bg-slate-800" />
          <div className="h-4 w-16 rounded bg-slate-800 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 flex flex-col items-center justify-center py-20">
      <h3 className="mb-2 text-base font-medium text-slate-300">소속된 조직이 없습니다</h3>
      <p className="mb-4 text-sm text-slate-500">첫 조직을 생성하고 팀원들과 함께 시작하세요.</p>
      <Button onClick={onOpen} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
        <Plus className="mr-1 h-3.5 w-3.5" /> 새 조직 만들기
      </Button>
    </div>
  );
}
