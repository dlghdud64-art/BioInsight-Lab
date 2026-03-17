"use client";

export const dynamic = "force-dynamic";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminSidebar } from "./_components/admin-sidebar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  FileWarning,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  Clock,
  ArrowRight,
  Activity,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface PendingOrg {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
}

interface PendingUser {
  id: string;
  name: string;
  email: string;
  orgName: string;
  requestedRole: string;
  createdAt: string;
}

interface SLAQuote {
  id: string;
  title: string;
  requesterName: string;
  orgName: string;
  createdAt: string;
  slaHoursOver: number;
  status: string;
  totalAmount: number | null;
}

interface ActivityLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  time: string;
}

// ─── KPI Action Card ─────────────────────────────────────────────────────────

function KPIActionCard({
  icon: Icon,
  label,
  count,
  ctaLabel,
  ctaHref,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  ctaLabel: string;
  ctaHref: string;
  variant?: "urgent" | "warning" | "default" | "error";
}) {
  const variantStyles = {
    urgent: {
      border: count > 0 ? "border-red-100" : "border-slate-200",
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      countColor: count > 0 ? "text-red-600" : "text-slate-900",
      ctaStyle: count > 0
        ? "text-red-700 bg-red-50 border-red-200 hover:bg-red-100"
        : "text-slate-500 border-slate-200 hover:bg-slate-50",
    },
    warning: {
      border: count > 0 ? "border-amber-100" : "border-slate-200",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      countColor: count > 0 ? "text-amber-600" : "text-slate-900",
      ctaStyle: count > 0
        ? "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
        : "text-slate-500 border-slate-200 hover:bg-slate-50",
    },
    error: {
      border: count > 0 ? "border-rose-100" : "border-slate-200",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      countColor: count > 0 ? "text-rose-600" : "text-slate-900",
      ctaStyle: count > 0
        ? "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100"
        : "text-slate-500 border-slate-200 hover:bg-slate-50",
    },
    default: {
      border: "border-slate-200",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      countColor: count > 0 ? "text-blue-600" : "text-slate-900",
      ctaStyle: count > 0
        ? "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
        : "text-slate-500 border-slate-200 hover:bg-slate-50",
    },
  };

  const s = variantStyles[variant];

  return (
    <div className={cn("bg-white border rounded-lg p-4 flex flex-col gap-3", s.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-md shrink-0", s.iconBg)}>
          <Icon className={cn("h-4 w-4", s.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-2xl font-bold tabular-nums", s.countColor)}>
            {count}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">{label}</div>
        </div>
      </div>
      <a
        href={ctaHref}
        className={cn(
          "inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-colors w-full",
          s.ctaStyle
        )}
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orgs");

  // ─── 데이터 조회 ─────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-ops"],
    queryFn: async () => {
      const res = await fetch("/api/admin/quotes?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Mock data — 실제 API 연동 전 레이아웃 확인용
  const pendingOrgs: PendingOrg[] = [];
  const pendingUsers: PendingUser[] = [];
  const slaQuotes: SLAQuote[] = [];
  const activityLogs: ActivityLog[] = [
    { id: "1", action: "조직 승인", actor: "admin@bioinsight.com", target: "서울대 화학과", detail: "신규 조직 승인 완료", time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: "2", action: "사용자 역할 변경", actor: "admin@bioinsight.com", target: "김연구원", detail: "VIEWER → REQUESTER", time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: "3", action: "견적 수동 처리", actor: "admin@bioinsight.com", target: "QT-2024-0312", detail: "SLA 초과 건 수동 발송", time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  ];
  const errorCount = 0;

  // KPI 계산
  const kpi = {
    pendingOrgs: pendingOrgs.length,
    pendingUsers: pendingUsers.length,
    slaOverQuotes: slaQuotes.length,
    errors: errorCount,
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* 헤더 */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-900">운영 컨트롤타워</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {format(new Date(), "yyyy.MM.dd (E) HH:mm 기준", { locale: ko })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-dashboard-ops"] })}
              >
                <RefreshCw className="h-3 w-3" />
                새로 고침
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700">
                <Plus className="h-3 w-3" />
                조직 생성
              </Button>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 p-5 space-y-5">
          {/* ── KPI 액션 카드 ─────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPIActionCard
              icon={Building2}
              label="승인 대기 조직"
              count={kpi.pendingOrgs}
              ctaLabel="조직 검토"
              ctaHref="#orgs"
              variant="urgent"
            />
            <KPIActionCard
              icon={Users}
              label="승인 대기 사용자"
              count={kpi.pendingUsers}
              ctaLabel="사용자 승인"
              ctaHref="#users"
              variant="warning"
            />
            <KPIActionCard
              icon={FileWarning}
              label="SLA 초과 견적"
              count={kpi.slaOverQuotes}
              ctaLabel="견적 확인"
              ctaHref="#quotes"
              variant="default"
            />
            <KPIActionCard
              icon={AlertCircle}
              label="오류/장애 이슈"
              count={kpi.errors}
              ctaLabel="로그 보기"
              ctaHref="#logs"
              variant="error"
            />
          </div>

          {/* ── 탭형 운영 큐 ──────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-4 pt-3 border-b border-slate-100 bg-slate-50/50">
                <TabsList className="bg-transparent p-0 h-auto gap-0">
                  <TabsTrigger
                    value="orgs"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-b-none border-b-2 data-[state=active]:border-blue-600 border-transparent px-4 py-2 text-xs font-medium"
                  >
                    조직 승인 대기
                    {kpi.pendingOrgs > 0 && (
                      <Badge className="ml-1.5 h-4 px-1 text-[9px] bg-red-50 text-red-600 border-0">{kpi.pendingOrgs}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="users"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-b-none border-b-2 data-[state=active]:border-blue-600 border-transparent px-4 py-2 text-xs font-medium"
                  >
                    사용자 승인 대기
                    {kpi.pendingUsers > 0 && (
                      <Badge className="ml-1.5 h-4 px-1 text-[9px] bg-amber-50 text-amber-600 border-0">{kpi.pendingUsers}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="quotes"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-b-none border-b-2 data-[state=active]:border-blue-600 border-transparent px-4 py-2 text-xs font-medium"
                  >
                    견적 이슈
                    {kpi.slaOverQuotes > 0 && (
                      <Badge className="ml-1.5 h-4 px-1 text-[9px] bg-blue-50 text-blue-600 border-0">{kpi.slaOverQuotes}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="logs"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-b-none border-b-2 data-[state=active]:border-blue-600 border-transparent px-4 py-2 text-xs font-medium"
                  >
                    관리자 활동 로그
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── 조직 승인 대기 ── */}
              <TabsContent value="orgs" className="m-0">
                {pendingOrgs.length === 0 ? (
                  <EmptyQueue
                    icon={Building2}
                    title="현재 승인 대기 조직이 없습니다."
                    description="새 조직이 가입하면 여기에 표시됩니다."
                    actionLabel="조직 목록 보기"
                    actionHref="/admin/organizations"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold text-slate-500">상태</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">조직명</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">소유자</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">플랜</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">가입일</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">멤버</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrgs.map((org) => (
                        <TableRow key={org.id} className="text-xs">
                          <TableCell>
                            <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px]">대기</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{org.name}</TableCell>
                          <TableCell>
                            <div className="text-slate-700">{org.ownerName}</div>
                            <div className="text-[10px] text-slate-400">{org.ownerEmail}</div>
                          </TableCell>
                          <TableCell className="text-slate-600">{org.plan}</TableCell>
                          <TableCell className="text-slate-500">{format(new Date(org.createdAt), "MM.dd")}</TableCell>
                          <TableCell className="text-slate-600">{org.memberCount}명</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-slate-500">
                                <Eye className="h-3 w-3 mr-1" />상세
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50">
                                <XCircle className="h-3 w-3 mr-1" />반려
                              </Button>
                              <Button size="sm" className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />승인
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* ── 사용자 승인 대기 ── */}
              <TabsContent value="users" className="m-0">
                {pendingUsers.length === 0 ? (
                  <EmptyQueue
                    icon={Users}
                    title="현재 승인 대기 사용자가 없습니다."
                    description="새 사용자 가입 요청이 발생하면 여기에 표시됩니다."
                    actionLabel="사용자 목록 보기"
                    actionHref="/admin/users"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold text-slate-500">상태</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">이름</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">이메일</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">소속 조직</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">요청 역할</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">가입일</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.id} className="text-xs">
                          <TableCell>
                            <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px]">대기</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{user.name}</TableCell>
                          <TableCell className="text-slate-500">{user.email}</TableCell>
                          <TableCell className="text-slate-600">{user.orgName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{user.requestedRole}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{format(new Date(user.createdAt), "MM.dd")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50">
                                <XCircle className="h-3 w-3 mr-1" />반려
                              </Button>
                              <Button size="sm" className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />승인
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* ── 견적 이슈 (SLA 초과) ── */}
              <TabsContent value="quotes" className="m-0">
                {slaQuotes.length === 0 ? (
                  <EmptyQueue
                    icon={FileWarning}
                    title="현재 SLA 초과 견적이 없습니다."
                    description="24시간 이내 회신되지 않은 견적이 발생하면 여기에 표시됩니다."
                    actionLabel="전체 견적 보기"
                    actionHref="/admin/quotes"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold text-slate-500">상태</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">견적 번호</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">요청자</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">조직</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500">초과 시간</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 text-right">금액</TableHead>
                        <TableHead className="text-[11px] font-semibold text-slate-500 text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slaQuotes.map((q) => (
                        <TableRow key={q.id} className="text-xs">
                          <TableCell>
                            <Badge className="bg-red-50 text-red-600 border-0 text-[10px]">SLA 초과</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-slate-700">{q.title}</TableCell>
                          <TableCell className="text-slate-700">{q.requesterName}</TableCell>
                          <TableCell className="text-slate-600">{q.orgName}</TableCell>
                          <TableCell>
                            <span className="text-red-600 font-semibold">+{q.slaHoursOver}h</span>
                          </TableCell>
                          <TableCell className="text-right text-slate-700 font-medium">
                            {q.totalAmount ? `₩${q.totalAmount.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-slate-500">
                                <Eye className="h-3 w-3 mr-1" />상세
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-red-200 text-red-600 hover:bg-red-50">
                                <ExternalLink className="h-3 w-3 mr-1" />견적 확인
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* ── 관리자 활동 로그 ── */}
              <TabsContent value="logs" className="m-0">
                {activityLogs.length === 0 ? (
                  <EmptyQueue
                    icon={Activity}
                    title="최근 관리자 활동이 없습니다."
                    description="관리자 작업 기록이 여기에 표시됩니다."
                    actionLabel="전체 로그 보기"
                    actionHref="/admin/activity"
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3 flex items-center gap-3 text-xs hover:bg-slate-50/50">
                        <div className="p-1.5 rounded-md bg-slate-100 shrink-0">
                          <Activity className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{log.action}</Badge>
                            <span className="text-slate-700 font-medium truncate">{log.target}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{log.detail}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400">{log.actor}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(log.time), "MM.dd HH:mm")}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3 text-center">
                      <a
                        href="/admin/activity"
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                      >
                        전체 활동 로그 보기
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty Queue 컴포넌트 ─────────────────────────────────────────────────────

function EmptyQueue({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="inline-flex items-center justify-center p-3 rounded-full bg-slate-100 mb-3">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
      <a
        href={actionHref}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-3"
      >
        {actionLabel}
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}
