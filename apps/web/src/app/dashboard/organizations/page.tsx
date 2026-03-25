"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Plus,
  Users,
  Loader2,
  ExternalLink,
  UserPlus,
  Clock,
  AlertTriangle,
  Settings,
  Activity,
  Building2,
  Shield,
  ChevronRight,
  Zap,
  UserCheck,
  MailWarning,
} from "lucide-react";
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
/*  Role / Plan helpers                                                */
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
  VIEWER: "border-bs bg-el text-slate-400",
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

const PLAN_MAP: Record<string, { label: string; color: string }> = {
  ENTERPRISE: {
    label: "Enterprise",
    color: "border-amber-700 bg-amber-950/40 text-amber-300",
  },
  ORGANIZATION: {
    label: "Business",
    color: "border-indigo-700 bg-indigo-950/40 text-indigo-300",
  },
  TEAM: {
    label: "Team",
    color: "border-blue-700 bg-blue-950/40 text-blue-300",
  },
  FREE: {
    label: "Starter",
    color: "border-bs bg-el text-slate-400",
  },
};

function planBadge(plan: string) {
  const entry = PLAN_MAP[plan] ?? PLAN_MAP.FREE;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${entry.color}`}>
      {entry.label}
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
/*  Warning helpers                                                    */
/* ------------------------------------------------------------------ */

function getOrgWarnings(org: OrgRow): { icon: React.ReactNode; text: string; severity: "warn" | "info" }[] {
  const warnings: { icon: React.ReactNode; text: string; severity: "warn" | "info" }[] = [];

  if (org.pendingCount > 0) {
    warnings.push({
      icon: <MailWarning className="h-3 w-3" />,
      text: `초대 ${org.pendingCount}건 대기 중`,
      severity: "warn",
    });
  }

  if (org.adminCount === 0) {
    warnings.push({
      icon: <Shield className="h-3 w-3" />,
      text: "승인권자 미지정",
      severity: "warn",
    });
  }

  if (org.memberCount >= 10 && org.plan === "FREE") {
    warnings.push({
      icon: <AlertTriangle className="h-3 w-3" />,
      text: "좌석 한도 초과 우려",
      severity: "warn",
    });
  }

  return warnings;
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

  /* ---------- computed ---------- */

  const totalMembers = organizations.reduce((s, o) => s + o.memberCount, 0);
  const totalPending = organizations.reduce((s, o) => s + o.pendingCount, 0);
  const orgsWithWarnings = organizations.filter((o) => getOrgWarnings(o).length > 0);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-sh text-slate-100">
      <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-8 space-y-5">

        {/* -- Page header ------------------------------------------ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">조직 포트폴리오</h1>
            <p className="text-xs text-slate-500 mt-0.5">소속 조직 운영 현황 및 관리</p>
          </div>
          <Button
            onClick={() => setIsOpen(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs shrink-0"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> 조직 생성
          </Button>
        </div>

        {/* -- Create organization dialog --------------------------- */}
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

        {/* -- Main content ----------------------------------------- */}
        {isFetching ? (
          <LoadingSkeleton />
        ) : organizations.length === 0 ? (
          <EmptyState onOpen={() => setIsOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* -- Left: Organization cards -- */}
            <div className="space-y-3">
              {organizations.map((org) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  onNavigate={() => router.push(`/dashboard/organizations/${org.id}`)}
                />
              ))}
            </div>

            {/* -- Right: Operations panel -- */}
            <div className="space-y-4">
              {/* Portfolio stats */}
              <div className="rounded-md border border-bd bg-pn overflow-hidden">
                <div className="px-3 py-2.5 border-b border-bd">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    포트폴리오 요약
                  </span>
                </div>
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <StatCell label="총 조직" value={organizations.length} icon={<Building2 className="h-3.5 w-3.5 text-slate-500" />} />
                    <StatCell label="총 멤버" value={totalMembers} icon={<Users className="h-3.5 w-3.5 text-slate-500" />} />
                    <StatCell label="초대 대기" value={totalPending} icon={<UserPlus className="h-3.5 w-3.5 text-slate-500" />} highlight={totalPending > 0} />
                  </div>
                </div>
              </div>

              {/* Action required */}
              <div className="rounded-md border border-bd bg-pn overflow-hidden">
                <div className="px-3 py-2.5 border-b border-bd">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    바로 처리할 항목
                  </span>
                </div>
                <div className="p-3">
                  {orgsWithWarnings.length === 0 ? (
                    <div className="flex items-center gap-2 py-2">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <p className="text-xs text-slate-400">처리가 필요한 항목이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orgsWithWarnings.map((org) => {
                        const warnings = getOrgWarnings(org);
                        return (
                          <button
                            key={org.id}
                            onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                            className="w-full text-left rounded border border-bd bg-st/30 hover:bg-el/50 p-2.5 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-200 truncate max-w-[180px]">
                                {org.name}
                              </span>
                              <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                            </div>
                            <div className="space-y-1">
                              {warnings.map((w, i) => (
                                <div key={i} className={`flex items-center gap-1.5 text-[11px] ${w.severity === "warn" ? "text-orange-400" : "text-slate-500"}`}>
                                  {w.icon}
                                  <span>{w.text}</span>
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick create CTA */}
              <div className="rounded-md border border-bd bg-pn overflow-hidden">
                <div className="p-4 text-center">
                  <Building2 className="h-5 w-5 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 mb-3">
                    새 팀이나 프로젝트를 위한 조직을 추가하세요.
                  </p>
                  <Button
                    onClick={() => setIsOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-bd text-slate-300 hover:bg-el"
                  >
                    <Plus className="mr-1 h-3 w-3" /> 조직 만들기
                  </Button>
                </div>
              </div>
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

/* -- Organization card -------------------------------------------- */

function OrgCard({
  org,
  onNavigate,
}: {
  org: OrgRow;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const warnings = getOrgWarnings(org);
  const hasWarnings = warnings.length > 0;

  return (
    <div
      className={`rounded-md border bg-pn transition-colors hover:bg-el/30 ${
        hasWarnings ? "border-orange-900/60" : "border-bd"
      }`}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Name + role + plan */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-100 truncate">{org.name}</span>
            {roleBadge(org.role)}
            {planBadge(org.plan)}
          </div>

          {/* Stat row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-500" />
              멤버 {org.memberCount}
            </span>
            {org.pendingCount > 0 && (
              <span className="flex items-center gap-1 text-orange-400">
                <UserPlus className="h-3 w-3" />
                초대 대기 {org.pendingCount}
              </span>
            )}
            {org.adminCount > 0 && (
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-slate-500" />
                승인권자 {org.adminCount}
              </span>
            )}
          </div>

          {/* Activity summary */}
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" />
            <span>최근 활동: 조직 관리 페이지에서 확인</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300 hover:bg-el"
            onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
            title="멤버 관리"
          >
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300 hover:bg-el"
            onClick={() => router.push(`/dashboard/activity-logs`)}
            title="활동 보기"
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300 hover:bg-el"
            onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
            title="설정"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Warning strip */}
      {hasWarnings && (
        <div className="px-4 py-2 border-t border-orange-900/40 bg-orange-950/20">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-orange-400">
                {w.icon}
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: navigate CTA */}
      <div className="px-4 py-2.5 border-t border-bd flex items-center justify-between">
        {org.description ? (
          <p className="text-[11px] text-slate-500 truncate max-w-[60%]">{org.description}</p>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-el"
          onClick={onNavigate}
        >
          관리 페이지 <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* -- Stat cell ---------------------------------------------------- */

function StatCell({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="rounded border border-bd bg-st/30 p-2 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <div className={`text-base font-semibold ${highlight ? "text-orange-400" : "text-slate-100"}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

/* -- Loading skeleton --------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-md border border-bd bg-pn p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-4 w-32 rounded bg-el" />
            <div className="h-4 w-12 rounded bg-el" />
            <div className="h-4 w-12 rounded bg-el" />
          </div>
          <div className="flex gap-4">
            <div className="h-3 w-20 rounded bg-el" />
            <div className="h-3 w-20 rounded bg-el" />
            <div className="h-3 w-24 rounded bg-el" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -- Empty state -------------------------------------------------- */

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-md border border-bd bg-pn flex flex-col items-center justify-center py-16 px-6">
      <Building2 className="h-10 w-10 text-slate-700 mb-4" />
      <h3 className="mb-2 text-base font-medium text-slate-200">
        조직을 만들어 팀 운영을 시작하세요
      </h3>
      <p className="mb-5 text-sm text-slate-500 text-center max-w-md">
        조직 워크스페이스에서 팀원을 초대하고, 역할 기반 권한 관리와 공동 구매를 시작할 수 있습니다.
      </p>

      <ul className="mb-6 space-y-2 text-xs text-slate-400 w-full max-w-xs">
        <li className="flex items-start gap-2">
          <Zap className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
          <span>역할 기반 승인 체계로 안전한 구매 워크플로우</span>
        </li>
        <li className="flex items-start gap-2">
          <Users className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
          <span>팀 단위 예산 관리 및 활동 모니터링</span>
        </li>
        <li className="flex items-start gap-2">
          <Shield className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
          <span>부서별 시약 공유 및 재고 추적 통합</span>
        </li>
      </ul>

      <Button
        onClick={onOpen}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 h-9 text-xs px-5"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> 조직 만들기
      </Button>
    </div>
  );
}
