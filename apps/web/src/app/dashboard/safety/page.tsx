"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

// PPE(보호구) 아이콘 렌더링
function PPEIcon({ type, required }: { type: string; required?: boolean }) {
  const base = "w-6 h-6 rounded flex-shrink-0 flex items-center justify-center";
  const active = required
    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
    : "text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800";
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
  const iconEl = (() => {
    if (type === "gloves") return <Hand className={iconClass} strokeWidth={2.5} aria-label={label} />;
    if (type === "goggles") return <Glasses className={iconClass} strokeWidth={2.5} aria-label={label} />;
    if (type === "coat") return <Shirt className={iconClass} strokeWidth={2.5} aria-label={label} />;
    if (type === "mask") return <ShieldCheck className={iconClass} strokeWidth={2.5} aria-label={label} />;
    return null;
  })();

  if (!iconEl) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${base} ${active} cursor-help inline-flex`}>{iconEl}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-bold">{label}{required ? " (필수)" : ""}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

  // ─── Mutable item state ───────────────────────────────────────────────
  const [items, setItems] = useState<SafetyItem[]>(safetyItems);

  // ─── MSDS 등록 Dialog ─────────────────────────────────────────────────
  const [msdsDialogOpen, setMsdsDialogOpen] = useState(false);
  const [msdsTarget, setMsdsTarget] = useState<SafetyItem | null>(null);
  const [msdsForm, setMsdsForm] = useState({
    docVersion: "",
    registeredAt: new Date().toISOString().split("T")[0],
    expiresAt: "",
    fileName: "",
  });
  const [msdsSaving, setMsdsSaving] = useState(false);

  const openMsdsDialog = (item: SafetyItem) => {
    setMsdsTarget(item);
    setMsdsForm({
      docVersion: "1.0",
      registeredAt: new Date().toISOString().split("T")[0],
      expiresAt: "",
      fileName: "",
    });
    setMsdsDialogOpen(true);
  };

  const handleMsdsSave = async () => {
    if (!msdsTarget) return;
    if (!msdsForm.docVersion || !msdsForm.registeredAt) {
      toast({ title: "필수 항목 누락", description: "문서 버전과 등록일은 필수입니다.", variant: "destructive" });
      return;
    }
    setMsdsSaving(true);
    // 시뮬레이션 (실제 API 연동 시 대체)
    await new Promise((r) => setTimeout(r, 800));
    setItems((prev) =>
      prev.map((i) =>
        i.id === msdsTarget.id
          ? {
              ...i,
              hasMsds: true,
              msdsUpdatedAt: msdsForm.registeredAt,
              actionStatus: i.lastInspection ? "normal" : i.actionStatus === "action_required" ? "caution" : i.actionStatus,
            }
          : i
      )
    );
    toast({ title: "MSDS 등록 완료", description: `${msdsTarget.name}의 MSDS가 등록되었습니다.` });
    setMsdsSaving(false);
    setMsdsDialogOpen(false);
  };

  // ─── 점검 기록 Dialog ─────────────────────────────────────────────────
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [inspTarget, setInspTarget] = useState<SafetyItem | null>(null);
  const [inspForm, setInspForm] = useState({
    inspectedAt: new Date().toISOString().split("T")[0],
    inspector: "",
    storageOk: true,
    ppeOk: true,
    hasIssue: false,
    actionTaken: "",
  });
  const [inspSaving, setInspSaving] = useState(false);

  const openInspDialog = (item: SafetyItem) => {
    setInspTarget(item);
    setInspForm({
      inspectedAt: new Date().toISOString().split("T")[0],
      inspector: "",
      storageOk: true,
      ppeOk: true,
      hasIssue: false,
      actionTaken: "",
    });
    setInspDialogOpen(true);
  };

  const handleInspSave = async () => {
    if (!inspTarget) return;
    if (!inspForm.inspector || !inspForm.inspectedAt) {
      toast({ title: "필수 항목 누락", description: "점검일과 점검자는 필수입니다.", variant: "destructive" });
      return;
    }
    setInspSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setItems((prev) =>
      prev.map((i) =>
        i.id === inspTarget.id
          ? {
              ...i,
              lastInspection: inspForm.inspectedAt,
              actionStatus: i.hasMsds && !inspForm.hasIssue ? "normal" : inspForm.hasIssue ? "caution" : i.actionStatus,
            }
          : i
      )
    );
    toast({ title: "점검 기록 완료", description: `${inspTarget.name}의 점검이 기록되었습니다.` });
    setInspSaving(false);
    setInspDialogOpen(false);
  };

  const filteredItems = (items || []).filter((item) => {
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

  const totalCount = items.length;
  const highRiskCount = items.filter((i) => i.isHighRisk).length;
  const msdsMissingCount = items.filter((i) => !i.hasMsds).length;

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
    <div className="w-full py-4 md:py-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex-shrink-0">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">안전 관리</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              GMP/KOSHA 규격 대응. 고위험 물질, MSDS, 필수 보호구를 한눈에 관리합니다.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="text-xs shrink-0 border-slate-200 dark:border-slate-700">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">CSV </span>내보내기
          </Button>
        </div>

        {/* 1. 상단 안전 요약 KPI */}
        <div className="grid gap-3 sm:gap-4 grid-cols-3">
          <Card className="border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-slate-900">
            <CardContent className="pt-4 sm:pt-6 pb-4 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[11px] sm:text-sm font-medium text-slate-600 dark:text-slate-400">전체 관리</p>
                <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {totalCount}<span className="text-[10px] sm:text-sm font-normal text-slate-500 dark:text-slate-400 ml-0.5">종</span>
                </p>
              </div>
              <ShieldAlert className="text-slate-400 dark:text-slate-500 w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-red-100 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/30 shadow-sm">
            <CardContent className="pt-4 sm:pt-6 pb-4 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[11px] sm:text-sm font-medium text-red-600 dark:text-red-400">고위험</p>
                <p className="text-xl sm:text-3xl font-bold text-red-700 dark:text-red-300">
                  {highRiskCount}<span className="text-[10px] sm:text-sm font-normal text-red-500 dark:text-red-400 ml-0.5">종</span>
                </p>
              </div>
              <Biohazard className="text-red-400 dark:text-red-500 w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/30 shadow-sm">
            <CardContent className="pt-4 sm:pt-6 pb-4 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[11px] sm:text-sm font-medium text-amber-600 dark:text-amber-400">MSDS 누락</p>
                <p className="text-xl sm:text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {msdsMissingCount}<span className="text-[10px] sm:text-sm font-normal text-amber-500 dark:text-amber-400 ml-0.5">종</span>
                </p>
              </div>
              <FileWarning className="text-amber-400 dark:text-amber-500 w-7 h-7 sm:w-10 sm:h-10 flex-shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* 슬림 필터 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 py-3 px-3 sm:px-4 border rounded-lg border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs border-slate-200 dark:border-slate-700">
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
              <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="MSDS 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">MSDS 상태 전체</SelectItem>
                <SelectItem value="registered">등록됨</SelectItem>
                <SelectItem value="missing">누락</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs border-slate-200 dark:border-slate-700">
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
              <div className="space-y-2 antialiased">
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
                  const requiredPpe = item.ppe.filter((p) => p.required).map((p) =>
                    p.type === "gloves" ? "보호장갑" : p.type === "goggles" ? "보안경" : p.type === "coat" ? "실험복" : p.type === "mask" ? "마스크" : ""
                  ).filter(Boolean);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 border-slate-100 dark:border-slate-800/50 ${getBorderColor(item.level)}`}
                    >
                      {/* 1행: 핵심 식별 정보 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex gap-1.5 flex-shrink-0">
                          {item.icons.map((icon) => (
                            <GHSPictogram key={icon} type={icon} />
                          ))}
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-mono">
                          {item.cas}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskBadge.cls}`}>
                          {riskBadge.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${actionBadge.cls}`}>
                          {actionBadge.label}
                        </Badge>
                      </div>

                      {/* 2행: 운영 메타 정보 */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>보관: {item.loc}</span>
                        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
                        <span className="hidden sm:inline">조건: {item.storageCondition}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>MSDS: {item.hasMsds ? (
                          <span className="text-emerald-600 dark:text-emerald-400">등록</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">미등록</span>
                        )}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>점검: {item.lastInspection || <span className="text-amber-500">미점검</span>}</span>
                      </div>

                      {/* 보호구(PPE) 아이콘 */}
                      {item.ppe.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-0.5">보호구</span>
                          {item.ppe.map((p) => (
                            <PPEIcon key={p.type} type={p.type} required={p.required} />
                          ))}
                        </div>
                      )}

                      {/* 3행: 후속 조치 CTA */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {!item.hasMsds && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            onClick={() => openMsdsDialog(item)}
                          >
                            <FileWarning className="h-3 w-3 mr-1" />MSDS 등록
                          </Button>
                        )}
                        {!item.lastInspection && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={() => openInspDialog(item)}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />점검 기록
                          </Button>
                        )}
                        {item.level === "HIGH" && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => toast({ title: "폐기 처리", description: `${item.name}의 폐기 절차를 확인하세요.` })}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />폐기 처리
                          </Button>
                        )}
                        {item.actionStatus === "normal" && item.hasMsds && item.lastInspection && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />관리 정상
                          </span>
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

      {/* ─── MSDS 등록 Dialog ─────────────────────────────────────────── */}
      <Dialog open={msdsDialogOpen} onOpenChange={setMsdsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-4 w-4 text-amber-600" />
              MSDS 등록
            </DialogTitle>
            <DialogDescription className="text-xs">
              {msdsTarget?.name} ({msdsTarget?.cas})의 안전보건자료를 등록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="msds-substance" className="text-xs font-medium">물질명</Label>
                <Input id="msds-substance" value={msdsTarget?.name || ""} disabled className="h-8 text-xs bg-slate-50 dark:bg-slate-900" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msds-cas" className="text-xs font-medium">CAS No.</Label>
                <Input id="msds-cas" value={msdsTarget?.cas || ""} disabled className="h-8 text-xs bg-slate-50 dark:bg-slate-900" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msds-file" className="text-xs font-medium">문서 파일</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="msds-file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="h-8 text-xs flex-1"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, fileName: e.target.files?.[0]?.name || "" }))}
                />
              </div>
              {msdsForm.fileName && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />{msdsForm.fileName}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="msds-version" className="text-xs font-medium">문서 버전 *</Label>
                <Input
                  id="msds-version"
                  value={msdsForm.docVersion}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, docVersion: e.target.value }))}
                  placeholder="1.0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msds-date" className="text-xs font-medium">등록일 *</Label>
                <Input
                  id="msds-date"
                  type="date"
                  value={msdsForm.registeredAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, registeredAt: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msds-expires" className="text-xs font-medium">만료일</Label>
                <Input
                  id="msds-expires"
                  type="date"
                  value={msdsForm.expiresAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setMsdsDialogOpen(false)} disabled={msdsSaving}>
              취소
            </Button>
            <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleMsdsSave} disabled={msdsSaving}>
              {msdsSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "MSDS 등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 점검 기록 Dialog ─────────────────────────────────────────── */}
      <Dialog open={inspDialogOpen} onOpenChange={setInspDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              점검 기록
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspTarget?.name} ({inspTarget?.cas})의 안전 점검을 기록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="insp-date" className="text-xs font-medium">점검일 *</Label>
                <Input
                  id="insp-date"
                  type="date"
                  value={inspForm.inspectedAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspectedAt: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insp-person" className="text-xs font-medium">점검자 *</Label>
                <Input
                  id="insp-person"
                  value={inspForm.inspector}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspector: e.target.value }))}
                  placeholder="이름 입력"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">보관 상태 정상</Label>
                  <p className="text-[11px] text-slate-500">보관 조건 및 용기 상태가 적합합니다.</p>
                </div>
                <Switch checked={inspForm.storageOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, storageOk: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">PPE 확인</Label>
                  <p className="text-[11px] text-slate-500">필수 보호구가 비치되어 있습니다.</p>
                </div>
                <Switch checked={inspForm.ppeOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, ppeOk: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium text-amber-700 dark:text-amber-400">이상 여부</Label>
                  <p className="text-[11px] text-slate-500">점검 중 이상이 발견되었습니다.</p>
                </div>
                <Switch checked={inspForm.hasIssue} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, hasIssue: v }))} />
              </div>
            </div>
            {inspForm.hasIssue && (
              <div className="space-y-1.5">
                <Label htmlFor="insp-action" className="text-xs font-medium">조치 내용</Label>
                <Textarea
                  id="insp-action"
                  value={inspForm.actionTaken}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInspForm((f) => ({ ...f, actionTaken: e.target.value }))}
                  placeholder="발견된 이상 및 조치 내용을 기록하세요."
                  rows={3}
                  className="text-xs"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setInspDialogOpen(false)} disabled={inspSaving}>
              취소
            </Button>
            <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleInspSave} disabled={inspSaving}>
              {inspSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "점검 기록 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
