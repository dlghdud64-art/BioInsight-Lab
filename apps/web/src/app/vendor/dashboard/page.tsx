"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendorSidebar } from "../_components/vendor-sidebar";
import {
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  Loader2,
  MessageSquare,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type VendorRequestStatus = "PENDING" | "RESPONDED" | "EXPIRED" | "CANCELLED";

interface VendorRequest {
  id: string;
  quoteTitle: string;
  requesterName: string;
  organizationName: string;
  status: VendorRequestStatus;
  requestedAt: Date;
  itemCount: number;
}

interface DashboardStats {
  pendingRequests: number;
  completedQuotes: number;
  monthlyRevenue: number;
  responseRate: number;
}

const STATUS_CONFIG: Record<VendorRequestStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING: { label: "대기", variant: "secondary" },
  RESPONDED: { label: "회신 완료", variant: "default" },
  EXPIRED: { label: "만료", variant: "outline" },
  CANCELLED: { label: "취소", variant: "destructive" },
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="bg-blue-50 p-2 rounded">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-700 mt-1">{title}</div>
        {subtitle && (
          <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export default function VendorDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<VendorRequestStatus | "ALL">("PENDING");

  // Fetch dashboard stats
  const { data: statsData } = useQuery({
    queryKey: ["vendor-stats"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const stats: DashboardStats = statsData?.stats || {
    pendingRequests: 0,
    completedQuotes: 0,
    monthlyRevenue: 0,
    responseRate: 0,
  };

  // Fetch requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["vendor-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const response = await fetch(`/api/vendor/requests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
  });

  const requests: VendorRequest[] = requestsData?.requests || [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <VendorSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            견적 요청 현황을 한눈에 확인하세요
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="대기 중인 요청"
              value={stats.pendingRequests}
              subtitle="답변 대기 중"
              icon={Clock}
            />
            <StatCard
              title="완료된 견적"
              value={stats.completedQuotes}
              subtitle="이번 달"
              icon={CheckCircle}
              trend="+12%"
            />
            <StatCard
              title="이번 달 수주액"
              value={`₩${stats.monthlyRevenue.toLocaleString("ko-KR")}`}
              subtitle="예상 금액"
              icon={DollarSign}
              trend="+8.5%"
            />
            <StatCard
              title="응답률"
              value={`${stats.responseRate}%`}
              subtitle="평균 응답 시간: 4.2시간"
              icon={MessageSquare}
            />
          </div>

          {/* RFQ List Table */}
          <div className="bg-white border border-slate-200 shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">견적 요청 목록 (RFQ)</h2>
              <p className="text-sm text-slate-600 mt-1">
                받은 견적 요청에 빠르게 응답하세요
              </p>
            </div>

            {/* Status Filters */}
            <div className="border-b border-slate-200 px-4 py-3 flex gap-2">
              <Button
                variant={statusFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("ALL")}
              >
                전체
              </Button>
              <Button
                variant={statusFilter === "PENDING" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("PENDING")}
              >
                대기 중
              </Button>
              <Button
                variant={statusFilter === "RESPONDED" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("RESPONDED")}
              >
                회신 완료
              </Button>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-900 mb-1">
                  {statusFilter === "PENDING" ? "대기 중인 요청이 없습니다" : "요청이 없습니다"}
                </p>
                <p className="text-xs text-slate-500">
                  새로운 견적 요청이 들어오면 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-3">요청일자</TableHead>
                    <TableHead className="p-3">요청자 (연구소명)</TableHead>
                    <TableHead className="p-3 text-right">품목 수</TableHead>
                    <TableHead className="p-3">상태</TableHead>
                    <TableHead className="p-3 text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-slate-50">
                      <TableCell className="p-3 text-sm">
                        {format(new Date(request.requestedAt), "PPP", { locale: ko })}
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="text-sm font-medium">{request.organizationName}</div>
                        <div className="text-xs text-slate-600">{request.requesterName}</div>
                      </TableCell>
                      <TableCell className="p-3 text-right text-sm">
                        {request.itemCount}개
                      </TableCell>
                      <TableCell className="p-3">
                        <Badge variant={STATUS_CONFIG[request.status].variant}>
                          {STATUS_CONFIG[request.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3 text-right">
                        <Button size="sm" asChild>
                          <Link href={`/vendor/requests/${request.id}`}>
                            {request.status === "PENDING" ? "Reply" : "View"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

