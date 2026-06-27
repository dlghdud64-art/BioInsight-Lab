"use client";

export const dynamic = "force-dynamic";

import { csrfFetch } from "@/lib/api-client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Users, Loader2, ExternalLink, AlertTriangle, Building2, Shield, ChevronRight, Zap, UserCheck, MailWarning, Search, LayoutGrid, List, MoreVertical, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// §org-management-redesign P2 — 조직 유형 필드 = ODropdown(시안 통일). §11.201(Radix Select × Dialog
//   portal 충돌) 회피는 ODropdown 자체 absolute 메뉴(portal 미사용)로 무관.
import { Input } from "@/components/ui/input";
import { ODropdown } from "@/components/organizations/odropdown";
import { ORG_TYPES } from "@/lib/organizations/org-constants";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
// framer-motion 은 DialogContent 와 호환 이슈로 제거 (추후 재검토)

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
/*  Role / Plan helpers (라이트 테마)                                    */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<string, string> = {
  OWNER: "소유자",
  ADMIN: "관리자",
  APPROVER: "승인자",
  REQUESTER: "요청자",
  VIEWER: "조회자",
};

const ROLE_COLOR: Record<string, string> = {
  OWNER: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ADMIN: "bg-indigo-50 text-indigo-700 border-indigo-200",
  APPROVER: "bg-purple-50 text-purple-700 border-purple-200",
  REQUESTER: "bg-blue-50 text-blue-700 border-blue-200",
  VIEWER: "bg-slate-50 text-slate-500 border-slate-200",
};

function roleBadge(role: string) {
  const label = ROLE_LABEL[role] ?? role;
  const color = ROLE_COLOR[role] ?? ROLE_COLOR.VIEWER;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 font-semibold ${color}`}>
      {label}
    </Badge>
  );
}

// §11.304 — 티어명 등급화 (Starter→Free / Team→Basic / Business→Pro) 정합.
const PLAN_MAP: Record<string, { label: string; color: string }> = {
  ENTERPRISE: { label: "Enterprise", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  ORGANIZATION: { label: "Pro", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  TEAM: { label: "Basic", color: "bg-blue-50 text-blue-700 border-blue-200" },
  FREE: { label: "Free", color: "bg-slate-50 text-slate-500 border-slate-200" },
};

function planBadge(plan: string) {
  const entry = PLAN_MAP[plan] ?? PLAN_MAP.FREE;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 font-semibold ${entry.color}`}>
      {entry.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar 색상 매핑                                                    */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  { bg: "bg-blue-600", text: "text-white" },
  { bg: "bg-violet-600", text: "text-white" },
  { bg: "bg-emerald-600", text: "text-white" },
  { bg: "bg-sky-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-600", text: "text-white" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  조직 상태 라인 (실 필드 파생 — 가짜 활동/시간 금지 §11.318)          */
/* ------------------------------------------------------------------ */

// §org-management-redesign P6 — list 카드 가짜 활동(getRecentActivity) 제거(§11.318 honesty).
//   org 활동/audit 엔드포인트 부재 → 날조(가짜 텍스트·"30분 전 활동" 시간) 금지.
//   실 org 필드(adminCount/pendingCount)로 파생한 실행 가능 상태만 표기(없으면 null → 미표기).
function getOrgStatusLine(org: OrgRow): string | null {
  if (org.adminCount === 0) return "승인권자 미지정";
  if (org.pendingCount > 0) return `초대 대기 ${org.pendingCount}명`;
  return null;
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
  if (org.adminCount === 0) {
    warnings.push({
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: `승인권자 미지정 (${org.pendingCount > 0 ? org.pendingCount + "건 대기" : "설정 필요"})`,
      severity: "warn",
    });
  }
  if (org.pendingCount > 0 && org.adminCount > 0) {
    warnings.push({
      icon: <MailWarning className="h-3.5 w-3.5" />,
      text: `초대 ${org.pendingCount}건 대기 중`,
      severity: "warn",
    });
  }
  if (org.memberCount >= 10 && org.plan === "FREE") {
    warnings.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
      // §11.193d Phase 3 hot fix — raw fetch → csrfFetch swap.
      // 이전 코멘트 ("csrfFetch 가 토큰 획득 실패 시 throw") 는 사실 오인 —
      // csrfFetch (api-client.ts:289) 는 token 없을 때 throw 안 하고 header 에서
      // 빠질 뿐. raw fetch 로 우회해도 server-side CSRF middleware 가 동일하게
      // reject → 403 "보안 검증이 완료되지 않아". §α-F-followup-csrf-fetch-sweep
      // 의 dead spot 정합.
      const res = await csrfFetch("/api/organizations", {
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
    } catch (error: any) {
      console.error("[OrganizationsPage] Unexpected error creating organization:", error);
      const detail = error?.message || "통신이 일시적으로 원활하지 않습니다.";
      toast({ title: "조직 생성 실패", description: detail, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  /* ---------- single-org non-admin auto-redirect ---------- */

  useEffect(() => {
    if (isFetching || organizations.length === 0) return;
    if (organizations.length === 1) {
      const role = organizations[0].role;
      if (role !== "OWNER" && role !== "ADMIN") {
        router.replace(`/dashboard/organizations/${organizations[0].id}`);
      }
    }
  }, [isFetching, organizations, router]);

  /* ---------- computed ---------- */

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter((o) => o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q));
  }, [organizations, searchQuery]);

  const totalMembers = organizations.reduce((s, o) => s + o.memberCount, 0);
  const totalPending = organizations.reduce((s, o) => s + o.pendingCount, 0);
  const orgsWithWarnings = organizations.filter((o) => getOrgWarnings(o).length > 0);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-6">

        {/* ═══ 페이지 헤더 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">조직 관리</h1>
            <p className="text-sm text-slate-500 mt-0.5">소속 조직과 멤버를 관리합니다.</p>
          </div>
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 h-10 px-5 text-sm font-semibold shadow-sm flex-shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" /> 조직 생성
          </Button>
        </div>

        {/* ═══ 검색 + 필터 바 ═══ */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="조직명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white border-slate-200 text-sm"
            />
          </div>
          {/* §11.72: dead filter button 제거. 조직 list 는 현재 검색만
              지원 (다른 filter dimension 없음). dock UI 추가는
              #organizations-filter-popover 별도 트랙에서 backend filter
              schema 확정 후 wired — dead button 으로 미리 만들지 않음. */}
          {/* 그리드/리스트 토글 */}
          <div className="hidden sm:flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "bg-white text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "bg-white text-slate-400 hover:text-slate-600"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ═══ §org-management-redesign P2 — 시안 요약 바(포트폴리오 요약 데이터 컴팩트화, 우측 군더더기 패널 대체) ═══ */}
        {!isFetching && organizations.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
            <Building2 className="h-4 w-4 flex-none text-slate-400" />
            <span>총 <b className="text-slate-900">{organizations.length}</b>개 조직 · 멤버 <b className="text-slate-900">{totalMembers}</b>명</span>
            <span className="flex-1" />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${totalPending > 0 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
              초대 대기 {totalPending}
            </span>
          </div>
        )}

        {/* ═══ 조직 생성 다이얼로그 (리디자인) ═══
            §11.201 — 조직 유형 dropdown 안정화 path 결정. Radix Dialog ×
            Select portal 충돌을 modal=false / onInteractOutside / pointerdown
            stop 같은 global workaround 로 패치 시도 → §11.200d 가 운영 브리핑
            popup 회귀 유발. 회복 절차 적용: Dialog 는 default modal=true 로
            복귀 + 조직 유형 필드만 native <select> 로 swap (전역 영향 0). */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[480px] p-0 rounded-2xl border-slate-200 shadow-2xl overflow-hidden">
            {/* ── 헤더 ── */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogHeader className="space-y-1 p-0">
                    <DialogTitle className="text-lg font-bold text-slate-900">새 조직 만들기</DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                      연구실이나 팀의 새로운 워크스페이스를 만듭니다.
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>
            </div>

            {/* ── 폼 ── */}
            <div className="px-6 pb-2 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="org-name" className="text-sm font-semibold text-slate-700">
                  조직 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="org-name"
                  placeholder="예: 생명공학연구소 1팀"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type" className="text-sm font-semibold text-slate-700">조직 유형</Label>
                {/* §org-management-redesign P2 — 조직 유형 입력을 ODropdown 으로 통일(시안 정합).
                    §11.201 의 Radix Select × Dialog portal 충돌은 ODropdown(자체 absolute 메뉴, portal 미사용)으로 무관.
                    wiring 보존: value/onChange → formData.organizationType. */}
                <ODropdown
                  value={formData.organizationType}
                  options={ORG_TYPES}
                  onChange={(v) => setFormData({ ...formData, organizationType: v })}
                  placeholder="조직 유형을 선택하세요"
                  ariaLabel="조직 유형"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-desc" className="text-sm text-slate-500">
                  간단한 설명 <span className="text-slate-400 text-xs">(선택)</span>
                </Label>
                <textarea
                  id="org-desc"
                  placeholder="예: 단백질 구조 분석 프로젝트 팀"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all outline-none"
                />
              </div>
            </div>

            {/* ── 하단 액션 ── */}
            <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isCreating}
                className="h-10 px-5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateOrg}
                disabled={isCreating}
                className="h-10 px-6 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/20 transition-all"
              >
                {isCreating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 생성 중...</>
                ) : (
                  "조직 생성"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ 메인 콘텐츠 ═══ */}
        {isFetching ? (
          <LoadingSkeleton />
        ) : filteredOrgs.length === 0 && organizations.length === 0 ? (
          <EmptyState onOpen={() => setIsOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
            {/* ── 왼쪽: 조직 카드 그리드 ── */}
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
              {filteredOrgs.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center py-12 text-center">
                  <Search className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">검색 결과가 없습니다</p>
                </div>
              ) : (
                filteredOrgs.map((org) => (
                  <OrgCard
                    key={org.id}
                    org={org}
                    viewMode={viewMode}
                    onNavigate={() => router.push(`/dashboard/organizations/${org.id}`)}
                  />
                ))
              )}
            </div>

            {/* ── 오른쪽: 사이드바 (§org-management-redesign P2 — 포트폴리오 요약은 상단 요약 바로 이동, 중복 생성 CTA 제거) ── */}
            <div className="space-y-3 sticky top-20">
              {/* 바로 처리할 항목 */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-900">바로 처리할 항목</span>
                </div>
                <div className="p-4">
                  {orgsWithWarnings.length === 0 ? (
                    <div className="flex items-center gap-2.5 py-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="text-xs text-slate-500">처리가 필요한 항목이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orgsWithWarnings.map((org) => {
                        const warnings = getOrgWarnings(org);
                        return (
                          <button
                            key={org.id}
                            onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                            className="w-full text-left rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 p-3 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
                                {org.name}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </div>
                            <div className="space-y-1">
                              {warnings.map((w, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] text-red-500">
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

              {/* §org-management-redesign P2 — 중복 조직 생성 CTA 제거(단일 CTA = 상단 primary). */}
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
  viewMode,
  onNavigate,
}: {
  org: OrgRow;
  viewMode: "grid" | "list";
  onNavigate: () => void;
}) {
  const router = useRouter();
  const warnings = getOrgWarnings(org);
  const hasWarnings = warnings.length > 0;
  const avatar = getAvatarColor(org.name);
  const statusLine = getOrgStatusLine(org);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all ${viewMode === "list" ? "flex items-center" : ""}`}>
      <div className={`p-4 ${viewMode === "list" ? "flex items-center gap-4 flex-1" : ""}`}>
        {/* 카드 헤더 — 아바타 + 이름 + 배지 */}
        <div className={`flex items-start gap-3 ${viewMode === "list" ? "flex-1" : "mb-3"}`}>
          {/* 아바타 */}
          <div className={`w-10 h-10 rounded-xl ${avatar.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-base font-bold ${avatar.text}`}>{org.name.charAt(0).toUpperCase()}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 truncate">{org.name}</span>
              {/* 더보기 (그리드에서만 표시) */}
              {viewMode === "grid" && (
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/organizations/${org.id}`); }}
                  className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {roleBadge(org.role)}
              {planBadge(org.plan)}
            </div>
          </div>
        </div>

        {/* 멤버 수 (§org-management-redesign P6 — 가짜 "최종 활동" 시간 제거, §11.318) */}
        <div className={`flex items-center gap-4 text-xs text-slate-500 ${viewMode === "list" ? "" : "mb-3"}`}>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            멤버 {org.memberCount}명
          </span>
        </div>

        {/* 조직 상태 라인 (실 필드 파생 — 없으면 미표기, 가짜 0) */}
        {viewMode === "grid" && statusLine && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 mb-2">
            <AlertCircle className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-[11px] text-slate-600 truncate">{statusLine}</span>
          </div>
        )}

        {/* 경고 스트립 */}
        {hasWarnings && viewMode === "grid" && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 mb-2">
            <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
            <span className="text-[11px] text-red-600 font-medium truncate">
              {warnings[0].text}
            </span>
          </div>
        )}
      </div>

      {/* 푸터: 관리 페이지 이동 */}
      <div className={`px-4 py-2.5 border-t border-slate-100 flex items-center justify-between ${viewMode === "list" ? "border-t-0 border-l pl-4" : ""}`}>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          관리 페이지 <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => window.open(`/dashboard/organizations/${org.id}`, "_blank")}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* -- Sidebar stat row --------------------------------------------- */

/* §org-management-redesign P2 — SidebarStatRow 제거(포트폴리오 요약 패널 폐지, 데이터는 상단 요약 바). */

/* -- Loading skeleton --------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-slate-100" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-slate-100 mb-2" />
                <div className="flex gap-2">
                  <div className="h-3 w-12 rounded bg-slate-100" />
                  <div className="h-3 w-16 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="h-3 w-40 rounded bg-slate-100 mb-3" />
            <div className="h-10 rounded-lg bg-slate-50" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
          <div className="h-4 w-28 rounded bg-slate-100 mb-4" />
          <div className="space-y-3">
            <div className="h-9 rounded bg-slate-50" />
            <div className="h-9 rounded bg-slate-50" />
            <div className="h-9 rounded bg-slate-50" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Empty state -------------------------------------------------- */

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
        <Building2 className="h-8 w-8 text-blue-500" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-900">
        조직을 만들어 팀 운영을 시작하세요
      </h3>
      <p className="mb-6 text-sm text-slate-500 text-center max-w-md">
        조직 워크스페이스에서 팀원을 초대하고, 역할 기반 권한 관리와 공동 구매를 시작할 수 있습니다.
      </p>

      <div className="mb-8 space-y-3 text-sm text-slate-600 w-full max-w-xs">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <span>역할 기반 승인 체계로 안전한 구매 워크플로우</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <span>팀 단위 예산 관리 및 활동 모니터링</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span>부서별 시약 공유 및 재고 추적 통합</span>
        </div>
      </div>

      <Button
        onClick={onOpen}
        className="bg-blue-600 hover:bg-blue-700 h-10 text-sm px-6 font-semibold shadow-sm"
      >
        <Plus className="mr-1.5 h-4 w-4" /> 조직 만들기
      </Button>
    </div>
  );
}
