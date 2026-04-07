"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
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
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  X,
  Calendar,
  FileText,
  Sparkles,
  Filter,
  MoreHorizontal,
  TrendingUp,
  ClipboardCheck,
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
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";
import {
  buildSafetyDecision,
  type SafetyItemInput,
  type ClassifiedSafetyItem,
  type StrategyFrame,
  type StrategyOption,
  type OperationalClassification,
} from "@/lib/ai/safety-decision-engine";

// ── GHS 픽토그램 (라이트 테마) ──────────────────────────────────────────────
const GHS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  corrosive: { label: "부식성 물질", bg: "bg-red-50", color: "text-red-500" },
  toxic: { label: "독성 물질", bg: "bg-amber-50", color: "text-amber-600" },
  flammable: { label: "인화성 물질", bg: "bg-orange-50", color: "text-orange-500" },
  oxidizer: { label: "산화성 물질", bg: "bg-yellow-50", color: "text-yellow-600" },
};

function GHSIcon({ type }: { type: string }) {
  const config = GHS_CONFIG[type] || { label: "경고", bg: "bg-slate-50", color: "text-slate-500" };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${config.bg} ${config.color} cursor-help flex-shrink-0`}>
            {type === "corrosive" && <Droplets className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {type === "toxic" && <Skull className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {type === "flammable" && <Flame className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {type === "oxidizer" && <FlameKindling className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {!["corrosive", "toxic", "flammable", "oxidizer"].includes(type) && <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />}
          </span>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs font-semibold">{config.label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PPEIcon({ type, required }: { type: string; required?: boolean }) {
  const active = required ? "text-blue-600 bg-blue-50" : "text-slate-400 bg-slate-50";
  const label = type === "gloves" ? "보호장갑" : type === "goggles" ? "보안경" : type === "coat" ? "실험복" : type === "mask" ? "마스크" : "PPE";
  const iconClass = "w-3.5 h-3.5";
  const iconEl = (() => {
    if (type === "gloves") return <Hand className={iconClass} strokeWidth={2.5} />;
    if (type === "goggles") return <Glasses className={iconClass} strokeWidth={2.5} />;
    if (type === "coat") return <Shirt className={iconClass} strokeWidth={2.5} />;
    if (type === "mask") return <ShieldCheck className={iconClass} strokeWidth={2.5} />;
    return null;
  })();
  if (!iconEl) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${active} cursor-help flex-shrink-0`}>{iconEl}</span>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs font-semibold">{label}{required ? " (필수)" : ""}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Classification badge ─────────────────────────────────────────────
const CLASS_STYLE: Record<OperationalClassification, { label: string; bg: string; text: string; dot: string }> = {
  immediate_action: { label: "즉시 조치", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  document_remediation: { label: "문서 보완", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  review_required: { label: "검토 필요", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  monitor_only: { label: "모니터링", bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" },
  compliant: { label: "정상", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

// ── Mock data ────────────────────────────────────────────────────────────────
type SafetyItem = SafetyItemInput;

const safetyItems: SafetyItem[] = [
  {
    id: 1, name: "Sulfuric Acid (황산)", cas: "7664-93-9", isHighRisk: true, level: "HIGH",
    actionStatus: "caution", hasMsds: true, msdsUpdatedAt: "2025-01-15", registeredAt: "2024-03-10",
    lastInspection: "2025-02-20", storageCondition: "산성 전용, 밀폐 보관", loc: "시약장 A (산성)",
    icons: ["corrosive", "toxic"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: true }, { type: "mask", required: false }],
  },
  {
    id: 2, name: "Acetone (아세톤)", cas: "67-64-1", isHighRisk: false, level: "MEDIUM",
    actionStatus: "action_required", hasMsds: false, msdsUpdatedAt: null, registeredAt: "2024-06-15",
    lastInspection: null, storageCondition: "방폭, 직사광선 차단", loc: "방폭 캐비닛 1",
    icons: ["flammable"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: false }, { type: "mask", required: false }],
  },
  {
    id: 3, name: "Sodium Hydroxide (수산화나트륨)", cas: "1310-73-2", isHighRisk: true, level: "HIGH",
    actionStatus: "action_required", hasMsds: false, msdsUpdatedAt: null, registeredAt: "2024-05-22",
    lastInspection: "2025-01-10", storageCondition: "염기성 전용, 밀폐 보관", loc: "시약장 B (염기성)",
    icons: ["corrosive"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: true }, { type: "coat", required: true }, { type: "mask", required: false }],
  },
  {
    id: 4, name: "Ethanol 70%", cas: "64-17-5", isHighRisk: false, level: "LOW",
    actionStatus: "normal", hasMsds: true, msdsUpdatedAt: "2025-02-01", registeredAt: "2024-08-01",
    lastInspection: "2025-03-01", storageCondition: "실온 보관", loc: "일반 캐비닛",
    icons: ["flammable"],
    ppe: [{ type: "gloves", required: true }, { type: "goggles", required: false }, { type: "coat", required: false }, { type: "mask", required: false }],
  },
];

const LOCATIONS = ["시약장 A (산성)", "시약장 B (염기성)", "방폭 캐비닛 1", "일반 캐비닛"];

// ── 안전 지수 도넛 차트 색상 ──────────────────────────────────
const DONUT_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#e2e8f0"];

// ── 안전 지수 트렌드 (최근 7일 mock) ──────────────────────────
const TREND_DATA = [
  { day: "4/1", score: 88 },
  { day: "4/2", score: 85 },
  { day: "4/3", score: 89 },
  { day: "4/4", score: 91 },
  { day: "4/5", score: 90 },
  { day: "4/6", score: 92 },
  { day: "4/7", score: 92 },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function SafetyManagerPage() {
  const { toast } = useToast();

  // ── Filters ──
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [msdsFilter, setMsdsFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Mutable item state ──
  const [items, setItems] = useState<SafetyItem[]>(safetyItems);

  // ── Strategy ──
  const [activeFrame, setActiveFrame] = useState<StrategyFrame>("balanced_ops");

  // ── Rail ──
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // ── Emergency banner ──
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── AI Queue completion ──
  const [completedQueueIds, setCompletedQueueIds] = useState<Set<number>>(new Set());

  // ── MSDS Dialog ──
  const [msdsDialogOpen, setMsdsDialogOpen] = useState(false);
  const [msdsTarget, setMsdsTarget] = useState<SafetyItem | null>(null);
  const [msdsForm, setMsdsForm] = useState({ docVersion: "", registeredAt: new Date().toISOString().split("T")[0], expiresAt: "", fileName: "" });
  const [msdsSaving, setMsdsSaving] = useState(false);

  const openMsdsDialog = (item: SafetyItem | ClassifiedSafetyItem) => {
    setMsdsTarget(item as SafetyItem);
    setMsdsForm({ docVersion: "1.0", registeredAt: new Date().toISOString().split("T")[0], expiresAt: "", fileName: "" });
    setMsdsDialogOpen(true);
  };
  const handleMsdsSave = async () => {
    if (!msdsTarget) return;
    if (!msdsForm.docVersion || !msdsForm.registeredAt) { toast({ title: "필수 항목 누락", description: "문서 버전과 등록일은 필수입니다.", variant: "destructive" }); return; }
    setMsdsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setItems((prev) => prev.map((i) => i.id === msdsTarget.id ? { ...i, hasMsds: true, msdsUpdatedAt: msdsForm.registeredAt, actionStatus: i.lastInspection ? "normal" as const : i.actionStatus === "action_required" ? "caution" as const : i.actionStatus } : i));
    toast({ title: "MSDS 등록 완료", description: `${msdsTarget.name}의 MSDS가 등록되었습니다.` });
    setMsdsSaving(false);
    setMsdsDialogOpen(false);
  };

  // ── Inspection Dialog ──
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [inspTarget, setInspTarget] = useState<SafetyItem | null>(null);
  const [inspForm, setInspForm] = useState({ inspectedAt: new Date().toISOString().split("T")[0], inspector: "", storageOk: true, ppeOk: true, hasIssue: false, actionTaken: "" });
  const [inspSaving, setInspSaving] = useState(false);

  const openInspDialog = (item: SafetyItem | ClassifiedSafetyItem) => {
    setInspTarget(item as SafetyItem);
    setInspForm({ inspectedAt: new Date().toISOString().split("T")[0], inspector: "", storageOk: true, ppeOk: true, hasIssue: false, actionTaken: "" });
    setInspDialogOpen(true);
  };
  const handleInspSave = async () => {
    if (!inspTarget) return;
    if (!inspForm.inspector || !inspForm.inspectedAt) { toast({ title: "필수 항목 누락", description: "점검일과 점검자는 필수입니다.", variant: "destructive" }); return; }
    setInspSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setItems((prev) => prev.map((i) => i.id === inspTarget.id ? { ...i, lastInspection: inspForm.inspectedAt, actionStatus: i.hasMsds && !inspForm.hasIssue ? "normal" as const : inspForm.hasIssue ? "caution" as const : i.actionStatus } : i));
    toast({ title: "점검 기록 완료", description: `${inspTarget.name}의 점검이 기록되었습니다.` });
    setInspSaving(false);
    setInspDialogOpen(false);
  };

  // ── Dispose Dialog ──
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<SafetyItem | null>(null);

  const openDisposeDialog = (item: SafetyItem | ClassifiedSafetyItem) => { setDisposeTarget(item as SafetyItem); setDisposeDialogOpen(true); };
  const handleDispose = () => {
    if (!disposeTarget) return;
    setItems((prev) => prev.filter((i) => i.id !== disposeTarget.id));
    toast({ title: "폐기 처리 완료", description: `${disposeTarget.name}이(가) 목록에서 제거되었습니다.` });
    setDisposeDialogOpen(false);
    setDisposeTarget(null);
    if (selectedItemId === disposeTarget.id) setSelectedItemId(null);
  };

  // ── Filters ──
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

  // ── AI Decision Engine ──
  const decision = useMemo(() => buildSafetyDecision(items), [items]);
  const activeOption = decision.options.find((o: StrategyOption) => o.frame === activeFrame) || decision.options[2];

  const classifiedMap = useMemo(() => {
    const map = new Map<number, ClassifiedSafetyItem>();
    for (const c of decision.allClassified) map.set(c.id, c);
    return map;
  }, [decision.allClassified]);

  const selectedClassified = selectedItemId != null ? classifiedMap.get(selectedItemId) ?? null : null;

  // ── KPI 계산 ──
  const totalCount = items.length;
  const highRiskCount = items.filter((i) => i.isHighRisk).length;
  const msdsMissingCount = items.filter((i) => !i.hasMsds).length;
  const recentInspCount = items.filter((i) => {
    if (!i.lastInspection) return false;
    return (Date.now() - new Date(i.lastInspection).getTime()) < 7 * 86400000;
  }).length;

  // ── KPI 세부 통계 (호버 팝업용) ──
  const kpiDetail = useMemo(() => {
    // 전체 화학물질 — 유기/무기 분류
    const organic = items.filter((i) => ["67-64-1", "64-17-5"].includes(i.cas)).length;
    const inorganic = totalCount - organic;
    // 고위험 물질 — 위험 유형별
    const flammableCount = items.filter((i) => i.icons.includes("flammable")).length;
    const corrosiveCount = items.filter((i) => i.icons.includes("corrosive")).length;
    const toxicCount = items.filter((i) => i.icons.includes("toxic")).length;
    const oxidizerCount = items.filter((i) => i.icons.includes("oxidizer")).length;
    // MSDS 미등록 — 신규 입고 vs 갱신 누락
    const msdsNewMissing = items.filter((i) => !i.hasMsds && !i.msdsUpdatedAt).length;
    const msdsExpired = msdsMissingCount - msdsNewMissing;
    // 최근 점검 — 정기 vs 수시
    const scheduledInsp = Math.max(1, Math.ceil(recentInspCount * 0.6));
    const adhocInsp = recentInspCount - scheduledInsp;
    return { organic, inorganic, flammableCount, corrosiveCount, toxicCount, oxidizerCount, msdsNewMissing, msdsExpired, scheduledInsp, adhocInsp };
  }, [items, totalCount, msdsMissingCount, recentInspCount]);

  // ── 도넛 차트 데이터 ──
  const compliantCount = decision.brief.compliantCount + decision.brief.monitorOnlyCount;
  const docRemCount = decision.brief.documentRemediationCount;
  const immediateCount = decision.brief.immediateActionCount;
  const reviewCount = decision.brief.reviewRequiredCount;
  const safetyScore = totalCount > 0 ? Math.round(((compliantCount) / totalCount) * 100) : 0;
  const donutData = [
    { name: "정상", value: compliantCount },
    { name: "문서 보완", value: docRemCount },
    { name: "즉시 조치", value: immediateCount },
    { name: "검토", value: reviewCount },
  ];

  // ── AI Queue ──
  const queueItems = useMemo(() => {
    return (activeOption?.sequence ?? decision.queue)
      .filter((q: ClassifiedSafetyItem) => q.classification !== "compliant" && q.classification !== "monitor_only")
      .slice(0, 5);
  }, [activeOption, decision.queue]);

  // ── Export ──
  const handleExport = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast({ title: "내보낼 데이터 없음", description: "내보낼 제품이 없습니다.", variant: "destructive" }); return;
    }
    const headers = ["제품명", "CAS", "위험도", "MSDS 상태", "최종 업데이트", "보관 위치"];
    const rows = filteredItems.map((item) => [item.name, item.cas, item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "중위험" : "일반", item.hasMsds ? "등록" : "누락", item.msdsUpdatedAt || "-", item.loc]);
    const csv = [headers, ...rows].map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `안전_제품_리스트_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "내보내기 완료", description: "CSV 파일이 다운로드되었습니다." });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 pt-4 md:pt-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ═══ 긴급 안전 알림 배너 ═══ */}
        {immediateCount > 0 && !bannerDismissed && (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-red-600 text-white animate-stagger-up">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold">긴급 안전 경고: </span>
              <span className="text-sm">현재 즉시 조치가 필요한 고위험 항목이 {immediateCount}건 감지되었습니다.</span>
            </div>
            <button onClick={() => { const firstImmediate = queueItems[0]; if (firstImmediate) setSelectedItemId(firstImmediate.id); }}
              className="px-4 py-1.5 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/10 transition-colors flex-shrink-0">
              지금 확인하기
            </button>
            <button onClick={() => setBannerDismissed(true)} className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ═══ 헤더 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">안전 운영 판단</h1>
                <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">GMP/KOSHA 규격 대응 · AI 권장 우선순위 기반 운영</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button onClick={handleExport} variant="outline" size="sm" className="h-10 px-4 text-sm gap-2 border-slate-200">
              <Download className="h-4 w-4" />CSV 내보내기
            </Button>
            <Button size="sm" className="h-10 px-5 text-sm gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm">
              <Sparkles className="h-4 w-4" />AI MSDS 분석
            </Button>
          </div>
        </div>

        {/* ═══ KPI 카드 4개 (호버 상세 팝업 포함) ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* 전체 화학물질 */}
          <div className="group/kpi relative rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-xs text-slate-400">전체 화학물질</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{totalCount}</p>
            <p className="text-xs text-slate-500 mt-1">전월 대비 +2</p>
            {/* 호버 팝업 */}
            <div className="absolute left-0 right-0 top-full mt-2 z-30 opacity-0 translate-y-1 pointer-events-none group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0 group-hover/kpi:pointer-events-auto transition-all duration-200 ease-out">
              <div className="mx-2 rounded-xl bg-slate-900 text-white p-4 shadow-xl">
                <p className="text-xs font-bold text-slate-300 mb-3">물질 분류 구성</p>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">유기 화합물</span>
                      <span className="font-bold">{kpiDetail.organic}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${totalCount > 0 ? (kpiDetail.organic / totalCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">무기 화합물</span>
                      <span className="font-bold">{kpiDetail.inorganic}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-400 transition-all duration-500" style={{ width: `${totalCount > 0 ? (kpiDetail.inorganic / totalCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 고위험 물질 */}
          <div className="group/kpi relative rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-red-200 transition-all cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-xs text-slate-400">고위험 물질</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{highRiskCount}</p>
            <p className="text-xs text-red-500 font-medium mt-1">즉시 조치 필요</p>
            {/* 호버 팝업 */}
            <div className="absolute left-0 right-0 top-full mt-2 z-30 opacity-0 translate-y-1 pointer-events-none group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0 group-hover/kpi:pointer-events-auto transition-all duration-200 ease-out">
              <div className="mx-2 rounded-xl bg-slate-900 text-white p-4 shadow-xl">
                <p className="text-xs font-bold text-slate-300 mb-3">위험 유형별 분포</p>
                <div className="space-y-2.5">
                  {[
                    { label: "인화성", count: kpiDetail.flammableCount, color: "bg-orange-400" },
                    { label: "부식성", count: kpiDetail.corrosiveCount, color: "bg-red-400" },
                    { label: "독성", count: kpiDetail.toxicCount, color: "bg-amber-400" },
                    { label: "산화성", count: kpiDetail.oxidizerCount, color: "bg-yellow-400" },
                  ].filter((d) => d.count > 0).map((d) => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300">{d.label}</span>
                        <span className="font-bold">{d.count}건</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${d.color} transition-all duration-500`} style={{ width: `${totalCount > 0 ? (d.count / totalCount) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MSDS 미등록 */}
          <div className="group/kpi relative rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-amber-200 transition-all cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <FileWarning className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-xs text-slate-400">MSDS 미등록</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{msdsMissingCount}</p>
            <p className="text-xs text-amber-600 font-medium mt-1">보완 필요</p>
            {/* 호버 팝업 */}
            <div className="absolute left-0 right-0 top-full mt-2 z-30 opacity-0 translate-y-1 pointer-events-none group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0 group-hover/kpi:pointer-events-auto transition-all duration-200 ease-out">
              <div className="mx-2 rounded-xl bg-slate-900 text-white p-4 shadow-xl">
                <p className="text-xs font-bold text-slate-300 mb-3">미등록 유형 분석</p>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">신규 입고 미등록</span>
                      <span className="font-bold">{kpiDetail.msdsNewMissing}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${msdsMissingCount > 0 ? (kpiDetail.msdsNewMissing / msdsMissingCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">갱신 누락</span>
                      <span className="font-bold">{kpiDetail.msdsExpired}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400 transition-all duration-500" style={{ width: `${msdsMissingCount > 0 ? (kpiDetail.msdsExpired / msdsMissingCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 최근 점검 */}
          <div className="group/kpi relative rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-emerald-200 transition-all cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-xs text-slate-400">최근 점검</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{recentInspCount}</p>
            <p className="text-xs text-slate-500 mt-1">최근 7일 이내</p>
            {/* 호버 팝업 */}
            <div className="absolute left-0 right-0 top-full mt-2 z-30 opacity-0 translate-y-1 pointer-events-none group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0 group-hover/kpi:pointer-events-auto transition-all duration-200 ease-out">
              <div className="mx-2 rounded-xl bg-slate-900 text-white p-4 shadow-xl">
                <p className="text-xs font-bold text-slate-300 mb-3">점검 유형 비중</p>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">정기 점검</span>
                      <span className="font-bold">{kpiDetail.scheduledInsp}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${recentInspCount > 0 ? (kpiDetail.scheduledInsp / recentInspCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">수시 점검</span>
                      <span className="font-bold">{kpiDetail.adhocInsp}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-teal-400 transition-all duration-500" style={{ width: `${recentInspCount > 0 ? (kpiDetail.adhocInsp / recentInspCount) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 안전 판단 대시보드 (도넛 + AI 큐) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 오늘의 안전 판단 — 도넛 차트 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">오늘의 안전 판단</h3>
            </div>

            <div className="flex flex-col items-center mb-5">
              <div className="relative w-52 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-slate-900">{safetyScore}%</span>
                  <span className="text-xs text-slate-500 mt-0.5">안전 지수</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-600">즉시 조치</span>
                <span className="font-bold text-slate-900">{immediateCount}건</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600">문서 보완</span>
                <span className="font-bold text-slate-900">{docRemCount}건</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">정상</span>
                <span className="font-bold text-slate-900">{compliantCount}건</span>
              </div>
            </div>
          </div>

          {/* AI 권장 처리 큐 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">AI 권장 처리 큐</h3>
              <span className="text-xs text-slate-400">운영 균형 우선 기준</span>
            </div>

            <div className="space-y-0 divide-y divide-slate-100">
              {queueItems.map((q: ClassifiedSafetyItem, i: number) => {
                const style = CLASS_STYLE[q.classification];
                const isCompleted = completedQueueIds.has(q.id);
                return (
                  <div key={q.id}
                    className={`py-4 first:pt-0 last:pb-0 transition-opacity ${isCompleted ? "opacity-40" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-slate-300 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          <span className="text-sm font-bold text-slate-900 truncate">{q.name.split("(")[0].trim()}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{q.priorityReason}</p>
                        <button
                          onClick={() => setSelectedItemId(q.id)}
                          className="text-xs text-blue-600 font-medium mt-1.5 hover:text-blue-700 inline-flex items-center gap-1"
                        >
                          {q.nextAction} <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => setCompletedQueueIds((prev) => { const next = new Set(prev); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); return next; })}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isCompleted ? "text-emerald-500 bg-emerald-50" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
                        title="완료 처리"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {queueItems.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  모든 항목이 정상 상태입니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 안전 지수 트렌드 (7일) ═══ */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">안전 지수 트렌드 (7일)</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ 화학물질 목록 ═══ */}
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {/* 필터 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9 h-9 text-sm border-slate-200 rounded-lg" placeholder="물질명 / CAS 검색"
                    value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
                </div>
                <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                  <Filter className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-400">총 {filteredItems.length}개 물질</span>
            </div>

            {/* 목록 */}
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm rounded-xl border border-slate-200 bg-white">
                  조건에 맞는 데이터가 없습니다.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const classified = classifiedMap.get(item.id);
                  const classStyle = classified ? CLASS_STYLE[classified.classification] : null;
                  const isSelected = selectedItemId === item.id;
                  const borderColor = item.level === "HIGH" ? "border-l-red-400" : item.level === "MEDIUM" ? "border-l-amber-400" : "border-l-slate-200";

                  return (
                    <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left p-4 rounded-xl border-l-4 border transition-all ${borderColor} ${
                        isSelected ? "bg-blue-50/50 border-blue-200" : "border-slate-200 hover:bg-slate-50 bg-white"
                      }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex gap-1 flex-shrink-0">
                            {item.icons.map((icon: string) => <GHSIcon key={icon} type={icon} />)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {classStyle && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${classStyle.bg} ${classStyle.text} flex-shrink-0`}>
                                  {classStyle.label}
                                </span>
                              )}
                              <span className="text-sm font-bold text-slate-900 truncate">{item.name}</span>
                              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{item.cas}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-500">
                              <span>{item.loc}</span>
                              <span className="text-slate-300 hidden sm:inline">·</span>
                              <span className="hidden sm:inline">{item.storageCondition}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                          <div className="text-right hidden md:block">
                            <span className="text-slate-400">MSDS 상태</span>
                            <div className={`font-semibold mt-0.5 ${item.hasMsds ? "text-emerald-600" : "text-amber-600"}`}>
                              {item.hasMsds ? "● 등록" : "● 미등록"}
                            </div>
                          </div>
                          <div className="text-right hidden md:block">
                            <span className="text-slate-400">최근 점검</span>
                            <div className="text-slate-700 font-medium mt-0.5">{item.lastInspection || "미점검"}</div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right Rail: 판단 근거 ── */}
          {selectedClassified && (
            <div className="hidden lg:block w-80 flex-shrink-0 sticky top-20 self-start">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">판단 근거</span>
                  <button type="button" onClick={() => setSelectedItemId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {selectedClassified.icons.map((icon: string) => <GHSIcon key={icon} type={icon} />)}
                      <span className="text-sm font-bold text-slate-900">{selectedClassified.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{selectedClassified.cas}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {(() => {
                      const s = CLASS_STYLE[selectedClassified.classification];
                      return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>;
                    })()}
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">추천 이유</span>
                    <p className="text-xs text-slate-700 leading-relaxed">{selectedClassified.priorityReason}</p>
                  </div>

                  {selectedClassified.blockers.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-red-50 border border-red-100">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block mb-1.5">차단 요인</span>
                      <div className="space-y-1">
                        {selectedClassified.blockers.map((b: string) => (
                          <div key={b} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="text-xs text-red-700">{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">보류 시 리스크</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedClassified.holdRisk}</p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">문서 상태</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span>MSDS: {selectedClassified.hasMsds ? <span className="text-emerald-600 font-semibold">등록</span> : <span className="text-amber-600 font-semibold">미등록</span>}</span>
                      <span>점검: {selectedClassified.lastInspection ? <span className="text-emerald-600 font-semibold">{selectedClassified.lastInspection}</span> : <span className="text-amber-600 font-semibold">없음</span>}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">필수 보호구</span>
                    <div className="flex items-center gap-1.5">
                      {selectedClassified.ppe.map((p: { type: string; required: boolean }) => (
                        <PPEIcon key={p.type} type={p.type} required={p.required} />
                      ))}
                    </div>
                  </div>

                  {/* Action dock */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {!selectedClassified.hasMsds && (
                      <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50 justify-start gap-2"
                        onClick={() => openMsdsDialog(selectedClassified)}>
                        <FileWarning className="h-3.5 w-3.5" />MSDS 등록
                      </Button>
                    )}
                    {!selectedClassified.lastInspection && (
                      <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-blue-700 border-blue-200 hover:bg-blue-50 justify-start gap-2"
                        onClick={() => openInspDialog(selectedClassified)}>
                        <ClipboardCheck className="h-3.5 w-3.5" />점검 기록
                      </Button>
                    )}
                    {selectedClassified.level === "HIGH" && (
                      <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-red-700 border-red-200 hover:bg-red-50 justify-start gap-2"
                        onClick={() => openDisposeDialog(selectedClassified)}>
                        <AlertTriangle className="h-3.5 w-3.5" />폐기 처리
                      </Button>
                    )}
                    {selectedClassified.classification === "compliant" && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1.5 py-1">
                        <ShieldCheck className="h-3.5 w-3.5" />추가 조치 불필요
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Dialogs ═══ */}

      {/* MSDS Dialog */}
      <Dialog open={msdsDialogOpen} onOpenChange={setMsdsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><FileWarning className="h-4 w-4 text-amber-500" /></div>
              MSDS 등록
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">{msdsTarget?.name} ({msdsTarget?.cas})의 안전보건자료를 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">물질명</Label><Input value={msdsTarget?.name || ""} disabled className="h-9 text-xs bg-slate-50" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">CAS No.</Label><Input value={msdsTarget?.cas || ""} disabled className="h-9 text-xs bg-slate-50" /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">문서 파일</Label>
              <Input type="file" accept=".pdf,.doc,.docx" className="h-9 text-xs"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, fileName: e.target.files?.[0]?.name || "" }))} />
              {msdsForm.fileName && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{msdsForm.fileName}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">문서 버전 *</Label><Input value={msdsForm.docVersion} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, docVersion: e.target.value }))} placeholder="1.0" className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">등록일 *</Label><Input type="date" value={msdsForm.registeredAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, registeredAt: e.target.value }))} className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">만료일</Label><Input type="date" value={msdsForm.expiresAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, expiresAt: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMsdsDialogOpen(false)} disabled={msdsSaving}>취소</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleMsdsSave} disabled={msdsSaving}>
              {msdsSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "MSDS 등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inspection Dialog */}
      <Dialog open={inspDialogOpen} onOpenChange={setInspDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><ClipboardCheck className="h-4 w-4 text-blue-500" /></div>
              점검 기록
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">{inspTarget?.name} ({inspTarget?.cas})의 안전 점검을 기록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">점검일 *</Label><Input type="date" value={inspForm.inspectedAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspectedAt: e.target.value }))} className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">점검자 *</Label><Input value={inspForm.inspector} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspector: e.target.value }))} placeholder="이름" className="h-9 text-xs" /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div><Label className="text-xs font-medium text-slate-700">보관 상태 정상</Label><p className="text-[11px] text-slate-400">보관 조건 및 용기 상태가 적합합니다.</p></div><Switch checked={inspForm.storageOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, storageOk: v }))} /></div>
              <div className="flex items-center justify-between"><div><Label className="text-xs font-medium text-slate-700">PPE 확인</Label><p className="text-[11px] text-slate-400">필수 보호구가 비치되어 있습니다.</p></div><Switch checked={inspForm.ppeOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, ppeOk: v }))} /></div>
              <div className="flex items-center justify-between"><div><Label className="text-xs font-medium text-amber-600">이상 여부</Label><p className="text-[11px] text-slate-400">점검 중 이상이 발견되었습니다.</p></div><Switch checked={inspForm.hasIssue} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, hasIssue: v }))} /></div>
            </div>
            {inspForm.hasIssue && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">조치 내용</Label>
                <Textarea value={inspForm.actionTaken} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInspForm((f) => ({ ...f, actionTaken: e.target.value }))} placeholder="발견된 이상 및 조치 내용을 기록하세요." rows={3} className="text-xs" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setInspDialogOpen(false)} disabled={inspSaving}>취소</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleInspSave} disabled={inspSaving}>
              {inspSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "점검 기록 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispose Dialog */}
      <Dialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-red-600">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-red-500" /></div>
              폐기 처리 확인
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">이 작업은 되돌릴 수 없습니다. 해당 물질을 안전 관리 목록에서 제거합니다.</DialogDescription>
          </DialogHeader>
          {disposeTarget && (
            <div className="space-y-3 py-2">
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-100">
                <p className="text-sm font-semibold text-red-900">{disposeTarget.name}</p>
                <p className="text-xs text-red-600 mt-1">CAS: {disposeTarget.cas}</p>
                <p className="text-xs text-red-500">보관: {disposeTarget.storageCondition} · 위치: {disposeTarget.loc}</p>
              </div>
              <p className="text-xs text-slate-500">폐기 전 MSDS에 명시된 폐기 절차를 반드시 확인하세요.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDisposeDialogOpen(false)}>취소</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDispose}>폐기 처리</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
