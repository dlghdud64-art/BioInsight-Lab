"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
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
  Zap,
  Scale,
  BookOpen,
  ChevronRight,
  Eye,
  ArrowRight,
  X,
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
  buildSafetyDecision,
  type SafetyItemInput,
  type ClassifiedSafetyItem,
  type StrategyFrame,
  type StrategyOption,
  type OperationalClassification,
} from "@/lib/ai/safety-decision-engine";

// ── GHS 픽토그램 ────────────────────────────────────────────────────────────

const GHS_CONFIG: Record<string, { label: string; iconBg: string; iconColor: string }> = {
  corrosive: { label: "부식성 물질 (Corrosive)", iconBg: "bg-red-900/40", iconColor: "text-red-400" },
  toxic: { label: "독성 물질 (Toxic)", iconBg: "bg-yellow-900/50", iconColor: "text-yellow-300" },
  flammable: { label: "인화성 물질 (Flammable)", iconBg: "bg-red-900/40", iconColor: "text-red-400" },
  oxidizer: { label: "산화성 물질 (Oxidizer)", iconBg: "bg-yellow-900/40", iconColor: "text-yellow-500" },
};

function GHSPictogram({ type }: { type: string }) {
  const config = GHS_CONFIG[type] || { label: "경고 (Warning)", iconBg: "bg-amber-900/40", iconColor: "text-amber-400" };
  const base = `w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center ${config.iconBg} ${config.iconColor}`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${base} cursor-help inline-flex`}>
            {type === "corrosive" && <Droplets className="w-4 h-4" strokeWidth={2.5} />}
            {type === "toxic" && <Skull className="w-4 h-4" strokeWidth={2.5} />}
            {type === "flammable" && <Flame className="w-4 h-4" strokeWidth={2.5} />}
            {type === "oxidizer" && <FlameKindling className="w-4 h-4" strokeWidth={2.5} />}
            {!["corrosive", "toxic", "flammable", "oxidizer"].includes(type) && <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />}
          </div>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs font-bold">{config.label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PPEIcon({ type, required }: { type: string; required?: boolean }) {
  const base = "w-6 h-6 rounded flex-shrink-0 flex items-center justify-center";
  const active = required ? "text-blue-400 bg-blue-950/50" : "text-slate-600 bg-el";
  const label = type === "gloves" ? "보호장갑" : type === "goggles" ? "보안경" : type === "coat" ? "실험복" : type === "mask" ? "마스크" : "PPE";
  const iconClass = "w-4 h-4";
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
          <div className={`${base} ${active} cursor-help inline-flex`}>{iconEl}</div>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs font-bold">{label}{required ? " (필수)" : ""}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Classification badge config ──────────────────────────────────────────────

const CLASSIFICATION_STYLE: Record<OperationalClassification, { label: string; bg: string; text: string; border: string }> = {
  immediate_action: { label: "즉시 조치", bg: "bg-red-950/40", text: "text-red-300", border: "border-red-800/60" },
  document_remediation: { label: "문서 보완", bg: "bg-amber-950/40", text: "text-amber-300", border: "border-amber-800/60" },
  review_required: { label: "검토 필요", bg: "bg-blue-950/40", text: "text-blue-300", border: "border-blue-800/60" },
  monitor_only: { label: "모니터링", bg: "bg-slate-800/40", text: "text-slate-300", border: "border-slate-700/60" },
  compliant: { label: "정상", bg: "bg-emerald-950/40", text: "text-emerald-300", border: "border-emerald-800/60" },
};

const FRAME_ICON: Record<StrategyFrame, typeof Zap> = {
  risk_minimize: Zap,
  compliance_first: BookOpen,
  balanced_ops: Scale,
};

const FRAME_COLOR: Record<StrategyFrame, { bg: string; border: string; text: string; accent: string }> = {
  risk_minimize: { bg: "bg-red-950/25", border: "border-red-700/40", text: "text-red-300", accent: "bg-red-900/40" },
  compliance_first: { bg: "bg-amber-950/25", border: "border-amber-700/40", text: "text-amber-300", accent: "bg-amber-900/40" },
  balanced_ops: { bg: "bg-blue-950/25", border: "border-blue-700/40", text: "text-blue-300", accent: "bg-blue-900/40" },
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

// ══════════════════════════════════════════════════════════════════════════════
// Safety Decision Workbench
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

  // ── Strategy selection ──
  const [activeFrame, setActiveFrame] = useState<StrategyFrame>("balanced_ops");

  // ── Rail selection ──
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // ── MSDS Dialog ──
  const [msdsDialogOpen, setMsdsDialogOpen] = useState(false);
  const [msdsTarget, setMsdsTarget] = useState<SafetyItem | null>(null);
  const [msdsForm, setMsdsForm] = useState({ docVersion: "", registeredAt: new Date().toISOString().split("T")[0], expiresAt: "", fileName: "" });
  const [msdsSaving, setMsdsSaving] = useState(false);

  const openMsdsDialog = (item: SafetyItem) => {
    setMsdsTarget(item);
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

  const openInspDialog = (item: SafetyItem) => {
    setInspTarget(item);
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

  const openDisposeDialog = (item: SafetyItem) => { setDisposeTarget(item); setDisposeDialogOpen(true); };
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

  // ── Classified lookup for filtered items ──
  const classifiedMap = useMemo(() => {
    const map = new Map<number, ClassifiedSafetyItem>();
    for (const c of decision.allClassified) map.set(c.id, c);
    return map;
  }, [decision.allClassified]);

  const selectedClassified = selectedItemId != null ? classifiedMap.get(selectedItemId) ?? null : null;

  // ── Export ──
  const handleExport = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast({ title: "내보낼 데이터 없음", description: "내보낼 제품이 없습니다.", variant: "destructive" });
      return;
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

  const getBorderColor = (level: string) => {
    if (level === "HIGH") return "!border-l-red-400";
    if (level === "MEDIUM") return "!border-l-orange-400";
    return "!border-l-slate-600";
  };

  return (
    <div className="w-full py-4 md:py-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">

        {/* ═══ 헤더 ═══ */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 bg-amber-900/30 rounded-lg flex-shrink-0">
                <Shield className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">안전 운영 판단</h1>
                <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">GMP/KOSHA 규격 대응 · AI 권장 우선순위 기반 운영</p>
              </div>
            </div>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="text-xs shrink-0 border-bs text-slate-400 hover:text-white">
            <Download className="h-3.5 w-3.5 mr-1.5" /><span className="hidden sm:inline">CSV </span>내보내기
          </Button>
        </div>

        {/* ═══ A. AI Mission Brief ═══ */}
        <div className="rounded-xl border border-white/[0.08] bg-[#1a1c20] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">오늘의 안전 판단</span>
          </div>
          <div className="px-4 py-3.5">
            {/* Brief summary strip */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {decision.brief.immediateActionCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/30 border border-red-800/30">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-red-300">즉시 조치 {decision.brief.immediateActionCount}건</span>
                </div>
              )}
              {decision.brief.documentRemediationCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/30 border border-amber-800/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-amber-300">문서 보완 {decision.brief.documentRemediationCount}건</span>
                </div>
              )}
              {decision.brief.reviewRequiredCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/30 border border-blue-800/30">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-blue-300">검토 {decision.brief.reviewRequiredCount}건</span>
                </div>
              )}
              {(decision.brief.monitorOnlyCount + decision.brief.compliantCount) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/20 border border-emerald-800/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[12px] font-medium text-emerald-400">정상 {decision.brief.monitorOnlyCount + decision.brief.compliantCount}건</span>
                </div>
              )}
            </div>
            {/* AI recommended priority */}
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex-shrink-0 w-16">권장 순서</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {decision.brief.topPriority.map((name: string, i: number) => (
                  <span key={name} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-slate-600 flex-shrink-0" />}
                    <span className={`text-[12px] font-medium ${i === 0 ? "text-white" : "text-slate-400"}`}>{name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ B. Tri-Option Strategy Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {decision.options.map((opt: StrategyOption) => {
            const FrameIcon = FRAME_ICON[opt.frame];
            const colors = FRAME_COLOR[opt.frame];
            const isActive = activeFrame === opt.frame;
            return (
              <button key={opt.frame} type="button" onClick={() => setActiveFrame(opt.frame)}
                className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  isActive ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ring-white/5` : "border-white/[0.06] hover:border-white/[0.12] bg-[#1a1c20]"
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <FrameIcon className={`h-4 w-4 ${isActive ? colors.text : "text-slate-600"}`} />
                  <span className={`text-[13px] font-bold ${isActive ? colors.text : "text-slate-400"}`}>{opt.title}</span>
                </div>
                <p className={`text-[11px] leading-relaxed mb-2.5 ${isActive ? "text-slate-300" : "text-slate-600"}`}>{opt.subtitle}</p>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded ${isActive ? colors.accent + " " + colors.text : "bg-white/[0.04] text-slate-600"}`}>
                    조치 {opt.immediateCount + opt.remediationCount}
                  </span>
                  <span className={`${isActive ? "text-slate-400" : "text-slate-600"}`}>
                    모니터링 {opt.monitorCount}
                  </span>
                </div>
                {isActive && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-500 block mb-0.5">장점</span>
                      <span className="text-slate-300">{opt.advantage}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">리스크</span>
                      <span className="text-slate-400">{opt.risk}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ C. AI Recommended Queue ═══ */}
        {decision.queue.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-[#1a1c20] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI 권장 처리 큐</span>
              <span className="text-[10px] text-slate-600">{activeOption?.title} 기준</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(activeOption?.sequence ?? decision.queue).filter((q: ClassifiedSafetyItem) => q.classification !== "compliant").slice(0, 5).map((q: ClassifiedSafetyItem, i: number) => {
                const style = CLASSIFICATION_STYLE[q.classification];
                return (
                  <button key={q.id} type="button" onClick={() => setSelectedItemId(q.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${selectedItemId === q.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                    <span className="text-[11px] font-mono text-slate-600 w-4 flex-shrink-0 text-right">{i + 1}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.bg} ${style.text} ${style.border} flex-shrink-0`}>
                      {style.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-white block truncate">{q.name}</span>
                      <span className="text-[11px] text-slate-500 block truncate">{q.priorityReason.slice(0, 50)}</span>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <span className="text-[11px] text-slate-400 block">{q.nextAction}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Main Content: Center + Rail ═══ */}
        <div className="flex gap-4">

          {/* ── Center: Full List ── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 border rounded-lg border-white/[0.06] bg-[#1a1c20]">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-[110px] sm:w-[130px] h-8 text-xs border-white/[0.08] bg-transparent"><SelectValue placeholder="위험 등급" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">위험 등급 전체</SelectItem>
                    <SelectItem value="high">고위험</SelectItem>
                    <SelectItem value="medium">중위험</SelectItem>
                    <SelectItem value="low">일반</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={msdsFilter} onValueChange={setMsdsFilter}>
                  <SelectTrigger className="w-[110px] sm:w-[130px] h-8 text-xs border-white/[0.08] bg-transparent"><SelectValue placeholder="MSDS 상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">MSDS 상태 전체</SelectItem>
                    <SelectItem value="registered">등록됨</SelectItem>
                    <SelectItem value="missing">누락</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[110px] sm:w-[130px] h-8 text-xs border-white/[0.08] bg-transparent"><SelectValue placeholder="보관 장소" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">보관 장소 전체</SelectItem>
                    {LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input className="pl-8 h-8 text-xs border-white/[0.08] bg-transparent" placeholder="물질명 / CAS 검색"
                  value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">총 {filteredItems.length}개 물질</p>

            {/* Item list with classification state */}
            <div className="space-y-1.5">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm rounded-xl border border-white/[0.06] bg-[#1a1c20]">
                  조건에 맞는 데이터가 없습니다.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const classified = classifiedMap.get(item.id);
                  const classStyle = classified ? CLASSIFICATION_STYLE[classified.classification] : null;
                  const isSelected = selectedItemId === item.id;

                  return (
                    <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left p-3.5 rounded-lg border-l-4 border transition-all ${getBorderColor(item.level)} ${
                        isSelected ? "bg-white/[0.05] border-white/[0.12]" : "border-white/[0.06] hover:bg-white/[0.02] bg-[#1a1c20]"
                      }`}>
                      {/* Row 1: Classification + Name + Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {classStyle && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${classStyle.bg} ${classStyle.text} ${classStyle.border} flex-shrink-0`}>
                            {classStyle.label}
                          </Badge>
                        )}
                        <div className="flex gap-1 flex-shrink-0">
                          {item.icons.map((icon: string) => <GHSPictogram key={icon} type={icon} />)}
                        </div>
                        <span className="text-[13px] font-bold text-slate-100 truncate">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-el text-slate-400 border-white/[0.08] font-mono">{item.cas}</Badge>
                      </div>

                      {/* Row 2: Meta */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-500">
                        <span>{item.loc}</span>
                        <span className="text-slate-700 hidden sm:inline">·</span>
                        <span className="hidden sm:inline">{item.storageCondition}</span>
                        <span className="text-slate-700">·</span>
                        <span>MSDS: {item.hasMsds ? <span className="text-emerald-400">등록</span> : <span className="text-amber-400">미등록</span>}</span>
                        <span className="text-slate-700">·</span>
                        <span>점검: {item.lastInspection || <span className="text-amber-400">미점검</span>}</span>
                      </div>

                      {/* Row 3: Next action hint */}
                      {classified && classified.classification !== "compliant" && (
                        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-slate-600 flex-shrink-0" />
                          <span>{classified.nextAction}</span>
                        </div>
                      )}
                      {classified?.classification === "compliant" && (
                        <div className="mt-1.5 text-[11px] text-emerald-500 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />관리 정상
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right Rail: AI Explanation + Action Handoff ── */}
          {selectedClassified && (
            <div className="hidden lg:block w-80 flex-shrink-0 sticky top-20 self-start">
              <div className="rounded-xl border border-white/[0.08] bg-[#1a1c20] overflow-hidden">
                {/* Rail header */}
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">판단 근거</span>
                  <button type="button" onClick={() => setSelectedItemId(null)} className="text-slate-600 hover:text-slate-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Item identity */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {selectedClassified.icons.map((icon: string) => <GHSPictogram key={icon} type={icon} />)}
                      <span className="text-[14px] font-bold text-white">{selectedClassified.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">{selectedClassified.cas}</span>
                  </div>

                  {/* Classification + confidence */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const s = CLASSIFICATION_STYLE[selectedClassified.classification];
                      return <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${s.bg} ${s.text} ${s.border}`}>{s.label}</Badge>;
                    })()}
                    <span className="text-[10px] text-slate-600">
                      신뢰도: {selectedClassified.confidenceLevel === "high" ? "높음" : selectedClassified.confidenceLevel === "medium" ? "중간" : "낮음"}
                    </span>
                  </div>

                  {/* AI recommendation reason */}
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">추천 이유</span>
                      <p className="text-[12px] text-slate-300 leading-relaxed">{selectedClassified.priorityReason}</p>
                    </div>

                    {/* Blockers */}
                    {selectedClassified.blockers.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-950/15 border border-red-900/20">
                        <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest block mb-1.5">차단 요인</span>
                        <div className="space-y-1">
                          {selectedClassified.blockers.map((b: string) => (
                            <div key={b} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0" />
                              <span className="text-[12px] text-red-300/80">{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hold risk */}
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">보류 시 리스크</span>
                      <p className="text-[12px] text-slate-400 leading-relaxed">{selectedClassified.holdRisk}</p>
                    </div>

                    {/* Document status */}
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">문서 상태</span>
                      <div className="flex items-center gap-3 text-[12px]">
                        <span className="text-slate-400">MSDS: {selectedClassified.hasMsds ? <span className="text-emerald-400">등록</span> : <span className="text-amber-400">미등록</span>}</span>
                        <span className="text-slate-400">점검: {selectedClassified.lastInspection ? <span className="text-emerald-400">{selectedClassified.lastInspection}</span> : <span className="text-amber-400">없음</span>}</span>
                      </div>
                    </div>

                    {/* PPE */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">필수 보호구</span>
                      <div className="flex items-center gap-1.5">
                        {selectedClassified.ppe.map((p: { type: string; required: boolean }) => (
                          <PPEIcon key={p.type} type={p.type} required={p.required} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action handoff dock */}
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">실행</span>
                    {!selectedClassified.hasMsds && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-[12px] text-amber-400 border-amber-800/40 hover:bg-amber-950/30 justify-start gap-2"
                        onClick={() => openMsdsDialog(selectedClassified)}>
                        <FileWarning className="h-3.5 w-3.5" />MSDS 등록
                      </Button>
                    )}
                    {!selectedClassified.lastInspection && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-[12px] text-blue-400 border-blue-800/40 hover:bg-blue-950/30 justify-start gap-2"
                        onClick={() => openInspDialog(selectedClassified)}>
                        <ShieldCheck className="h-3.5 w-3.5" />점검 기록
                      </Button>
                    )}
                    {selectedClassified.level === "HIGH" && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-[12px] text-red-400 border-red-800/40 hover:bg-red-950/30 justify-start gap-2"
                        onClick={() => openDisposeDialog(selectedClassified)}>
                        <AlertTriangle className="h-3.5 w-3.5" />폐기 처리
                      </Button>
                    )}
                    {selectedClassified.classification === "compliant" && (
                      <p className="text-[11px] text-emerald-500 flex items-center gap-1.5 py-1">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><FileWarning className="h-4 w-4 text-amber-500" />MSDS 등록</DialogTitle>
            <DialogDescription className="text-xs">{msdsTarget?.name} ({msdsTarget?.cas})의 안전보건자료를 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="msds-substance" className="text-xs font-medium">물질명</Label><Input id="msds-substance" value={msdsTarget?.name || ""} disabled className="h-8 text-xs bg-pn" /></div>
              <div className="space-y-1.5"><Label htmlFor="msds-cas" className="text-xs font-medium">CAS No.</Label><Input id="msds-cas" value={msdsTarget?.cas || ""} disabled className="h-8 text-xs bg-pn" /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msds-file" className="text-xs font-medium">문서 파일</Label>
              <Input id="msds-file" type="file" accept=".pdf,.doc,.docx" className="h-8 text-xs"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, fileName: e.target.files?.[0]?.name || "" }))} />
              {msdsForm.fileName && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{msdsForm.fileName}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label htmlFor="msds-version" className="text-xs font-medium">문서 버전 *</Label><Input id="msds-version" value={msdsForm.docVersion} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, docVersion: e.target.value }))} placeholder="1.0" className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label htmlFor="msds-date" className="text-xs font-medium">등록일 *</Label><Input id="msds-date" type="date" value={msdsForm.registeredAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, registeredAt: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label htmlFor="msds-expires" className="text-xs font-medium">만료일</Label><Input id="msds-expires" type="date" value={msdsForm.expiresAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, expiresAt: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setMsdsDialogOpen(false)} disabled={msdsSaving}>취소</Button>
            <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleMsdsSave} disabled={msdsSaving}>
              {msdsSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "MSDS 등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inspection Dialog */}
      <Dialog open={inspDialogOpen} onOpenChange={setInspDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-blue-400" />점검 기록</DialogTitle>
            <DialogDescription className="text-xs">{inspTarget?.name} ({inspTarget?.cas})의 안전 점검을 기록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="insp-date" className="text-xs font-medium">점검일 *</Label><Input id="insp-date" type="date" value={inspForm.inspectedAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspectedAt: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label htmlFor="insp-person" className="text-xs font-medium">점검자 *</Label><Input id="insp-person" value={inspForm.inspector} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInspForm((f) => ({ ...f, inspector: e.target.value }))} placeholder="이름 입력" className="h-8 text-xs" /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5"><Label className="text-xs font-medium">보관 상태 정상</Label><p className="text-[11px] text-slate-500">보관 조건 및 용기 상태가 적합합니다.</p></div>
                <Switch checked={inspForm.storageOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, storageOk: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5"><Label className="text-xs font-medium">PPE 확인</Label><p className="text-[11px] text-slate-500">필수 보호구가 비치되어 있습니다.</p></div>
                <Switch checked={inspForm.ppeOk} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, ppeOk: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5"><Label className="text-xs font-medium text-amber-400">이상 여부</Label><p className="text-[11px] text-slate-500">점검 중 이상이 발견되었습니다.</p></div>
                <Switch checked={inspForm.hasIssue} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, hasIssue: v }))} />
              </div>
            </div>
            {inspForm.hasIssue && (
              <div className="space-y-1.5">
                <Label htmlFor="insp-action" className="text-xs font-medium">조치 내용</Label>
                <Textarea id="insp-action" value={inspForm.actionTaken} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInspForm((f) => ({ ...f, actionTaken: e.target.value }))} placeholder="발견된 이상 및 조치 내용을 기록하세요." rows={3} className="text-xs" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setInspDialogOpen(false)} disabled={inspSaving}>취소</Button>
            <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleInspSave} disabled={inspSaving}>
              {inspSaving ? <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</> : "점검 기록 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispose Dialog */}
      <Dialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-red-400"><AlertTriangle className="h-5 w-5" />폐기 처리 확인</DialogTitle>
            <DialogDescription className="text-xs">이 작업은 되돌릴 수 없습니다. 해당 물질을 안전 관리 목록에서 제거합니다.</DialogDescription>
          </DialogHeader>
          {disposeTarget && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-800">
                <p className="text-sm font-medium text-red-300">{disposeTarget.name}</p>
                <p className="text-xs text-red-400 mt-1">CAS: {disposeTarget.cas}</p>
                <p className="text-xs text-red-400">보관: {disposeTarget.storageCondition} · 위치: {disposeTarget.loc}</p>
              </div>
              <p className="text-xs text-slate-400">폐기 전 MSDS에 명시된 폐기 절차를 반드시 확인하세요.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDisposeDialogOpen(false)}>취소</Button>
            <Button size="sm" className="text-xs bg-red-600 hover:bg-red-700 text-white" onClick={handleDispose}>폐기 처리</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
