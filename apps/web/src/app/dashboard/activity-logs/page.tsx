"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/_components/page-header";
import { Activity, Filter, Calendar, User, Building2, FileText, Share2, Eye, Trash2, Edit2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  QUOTE_CREATED: "리스트 생성",
  QUOTE_UPDATED: "리스트 수정",
  QUOTE_DELETED: "리스트 삭제",
  QUOTE_SHARED: "리스트 공유",
  QUOTE_VIEWED: "리스트 조회",
  PRODUCT_COMPARED: "제품 비교",
  PRODUCT_VIEWED: "제품 조회",
  PRODUCT_FAVORITED: "제품 즐겨찾기",
  SEARCH_PERFORMED: "검색 수행",
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  QUOTE_CREATED: "bg-blue-100 text-blue-700 border-blue-200",
  QUOTE_UPDATED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  QUOTE_DELETED: "bg-red-100 text-red-700 border-red-200",
  QUOTE_SHARED: "bg-green-100 text-green-700 border-green-200",
  QUOTE_VIEWED: "bg-purple-100 text-purple-700 border-purple-200",
  PRODUCT_COMPARED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  PRODUCT_VIEWED: "bg-pink-100 text-pink-700 border-pink-200",
  PRODUCT_FAVORITED: "bg-orange-100 text-orange-700 border-orange-200",
  SEARCH_PERFORMED: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

const ACTIVITY_TYPE_ICONS: Record<string, any> = {
  QUOTE_CREATED: Plus,
  QUOTE_UPDATED: Edit2,
  QUOTE_DELETED: Trash2,
  QUOTE_SHARED: Share2,
  QUOTE_VIEWED: Eye,
  PRODUCT_COMPARED: FileText,
  PRODUCT_VIEWED: Eye,
  PRODUCT_FAVORITED: FileText,
  SEARCH_PERFORMED: FileText,
};

export default function ActivityLogsPage() {
  const { data: session, status } = useSession();
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

  // 액티비티 로그 조회
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["activity-logs", activityTypeFilter, entityTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activityTypeFilter !== "all") {
        params.append("activityType", activityTypeFilter);
      }
      if (entityTypeFilter !== "all") {
        params.append("entityType", entityTypeFilter);
      }
      params.append("limit", "100");

      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  // §11.63 — 운영 metric: 오늘 활동 건수 (client-side filter from displayed logs)
  // logs 가 limit=100 으로 받아오므로 오늘 100건 초과 시 부정확 — 일반 운영 시
  // 오늘 100건 미만 가정. 정확도 필요 시 별도 /api/activity-logs/today-count
  // 트랙 분리.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = logs.filter(
    (log: any) => new Date(log.createdAt) >= todayStart,
  ).length;

  // §11.63 — 데이터 스트림 동기화 시각 (TanStack Query 의 dataUpdatedAt 사용)
  const syncedAt = dataUpdatedAt
    ? format(new Date(dataUpdatedAt), "HH:mm:ss")
    : "—";

  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="활동 로그"
          description="리스트 생성, 수정, 공유 등 모든 활동 내역을 확인할 수 있습니다."
          icon={Activity}
          iconColor="text-purple-600"
        />

        {/* §11.63 — 운영 metric + system status hero
            호영님 mock-up 시안 (오늘 활동 KPI + 데이터 스트림 정상 indicator)
            을 DashboardShell 안에서 재해석. marketing nav 는 받지 않음 —
            DashboardShell owns chrome. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* KPI: 오늘 활동 */}
          <Card className="bg-pn border-bd">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">오늘의 시스템 활동</p>
                <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {todayCount.toLocaleString("ko-KR")}
                  <span className="text-sm font-bold text-slate-400 ml-1">건</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          {/* Status: 실시간 데이터 스트림 */}
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">실시간 데이터 스트림</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <p className="text-2xl font-extrabold text-emerald-400">정상</p>
                </div>
                <p className="text-[11px] text-slate-500 break-keep">
                  동기화: {syncedAt}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

              {/* 필터 */}
              <Card className="p-3 md:p-6">
                <CardHeader className="px-0 pt-0 pb-3">
                  <CardTitle className="text-xs md:text-sm font-semibold">필터</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] md:text-xs text-slate-600 mb-1 block">활동 유형</label>
                      <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                        <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] md:text-xs text-slate-600 mb-1 block">엔티티 유형</label>
                      <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                        <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="quote">리스트</SelectItem>
                          <SelectItem value="product">제품</SelectItem>
                          <SelectItem value="search">검색</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 활동 로그 리스트 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">활동 내역</CardTitle>
                      <CardDescription className="text-xs">
                        총 {total}개의 활동이 기록되었습니다.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12 text-slate-500">로딩 중...</div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-500">
                      활동 로그를 불러오는 중 오류가 발생했습니다.
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      활동 내역이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-3">
                      {logs.map((log: any) => {
                        const Icon = ACTIVITY_TYPE_ICONS[log.activityType] || Activity;
                        const colorClass = ACTIVITY_TYPE_COLORS[log.activityType] || "bg-el text-slate-700 border-bd";
                        const label = ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType;

                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 md:gap-4 p-2.5 md:p-4 border border-bd rounded-lg hover:bg-pg transition-colors"
                          >
                            <div className={`p-1.5 md:p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                              <Icon className="h-3 w-3 md:h-4 md:w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] md:text-xs ${colorClass}`}>
                                  {label}
                                </Badge>
                                {log.entityType && (
                                  <span className="text-xs text-slate-500">
                                    {log.entityType}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                                {log.user && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{log.user.name || log.user.email}</span>
                                  </div>
                                )}
                                {log.organization && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    <span>{log.organization.name}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                                  </span>
                                </div>
                              </div>
                              {log.metadata && (
                                <div className="text-xs text-slate-500 mt-2">
                                  {log.metadata.title && (
                                    <div>제목: {log.metadata.title}</div>
                                  )}
                                  {log.metadata.itemCount !== undefined && (
                                    <div>품목 수: {log.metadata.itemCount}개</div>
                                  )}
                                  {log.metadata.totalAmount !== undefined && (
                                    <div>총액: ₩{log.metadata.totalAmount.toLocaleString("ko-KR")}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
      </div>
    </div>
  );
}



