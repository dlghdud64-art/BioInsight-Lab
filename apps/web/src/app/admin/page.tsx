"use client";

export const dynamic = 'force-dynamic';

import { useQuery } from "@tanstack/react-query";
import { AdminSidebar } from "./_components/admin-sidebar";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface DashboardStats {
  totalUsers: number;
  monthlyRFQs: number;
  activeQuotes: number;
  revenue: number;
}

interface ChartData {
  rfqTrend: Array<{ date: string; count: number }>;
  userDistribution: Array<{ name: string; value: number }>;
}

interface RecentActivity {
  id: string;
  type: "user_signup" | "rfq_created" | "quote_submitted";
  description: string;
  timestamp: Date;
  status?: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded ${color}`}>
          <Icon className="h-5 w-5 text-white" />
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

export default function AdminDashboardPage() {
  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Fetch chart data
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["admin-charts"],
    queryFn: async () => {
      const response = await fetch("/api/admin/charts");
      if (!response.ok) throw new Error("Failed to fetch charts");
      return response.json();
    },
  });

  // Fetch recent activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const response = await fetch("/api/admin/activity");
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
  });

  const stats: DashboardStats = statsData?.stats || {
    totalUsers: 0,
    monthlyRFQs: 0,
    activeQuotes: 0,
    revenue: 0,
  };

  const charts: ChartData = chartData?.charts || {
    rfqTrend: [],
    userDistribution: [],
  };

  const activities: RecentActivity[] = activityData?.activities || [];

  if (statsLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            서비스 현황을 한눈에 확인하세요
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Users"
              value={stats.totalUsers.toLocaleString()}
              subtitle="전체 가입자"
              icon={Users}
              trend="+12%"
              color="bg-blue-600"
            />
            <KPICard
              title="Monthly RFQs"
              value={stats.monthlyRFQs}
              subtitle="이번 달 견적 요청"
              icon={FileText}
              trend="+8%"
              color="bg-green-600"
            />
            <KPICard
              title="Active Quotes"
              value={stats.activeQuotes}
              subtitle="진행 중인 견적"
              icon={TrendingUp}
              color="bg-orange-600"
            />
            <KPICard
              title="Revenue"
              value={`₩${(stats.revenue / 1000000).toFixed(1)}M`}
              subtitle="이번 달 수익"
              icon={DollarSign}
              trend="+15%"
              color="bg-purple-600"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RFQ Trend */}
            <div className="bg-white border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-slate-900 mb-4">
                Last 30 Days RFQ Trend
              </h2>
              {chartLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={charts.rfqTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis stroke="#64748b" fontSize={12} tickMargin={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      name="RFQ Count"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* User Distribution */}
            <div className="bg-white border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-slate-900 mb-4">
                User Distribution
              </h2>
              {chartLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={charts.userDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {charts.userDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-slate-200 shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-600 mt-1">
                최근 서비스 활동 내역
              </p>
            </div>
            {activityLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                최근 활동이 없습니다.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-3">Type</TableHead>
                    <TableHead className="p-3">Description</TableHead>
                    <TableHead className="p-3">Timestamp</TableHead>
                    <TableHead className="p-3">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {activity.type === "user_signup"
                            ? "회원가입"
                            : activity.type === "rfq_created"
                            ? "견적요청"
                            : "견적제출"}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3 text-sm">
                        {activity.description}
                      </TableCell>
                      <TableCell className="p-3 text-sm text-slate-600">
                        {format(
                          new Date(activity.timestamp),
                          "PPp",
                          { locale: ko }
                        )}
                      </TableCell>
                      <TableCell className="p-3">
                        {activity.status && (
                          <Badge variant="secondary" className="text-xs">
                            {activity.status}
                          </Badge>
                        )}
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

