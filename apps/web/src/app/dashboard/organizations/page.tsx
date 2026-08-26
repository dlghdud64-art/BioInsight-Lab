"use client";

export const dynamic = "force-dynamic";

import { csrfFetch } from "@/lib/api-client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Users, Mail, Loader2, ExternalLink, AlertTriangle, Building2, Shield, ChevronRight, Zap, UserCheck, MailWarning, Search, LayoutGrid, List, MoreVertical, AlertCircle } from "lucide-react";
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
  // §fabricated-data-surface — 생성 직후 낙관적 행의 role 을 **DB 응답에서 도출**하려면
  //   내 userId 가 필요하다(하드코딩 금지). §team-org-role-model Phase 2.
  const { status, data: session } = useSession();
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

      /**
       * §fabricated-data-surface — 거짓 표시 제거 (§team-org-role-model Phase 2, 2026-08-12).
       *
       * 이전: `role: "OWNER"` **하드코딩**. 그런데 DB 는 `ADMIN` 이었다
       * (생성 upsert 가 ADMIN 을 썼다) — **화면과 DB 가 어긋난 상태**였고,
       * 사용자는 자기가 OWNER 라고 믿을 근거를 화면에서만 얻었다.
       *
       * 지금: **서버 응답의 내 멤버십에서 도출**한다. 도출할 수 없으면
       * **낙관적 행을 넣지 않는다** — 모르는 값을 지어내지 않는다(빈 값도 지어내기다).
       * 목적지 페이지가 어차피 truth 를 조회하므로 손실도 없다.
       */
      const myMembership = (Array.isArray(createdOrg?.members) ? createdOrg.members : []).find(
        (m: any) => m?.userId === session?.user?.id,
      );
      const derivedRole: string | null = myMembership?.role ?? null;

      if (derivedRole) {
        const members: any[] = Array.isArray(createdOrg?.members) ? createdOrg.members : [];
        const mapped: OrgRow = {
          id: newOrgId ?? String(Date.now()),
          name: createdOrg?.name ?? formData.name.trim(),
          description: createdOrg?.description ?? formData.description.trim() ?? "",
          memberCount: members.length,
          // 이전 `adminCount: 1` 도 같은 계열의 지어낸 값이었다 — 응답에서 센다.
          adminCount: members.filter((m: any) => m?.role === "OWNER" || m?.role === "ADMIN").length,
          pendingCount: 0,
          plan: createdOrg?.plan ?? "FREE",
          role: derivedRole,
        };
        setOrganizations((prev) => [mapped, ...prev]);
      }

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
    <div className="min-h-screen bg-canvas">
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
          {/* §org-management-web P5 — 요약은 검색 행 우측 1줄로 흡수한다.
              별도 요약 바는 제거했다 — 한 줄짜리 사실에 카드 한 장을 쓰지 않는다. */}
          {!isFetching && organizations.length > 0 && (
            <span className="hidden md:flex items-center gap-1.5 text-sm text-slate-500 tabular-nums whitespace-nowrap">
              총 <b className="text-slate-900">{organizations.length}</b>개 조직 ·
              멤버 <b className="text-slate-900">{totalMembers}</b>명 ·
              초대 대기 <b className={totalPending > 0 ? "text-yellow-600" : "text-slate-900"}>{totalPending}</b>
            </span>
          )}
        </div>

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
          <div className="space-y-4">
            {/* §org-management-web P5 — 처리할 항목은 **있을 때만** 그리드 위 배너로.
                🛑 0건에서도 자리를 차지하던 우측 280px 고정 패널을 없앴다 —
                   "처리할 것이 없다" 는 사실에 화면 1/4 을 상시 배정할 이유가 없다. */}
            {orgsWithWarnings.length > 0 && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4">
                <p className="text-sm font-bold text-slate-900 mb-2.5">바로 처리할 항목</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {orgsWithWarnings.map((org) => {
                    const warnings = getOrgWarnings(org);
                    return (
                      <button
                        key={org.id}
                        onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                        className="w-full text-left rounded-lg border border-yellow-200 bg-white hover:border-yellow-300 p-3 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{org.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          {warnings.map((w, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-yellow-700">
                              {w.icon}
                              <span>{w.text}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 조직 카드 3열 그리드 ── */}
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch" : "space-y-3"}>
              {filteredOrgs.length === 0 ? (
                <div className="col-span-full flex flex-col items-center py-12 text-center">
                  <Search className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">검색 결과가 없습니다</p>
                </div>
              ) : (
                <>
                  {filteredOrgs.map((org) => (
                    <OrgCard
                      key={org.id}
                      org={org}
                      viewMode={viewMode}
                      onNavigate={() => router.push(`/dashboard/organizations/${org.id}`)}
                    />
                  ))}
                  {/* §org-management-web P5 — 새 조직 만들기 placeholder.
                      상단 CTA 와 중복이 아니라 **그리드의 빈 자리를 말이 되게** 만든다
                      (카드가 1장일 때 남는 2칸이 그냥 여백이 되지 않는다). */}
                  {viewMode === "grid" && (
                    <button
                      type="button"
                      onClick={() => setIsOpen(true)}
                      className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white/50 text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-600"
                    >
                      <Plus className="h-6 w-6" />
                      <span className="text-sm font-medium">새 조직 만들기</span>
                    </button>
                  )}
                </>
              )}
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

        {/* 통계 1줄 (§org-management-redesign P6 — 가짜 "최종 활동" 시간 제거, §11.318)
            🛑 §org-management-web P5 — 핸드오프 §1 은 "멤버 · 초대 대기 · **승인자**" 3축을
               요구하지만 OrgRow 에 approverCount 가 없다(memberCount · adminCount ·
               pendingCount 뿐이고 adminCount 는 ADMIN||OWNER 로 APPROVER 와 다른 축이다).
               없는 사실을 만들지 않는다 — 2축만 싣고 승인자는 API 확장 뒤로 이월한다. */}
        <div className={`flex items-center gap-4 text-xs text-slate-500 ${viewMode === "list" ? "" : "mb-3"}`}>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            멤버 <b className="text-slate-700 tabular-nums">{org.memberCount}</b>명
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className={`h-3.5 w-3.5 ${org.pendingCount > 0 ? "text-yellow-500" : "text-slate-400"}`} />
            초대 대기 <b className={`tabular-nums ${org.pendingCount > 0 ? "text-yellow-600" : "text-slate-700"}`}>{org.pendingCount}</b>
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
      {/* §org-management-web P5 — 카드의 주 동작은 하나다. 풀폭 버튼으로 명시한다. */}
      <div className={`px-4 py-2.5 border-t border-slate-100 flex items-center gap-2 ${viewMode === "list" ? "border-t-0 border-l pl-4" : ""}`}>
        <button
          onClick={onNavigate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          관리 페이지 열기 <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => window.open(`/dashboard/organizations/${org.id}`, "_blank")}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="새 탭에서 열기"
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
  /* §org-management-web P6 (호영님 실측 QA 2026-08-25) — 스켈레톤을 본 레이아웃에 전수.
   * P5 는 로드 후 레이아웃을 3열로 바꾸고 280px 사이드바를 없앴는데, 스켈레톤은
   * lg:grid-cols-[1fr_300px] 인 채였다. 로딩 중 우측에 300px 패널 자리가 그려졌다가
   * 사라져, 스켈레톤이 오지 않을 레이아웃을 약속했다.
   * 🔑 결정을 바꾸면서 그 결정의 형제 슬롯(스켈레톤)을 전수하지 않은 형태다.
   * 그리드는 :535 의 본 레이아웃과 같은 문자열을 쓴다 — 갈라지면 또 어긋난다. */
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white animate-pulse">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="flex-1">
                <div className="h-4 w-28 rounded bg-slate-100 mb-2" />
                <div className="flex gap-2">
                  <div className="h-3 w-12 rounded bg-slate-100" />
                  <div className="h-3 w-10 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="h-3 w-36 rounded bg-slate-100" />
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <div className="h-8 rounded-lg bg-slate-50" />
          </div>
        </div>
      ))}
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
