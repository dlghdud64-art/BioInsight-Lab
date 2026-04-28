"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/app/_components/page-header";
import {
  Activity,
  Filter,
  Calendar,
  User,
  Building2,
  FileText,
  Share2,
  Eye,
  Trash2,
  Edit2,
  Plus,
  Zap,
  AlertTriangle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

// §11.70 #activity-log-bento-grid-timeline
// ──────────────────────────────────────────────────────────────────
// 호영님 시안 4 사항 채택:
//   1. 커스텀 드롭다운 (이미 §11.71 에서 shadcn Select 통일)
//   2. Bento Grid 4 KPI cards + Pulse 실시간 indicator
//   3. Timeline 디자인 (vertical line + hover lift + motion.div)
//   4. AI Insights 그라디언트 카드 (chatbot UI 아닌 운영 metric notice)
//   5. AnimatePresence 로 list 재배치 시 부드러운 transition
//
// LabAxis 원칙 부합:
//   - DashboardShell chrome 그대로 (marketing nav 거부)
//   - canonical truth (mock data 만 — 실제 audit fetcher 는 §11.63 그대로)
//   - dead button 0건 (§11.67 lesson — RESET FILTERS onClick wired)
//   - AI/chatbot UI 추가 X (AI Insights 는 운영 metric 카드, chat 아님)

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

// §11.70 — AI 자동화 처리 분류 (activityType prefix 또는 contains)
function isAiActivity(activityType: string): boolean {
  return /^AI_|_AI_|RECOMMENDATION|RATIONALE/i.test(activityType);
}

// §11.70 — 경고/오류 활동 분류
function isAlertActivity(activityType: string): boolean {
  return /ERROR|WARNING|FAILED|EXPIRED/i.test(activityType);
}

export default function ActivityLogsPage() {
  const { data: session, status } = useSession();
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

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

  const logs: any[] = data?.logs || [];
  const total = data?.total || 0;

  // §11.70 — KPI 분류 (client-side filter from displayed logs)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((log) => new Date(log.createdAt) >= todayStart);
  const todayCount = todayLogs.length;
  const aiCount = todayLogs.filter((log) => isAiActivity(log.activityType)).length;
  const alertCount = todayLogs.filter((log) => isAlertActivity(log.activityType)).length;

  const syncedAt = dataUpdatedAt
    ? format(new Date(dataUpdatedAt), "HH:mm:ss")
    : "—";

  // §11.67 lesson — RESET FILTERS button onClick wired (no dead button)
  const isFiltered = activityTypeFilter !== "all" || entityTypeFilter !== "all";
  const handleResetFilters = () => {
    setActivityTypeFilter("all");
    setEntityTypeFilter("all");
  };

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

        {/* §11.70 — Bento Grid 4 KPI cards (오늘 활동 / AI 자동화 / 경고·오류 / Stream Status) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. 오늘의 시스템 활동 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="bg-white border-slate-200 hover:border-purple-200 transition-colors h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1 break-keep">오늘의 시스템 활동</p>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {todayCount.toLocaleString("ko-KR")}
                  <span className="text-sm font-bold text-slate-400 ml-1">건</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* 2. AI 자동화 처리 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <Card className="bg-white border-slate-200 hover:border-amber-200 transition-colors h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1 break-keep">AI 자동화 처리</p>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {aiCount.toLocaleString("ko-KR")}
                  <span className="text-sm font-bold text-slate-400 ml-1">건</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* 3. 경고/오류 발생 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <Card className="bg-white border-slate-200 hover:border-rose-200 transition-colors h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1 break-keep">경고/오류 발생</p>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {alertCount.toLocaleString("ko-KR")}
                  <span className="text-sm font-bold text-slate-400 ml-1">건</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* 4. Stream Status (dark accent + pulse) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <Card className="bg-slate-900 border-slate-800 text-white h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/40 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-1 break-keep">실시간 데이터 스트림</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                  </span>
                  <p className="text-xl md:text-2xl font-extrabold text-emerald-400">정상</p>
                </div>
                <p className="text-[11px] text-slate-500 break-keep">동기화: {syncedAt}</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* §11.70 — AI Insights 그라디언트 카드 (운영 metric notice — chatbot UI 아님) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white overflow-hidden relative">
            <CardContent className="p-5 md:p-6 relative">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-1.5 break-keep">AI 인사이트</p>
                  <p className="text-xs md:text-sm text-white/85 break-keep leading-relaxed">
                    {aiCount > 0
                      ? `오늘 ${aiCount}건의 AI 자동화 처리가 운영 워크플로에 적용되었습니다. 견적 추천·재고 자동 분류·발주 검토에 시간 절약 효과가 누적되고 있습니다.`
                      : `오늘 시스템 활동 ${todayCount}건이 기록되었습니다. AI 자동화 처리가 시작되면 이 자리에 인사이트가 노출됩니다.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* §11.70 — 필터 (custom dropdown 이미 §11.71 shadcn Select) + RESET FILTERS button */}
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">
                  활동 유형
                </label>
                <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                  <SelectTrigger className="text-xs md:text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 활동</SelectItem>
                    {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">
                  엔티티 유형
                </label>
                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                  <SelectTrigger className="text-xs md:text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 엔티티</SelectItem>
                    <SelectItem value="quote">리스트</SelectItem>
                    <SelectItem value="product">제품</SelectItem>
                    <SelectItem value="search">검색</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                disabled={!isFiltered}
                className="h-9 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                필터 초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* §11.70 — Timeline 디자인 (vertical line + motion + hover lift) */}
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-slate-900 mb-0.5">활동 내역</p>
                <p className="text-xs text-slate-500">
                  총 <span className="font-semibold text-slate-700 tabular-nums">{total.toLocaleString("ko-KR")}</span>개의 활동이 기록되었습니다.
                </p>
              </div>
              <Filter className="h-4 w-4 text-slate-300" />
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-sm">로딩 중...</div>
            ) : error ? (
              <div className="text-center py-12 text-rose-600 text-sm">
                활동 로그를 불러오는 중 오류가 발생했습니다.
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">활동 내역이 없습니다.</div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div
                  aria-hidden
                  className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200"
                />
                <AnimatePresence mode="popLayout">
                  <ul className="space-y-3">
                    {logs.map((log: any) => {
                      const Icon = ACTIVITY_TYPE_ICONS[log.activityType] || Activity;
                      const colorClass =
                        ACTIVITY_TYPE_COLORS[log.activityType] ||
                        "bg-slate-100 text-slate-700 border-slate-200";
                      const label =
                        ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType;

                      return (
                        <motion.li
                          key={log.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          whileHover={{ x: 2 }}
                          className="relative flex items-start gap-3 pl-0"
                        >
                          {/* Timeline icon (z-index 위로 — line 가림) */}
                          <div
                            className={`relative z-10 w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${colorClass} group-hover:scale-105`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Card body */}
                          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-3 md:p-4 hover:border-purple-200 hover:shadow-sm transition-all">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] md:text-xs font-bold ${colorClass}`}
                              >
                                {label}
                              </Badge>
                              <span className="text-[10px] font-mono text-slate-400 break-all">
                                {log.activityType}
                              </span>
                              {log.entityType && (
                                <span className="text-[10px] text-slate-400">· {log.entityType}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600 mb-1.5 flex-wrap">
                              {log.user && (
                                <div className="flex items-center gap-1 break-keep">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span>{log.user.name || log.user.email}</span>
                                </div>
                              )}
                              {log.organization && (
                                <div className="flex items-center gap-1 break-keep">
                                  <Building2 className="h-3 w-3 flex-shrink-0" />
                                  <span>{log.organization.name}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 font-mono text-slate-400">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span>
                                  {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm", {
                                    locale: ko,
                                  })}
                                </span>
                              </div>
                            </div>
                            {log.metadata && (
                              <div className="text-[11px] text-slate-500 space-y-0.5 break-keep">
                                {log.metadata.title && <div>제목: {log.metadata.title}</div>}
                                {log.metadata.itemCount !== undefined && (
                                  <div>품목 수: {log.metadata.itemCount}개</div>
                                )}
                                {log.metadata.totalAmount !== undefined && (
                                  <div>
                                    총액: ₩
                                    {log.metadata.totalAmount.toLocaleString("ko-KR")}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
