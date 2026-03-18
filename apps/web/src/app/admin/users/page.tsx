"use client";

import { useState, useMemo } from "react";
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
  MoreHorizontal,
  RefreshCw,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 타입 ────────────────────────────────────────────────────────────────────

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

// ─── Mock 데이터 (API 연동 전) ──────────────────────────────────────────────

const MOCK_USERS: AdminUser[] = [];

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const users = MOCK_USERS;

  const filteredUsers = useMemo(() => {
    let result = users;
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.orgName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, statusFilter, roleFilter, searchQuery]);

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
    <div className="flex min-h-screen bg-pg">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* 헤더 */}
        <div className="bg-pn border-b border-bd px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-100">사용자 관리</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                사용자 계정을 관리하고 권한을 설정합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <RefreshCw className="h-3 w-3" />
                새로 고침
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700">
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
                  <TableRow className="bg-pg/80 hover:bg-transparent">
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
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="space-y-2">
                          <div className="inline-flex items-center justify-center p-3 rounded-full bg-el mb-1">
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">등록된 사용자가 없습니다.</p>
                          <p className="text-xs text-slate-400">사용자 초대 또는 승인 대기 목록을 확인할 수 있습니다.</p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-7">
                              <Mail className="h-3 w-3" />
                              사용자 초대
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-600 h-7"
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
                        <TableRow key={user.id} className="text-xs hover:bg-pg/50">
                          <TableCell className="font-medium text-slate-200">{user.name}</TableCell>
                          <TableCell className="text-slate-500">{user.email}</TableCell>
                          <TableCell className="text-slate-600">{user.orgName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-medium">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px]", statusCfg.className)}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{user.lastActivity}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-slate-500">
                                <Eye className="h-3 w-3 mr-0.5" />상세
                              </Button>
                              {user.status === "pending" && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-50">
                                    <XCircle className="h-3 w-3 mr-0.5" />반려
                                  </Button>
                                  <Button size="sm" className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">
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
