"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldAlert,
  Biohazard,
  AlertTriangle,
  Download,
  FileWarning,
  AlertOctagon,
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

// PPE 아이콘 렌더링 (짝수 픽셀, 선명한 벡터)
function PPEIcon({
  type,
  required,
}: {
  type: string;
  required?: boolean;
}) {
  const base = "w-6 h-6 rounded flex-shrink-0 flex items-center justify-center";
  const active = required ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50" : "text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800";
  const label =
    type === "gloves"
      ? "보호장갑"
      : type === "goggles"
        ? "보안경"
        : type === "coat"
          ? "실험복"
          : type === "mask"
            ? "마스크"
            : "PPE";

  const iconClass = "w-5 h-5";
  if (type === "gloves") return <div className={`${base} ${active}`}><Hand className={iconClass} strokeWidth={2.5} aria-label={label} /></div>;
  if (type === "goggles") return <div className={`${base} ${active}`}><Glasses className={iconClass} strokeWidth={2.5} aria-label={label} /></div>;
  if (type === "coat") return <div className={`${base} ${active}`}><Shirt className={iconClass} strokeWidth={2.5} aria-label={label} /></div>;
  if (type === "mask") return <div className={`${base} ${active}`}><ShieldCheck className={iconClass} strokeWidth={2.5} aria-label={label} /></div>;
  return null;
}

const safetyItems = [
  {
    id: 1,
    name: "Sulfuric Acid (황산)",
    cas: "7664-93-9",
    isHighRisk: true,
    level: "HIGH" as const,
    hasMsds: true,
    msdsUpdatedAt: "2025-01-15",
    loc: "시약장 A (산성)",
    icons: ["corrosive", "toxic"] as const,
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
    level: "MEDIUM" as const,
    hasMsds: false,
    msdsUpdatedAt: null,
    loc: "방폭 캐비닛 1",
    icons: ["flammable"] as const,
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
    level: "HIGH" as const,
    hasMsds: false,
    msdsUpdatedAt: null,
    loc: "시약장 B (염기성)",
    icons: ["corrosive"] as const,
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
    level: "LOW" as const,
    hasMsds: true,
    msdsUpdatedAt: "2025-02-01",
    loc: "일반 캐비닛",
    icons: ["flammable"] as const,
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
              <div className="space-y-3 antialiased">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 border-slate-100 dark:border-slate-800/50 ${getBorderColor(item.level)}`}
                  >
                    {/* 좌측: 위험 아이콘 + GHS 픽토그램 + 제품 정보 */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md ${item.level === "HIGH" ? "bg-red-50 dark:bg-red-900/20" : item.level === "MEDIUM" ? "bg-orange-50 dark:bg-orange-900/20" : "bg-yellow-50 dark:bg-yellow-900/20"}`}>
                        {item.level === "HIGH" ? (
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={2.5} aria-label="고위험" />
                        ) : item.level === "MEDIUM" ? (
                          <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400" strokeWidth={2.5} aria-label="중위험" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" strokeWidth={2.5} aria-label="일반" />
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {item.icons.map((icon) => (
                          <GHSPictogram key={icon} type={icon} />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          CAS: {item.cas} | {item.loc}
                        </p>
                      </div>
                    </div>

                    {/* 우측: PPE 가이드 + MSDS 아이콘 버튼 */}
                    <div className="flex flex-wrap items-center gap-3 md:gap-4">
                      <div className="flex gap-1.5">
                        {item.ppe.map((p) => (
                          <PPEIcon key={p.type} type={p.type} required={p.required} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.hasMsds && item.msdsUpdatedAt ? (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-4 h-4" strokeWidth={2.5} />
                            {item.msdsUpdatedAt}
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                          >
                            MSDS 미등록
                          </Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                          title="MSDS 보기"
                        >
                          <FileSearch className="w-5 h-5" strokeWidth={2.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
