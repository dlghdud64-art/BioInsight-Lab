"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertTriangle,
  Download,
  FileWarning,
  FileSearch,
  Flame,
  FlameKindling,
  Skull,
  Droplets,
  Glasses,
  Shirt,
  Hand,
  ShieldCheck,
  Calendar,
  Search,
  Upload,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  AlertCircle,
  Thermometer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// GHS 픽토그램 타입별 포인트 컬러 및 라벨
const GHS_CONFIG: Record<string, { label: string; iconBg: string; iconColor: string }> = {
  corrosive: { label: "부식성 물질", iconBg: "bg-red-100", iconColor: "text-red-600" },
  toxic: { label: "독성 물질", iconBg: "bg-yellow-100", iconColor: "text-slate-900" },
  flammable: { label: "인화성 물질", iconBg: "bg-red-100", iconColor: "text-red-600" },
  oxidizer: { label: "산화성 물질", iconBg: "bg-yellow-100", iconColor: "text-yellow-600" },
};

function GHSPictogram({ type }: { type: string }) {
  const config = GHS_CONFIG[type] || { label: "경고", iconBg: "bg-amber-100", iconColor: "text-amber-500" };
  const base = `w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center ${config.iconBg} ${config.iconColor}`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={base}>
            {type === "corrosive" && <Droplets className="w-4 h-4" strokeWidth={2.5} />}
            {type === "toxic" && <Skull className="w-4 h-4" strokeWidth={2.5} />}
            {type === "flammable" && <Flame className="w-4 h-4" strokeWidth={2.5} />}
            {type === "oxidizer" && <FlameKindling className="w-4 h-4" strokeWidth={2.5} />}
            {!["corrosive", "toxic", "flammable", "oxidizer"].includes(type) && (
              <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs font-bold">{config.label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PPEIcon({ type, required }: { type: string; required?: boolean }) {
  const base = "w-6 h-6 rounded flex-shrink-0 flex items-center justify-center";
  const active = required ? "text-blue-600 bg-blue-50" : "text-slate-300 bg-slate-50";
  const labels: Record<string, string> = { gloves: "보호장갑", goggles: "보안경", coat: "실험복", mask: "마스크" };
  const label = labels[type] ?? "PPE";
  const iconClass = "w-4 h-4";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${base} ${active}`}>
            {type === "gloves" && <Hand className={iconClass} strokeWidth={2.5} />}
            {type === "goggles" && <Glasses className={iconClass} strokeWidth={2.5} />}
            {type === "coat" && <Shirt className={iconClass} strokeWidth={2.5} />}
            {type === "mask" && <ShieldCheck className={iconClass} strokeWidth={2.5} />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}{required ? " (필수)" : ""}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
type ActionStatus = "ok" | "warning" | "action_needed";

interface SafetyItem {
  id: number;
  name: string;
  cas: string;
  isHighRisk: boolean;
  level: RiskLevel;
  hasMsds: boolean;
  msdsUpdatedAt: string | null;
  loc: string;
  storageCondition: string;
  icons: readonly string[];
  ppe: { type: string; required: boolean }[];
  lastInspection: string | null;
  actionStatus: ActionStatus;
  expiryDate: string | null;
}

const safetyItems: SafetyItem[] = [
  {
    id: 1, name: "Sulfuric Acid (황산)", cas: "7664-93-9", isHighRisk: true, level: "HIGH",
    hasMsds: true, msdsUpdatedAt: "2025-01-15", loc: "시약장 A (산성)", storageCondition: "산성 전용 캐비닛, 15~25°C",
    icons: ["corrosive", "toxic"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: true }, { type: "mask", required: false }],
    lastInspection: "2026-02-20", actionStatus: "ok", expiryDate: null,
  },
  {
    id: 2, name: "Acetone (아세톤)", cas: "67-64-1", isHighRisk: false, level: "MEDIUM",
    hasMsds: false, msdsUpdatedAt: null, loc: "방폭 캐비닛 1", storageCondition: "방폭 캐비닛, 직사광선 차단",
    icons: ["flammable"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: false }, { type: "mask", required: false }],
    lastInspection: null, actionStatus: "action_needed", expiryDate: "2026-06-30",
  },
  {
    id: 3, name: "Sodium Hydroxide (수산화나트륨)", cas: "1310-73-2", isHighRisk: true, level: "HIGH",
    hasMsds: false, msdsUpdatedAt: null, loc: "시약장 B (염기성)", storageCondition: "염기성 전용 캐비닛, 건조 보관",
    icons: ["corrosive"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: true }, { type: "mask", required: false }],
    lastInspection: "2025-12-10", actionStatus: "warning", expiryDate: null,
  },
  {
    id: 4, name: "Ethanol 70%", cas: "64-17-5", isHighRisk: false, level: "LOW",
    hasMsds: true, msdsUpdatedAt: "2025-02-01", loc: "일반 캐비닛", storageCondition: "실온, 화기 주의",
    icons: ["flammable"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: false }, { type: "coat", required: false }, { type: "mask", required: false }],
    lastInspection: "2026-03-01", actionStatus: "ok", expiryDate: "2027-12-31",
  },
];

const LOCATIONS = ["시약장 A (산성)", "시약장 B (염기성)", "방폭 캐비닛 1", "일반 캐비닛"];

export default function SafetyManagerPage() {
  const { toast } = useToast();
  const [riskFilter, setRiskFilter] = useState("all");
  const [msdsFilter, setMsdsFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = safetyItems.filter((item) => {
    if (riskFilter === "high" && item.level !== "HIGH") return false;
    if (riskFilter === "medium" && item.level !== "MEDIUM") return false;
    if (riskFilter === "low" && item.level !== "LOW") return false;
    if (msdsFilter === "registered" && !item.hasMsds) return false;
    if (msdsFilter === "missing" && item.hasMsds) return false;
    if (locationFilter !== "all" && item.loc !== locationFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.cas.includes(q)) return false;
    }
    return true;
  });

  // 조치형 KPI 계산
  const totalCount = safetyItems.length;
  const highRiskCount = safetyItems.filter((i) => i.isHighRisk).length;
  const msdsMissingCount = safetyItems.filter((i) => !i.hasMsds).length;
  const ppeMissingCount = safetyItems.filter((i) => i.ppe.every((p) => !p.required)).length;
  const storageReviewCount = safetyItems.filter((i) => !i.lastInspection || (() => {
    const days = Math.ceil((Date.now() - new Date(i.lastInspection!).getTime()) / (1000 * 60 * 60 * 24));
    return days > 90;
  })()).length;
  const actionNeededCount = safetyItems.filter((i) => i.actionStatus === "action_needed").length;

  const getBorderColor = (level: RiskLevel) => {
    if (level === "HIGH") return "border-l-red-500";
    if (level === "MEDIUM") return "border-l-orange-500";
    return "border-l-yellow-500";
  };

  const getActionStatusBadge = (status: ActionStatus) => {
    if (status === "ok") return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">정상</Badge>;
    if (status === "warning") return <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">주의</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">조치 필요</Badge>;
  };

  const handleExport = () => {
    if (!filteredItems.length) {
      toast({ title: "내보낼 데이터 없음", variant: "destructive" });
      return;
    }
    const headers = ["제품명", "CAS", "위험도", "MSDS 상태", "보관 위치", "보관 조건", "최근 점검일", "조치 상태"];
    const rows = filteredItems.map((item) => [
      item.name, item.cas,
      item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "중위험" : "일반",
      item.hasMsds ? "등록" : "누락", item.loc, item.storageCondition,
      item.lastInspection || "-",
      item.actionStatus === "ok" ? "정상" : item.actionStatus === "warning" ? "주의" : "조치 필요",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `안전관리_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: "CSV 파일이 다운로드되었습니다." });
  };

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">안전 조치 운영</h1>
            <p className="text-sm text-slate-500 mt-1">
              위험물 관리, MSDS 상태, 보호구 설정, 보관 조건을 확인하고 조치합니다.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
            <Download className="h-3.5 w-3.5" />
            CSV 내보내기
          </Button>
        </div>

        {/* 조치형 KPI */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500 font-medium">전체 관리 물질</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}종</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
            <p className="text-[11px] text-red-600 font-medium">고위험 물질</p>
            <p className="text-xl font-bold text-red-700 mt-0.5">{highRiskCount}종</p>
          </div>
          <button
            type="button"
            onClick={() => setMsdsFilter("missing")}
            className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-1">
              <Upload className="h-3 w-3 text-amber-600" />
              <p className="text-[11px] text-amber-600 font-medium">MSDS 업로드 필요</p>
            </div>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{msdsMissingCount}건</p>
          </button>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
            <p className="text-[11px] text-blue-600 font-medium">보호구 미설정</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">{ppeMissingCount}건</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-1">
              <Thermometer className="h-3 w-3 text-slate-500" />
              <p className="text-[11px] text-slate-600 font-medium">보관 조건 검토</p>
            </div>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{storageReviewCount}건</p>
            <p className="text-[10px] text-slate-400 mt-0.5">90일 이상 미점검</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${actionNeededCount > 0 ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
            <div className="flex items-center gap-1">
              {actionNeededCount > 0 ? <AlertCircle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              <p className={`text-[11px] font-medium ${actionNeededCount > 0 ? "text-red-600" : "text-emerald-600"}`}>즉시 확인 필요</p>
            </div>
            <p className={`text-xl font-bold mt-0.5 ${actionNeededCount > 0 ? "text-red-700" : "text-emerald-700"}`}>{actionNeededCount}건</p>
          </div>
        </div>

        {/* 재고 연동 안내 */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              재고에 등록된 위험물은 안전 관리에 자동 연동됩니다. 유효기간·폐기·보관 조건 경고도 함께 표시됩니다.
            </p>
          </div>
          <Link href="/dashboard/inventory">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 gap-1 h-7 px-2">
              재고 보기 <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* 필터 바 */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-9 h-9 text-sm border-slate-200 bg-white"
              placeholder="물질명 또는 CAS 번호 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs border-slate-200 bg-white">
              <SelectValue placeholder="위험 등급" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">위험 등급 전체</SelectItem>
              <SelectItem value="high" className="text-xs">고위험</SelectItem>
              <SelectItem value="medium" className="text-xs">중위험</SelectItem>
              <SelectItem value="low" className="text-xs">일반</SelectItem>
            </SelectContent>
          </Select>
          <Select value={msdsFilter} onValueChange={setMsdsFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs border-slate-200 bg-white">
              <SelectValue placeholder="MSDS 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">MSDS 전체</SelectItem>
              <SelectItem value="registered" className="text-xs">등록됨</SelectItem>
              <SelectItem value="missing" className="text-xs">누락</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs border-slate-200 bg-white">
              <SelectValue placeholder="보관 장소" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">보관 장소 전체</SelectItem>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc} className="text-xs">{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 물질 리스트 */}
        <div className="space-y-2.5">
          {filteredItems.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600 mb-1">검색 결과가 없습니다</p>
                <p className="text-xs text-slate-400">다른 키워드나 필터 조건을 변경해보세요.</p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item) => (
              <Card key={item.id} className={`shadow-sm border-slate-200 border-l-4 ${getBorderColor(item.level)} overflow-hidden`}>
                <CardContent className="p-0">
                  <div className="px-4 md:px-5 py-3.5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      {/* 좌측: 위험 등급 + GHS + 제품 정보 */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex gap-1.5 flex-shrink-0">
                          {item.icons.map((icon) => (
                            <GHSPictogram key={icon} type={icon} />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                              item.level === "HIGH" ? "bg-red-50 text-red-700 border-red-200" :
                              item.level === "MEDIUM" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }`}>
                              {item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "중위험" : "일반"}
                            </Badge>
                            {getActionStatusBadge(item.actionStatus)}
                          </div>
                          <p className="text-xs text-slate-500">CAS: {item.cas}</p>
                        </div>
                      </div>

                      {/* 우측: 상세 정보 */}
                      <div className="flex flex-wrap items-center gap-3 md:gap-4">
                        {/* 보호구 */}
                        <div className="flex gap-1">
                          {item.ppe.map((p) => (
                            <PPEIcon key={p.type} type={p.type} required={p.required} />
                          ))}
                        </div>

                        {/* MSDS */}
                        <div className="flex items-center gap-1.5">
                          {item.hasMsds ? (
                            <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 w-3" />
                              MSDS
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => toast({ title: "MSDS 업로드", description: `${item.name} MSDS 업로드 기능 준비 중` })}
                            >
                              <Upload className="h-2.5 w-2.5" />
                              MSDS 등록
                            </Button>
                          )}
                        </div>

                        {/* 점검일 */}
                        {item.lastInspection && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            점검 {item.lastInspection}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 하단: 보관 조건 + 유효기간 */}
                    <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-slate-400" />
                        {item.storageCondition}
                      </span>
                      <span className="text-[11px] text-slate-400">|</span>
                      <span className="text-[11px] text-slate-500">{item.loc}</span>
                      {item.expiryDate && (
                        <>
                          <span className="text-[11px] text-slate-400">|</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            유효기간 {item.expiryDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {filteredItems.length > 0 && (
          <p className="text-xs text-slate-400 text-right">{filteredItems.length}건 표시</p>
        )}
      </div>
    </div>
  );
}
