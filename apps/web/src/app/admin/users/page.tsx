"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "../_components/admin-sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Clock,
  UserX,
  UserCheck,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Loader2,
  AlertTriangle,
  Settings2,
  X,
  Save,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * §11.114 #admin-users-fetcher-wiring
 *
 * MOCK_USERS = [] fake-success surface 제거 → real GET /api/admin/users 와이어링.
 * §11.86/§11.87/§11.88 (settings 페이지 mock 제거) 와 동일 패턴.
 *
 * Mapping (Prisma User → display):
 *   - status: emailVerified ? "active" : "pending" (활성/승인대기)
 *   - orgName: user.organization (User.organization String?) ?? "—"
 *   - lastActivity: updatedAt 한국어 short
 *
 * Dead button 정리:
 *   - "새로 고침" → refetch wired
 *   - "사용자 초대" / "상세" / "반려" / "승인" → disabled + tooltip "준비 중"
 *     (별도 트랙 — invite endpoint / role transition modal)
 *
 * §11.110 sweep 누락분 함께 처리:
 *   - bg-pg / bg-pg/80 / bg-pg/50 → bg-sh / bg-sh/80 / bg-sh/50 (light theme)
 *   - text-slate-100 / text-slate-200 → text-slate-900 / text-slate-700
 *   - bg-slate-800 button → bg-slate-900 (강조 button 의도 보존)
 */

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface AdminUserApiRow {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  role: string;
  organization: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  orgName: string;
  role: string;
  status: "active" | "pending" | "inactive";
  lastActivity: string;
  createdAt: string;
}

interface AdminUsersResponse {
  users: AdminUserApiRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function deriveStatus(row: AdminUserApiRow): AdminUser["status"] {
  if (row.emailVerified) return "active";
  return "pending";
}

function formatLastActivity(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function adaptUser(row: AdminUserApiRow): AdminUser {
  return {
    id: row.id,
    name: row.name?.trim() || row.email.split("@")[0] || "—",
    email: row.email,
    orgName: row.organization?.trim() || "—",
    role: row.role,
    status: deriveStatus(row),
    lastActivity: formatLastActivity(row.updatedAt),
    createdAt: row.createdAt,
  };
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

interface ApprovalPolicy {
  id: string;
  email: string;
  name: string | null;
  approvalLimit: string | null;
  costCenter: string | null;
  defaultLocation: string | null;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  // §11.118 — search/role/page 변경 시 page reset (search/role 변경 시만)
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter]);

  const usersQuery = useQuery<AdminUsersResponse>({
    queryKey: [
      "admin",
      "users",
      { search: searchQuery, role: roleFilter, page },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(page));
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  const users = useMemo<AdminUser[]>(() => {
    return (usersQuery.data?.users ?? []).map(adaptUser);
  }, [usersQuery.data]);

  // §11.115 — selected user 의 approval policy detail
  const policyQuery = useQuery<ApprovalPolicy>({
    queryKey: ["admin", "users", selectedUserId, "approval-policy"],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users/${selectedUserId}/approval-policy`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!selectedUserId,
  });

  // 정책 form state — selected 변경 시 reset
  const [formApprovalLimit, setFormApprovalLimit] = useState<string>("");
  const [formCostCenter, setFormCostCenter] = useState<string>("");
  const [formDefaultLocation, setFormDefaultLocation] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (policyQuery.data) {
      setFormApprovalLimit(policyQuery.data.approvalLimit ?? "");
      setFormCostCenter(policyQuery.data.costCenter ?? "");
      setFormDefaultLocation(policyQuery.data.defaultLocation ?? "");
      setFormError(null);
    }
  }, [policyQuery.data]);

  // §11.117 — manual approve / reject
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      // 반려된 user 가 selected 상태였으면 panel 닫기
      if (selectedUserId) setSelectedUserId(null);
    },
  });

  const [confirmReject, setConfirmReject] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const policyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("선택된 사용자가 없습니다.");
      const res = await fetch(
        `/api/admin/users/${selectedUserId}/approval-policy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            approvalLimit: formApprovalLimit.trim() || null,
            costCenter: formCostCenter.trim() || null,
            defaultLocation: formDefaultLocation.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "users", selectedUserId, "approval-policy"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
    onError: (err: Error) => {
      setFormError(err.message || "운영 정책 변경에 실패했습니다.");
    },
  });

  const isFormDirty =
    !!policyQuery.data &&
    (formApprovalLimit !== (policyQuery.data.approvalLimit ?? "") ||
      formCostCenter !== (policyQuery.data.costCenter ?? "") ||
      formDefaultLocation !== (policyQuery.data.defaultLocation ?? ""));

  // server-side: search + role / client-side: status (derive 결과 기반)
  const filteredUsers = useMemo(() => {
    let result = users;
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }
    return result;
  }, [users, statusFilter]);

  // KPI
  const kpi = {
    total: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    inactive: users.filter((u) => u.status === "inactive").length,
    recentJoin: users.filter((u) => {
      const d = new Date(u.createdAt);
      const now = new Date();
      return (now.getTime() - d.getTime()) / 86400000 < 7;
    }).length,
  };

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    active:   { label: "활성",     className: "bg-emerald-50 text-emerald-700 border-0" },
    pending:  { label: "승인 대기", className: "bg-amber-50 text-amber-700 border-0" },
    inactive: { label: "비활성",   className: "bg-el text-slate-500 border-0" },
  };

  return (
    <div className="flex min-h-screen bg-sh">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* 헤더 */}
        <div className="bg-pn border-b border-bd px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-900">사용자 관리</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                사용자 계정을 관리하고 권한을 설정합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => usersQuery.refetch()}
                disabled={usersQuery.isFetching}
              >
                {usersQuery.isFetching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                새로 고침
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="h-3 w-3" />
                사용자 초대
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* ── KPI 카드 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniKPI icon={Users} label="전체 사용자" count={kpi.total} color="blue" />
            <MiniKPI icon={Clock} label="승인 대기" count={kpi.pending} color="amber" />
            <MiniKPI icon={UserX} label="비활성" count={kpi.inactive} color="slate" />
            <MiniKPI icon={UserCheck} label="최근 가입 (7일)" count={kpi.recentJoin} color="green" />
          </div>

          {/* ── 검색/필터 바 ── */}
          <div className="bg-pn border border-bd rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <Input
                type="text"
                placeholder="이름, 이메일, 조직명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs border-0 focus-visible:ring-0 p-0"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <Filter className="h-3 w-3 mr-1 text-slate-400" />
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="pending">승인 대기</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="권한" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 권한</SelectItem>
                <SelectItem value="OWNER">OWNER</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="APPROVER">APPROVER</SelectItem>
                <SelectItem value="REQUESTER">REQUESTER</SelectItem>
                <SelectItem value="VIEWER">VIEWER</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── §11.117 반려 확인 dialog ── */}
          {confirmReject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-pn border border-bd rounded-lg shadow-xl">
                <div className="flex items-center gap-2 border-b border-bd px-4 py-3 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">사용자 반려</h3>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-medium text-slate-900">
                      {confirmReject.label}
                    </span>{" "}
                    사용자를 영구 삭제합니다. 관련된 모든 데이터(즐겨찾기, 검색
                    이력 등)가 함께 제거되며 복구할 수 없습니다.
                  </p>
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                    실수로 초대한 user 정리 또는 OAuth 미응답 정리 용도입니다.
                    이미 활성 user 의 경우 운영 정책 회수 후 신중히 사용하세요.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-bd">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setConfirmReject(null)}
                      disabled={rejectMutation.isPending}
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                      onClick={() => {
                        rejectMutation.mutate(confirmReject.id, {
                          onSuccess: () => setConfirmReject(null),
                        });
                      }}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      영구 삭제
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── §11.116 사용자 초대 modal ── */}
          {inviteOpen && (
            <InviteUserDialog
              onClose={() => setInviteOpen(false)}
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
              }}
            />
          )}

          {/* ── §11.115 운영 정책 panel (selected user 시) ── */}
          {selectedUserId && (
            <div className="fixed inset-x-0 bottom-0 lg:inset-auto lg:bottom-4 lg:right-4 lg:w-[400px] z-30 bg-pn border border-bd rounded-t-lg lg:rounded-lg shadow-xl">
              <div className="flex items-center justify-between border-b border-bd px-4 py-2.5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Settings2 className="h-4 w-4 text-blue-700" />
                  <h3 className="text-sm font-semibold">운영 정책</h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setSelectedUserId(null);
                    setFormError(null);
                  }}
                  title="닫기"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </Button>
              </div>

              <div className="p-4 space-y-3 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                {policyQuery.isLoading ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-xs">정책을 불러오는 중입니다…</p>
                  </div>
                ) : policyQuery.isError ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-rose-700">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-xs">정책을 불러오지 못했습니다.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 mt-1"
                      onClick={() => policyQuery.refetch()}
                    >
                      다시 시도
                    </Button>
                  </div>
                ) : policyQuery.data ? (
                  <>
                    <div className="text-[11px] text-slate-500 leading-relaxed">
                      <p className="font-medium text-slate-700">
                        {policyQuery.data.name?.trim() ||
                          policyQuery.data.email}
                      </p>
                      <p>{policyQuery.data.email}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        단일 건 승인 한도 (₩)
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="예: 100,000,000 (빈 값 = 정책 미설정)"
                        value={formApprovalLimit}
                        onChange={(e) => setFormApprovalLimit(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-slate-500">
                        0 이상의 정수만 입력 가능합니다. 콤마는 자동 처리됩니다.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        기본 Cost Center
                      </label>
                      <Input
                        type="text"
                        placeholder="예: RND-BIO-SITE01 (빈 값 = 미설정)"
                        value={formCostCenter}
                        onChange={(e) => setFormCostCenter(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        기본 입고 위치
                      </label>
                      <Input
                        type="text"
                        placeholder="예: 제1R&D센터 중앙창고 (빈 값 = 미설정)"
                        value={formDefaultLocation}
                        onChange={(e) => setFormDefaultLocation(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    {formError && (
                      <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <p>{formError}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-bd">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => {
                          if (policyQuery.data) {
                            setFormApprovalLimit(
                              policyQuery.data.approvalLimit ?? "",
                            );
                            setFormCostCenter(
                              policyQuery.data.costCenter ?? "",
                            );
                            setFormDefaultLocation(
                              policyQuery.data.defaultLocation ?? "",
                            );
                            setFormError(null);
                          }
                        }}
                        disabled={!isFormDirty || policyMutation.isPending}
                      >
                        되돌리기
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        onClick={() => policyMutation.mutate()}
                        disabled={!isFormDirty || policyMutation.isPending}
                      >
                        {policyMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        저장
                      </Button>
                    </div>
                    {policyMutation.isSuccess && !isFormDirty && (
                      <p className="text-[10px] text-emerald-700 text-right">
                        ✓ 운영 정책이 저장되었습니다.
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* ── 테이블 ── */}
          <div className="bg-pn border border-bd rounded-lg overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sh/80 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-slate-500 min-w-[120px]">이름</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 min-w-[160px]">이메일</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 min-w-[120px]">조직</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[80px]">권한</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[80px]">상태</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[90px]">최근 활동</TableHead>
                    <TableHead className="text-[11px] font-semibold text-slate-500 w-[120px] text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <p className="text-xs">사용자 목록을 불러오는 중입니다…</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : usersQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-rose-700" />
                          <p className="text-sm font-medium text-rose-700">사용자 목록을 불러오지 못했습니다.</p>
                          <p className="text-xs text-slate-500">
                            ADMIN 권한 또는 네트워크 상태를 확인하고 새로 고침을 눌러 주세요.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 mt-1"
                            onClick={() => usersQuery.refetch()}
                          >
                            다시 시도
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="space-y-2">
                          <div className="inline-flex items-center justify-center p-3 rounded-full bg-el mb-1">
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-700">
                            {statusFilter === "all" && roleFilter === "all" && !searchQuery.trim()
                              ? "등록된 사용자가 없습니다."
                              : "조건에 맞는 사용자가 없습니다."}
                          </p>
                          <p className="text-xs text-slate-500">
                            검색 조건을 변경하거나 승인 대기 목록을 확인할 수 있습니다.
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1.5 h-7"
                              disabled
                              title="준비 중 — 사용자 초대 surface 는 별도 트랙에서 제공됩니다."
                            >
                              <Mail className="h-3 w-3" />
                              사용자 초대
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-700 h-7"
                              onClick={() => setStatusFilter("pending")}
                            >
                              승인 대기 보기
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const statusCfg = STATUS_BADGE[user.status] || { label: user.status, className: "bg-el text-slate-500 border-0" };
                      return (
                        <TableRow key={user.id} className="text-xs hover:bg-sh/50">
                          <TableCell className="font-medium text-slate-900">{user.name}</TableCell>
                          <TableCell className="text-slate-600">{user.email}</TableCell>
                          <TableCell className="text-slate-700">{user.orgName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-medium">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px]", statusCfg.className)}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{user.lastActivity}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "h-6 px-2 text-[10px]",
                                  selectedUserId === user.id
                                    ? "text-blue-700 bg-blue-50"
                                    : "text-slate-600 hover:text-slate-900",
                                )}
                                onClick={() => setSelectedUserId(user.id)}
                                title="운영 정책 보기/변경"
                              >
                                <Settings2 className="h-3 w-3 mr-0.5" />정책
                              </Button>
                              {user.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] text-rose-700 hover:bg-rose-50"
                                    onClick={() =>
                                      setConfirmReject({
                                        id: user.id,
                                        label: user.name || user.email,
                                      })
                                    }
                                    disabled={
                                      rejectMutation.isPending ||
                                      approveMutation.isPending
                                    }
                                    title="이 사용자를 영구 삭제합니다."
                                  >
                                    <XCircle className="h-3 w-3 mr-0.5" />반려
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => approveMutation.mutate(user.id)}
                                    disabled={
                                      approveMutation.isPending ||
                                      rejectMutation.isPending
                                    }
                                    title="OAuth 인증 없이 즉시 활성화합니다."
                                  >
                                    {approveMutation.isPending &&
                                    approveMutation.variables === user.id ? (
                                      <Loader2 className="h-3 w-3 mr-0.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                    )}
                                    승인
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* §11.118 — pagination UI (totalPages > 1 일 때만 노출) */}
            {usersQuery.data && usersQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-bd px-4 py-2.5 text-[11px] text-slate-500">
                <span>
                  총 <span className="font-semibold text-slate-900">{usersQuery.data.total.toLocaleString("ko-KR")}</span>명 중{" "}
                  <span className="font-semibold text-slate-900">
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString("ko-KR")}
                  </span>
                  {" — "}
                  <span className="font-semibold text-slate-900">
                    {Math.min(page * PAGE_SIZE, usersQuery.data.total).toLocaleString("ko-KR")}
                  </span>
                  명 표시
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || usersQuery.isFetching}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    이전
                  </Button>
                  <span className="tabular-nums">
                    <span className="font-semibold text-slate-900">{page}</span>
                    {" / "}
                    {usersQuery.data.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(usersQuery.data!.totalPages, p + 1),
                      )
                    }
                    disabled={
                      page >= usersQuery.data.totalPages ||
                      usersQuery.isFetching
                    }
                  >
                    다음
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini KPI ────────────────────────────────────────────────────────────────

function MiniKPI({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: "blue" | "amber" | "slate" | "green";
}) {
  const colorMap = {
    blue:  { bg: "bg-blue-50",    text: "text-blue-500",    count: "text-blue-600" },
    amber: { bg: "bg-amber-50",   text: "text-amber-500",   count: "text-amber-600" },
    slate: { bg: "bg-el",  text: "text-slate-500",   count: "text-slate-600" },
    green: { bg: "bg-emerald-50", text: "text-emerald-500", count: "text-emerald-600" },
  };
  const c = colorMap[color];

  return (
    <div className="bg-pn border border-bd rounded-lg p-3 flex items-center gap-3">
      <div className={cn("p-1.5 rounded-md", c.bg)}>
        <Icon className={cn("h-3.5 w-3.5", c.text)} />
      </div>
      <div>
        <div className={cn("text-lg font-bold tabular-nums", count > 0 ? c.count : "text-slate-400")}>{count}</div>
        <div className="text-[10px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

// ─── §11.116 사용자 초대 Dialog ─────────────────────────────────────────────

function InviteUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("RESEARCHER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data as {
        user: { id: string; email: string; name: string | null };
        inviteLink: string;
      };
    },
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      setCreatedEmail(data.user.email);
      setErrorMsg(null);
      onCreated();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "사용자 초대에 실패했습니다.");
    },
  });

  const isValid = email.trim().length > 0 && /@/.test(email);

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg("클립보드 복사에 실패했습니다. 링크를 직접 선택해 주세요.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-pn border border-bd rounded-lg shadow-xl">
        <div className="flex items-center justify-between border-b border-bd px-4 py-3">
          <div className="flex items-center gap-2 text-slate-900">
            <UserPlus className="h-4 w-4 text-blue-700" />
            <h3 className="text-sm font-semibold">사용자 초대</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
            title="닫기"
          >
            <X className="h-4 w-4 text-slate-500" />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {!inviteLink ? (
            <>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ADMIN 만 사용자를 초대할 수 있습니다. 초대 링크를 복사하여
                Slack / 카카오톡 등으로 전달하세요. 이메일 자동 발송은 이번
                트랙에서 제공되지 않습니다.
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  이메일 *
                </label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  이름 (선택)
                </label>
                <Input
                  type="text"
                  placeholder="예: 홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  역할 *
                </label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="역할 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESEARCHER">RESEARCHER (기본)</SelectItem>
                    <SelectItem value="REQUESTER">REQUESTER</SelectItem>
                    <SelectItem value="APPROVER">APPROVER</SelectItem>
                    <SelectItem value="VIEWER">VIEWER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="OWNER">OWNER</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-bd">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={onClose}
                  disabled={inviteMutation.isPending}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  onClick={() => inviteMutation.mutate()}
                  disabled={!isValid || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserPlus className="h-3 w-3" />
                  )}
                  초대 링크 생성
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">초대가 생성되었습니다.</p>
                  <p className="text-emerald-600">
                    {createdEmail} — 아래 링크를 복사하여 전달하세요.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  초대 링크
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="h-8 text-[11px] font-mono"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-700" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        복사
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500">
                  받는 분이 링크 클릭 → Google 로그인 → 자동 활성화됩니다.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-bd">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    setInviteLink(null);
                    setCreatedEmail(null);
                    setEmail("");
                    setName("");
                    setRole("RESEARCHER");
                    setErrorMsg(null);
                  }}
                >
                  추가 초대
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                  onClick={onClose}
                >
                  닫기
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
