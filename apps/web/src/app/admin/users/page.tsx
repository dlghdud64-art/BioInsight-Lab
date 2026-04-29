"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const usersQuery = useQuery<AdminUsersResponse>({
    queryKey: ["admin", "users", { search: searchQuery, role: roleFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
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
                disabled
                title="준비 중 — 사용자 초대 surface 는 별도 트랙에서 제공됩니다."
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
                                className="h-6 px-2 text-[10px] text-slate-500"
                                disabled
                                title="준비 중 — 상세 패널은 #admin-user-approval-policy-set-surface 에서 제공됩니다."
                              >
                                <Eye className="h-3 w-3 mr-0.5" />상세
                              </Button>
                              {user.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] text-rose-700 hover:bg-rose-50"
                                    disabled
                                    title="준비 중 — 승인/반려 surface 는 별도 트랙에서 제공됩니다."
                                  >
                                    <XCircle className="h-3 w-3 mr-0.5" />반려
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                                    disabled
                                    title="준비 중 — 승인/반려 surface 는 별도 트랙에서 제공됩니다."
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" />승인
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
