"use client";

/**
 * Compare Analysis Drawer — V1-beta
 *
 * structured diff + AI insight + 공급사 문의 초안 + 견적 초안 생성.
 * 모든 CTA가 실제 API를 호출. Dead button 없음.
 * Inquiry draft는 DB에 영속화됨.
 */

import { csrfFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertTriangle, CheckCircle, Info, Mail, Sparkles,
  Copy, Check, ShoppingCart, HelpCircle, FileText, Clock, ExternalLink, ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { CompareInsight } from "@/lib/compare-workspace/compare-insight-generator";
import { getDecisionConfig, getDraftStatusConfig } from "@/lib/compare-workspace/decision-constants";
import {
  classifyCandidates,
  computeDeltaSummary,
  type CategorizedCandidate,
  type CompareCategory,
  type DeltaSummaryItem,
} from "@/lib/compare-workspace/compare-engine";
import { ChevronDown, ChevronUp, ListFilter, ArrowRightLeft, TrendingDown as TrendDown } from "lucide-react";

// ── Types ──

interface DiffItemDisplay {
  fieldKey: string;
  fieldLabel: string;
  diffType: string;
  sourceValue: unknown;
  targetValue: unknown;
  significance: string;
  actionability: string;
}

interface DiffResultDisplay {
  compareId: string;
  sourceEntityId: string;
  targetEntityId: string;
  totalFieldsCompared: number;
  totalDifferences: number;
  items: DiffItemDisplay[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    overallVerdict: string;
    verdictReason: string;
  };
}

interface CompareSessionData {
  id: string;
  productIds: string[];
  diffResult: DiffResultDisplay[];
  createdAt: string;
}

interface ProductInfo {
  id: string;
  name: string;
  brand?: string;
  catalogNumber?: string;
}

interface PersistedDraft {
  id: string;
  vendorName: string;
  productName: string;
  subject: string;
  body: string;
  inquiryFields: string[] | any;
  status: string;
  createdAt: string;
}

interface LinkedQuote {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface LinkedOutcomes {
  linkedQuotes: LinkedQuote[];
  allDrafts: PersistedDraft[];
  decisionState: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  latestActionAt: string | null;
}

interface CompareAnalysisDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  organizationId?: string;
  existingSessionId?: string;
}

// ── Badges ──

function SignificanceBadge({ significance }: { significance: string }) {
  const config: Record<string, { label: string; className: string }> = {
    CRITICAL: { label: "치명적", className: "bg-red-600/20 text-red-300" },
    HIGH: { label: "높음", className: "bg-orange-600/20 text-orange-300" },
    MEDIUM: { label: "보통", className: "bg-yellow-600/20 text-yellow-300" },
    LOW: { label: "낮음", className: "bg-blue-600/20 text-blue-300" },
    INFO: { label: "참고", className: "bg-el text-slate-400" },
  };
  const c = config[significance] || config.INFO;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function ActionabilityHint({ actionability }: { actionability: string }) {
  const hints: Record<string, string> = {
    REQUIRES_DECISION: "사용자 판단 필요",
    REQUIRES_REVIEW: "전문가 검토 권장",
    REQUIRES_INQUIRY: "공급사 확인 필요",
    AUTO_RESOLVABLE: "자동 해석 가능",
    INFORMATIONAL: "",
  };
  const hint = hints[actionability];
  if (!hint) return null;
  return <span className="text-xs text-slate-400 italic">{hint}</span>;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
    EQUIVALENT: { label: "동일", className: "text-green-400 bg-green-600/10", icon: CheckCircle },
    MINOR_DIFFERENCES: { label: "경미한 차이", className: "text-blue-400 bg-blue-600/10", icon: Info },
    SIGNIFICANT_DIFFERENCES: { label: "중요한 차이", className: "text-orange-400 bg-orange-600/10", icon: AlertTriangle },
    INCOMPATIBLE: { label: "대체 불가", className: "text-red-400 bg-red-600/10", icon: AlertTriangle },
    REQUIRES_EXPERT: { label: "전문가 판단 필요", className: "text-purple-400 bg-purple-600/10", icon: AlertTriangle },
  };
  const c = config[verdict] || config.MINOR_DIFFERENCES;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.className} gap-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function DraftStatusBadge({ status }: { status: string }) {
  const c = getDraftStatusConfig(status);
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

function DecisionStateBadge({ state }: { state: string | null }) {
  const c = getDecisionConfig(state);
  return (
    <Badge variant="outline" dot={c.dotColor as any} dotPulse={c.pulse} className="text-xs">
      {c.label}
    </Badge>
  );
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

// ── Category Badge ──

const CATEGORY_CONFIG: Record<CompareCategory, { label: string; className: string }> = {
  direct_comparable: { label: "직접 비교", className: "bg-green-600/20 text-green-300" },
  substitute_reference: { label: "대체 참조", className: "bg-amber-600/20 text-amber-300" },
  blocked_or_mismatch: { label: "비교 불가", className: "bg-red-600/20 text-red-300" },
};

function CategoryBadge({ category }: { category: CompareCategory }) {
  const c = CATEGORY_CONFIG[category];
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

// ── Zone A: Decision Header Surface ──
// 독립 상단 panel — 결론/CTA/후보분류가 스크롤 없이 보임

function DecisionHeader({
  diffResult,
  candidateCount,
  blockerSummary,
  directCount,
  referenceCount,
  blockedCount,
  shortlistCount,
  onRequestHandoff,
}: {
  diffResult: DiffResultDisplay;
  candidateCount: number;
  blockerSummary: string;
  directCount: number;
  referenceCount: number;
  blockedCount: number;
  shortlistCount: number;
  onRequestHandoff?: () => void;
}) {
  const canProceed = directCount > 0 || shortlistCount > 0;

  return (
    <div className="p-4 border rounded-lg bg-slate-900/80 border-slate-700 space-y-3">
      {/* Headline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={diffResult.summary.overallVerdict} />
          <span className="text-sm font-medium text-slate-200">{candidateCount}건 비교 완료</span>
        </div>
      </div>

      {/* Candidate Classification Chips */}
      <div className="flex gap-2 flex-wrap">
        {directCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            직접 비교 {directCount}
          </span>
        )}
        {referenceCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
            참고 후보 {referenceCount}
          </span>
        )}
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-400/70 border border-red-500/20">
            제외/보류 {blockedCount}
          </span>
        )}
      </div>

      {/* Blocker Warning */}
      {blockerSummary && (
        <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300">{blockerSummary}</p>
        </div>
      )}

      {/* Primary CTA */}
      <div className="pt-1">
        {canProceed ? (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
            onClick={onRequestHandoff}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            선택 후보 요청으로 넘기기 ({shortlistCount > 0 ? `${shortlistCount}건 선택` : `${directCount}건 비교 가능`})
          </Button>
        ) : (
          <div className="p-2.5 rounded bg-slate-800 border border-slate-700 text-center">
            <p className="text-xs text-slate-400">
              {directCount === 0 && referenceCount === 0
                ? "직접 비교 가능한 후보가 없어 요청으로 넘길 수 없습니다"
                : "현재 선택은 참고 후보만 포함하고 있어 요청 본문 후보가 없습니다"}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">{diffResult.summary.verdictReason}</p>
    </div>
  );
}

// ── Zone C: Candidate Decision Surface ──

type CandidateAction = "shortlist" | "hold" | "exclude" | null;

function CandidateSummaryCard({
  candidate,
  sourceProduct,
  action,
  onActionChange,
}: {
  candidate: CategorizedCandidate;
  sourceProduct: ProductInfo;
  action: CandidateAction;
  onActionChange: (action: CandidateAction) => void;
}) {
  const diff = candidate.diff;
  const criticalCount = diff?.summary.criticalCount ?? 0;
  const highCount = diff?.summary.highCount ?? 0;
  const totalDiffs = diff?.totalDifferences ?? 0;
  const isBlocked = candidate.category === "blocked_or_mismatch";

  return (
    <div className={`p-3 border rounded-lg space-y-2 ${
      isBlocked
        ? "bg-slate-900/30 border-slate-800/50 opacity-70"
        : candidate.category === "direct_comparable"
          ? "bg-slate-900/60 border-emerald-500/20"
          : "bg-slate-900/60 border-amber-500/15"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryBadge category={candidate.category} />
          <span className={`text-sm font-medium truncate ${isBlocked ? "text-slate-500" : ""}`}>{candidate.product.name}</span>
        </div>
        {diff && <VerdictBadge verdict={diff.summary.overallVerdict} />}
      </div>
      <p className="text-xs text-slate-400">{candidate.categoryReason}</p>
      {totalDiffs > 0 && (
        <div className="flex gap-2 flex-wrap">
          {criticalCount > 0 && <Badge variant="destructive" className="text-xs">치명적 {criticalCount}</Badge>}
          {highCount > 0 && <Badge className="text-xs bg-orange-600/20 text-orange-300">높음 {highCount}</Badge>}
          <Badge variant="outline" className="text-xs">차이 {totalDiffs}건</Badge>
        </div>
      )}
      {/* Shortlist / Hold / Exclude — blocked 후보에서는 제외 */}
      {!isBlocked && (
        <div className="flex gap-1.5 pt-1 border-t border-slate-800/50 mt-1">
          <Button
            size="sm"
            variant={action === "shortlist" ? "default" : "outline"}
            className="text-xs h-7 flex-1"
            onClick={() => onActionChange(action === "shortlist" ? null : "shortlist")}
          >
            후보 등록
          </Button>
          <Button
            size="sm"
            variant={action === "hold" ? "secondary" : "outline"}
            className="text-xs h-7 flex-1"
            onClick={() => onActionChange(action === "hold" ? null : "hold")}
          >
            보류
          </Button>
          <Button
            size="sm"
            variant={action === "exclude" ? "outline" : "outline"}
            className={`text-xs h-7 flex-1 ${action === "exclude" ? "bg-red-600/10 text-red-400 border-red-700" : ""}`}
            onClick={() => onActionChange(action === "exclude" ? null : "exclude")}
          >
            제외
          </Button>
        </div>
      )}
      {isBlocked && (
        <p className="text-xs text-red-400/60 italic">비교 불가 — {candidate.categoryReason}</p>
      )}
    </div>
  );
}

/** Candidate Section — category별 분리 렌더 */
function CandidateSectionGroup({
  title,
  subtitle,
  candidates,
  sourceProduct,
  candidateActions,
  onActionChange,
  borderColor,
}: {
  title: string;
  subtitle: string;
  candidates: CategorizedCandidate[];
  sourceProduct: ProductInfo;
  candidateActions: Record<string, CandidateAction>;
  onActionChange: (productId: string, action: CandidateAction) => void;
  borderColor: string;
}) {
  if (candidates.length === 0) return null;
  return (
    <div className={`space-y-2 p-3 rounded-lg border ${borderColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-slate-300">{title}</h4>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-xs tabular-nums text-slate-400">{candidates.length}건</span>
      </div>
      {candidates.map((c) => (
        <CandidateSummaryCard
          key={c.product.id}
          candidate={c}
          sourceProduct={sourceProduct}
          action={candidateActions[c.product.id] ?? null}
          onActionChange={(action) => onActionChange(c.product.id, action)}
        />
      ))}
    </div>
  );
}

// ── Delta Summary Section ──

function DeltaSummarySection({ deltas }: { deltas: DeltaSummaryItem[] }) {
  if (deltas.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendDown className="h-4 w-4" />
          핵심 Delta 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deltas.map((d) => (
          <div key={d.field} className="flex items-center justify-between p-2 border rounded bg-pn/50">
            <div>
              <span className="text-xs font-medium">{d.label}</span>
              <span className="text-xs text-slate-400 ml-2">기준: {formatDisplayValue(d.sourceValue)}</span>
            </div>
            <div className="text-right">
              {d.deltaDirection === "better" ? (
                <span className="text-xs font-medium text-green-400">{d.deltaDisplay}</span>
              ) : (
                <span className="text-xs text-slate-400">{d.deltaDisplay}</span>
              )}
              {d.deltaDirection === "better" && (
                <p className="text-xs text-slate-400 truncate max-w-[120px]">{d.bestProductName}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export function CompareAnalysisDrawer({
  open,
  onOpenChange,
  productIds,
  organizationId,
  existingSessionId,
}: CompareAnalysisDrawerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sessionData, setSessionData] = useState<CompareSessionData | null>(null);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [insight, setInsight] = useState<CompareInsight | null>(null);
  const [persistedDraft, setPersistedDraft] = useState<PersistedDraft | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkedOutcomes, setLinkedOutcomes] = useState<LinkedOutcomes | null>(null);
  const [decisionForm, setDecisionForm] = useState<{ state: string; note: string } | null>(null);
  const [isDecisionSaving, setIsDecisionSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  // Decision surface state
  const [candidateActions, setCandidateActions] = useState<Record<string, CandidateAction>>({});
  const [showRawDiffTable, setShowRawDiffTable] = useState(false);

  // Fetch linked outcomes for a session
  const fetchLinkedOutcomes = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/compare-sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setLinkedOutcomes({
        linkedQuotes: data.linkedQuotes ?? [],
        allDrafts: data.inquiryDrafts ?? [],
        decisionState: data.session?.decisionState ?? null,
        decisionNote: data.session?.decisionNote ?? null,
        decidedBy: data.session?.decidedBy ?? null,
        decidedAt: data.session?.decidedAt ?? null,
        latestActionAt: data.latestActionAt ?? null,
      });
    } catch { /* ignore */ }
  }, []);

  // Load existing session (reopen)
  const loadExistingSession = useCallback(async (sessionId: string) => {
    setIsLoadingExisting(true);
    try {
      const res = await fetch(`/api/compare-sessions/${sessionId}`);
      if (!res.ok) throw new Error("세션 로드 실패");
      const data = await res.json();
      setSessionData({
        id: data.session.id,
        productIds: data.session.productIds,
        diffResult: data.session.diffResult ?? [],
        createdAt: data.session.createdAt,
      });
      // Build product info from productIds + names (if available from session data)
      const pIds: string[] = Array.isArray(data.session.productIds) ? data.session.productIds : [];
      if (pIds.length > 0) {
        // Fetch product details
        const pRes = await csrfFetch("/api/products/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: pIds }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          setProducts((pData.products ?? []).map((p: any) => ({
            id: p.id, name: p.name, brand: p.brand, catalogNumber: p.catalogNumber,
          })));
        }
      }
      // Load linked outcomes
      setLinkedOutcomes({
        linkedQuotes: data.linkedQuotes ?? [],
        allDrafts: data.inquiryDrafts ?? [],
        decisionState: data.session?.decisionState ?? null,
        decisionNote: data.session?.decisionNote ?? null,
        decidedBy: data.session?.decidedBy ?? null,
        decidedAt: data.session?.decidedAt ?? null,
        latestActionAt: data.latestActionAt ?? null,
      });
      setInsight(data.session?.aiInsight ?? null);
      setPersistedDraft(null);
    } catch (err: any) {
      toast({ title: "세션 로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingExisting(false);
    }
  }, [toast]);

  // 비교 세션 생성 + diff 계산
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await csrfFetch("/api/compare-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, organizationId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "비교 세션 생성 실패");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      setSessionData(data.session);
      setProducts(data.products);
      setInsight(null);
      setPersistedDraft(null);
      // Fetch linked outcomes
      await fetchLinkedOutcomes(data.session.id);
      // Invalidate history list
      queryClient.invalidateQueries({ queryKey: ["compare-sessions"] });
    },
    onError: (err: Error) => {
      toast({ title: "비교 분석 실패", description: err.message, variant: "destructive" });
    },
  });

  // AI insight 생성
  const insightMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      const res = await csrfFetch(`/api/compare-sessions/${sessionData.id}/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductName: products[0]?.name || "기준 제품",
          targetProductName: products[1]?.name || "비교 대상",
          diffIndex: 0,
        }),
      });
      if (!res.ok) throw new Error("AI 분석 실패");
      return res.json();
    },
    onSuccess: (data) => {
      setInsight(data.insight);
      toast({ title: "AI 분석 완료", description: "핵심 변경 사항과 추천 액션을 확인하세요." });
    },
    onError: () => {
      toast({ title: "AI 분석 실패", variant: "destructive" });
    },
  });

  // AI 분석 자동 실행: 세션 로드 완료 + insight 없으면 자동 트리거
  useEffect(() => {
    if (sessionData && !insight && !insightMutation.isPending && !insightMutation.isSuccess) {
      insightMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData]);

  // 공급사 문의 초안 (영속화)
  const inquiryMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      if (!vendorName.trim()) throw new Error("공급사 이름을 입력하세요");
      const res = await csrfFetch(`/api/compare-sessions/${sessionData.id}/inquiry-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductName: products[0]?.name,
          targetProductName: products[1]?.name,
          vendorName: vendorName.trim(),
          diffIndex: 0,
        }),
      });
      if (!res.ok) throw new Error("초안 생성 실패");
      return res.json();
    },
    onSuccess: (data) => {
      setPersistedDraft(data.draft);
      toast({ title: "문의 초안 생성 및 저장 완료" });
    },
    onError: (err: Error) => {
      toast({ title: "초안 생성 실패", description: err.message, variant: "destructive" });
    },
  });

  // 견적 초안 생성 (compare → quote)
  const quoteDraftMutation = useMutation({
    mutationFn: async () => {
      if (!sessionData) throw new Error("세션 없음");
      const res = await csrfFetch(`/api/compare-sessions/${sessionData.id}/quote-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "견적 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "견적 초안 생성 완료", description: "견적 상세 페이지로 이동합니다." });
      onOpenChange(false);
      router.push(`/quotes/${data.quote.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "견적 생성 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !sessionData) {
      if (existingSessionId) {
        loadExistingSession(existingSessionId);
      } else if (productIds.length >= 2) {
        createSessionMutation.mutate();
      }
    }
  };

  // Save decision
  const handleSaveDecision = async () => {
    if (!sessionData || !decisionForm) return;
    setIsDecisionSaving(true);
    try {
      const res = await csrfFetch(`/api/compare-sessions/${sessionData.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionState: decisionForm.state,
          decisionNote: decisionForm.note || undefined,
        }),
      });
      if (!res.ok) throw new Error("판정 저장 실패");
      const data = await res.json();
      setLinkedOutcomes((prev) => prev ? {
        ...prev,
        decisionState: data.session.decisionState,
        decisionNote: data.session.decisionNote,
        decidedBy: data.session.decidedBy,
        decidedAt: data.session.decidedAt,
      } : prev);
      setDecisionForm(null);
      toast({ title: "판정 저장 완료" });
      queryClient.invalidateQueries({ queryKey: ["compare-sessions"] });
    } catch (err: any) {
      toast({ title: "판정 저장 실패", description: err.message, variant: "destructive" });
    } finally {
      setIsDecisionSaving(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!persistedDraft) return;
    await navigator.clipboard.writeText(`제목: ${persistedDraft.subject}\n\n${persistedDraft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // 상태를 COPIED로 업데이트
    if (sessionData) {
      fetch(`/api/compare-sessions/${sessionData.id}/inquiry-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: persistedDraft.id, status: "COPIED" }),
      }).then(() => {
        setPersistedDraft((prev) => prev ? { ...prev, status: "COPIED" } : null);
      }).catch(() => {});
    }

    toast({ title: "클립보드에 복사됨" });
  };

  const diffResult = sessionData?.diffResult?.[0];

  // 데이터 출처 부족 항목 카운트
  const missingDataItems = diffResult?.items.filter(
    (i) => i.diffType === "SOURCE_ONLY" || i.diffType === "TARGET_ONLY"
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className={`w-full overflow-y-auto ${productIds.length >= 3 ? "sm:max-w-2xl" : "sm:max-w-xl"}`}>
        <SheetHeader>
          <SheetTitle>구조적 비교 분석</SheetTitle>
          <SheetDescription>
            제품 간 차이를 구조적으로 분석하고 후속 조치를 실행합니다.
            {linkedOutcomes?.latestActionAt && (
              <span className="flex items-center gap-1 mt-1 text-xs">
                <Clock className="h-3 w-3" />
                마지막 활동: {relativeTime(linkedOutcomes.latestActionAt)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {(createSessionMutation.isPending || isLoadingExisting) && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">
              {isLoadingExisting ? "세션 불러오는 중..." : "비교 분석 중..."}
            </span>
          </div>
        )}

        {sessionData && diffResult && (
          <div className="mt-4 space-y-4">
            {/* ━━━ Zone A: Decision Header Surface ━━━ */}
            {(() => {
              // Pre-compute candidate classification for header
              const allDiffs = sessionData.diffResult;
              const candidatePs = products.slice(1);
              const cats = candidatePs.map((cp, idx) => {
                const d = allDiffs[idx];
                const v = d?.summary.overallVerdict;
                if (v === "INCOMPATIBLE") return "blocked_or_mismatch";
                if (v === "SIGNIFICANT_DIFFERENCES" && (d?.summary.highCount ?? 0) >= 2) return "substitute_reference";
                return "direct_comparable";
              });
              const directCount = cats.filter(c => c === "direct_comparable").length;
              const refCount = cats.filter(c => c === "substitute_reference").length;
              const blockedCount = cats.filter(c => c === "blocked_or_mismatch").length;
              const shortlistCount = Object.values(candidateActions).filter(a => a === "shortlist").length;

              return (
                <DecisionHeader
                  diffResult={diffResult}
                  candidateCount={products.length - 1}
                  blockerSummary={(() => {
                    const parts: string[] = [];
                    if (diffResult.summary.criticalCount > 0) parts.push(`치명적 ${diffResult.summary.criticalCount}건`);
                    if (missingDataItems.length > 0) parts.push(`데이터 누락 ${missingDataItems.length}건`);
                    return parts.join(", ");
                  })()}
                  directCount={directCount}
                  referenceCount={refCount}
                  blockedCount={blockedCount}
                  shortlistCount={shortlistCount}
                  onRequestHandoff={() => {
                    toast({ title: "요청 화면으로 이동합니다", description: "선택된 후보를 기반으로 견적 요청을 생성합니다." });
                    onOpenChange(false);
                  }}
                />
              );
            })()}

            {/* 판정 상태 */}
            {linkedOutcomes && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-slate-400">판정:</span>
                <DecisionStateBadge state={linkedOutcomes.decisionState} />
                {linkedOutcomes.decidedAt && (
                  <span className="text-xs text-slate-400">
                    ({new Date(linkedOutcomes.decidedAt).toLocaleDateString("ko-KR")})
                  </span>
                )}
              </div>
            )}

            {/* ━━━ Zone B: AI Judgment Surface — header 바로 아래 독립 block ━━━ */}
            {(() => {
              const allDiffs = sessionData.diffResult;
              const candidatePs = products.slice(1);
              const directItems = candidatePs.filter((_, idx) => {
                const v = allDiffs[idx]?.summary.overallVerdict;
                return v !== "INCOMPATIBLE" && !(v === "SIGNIFICANT_DIFFERENCES" && (allDiffs[idx]?.summary.highCount ?? 0) >= 2);
              });
              const refItems = candidatePs.filter((_, idx) => {
                const v = allDiffs[idx]?.summary.overallVerdict;
                return v === "SIGNIFICANT_DIFFERENCES" && (allDiffs[idx]?.summary.highCount ?? 0) >= 2;
              });
              const blockedItems = candidatePs.filter((_, idx) => allDiffs[idx]?.summary.overallVerdict === "INCOMPATIBLE");

              // 구조화된 AI 판단 요약 — 산문이 아니라 structured bullets
              const judgmentLines: Array<{ type: "priority" | "reference" | "excluded"; text: string }> = [];

              if (directItems.length > 0) {
                const names = directItems.map(p => p.name).join(", ");
                judgmentLines.push({
                  type: "priority",
                  text: `우선 검토: ${directItems.length}건 (${names}) — 가격/납기 기준 shortlist 가능`,
                });
              }
              if (refItems.length > 0) {
                const names = refItems.map(p => p.name).join(", ");
                judgmentLines.push({
                  type: "reference",
                  text: `참고 후보: ${refItems.length}건 (${names}) — 카테고리 유사, 직접 대체 제한`,
                });
              }
              if (blockedItems.length > 0) {
                const names = blockedItems.map(p => p.name).join(", ");
                judgmentLines.push({
                  type: "excluded",
                  text: `제외/보류: ${blockedItems.length}건 (${names}) — 카테고리 불일치 또는 치명적 차이`,
                });
              }

              if (judgmentLines.length === 0) return null;

              return (
                <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                    <h4 className="text-xs font-semibold text-blue-300">AI 판단 요약</h4>
                  </div>
                  <div className="space-y-1.5">
                    {judgmentLines.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                          line.type === "priority" ? "bg-emerald-400" :
                          line.type === "reference" ? "bg-amber-400" : "bg-red-400/60"
                        }`} />
                        <p className={`text-xs leading-relaxed ${
                          line.type === "priority" ? "text-slate-200" :
                          line.type === "reference" ? "text-slate-300" : "text-slate-400"
                        }`}>
                          {line.text}
                        </p>
                      </div>
                    ))}
                  </div>
                  {diffResult.summary.criticalCount > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-blue-500/10">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span className="text-xs text-amber-300">
                        치명적 차이 {diffResult.summary.criticalCount}건 — 담당자 직접 확인 필요
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ━━━ 2. Delta Summary (decision-first) ━━━ */}
            {(() => {
              // delta 계산을 위해 products를 ProductForCompare 형태로 매핑
              const sourceP = products[0];
              const candidatePs = products.slice(1);
              if (!sourceP || candidatePs.length === 0) return null;
              // CategorizedCandidate를 생성하려면 diff가 필요 — sessionData.diffResult 활용
              const allDiffs = sessionData.diffResult;
              const candidates: CategorizedCandidate[] = candidatePs.map((cp, idx) => {
                const diff = allDiffs[idx] ?? null;
                const verdict = diff?.summary.overallVerdict;
                let category: CompareCategory = "direct_comparable";
                let reason = "직접 비교 가능";
                if (verdict === "INCOMPATIBLE") {
                  category = "blocked_or_mismatch";
                  reason = `치명적 차이 ${diff?.summary.criticalCount ?? 0}건`;
                } else if (verdict === "SIGNIFICANT_DIFFERENCES" && (diff?.summary.highCount ?? 0) >= 2) {
                  category = "substitute_reference";
                  reason = `중요 차이 ${diff?.summary.highCount ?? 0}건 — 대체 참조용`;
                }
                return {
                  product: { id: cp.id, name: cp.name, brand: cp.brand ?? undefined, vendors: [] },
                  category,
                  categoryReason: reason,
                  diff: diff as any,
                };
              });

              // Delta summary 계산
              const deltas: DeltaSummaryItem[] = [];
              // 가격/납기 delta를 diff에서 추출
              for (const c of candidates) {
                if (c.category !== "direct_comparable" || !c.diff) continue;
                for (const item of (c.diff as any).items ?? []) {
                  if (item.fieldKey === "quoteAmount" && item.diffType === "DIFFERENT") {
                    const sv = Number(item.sourceValue);
                    const tv = Number(item.targetValue);
                    if (!isNaN(sv) && !isNaN(tv) && tv < sv) {
                      deltas.push({
                        field: "price",
                        label: "최저가",
                        sourceValue: sv,
                        bestValue: tv,
                        bestProductId: c.product.id,
                        bestProductName: c.product.name,
                        deltaDirection: "better",
                        deltaDisplay: `₩${tv.toLocaleString()} (${Math.round(((sv - tv) / sv) * 100)}% 절감)`,
                      });
                    }
                  }
                  if (item.fieldKey === "leadTimeDays" && item.diffType === "DIFFERENT") {
                    const sv = Number(item.sourceValue);
                    const tv = Number(item.targetValue);
                    if (!isNaN(sv) && !isNaN(tv) && tv < sv) {
                      deltas.push({
                        field: "leadTime",
                        label: "최단 납기",
                        sourceValue: sv,
                        bestValue: tv,
                        bestProductId: c.product.id,
                        bestProductName: c.product.name,
                        deltaDirection: "better",
                        deltaDisplay: `${tv}일 (${sv - tv}일 단축)`,
                      });
                    }
                  }
                }
              }

              return (
                <>
                  {deltas.length > 0 && <DeltaSummarySection deltas={deltas} />}

                  {/* ━━━ Zone C: Candidate Decision Surface — category별 분리 ━━━ */}
                  <div className="space-y-3">
                    <CandidateSectionGroup
                      title="우선 검토 — 직접 비교 가능"
                      subtitle="요청으로 넘길 수 있는 실질 후보"
                      candidates={candidates.filter(c => c.category === "direct_comparable")}
                      sourceProduct={sourceP}
                      candidateActions={candidateActions}
                      onActionChange={(id, action) => setCandidateActions(prev => ({ ...prev, [id]: action }))}
                      borderColor="border-emerald-500/20 bg-emerald-500/5"
                    />
                    <CandidateSectionGroup
                      title="참고 후보 — 대체/참조"
                      subtitle="카테고리 유사하지만 직접 비교 제한"
                      candidates={candidates.filter(c => c.category === "substitute_reference")}
                      sourceProduct={sourceP}
                      candidateActions={candidateActions}
                      onActionChange={(id, action) => setCandidateActions(prev => ({ ...prev, [id]: action }))}
                      borderColor="border-amber-500/15 bg-amber-500/5"
                    />
                    <CandidateSectionGroup
                      title="제외/보류"
                      subtitle="비교 불가 또는 카테고리 불일치"
                      candidates={candidates.filter(c => c.category === "blocked_or_mismatch")}
                      sourceProduct={sourceP}
                      candidateActions={candidateActions}
                      onActionChange={(id, action) => setCandidateActions(prev => ({ ...prev, [id]: action }))}
                      borderColor="border-slate-800/50 bg-slate-900/20"
                    />
                  </div>
                </>
              );
            })()}

            {/* ━━━ Zone D: Evidence / Detail Surface ━━━ */}
            <Tabs defaultValue="insight" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="insight">AI 비교 보조</TabsTrigger>
                <TabsTrigger value="action">후속 조치</TabsTrigger>
                <TabsTrigger value="diff" className="text-muted-foreground">속성 비교</TabsTrigger>
              </TabsList>

              {/* Raw Diff — collapsed, evidence role */}
              <TabsContent value="diff" className="space-y-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs flex items-center gap-1"
                  onClick={() => setShowRawDiffTable(!showRawDiffTable)}
                >
                  {showRawDiffTable ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  항목별 상세 비교 {showRawDiffTable ? "접기" : "펼치기"} ({diffResult.items.filter((i) => i.diffType !== "IDENTICAL").length}건)
                </Button>
                {showRawDiffTable && (
                  <>
                    {diffResult.items
                      .filter((item) => item.diffType !== "IDENTICAL")
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 border rounded-lg ${
                            item.diffType === "SOURCE_ONLY" || item.diffType === "TARGET_ONLY"
                              ? "bg-amber-600/10 border-amber-700"
                              : "bg-pn"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium">{item.fieldLabel}</span>
                            <SignificanceBadge significance={item.significance} />
                            {(item.diffType === "SOURCE_ONLY" || item.diffType === "TARGET_ONLY") && (
                              <Badge variant="outline" className="text-xs bg-amber-600/20 text-amber-400">
                                불완전
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>
                              <span className="text-slate-400">A:</span>{" "}
                              {item.sourceValue != null ? formatDisplayValue(item.sourceValue) : (
                                <span className="text-amber-400 italic">(정보 없음)</span>
                              )}
                            </div>
                            <div>
                              <span className="text-slate-400">B:</span>{" "}
                              {item.targetValue != null ? formatDisplayValue(item.targetValue) : (
                                <span className="text-amber-400 italic">(정보 없음)</span>
                              )}
                            </div>
                          </div>
                          <ActionabilityHint actionability={item.actionability} />
                        </div>
                      ))}
                    {diffResult.items.filter((i) => i.diffType !== "IDENTICAL").length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-4">
                        차이가 없습니다. 두 제품이 동일합니다.
                      </p>
                    )}
                    <div className="text-xs text-slate-400 pt-2 border-t">
                      비교 기준: 제품 DB 등록 정보 (카탈로그, 공급사 데이터).
                      문서 파싱 기반 비교는 V2에서 지원됩니다.
                    </div>
                  </>
                )}
              </TabsContent>

              {/* AI 분석 탭 */}
              <TabsContent value="insight" className="space-y-3 mt-3">
                {/* 로딩 상태 */}
                {!insight && insightMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <span className="text-sm text-slate-400">AI 비교 분석 중...</span>
                  </div>
                )}

                {/* 실패 시 수동 재실행 */}
                {!insight && !insightMutation.isPending && (
                  <Button
                    onClick={() => insightMutation.mutate()}
                    disabled={insightMutation.isPending}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI 분석 실행
                  </Button>
                )}

                {insight && (
                  <>
                    {/* 1. 권장 판단 요약 — decision-first */}
                    <Card className="border-blue-500/30 bg-blue-500/5">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-semibold text-blue-300">권장 판단</span>
                        </div>
                        <p className="text-sm leading-relaxed">{insight.overallAssessment}</p>
                      </CardContent>
                    </Card>

                    {/* 2. 추천 액션 — what to do next */}
                    {insight.recommendedActions.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">다음 액션</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.recommendedActions.map((action, i) => (
                              <div key={i} className="p-2 border rounded bg-pn">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {actionTypeLabel(action.actionType)}
                                  </Badge>
                                  <span className="text-sm font-medium">{action.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 3. 검토 필요 — blockers/warnings */}
                    {insight.reviewPoints.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">검토 필요 항목</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.reviewPoints.map((point, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                                  point.urgency === "HIGH" ? "text-red-500" : "text-yellow-500"
                                }`} />
                                <div>
                                  <span className="font-medium">{point.field}</span>
                                  <p className="text-muted-foreground text-xs">{point.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 4. 핵심 변경 사항 — context */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">핵심 변경 사항</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm space-y-1.5">
                          {insight.keyChanges.map((change, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-orange-500 mt-0.5">-</span>
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* 5. 불확실 항목 — caveats */}
                    {insight.uncertainFields.length > 0 && (
                      <Card className="border-amber-700 bg-amber-600/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-1.5">
                            <HelpCircle className="h-4 w-4 text-amber-400" />
                            불확실/미확인 항목
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {insight.uncertainFields.map((field, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium">{field.field}</span>
                                <p className="text-xs text-muted-foreground">{field.reason}</p>
                                <p className="text-xs text-amber-400 mt-0.5">
                                  해결: {field.suggestedResolution}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 6. AI 참고 고지 — footer */}
                    <div className="flex items-start gap-2 p-2 bg-el rounded text-xs text-slate-400">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        AI 분석은 제품 DB 데이터 기반 참고 자료입니다.
                        최종 판단은 담당자가 직접 확인하세요.
                      </span>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* 후속 조치 탭 */}
              <TabsContent value="action" className="space-y-3 mt-3">
                {/* 연결된 결과 */}
                {linkedOutcomes && (linkedOutcomes.linkedQuotes.length > 0 || linkedOutcomes.allDrafts.length > 0 || linkedOutcomes.decisionState) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        연결된 결과
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* 연결된 견적 */}
                      {linkedOutcomes.linkedQuotes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">연결된 견적</p>
                          <div className="space-y-1.5">
                            {linkedOutcomes.linkedQuotes.map((q) => (
                              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between p-2 border rounded hover:bg-el transition-colors">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-sm">{q.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{q.status}</Badge>
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 문의 초안 이력 */}
                      {linkedOutcomes.allDrafts.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">문의 초안 이력</p>
                          <div className="space-y-1.5">
                            {linkedOutcomes.allDrafts.map((d) => (
                              <div key={d.id} className="flex items-center justify-between p-2 border rounded bg-pn/50">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-sm">{d.vendorName}</span>
                                  <span className="text-xs text-slate-400">{d.productName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <DraftStatusBadge status={d.status} />
                                  <span className="text-xs text-slate-400">{relativeTime(d.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 판정 기록 + 변경 폼 */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1.5">판정 기록</p>
                        <div className="p-2 border rounded bg-pn/50 space-y-2">
                          <div className="flex items-center gap-2">
                            <DecisionStateBadge state={linkedOutcomes.decisionState} />
                            {linkedOutcomes.decisionNote && (
                              <span className="text-xs text-slate-400 truncate">{linkedOutcomes.decisionNote}</span>
                            )}
                            {linkedOutcomes.decidedAt && (
                              <span className="text-xs text-slate-400 ml-auto shrink-0">
                                {new Date(linkedOutcomes.decidedAt).toLocaleDateString("ko-KR")}
                              </span>
                            )}
                          </div>
                          {!decisionForm ? (
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setDecisionForm({ state: linkedOutcomes.decisionState || "UNDECIDED", note: linkedOutcomes.decisionNote || "" })}>
                              판정 변경
                            </Button>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <Select value={decisionForm.state} onValueChange={(v) => setDecisionForm((f) => f ? { ...f, state: v } : f)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UNDECIDED">검토 중</SelectItem>
                                  <SelectItem value="APPROVED">승인</SelectItem>
                                  <SelectItem value="HELD">보류</SelectItem>
                                  <SelectItem value="REJECTED">반려</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input placeholder="판정 메모 (선택)" value={decisionForm.note} onChange={(e) => setDecisionForm((f) => f ? { ...f, note: e.target.value } : f)} className="text-xs h-8" />
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1 text-xs h-7" onClick={handleSaveDecision} disabled={isDecisionSaving}>
                                  {isDecisionSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "저장"}
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setDecisionForm(null)}>
                                  취소
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 견적 초안 생성 CTA */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      비교 기반 견적 초안
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      비교 대상 {products.length}개 제품으로 견적 초안을 생성합니다.
                      비교 판정 결과가 견적에 연결됩니다.
                    </p>
                    <Button
                      onClick={() => quoteDraftMutation.mutate()}
                      disabled={quoteDraftMutation.isPending}
                      className="w-full"
                      size="sm"
                    >
                      {quoteDraftMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          견적 생성 중...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          견적 초안 생성
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 공급사 문의 초안 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      공급사 문의 초안
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">공급사 이름</label>
                      <Input
                        placeholder="예: Sigma-Aldrich, ThermoFisher"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => inquiryMutation.mutate()}
                      disabled={inquiryMutation.isPending || !vendorName.trim()}
                      className="w-full"
                      size="sm"
                    >
                      {inquiryMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          초안 생성 중...
                        </>
                      ) : (
                        <>
                          <Mail className="h-3.5 w-3.5 mr-2" />
                          문의 초안 생성
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 영속화된 초안 표시 */}
                {persistedDraft && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          생성된 초안
                          <DraftStatusBadge status={persistedDraft.status} />
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={handleCopyDraft}>
                          {copied ? (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 mr-1" />
                          )}
                          {copied ? "복사됨" : "복사"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground">제목</span>
                          <p className="text-sm font-medium">{persistedDraft.subject}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">본문</span>
                          <pre className="text-xs whitespace-pre-wrap bg-pn p-3 rounded border mt-1 max-h-60 overflow-y-auto">
                            {persistedDraft.body}
                          </pre>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(persistedDraft.inquiryFields)
                            ? persistedDraft.inquiryFields
                            : []
                          ).map((field: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          이 초안은 비교 세션에 연결되어 저장되었습니다.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatDisplayValue(val: unknown): string {
  if (val == null) return "(없음)";
  if (typeof val === "number") return val.toLocaleString("ko-KR");
  return String(val);
}

function actionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INQUIRE_VENDOR: "공급사 문의",
    REQUEST_EXPERT_REVIEW: "전문가 검토",
    PROCEED_WITH_ORDER: "주문 진행",
    HOLD_FOR_REVIEW: "검토 대기",
  };
  return labels[type] || type;
}
