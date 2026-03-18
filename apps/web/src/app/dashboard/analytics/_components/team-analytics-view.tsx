"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Users, AlertTriangle, TrendingUp, TrendingDown, Shield, ShieldAlert,
  ChevronRight, Building2, CreditCard, ShoppingCart, Settings,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── 타입 ────────────────────────────────────────────────────
interface TeamSpendingData {
  id: string;
  name: string;
  budget: number;
  spent: number;
  burnRate: number;
  prevMonthSpent: number;
  currentMonthSpent: number;
  monthChange: number;
  topCategory: string;
  topVendor: string;
  status: "안정" | "주의" | "초과 위험" | "검토 필요";
}

// ── 더미 데이터 ─────────────────────────────────────────────
const TEAM_DATA: TeamSpendingData[] = [
  {
    id: "t1", name: "분자생물학팀", budget: 48000000, spent: 38200000,
    burnRate: 79.6, prevMonthSpent: 5200000, currentMonthSpent: 6800000,
    monthChange: 30.8, topCategory: "시약", topVendor: "Sigma-Aldrich",
    status: "주의",
  },
  {
    id: "t2", name: "세포배양팀", budget: 36000000, spent: 34800000,
    burnRate: 96.7, prevMonthSpent: 4100000, currentMonthSpent: 4500000,
    monthChange: 9.8, topCategory: "배지", topVendor: "Thermo Fisher",
    status: "초과 위험",
  },
  {
    id: "t3", name: "분석화학팀", budget: 52000000, spent: 29500000,
    burnRate: 56.7, prevMonthSpent: 3800000, currentMonthSpent: 3200000,
    monthChange: -15.8, topCategory: "장비", topVendor: "Agilent",
    status: "안정",
  },
  {
    id: "t4", name: "면역학팀", budget: 30000000, spent: 22500000,
    burnRate: 75.0, prevMonthSpent: 2800000, currentMonthSpent: 3600000,
    monthChange: 28.6, topCategory: "시약", topVendor: "Abcam",
    status: "주의",
  },
  {
    id: "t5", name: "유전체학팀", budget: 60000000, spent: 31200000,
    burnRate: 52.0, prevMonthSpent: 4600000, currentMonthSpent: 4200000,
    monthChange: -8.7, topCategory: "소모품", topVendor: "Illumina",
    status: "안정",
  },
  {
    id: "t6", name: "단백질공학팀", budget: 25000000, spent: 24800000,
    burnRate: 99.2, prevMonthSpent: 3200000, currentMonthSpent: 3800000,
    monthChange: 18.8, topCategory: "시약", topVendor: "Bio-Rad",
    status: "초과 위험",
  },
  {
    id: "t7", name: "생물정보학팀", budget: 18000000, spent: 9200000,
    burnRate: 51.1, prevMonthSpent: 1200000, currentMonthSpent: 1400000,
    monthChange: 16.7, topCategory: "소모품", topVendor: "Dell Technologies",
    status: "안정",
  },
];

// ── 상태 스타일 ──────────────────────────────────────────────
function getStatusStyle(status: TeamSpendingData["status"]) {
  switch (status) {
    case "안정":
      return { bg: "bg-emerald-50  bg-emerald-950/20", text: "text-emerald-700 text-emerald-400", border: "border-emerald-200  border-emerald-900/40" };
    case "주의":
      return { bg: "bg-amber-50  bg-amber-950/20", text: "text-amber-700 text-amber-400", border: "border-amber-200  border-amber-900/40" };
    case "초과 위험":
      return { bg: "bg-red-50 bg-red-950/20", text: "text-red-700 text-red-400", border: "border-red-200  border-red-900/40" };
    case "검토 필요":
      return { bg: "bg-blue-50  bg-blue-950/20", text: "text-blue-700 text-blue-400", border: "border-blue-200  border-blue-900/40" };
  }
}

// ── 소진율 바 색상 ───────────────────────────────────────────
function getBurnRateColor(rate: number): string {
  if (rate >= 90) return "#ef4444";
  if (rate >= 75) return "#f59e0b";
  return "#3b82f6";
}

// ── 컴포넌트 ────────────────────────────────────────────────
export default function TeamAnalyticsView() {
  const totalTeams = TEAM_DATA.length;
  const riskTeams = TEAM_DATA.filter((t) => t.status === "초과 위험" || t.status === "주의").length;
  const topSpendingTeam = TEAM_DATA.reduce((a, b) => (a.spent > b.spent ? a : b));
  const increasedTeams = TEAM_DATA.filter((t) => t.monthChange > 0).length;

  const spendingChartData = [...TEAM_DATA]
    .sort((a, b) => b.spent - a.spent)
    .map((t) => ({ name: t.name, spent: t.spent, budget: t.budget }));

  const burnRateChartData = [...TEAM_DATA]
    .sort((a, b) => b.burnRate - a.burnRate)
    .map((t) => ({ name: t.name, burnRate: t.burnRate }));

  const riskTeamList = TEAM_DATA.filter((t) => t.status === "초과 위험" || t.status === "주의")
    .sort((a, b) => b.burnRate - a.burnRate);

  return (
    <div className="space-y-5">

      {/* ══ 1. 팀별 KPI 카드 ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div className="rounded-xl border border-bd/60 bg-pn border-bd/50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">전체 팀</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{totalTeams}개</div>
          <p className="text-xs text-slate-400 mt-1">예산 배정된 운영 팀</p>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${riskTeams > 0 ? "border-amber-200/60 bg-amber-50/30  bg-amber-950/10  border-amber-900/30" : "border-bd/60 bg-pn border-bd/50"}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">예산 위험 팀</span>
          </div>
          <div className={`text-xl font-bold ${riskTeams > 0 ? "text-amber-700 text-amber-400" : "text-slate-100"}`}>
            {riskTeams}개
          </div>
          <p className="text-xs text-slate-400 mt-1">소진율 75% 이상</p>
        </div>

        <div className="rounded-xl border border-bd/60 bg-pn border-bd/50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">최고 지출 팀</span>
          </div>
          <div className="text-lg font-bold text-slate-100 truncate">{topSpendingTeam.name}</div>
          <p className="text-xs text-slate-400 mt-1">₩{topSpendingTeam.spent.toLocaleString("ko-KR")}</p>
        </div>

        <div className="rounded-xl border border-bd/60 bg-pn border-bd/50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">전월 대비 증가</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{increasedTeams}개 팀</div>
          <p className="text-xs text-slate-400 mt-1">이번 달 지출 증가</p>
        </div>
      </div>

      {/* ══ 2. 예산 위험 팀 알림 ══ */}
      {riskTeamList.length > 0 && (
        <Card className="rounded-xl border-amber-100  border-amber-900/30 bg-amber-50/40  bg-amber-950/10 shadow-sm">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <CardTitle className="text-sm font-semibold text-slate-200">예산 위험 팀 현황</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="space-y-2">
              {riskTeamList.map((team) => {
                const remaining = team.budget - team.spent;
                return (
                  <li key={team.id} className="flex items-start gap-2.5">
                    {team.status === "초과 위험" ? (
                      <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                    )}
                    <span className="text-sm text-slate-300 leading-snug">
                      <span className="font-medium">{team.name}</span>
                      {" — "}
                      예산 소진율 {team.burnRate}%
                      {remaining > 0
                        ? `, 잔액 ₩${remaining.toLocaleString("ko-KR")}`
                        : ", 예산 초과 상태"}
                      {team.monthChange > 15 && `. 전월 대비 ${team.monthChange}% 증가 추세`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ══ 3. 팀별 비교 차트 ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 팀별 사용액 비교 */}
        <Card className="rounded-xl border-bd/60 border-bd/50 shadow-sm bg-pn">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold text-slate-200">팀별 사용액 비교</CardTitle>
            <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">배정 예산 대비 현재 사용액</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={spendingChartData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                  }
                />
                <YAxis
                  type="category" dataKey="name" width={80}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    `₩${Number(value).toLocaleString("ko-KR")}`,
                    name === "spent" ? "사용액" : "배정 예산",
                  ]}
                />
                <Bar dataKey="budget" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={14} name="budget" />
                <Bar dataKey="spent" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} name="spent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 팀별 예산 소진율 비교 */}
        <Card className="rounded-xl border-bd/60 border-bd/50 shadow-sm bg-pn">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold text-slate-200">팀별 예산 소진율</CardTitle>
            <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">소진율 기준 내림차순 정렬</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={burnRateChartData} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number" domain={[0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  type="category" dataKey="name" width={80}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, "소진율"]}
                />
                <Bar dataKey="burnRate" radius={[0, 4, 4, 0]} barSize={14}>
                  {burnRateChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBurnRateColor(entry.burnRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ══ 4. 팀별 분석 테이블 ══ */}
      <Card className="rounded-xl border-bd/60 border-bd/50 shadow-sm bg-pn">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-sm font-semibold text-slate-200">팀별 예산 집행 현황</CardTitle>
          <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
            전체 {totalTeams}개 팀 중 {riskTeams}개 팀이 주의 이상 상태
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-3">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-slate-100 border-bd/50">
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">팀명</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">배정 예산</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">사용액</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">소진율</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">전월 대비</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">주요 카테고리</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">주요 벤더</TableHead>
                  <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TEAM_DATA.map((team) => {
                  const statusStyle = getStatusStyle(team.status);
                  return (
                    <TableRow key={team.id} className="border-slate-100 border-bd/30 hover:bg-pg hover:bg-el/20 transition-colors">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-200 text-sm">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-sm text-slate-400">
                        ₩{team.budget.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className="font-semibold text-slate-200 text-sm">
                          ₩{team.spent.toLocaleString("ko-KR")}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-semibold ${team.burnRate >= 90 ? "text-red-600 text-red-400" : team.burnRate >= 75 ? "text-amber-600 text-amber-400" : "text-slate-400"}`}>
                            {team.burnRate}%
                          </span>
                          <div className="w-14 h-1.5 bg-st/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, team.burnRate)}%`,
                                backgroundColor: getBurnRateColor(team.burnRate),
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {team.monthChange > 0 ? (
                            <ArrowUpRight className="h-3 w-3 text-rose-500" />
                          ) : team.monthChange < 0 ? (
                            <ArrowDownRight className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Minus className="h-3 w-3 text-slate-400" />
                          )}
                          <span className={`text-xs font-medium ${team.monthChange > 0 ? "text-rose-600  text-rose-400" : team.monthChange < 0 ? "text-emerald-600 text-emerald-400" : "text-slate-400"}`}>
                            {team.monthChange > 0 ? "+" : ""}{team.monthChange}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-slate-400">
                        {team.topCategory}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-slate-400 max-w-[120px]">
                        <span className="truncate block">{team.topVendor}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {team.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ══ 5. 팀 관점 액션 ══ */}
      <div className="rounded-xl border border-bd/50 bg-pg/60 bg-pn/30 p-4">
        <p className="text-[10px] font-semibold text-slate-400 text-slate-500 uppercase tracking-wider mb-3">
          팀 관리 후속 조치
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/purchases">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-pn bg-pn hover:bg-pg hover:bg-el border-bd border-bs font-medium transition-colors">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
              팀별 구매 내역
            </Button>
          </Link>
          <Link href="/dashboard/budget">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-pn bg-pn hover:bg-pg hover:bg-el border-bd border-bs font-medium transition-colors">
              <CreditCard className="h-3.5 w-3.5 text-slate-500" />
              예산 재배정 검토
            </Button>
          </Link>
          <Link href="/dashboard/analytics/category">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-pn bg-pn hover:bg-pg hover:bg-el border-bd border-bs font-medium transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              카테고리별 상세 분석
            </Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-pn bg-pn hover:bg-pg hover:bg-el border-bd border-bs font-medium transition-colors">
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              조직 / 예산 관리
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}
