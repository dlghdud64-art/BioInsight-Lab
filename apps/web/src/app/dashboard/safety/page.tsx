"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef } from "react";
import { useUserPreferences } from "@/lib/preferences/user-preferences";
import { useQuery } from "@tanstack/react-query";
// §11.348-B-1 B1-3 — 안전 페이지 mock→실데이터(/api/safety/products) 어댑터.
import { adaptSafetyProducts, type SafetyApiProduct } from "@/lib/safety/product-to-safety-item";
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
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Download, FileWarning, Flame, FlameKindling, Skull, Droplets, Search, Hand, Glasses, Shirt, Loader2, CheckCircle2, ChevronRight, ArrowRight, X, Calendar, FileText, TrendingUp, ClipboardCheck } from "lucide-react";
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
  toxic: { label: "독성 물질", bg: "bg-yellow-50", color: "text-yellow-600" },
  flammable: { label: "인화성 물질", bg: "bg-red-50", color: "text-red-500" },
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
  document_remediation: { label: "문서 보완", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  review_required: { label: "검토 필요", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  monitor_only: { label: "모니터링", bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" },
  compliant: { label: "정상", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

// ── Mock data ────────────────────────────────────────────────────────────────
type SafetyItem = SafetyItemInput;

// §11.348-B-1 B1-3 — mock safetyItems 제거(실데이터 /api/safety/products 로 대체).

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
  // §safety-redesign ② — 화학물질 대장 테이블: 필터 칩·정렬·페이지네이션·다중선택.
  const [chipFilter, setChipFilter] = useState<"all" | "msds" | "insp" | "high">("all");
  const [sortKey, setSortKey] = useState<"name" | "risk" | "loc">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 14;

  // ── Mutable item state ──
  // §11.348-B-1 B1-3 — 초기값 []; 실데이터(/api/safety/products) 도착 시 동기화.
  //   mock(safetyItems) 는 제거 — 하드코딩 4건 대신 실 Product 안전필드 기반.
  const [items, setItems] = useState<SafetyItem[]>([]);
  // §safety-redesign write — 로컬 number id(1..N) → 실 Product.id(cuid) 맵.
  //   MSDS 실 업로드(POST /api/products/[id]/sds) deep-link 용. 기존엔 버려졌음.
  const [productIdByLocalId, setProductIdByLocalId] = useState<Record<number, string>>({});
  const safetyQuery = useQuery({
    queryKey: ["safety-products"],
    queryFn: async () => {
      const res = await fetch("/api/safety/products?limit=100");
      if (!res.ok) throw new Error("안전 데이터를 불러오지 못했습니다.");
      const data = await res.json();
      return (data.products ?? []) as SafetyApiProduct[];
    },
  });
  useEffect(() => {
    if (!safetyQuery.data) return;
    const { items: adapted, productIdByLocalId: idMap } = adaptSafetyProducts(safetyQuery.data);
    setItems(adapted);
    setProductIdByLocalId(idMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyQuery.data]);

  // ── Strategy ──
  const [activeFrame, setActiveFrame] = useState<StrategyFrame>("balanced_ops");
  const safetySaveToastShownRef = useRef(false);

  // §11.230c (a)-7 #safety-filter-sync — server-first hydration.
  //   preferences.safetyFilter.activeFrame 도착 시 StrategyFrame validation
  //   (3 가지 enum 정합) 후 setActiveFrame. inbox 는 useState 0 → 제외.
  const userPrefs = useUserPreferences();
  useEffect(() => {
    const serverFrame = userPrefs.preferences?.safetyFilter?.activeFrame;
    if (!serverFrame) return;
    if (
      serverFrame === "risk_minimize" ||
      serverFrame === "compliance_first" ||
      serverFrame === "balanced_ops"
    ) {
      setActiveFrame(serverFrame as StrategyFrame);
    }
  }, [userPrefs.preferences]);

  // §safety-save-state-fix — mount/hydration echo PATCH 차단 (호영님 버그: 무동작
  //   first-load 에 "서버 반영 실패" 빨간 칩 오노출). 기존 [activeFrame] 의존 effect 는
  //   마운트 1회 + 서버 hydration 으로 setActiveFrame 시 다시 발사되어, 사용자가 아무
  //   것도 안 했는데도 자동 PATCH 가 나가고 그게 실패하면 isPatchError 가 켜졌다.
  //   → (1) 서버 응답 전(isLoading) 차단, (2) activeFrame 이 서버값(빈 계정은 default)과
  //   실제로 다를 때만 저장. 파생 자동 저장 → 사용자 실제 변경 시에만 저장으로 축소
  //   (§11.327 다중 caller / feedback loop 정합).
  useEffect(() => {
    if (userPrefs.isLoading) return; // 서버 응답 전 자동 PATCH 차단
    const serverFrame = userPrefs.preferences?.safetyFilter?.activeFrame;
    if (activeFrame === (serverFrame ?? "balanced_ops")) return; // 무변경 / 빈계정 default 차단
    userPrefs.updateSafetyFilter({ activeFrame });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFrame, userPrefs.isLoading, userPrefs.preferences]);

  useEffect(() => {
    if (userPrefs.isPatching) {
      safetySaveToastShownRef.current = false;
      return;
    }
    if (!userPrefs.isPatchSuccess || safetySaveToastShownRef.current) return;
    safetySaveToastShownRef.current = true;
    toast({
      title: "저장됨",
      description: "안전 선호값이 구매 검토에 반영됨",
      duration: 3000,
    });
  }, [toast, userPrefs.isPatching, userPrefs.isPatchSuccess]);

  // ── Rail ──
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // ── Emergency banner ──
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── AI Queue completion ──
  const [completedQueueIds, setCompletedQueueIds] = useState<Set<number>>(new Set());
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelPhase, setAiPanelPhase] = useState<"closed" | "preparing" | "ready" | "running" | "success" | "error">("closed");

  // ── MSDS Dialog ──
  const [msdsDialogOpen, setMsdsDialogOpen] = useState(false);
  const [msdsTarget, setMsdsTarget] = useState<SafetyItem | null>(null);
  const [msdsForm, setMsdsForm] = useState({ docVersion: "", registeredAt: new Date().toISOString().split("T")[0], expiresAt: "", fileName: "" });
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [msdsSaving, setMsdsSaving] = useState(false);

  const openMsdsDialog = (item: SafetyItem | ClassifiedSafetyItem) => {
    setMsdsTarget(item as SafetyItem);
    setMsdsForm({ docVersion: "1.0", registeredAt: new Date().toISOString().split("T")[0], expiresAt: "", fileName: "" });
    setMsdsFile(null);
    setMsdsDialogOpen(true);
  };
  // §safety-redesign write — 실 업로드 배선(no-op 해소). 기존 setTimeout+로컬flip+가짜토스트 제거.
  //   POST /api/products/[id]/sds (multipart file). 성공 시 refetch → adapter 가 sdsDocuments 로
  //   hasMsds 재계산(canonical). 로컬 낙관 flip 없음 — 서버 진실만 반영.
  const handleMsdsSave = async () => {
    if (!msdsTarget) return;
    const productId = productIdByLocalId[msdsTarget.id];
    if (!productId) { toast({ title: "대상 식별 실패", description: "제품 식별자를 찾지 못했습니다. 새로고침 후 다시 시도하세요.", variant: "destructive" }); return; }
    if (!msdsFile) { toast({ title: "파일 필요", description: "MSDS 문서 파일을 첨부하세요.", variant: "destructive" }); return; }
    setMsdsSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", msdsFile);
      fd.append("docType", "sds");
      const res = await fetch(`/api/products/${productId}/sds`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        const msg = res.status === 503
          ? "파일 스토리지가 설정되지 않았습니다. 관리자에게 문의하세요."
          : res.status === 400
            ? "MSDS 문서 파일이 필요합니다."
            : res.status === 401
              ? "로그인이 필요합니다."
              : (data.error || "MSDS 업로드에 실패했습니다.");
        toast({ title: "등록 실패", description: msg, variant: "destructive" });
        return;
      }
      toast({ title: "MSDS 문서 업로드 완료", description: `${msdsTarget.name} 문서가 보관되었습니다. 목록을 갱신합니다.` });
      await safetyQuery.refetch();
      setMsdsDialogOpen(false);
    } catch {
      toast({ title: "등록 실패", description: "네트워크 오류로 업로드하지 못했습니다.", variant: "destructive" });
    } finally {
      setMsdsSaving(false);
    }
  };

  // ── Inspection Dialog ──
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [inspTarget, setInspTarget] = useState<SafetyItem | null>(null);
  const [inspForm, setInspForm] = useState({ inspectedAt: new Date().toISOString().split("T")[0], inspector: "", storageOk: true, ppeOk: true, hasIssue: false, actionTaken: "" });

  const openInspDialog = (item: SafetyItem | ClassifiedSafetyItem) => {
    setInspTarget(item as SafetyItem);
    setInspForm({ inspectedAt: new Date().toISOString().split("T")[0], inspector: "", storageOk: true, ppeOk: true, hasIssue: false, actionTaken: "" });
    setInspDialogOpen(true);
  };
  // §safety-redesign write — 점검 기록은 재고(lot, ProductInventory) 단위 엔드포인트(/api/inventory/[id]/inspection).
  //   본 화면은 물질(Product) 단위라 inventoryId 가 없음 → 가짜 성공(setTimeout+로컬flip) 제거.
  //   확정 배선은 product↔inventory scope 정합(별도 트랙) 후. 그 전까지 다이얼로그 confirm = disabled+사유.

  // ── Dispose Dialog ──
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<SafetyItem | null>(null);

  const openDisposeDialog = (item: SafetyItem | ClassifiedSafetyItem) => { setDisposeTarget(item as SafetyItem); setDisposeDialogOpen(true); };
  // §safety-redesign write — 폐기는 재고(lot) 단위 처리(물질 단위 전용 엔드포인트 없음).
  //   가짜 제거(로컬 filter+토스트) 제거 → 다이얼로그 confirm = disabled+사유. 확정 배선은 별도 트랙.

  // ── Filters ──
  const filteredItems = (items || []).filter((item) => {
    if (riskFilter === "high" && item.level !== "HIGH") return false;
    if (riskFilter === "medium" && item.level !== "MEDIUM") return false;
    if (riskFilter === "low" && item.level !== "LOW") return false;
    if (msdsFilter === "registered" && !item.hasMsds) return false;
    if (msdsFilter === "missing" && item.hasMsds) return false;
    if (locationFilter !== "all" && item.loc !== locationFilter) return false;
    // §safety-redesign ② — 필터 칩(전체/MSDS 미등록/미점검/고위험).
    if (chipFilter === "msds" && item.hasMsds) return false;
    if (chipFilter === "insp" && item.lastInspection) return false;
    if (chipFilter === "high" && item.level !== "HIGH" && !item.isHighRisk) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.cas.includes(q)) return false;
    }
    return true;
  });

  // §safety-redesign ② — 정렬(물질명·위험·보관) + 14행 페이지네이션. canonical=filteredItems 순수 파생.
  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const dir = sortDir === "asc" ? 1 : -1;
    const rank = (x: SafetyItem) => (x.level === "HIGH" ? 3 : x.level === "MEDIUM" ? 2 : 1);
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "loc") return (a.loc || "").localeCompare(b.loc || "") * dir;
      return (rank(a) - rank(b)) * dir;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / ROWS_PER_PAGE));
  const pageItems = sortedItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [totalPages, currentPage]);
  const toggleSort = (key: "name" | "risk" | "loc") => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  // 다중선택(현재 필터·페이지 기준). canonical id(로컬 number) 집합.
  const pageAllSelected = pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageItems.forEach((i) => next.delete(i.id));
      else pageItems.forEach((i) => next.add(i.id));
      return next;
    });
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // ── AI Decision Engine ──
  const decision = useMemo(() => buildSafetyDecision(items), [items]);
  const activeOption = decision.options.find((o: StrategyOption) => o.frame === activeFrame) || decision.options[2];
  const safetyServerFrame = userPrefs.preferences?.safetyFilter?.activeFrame;
  const safetyFrameMatchesServer = Boolean(safetyServerFrame) && safetyServerFrame === activeFrame;
  const safetyAppliedCount = safetyFrameMatchesServer && !userPrefs.isPatching && !userPrefs.isPatchError ? 1 : 0;
  const safetyPendingCount =
    userPrefs.isPatching || (!userPrefs.isLoading && !safetyFrameMatchesServer && !userPrefs.isPatchError) ? 1 : 0;
  const safetySaveFailureReason = userPrefs.isPatchError
    ? "서버 반영 실패"
    : userPrefs.isError
      ? "현재 설정 불러오기 실패"
      : "실패 사유 없음";
  const safetySavedBadgeVisible = safetyAppliedCount === 1 || userPrefs.isPatchSuccess;
  const safetySaveBoundaryLabel = userPrefs.isPatching
    ? "저장 중"
    : safetySavedBadgeVisible
      ? "저장됨"
      : "저장 대기 중";

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
  // §safety-redesign ② — 필터 칩 건수(canonical 단일 소스 = items 집계).
  const uninspectedCount = items.filter((i) => !i.lastInspection).length;
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

  // ── Priority backlog count (AI 패널 대상 수) ──
  const priorityBacklogCount = immediateCount + docRemCount + msdsMissingCount;

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
    <div className="min-h-screen bg-white p-4 md:p-8 pt-4 md:pt-6">
      {/* §11.333 Part A — 운영 화면 wide 정책 정합. 옛 max-w-7xl(1280px) → max-w-full
          (다른 운영 화면 dashboard/quotes/inventory/purchase-orders/receiving 와 동일). */}
      <div className="max-w-full mx-auto space-y-5">

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
            {/* §11.291 #safety-confirm-now-scroll-highlight — 호영님 P0:
                기존 setSelectedItemId 만 호출 → 시각 신호 부재 = dead button
                인지. 옵션 A — AI 권장 처리 큐 섹션 scroll + immediate_action
                item 하이라이트 (3초 후 자동 해제). 별도 페이지 이동 0
                (같은 페이지 정보 인지). */}
            <button
              onClick={() => {
                const queueSection = document.getElementById("ai-action-queue");
                queueSection?.scrollIntoView({ behavior: "smooth", block: "start" });
                const urgentItems = document.querySelectorAll<HTMLElement>(
                  "[data-priority='urgent']",
                );
                urgentItems.forEach((el) => {
                  el.classList.add("ring-2", "ring-red-500", "animate-pulse");
                  setTimeout(() => {
                    el.classList.remove("ring-2", "ring-red-500", "animate-pulse");
                  }, 3000);
                });
                // 기존 detail panel trigger 도 보존 (첫 immediate item)
                const firstImmediate = queueItems[0];
                if (firstImmediate) setSelectedItemId(firstImmediate.id);
              }}
              className="px-4 py-1.5 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/10 transition-colors flex-shrink-0"
            >
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
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-red-500" />
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
            <Button
              size="sm"
              className={`h-10 px-5 text-sm gap-2 font-semibold shadow-sm ${
                priorityBacklogCount > 0
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
              disabled={priorityBacklogCount === 0}
              onClick={() => {
                if (priorityBacklogCount > 0) setAiPanelOpen(true);
              }}
              title={priorityBacklogCount === 0 ? "분석 대상 항목이 없습니다" : `우선 점검 대상 ${priorityBacklogCount}건`}
            >
              <ShieldAlert className="h-4 w-4" />
              {priorityBacklogCount > 0 ? `MSDS 점검 준비 (${priorityBacklogCount}건)` : "점검 대상 없음"}
            </Button>
          </div>
        </div>

        {/* ═══ KPI 카드 4개 (호버 상세 팝업 포함) ═══ */}
        <div
          data-testid="safety-preferences-save-state"
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">안전 설정 저장 상태</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{safetySaveBoundaryLabel}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              구매 검토에 반영됨 · 다음 검토 대상 {decision.brief.reviewRequiredCount}건
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {safetySavedBadgeVisible && (
              <Badge data-testid="safety-preferences-saved-badge" variant="outline" dot="emerald" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                저장됨
              </Badge>
            )}
            <Badge variant="outline" dot="emerald" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              현재 적용됨 {safetyAppliedCount}
            </Badge>
            <Badge variant="outline" dot="amber" className="border-yellow-200 bg-yellow-50 text-yellow-700">
              저장 대기 {safetyPendingCount}
            </Badge>
            {/* §safety-save-state-fix — 실패 상태(isPatchError/isError)일 때만 노출.
                정상 first-load 에 "실패 사유 없음" 부정 워딩 상시 노출 제거(노이즈). */}
            {(userPrefs.isPatchError || userPrefs.isError) && (
              <span
                data-testid="safety-preferences-failure-reason"
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
              >
                {safetySaveFailureReason}
              </span>
            )}
          </div>
        </div>

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
                    { label: "인화성", count: kpiDetail.flammableCount, color: "bg-red-400" },
                    { label: "부식성", count: kpiDetail.corrosiveCount, color: "bg-red-400" },
                    { label: "독성", count: kpiDetail.toxicCount, color: "bg-yellow-400" },
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
          <div className="group/kpi relative rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-yellow-200 transition-all cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                <FileWarning className="h-5 w-5 text-yellow-500" />
              </div>
              <span className="text-xs text-slate-400">MSDS 미등록</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{msdsMissingCount}</p>
            <p className="text-xs text-yellow-600 font-medium mt-1">보완 필요</p>
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
                      <div className="h-full rounded-full bg-yellow-400 transition-all duration-500" style={{ width: `${msdsMissingCount > 0 ? (kpiDetail.msdsNewMissing / msdsMissingCount) * 100 : 0}%` }} />
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
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
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

          {/* AI 권장 처리 큐 — §11.291 id="ai-action-queue" scroll anchor.
              "지금 확인하기" 배너 CTA 가 이 섹션으로 scrollIntoView. */}
          <div id="ai-action-queue" className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">AI 권장 처리 큐</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">운영 균형 우선 기준</span>
                {queueItems.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">전체 {queueItems.length}건</span>
                )}
              </div>
            </div>

            {/* §safety-redesign P3 (핸드오프 §4) — 큐 무제한 → 페이지 세로 폭증 방지.
                상한 8건 + 내부 스크롤(max-h). 전체는 하단 화학물질 대장에서 확인. */}
            <div className="max-h-[480px] overflow-y-auto space-y-0 divide-y divide-slate-100">
              {queueItems.slice(0, 8).map((q: ClassifiedSafetyItem, i: number) => {
                const style = CLASS_STYLE[q.classification];
                const isCompleted = completedQueueIds.has(q.id);
                // §11.291 — immediate_action classification 시 data-priority="urgent"
                // 배너 CTA 의 querySelectorAll target. 3초 ring-red-500 animate-pulse.
                const isUrgent = q.classification === "immediate_action";
                return (
                  <div key={q.id}
                    data-priority={isUrgent ? "urgent" : "normal"}
                    className={`py-4 first:pt-0 last:pb-0 rounded transition-opacity ${isCompleted ? "opacity-40" : ""}`}>
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
                    {/* §11.291b #safety-card-mobile-inline-expand — 호영님 P0
                        audit: 카드 큐 nextAction button click → setSelectedItemId
                        호출 → detail panel 은 hidden lg:block (데스크탑 lg 이상)
                        이라 모바일 visible 0 = dead button 인지. selectedItemId
                        === q.id 시 모바일 inline detail (차단 요인 + 보류 리스크
                        + 문서 상태 + Action dock) 노출. 데스크탑 right rail
                        그대로 유지 (중복 표시 회피). */}
                    {selectedItemId === q.id && (() => {
                      const classified = classifiedMap.get(q.id);
                      if (!classified) return null;
                      return (
                        <div className="lg:hidden mt-3 pt-3 border-t border-slate-100 space-y-2">
                          {classified.blockers.length > 0 && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block mb-1.5">차단 요인</span>
                              <div className="space-y-1">
                                {classified.blockers.map((b: string) => (
                                  <div key={b} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                    <span className="text-xs text-red-700">{b}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">보류 시 리스크</span>
                            <p className="text-xs text-slate-600 leading-relaxed">{classified.holdRisk}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-4 text-xs">
                            <span>MSDS: {classified.hasMsds ? <span className="text-emerald-600 font-semibold">등록</span> : <span className="text-yellow-600 font-semibold">미등록</span>}</span>
                            <span>점검: {classified.lastInspection ? <span className="text-emerald-600 font-semibold">{classified.lastInspection}</span> : <span className="text-yellow-600 font-semibold">없음</span>}</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {!classified.hasMsds && (
                              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-yellow-700 border-yellow-200 hover:bg-yellow-50 justify-start gap-2"
                                onClick={() => openMsdsDialog(classified)}>
                                <FileWarning className="h-3.5 w-3.5" />MSDS 등록
                              </Button>
                            )}
                            {!classified.lastInspection && (
                              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-blue-700 border-blue-200 hover:bg-blue-50 justify-start gap-2"
                                onClick={() => openInspDialog(classified)}>
                                <ClipboardCheck className="h-3.5 w-3.5" />점검 기록
                              </Button>
                            )}
                            {classified.level === "HIGH" && (
                              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-red-700 border-red-200 hover:bg-red-50 justify-start gap-2"
                                onClick={() => openDisposeDialog(classified)}>
                                <AlertTriangle className="h-3.5 w-3.5" />폐기 처리
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
            {/* §safety-redesign ② 필터 칩 + 검색 (dead Filter 버튼 제거, canonical 건수) */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { key: "all", label: "전체", count: totalCount },
                  { key: "msds", label: "MSDS 미등록", count: msdsMissingCount },
                  { key: "insp", label: "미점검", count: uninspectedCount },
                  { key: "high", label: "고위험", count: highRiskCount },
                ] as const).map((c) => {
                  const active = chipFilter === c.key;
                  return (
                    <button key={c.key} type="button"
                      onClick={() => { setChipFilter(c.key); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}>
                      {c.label}
                      <span className={`tabular-nums ${active ? "text-white/80" : c.count > 0 ? "text-slate-900" : "text-slate-300"}`}>{c.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-44 sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-9 h-9 text-sm border-slate-200 rounded-lg" placeholder="물질명 / CAS 검색"
                    value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">{totalCount}종 중 {filteredItems.length}종 표시</span>
              </div>
            </div>

            {/* §safety-redesign ② 일괄작업 바 (선택 시) — bulk CTA 는 ③ 준비 마법사 연결 전까지 disabled+사유(no-op 금지) */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-xl border border-slate-300 bg-slate-50">
                <span className="text-xs font-semibold text-slate-700">{selectedIds.size}종 선택됨</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled className="h-8 px-3 text-xs bg-slate-100 text-slate-400 cursor-not-allowed" title="일괄 처리는 점검 준비 마법사에서 진행됩니다 (준비 중).">MSDS 일괄 등록</Button>
                  <Button size="sm" disabled className="h-8 px-3 text-xs bg-slate-100 text-slate-400 cursor-not-allowed" title="점검은 재고(lot) 단위에서 기록됩니다.">점검 기록 생성</Button>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 hover:text-slate-700 px-2">선택 해제</button>
                </div>
              </div>
            )}

            {/* §safety-redesign ② 밀집 테이블 (정렬·14행 페이지네이션) — 반복 카드 제거 */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  {totalCount === 0 ? "등록된 화학물질이 없습니다. 재고에 품목이 추가되면 여기에 표시됩니다." : "조건에 맞는 데이터가 없습니다."}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-left">
                          <th className="w-10 px-3 py-2.5">
                            <input type="checkbox" checked={pageAllSelected} onChange={toggleSelectAllOnPage} className="h-4 w-4 rounded border-slate-300" aria-label="페이지 전체 선택" />
                          </th>
                          <th className="px-3 py-2.5">
                            <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                              물질명 {sortKey === "name" && <span className="text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </button>
                          </th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 hidden md:table-cell">CAS</th>
                          <th className="px-3 py-2.5">
                            <button type="button" onClick={() => toggleSort("risk")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                              위험 {sortKey === "risk" && <span className="text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </button>
                          </th>
                          <th className="px-3 py-2.5 hidden lg:table-cell">
                            <button type="button" onClick={() => toggleSort("loc")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                              보관 위치 {sortKey === "loc" && <span className="text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </button>
                          </th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">MSDS</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 hidden sm:table-cell">최근 점검</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item) => {
                          const isSelected = selectedItemId === item.id;
                          const checked = selectedIds.has(item.id);
                          const riskLabel = item.level === "HIGH" ? "고위험" : item.level === "MEDIUM" ? "주의" : "일반";
                          const riskCls = item.level === "HIGH" ? "bg-red-50 text-red-700 border-red-200" : item.level === "MEDIUM" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-slate-50 text-slate-400 border-slate-200";
                          return (
                            <tr key={item.id} onClick={() => setSelectedItemId(item.id)}
                              className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(item.id)} className="h-4 w-4 rounded border-slate-300" aria-label={`${item.name} 선택`} />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="flex gap-0.5 flex-shrink-0">{item.icons.slice(0, 2).map((icon: string) => <GHSIcon key={icon} type={icon} />)}</div>
                                  <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-400 font-mono hidden md:table-cell">{item.cas || "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${riskCls}`}>{riskLabel}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500 hidden lg:table-cell">{item.loc || item.storageCondition || "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-semibold ${item.hasMsds ? "text-emerald-600" : "text-red-600"}`}>{item.hasMsds ? "● 등록" : "● 미등록"}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{item.lastInspection || <span className="text-slate-400">미점검</span>}</td>
                              <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                {!item.hasMsds ? (
                                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-yellow-700 border-yellow-200 hover:bg-yellow-50" onClick={() => openMsdsDialog(item)}>등록</Button>
                                ) : !item.lastInspection ? (
                                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => openInspDialog(item)}>점검</Button>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* 페이지네이션 (14행/페이지) */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100">
                      <span className="text-xs text-slate-400">{(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, sortedItems.length)} / {sortedItems.length}종</span>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50" aria-label="이전 페이지">
                          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 4), Math.max(0, currentPage - 4) + 8).map((p) => (
                          <button key={p} type="button" onClick={() => setCurrentPage(p)}
                            className={`h-7 min-w-7 px-2 inline-flex items-center justify-center rounded-md text-xs font-medium border ${p === currentPage ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{p}</button>
                        ))}
                        <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50" aria-label="다음 페이지">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
                      <span>MSDS: {selectedClassified.hasMsds ? <span className="text-emerald-600 font-semibold">등록</span> : <span className="text-yellow-600 font-semibold">미등록</span>}</span>
                      <span>점검: {selectedClassified.lastInspection ? <span className="text-emerald-600 font-semibold">{selectedClassified.lastInspection}</span> : <span className="text-yellow-600 font-semibold">없음</span>}</span>
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
                      <Button variant="outline" size="sm" className="w-full h-9 text-xs font-medium text-yellow-700 border-yellow-200 hover:bg-yellow-50 justify-start gap-2"
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
              <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center"><FileWarning className="h-4 w-4 text-yellow-500" /></div>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0] ?? null;
                  setMsdsFile(f);
                  setMsdsForm((prev) => ({ ...prev, fileName: f?.name || "" }));
                }} />
              {msdsForm.fileName && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{msdsForm.fileName}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">문서 버전 *</Label><Input value={msdsForm.docVersion} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, docVersion: e.target.value }))} placeholder="1.0" className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">등록일 *</Label><Input type="date" value={msdsForm.registeredAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, registeredAt: e.target.value }))} className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-700">만료일</Label><Input type="date" value={msdsForm.expiresAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsdsForm((f) => ({ ...f, expiresAt: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 px-0.5">문서 파일이 보관되며, 목록의 MSDS 상태가 즉시 갱신됩니다. (버전·만료 메타 자동 저장은 준비 중)</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMsdsDialogOpen(false)} disabled={msdsSaving}>취소</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 disabled:bg-slate-100 disabled:text-slate-400"
              onClick={handleMsdsSave}
              disabled={msdsSaving || !msdsFile}
              title={!msdsFile ? "MSDS 문서 파일을 첨부하세요." : undefined}
            >
              {msdsSaving ? <><Loader2 className="h-3 w-3 animate-spin" />업로드 중...</> : "MSDS 문서 업로드"}
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
              <div className="flex items-center justify-between"><div><Label className="text-xs font-medium text-yellow-600">이상 여부</Label><p className="text-[11px] text-slate-400">점검 중 이상이 발견되었습니다.</p></div><Switch checked={inspForm.hasIssue} onCheckedChange={(v: boolean) => setInspForm((f) => ({ ...f, hasIssue: v }))} /></div>
            </div>
            {inspForm.hasIssue && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">조치 내용</Label>
                <Textarea value={inspForm.actionTaken} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInspForm((f) => ({ ...f, actionTaken: e.target.value }))} placeholder="발견된 이상 및 조치 내용을 기록하세요." rows={3} className="text-xs" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mt-1">
            점검 기록은 재고(lot) 단위로 관리됩니다. 입고된 재고 항목에서 점검을 기록하세요. (현재 화면은 물질 단위 — 점검 연계 준비 중)
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setInspDialogOpen(false)}>닫기</Button>
            <Button size="sm" disabled className="bg-slate-100 text-slate-400 cursor-not-allowed" title="점검은 재고(lot) 단위에서 기록됩니다.">점검 기록 (재고 단위)</Button>
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
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            폐기는 재고(lot) 단위 처리입니다. 입고된 재고 항목에서 폐기를 진행하세요. (현재 화면은 물질 단위)
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDisposeDialogOpen(false)}>닫기</Button>
            <Button size="sm" disabled className="bg-slate-100 text-slate-400 cursor-not-allowed" title="폐기는 재고(lot) 단위에서 처리됩니다.">폐기 처리 (재고 단위)</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ AI MSDS 점검 Side Panel (same-canvas) ═══ */}
      {aiPanelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { setAiPanelOpen(false); setAiPanelPhase("closed"); }} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* 패널 헤더 */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">MSDS 점검 준비</h2>
                    <p className="text-[11px] text-slate-500">현재 backlog 기준 안전 문서 점검 대상 확인</p>
                  </div>
                </div>
                <button onClick={() => { setAiPanelOpen(false); setAiPanelPhase("closed"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 요약 strip */}
            <div className="shrink-0 px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-red-600 font-semibold">긴급 {immediateCount}</span>
                <span className="text-slate-300">|</span>
                <span className="text-yellow-600 font-semibold">문서보완 {docRemCount}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">MSDS 미등록 {msdsMissingCount}</span>
                <span className="ml-auto text-slate-400">분석 대상 {priorityBacklogCount}건</span>
              </div>
            </div>

            {/* 대상 목록 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {queueItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500">분석 대상 항목이 없습니다</p>
                  <p className="text-xs text-slate-400 mt-1">모든 항목이 정상 상태입니다</p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">분석 대상 목록</p>
                  {queueItems.map((q: ClassifiedSafetyItem, i: number) => {
                    const style = CLASS_STYLE[q.classification];
                    return (
                      <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-300">{i + 1}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>{style.label}</span>
                          <span className="text-sm font-semibold text-slate-900 truncate">{q.name.split("(")[0].trim()}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{q.priorityReason}</p>
                      </div>
                    );
                  })}
                </>
              )}

              {/* 안내: 점검 실행 저장 기능 준비 중 (Option 1 · Hide-until-wired) */}
              {queueItems.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">점검 실행 저장 기능은 준비 중입니다</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    현재는 우선 점검 대상 {priorityBacklogCount}건의 목록 확인만 지원합니다. 개별 항목은 상단 테이블에서 "폐기 처리" 또는 행 액션으로 처리해 주세요.
                  </p>
                </div>
              )}
            </div>

            {/* 하단 액션 dock */}
            <div className="shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => { setAiPanelOpen(false); setAiPanelPhase("closed"); }}>
                닫기
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 text-xs font-semibold bg-slate-200 text-slate-400 cursor-not-allowed"
                disabled
                title="점검 실행 저장 기능은 준비 중입니다."
              >
                분석 실행 (준비 중)
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
