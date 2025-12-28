"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronRight, Calendar, User, Filter, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { OrganizationRole, AuditEventType } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get("org") || ""
  );
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    eventType: "",
    userId: "",
    search: "",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 사용자의 조직 목록 조회
  const { data: organizationsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const organizations = organizationsData?.organizations || [];
  const currentOrg = organizations.find((org: any) => 
    org.id === selectedOrgId || (!selectedOrgId && org.id)
  ) || organizations[0];

  // 현재 사용자의 역할 확인
  const currentMembership = currentOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
  );
  const isAdmin = currentMembership?.role === OrganizationRole.ADMIN;

  // 감사 로그 조회
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs", currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg?.id) return { logs: [], total: 0 };
      
      const params = new URLSearchParams({
        organizationId: currentOrg.id,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.eventType && { eventType: filters.eventType }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) return { logs: [], total: 0 };
      return response.json();
    },
    enabled: !!currentOrg?.id && isAdmin && status === "authenticated",
  });

  const logs = auditData?.logs || [];
  const total = auditData?.total || 0;

  const toggleRow = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const getEventTypeLabel = (eventType: AuditEventType) => {
    const labels: Record<AuditEventType, string> = {
      USER_LOGIN: "사용자 로그인",
      USER_LOGOUT: "사용자 로그아웃",
      USER_CREATED: "사용자 생성",
      USER_UPDATED: "사용자 수정",
      USER_DELETED: "사용자 삭제",
      PERMISSION_CHANGED: "권한 변경",
      SETTINGS_CHANGED: "설정 변경",
      DATA_EXPORTED: "데이터 내보내기",
      DATA_IMPORTED: "데이터 가져오기",
      SSO_CONFIGURED: "SSO 설정",
      ORGANIZATION_CREATED: "조직 생성",
      ORGANIZATION_UPDATED: "조직 수정",
      ORGANIZATION_DELETED: "조직 삭제",
    };
    return labels[eventType] || eventType;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    if (action.includes("create") || action.includes("add")) return "default";
    return "secondary";
  };

  if (status === "loading" || orgsLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">워크스페이스가 없습니다.</p>
                  <Button onClick={() => router.push("/dashboard/organizations")}>
                    워크스페이스 생성하기
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              <PageHeader
                title="감사 로그"
                description="워크스페이스의 모든 중요한 활동을 추적합니다."
                icon={FileText}
                iconColor="text-indigo-600"
              />

              {/* 워크스페이스 선택 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">워크스페이스 선택</CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkspaceSwitcher
                    currentOrganizationId={selectedOrgId}
                    onOrganizationChange={setSelectedOrgId}
                    showActions={false}
                  />
                </CardContent>
              </Card>

              {currentOrg && (
                <>
                  {!isAdmin ? (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-yellow-100 p-2">
                            <FileText className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-yellow-900 font-medium">
                              관리자 권한이 필요합니다
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              감사 로그는 관리자만 조회할 수 있습니다.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* 필터 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            필터
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* 검색 입력 */}
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                검색
                              </label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="사용자 이름, 이메일, 액션, 엔티티 검색..."
                                  value={filters.search}
                                  onChange={(e) =>
                                    setFilters({ ...filters, search: e.target.value })
                                  }
                                  className="pl-9"
                                />
                              </div>
                            </div>
                            {/* 필터 그리드 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  시작일
                                </label>
                                <Input
                                  type="date"
                                  value={filters.startDate}
                                  onChange={(e) =>
                                    setFilters({ ...filters, startDate: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  종료일
                                </label>
                                <Input
                                  type="date"
                                  value={filters.endDate}
                                  onChange={(e) =>
                                    setFilters({ ...filters, endDate: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  이벤트 유형
                                </label>
                                <Select
                                  value={filters.eventType}
                                  onValueChange={(value) =>
                                    setFilters({ ...filters, eventType: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">전체</SelectItem>
                                    {Object.values(AuditEventType).map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {getEventTypeLabel(type)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  사용자 ID
                                </label>
                                <Input
                                  placeholder="사용자 ID"
                                  value={filters.userId}
                                  onChange={(e) =>
                                    setFilters({ ...filters, userId: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 감사 로그 테이블 */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-semibold">감사 로그</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                총 {total}개의 로그
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {auditLoading ? (
                            <div className="space-y-2">
                              {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                              ))}
                            </div>
                          ) : logs.length === 0 ? (
                            <div className="text-center py-12">
                              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                              <p className="text-sm text-muted-foreground">
                                감사 로그가 없습니다.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>시간</TableHead>
                                    <TableHead>사용자</TableHead>
                                    <TableHead>이벤트</TableHead>
                                    <TableHead>액션</TableHead>
                                    <TableHead>엔티티</TableHead>
                                    <TableHead>상태</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {logs.map((log: any) => {
                                    const isExpanded = expandedRows.has(log.id);
                                    return (
                                      <Collapsible
                                        key={log.id}
                                        open={isExpanded}
                                        onOpenChange={() => toggleRow(log.id)}
                                      >
                                        <TableRow>
                                          <TableCell>
                                            <CollapsibleTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                              >
                                                {isExpanded ? (
                                                  <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4" />
                                                )}
                                              </Button>
                                            </CollapsibleTrigger>
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {new Date(log.createdAt).toLocaleString("ko-KR")}
                                          </TableCell>
                                          <TableCell>
                                            <div className="text-xs">
                                              <p className="font-medium">
                                                {log.user?.name || log.user?.email || "알 수 없음"}
                                              </p>
                                              {log.user?.email && (
                                                <p className="text-muted-foreground">
                                                  {log.user.email}
                                                </p>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                              {getEventTypeLabel(log.eventType)}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            <Badge
                                              variant={getActionBadgeVariant(log.action)}
                                              className="text-xs"
                                            >
                                              {log.action}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {log.entityType}
                                            {log.entityId && ` (${log.entityId.slice(0, 8)}...)`}
                                          </TableCell>
                                          <TableCell>
                                            <Badge
                                              variant={log.success ? "default" : "destructive"}
                                              className="text-xs"
                                            >
                                              {log.success ? "성공" : "실패"}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                        <CollapsibleContent asChild>
                                          <TableRow>
                                            <TableCell colSpan={7} className="bg-slate-50">
                                              <div className="p-4 space-y-3">
                                                {log.metadata && (
                                                  <div>
                                                    <p className="text-xs font-semibold mb-2">
                                                      메타데이터
                                                    </p>
                                                    <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                                                      {JSON.stringify(log.metadata, null, 2)}
                                                    </pre>
                                                  </div>
                                                )}
                                                {log.changes && (
                                                  <div>
                                                    <p className="text-xs font-semibold mb-2">
                                                      변경 사항
                                                    </p>
                                                    <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                                                      {JSON.stringify(log.changes, null, 2)}
                                                    </pre>
                                                  </div>
                                                )}
                                                {log.errorMessage && (
                                                  <div>
                                                    <p className="text-xs font-semibold mb-2 text-red-600">
                                                      오류 메시지
                                                    </p>
                                                    <p className="text-xs text-red-600">
                                                      {log.errorMessage}
                                                    </p>
                                                  </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                  {log.ipAddress && (
                                                    <div>
                                                      <span className="text-muted-foreground">
                                                        IP 주소:
                                                      </span>{" "}
                                                      <span className="font-mono">
                                                        {log.ipAddress}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {log.userAgent && (
                                                    <div>
                                                      <span className="text-muted-foreground">
                                                        User Agent:
                                                      </span>{" "}
                                                      <span className="font-mono text-xs">
                                                        {log.userAgent}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

