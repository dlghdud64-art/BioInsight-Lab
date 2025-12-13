"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
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
  const { data, isLoading, error } = useQuery({
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-7xl mx-auto">
                <div className="text-center py-12">로딩 중...</div>
              </div>
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
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
              <PageHeader
                title="활동 로그"
                description="리스트 생성, 수정, 공유 등 모든 활동 내역을 확인할 수 있습니다."
                icon={Activity}
                iconColor="text-purple-600"
              />

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
                        const colorClass = ACTIVITY_TYPE_COLORS[log.activityType] || "bg-slate-100 text-slate-700 border-slate-200";
                        const label = ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType;

                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 md:gap-4 p-2.5 md:p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
        </div>
      </div>
    </div>
  );
}



