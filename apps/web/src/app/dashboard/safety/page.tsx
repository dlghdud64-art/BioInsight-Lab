"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Biohazard,
  AlertTriangle,
  Download,
  FileWarning,
  Flame,
  FlameKindling,
  Skull,
  Droplets,
  Search,
  Hand,
  Glasses,
  Shirt,
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
  corrosive: {
    label: "부식성 물질 (Corrosive)",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-600 dark:text-red-400",
  },
  toxic: {
    label: "독성 물질 (Toxic)",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
    iconColor: "text-slate-900 dark:text-yellow-300",
  },
  flammable: {
    label: "인화성 물질 (Flammable)",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-600 dark:text-red-400",
  },
  oxidizer: {
    label: "산화성 물질 (Oxidizer)",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/40",
    iconColor: "text-yellow-600 dark:text-yellow-500",
  },
};

// GHS 픽토그램 렌더링 (선명한 벡터 아이콘, blur/box-shadow 제거)
function GHSPictogram({ type }: { type: string; isHighRisk?: boolean }) {
  const config = GHS_CONFIG[type] || {
    label: "경고 (Warning)",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-500 dark:text-amber-400",
  };
  const base = `w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center ${config.iconBg} ${config.iconColor}`;

  const iconEl = (
    <div className={base}>
      {type === "corrosive" && <Droplets className="w-5 h-5" strokeWidth={2.5} aria-hidden />}
      {type === "toxic" && <Skull className="w-5 h-5" strokeWidth={2.5} aria-hidden />}
      {type === "flammable" && <Flame className="w-5 h-5" strokeWidth={2.5} aria-hidden />}
      {type === "oxidizer" && <FlameKindling className="w-5 h-5" strokeWidth={2.5} aria-hidden />}
      {!["corrosive", "toxic", "flammable", "oxidizer"].includes(type) && (
        <AlertTriangle className="w-5 h-5" strokeWidth={2.5} aria-hidden />
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help inline-flex">{iconEl}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-bold">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// PPE 고정 순서 + 아이콘 맵
const PPE_ORDER = ["gloves", "goggles", "coat", "mask"] as const;
const PPE_META: Record<string, { label: string; icon: typeof Hand }> = {
  gloves: { label: "보호장갑", icon: Hand },
  goggles: { label: "보안경", icon: Glasses },
  coat: { label: "실험복", icon: Shirt },
  mask: { label: "마스크", icon: ShieldCheck },
};

// PPE 가로 한 줄 렌더링 — 고정 4슬롯, 비필수는 투명 처리(자리 유지)
function PPERow({ ppe }: { ppe: { type: string; required: boolean }[] }) {
  const ppeMap = new Map(ppe.map((p) => [p.type, p.required]));

  return (
    <div className="flex items-center gap-1">
      {PPE_ORDER.map((type) => {
        const meta = PPE_META[type];
        if (!meta) return null;
        const Icon = meta.icon;
        const required = ppeMap.get(type);
        const isActive = required === true;

        return (
          <TooltipProvider key={type}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 cursor-help ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                      : "text-slate-200 dark:text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-bold">{meta.label}{isActive ? " (필수)" : ""}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

type SafetyItem = {
  id: number;
  name: string;
  cas: string;
  isHighRisk: boolean;
  level: "HIGH" | "MEDIUM" | "LOW";
  actionStatus: "normal" | "caution" | "action_required";
  hasMsds: boolean;
  msdsUpdatedAt: string | null;
  registeredAt: string;
  lastInspection: string | null;
  storageCondition: string;
  loc: string;
  icons: readonly string[];
  ppe: { type: string; required: boolean }[];
};

const safetyItems: SafetyItem[] = [
  {
    id: 1,
    name: "Sulfuric Acid (황산)",
    cas: "7664-93-9",
    isHighRisk: true,
    level: "HIGH",
    actionStatus: "caution",
    hasMsds: true,
    msdsUpdatedAt: "2025-01-15",
    registeredAt: "2024-03-10",
    lastInspection: "2025-02-20",
    storageCondition: "산성 전용, 밀폐 보관",
    loc: "시약장 A (산성)",
    icons: ["corrosive", "toxic"],
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: true },
      { type: "mask", required: false },
    ],
  },
  {
    id: 2,
    name: "Acetone (아세톤)",
    cas: "67-64-1",
    isHighRisk: false,
    level: "MEDIUM",
    actionStatus: "action_required",
    hasMsds: false,
    msdsUpdatedAt: null,
    registeredAt: "2024-06-15",
    lastInspection: null,
    storageCondition: "방폭, 직사광선 차단",
    loc: "방폭 캐비닛 1",
    icons: ["flammable"],
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: false },
      { type: "mask", required: false },
    ],
  },
  {
    id: 3,
    name: "Sodium Hydroxide (수산화나트륨)",
    cas: "1310-73-2",
    isHighRisk: true,
    level: "HIGH",
    actionStatus: "action_required",
    hasMsds: false,
    msdsUpdatedAt: null,
    registeredAt: "2024-05-22",
    lastInspection: "2025-01-10",
    storageCondition: "염기성 전용, 밀폐 보관",
    loc: "시약장 B (염기성)",
    icons: ["corrosive"],
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: true },
      { type: "coat", required: true },
      { type: "mask", required: false },
    ],
  },
  {
    id: 4,
    name: "Ethanol 70%",
    cas: "64-17-5",
    isHighRisk: false,
    level: "LOW",
    actionStatus: "normal",
    hasMsds: true,
    msdsUpdatedAt: "2025-02-01",
    registeredAt: "2024-08-01",
    lastInspection: "2025-03-01",
    storageCondition: "실온 보관",
    loc: "일반 캐비닛",
    icons: ["flammable"],
    ppe: [
      { type: "gloves", required: true },
      { type: "goggles", required: false },
      { type: "coat", required: false },
      { type: "mask", required: false },
    ],
  },
];

const LOCATIONS = ["시약장 A (산성)", "시약장 B (염기성)", "방폭 캐비닛 1", "일반 캐비닛"];

export default function SafetyManagerPage() {
  const { toast } = useToast();
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [msdsFilter, setMsdsFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = (safetyItems || []).filter((item) => {
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

  const totalCount = safetyItems.length;
  const highRiskCount = safetyItems.filter((i) => i.isHighRisk).length;
  const msdsMissingCount = safetyItems.filter((i) => !i.hasMsds).length;

  const getBorderColor = (level: string) => {
    if (level === "HIGH") return "!border-l-red-500 dark:!border-l-red-400";
    if (level === "MEDIUM") return "!border-l-orange-500 dark:!border-l-orange-400";
    return "!border-l-yellow-500 dark:!border-l-yellow-500";
  };

  const handleExport = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast({
        title: "내보낼 데이터 없음",
        description: "내보낼 제품이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["제품명", "CAS", "위험도", "MSDS 상태", "최종 업데이트", "보관 위치"];
    const rows = filteredItems.map((item) => [
      item.name,
      item.cas,
      item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "중위험" : "일반",
      item.hasMsds ? "등록" : "누락",
      item.msdsUpdatedAt || "-",
      item.loc,
    ]);

    const csv = [headers, ...rows]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `안전_제품_리스트_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 pt-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <Shield className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white">안전 관리</h1>
            </div>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
              GMP/KOSHA 규격 대응. 고위험 물질, MSDS, 필수 보호구를 한눈에 관리합니다.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="text-xs md:text-sm shrink-0 border-slate-200 dark:border-slate-700">
            <Download className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" />
            CSV 내보내기
          </Button>
        </div>

        {/* 1. 상단 안전 요약 KPI */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-slate-900">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">전체 관리 물질</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {totalCount} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">종</span>
                </p>
              </div>
              <ShieldAlert className="text-slate-400 dark:text-slate-500 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-red-100 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/30 shadow-sm">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">고위험 물질</p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                  {highRiskCount} <span className="text-sm font-normal text-red-500 dark:text-red-400">종</span>
                </p>
              </div>
              <Biohazard className="text-red-400 dark:text-red-500 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/30 shadow-sm">
            <CardContent className="pt-6 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">MSDS 누락 항목</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {msdsMissingCount} <span className="text-sm font-normal text-amber-500 dark:text-amber-400">종</span>
                </p>
              </div>
              <FileWarning className="text-amber-400 dark:text-amber-500 w-10 h-10 flex-shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* 슬림 필터 바 */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-4 border rounded-lg border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="위험 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">위험 등급 전체</SelectItem>
                <SelectItem value="high">고위험</SelectItem>
                <SelectItem value="medium">중위험</SelectItem>
                <SelectItem value="low">일반</SelectItem>
              </SelectContent>
            </Select>
            <Select value={msdsFilter} onValueChange={setMsdsFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="MSDS 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">MSDS 상태 전체</SelectItem>
                <SelectItem value="registered">등록됨</SelectItem>
                <SelectItem value="missing">누락</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="보관 장소" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">보관 장소 전체</SelectItem>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 h-9 text-xs border-slate-200 dark:border-slate-700"
              placeholder="물질명 또는 CAS 번호 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          총 {filteredItems.length}개 제품이 검색되었습니다.
        </p>

        {/* 2. 고도화된 제품 리스트 (antialiased 텍스트, 선명한 아이콘) */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900 antialiased">
          <CardHeader>
            <CardTitle className="text-lg dark:text-white">관리 대상 물질 리스트</CardTitle>
            <CardDescription className="dark:text-slate-400">
              위험 등급별 컬러 바, GHS 픽토그램, 필수 보호구(PPE)를 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                조건에 맞는 데이터가 없습니다.
              </div>
            ) : (
              <div className="antialiased">
                {/* 컬럼 헤더 (데스크탑) */}
                <div className="hidden md:flex items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2 px-4 border-b border-slate-100 dark:border-slate-800/50 mb-2">
                  <div className="flex-1 min-w-0">물질 정보</div>
                  <div className="w-72 flex-shrink-0 px-3">운영 상세</div>
                  <div className="w-[120px] flex-shrink-0 text-center">보호구</div>
                </div>

                <div className="space-y-2">
                {filteredItems.map((item) => {
                  const riskBadge = item.level === "HIGH"
                    ? { label: "고위험", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800" }
                    : item.level === "MEDIUM"
                      ? { label: "중위험", cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800" }
                      : { label: "일반", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
                  const actionBadge = item.actionStatus === "action_required"
                    ? { label: "조치 필요", cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" }
                    : item.actionStatus === "caution"
                      ? { label: "주의", cls: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" }
                      : { label: "정상", cls: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" };

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col md:flex-row md:items-center border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 border-slate-100 dark:border-slate-800/50 ${getBorderColor(item.level)}`}
                    >
                      {/* LEFT: 식별 정보 */}
                      <div className="flex-1 min-w-0 p-3 md:py-3 md:pl-4 md:pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex gap-1 flex-shrink-0">
                            {item.icons.map((icon) => (
                              <GHSPictogram key={icon} type={icon} />
                            ))}
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-nowrap overflow-x-auto">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-mono flex-shrink-0">
                            {item.cas}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${riskBadge.cls}`}>
                            {riskBadge.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${actionBadge.cls}`}>
                            {actionBadge.label}
                          </Badge>
                          {!item.hasMsds && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              MSDS 미등록
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* CENTER: 운영 메타 — 가로 우선 compact */}
                      <div className="md:w-72 flex-shrink-0 px-3 pb-2 md:py-3 md:px-3 md:border-l border-t md:border-t-0 border-slate-100 dark:border-slate-800/50">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                          <span><span className="text-slate-400 dark:text-slate-500">보관</span> <span className="text-slate-700 dark:text-slate-300">{item.loc}</span></span>
                          <span><span className="text-slate-400 dark:text-slate-500">조건</span> <span className="text-slate-700 dark:text-slate-300">{item.storageCondition}</span></span>
                          <span><span className="text-slate-400 dark:text-slate-500">MSDS</span> {item.hasMsds
                            ? <span className="text-emerald-600 dark:text-emerald-400">등록</span>
                            : <span className="text-amber-600 dark:text-amber-400">미등록</span>
                          }</span>
                          <span><span className="text-slate-400 dark:text-slate-500">점검</span> <span className="text-slate-700 dark:text-slate-300">{item.lastInspection || <span className="text-amber-500">미점검</span>}</span></span>
                        </div>
                      </div>

                      {/* RIGHT: 보호구(PPE) — 가로 한 줄 고정 4슬롯 */}
                      <div className="w-[120px] flex-shrink-0 px-3 pb-2 md:py-3 md:px-3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/50 flex items-center justify-center">
                        <PPERow ppe={item.ppe} />
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
