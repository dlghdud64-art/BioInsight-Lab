"use client";

export const dynamic = "force-dynamic";

import React, { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MainHeader } from "@/app/_components/main-header";
import {
  Brain, FileText, CheckCircle2, Loader2, ArrowRight,
  Edit2, Trash2, Plus, Search, Package, AlertCircle,
  Upload, Clipboard, FlaskConical, Sparkles, FileCheck, X,
  AlertTriangle, ChevronRight, Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

/* ──────────────────────────── 타입 정의 ──────────────────────────── */

interface ExtractedReagent {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  estimatedUsage?: number;
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
}

interface ExperimentCondition {
  temperature?: { value: number; unit: string; duration?: number; description?: string }[];
  time?: { value: number; unit: string; step?: string }[];
  concentration?: { reagent: string; value: number; unit: string }[];
  pH?: { value: number; description?: string }[];
  other?: { key: string; value: string; description?: string }[];
}

interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
  conditions?: ExperimentCondition;
}

interface ProductMatch {
  productId: string;
  productName: string;
  vendorName: string;
  price: number;
  currency: string;
  isHighRisk?: boolean;
  hazardCodes?: string[];
  safetyNote?: string;
}

interface ReagentWithMatch extends ExtractedReagent {
  id: string;
  matchedProduct?: ProductMatch;
  isMatching?: boolean;
  showEvidence?: boolean;
}

/* ──────────────────────────── 스텝 지시자 ──────────────────────────── */

const STEPS = ["프로토콜 업로드", "AI 분석", "BOM 검토", "검색·비교·견적"] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            i < current
              ? "bg-blue-950/20 text-blue-700 border border-blue-800"
              : i === current
              ? "bg-blue-600 text-white shadow-none"
              : "bg-[#222226] text-slate-400 border border-[#2a2a2e]"
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              i < current ? "bg-blue-600 text-white" : i === current ? "bg-[#1a1a1e]/25 text-white" : "bg-slate-200 text-slate-400"
            }`}>{i < current ? "✓" : i + 1}</span>
            {label}
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 mx-0.5 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────── 메인 페이지 ──────────────────────────── */

export default function ProtocolBOMPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [protocolText, setProtocolText] = useState("");
  const [extractionResult, setExtractionResult] = useState<ProtocolExtractionResult | null>(null);
  const [reagents, setReagents] = useState<ReagentWithMatch[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [experimentRounds, setExperimentRounds] = useState(1);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [editingReagentId, setEditingReagentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploadEnabled, setPdfUploadEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [bomSaved, setBomSaved] = useState(false);
  const [pdfParseError, setPdfParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  // 단계 계산
  const currentStep: 0 | 1 | 2 | 3 = bomSaved ? 3 : extractionResult ? 2 : 0;

  // PDF 활성화 여부
  useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      const data = await res.json();
      setPdfUploadEnabled(data.pdfUploadEnabled ?? true);
      return data;
    },
  });

  /* ──── 파일 핸들러 ──── */
  const handleFile = (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF 파일만 업로드 가능합니다.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "파일 크기는 10MB 이하여야 합니다.", variant: "destructive" });
      return;
    }
    setPdfFile(file);
    setExtractionResult(null);
    setReagents([]);
    setBomSaved(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /* ──── 제품 매칭 ──── */
  const matchProductsForReagents = async (reagentsToMatch: ReagentWithMatch[]) => {
    const updatedReagents = await Promise.all(
      reagentsToMatch.map(async (reagent) => {
        try {
          const response = await fetch(
            `/api/products/search?query=${encodeURIComponent(reagent.name)}&limit=1${
              reagent.category ? `&category=${reagent.category}` : ""
            }`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.products && data.products.length > 0) {
              const product = data.products[0];
              const vendor = product.vendors?.[0];
              const isHighRisk =
                (product.hazardCodes?.length > 0) ||
                (product.pictograms?.some((p: string) => ["skull", "flame", "corrosive"].includes(p)));
              return {
                ...reagent,
                matchedProduct: vendor
                  ? {
                      productId: product.id,
                      productName: product.name,
                      vendorName: vendor.vendor.name,
                      price: vendor.priceInKRW || 0,
                      currency: vendor.currency || "KRW",
                      isHighRisk,
                      hazardCodes: product.hazardCodes || [],
                      safetyNote: product.safetyNote || undefined,
                    }
                  : undefined,
                isMatching: true,
              };
            }
          }
        } catch { /* noop */ }
        return { ...reagent, isMatching: false };
      })
    );
    setReagents(updatedReagents);
  };

  /* ──── PDF 추출 mutation ──── */
  const extractFromFileMutation = useMutation({
    mutationFn: async (file: File) => {
      setPdfParseError(null);
      const formData = new FormData();
      formData.append("file", file);

      // 1단계: PDF → 텍스트 추출
      const pdfRes = await fetch("/api/protocol/extract-pdf-text", { method: "POST", body: formData });
      if (!pdfRes.ok) {
        const e = await pdfRes.json().catch(() => ({}));
        throw new Error(e.error || "PDF 텍스트 추출에 실패했습니다.");
      }
      const { text } = await pdfRes.json();
      if (!text || text.trim().length < 10) {
        throw new Error("PDF_NO_TEXT");
      }

      // 2단계: 텍스트 → AI 시약 추출
      const extractRes = await fetch("/api/protocol/extract-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!extractRes.ok) {
        const e = await extractRes.json().catch(() => ({}));
        throw new Error(e.error || "시약 추출에 실패했습니다.");
      }
      return extractRes.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setPdfParseError(null);
      setExtractionResult(data);
      const reagentsWithId = data.reagents.map((r, idx) => ({ ...r, id: `reagent-${idx}-${Date.now()}`, showEvidence: false }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      toast({ title: `${data.reagents.length}개 항목이 추출되었습니다.` });
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => {
      const msg = error.message;
      let userMessage: string;

      if (msg === "PDF_NO_TEXT" || msg.includes("텍스트를 읽지 못") || msg.includes("텍스트를 추출할 수 없") || msg.includes("텍스트 레이어가 없")) {
        userMessage = "PDF에서 텍스트를 읽지 못했습니다. 스캔본 문서일 수 있습니다.";
      } else if (msg.includes("암호") || msg.includes("encrypted") || msg.includes("password")) {
        userMessage = "암호로 보호된 PDF입니다. 암호를 해제한 후 다시 시도해 주세요.";
      } else if (msg.includes("손상") || msg.includes("corrupt") || msg.includes("invalid") || msg.includes("지원하지 않는 형식")) {
        userMessage = "PDF 파일이 손상되었거나 지원하지 않는 형식입니다.";
      } else if (msg.includes("OPENAI_API_KEY") || msg.includes("401") || msg.includes("403") || msg.includes("AI 분석")) {
        userMessage = "AI 분석 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      } else if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("시간이 초과")) {
        userMessage = "분석 시간이 초과되었습니다. 파일이 너무 크거나 복잡할 수 있습니다.";
      } else if (msg.includes("모듈") || msg.includes("MODULE") || msg.includes("환경에서 바로 읽을 수 없")) {
        userMessage = "PDF 분석 모듈에 일시적 문제가 발생했습니다. 다시 시도하거나 텍스트 붙여넣기로 진행해 주세요.";
      } else {
        userMessage = "PDF 분석에 실패했습니다. 파일을 확인하거나 텍스트 붙여넣기로 진행해 주세요.";
      }

      setPdfParseError(userMessage);
      toast({
        title: "PDF 분석 실패",
        description: "텍스트 붙여넣기로 계속 진행할 수 있습니다.",
        variant: "destructive",
      });
      // 개발 콘솔에만 원본 에러 출력
      console.error("[PDF Parse Error]", error.message);
    },
  });

  /* ──── 텍스트 추출 mutation ──── */
  const extractMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || "시약 추출에 실패했습니다."); }
      return response.json() as Promise<ProtocolExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractionResult(data);
      const reagentsWithId = data.reagents.map((r, idx) => ({ ...r, id: `reagent-${idx}-${Date.now()}`, showEvidence: false }));
      setReagents(reagentsWithId);
      if (!bomTitle && data.experimentType) setBomTitle(`${data.experimentType} 프로토콜 BOM`);
      toast({ title: `${data.reagents.length}개 항목이 추출되었습니다.` });
      matchProductsForReagents(reagentsWithId);
    },
    onError: (error: Error) => toast({ title: "시약 추출 실패", description: error.message, variant: "destructive" }),
  });

  /* ──── CRUD 핸들러 ──── */
  const handleEditReagent = (id: string, updates: Partial<ExtractedReagent>) => {
    setReagents((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };
  const handleFinishEdit = () => setEditingReagentId(null);
  const handleDeleteReagent = (id: string) => {
    setReagents((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "항목이 삭제되었습니다." });
  };
  const handleAddReagent = () => {
    const newReagent: ReagentWithMatch = { id: `reagent-new-${Date.now()}`, name: "", category: "REAGENT", quantity: "1", unit: "", showEvidence: false };
    setReagents((prev) => [...prev, newReagent]);
    setEditingReagentId(newReagent.id);
  };
  const toggleEvidence = (id: string) => {
    setReagents((prev) => prev.map((r) => r.id === id ? { ...r, showEvidence: !r.showEvidence } : r));
  };

  /* ──── BOM 생성 mutation ──── */
  const bomMutation = useMutation({
    mutationFn: async () => {
      if (!bomTitle.trim()) throw new Error("BOM 제목을 입력해주세요.");
      if (reagents.length === 0) throw new Error("최소 1개 이상의 항목이 필요합니다.");
      const response = await fetch("/api/protocol/bom", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bomTitle,
          reagents: reagents.map((r) => ({ name: r.name, quantity: r.quantity, unit: r.unit, estimatedUsage: r.estimatedUsage, category: r.category, description: r.description })),
          experimentRounds,
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || "BOM 생성에 실패했습니다."); }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "BOM이 생성되었습니다." });
      setIsConfirmDialogOpen(false);
      setBomSaved(true);
    },
    onError: (error: Error) => toast({ title: "BOM 생성 실패", description: error.message, variant: "destructive" }),
  });

  /* ──── 계산 ──── */
  const estimatedTotal = useMemo(() =>
    reagents.reduce((sum, r) => {
      if (r.matchedProduct) {
        const qty = r.estimatedUsage || parseFloat(r.quantity || "1") || 1;
        return sum + r.matchedProduct.price * Math.ceil(qty * experimentRounds);
      }
      return sum;
    }, 0),
    [reagents, experimentRounds]
  );

  const matchedCount = reagents.filter((r) => r.matchedProduct).length;
  const unmatchedCount = reagents.length - matchedCount;
  const highRiskCount = reagents.filter((r) => r.matchedProduct?.isHighRisk).length;

  const filteredReagents = useMemo(() => {
    if (categoryFilter === "all") return reagents;
    return reagents.filter((r) => r.category === categoryFilter);
  }, [reagents, categoryFilter]);

  const isAnalyzing = extractMutation.isPending || extractFromFileMutation.isPending;

  const getCategoryLabel = (cat?: string) => {
    if (!cat) return "기타";
    const map: Record<string, string> = { REAGENT: "시약", TOOL: "기구", EQUIPMENT: "장비" };
    return map[cat] || "기타";
  };
  const getCategoryColor = (cat?: string) => {
    if (!cat) return "bg-[#222226] text-slate-500";
    const map: Record<string, string> = {
      REAGENT: "bg-blue-950/20 text-blue-700 border-blue-800",
      TOOL: "bg-violet-900/20 text-violet-700 border-violet-200",
      EQUIPMENT: "bg-teal-900/20 text-teal-700 border-teal-200",
    };
    return map[cat] || "bg-[#222226] text-slate-500";
  };

  /* ──── 로딩 상태 ──── */
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#1a1a1e]">
        <MainHeader />
        <div className="max-w-7xl mx-auto px-4 pt-20 md:pt-24 pb-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#1a1a1e]">
      <MainHeader />
      <div className="max-w-7xl mx-auto px-4 pt-20 md:pt-24 pb-8">

        {/* ── 페이지 헤더 ── */}
        <div className="mb-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight leading-tight mb-2">
                프로토콜 기반 BOM 추출
              </h1>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed max-w-2xl">
                실험 프로토콜(PDF·텍스트)을 업로드하면 AI가 시약·장비 항목을 자동 추출합니다.
                <br className="hidden sm:block" />
                추출된 BOM으로 제품 검색, 벤더 비교, 견적 요청까지 한 흐름으로 이어집니다.
              </p>
            </div>
            {extractionResult && !bomSaved && (
              <Button
                onClick={() => {
                  if (!bomTitle.trim()) { setBomTitle(extractionResult.experimentType ? `${extractionResult.experimentType} 프로토콜 BOM` : "프로토콜 BOM"); }
                  setIsConfirmDialogOpen(true);
                }}
                disabled={reagents.length === 0}
                className="bg-[#1a1a1e] hover:bg-[#222226] text-white text-sm flex-shrink-0"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                BOM 확정하기
              </Button>
            )}
          </div>
          <StepIndicator current={currentStep} />
        </div>

        {/* ── BOM 저장 완료 배너 ── */}
        {bomSaved && (
          <div className="mb-5 rounded-xl border border-emerald-800 bg-emerald-900/20 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">BOM이 저장되었습니다</p>
                <p className="text-xs text-emerald-700">총 {reagents.length}개 항목 · 예상 {estimatedTotal > 0 ? `₩${estimatedTotal.toLocaleString("ko-KR")}` : "금액 미산출"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/test/search?q=${encodeURIComponent(reagents.slice(0, 3).map(r => r.name).join(" OR "))}`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-900/40">
                  <Search className="h-3.5 w-3.5" />시약 검색하기
                </Button>
              </Link>
              <Link href="/test/quote">
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <FileText className="h-3.5 w-3.5" />견적 요청하기
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── 메인 그리드 ── */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[380px,1fr]">

          {/* ════ 좌측: 프로토콜 입력 ════ */}
          <div className="space-y-4">
            <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e]">
              <CardHeader className="pb-3 p-4 md:p-5">
                <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-500" />
                  프로토콜 업로드
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  PDF 또는 텍스트를 입력하면 AI가 시약·장비 항목을 추출합니다.
                </p>
              </CardHeader>
              <CardContent className="px-4 md:px-5 pb-4 md:pb-5 space-y-4">
                <Tabs
                  value={activeTab ?? (pdfUploadEnabled ? "upload" : "paste")}
                  onValueChange={(v) => { setActiveTab(v); setPdfParseError(null); }}
                  className="w-full"
                >
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: pdfUploadEnabled ? "1fr 1fr" : "1fr" }}>
                    {pdfUploadEnabled && (
                      <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
                        <Upload className="h-3 w-3" />PDF 업로드
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="paste" className="flex items-center gap-1.5 text-xs">
                      <Clipboard className="h-3 w-3" />텍스트 붙여넣기
                    </TabsTrigger>
                  </TabsList>

                  {/* PDF 업로드 탭 */}
                  {pdfUploadEnabled && (
                    <TabsContent value="upload" className="mt-4 space-y-3">
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                          isDragging ? "border-blue-500 bg-blue-950/20" :
                          pdfFile ? "border-emerald-400 bg-emerald-900/20" :
                          "border-[#2a2a2e] bg-[#1a1a1e] hover:border-blue-300 hover:bg-blue-950/20/40 cursor-pointer"
                        }`}
                      >
                        <input id="protocol-file" type="file" accept=".pdf"
                          onChange={(e) => handleFile(e.target.files?.[0] || null)} className="hidden" />
                        {pdfFile ? (
                          <div className="space-y-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto">
                              <FileCheck className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-100 truncate max-w-[200px] mx-auto">{pdfFile.name}</p>
                              <p className="text-xs text-slate-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setPdfFile(null); const el = document.getElementById("protocol-file") as HTMLInputElement; if (el) el.value = ""; }} className="text-xs text-slate-400 hover:text-slate-400 h-7">
                              <X className="h-3 w-3 mr-1" />파일 제거
                            </Button>
                          </div>
                        ) : (
                          <label htmlFor="protocol-file" className="cursor-pointer space-y-2 block">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${isDragging ? "bg-blue-900/30" : "bg-slate-200"}`}>
                              <Upload className={`h-5 w-5 ${isDragging ? "text-blue-400" : "text-slate-500"}`} />
                            </div>
                            <p className="text-sm text-slate-400 font-medium">
                              {isDragging ? "파일을 놓아주세요" : "PDF 드래그 또는 클릭하여 선택"}
                            </p>
                            <p className="text-xs text-slate-400">최대 10MB</p>
                          </label>
                        )}
                      </div>
                      <Button
                        onClick={() => { setPdfParseError(null); pdfFile && extractFromFileMutation.mutate(pdfFile); }}
                        disabled={!pdfFile || extractFromFileMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {extractFromFileMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />분석 중...</>
                        ) : (
                          <><Sparkles className="h-4 w-4 mr-2" />AI 시약 추출 시작</>
                        )}
                      </Button>

                      {/* PDF 분석 실패 안내 */}
                      {pdfParseError && (
                        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 space-y-2.5">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-800 leading-relaxed">{pdfParseError}</p>
                          </div>
                          {pdfParseError.includes("스캔본") && (
                            <p className="text-xs text-amber-700 leading-relaxed pl-6">
                              스캔본 문서일 수 있어 OCR이 필요합니다. 텍스트 붙여넣기로 계속 진행해 주세요.
                            </p>
                          )}
                          {pdfParseError.includes("암호") ? (
                            <p className="text-xs text-amber-700 leading-relaxed pl-6">
                              PDF 암호를 해제한 후 다시 업로드해 주세요.
                            </p>
                          ) : (
                            <p className="text-xs text-amber-700 leading-relaxed pl-6">
                              텍스트 붙여넣기로 계속 진행해 주세요.
                            </p>
                          )}
                          <div className="flex gap-2 pl-6">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-900/40"
                              onClick={() => { setPdfParseError(null); pdfFile && extractFromFileMutation.mutate(pdfFile); }}
                            >
                              다시 시도
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => setActiveTab("paste")}
                            >
                              <Clipboard className="h-3 w-3 mr-1" />
                              텍스트 붙여넣기로 진행
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )}

                  {/* 텍스트 붙여넣기 탭 */}
                  <TabsContent value="paste" className="mt-4 space-y-3">
                    <Textarea
                      value={protocolText}
                      onChange={(e) => { setProtocolText(e.target.value); setExtractionResult(null); setReagents([]); setBomSaved(false); }}
                      placeholder={`예시:\n1. DMEM 배지에 10% FBS와 1% 페니실린-스트렙토마이신을 첨가합니다.\n2. 96-well plate에 1×10⁴ cells/well로 시딩합니다.\n3. 37°C, 5% CO₂에서 24시간 배양합니다.`}
                      rows={10}
                      className="text-sm font-mono resize-none"
                    />
                    <Button
                      onClick={() => protocolText.trim() && extractMutation.mutate(protocolText)}
                      disabled={!protocolText.trim() || extractMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {extractMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />분석 중...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />AI 시약 추출 시작</>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* BOM 설정 (결과 있을 때만) */}
            {extractionResult && (
              <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e]">
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-sm font-semibold text-slate-100">BOM 설정</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bom-title" className="text-xs font-medium text-slate-300">BOM 제목</Label>
                    <Input id="bom-title" value={bomTitle} onChange={(e) => setBomTitle(e.target.value)}
                      placeholder="예: ELISA 프로토콜 BOM" className="text-sm h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="experiment-rounds" className="text-xs font-medium text-slate-300">실험 횟수</Label>
                    <Input id="experiment-rounds" type="number" min="1" value={experimentRounds}
                      onChange={(e) => setExperimentRounds(parseInt(e.target.value) || 1)} className="text-sm h-9" />
                    <p className="text-[10px] text-slate-400">수량은 실험 횟수에 따라 자동 계산됩니다.</p>
                  </div>
                  <div className="space-y-2 pt-1">
                    {reagents.length > 0 && (
                      <Button
                        onClick={() => {
                          const queries = reagents.map((r) => r.name).filter(Boolean).slice(0, 5);
                          router.push(`/test/search?q=${encodeURIComponent(queries.join(" OR "))}`);
                        }}
                        variant="outline" className="w-full text-sm gap-2"
                      >
                        <Search className="h-3.5 w-3.5" />추출 품목으로 검색
                      </Button>
                    )}
                    <Button
                      onClick={() => setIsConfirmDialogOpen(true)}
                      disabled={!bomTitle.trim() || reagents.length === 0 || bomMutation.isPending}
                      className="w-full bg-[#1a1a1e] hover:bg-[#222226] text-white text-sm gap-2"
                    >
                      {bomMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />저장 중...</>
                        : <><CheckCircle2 className="h-4 w-4" />BOM 확정 및 저장</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ════ 우측: 추출 결과 ════ */}
          <div>
            {isAnalyzing ? (
              /* ── 분석 중 스켈레톤 ── */
              <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e] h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-blue-950/20 border border-blue-800 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">프로토콜 분석 중...</p>
                      <p className="text-xs text-blue-400">시약·기구·장비 항목을 추출하고 있습니다.</p>
                    </div>
                  </div>
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-3">
                        <div className="h-7 w-7 rounded-md bg-slate-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 w-3/4 rounded bg-slate-200" />
                          <div className="h-2 w-1/2 rounded bg-slate-200" />
                        </div>
                        <div className="h-5 w-12 rounded-full bg-slate-200 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : pdfParseError && !extractionResult ? (
              /* ── 분석 실패 ── */
              <Card className="shadow-none border-amber-800 bg-[#1a1a1e] h-full">
                <CardContent className="p-5 flex flex-col items-center justify-center min-h-[280px] text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-900/40 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-200">PDF 분석에 실패했습니다</p>
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{pdfParseError}</p>
                  </div>
                  <p className="text-xs text-slate-400">텍스트 붙여넣기로 대체 등록할 수 있습니다.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm" className="text-xs"
                      onClick={() => { setPdfParseError(null); pdfFile && extractFromFileMutation.mutate(pdfFile); }}
                      disabled={!pdfFile}
                    >
                      다시 시도
                    </Button>
                    <Button
                      size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setActiveTab("paste")}
                    >
                      <Clipboard className="h-3 w-3 mr-1" />텍스트 붙여넣기로 진행
                    </Button>
                  </div>
                </div>
              </div>
            ) : extractionResult ? (
              /* ── 추출 완료 ── */
              <div className="space-y-4">

                {/* 결과 요약 위젯 */}
                <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e]">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      {/* 프로토콜 타입 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {extractionResult.experimentType && (
                            <Badge variant="outline" className="text-xs">{extractionResult.experimentType}</Badge>
                          )}
                          {extractionResult.sampleType && (
                            <Badge variant="outline" className="text-xs text-slate-500">{extractionResult.sampleType}</Badge>
                          )}
                        </div>
                        {extractionResult.summary && (
                          <p className="text-xs text-slate-400 leading-relaxed">{extractionResult.summary}</p>
                        )}
                      </div>
                      {/* 통계 */}
                      <div className="flex gap-3 flex-shrink-0">
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-100">{reagents.length}</p>
                          <p className="text-[10px] text-slate-500">전체 항목</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-emerald-400">{matchedCount}</p>
                          <p className="text-[10px] text-slate-500">매칭 완료</p>
                        </div>
                        {unmatchedCount > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-amber-400">{unmatchedCount}</p>
                            <p className="text-[10px] text-slate-500">미매칭</p>
                          </div>
                        )}
                        {estimatedTotal > 0 && (
                          <div className="text-center border-l border-[#2a2a2e] pl-3">
                            <p className="text-lg font-bold text-slate-100">₩{(estimatedTotal / 10000).toFixed(0)}만</p>
                            <p className="text-[10px] text-slate-500">예상 총액</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {highRiskCount > 0 && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-800 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        <p className="text-xs text-red-700 font-medium">고위험 시약 {highRiskCount}개 — 취급 시 안전 수칙을 확인하세요.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* BOM 드래프트 테이블 */}
                <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e]">
                  <CardHeader className="pb-2 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-blue-500" />
                        BOM 초안
                        <span className="text-xs font-normal text-slate-400">— 인라인 편집 가능</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="REAGENT">시약</SelectItem>
                            <SelectItem value="TOOL">기구</SelectItem>
                            <SelectItem value="EQUIPMENT">장비</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleAddReagent} className="h-7 text-xs gap-1">
                          <Plus className="h-3 w-3" />항목 추가
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#1a1a1e] border-b border-[#2a2a2e]">
                            <TableHead className="w-10 text-[10px] pl-4">No.</TableHead>
                            <TableHead className="text-[10px]">품목명</TableHead>
                            <TableHead className="w-20 text-[10px]">분류</TableHead>
                            <TableHead className="w-24 text-[10px]">규격/수량</TableHead>
                            <TableHead className="text-[10px]">매칭 제품</TableHead>
                            <TableHead className="w-24 text-right text-[10px] pr-4">예상 금액</TableHead>
                            <TableHead className="w-14 text-[10px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-slate-100">
                          {filteredReagents.map((reagent, idx) => {
                            const qty = reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
                            const totalQty = Math.ceil(qty * experimentRounds);
                            const estimatedAmt = reagent.matchedProduct ? reagent.matchedProduct.price * totalQty : 0;
                            const isEditing = editingReagentId === reagent.id;

                            return (
                              <React.Fragment key={reagent.id}>
                                <TableRow className={`${reagent.matchedProduct?.isHighRisk ? "bg-red-950/30/30" : ""} hover:bg-[#1a1a1e]/60`}>
                                  <TableCell className="text-[11px] text-slate-400 pl-4">{idx + 1}</TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input value={reagent.name}
                                        onChange={(e) => handleEditReagent(reagent.id, { name: e.target.value })}
                                        onBlur={handleFinishEdit}
                                        autoFocus className="h-7 text-xs w-full max-w-[180px]" />
                                    ) : (
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-medium text-slate-200">{reagent.name || "—"}</span>
                                          {reagent.matchedProduct?.isHighRisk && (
                                            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                          )}
                                          {reagent.description && (
                                            <button onClick={() => toggleEvidence(reagent.id)}
                                              className="text-[10px] text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-0.5">
                                              <Info className="h-3 w-3" />근거
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Select value={reagent.category || "REAGENT"}
                                        onValueChange={(v: "REAGENT" | "TOOL" | "EQUIPMENT") => handleEditReagent(reagent.id, { category: v })}>
                                        <SelectTrigger className="h-7 text-xs w-20">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="REAGENT">시약</SelectItem>
                                          <SelectItem value="TOOL">기구</SelectItem>
                                          <SelectItem value="EQUIPMENT">장비</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${getCategoryColor(reagent.category)}`}>
                                        {getCategoryLabel(reagent.category)}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-[11px] text-slate-400">
                                    {isEditing ? (
                                      <div className="flex gap-1">
                                        <Input value={reagent.quantity || ""} placeholder="수량"
                                          onChange={(e) => handleEditReagent(reagent.id, { quantity: e.target.value })}
                                          className="h-7 text-xs w-14" />
                                        <Input value={reagent.unit || ""} placeholder="단위"
                                          onChange={(e) => handleEditReagent(reagent.id, { unit: e.target.value })}
                                          className="h-7 text-xs w-14" />
                                      </div>
                                    ) : (
                                      <span>{totalQty}{reagent.unit ? ` ${reagent.unit}` : ""}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {reagent.matchedProduct ? (
                                      <div>
                                        <div className="flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                          <span className="text-[11px] text-slate-300 truncate max-w-[140px]"
                                            title={reagent.matchedProduct.productName}>
                                            {reagent.matchedProduct.productName}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 ml-4">
                                          {reagent.matchedProduct.vendorName} · ₩{reagent.matchedProduct.price.toLocaleString("ko-KR")}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-amber-400">
                                        <AlertCircle className="h-3 w-3" />
                                        <span className="text-[10px]">미매칭</span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-[11px] font-medium pr-4">
                                    {estimatedAmt > 0
                                      ? <span className="text-slate-200">₩{estimatedAmt.toLocaleString("ko-KR")}</span>
                                      : <span className="text-slate-300">—</span>
                                    }
                                  </TableCell>
                                  <TableCell>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400">
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditingReagentId(reagent.id)}>
                                          <Edit2 className="h-3 w-3 mr-2" />편집
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                          if (reagent.matchedProduct?.productId) {
                                            router.push(`/test/search?q=${encodeURIComponent(reagent.name)}`);
                                          }
                                        }}>
                                          <Search className="h-3 w-3 mr-2" />검색
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteReagent(reagent.id)} className="text-destructive">
                                          <Trash2 className="h-3 w-3 mr-2" />삭제
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                                {/* 추출 근거 행 */}
                                {reagent.showEvidence && reagent.description && (
                                  <TableRow className="bg-blue-950/20/40">
                                    <TableCell colSpan={7} className="py-2 px-4">
                                      <div className="flex items-start gap-2">
                                        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <p className="text-[10px] font-semibold text-blue-400 mb-0.5">추출 근거</p>
                                          <p className="text-xs text-slate-400 leading-relaxed">{reagent.description}</p>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* 테이블 하단 합계 */}
                    {estimatedTotal > 0 && (
                      <div className="border-t border-[#2a2a2e] px-4 py-3 flex items-center justify-between bg-[#1a1a1e]">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">예상 총액 ({experimentRounds}회 기준)</span>
                        <span className="text-base font-bold text-slate-100">₩{estimatedTotal.toLocaleString("ko-KR")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 다음 단계 연결 */}
                <div className="rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100 mb-0.5">BOM 검토가 완료되었나요?</p>
                    <p className="text-xs text-slate-500">확정 후 바로 제품 검색이나 견적 요청으로 이어갈 수 있습니다.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-sm"
                      onClick={() => {
                        const queries = reagents.slice(0, 3).map(r => r.name).filter(Boolean);
                        router.push(`/test/search?q=${encodeURIComponent(queries.join(" OR "))}`);
                      }}>
                      <Search className="h-3.5 w-3.5" />시약 검색
                    </Button>
                    <Link href="/test/quote">
                      <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                        <FileText className="h-3.5 w-3.5" />견적 요청하기
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Empty state: 결과 안내 영역 ── */
              <Card className="shadow-none border-[#2a2a2e] bg-[#1a1a1e] h-full min-h-[400px] flex flex-col items-center justify-center">
                <CardContent className="py-10 px-6 text-center max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-blue-950/20 border border-blue-800 flex items-center justify-center mx-auto mb-5">
                    <FileCheck className="h-7 w-7 text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200 mb-1.5">
                    BOM 생성 결과가 여기에 표시됩니다
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    좌측에서 프로토콜을 업로드하면 AI가 시약·장비 항목을 추출하고,
                    BOM 초안을 자동 생성합니다.
                  </p>
                  <div className="rounded-xl border border-[#2a2a2e] bg-[#1a1a1e]/70 p-4 text-left space-y-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">생성되는 결과물</p>
                    {[
                      { icon: Package, label: "시약·장비 항목 목록", desc: "프로토콜에서 자동 추출" },
                      { icon: Search, label: "제품 매칭 결과", desc: "등록된 제품 DB와 자동 대조" },
                      { icon: FileText, label: "BOM 초안 테이블", desc: "수량·금액·분류 포함 편집 가능" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#1a1a1e] border border-[#2a2a2e] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <item.icon className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-300">{item.label}</p>
                          <p className="text-[11px] text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── BOM 확정 다이얼로그 ── */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">BOM 확정</DialogTitle>
            <DialogDescription className="text-sm">
              추출된 {reagents.length}개 항목으로 BOM을 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-[#2a2a2e]">
              <span className="text-slate-400">전체 항목</span>
              <span className="font-semibold text-slate-100">{reagents.length}개</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#2a2a2e]">
              <span className="text-slate-400">매칭 완료</span>
              <span className="font-semibold text-emerald-400">{matchedCount}개</span>
            </div>
            {unmatchedCount > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-[#2a2a2e]">
                <span className="text-slate-400">미매칭 (수동 검색 필요)</span>
                <span className="font-semibold text-amber-400">{unmatchedCount}개</span>
              </div>
            )}
            {estimatedTotal > 0 && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">예상 총액</span>
                <span className="font-bold text-slate-100">₩{estimatedTotal.toLocaleString("ko-KR")}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} className="flex-1">취소</Button>
            <Button onClick={() => bomMutation.mutate()} disabled={bomMutation.isPending} className="flex-1 bg-[#1a1a1e] hover:bg-[#222226] text-white">
              {bomMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />저장 중</> : "BOM 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
